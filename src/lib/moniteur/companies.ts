import { fold } from '../search/normalize'

/**
 * Extraction des noms de sociétés depuis le texte d'une entrée Index du Moniteur
 * (avis de fonctionnement / actes constitutifs / modifications de statuts).
 *
 * Trois familles de formats rencontrés dans le corpus :
 *  1) Nom entre GUILLEMETS : … dénommée « X S.A. » et « Y S.A. ».
 *  2) Nom SANS guillemets après « dénommé(e)(s) [:] » : … dénommée : X S.A.
 *  3) Nom EN TÊTE finissant par S.A./SARL avant « - » : « X S.A. - Avis approuvant … ».
 *
 * L'ancienne version ne gérait que (1), d'où des sociétés absentes de la recherche.
 * Source unique partagée par scripts/import-moniteur.ts et scripts/backfill-companies.ts.
 */

const QUOTE_RE = /[«"“]([^«»"“”]{3,100})[»"”]/g
// « dénommée(s) [:] NOM » — capture jusqu'à un délimiteur STRUCTUREL (jamais « et »,
// qui appartient souvent au nom : « Construction et Bâtiment »). Délimiteurs étendus
// (confer/voir/Moniteur/No./année) pour éviter d'avaler les renvois de référence.
const DENOM_RE = /d[eé]nomm[a-zà-ÿ]*\s*:?\s*([^"«»;]{3,100}?)(?:\s+-\s+|\s*;|\s+actes?\b|\s+statuts?\b|\s*\(|\s+confer\b|\s+voir\b|\s+moniteur\b|\s+no\.?\s*\d|\s+\d{4}\b|$)/gi
// Nom EN TÊTE finissant par S.A. / S.A.R.L. avant « - ».
const PREFIX_RE = /^([A-Za-z0-9À-ÿ][^"«»;]{2,98}?\bS\.?\s?A\.?(?:\s?R\.?\s?L\.?)?)\s+-\s+/
// Mots qui trahissent une PHRASE descriptive (pas un nom de société) — gate du PREFIX.
const DESCRIPTIVE = /\b(avis|d[ée]cret|arr[êe]t[ée]|d[ée]nomm|fonctionnement|approuvant|modification|acte|suite|erratum|portant|sanctionnant|autorisant)\b/i

// Rejette le bruit (fragments génériques, libellés de rubrique, listes de personnes).
// NB : normalisation IDENTIQUE au parseur d'origine — seulement les espaces, JAMAIS la
// ponctuation finale : les sociétés existantes gardent leur point (« … S.A. »), donc
// retirer le point créerait de faux doublons (clé companyKey divergente).
function sanitize(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').trim()
  if (name.length < 3 || name.length > 100) return null
  if ((name.match(/[a-zà-ÿ]/gi) || []).length < 3) return null // ≥3 lettres (rejette « es: », « S.A »)
  if (/\bMM?\.\s/.test(name)) return null // « MM. Untel et Untel » = personnes, pas une société
  const f = fold(name)
  const NOISE = new Set([
    'statuts', 'societe anonyme', 'societes anonymes', 'acte constitutif', 'acte de constitution',
    'la societe anonyme', 'les societes anonymes', 'ladite societe', 'societe', 'societes',
  ])
  if (NOISE.has(f)) return null
  if (f.includes('registre des marques') || f.includes('le moniteur')) return null
  return name
}

export function extractCompanies(text: string): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  QUOTE_RE.lastIndex = 0
  while ((m = QUOTE_RE.exec(text))) { const n = sanitize(m[1]); if (n) out.add(n) }
  DENOM_RE.lastIndex = 0
  while ((m = DENOM_RE.exec(text))) { const n = sanitize(m[1]); if (n) out.add(n) }
  // PREFIX : seulement si le début n'est PAS une phrase descriptive (sinon on capture
  // tout l'avis « Avis de fonctionnement … dénommée : X S.A. » au lieu du seul nom).
  const pm = text.match(PREFIX_RE)
  if (pm && !DESCRIPTIVE.test(pm[1])) { const n = sanitize(pm[1]); if (n) out.add(n) }
  return [...out].slice(0, 10)
}

/** Clé de déduplication d'une société (nom replié, espaces normalisés). */
export function companyKey(name: string): string {
  return fold(name).replace(/\s+/g, ' ').trim()
}

function hashId(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

/** Identifiant déterministe d'une société de l'Index (« idx-c-… »). */
export function companyId(name: string): string {
  return `idx-c-${hashId(companyKey(name))}`
}
