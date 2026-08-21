/**
 * § 4.7 — LE RÉGIME SE PORTE, IL NE SE SUPPOSE PAS. **AUCUN `Date` DANS CE FICHIER.**
 *
 * Délai FRANC : ni le jour du départ ni le jour de l'échéance ne comptent → dernier jour
 * utile = départ + N + 1. Délai ORDINAIRE : le jour du départ ne compte pas, **mais le jour
 * de l'échéance compte** → dernier jour utile = départ + N. **Un jour d'écart, et le recours
 * est forclos.**
 *
 * ⚠️ CORRECTIF (défaut 1 du cahier de recette). Le garde-fou du § 4.7 « exige la phrase de
 * l'article » mais ne contrôlait que **le mot « franc »** — que les six fondements du
 * catalogue portent tous, sous la formule méta « l'article lui-même qualifie le délai de
 * franc ». Un garde-fou que la donnée franchit d'avance ne garde rien. `citationDeFranc`
 * exige désormais une **citation réelle** : un segment entre guillemets, d'au moins
 * 25 caractères, qui porte le mot « franc » / « franche » et qui n'est pas une formule sur
 * l'article plutôt qu'une phrase de l'article.
 */

export type CodeDelai = 'CPC' | 'TRAVAIL' | 'CIVIL'
export type Regime = 'FRANC' | 'ORDINAIRE' | 'A_VERIFIER'
export type Prorogation991 = 'OUI' | 'NON' | 'INCERTAIN'

/**
 * `regime: "À VÉRIFIER"` est une TROISIÈME valeur, et elle existe dans la donnée : le
 * catalogue la porte 4 fois. **Interdit absolu : la convertir en silence en FRANC ou en
 * ORDINAIRE.** Ce serait trancher, à la place de la rédaction, la question même qu'elle a
 * expressément refusé de trancher.
 */
export function normaliserRegime(valeur: string): Regime {
  const v = (valeur ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
  if (v === 'FRANC') return 'FRANC'
  if (v === 'ORDINAIRE') return 'ORDINAIRE'
  if (v === 'A VERIFIER' || v === 'A_VERIFIER' || v === 'A-VERIFIER') return 'A_VERIFIER'
  throw new Error(`Régime inconnu, et il ne se devine pas : « ${valeur} »`)
}

/**
 * § 5.1 — TRANCHÉ (défaut 16 c). `codeLibelle` porte le LIBELLÉ LONG, en base comme dans les
 * fixtures : c'est un libellé, il titre l'entrée à l'écran. L'abréviation ne se stocke pas —
 * elle se dérive. La graine écrivait `l.abbr` (« C. pr. civ. ») alors que le commentaire du
 * modèle documentait « Code de procédure civile » et que les fixtures du back-office
 * portaient le libellé long : deux vérités pour une seule donnée.
 */
export const LIBELLE_CODE: Record<CodeDelai, string> = {
  CPC: 'Code de procédure civile',
  TRAVAIL: 'Code du travail',
  CIVIL: 'Code civil',
}

/** L'abréviation, telle que les références la citent. DÉRIVÉE, jamais stockée. */
export const ABREGE_CODE: Record<CodeDelai, string> = {
  CPC: 'C. pr. civ.',
  TRAVAIL: 'C. trav.',
  CIVIL: 'C. civ.',
}

export const LIBELLE_REGIME: Record<Regime, string> = {
  FRANC: 'Délai franc',
  ORDINAIRE: 'Délai ordinaire',
  A_VERIFIER: 'Régime à vérifier — la rédaction n’a pas qualifié ce délai',
}

/** Fondements par défaut, affichés à la sélection ET dans le résultat (§ 4.7). */
export const FONDEMENT_REGIME_PAR_CODE: Record<CodeDelai, string> = {
  CPC: 'C. pr. civ., art. 987 — « Tous les délais prévus au Code de procédure civile sont francs. »',
  TRAVAIL:
    'C. trav., art. 511 — « Tous les délais de procédure prévus au Code du Travail sont francs. »',
  CIVIL:
    'Aucune règle générale de computation au Code civil. Régime de droit commun : le jour de l’échéance compte.',
}

/**
 * L'ARTICLE qui proroge, tel qu'il se cite — la référence courte, distincte du fondement
 * long ci-dessous.
 *
 * ⚠️ **UNE SEULE VÉRITÉ.** `calcul.ts` la portait en dur dans `sourceProrogation()` ; la ligne
 * du report public (`mention-jour.ts`) en a besoin elle aussi, et deux exemplaires de la même
 * citation, c'est le défaut 16 c. Elle est donc déclarée ici, avec les autres tables de
 * régime, et les deux la lisent.
 *
 * ⚠️ `CIVIL` cite l'art. 991 : c'est le régime de l'entrée synthétique publique, dont le code
 * est `CIVIL` faute de rattachement, et dont la prorogation est celle du droit commun de la
 * procédure. Le Code civil n'a pas de clause de prorogation à lui — quand il ne proroge pas,
 * cette référence n'est simplement jamais écrite.
 */
export const ARTICLE_PROROGATION_PAR_CODE: Record<CodeDelai, string> = {
  CPC: 'C. pr. civ., art. 991 al. 3',
  TRAVAIL: 'C. trav., art. 511 al. 2',
  CIVIL: 'C. pr. civ., art. 991 al. 3',
}

/** Fondements par défaut de la prorogation (§ 4.7, dernier alinéa). */
export const FONDEMENT_PROROGATION_PAR_CODE: Record<CodeDelai, string> = {
  CPC: 'C. pr. civ., art. 991 al. 3 — « Les délais légaux seront prorogés d’un jour, si le dernier est un dimanche ou un jour de fête légale. »',
  TRAVAIL:
    'C. trav., art. 511 al. 2 — « Les délais légaux sont prorogés d’un jour si le dernier jour est un dimanche ou un jour férié légal ou prescrit par Arrêté Présidentiel. »',
  CIVIL:
    'INCERTAIN : le Code civil ne comporte aucune clause de prorogation, et l’art. 991 est dans le Code de procédure civile. La tête d’affiche est calculée SANS prorogation.',
}

/** Marqueurs d'une formule QUI PARLE DE l'article, au lieu de le citer. */
const FORMULES_META =
  /l['’]article lui[- ]m[êe]me|qualifie le d[ée]lai|le r[ée]pertoire|par renvoi|selon le catalogue/i

/** Le mot, dans toutes ses formes utiles. */
const MOT_FRANC = /\bfranc(?:s|he|hes)?\b/i

/** Longueur minimale d'une citation pour qu'elle soit une PHRASE et non une étiquette. */
const LONGUEUR_MINIMALE_CITATION = 25

/**
 * Extrait, d'un `regimeFondement`, la CITATION qui rend le délai franc — ou dit pourquoi il
 * n'y en a pas. Sont acceptés les guillemets français « … », les guillemets courbes “ … ” et
 * les guillemets droits " … ".
 */
export function citationDeFranc(fondement: string): { citation: string | null; motif: string } {
  const f = fondement ?? ''
  if (!f.trim()) return { citation: null, motif: 'Fondement vide.' }

  const segments: string[] = []
  for (const m of f.matchAll(/[«“"]([^»”"]+)[»”"]/g)) segments.push(m[1].trim())

  if (segments.length === 0) {
    return {
      citation: null,
      motif:
        'Aucun segment entre guillemets : le fondement affirme le régime sans citer la phrase ' +
        'de l’article.',
    }
  }
  for (const s of segments) {
    if (!MOT_FRANC.test(s)) continue
    if (FORMULES_META.test(s)) continue
    if (s.length < LONGUEUR_MINIMALE_CITATION) continue
    return { citation: s, motif: 'Citation trouvée.' }
  }
  return {
    citation: null,
    motif:
      'Les segments cités ne portent pas le mot « franc » dans une phrase d’article : ' +
      'une formule sur l’article n’est pas une phrase de l’article.',
  }
}

/**
 * Garde-fou de graine, BLOQUANT (§ 4.7, garde-fou 1), corrigé.
 * Une entrée `CIVIL` en régime `FRANC` doit **soit** porter la phrase de l'article, **soit**
 * être marquée `regimeIncertain: true` — auquel cas le moteur n'affirme pas qu'elle est
 * franche : la tête d'affiche est calculée en ORDINAIRE et le régime franc devient une
 * lecture nommée.
 */
export function controleCivilFranc(entree: {
  code: CodeDelai
  regime: Regime
  regimeIncertain: boolean
  regimeFondement: string
}): { ok: boolean; motif: string } {
  if (entree.code !== 'CIVIL' || entree.regime !== 'FRANC') return { ok: true, motif: '' }
  const { citation, motif } = citationDeFranc(entree.regimeFondement)
  if (citation) return { ok: true, motif: `Citation : « ${citation} »` }
  if (entree.regimeIncertain) {
    return {
      ok: true,
      motif:
        'Pas de citation, mais `regimeIncertain: true` : la tête d’affiche est calculée en ' +
        'ORDINAIRE et le régime franc devient une lecture nommée. ' +
        motif,
    }
  }
  return {
    ok: false,
    motif:
      'CIVIL + FRANC sans citation réelle et sans `regimeIncertain` : ' +
      motif +
      ' Produis la phrase de l’article, ou marque l’entrée `regimeIncertain: true`.',
  }
}

/**
 * Le délai est-il FRANC dans la tête d'affiche ? La tête d'affiche est toujours la plus
 * PRÉCOCE : un régime douteux y est donc traité comme ORDINAIRE, et le régime franc devient
 * une lecture nommée (§ 4.7, garde-fou 2).
 */
export function francEnTeteDaffiche(entree: { regime: Regime; regimeIncertain: boolean }): boolean {
  if (entree.regimeIncertain) return false
  return entree.regime === 'FRANC'
}
