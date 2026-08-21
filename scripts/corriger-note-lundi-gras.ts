/**
 * Corrige la note du Lundi Gras au calendrier v2 — elle affirme le contraire de la règle.
 *
 *   npx tsx scripts/corriger-note-lundi-gras.ts            (à blanc)
 *   npx tsx scripts/corriger-note-lundi-gras.ts --apply    (écrit)
 *
 * ⚠️ CE QUE LA BASE AFFICHE AUJOURD'HUI, À CÔTÉ DE LA DATE :
 *
 *   « Lundi Gras — le décret du 11 décembre 2024 le chôme "à partir de midi" (art. 2, 1°). Choix
 *     de la rédaction, faute de texte sur le point : la demi-journée est comptée comme un jour
 *     entier pour la prorogation. »
 *
 * Cette note datait du 19 août, quand la demi-journée n'avait aucun fondement. Le décret de 2024
 * l'a fondée, et Me Vaval a tranché le 20 août : le Lundi Gras **ne proroge plus**, il reste
 * ouvrable le matin. La note dit donc l'inverse de ce que le moteur calcule — et elle est RENDUE
 * (`DelaiResult.tsx`), de sorte que la fiche se contredirait elle-même sous les yeux de l'avocat.
 *
 * ⚠️ SEULE LA VERSION 2 EST TOUCHÉE. La v1 est gelée : ses permaliens doivent rejouer ce qu'ils
 * rendaient, note comprise — et sous la v1 la demi-journée *était* comptée pour un jour entier,
 * donc sa note y reste vraie.
 *
 * Ce script ne touche QUE les trois colonnes de note, QUE sur la ligne `lundi-gras` de la v2.
 * Aucune date n'en dépend : le calcul est déjà juste, c'est la phrase qui ment.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'

const VERSION = 2
const CLE = 'lundi-gras'

/** La note exacte à remplacer — si elle a changé, on ne devine pas : on s'arrête. */
const ATTENDUE = 'la demi-journée est comptée comme un jour entier pour la prorogation'

const NOUVELLE = {
  fr:
    'Lundi Gras — le décret du 11 décembre 2024 le chôme « à partir de midi » (art. 2, 1°). ' +
    'La matinée reste ouvrable : le délai n’est pas prorogé, mais un acte à signifier doit l’être ' +
    'avant midi.',
  en:
    'Lundi Gras — the decree of 11 December 2024 closes it “from noon onwards” (art. 2, 1°). ' +
    'The morning remains a working half-day: the period is not extended, but a document to be ' +
    'served must be served before noon.',
  ht:
    'Lendi Gra — dekrè 11 desanm 2024 la fè l chome « apati midi » (atik 2, 1°). Maten an rete ' +
    'ouvrab : delè a pa pwolonje, men yon zak pou siyifye dwe siyifye anvan midi.',
}

async function main() {
  const apply = process.argv.includes('--apply')

  const ligne = await prisma.delaiFerie.findFirst({
    where: { versionCalendrier: VERSION, cle: CLE },
    select: { id: true, journee: true, noteJourneeFr: true, noteJourneeEn: true, noteJourneeHt: true },
  })
  if (!ligne) {
    console.error(`✗ Aucune ligne « ${CLE} » en version ${VERSION} — RIEN n’a été fait.`)
    await prisma.$disconnect()
    process.exitCode = 1
    return
  }

  console.log(`Ligne « ${CLE} », calendrier v${VERSION} — journee = ${ligne.journee}\n`)
  console.log('  AVANT (fr) :')
  console.log(`    ${ligne.noteJourneeFr ?? '—'}\n`)

  if (!ligne.noteJourneeFr?.includes(ATTENDUE)) {
    console.log('  La note n’est plus celle que ce script corrige — elle a déjà changé, ou autrement.')
    console.log('  RIEN n’a été fait : vérifiez avant d’insister.')
    await prisma.$disconnect()
    return
  }

  console.log('  APRÈS (fr) :')
  console.log(`    ${NOUVELLE.fr}`)
  console.log('\n  … et les versions anglaise et créole, aujourd’hui vides, sont renseignées.')

  // La v1 ne doit pas bouger : on le VÉRIFIE plutôt que de le promettre.
  const v1 = await prisma.delaiFerie.findFirst({
    where: { versionCalendrier: 1, cle: CLE },
    select: { noteJourneeFr: true },
  })
  console.log(`\n  v1 (gelée, non touchée) : « ${(v1?.noteJourneeFr ?? '—').slice(0, 78)}… »`)

  if (!apply) {
    console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
    await prisma.$disconnect()
    return
  }

  const avant = {
    fr: ligne.noteJourneeFr,
    en: ligne.noteJourneeEn,
    ht: ligne.noteJourneeHt,
  }
  await prisma.delaiFerie.update({
    where: { id: ligne.id },
    data: {
      noteJourneeFr: NOUVELLE.fr,
      noteJourneeEn: NOUVELLE.en,
      noteJourneeHt: NOUVELLE.ht,
    },
  })
  await audit({
    action: 'DELAI_CALENDAR_UPDATED',
    targetType: 'DelaiFerie',
    targetId: `calendrier-v${VERSION}`,
    meta: {
      via: 'scripts/corriger-note-lundi-gras.ts',
      motif:
        'la note affirmait que la demi-journée compte pour un jour entier ; depuis la décision ' +
        'du 20 août, le Lundi Gras ne proroge plus — la note disait le contraire du calcul',
      cle: CLE,
      avant, // ← pour pouvoir revenir en arrière
    },
  })
  console.log('\n✓ Note corrigée dans les trois langues. L’état antérieur est au journal (meta.avant).')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
