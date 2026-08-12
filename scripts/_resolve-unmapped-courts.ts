/**
 * Résolution de 8 des 10 sièges de tribunaux de paix restés UNMAPPED.
 *
 * Ces sièges figurent au fichier CSPJ 2024-2025 mais leur commune de rattachement n'était
 * pas confirmée : ils existaient en base sans être rattachés, donc sans être publiés.
 *
 * LA PREUVE EST DANS LE FICHIER D'AMORÇAGE LUI-MÊME. Le code postal haïtien s'écrit
 * HT + département + arrondissement + commune + SECTION, le dernier chiffre valant 0 pour
 * la commune entière. Le fichier ne connaît que les codes communaux (…0) ; chacun des huit
 * sièges porte, au répertoire postal, un code identique au chiffre de section près :
 *
 *   Damassin      HT8411 → HT8410  Les Côteaux                    (Sud)
 *   Cahouane      HT8531 → HT8530  Tiburon                        (Sud)
 *   Randel        HT8511 → HT8510  Chardonnières                  (Sud)
 *   Grosse-Roche  HT2411 → HT2410  Vallières                      (Nord-Est)
 *   Bois-Laurence HT2431 → HT2430  Mombin-Crochu                  (Nord-Est)
 *   Acul Samedi   HT2112 → HT2110  Fort-Liberté                   (Nord-Est)
 *   Banane        HT9341 → HT9340  Anse-à-Pitres                  (Sud-Est)
 *   Savane-à-Roche HT4421 → HT4420 Petite-Rivière-de-l'Artibonite (Artibonite)
 *
 * Le rattachement se DÉDUIT du préfixe, il n'est pas supposé — et chacun tombe dans le
 * ressort CSPJ déjà inscrit au siège.
 *
 * ⚠️ UNE HYPOTHÈSE COURANTE EST FAUSSE : « Grosse Roche » est parfois rapprochée de
 * Gros-Morne ou de l'Acul-du-Nord (toponymes homonymes). Impossible : ces communes portent
 * HT4210 (Artibonite) et HT1210 (Nord), quand la section est HT2411. Les deux pistes
 * auraient expatrié un tribunal du Nord-Est.
 *
 * ⚠️ STATUT « CORROBORATED », JAMAIS « CONFIRMED_OFFICIAL ». Une déduction postale, si
 * serrée soit-elle, n'est ni le CSPJ ni Le Moniteur. Le référentiel ne vaut que parce que
 * rien n'y est sur-affirmé : la nuance de statut EST la garantie.
 *
 * DEUX SIÈGES DEMEURENT NON RÉSOLUS : CORRIDON (Gonaïves) et HATTE CHEVREAU (Saint-Marc),
 * absents du répertoire postal. Ils restent UNMAPPED, donc hors publication.
 *
 *   npx tsx scripts/_resolve-unmapped-courts.ts
 * puis  npx tsx scripts/import-judicial-map.ts --dry-run
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SEED = 'data/judicial-map/seed-v1.json'
/** Répertoire postal — source DÉJÀ citée par le fichier pour les codes des 149 communes. */
const SOURCE = { type: 'file' as const, value: 'Codes Postaux.docx' }

/** id du siège → clé « Département|Commune » du référentiel + code postal de la section. */
const RESOLUS: Record<string, { cle: string; cp: string; section: string }> = {
  'court-paix-sud--damassin-42':                { cle: 'Sud|Les Côteaux',                       cp: 'HT8411', section: 'Damassin' },
  'court-paix-sud--cahouane-46':                { cle: 'Sud|Tiburon',                           cp: 'HT8531', section: 'Cahouane' },
  'court-paix-sud--rendel-47':                  { cle: 'Sud|Chardonnières',                     cp: 'HT8511', section: 'Randel' },
  'court-paix-nord-est--grosse-roche-58':       { cle: 'Nord-Est|Vallières',                    cp: 'HT2411', section: 'Grosse-Roche' },
  'court-paix-nord-est--bois-de-laurence-63':   { cle: 'Nord-Est|Mombin-Crochu',                cp: 'HT2431', section: 'Bois-Laurence' },
  'court-paix-nord-est--acul-samedi-64':        { cle: 'Nord-Est|Fort-Liberté',                 cp: 'HT2112', section: 'Acul Samedi' },
  'court-paix-sud-est--banane-102':             { cle: 'Sud-Est|Anse-à-Pitres',                 cp: 'HT9341', section: 'Banane' },
  'court-paix-artibonite--savanne-a-roche-179': { cle: 'Artibonite|Petite-Rivière-de-l’Artibonite', cp: 'HT4421', section: 'Savane à Roches' },
}

interface Court {
  id: string; seatName: string; department: string; cspjJurisdiction: string | null
  associatedCommuneOrCity: string | null; seatType: string | null; observation: string | null
  sources: { type: string; value: string }[]
  locationPrecision: string; verificationStatus: string
}
interface Commune { key: string; department: string; commune: string; postalCodePrimary: string }

/** « de » + nom de commune : « des Côteaux », « d'Anse-à-Pitres », « de Tiburon ». */
function de(commune: string): string {
  const art = commune.match(/^Les?\s+(.+)$/)
  if (art) return `${commune.startsWith('Les ') ? 'des' : 'du'} ${art[1]}`
  return /^[aeiouâàéèêîôùû]/i.test(commune) ? `d’${commune}` : `de ${commune}`
}

function main() {
  const seed = JSON.parse(readFileSync(SEED, 'utf8')) as {
    courts: { peace: Court[] }
    communes: Commune[]
    dataQuality: { peaceCourtsWithoutConfirmedCommune: number }
  }
  const parCle = new Map(seed.communes.map((c) => [c.key, c]))

  let n = 0
  for (const c of seed.courts.peace) {
    const r = RESOLUS[c.id]
    if (!r) continue
    // Rejouable : soit le siège est encore UNMAPPED, soit c'est ce script qui l'a résolu.
    const dejaResolu = c.verificationStatus === 'CORROBORATED' && c.sources.some((s) => s.value === SOURCE.value)
    if (c.verificationStatus !== 'UNMAPPED' && !dejaResolu)
      throw new Error(`${c.id} a été modifié ailleurs (${c.verificationStatus}) — annulé`)

    const com = parCle.get(r.cle)
    if (!com) throw new Error(`commune « ${r.cle} » absente du référentiel — annulé`)
    // La validation du fichier résout le siège par (département, commune) : les deux doivent
    // concorder, faute de quoi l'import refuserait — ou pire, apparierait une homonyme.
    if (com.department !== c.department)
      throw new Error(`${c.id} : département ${c.department} ≠ ${com.department} de ${r.cle} — annulé`)
    // Le lien tient tout entier dans le préfixe : on le vérifie, on ne le suppose pas.
    if (r.cp.slice(0, 5) !== com.postalCodePrimary.slice(0, 5) || !com.postalCodePrimary.endsWith('0'))
      throw new Error(`${c.id} : ${r.cp} ne dérive pas de ${com.postalCodePrimary} — annulé`)

    c.associatedCommuneOrCity = com.commune
    c.seatType = 'Section communale'
    c.observation = `Section « ${r.section} » ${de(com.commune)} : le code postal ${r.cp} dérive `
      + `du code communal ${com.postalCodePrimary} (le dernier chiffre désigne la section). `
      + `Le siège n’a pas d’adresse vérifiée : la position affichée est celle du centroïde communal.`
    c.locationPrecision = 'COMMUNE_CENTROID'
    c.verificationStatus = 'CORROBORATED'
    if (!c.sources.some((s) => s.value === SOURCE.value)) c.sources.push({ ...SOURCE })
    n++
    console.log(`  ✓ ${c.seatName.padEnd(17)} ${r.cp} → ${com.postalCodePrimary}  ${com.commune} (${com.department})`)
  }
  const attendu = Object.keys(RESOLUS).length
  if (n !== attendu) throw new Error(`${n}/${attendu} sièges appariés — annulé`)

  const restants = seed.courts.peace.filter((c) => c.verificationStatus === 'UNMAPPED')
  // Le compte déclaré est contrôlé par validateSeed : le laisser à 10 ferait mentir le fichier.
  seed.dataQuality.peaceCourtsWithoutConfirmedCommune = restants.length

  writeFileSync(SEED, JSON.stringify(seed, null, 1) + '\n')
  console.log(`\n${n} sièges résolus (CORROBORATED) · ${restants.length} demeurent UNMAPPED, donc non publiés :`)
  for (const c of restants) console.log(`  ⚠ ${c.seatName} — ${c.department}, ${c.cspjJurisdiction}`)
  console.log(`\n→ ${SEED} · rejouer : npx tsx scripts/import-judicial-map.ts --dry-run`)
}

main()
