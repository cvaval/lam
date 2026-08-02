/**
 * Les trois derniers articles où une note reste soudée au dispositif — sur la LIGNE
 * même de l'article, ce qu'une ventilation ligne à ligne ne pouvait pas atteindre.
 * Chacun a été relu sur le fac-similé (édition Zémès 2011).
 *
 *  - **682** (p. 152) : le dispositif s'arrête à « … il décide les contestations.- C. p. c.
 *    343, ets, 922. ». Suit la note « L'accord des parties… Cass., 15 juin 1928 », puis un
 *    fragment de l'ARTICLE 683 recopié là, en-tête mangé (« . 683 »). L'article 683 existe
 *    en propre quelques lignes plus bas : le fragment est un doublon, il est retiré.
 *  - **1780** (amendé) : la note « 1. Il appartient souverainement aux juges du fond…
 *    Cass., 4 mars 1890 » — que l'OCR ouvre sur « !. 1 » — quitte le dispositif.
 *  - **1846** (p. 371, amendé) : « Le créancier cessionnaire… Cass., 6 décembre 1926 » est
 *    composé en DEUX COLONNES sous l'article : c'est une note, malgré ce qu'en dit le docx.
 *
 * Les articles 1780 et 1846 sont amendés : on ne touche pas à leur dispositif, seulement
 * à ce qui n'y appartient pas.
 *
 *     npx tsx scripts/fix-code-civil-trois-derniers.ts
 *     npx tsx scripts/fix-code-civil-trois-derniers.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated } from '../src/lib/legislation/annotated'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Pour chaque article : la fin du dispositif, et ce qu'on fait de la suite. */
const CAS = [
  {
    art: '682',
    finDispositif: 'il décide les contestations.- C. p. c. 343, ets, 922.',
    note: 'accord des parties',
    finNote: 'Aff. Salomon vs. Télémaque.',
    // ce qui suit la note est un doublon de l'article 683, qui existe en propre
    doublonDe: '683',
  },
  // l'OCR ouvre la note sur « !. 1 » ; le docx donne « 1. Il ».
  { art: '1780', finDispositif: 'C. civ., 1100, 1102, 1103, 1777, 1778.', note: 'appartient souverainement', corriger: ['!. 1 appartient', '1. Il appartient'] },
  { art: '1846', finDispositif: 'C. civ., 1682, 1694 et s, 1840, 1845, 1869-2°.', note: 'créancier cessionnaire' },
] as const

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

  const notesAjoutees: Record<string, Array<{ ref?: string; excerpt?: string }>> = {}
  let traites = 0

  const sortie = blocs.map((b) => {
    if (b.kind !== 'body' || !b.anchor) return b.text
    const cas = CAS.find((c) => `art-${c.art}` === b.anchor)
    if (!cas) return b.text
    const lignes = b.text.split('\n')
    const i = lignes.findIndex((l) => l.includes(cas.finDispositif))
    if (i < 0) throw new Error(`art. ${cas.art} : fin du dispositif introuvable (${cas.finDispositif})`)
    const ligne = lignes[i]
    const coupe = ligne.indexOf(cas.finDispositif) + cas.finDispositif.length
    let suite = ligne.slice(coupe).trim()
    if (!suite) throw new Error(`art. ${cas.art} : rien à ventiler après le dispositif`)

    // Le fragment d'article recopié est retiré — après avoir vérifié qu'il existe ailleurs.
    if ('doublonDe' in cas && cas.doublonDe) {
      const fin = suite.indexOf(cas.finNote!)
      if (fin < 0) throw new Error(`art. ${cas.art} : fin de note introuvable`)
      const doublon = suite.slice(fin + cas.finNote!.length).trim()
      const propre = blocs.find((x) => x.kind === 'body' && x.anchor === `art-${cas.doublonDe}`)
      if (!propre || !norm(propre.text).includes(norm(doublon).slice(0, 120)))
        throw new Error(`art. ${cas.art} : le fragment attribué à l'article ${cas.doublonDe} ne s'y retrouve pas — pas de suppression à l'aveugle`)
      console.log(`  art. ${cas.art} : fragment de l'article ${cas.doublonDe} retiré (${doublon.length} car.), il figure bien en propre`)
      suite = suite.slice(0, fin + cas.finNote!.length).trim()
    }

    if ('corriger' in cas && cas.corriger) {
      const [de, vers] = cas.corriger
      if (!suite.includes(de)) throw new Error(`art. ${cas.art} : coquille « ${de} » attendue et absente`)
      suite = suite.replace(de, vers)
      console.log(`  art. ${cas.art} : coquille corrigée — « ${de} » → « ${vers} »`)
    }
    if (!norm(suite).includes(norm(cas.note)))
      throw new Error(`art. ${cas.art} : la note attendue (« ${cas.note} ») n'est pas au rendez-vous`)

    if (b.jurisKey) {
      const deja = new Set((brut.jurisprudence[b.jurisKey] ?? []).map((c) => norm(c.excerpt ?? '').slice(0, 60)))
      if (!deja.has(norm(suite).slice(0, 60)))
        notesAjoutees[b.jurisKey] = [...(brut.jurisprudence[b.jurisKey] ?? []), { ref: '', excerpt: suite }]
    }
    traites++
    console.log(`  art. ${cas.art} : note de ${suite.length} caractères rendue à l'appareil`)
    console.log(`      dispositif : …${ligne.slice(Math.max(0, coupe - 70), coupe)}`)
    console.log(`      note       : ${suite.slice(0, 110)}…`)
    lignes[i] = ligne.slice(0, coupe)
    return lignes.join('\n')
  })

  if (traites !== CAS.length) throw new Error(`${traites} article(s) traité(s) sur ${CAS.length} attendus`)
  const nouveauCorps = sortie.join('\n')
  console.log(`\ncorps : ${doc.bodyOriginal.length} → ${nouveauCorps.length} caractères`)

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  for (const [cle, cas] of Object.entries(notesAjoutees)) brut.jurisprudence[cle] = cas
  await prisma.$transaction(
    async (tx) => {
      await tx.document.update({
        where: { id: doc.id },
        data: { bodyOriginal: nouveauCorps, annotationsJson: JSON.stringify(brut) },
      })
      await audit(
        { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
          meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'trois notes soudées au dispositif, relues sur le fac-similé', articles: CAS.map((c) => c.art) } },
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
