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

import { ABROGATIONS, type AbrogationRelation as Relation } from '../src/lib/brh/abrogations'

// La table vit dans src/lib/brh/abrogations.ts : la passe quotidienne doit pouvoir
// l'appliquer (une relation peut prendre effet APRÈS son écriture). Ce script n'en garde
// que ce qui relève de l'exploitation : les écartements et les retraits.

/**
 * ÉCARTÉES à la lecture — la clause ne fait pas tomber le texte visé. Conservées ici pour
 * que le prochain relevé automatique ne les repropose pas comme des oublis.
 */
export const ECARTEES = [
  { cible: 'Circulaire n° 81-4', par: 'Lettre-Circulaire n° 01', motif: 'remplacement d’un PLAFOND (« 1 % remplace, jusqu’à nouvel ordre, la limite maximale de 8 % »), à titre temporaire' },
  { cible: 'Circulaire n° 93', par: 'Circulaire du 8 septembre 2008', motif: 'remplacement d’UNE disposition (provisions pour créances douteuses), non du texte' },
  { cible: 'Circulaire n° 87', par: 'Lettre-Circulaire n° 04', motif: 'abrogation PARTIELLE : « le point 3 … pour ce qui concerne uniquement la provision générale »' },
  { cible: 'Circulaire n° 87', par: 'Circulaire n° 130', motif: 'simple renvoi (« selon les dispositions ou prescrits de la circulaire 87 »)' },
  { cible: 'Circulaire n° 95 (du 1er août 2000)', par: 'Circulaires n° 95-1, 95-1A et 95-1B', motif: 'cible ABSENTE du corpus. Les trois circulaires du 30 octobre 2008 (destinataires distincts : banques ; maisons de transfert ; agents de change) remplacent « la circulaire No 95 du 1er août 2000 », relative au blanchiment. Ce texte n’est pas à la plateforme — la fiche « Circulaire n° 95 » qui s’y trouve est la circulaire de RÉSERVES OBLIGATOIRES du 6 juillet 2015, un autre acte. Ne rien porter tant que la circulaire de 2000 n’est pas téléversée.' },
  { cible: 'Norme CEC n° 7 / n° 9', par: 'Normes CEC n° 7-1 et 9-1', motif: 'cible absente du corpus (la plateforme n’a que les versions révisées)' },
  { cible: 'Circulaire CEC n° 2 / n° 3 (24 octobre 2003)', par: 'Circulaires CEC n° 01 et 03', motif: 'à trancher : la numérotation des normes CEC ne suit pas celle des circulaires BRH ; aucune cible sûre en base' },
]

/**
 * Relations RETIRÉES après vérification — le script remet la cible EN VIGUEUR et purge le
 * statut du fichier de durabilité. Conservées ici avec leur motif pour qu'un prochain relevé
 * ne les repropose pas.
 */
export const RETIREES: { cible: string; par: string; motif: string }[] = [
  {
    cible: 'Circulaire n° 95',
    par: 'Circulaire n° 95-1',
    motif:
      'Cible résolue par le seul NUMÉRO. La clause de la 95-1 vise « la circulaire No 95 du 1er août 2000 » (blanchiment) ; la fiche « Circulaire n° 95 » de la base est la circulaire de réserves obligatoires du 6 juillet 2015, que le Moniteur Spécial n° 18 de 2017 liste EN VIGUEUR. Un texte de 2008 ne peut pas abroger un texte de 2015.',
  },
]

const TODAY = new Date()

async function main() {
  const applique: Relation[] = []
  const differe: Relation[] = []

  // ── Retraits : relations écartées après vérification, à défaire en base ──────
  for (const r of RETIREES) {
    const cibles = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', number: r.cible, abrogatedByNumber: r.par },
      select: { id: true, titleFr: true },
    })
    for (const c of cibles) {
      await prisma.document.update({ where: { id: c.id }, data: { status: 'EN_VIGUEUR', abrogatedByNumber: null } })
      await reindexDocument(c.id)
      console.log(`   RETRAIT ${r.cible} : remis EN VIGUEUR (${c.titleFr.slice(0, 56)})`)
    }
  }

  for (const r of ABROGATIONS) {
    if (!parseCirculaireRef(r.cible) || !parseCirculaireRef(r.par))
      throw new Error(`numéro non canonique : ${r.cible} / ${r.par} — annulé`)
    const par = await prisma.document.findFirst({
      where: { type: 'CIRCULAIRE_BRH', number: r.par },
      select: { id: true, publicationDate: true },
    })
    if (!par) throw new Error(`circulaire abrogeante absente : ${r.par} — annulé`)
    const cibles = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH', number: r.cible },
      select: { id: true, titleFr: true, publicationDate: true },
    })
    if (!cibles.length) throw new Error(`cible absente : ${r.cible} — annulé`)
    // GARDE CHRONOLOGIQUE : un texte ne peut pas en abroger un PLUS RÉCENT que lui. Ce seul
    // contrôle aurait arrêté l'abrogation de la « Circulaire n° 95 » — la fiche de ce numéro
    // est la circulaire de réserves obligatoires de 2015, alors que la clause de la 95-1
    // (2008) vise la circulaire du 1er août 2000, absente du corpus. Résoudre une cible par
    // son seul NUMÉRO est précisément ce que la règle du projet interdit.
    for (const c of cibles) {
      if (c.publicationDate && par.publicationDate && c.publicationDate > par.publicationDate)
        throw new Error(
          `${r.cible} (${c.publicationDate.toISOString().slice(0, 10)}) est POSTÉRIEURE à ${r.par} ` +
            `(${par.publicationDate.toISOString().slice(0, 10)}) — cible probablement homonyme — annulé`,
        )
    }
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
  for (const r of RETIREES) {
    const i = file.status.findIndex((s) => s.number === r.cible && s.abrogatedByNumber === r.par)
    if (i >= 0) file.status.splice(i, 1) // sinon le ré-import rétablirait le statut retiré
  }
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

// Le module exporte ses tables (ABROGATIONS, ECARTEES, RETIREES) : sans cette garde, une
// simple importation depuis un script d'analyse ÉCRIRAIT en base de production.
if (process.argv[1] && /_apply-abrogations-brh\.ts$/.test(process.argv[1])) {
  main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
}
