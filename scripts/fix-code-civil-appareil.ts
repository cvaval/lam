/**
 * Corrige, dans le Code civil, trois défauts de saisie confrontés au fac-similé
 * (édition Zémès 2011, « Code Civil.pdf ») :
 *
 *  1. art. 165 — « © civ, 134, 155… » : le livre porte « c. civ., 134, 155… ».
 *     Le sigle de copyright est une séquelle d'OCR, il rend le renvoi illisible et
 *     invisible aux liens croisés.
 *  2. art. 1643 — « © ct, 1600 et suivants » : même défaut, même correction.
 *  3. art. 157 — une NOTE DE JURISPRUDENCE de l'éditeur (« Ne sera point valable… Cass.,
 *     6 mars 1900. ») a été recollée à la fin du texte officiel. Dans le livre elle est
 *     composée sous l'article, en deux colonnes et en petit corps : ce n'est pas la loi.
 *     Elle est retirée du texte officiel et RATTACHÉE aux annotations de l'article —
 *     rien n'est perdu, tout est remis à sa place.
 *
 * Par défaut : SIMULATION. `--apply` écrit, dans une transaction, et journalise.
 *
 *     npx tsx scripts/fix-code-civil-appareil.ts            # simulation
 *     npx tsx scripts/fix-code-civil-appareil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Remplacements littéraux dans le corps. `attendu` verrouille le nombre d'occurrences. */
const REMPLACEMENTS = [
  { quoi: 'art. 165 — sigle de copyright', de: '- © civ, 134, 155, 185, 904 et s', vers: '- C. civ., 134, 155, 185, 904 et s', attendu: 1 },
  { quoi: 'art. 1643 — sigle de copyright', de: 'simple prêt. © ct, 1600 et suivants', vers: 'simple prêt.- C. civ., 1600 et suivants', attendu: 1 },
]

/** Note recollée à retirer du texte officiel et à rattacher aux annotations. */
const VENTILATIONS = [
  {
    article: 157,
    cle: 'sec-25|art-157',
    // La note commence ici, juste après le renvoi qui clôt le texte officiel.
    depuis: 'Ne sera point valable, le mariage contracté en pays étranger',
    // Elle se termine par la référence de l'arrêt.
    jusqua: 'Cass., 6 mars 1900.',
  },
]

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_CIVIL_ANNOTE' },
    select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true, annotationsJson: true },
  })
  if (!doc) throw new Error('Code civil introuvable (source CODE_CIVIL_ANNOTE).')
  if (doc.bodyClean) throw new Error('bodyClean est renseigné : ce script suppose que le texte affiché est bodyOriginal.')

  let corps = doc.bodyOriginal
  const journal: Array<Record<string, unknown>> = []

  // ── 1 & 2 : remplacements littéraux ───────────────────────────────────────────
  for (const r of REMPLACEMENTS) {
    const n = corps.split(r.de).length - 1
    if (n !== r.attendu) throw new Error(`${r.quoi} : ${n} occurrence(s) de ${JSON.stringify(r.de)}, ${r.attendu} attendue(s).`)
    corps = corps.split(r.de).join(r.vers)
    console.log(`✓ ${r.quoi}\n    ${JSON.stringify(r.de)}\n  → ${JSON.stringify(r.vers)}`)
    journal.push({ type: 'remplacement', quoi: r.quoi, de: r.de, vers: r.vers })
  }

  // ── 3 : ventilation d'une note recollée ───────────────────────────────────────
  const ann = JSON.parse(doc.annotationsJson ?? '{}')
  ann.jurisprudence = ann.jurisprudence ?? {}
  for (const v of VENTILATIONS) {
    const i = corps.indexOf(v.depuis)
    if (i < 0) throw new Error(`art. ${v.article} : début de note introuvable.`)
    const j = corps.indexOf(v.jusqua, i)
    if (j < 0) throw new Error(`art. ${v.article} : fin de note introuvable.`)
    const fin = j + v.jusqua.length
    const note = corps.slice(i, fin).trim()
    // Le texte officiel ne doit pas perdre un caractère de plus que la note.
    const avant = corps.slice(Math.max(0, i - 120), i)
    corps = (corps.slice(0, i).trimEnd() + corps.slice(fin)).replace(/[ \t]+\n/g, '\n')

    const dejaLa = (ann.jurisprudence[v.cle] ?? []).some((c: { excerpt?: string }) => c.excerpt === note)
    if (!dejaLa) ann.jurisprudence[v.cle] = [...(ann.jurisprudence[v.cle] ?? []), { ref: '', excerpt: note }]

    console.log(`\n✓ art. ${v.article} — note de ${note.length} caractères ventilée vers « ${v.cle} »`)
    console.log(`    le texte officiel s'arrête désormais à : …${avant.slice(-90)}`)
    console.log(`    note rattachée : ${note.slice(0, 110)}…`)
    journal.push({ type: 'ventilation', article: v.article, cle: v.cle, taille: note.length })
  }

  console.log(`\nCorps : ${doc.bodyOriginal.length} → ${corps.length} caractères (${corps.length - doc.bodyOriginal.length}).`)
  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  // Le corps fait 700 Ko et les annotations 800 Ko : l'écriture dépasse le délai par
  // défaut d'une transaction interactive (5 s). On l'allonge plutôt que de renoncer à
  // l'atomicité — texte et annotations doivent bouger ensemble, ou pas du tout.
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: { bodyOriginal: corps, annotationsJson: JSON.stringify(ann) },
      })
      await audit(
        {
          action: 'ARTICLE_AMENDED',
          targetType: 'Document',
          targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'confrontation au fac-similé Zémès 2011', corrections: journal },
        },
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
