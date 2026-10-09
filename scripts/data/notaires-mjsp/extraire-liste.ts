/**
 * Extraction de la liste des notaires du MJSP vers l'amorçage
 * data/judicial-map/notaires-mjsp-v1.json — voir EMPREINTES.txt (même dossier).
 *
 *   npx tsx scripts/data/notaires-mjsp/extraire-liste.ts            # contrôle seul
 *   npx tsx scripts/data/notaires-mjsp/extraire-liste.ts --write    # (ré)écrit les entrées
 *
 * Le texte `pdftotext -layout` est lu par `parseMjspText` (src/lib/jurisdictions/
 * notaires-source.ts) : le motif n'existe qu'à un endroit, testé. Seules les ENTRÉES et le
 * compte annoncé sont réécrits ; les déclarations éditoriales de l'amorçage (alias, commune
 * non reconnue, décisions, particularités, comptes attendus) ne sont créées qu'une fois, puis
 * se modifient à la main — c'est là qu'elles se relisent.
 *
 * Le plan est ensuite calculé contre le référentiel de l'AMORÇAGE de la carte (seed-v1.json),
 * sans base : l'import, lui, recompte contre la base.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMjspText } from '../../../src/lib/jurisdictions/notaires-source'
import { buildNotaryPlan, communeRefsFromImportPlan, notarySeedSchema, type NotarySeed } from '../../../src/lib/jurisdictions/notaires-plan'
import { seedSchema } from '../../../src/lib/jurisdictions/seed-schema'
import { buildImportPlan, type GeoCorrespondence } from '../../../src/lib/jurisdictions/import-plan'

const TEXTE = 'scripts/data/notaires-mjsp/liste-mjsp-2026-10-09.txt'
const AMORCAGE = 'data/judicial-map/notaires-mjsp-v1.json'

/** Déclarations éditoriales initiales — reprises de la spécification du 9 oct. 2026. */
const MODELE: Omit<NotarySeed, 'entries'> = {
  schemaVersion: '1',
  description:
    'Liste des notaires de la République d’Haïti telle que publiée par le MJSP. Reproduite, jamais corrigée : '
    + 'la commune s’apparie par son nom (liste fermée), le département se déduit du référentiel de la plateforme.',
  edition: '2026-09-08',
  editionNote:
    'Ni la page du MJSP ni le fichier ne datent la liste : l’édition est la date de première consultation '
    + '(8 sept. 2026), à remplacer par la date d’arrêté de la liste si la cliente la fournit.',
  source: {
    publisher: 'Ministère de la Justice et de la Sécurité Publique (MJSP)',
    title: 'Liste des Notaires de la République d’Haïti',
    url: 'https://www.mjsp.gouv.ht/page/notaires',
    announcedCount: 423,
    extraction: 'pdftotext -layout (Poppler 26.07.0), motif MJSP_LINE_RE de notaires-source.ts',
    consultations: [
      {
        date: '2026-09-08', file: 'notaires-mjsp.pdf', bytes: 372060,
        sha256: '4d77f08495b117acef80dd947b3cd7a93037971770e0c754035373e0dd0ce716',
        producer: 'jsPDF 4.2.1', pdfCreatedAt: '2026-09-08T12:09:51-04:00',
      },
      {
        date: '2026-10-09', file: 'notaires-mjsp-2.pdf', bytes: 372060,
        sha256: 'cf0b0f15d2b78d30fab3ca28ae629167ffaaaedab5a0035885bdd444e9dc226e',
        producer: 'jsPDF 4.2.1', pdfCreatedAt: '2026-10-09T09:01:15-04:00',
      },
    ],
    textIdenticalAcrossConsultations: true,
  },
  communeAliases: [
    { source: 'BARADERE', communeId: 'commune-nippes-baraderes', communeName: 'Baradères' },
    { source: 'BELLANSE', communeId: 'commune-sud-est-belle-anse', communeName: 'Belle-Anse' },
    { source: 'CAYES', communeId: 'commune-sud-les-cayes', communeName: 'Les Cayes' },
    { source: 'CHAMBELAIN', communeId: 'commune-grand-anse-chambellan', communeName: 'Chambellan' },
    { source: 'CHARDONNIERE', communeId: 'commune-sud-chardonnieres', communeName: 'Chardonnières' },
    { source: 'COTE DE FER', communeId: 'commune-sud-est-cotes-de-fer', communeName: 'Côtes-de-Fer' },
    { source: 'COTEAUX', communeId: 'commune-sud-les-coteaux', communeName: 'Les Côteaux' },
    { source: 'ENERY', communeId: 'commune-artibonite-ennery', communeName: 'Ennery' },
    { source: 'GONAIVES', communeId: 'commune-artibonite-les-gonaives', communeName: 'Les Gonaïves' },
    { source: "L'AZILE", communeId: 'commune-nippes-l-asile', communeName: 'L’Asile' },
    { source: 'LES PERCHES', communeId: 'commune-nord-est-perches', communeName: 'Perches' },
    { source: 'LES ROSEAUX', communeId: 'commune-grand-anse-roseaux', communeName: 'Roseaux' },
    { source: 'MONBIN CROCHU', communeId: 'commune-nord-est-mombin-crochu', communeName: 'Mombin-Crochu' },
    { source: 'ST MARC', communeId: 'commune-artibonite-saint-marc', communeName: 'Saint-Marc' },
    { source: 'VERETTE', communeId: 'commune-artibonite-verrettes', communeName: 'Verrettes' },
  ],
  unresolvedCommunes: [
    {
      source: 'PETIT-BOURG DE PORT MARGOT',
      observation:
        'commune non reconnue : « Petit-Bourg de Port-Margot » n’est ni une commune du référentiel ni le nom de ville '
        + 'd’aucune ; Port-Margot a ses propres entrées (n° 151-153). Non rattachée faute de source citée.',
    },
  ],
  decisions: [
    {
      ordinal: 37,
      active: false,
      decidedOn: '2026-09-08',
      observation: 'retirée sur décision de la cliente — n’exerce qu’à Port-au-Prince (n° 21)',
    },
  ],
  knownPairs: [
    { ordinals: [103, 107], observation: 'Daniel Georges Carlet DURANDISSE / Daniel G. C. DURANDISSE' },
  ],
  sourceQuirks: [
    { ordinal: 6, mustContain: 'N . S .', observation: 'points espacés « N . S . » tels qu’imprimés' },
    { ordinal: 10, mustContain: 'Mrie ', observation: 'abréviation « Mrie » telle qu’imprimée' },
    { ordinal: 24, mustContain: 'Mrie ', observation: 'abréviation « Mrie » telle qu’imprimée' },
    { ordinal: 28, mustContain: 'Mrie-Ange', observation: 'abréviation « Mrie-Ange » telle qu’imprimée' },
    { ordinal: 64, mustContain: 'Jean Fitzner', observation: 'aucun patronyme en capitales dans la source' },
    { ordinal: 266, mustContain: 'Mme ', observation: 'civilité « Mme » imprimée dans le nom' },
    { ordinal: 271, mustContain: 'Mme ', observation: 'civilité « Mme » imprimée dans le nom' },
  ],
  expected: {
    entries: 423,
    inactive: 1,
    sourceCommunes: 126,
    directCommunes: 110,
    matchedCommunes: 125,
    unmatchedEntries: 1,
    departmentDisagreements: 33,
    placedActive: 421,
    // Totaux par TPI de la spécification (actifs seulement, n° 37 exclu) — recomptés à l'import.
    tpiTotals: {
      'court-tpi-tpi-de-port-au-prince': 57,
      'court-tpi-tpi-de-la-croix-des-bouquets': 35,
      'court-tpi-tpi-du-cap-haitien': 32,
      'court-tpi-tpi-des-cayes': 32,
      'court-tpi-tpi-de-jacmel': 28,
      'court-tpi-tpi-des-gonaives': 24,
      'court-tpi-tpi-de-jeremie': 21,
      'court-tpi-tpi-de-limbe': 20,
      'court-tpi-tpi-de-hinche': 20,
      'court-tpi-tpi-de-saint-marc': 18,
      'court-tpi-tpi-de-petit-goave': 16,
      'court-tpi-tpi-de-la-grande-riviere-du-nord': 16,
      'court-tpi-tpi-de-port-de-paix': 16,
      'court-tpi-tpi-de-fort-liberte': 13,
      'court-tpi-tpi-d-aquin': 12,
      'court-tpi-tpi-de-l-anse-a-veau': 12,
      'court-tpi-tpi-de-miragoane': 9,
      'court-tpi-tpi-de-ouanaminthe': 9,
      'court-tpi-tpi-des-coteaux': 8,
      'court-tpi-tpi-de-mirebalais': 8,
      'court-tpi-tpi-de-belladere': 8,
      'court-tpi-tpi-de-la-gonave': 4,
      'court-tpi-tpi-de-jean-rabel': 3,
    },
  },
}

function main() {
  const write = process.argv.includes('--write')
  const parsed = parseMjspText(readFileSync(resolve(process.cwd(), TEXTE), 'utf8'))
  console.log(`Liste MJSP — ${parsed.entries.length} entrées lues, ${parsed.announced ?? '?'} annoncées`)
  if (parsed.rejected.length) {
    console.error(`✗ ${parsed.rejected.length} ligne(s) numérotée(s) non reconnue(s) :`)
    for (const l of parsed.rejected) console.error(`   ${l}`)
    process.exit(1)
  }

  const chemin = resolve(process.cwd(), AMORCAGE)
  const existant = existsSync(chemin) ? (JSON.parse(readFileSync(chemin, 'utf8')) as Omit<NotarySeed, 'entries'>) : MODELE
  const seed = notarySeedSchema.parse({
    ...existant,
    source: { ...existant.source, announcedCount: parsed.announced ?? existant.source.announcedCount },
    entries: parsed.entries,
  })

  // Contrôle contre le référentiel de l'amorçage de la carte (pas de base ici).
  const carte = seedSchema.parse(JSON.parse(readFileSync(resolve(process.cwd(), 'data/judicial-map/seed-v1.json'), 'utf8')))
  const geo = (JSON.parse(readFileSync(resolve(process.cwd(), 'public/maps/hti/metadata.json'), 'utf8')) as { communeCorrespondence: GeoCorrespondence[] }).communeCorrespondence
  const plan = buildNotaryPlan(seed, communeRefsFromImportPlan(buildImportPlan(carte, geo)))
  for (const a of plan.anomalies) console.log(`  ${a.level === 'BLOQUANT' ? '✗' : '⚠'} ${a.message}`)
  const r = plan.report
  console.log(`  communes : ${r.sourceCommunes} dans la source · ${r.direct} directes · ${r.aliasesUsed.length} alias · ${r.unresolved.length} non reconnue(s) · ${r.matchedCommunes} appariées`)
  console.log(`  entrées : ${r.entries} · placées ${r.placedEntries} · actives placées ${r.placedActive} · inactives ${r.inactive.join(', ')}`)
  console.log(`  désaccords de département : ${r.disagreements.length} · doublons : ${r.duplicates.length}`)

  if (!write) { console.log('\n(contrôle seul — relancer avec --write pour écrire l’amorçage)'); return }
  if (plan.anomalies.some((a) => a.level === 'BLOQUANT')) { console.error('✗ constat bloquant — amorçage non écrit'); process.exit(1) }
  writeFileSync(chemin, `${JSON.stringify(seed, null, 2)}\n`)
  console.log(`\n✓ ${AMORCAGE} écrit (${seed.entries.length} entrées)`)
}

main()
