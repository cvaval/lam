/**
 * Chaîne d'abrogation de la section Circulaires BRH — table VÉRIFIÉE, une entrée par
 * relation, chacune justifiée par la clause du texte citée VERBATIM.
 *
 * Établie par relevé systématique des 142 corps (verbes « abroge / annule / remplace »),
 * puis lecture de chaque phrase. Trois garde-fous refusent l'écriture :
 *   1. la circulaire abrogeante ET la cible doivent exister en base ;
 *   2. la date d'EFFET de la clause doit être passée — une circulaire signée n'abroge
 *      qu'à sa prise d'effet (la 87-1, signée le 16 février 2026, ne fera tomber la 87
 *      que le 1er octobre 2026 : la relation est donc DÉCLARÉE ici mais non appliquée) ;
 *   3. le numéro doit être sous forme canonique (le bandeau de la fiche résout par NUMÉRO).
 *
 * Idempotent. Écrit aussi les statuts dans brh-enrichments.json, que import-brh rejoue
 * après sa purge — sans quoi un ré-import rétablirait « en vigueur » sur tous ces textes.
 *   npx tsx scripts/_apply-abrogations-brh.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { parseCirculaireRef } from '../src/lib/brh/gaps'

interface Relation {
  cible: string
  par: string
  /** Date d'effet ANNONCÉE PAR LA CLAUSE (pas la date de signature). */
  effet: string
  /** Extrait verbatim du texte abrogeant — la seule justification admise. */
  clause: string
}

export const ABROGATIONS: Relation[] = [
  { cible: 'Circulaire n° 95', par: 'Circulaire n° 95-1', effet: '2008-11-03',
    clause: 'La présente circulaire entre en vigueur le 3 novembre 2008 et remplace la circulaire No 95 du 1er août 2000.' },
  { cible: 'Circulaire n° 72-3', par: 'Circulaire n° 111', effet: '2017-09-25',
    clause: 'La présente circulaire abroge les circulaires No 72-3 du 1er septembre 1998 et 78-1 du 27 mars 2000.' },
  { cible: 'Circulaire n° 78-1', par: 'Circulaire n° 111', effet: '2017-09-25',
    clause: 'La présente circulaire abroge les circulaires No 72-3 du 1er septembre 1998 et 78-1 du 27 mars 2000.' },
  { cible: 'Circulaire n° 61-2', par: 'Circulaire n° 63-3', effet: '2020-11-03',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 61-2 et entrent en vigueur le 3 novembre 2020.' },
  { cible: 'Circulaire n° 89-1', par: 'Circulaire n° 89-2', effet: '2020-11-03',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 89-1 du 29 septembre 2015 et entrent en vigueur le 3 novembre 2020.' },
  { cible: 'Circulaire n° 82-2', par: 'Circulaire n° 82-3', effet: '2020-11-03',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire N° 82-2 du 12 décembre 1997 et entrent en vigueur le 3 novembre 2020.' },
  { cible: 'Circulaire n° 88', par: 'Circulaire n° 88-1', effet: '2021-04-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 88 du 10 décembre 1998 et entrent en vigueur à compter du 1er avril 2021.' },
  { cible: 'Circulaire n° 92', par: 'Circulaire n° 92-1', effet: '2022-02-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire No 92 du 9 avril 1998 et entrent en vigueur le 1er février 2022.' },
  { cible: 'Circulaire n° 99-3', par: 'Circulaire n° 99-4', effet: '2023-07-27',
    clause: 'La présente circulaire abroge la circulaire 99-3 du 27 août 2020 et la note additionnelle du 14 novembre 2022.' },
  { cible: 'Circulaire n° 83-4', par: 'Circulaire n° 83-5', effet: '2024-04-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire No 83-4 du 18 septembre 2000 et entrent en vigueur le 1er avril 2024.' },
  { cible: 'Circulaire n° 115-5', par: 'Circulaire n° 115-6', effet: '2024-10-01',
    clause: 'La présente circulaire remplace la circulaire 115-5 du 28 mars 2024 et entre en vigueur le 1er octobre 2024.' },
  { cible: 'Lettre-Circulaire n° 09-1', par: 'Circulaire n° 130', effet: '2025-04-02',
    clause: 'Cette circulaire abroge la lettre-circulaire 09-1 du 7 juin 2016 et entre en vigueur le 2 avril 2025.' },
  { cible: 'Circulaire n° 95-4', par: 'Circulaire n° 95-5', effet: '2025-04-16',
    clause: 'La présente circulaire abroge la circulaire No 95-4 et entre en vigueur à la date de signature.' },
  { cible: 'Circulaire n° 105', par: 'Circulaire n° 105-1', effet: '2017-05-02',
    clause: 'La présente circulaire abroge la circulaire 105 en date du 28 novembre 2013 et entre en vigueur le 2 mai 2017.' },
  { cible: 'Circulaire n° 105-1', par: 'Circulaire n° 105-2', effet: '2025-10-15',
    clause: 'La présente circulaire abroge la circulaire 105-1 en date du 3 avril 2017 et entre en vigueur le 15 octobre 2025.' },
  { cible: 'Circulaire n° 117', par: 'Circulaire n° 117-1', effet: '2026-01-05',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la circulaire 117 et entrent en vigueur le 5 janvier 2026.' },
  { cible: 'Circulaire n° 129', par: 'Circulaire n° 129-1', effet: '2026-03-02',
    clause: 'La présente circulaire abroge la circulaire 129 du 31 mars 2025 et entre en vigueur le 2 mars 2026.' },
  { cible: 'Circulaire n° 109-1', par: 'Circulaire n° 131', effet: '2026-03-02',
    clause: 'La présente circulaire abroge la circulaire 109-1 du 10 mai 2019 et entre en vigueur le 2 mars 2026.' },
  // ── EN ATTENTE D'EFFET ──────────────────────────────────────────────────────
  { cible: 'Circulaire n° 87', par: 'Circulaire n° 87-1', effet: '2026-10-01',
    clause: 'Les dispositions de la présente circulaire remplacent celles de la Circulaire No 87 du 29 septembre 1997 et entrent en vigueur le 1er octobre 2026.' },
]

/**
 * ÉCARTÉES à la lecture — la clause ne fait pas tomber le texte visé. Conservées ici pour
 * que le prochain relevé automatique ne les repropose pas comme des oublis.
 */
export const ECARTEES = [
  { cible: 'Circulaire n° 81-4', par: 'Lettre-Circulaire n° 01', motif: 'remplacement d’un PLAFOND (« 1 % remplace, jusqu’à nouvel ordre, la limite maximale de 8 % »), à titre temporaire' },
  { cible: 'Circulaire n° 93', par: 'Circulaire du 8 septembre 2008', motif: 'remplacement d’UNE disposition (provisions pour créances douteuses), non du texte' },
  { cible: 'Circulaire n° 87', par: 'Lettre-Circulaire n° 04', motif: 'abrogation PARTIELLE : « le point 3 … pour ce qui concerne uniquement la provision générale »' },
  { cible: 'Circulaire n° 87', par: 'Circulaire n° 130', motif: 'simple renvoi (« selon les dispositions ou prescrits de la circulaire 87 »)' },
  { cible: 'Circulaire n° 95', par: 'Circulaire n° 95-1A / 95-1B', motif: 'variantes du même acte que la 95-1, même date : la relation est portée une seule fois' },
]

const TODAY = new Date()

async function main() {
  const applique: Relation[] = []
  const differe: Relation[] = []

  for (const r of ABROGATIONS) {
    if (!parseCirculaireRef(r.cible) || !parseCirculaireRef(r.par))
      throw new Error(`numéro non canonique : ${r.cible} / ${r.par} — annulé`)
    const par = await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number: r.par }, select: { id: true } })
    if (!par) throw new Error(`circulaire abrogeante absente : ${r.par} — annulé`)
    const cibles = await prisma.document.findMany({ where: { type: 'CIRCULAIRE_BRH', number: r.cible }, select: { id: true, titleFr: true } })
    if (!cibles.length) throw new Error(`cible absente : ${r.cible} — annulé`)
    if (new Date(`${r.effet}T00:00:00Z`) > TODAY) { differe.push(r); continue }
    for (const c of cibles) {
      await prisma.document.update({ where: { id: c.id }, data: { status: 'ABROGE', abrogatedByNumber: r.par } })
      await reindexDocument(c.id)
    }
    applique.push(r)
  }

  // Durabilité : import-brh purge puis rejoue ce fichier.
  const PATH = 'scripts/brh-enrichments.json'
  const file = JSON.parse(readFileSync(PATH, 'utf8')) as { status?: { number: string; status: string; abrogatedByNumber?: string | null }[] }
  file.status ??= []
  for (const r of applique) {
    const e = { number: r.cible, status: 'ABROGE', abrogatedByNumber: r.par }
    const i = file.status.findIndex((s) => s.number === r.cible)
    if (i >= 0) file.status[i] = e
    else file.status.push(e)
  }
  writeFileSync(PATH, JSON.stringify(file, null, 1))

  console.log(`✓ ${applique.length} abrogations portées · ${differe.length} différée(s) · ${file.status.length} statuts en durabilité\n`)
  for (const r of applique) console.log(`   ${r.cible.padEnd(26)} ABROGE ← ${r.par.padEnd(21)} (effet ${r.effet})`)
  for (const r of differe) console.log(`   ${r.cible.padEnd(26)} EN VIGUEUR — ${r.par} ne prend effet que le ${r.effet}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
