/**
 * Retire de l'appareil les notes qui répètent le TEXTE DE LOI de leur propre article.
 *
 * Quand la base a été constituée, les items numérotés du dispositif (« 1. D'user de la
 * chose louée… ») avaient été pris pour des notes de jurisprudence. L'alignement sur
 * CCH.docx les a rendus à la loi ; ils restaient donc en double, une fois comme
 * disposition et une fois comme note.
 *
 * La comparaison se fait sur le texte NORMALISÉ (sans accents ni ponctuation) car les
 * deux exemplaires viennent d'OCR différents : « 1869-1° » ici, « 1869-P° » là.
 *
 *     npx tsx scripts/purger-notes-doublons-code-civil.ts
 *     npx tsx scripts/purger-notes-doublons-code-civil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Articles effectivement alignés sur CCH.docx : eux seuls peuvent avoir des doublons.
 *  Ailleurs, la « note en double » est le seul exemplaire propre — la retirer la perdrait. */
const SRC = JSON.parse(readFileSync(new URL('./data/code-civil/cch-source.json', import.meta.url), 'utf8')) as {
  articles: Record<string, unknown>
}

const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Une note qui cite un arrêt n'est JAMAIS purgée : si elle figure aussi dans le
 *  dispositif, c'est le dispositif qui est en faute, et l'appareil garde le seul
 *  exemplaire correctement rangé. Ces cas sont signalés, pas supprimés. */
const ARRET = /\b(Cass\.|Aff\.|Bull\.)/i

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, bodyOriginal: true, annotationsJson: true },
  })
  if (!doc) throw new Error('Code civil introuvable.')
  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as {
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
  }
  const blocs = segmentAnnotated(doc.bodyOriginal, ann.toc)
  const amendes = new Set(Object.keys(ann.status ?? {}).map((k) => k.replace(/^art-/, '')))

  let retirees = 0
  let ignores = 0
  let signales = 0
  const aSignaler: string[] = []
  const exemples: string[] = []
  for (const b of blocs) {
    if (b.kind !== 'body' || !b.jurisKey) continue
    const notes = brut.jurisprudence[b.jurisKey]
    if (!notes?.length) continue
    const num = (b.anchor ?? '').replace(/^art-/, '')
    if (!SRC.articles[num] || amendes.has(num)) { ignores++; continue }
    // Seuls les ITEMS NUMÉROTÉS du dispositif servent d'empreinte : ce sont eux que
    // l'alignement vient de restituer, et donc les seuls doublons certains. Une note
    // doctrinale qui se retrouverait dans la loi relève d'un autre défaut — on la
    // signale, on ne la supprime pas d'un côté au risque de la perdre.
    const loi = b.text
      .split('\n')
      .filter((l) => /^\d{1,2}\s*[.°)]\s/.test(l.trim()))
      .map((l) => norm(l).slice(0, 50))
      .filter((s) => s.length >= 30)
    if (!loi.length) continue
    const gardees = notes.filter((c) => {
      const e = norm(c.excerpt ?? '').slice(0, 50)
      const doublon = e.length >= 30 && loi.some((l) => l.startsWith(e.slice(0, 30)) || e.startsWith(l.slice(0, 30)))
      if (doublon && ARRET.test(c.excerpt ?? '')) {
        signales++
        if (aSignaler.length < 8) aSignaler.push(`  ${b.anchor} : ${(c.excerpt ?? '').slice(0, 90)}`)
        return true
      }
      if (doublon) {
        retirees++
        if (exemples.length < 10) exemples.push(`  ${b.anchor} : ${(c.excerpt ?? '').slice(0, 95)}`)
      }
      return !doublon
    })
    if (gardees.length !== notes.length) {
      if (gardees.length) brut.jurisprudence[b.jurisKey] = gardees
      else delete brut.jurisprudence[b.jurisKey]
    }
  }

  console.log(`notes retirées (répétaient la loi) : ${retirees}`)
  console.log(`articles hors alignement, laissés intacts : ${ignores}`)
  console.log(`notes citant un arrêt et encore présentes dans le dispositif (signalées, NON purgées) : ${signales}`)
  aSignaler.forEach((e) => console.log(e))
  console.log()
  exemples.forEach((e) => console.log(e))
  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({ where: { id: doc.id }, data: { annotationsJson: JSON.stringify(brut) } })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'purge des notes répétant le dispositif', retirees } },
        tx,
      )
    },
    { timeout: 120_000, maxWait: 30_000 },
  )
  console.log('\n✓ Écrit et journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
