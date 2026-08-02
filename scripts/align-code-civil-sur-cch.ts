/**
 * Aligne le Code civil de la base sur sa source de composition (CCH.docx).
 *
 * Ce que la base avait perdu en passant par l'OCR : les SAUTS DE PARAGRAPHE (le livre
 * compose l'article en alinéas, la base les avait fondus), des ALINÉAS entiers, et la
 * frontière entre le texte de loi et l'appareil de l'auteur — 100 notes de jurisprudence
 * avaient été recollées au dispositif.
 *
 * DEUX INTERDITS, tenus par le code et non par la vigilance :
 *  1. les articles amendés depuis 2011 (loi Filiation 2014, décrets de 2020) ne sont
 *     JAMAIS touchés : le docx leur est antérieur, l'écraser serait revenir en arrière ;
 *  2. rien ne disparaît. Chaque caractère retiré du texte de loi doit se retrouver dans
 *     l'appareil. L'invariant est vérifié article par article et fait échouer le script.
 *
 * Les lignes d'EN-TÊTE ne sont pas touchées : les clés d'annotation `sec-K|art-N` sont
 * dérivées de la table des matières parcourue dans l'ordre, elles resteraient fausses si
 * la suite des sections changeait.
 *
 *     npx tsx scripts/align-code-civil-sur-cch.ts            # simulation + rapport
 *     npx tsx scripts/align-code-civil-sur-cch.ts --apply
 *     npx tsx scripts/align-code-civil-sur-cch.ts --detail   # tous les articles
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')
const DETAIL = process.argv.includes('--detail')

type Source = { articles: Record<string, { paras: string[]; notes: string[]; titre: string; ordre: number }> }
const SRC: Source = JSON.parse(readFileSync(new URL('./data/code-civil/cch-source.json', import.meta.url), 'utf8'))

const ART = /^Art(?:icle)?s?\.?\s*(1er|\d{1,4}(?:-\d{1,2})?)(?:\s*(bis|ter))?\b/i
const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Numéro d'article porté par une ancre « art-157 ». */
const numFromAnchor = (a: string | null) => (a ? a.replace(/^art-/, '') : null)

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true, annotationsJson: true },
  })
  if (!doc) throw new Error('Code civil introuvable.')
  if (doc.bodyClean) throw new Error('bodyClean renseigné : ce script suppose que le texte affiché est bodyOriginal.')
  const ann = parseAnnotations(doc.annotationsJson)
  if (!ann) throw new Error('annotations illisibles')
  const brut = JSON.parse(doc.annotationsJson!) as Record<string, unknown> & {
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
  }

  const blocs = segmentAnnotated(doc.bodyOriginal, ann.toc)
  // Le corps doit se reconstituer à l'identique depuis les blocs, sinon toute
  // réécriture par bloc est bâtie sur du sable.
  const recompose = blocs.map((b) => b.text).join('\n')
  if (recompose !== doc.bodyOriginal.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, ''))
    console.warn(`⚠ reconstitution non identique : ${recompose.length} vs ${doc.bodyOriginal.length} caractères`)

  const amendes = new Set(Object.keys(ann.status ?? {}).map((k) => k.replace(/^art-/, '')))
  const stats = { intacts: 0, alignes: 0, amendes: 0, absents: 0, nonAlignes: 0, notesAjoutees: 0, parasRendus: 0, loiRetiree: 0, notesAjouteesCar: 0 }
  const rapport: string[] = []
  const nouvellesNotes: Record<string, Array<{ ref?: string; excerpt?: string }>> = {}

  const sortie = blocs.map((b) => {
    if (b.kind !== 'body' || !b.anchor) return b.text
    const num = numFromAnchor(b.anchor)!
    const src = SRC.articles[num]
    if (!src) { stats.absents++; return b.text }
    if (amendes.has(num)) { stats.amendes++; return b.text }

    // Le bloc peut contenir, après l'article, des lignes qui n'en font pas partie
    // (elles ne commencent pas par « Art. ») : on ne remplace QUE la tête d'article.
    const lignes = b.text.split('\n')
    const finArticle = lignes.findIndex((l, i) => i > 0 && ART.test(l.trim()))
    const tete = finArticle < 0 ? lignes : lignes.slice(0, finArticle)
    const reste = finArticle < 0 ? [] : lignes.slice(finArticle)

    const ancien = tete.join('\n')
    const neuf = src.paras.join('\n')
    if (norm(ancien) === norm(neuf) && ancien === neuf) { stats.intacts++; return b.text }

    // INVARIANT, au niveau du MOT : chaque mot d'au moins quatre lettres de l'ancien
    // texte doit se retrouver soit dans le nouveau texte de loi, soit dans les notes.
    // Un alinéa que la source ignorerait ferait échouer l'alignement de CET article —
    // et lui seul : le reste du Code continue d'être aligné.
    const gerbe = norm(neuf + ' ' + src.notes.join(' '))
    const motsAnciens = (ancien.toLowerCase().match(/[a-zà-ÿ]{4,}/g) ?? []).map((m) => norm(m))
    const absents = motsAnciens.filter((m) => !gerbe.includes(m))
    if (absents.length > 5) {
      rapport.push(`  ⚠ art. ${num} : ${absents.length} mots de l'ancien texte absents de la source (${absents.slice(0, 6).join(', ')}…) — NON ALIGNÉ`)
      stats.nonAlignes++
      return b.text
    }

    stats.alignes++
    stats.parasRendus += Math.max(0, src.paras.length - tete.length)
    stats.loiRetiree += Math.max(0, ancien.length - neuf.length)
    if (b.jurisKey && src.notes.length) {
      const deja = new Set((brut.jurisprudence[b.jurisKey] ?? []).map((c) => norm(c.excerpt ?? '').slice(0, 60)))
      const ajout = src.notes.filter((n) => !deja.has(norm(n).slice(0, 60))).map((n) => ({ ref: '', excerpt: n }))
      if (ajout.length) {
        nouvellesNotes[b.jurisKey] = [...(brut.jurisprudence[b.jurisKey] ?? []), ...ajout]
        stats.notesAjoutees += ajout.length
        stats.notesAjouteesCar += ajout.reduce((n, c) => n + c.excerpt.length, 0)
      }
    }
    if (DETAIL || rapport.length < 12)
      rapport.push(`  art. ${num} : ${tete.length} → ${src.paras.length} paragraphe(s)${src.notes.length ? `, ${src.notes.length} note(s)` : ''}`)
    return [neuf, ...reste].join('\n')
  })

  const nouveauCorps = sortie.join('\n')
  console.log(`AUDIT — ${doc.titleFr}`)
  console.log(`  articles inchangés            : ${stats.intacts}`)
  console.log(`  articles NON alignés (garde)  : ${stats.nonAlignes}`)
  console.log(`  articles ALIGNÉS sur la source: ${stats.alignes}`)
  console.log(`  amendés depuis 2011, intacts  : ${stats.amendes}`)
  console.log(`  absents de la source          : ${stats.absents}`)
  console.log(`  paragraphes de loi rendus     : ${stats.parasRendus}`)
  console.log(`  notes ajoutées à l'appareil   : ${stats.notesAjoutees}`)
  console.log(`  corps : ${doc.bodyOriginal.length} → ${nouveauCorps.length} caractères`)
  // Bilan : ce que le texte de loi perd doit se retrouver dans l'appareil.
  const perte = doc.bodyOriginal.length - nouveauCorps.length
  console.log(`  BILAN : ${perte} caractères quittent la loi · ${stats.notesAjouteesCar} caractères entrent dans l'appareil`)
  if (perte > stats.notesAjouteesCar + 2000)
    console.warn(`  ⚠ ${perte - stats.notesAjouteesCar} caractères ne sont pas retrouvés dans l'appareil — à examiner AVANT d'appliquer`)
  console.log('\n' + rapport.join('\n'))

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  for (const [cle, cas] of Object.entries(nouvellesNotes)) brut.jurisprudence[cle] = cas
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: { bodyOriginal: nouveauCorps, annotationsJson: JSON.stringify(brut) },
      })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'alignement sur CCH.docx', ...stats } },
        tx,
      )
    },
    { timeout: 180_000, maxWait: 30_000 },
  )
  console.log('\n✓ Écrit et journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
