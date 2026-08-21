/**
 * § 4.5 bis — LE CONTRÔLE DES 8 ENTRÉES DU CODE DU TRAVAIL À NUMÉRO HOMONYME, CONTRE LA BASE.
 * **LECTURE SEULE.** Aucun écrit en base, aucune correction automatique.
 *
 *   npx tsx scripts/verify-delais-travail.ts
 *
 * ⚠️ CORRECTIF (défaut 4 du cahier de recette). Le test de `repertoire.test.ts` qui portait ce
 * nom était TAUTOLOGIQUE : il constatait que `construireEntrees` recopie la constante
 * `DESAMBIGUISATION_TRAVAIL`, sans jamais ouvrir le Code du travail. La `phraseDeControle` —
 * le seul verrou contre « afficher une durée sous le texte d'un autre article », sur 207
 * numéros en double — n'était comparée à rien.
 *
 * Ce fichier ne fait que DEUX choses : lire le corps en base, et appeler le contrôle pur de
 * `src/lib/delais/homonymes.ts` (qui, lui, a son test unitaire, avec un corps trafiqué où la
 * phrase est à la mauvaise occurrence). La graine appelle la même fonction.
 */
import { prisma } from '../src/lib/db'
import { controlerHomonymes, imprimerHomonymes } from '../src/lib/delais/homonymes'
import type { ResultatHomonymes } from '../src/lib/delais/homonymes'
import { DESAMBIGUISATION_TRAVAIL, REPERTOIRE, construireEntrees } from '../src/lib/delais/repertoire'
import { DOC_CTRAV } from '../src/lib/delais/textes'

export { imprimerHomonymes }
export type { ResultatHomonymes }

/** Lit le Code du travail EN BASE et applique le contrôle. **Ne ferme pas la connexion.** */
export async function verifierTravail(): Promise<ResultatHomonymes> {
  const doc = await prisma.document.findUnique({
    where: { id: DOC_CTRAV },
    select: { bodyOriginal: true },
  })
  const corps = doc?.bodyOriginal ?? ''
  if (!corps.trim()) {
    return {
      constats: [],
      anomalies: [`§ 4.5 bis — le Code du travail (${DOC_CTRAV}) est introuvable ou vide en base`],
    }
  }
  return controlerHomonymes(corps, construireEntrees(REPERTOIRE), DESAMBIGUISATION_TRAVAIL)
}

async function main() {
  console.log('\n● LECTURE SEULE — aucun écrit en base, aucune correction automatique.\n')
  const r = await verifierTravail()
  imprimerHomonymes(r, (s) => console.log(`  ${s}`))
  console.log('')
  if (r.anomalies.length > 0) process.exitCode = 1
}

if (process.argv[1]?.endsWith('verify-delais-travail.ts')) {
  main().finally(() => prisma.$disconnect())
}
