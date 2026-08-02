/**
 * Rend à l'appareil les notes de jurisprudence restées collées au dispositif.
 *
 * Le discriminant est sans appel : **un code de 1825 ne cite pas un arrêt de 1941**.
 * Un paragraphe du dispositif qui porte « Cass., 15 juillet 1941 » est une note de
 * l'auteur, pas une disposition — quelle que soit la façon dont le recueil l'a composé.
 *
 * Seuls les paragraphes de FIN d'article sont déplacés : une note enclavée au milieu du
 * dispositif signalerait un désordre plus profond, qui doit être vu et non deviné. Ces
 * cas-là sont signalés, pas corrigés.
 *
 * Le texte n'est pas perdu : il passe du corps à l'appareil, sous la clé de l'article.
 *
 *     npx tsx scripts/ventiler-notes-collees-code-civil.ts
 *     npx tsx scripts/ventiler-notes-collees-code-civil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Référence d'arrêt : la signature d'une note. */
const ARRET = /\bCass\.?\s*,?\s*(?:\d{1,2}(?:er)?\s+[a-zéûàî]+\s+\d{4}|arr[êe]t|\d{4})/i
const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

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

  let deplacees = 0
  let enclavees = 0
  const rapport: string[] = []
  const ajouts: Record<string, Array<{ ref?: string; excerpt?: string }>> = {}

  const sortie = blocs.map((b) => {
    if (b.kind !== 'body' || !b.anchor) return b.text
    const lignes = b.text.split('\n')
    // notes de FIN : on remonte tant que la ligne cite un arrêt (jamais la première).
    let i = lignes.length
    while (i > 1 && ARRET.test(lignes[i - 1])) i--
    if (i >= lignes.length) {
      // une note citée AILLEURS qu'en fin d'article : signalée, laissée en place.
      const ailleurs = lignes.slice(1, -1).filter((l) => ARRET.test(l))
      if (ailleurs.length) {
        enclavees += ailleurs.length
        if (rapport.length < 40) rapport.push(`  ⚠ ${b.anchor} : note enclavée dans le dispositif — laissée en place\n      ${ailleurs[0].slice(0, 140)}`)
      }
      return b.text
    }
    const notes = lignes.slice(i)
    if (!b.jurisKey) return b.text
    const deja = new Set((brut.jurisprudence[b.jurisKey] ?? []).map((c) => norm(c.excerpt ?? '').slice(0, 60)))
    const nouvelles = notes.filter((n) => !deja.has(norm(n).slice(0, 60))).map((n) => ({ ref: '', excerpt: n.trim() }))
    if (nouvelles.length) ajouts[b.jurisKey] = [...(brut.jurisprudence[b.jurisKey] ?? []), ...nouvelles]
    deplacees += notes.length
    if (rapport.length < 40)
      rapport.push(`  ${b.anchor} : ${notes.length} note(s) rendue(s) à l'appareil\n      ${notes[0].slice(0, 140)}`)
    return lignes.slice(0, i).join('\n')
  })

  const nouveauCorps = sortie.join('\n')
  console.log(`notes déplacées du dispositif vers l'appareil : ${deplacees}`)
  console.log(`notes enclavées, signalées et laissées en place : ${enclavees}`)
  console.log(`corps : ${doc.bodyOriginal.length} → ${nouveauCorps.length} caractères\n`)
  console.log(rapport.join('\n'))

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  for (const [cle, cas] of Object.entries(ajouts)) brut.jurisprudence[cle] = cas
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: { bodyOriginal: nouveauCorps, annotationsJson: JSON.stringify(brut) },
      })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'ventilation des notes restées dans le dispositif', deplacees, enclavees } },
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
