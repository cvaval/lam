/**
 * Construction de la requête plein-texte PostgreSQL (`tsquery`).
 *
 * ⚠️ Configuration **`simple`** (aucune racinisation), et NON `french`.
 * Le racinisateur français de PostgreSQL sur-racinise dangereusement pour un corpus
 * juridique : `loyer` → `loi`. Mesuré sur le corpus Lam, une recherche « loyer » avec
 * la configuration `french` rapportait 1 575 documents dont 1 548 (98 %) ne contenaient
 * pas le mot — toutes les LOIS du fonds. Autres collisions du même ordre. Un fonds
 * juridique exige la précision : on n'écrase donc aucune forme.
 *
 * La morphologie est rendue autrement, par PRÉFIXE (`mot:*`) :
 *   « constitu » trouve « constitution », « societe » trouve « societes ».
 * C'est le comportement qu'attendait déjà l'utilisateur du moteur historique (qui
 * cherchait en sous-chaîne), mais SANS ses faux positifs en milieu de mot : la
 * sous-chaîne « loyer » remontait « em-ployer ».
 *
 * Sécurité : après `fold()` on ne conserve que [a-z0-9] ; le seul autre caractère
 * injecté est le suffixe `:*` que nous ajoutons nous-mêmes — aucune syntaxe tsquery
 * ne peut venir de la saisie.
 */
import { fold } from './normalize'
import { SYNONYMS } from './synonyms'
import { STOPWORDS } from './stopwords'

/**
 * En deçà de cette longueur, correspondance EXACTE plutôt que par préfixe : un préfixe
 * de 3 lettres (« loi:* » → loisir, loin…) ratisse beaucoup trop large.
 */
const PREFIX_MIN = 4

/** Ne garde que ce qui est indexable comme lexème (le fold a déjà retiré les accents). */
function lexeme(w: string): string {
  return w.replace(/[^a-z0-9]/g, '')
}

/**
 * Formes cherchées pour un mot : le mot lui-même (par préfixe s'il est assez long) et,
 * s'il porte une marque de pluriel, son singulier — car le préfixe ne va que dans un
 * sens (« loyer:* » trouve « loyers », mais « loyers:* » ne trouverait pas « loyer »).
 */
function variants(w: string): string[] {
  const out = new Set<string>()
  const add = (x: string) => {
    if (x.length >= 2) out.add(x.length >= PREFIX_MIN ? `${x}:*` : x)
  }
  add(w)
  if (w.length > 4 && (w.endsWith('s') || w.endsWith('x'))) add(w.slice(0, -1))
  return [...out]
}

/** Toutes les formes d'un mot ET de ses synonymes. */
function alternatives(w: string): string[] {
  const out = new Set<string>(variants(w))
  for (const s of SYNONYMS[w] ?? []) {
    const l = lexeme(fold(s))
    if (l) for (const v of variants(l)) out.add(v)
  }
  return [...out]
}

export interface TsQueryPlan {
  /** Expression à passer à `to_tsquery('simple', …)`. */
  query: string
  /** Mots de contenu retenus (repli orthographique / diagnostic). */
  words: string[]
  /**
   * Expressions entre guillemets, foldées — vérifiées en SOUS-CHAÎNE sur `searchText`.
   * Pourquoi pas la recherche de phrase de tsquery : PostgreSQL n'indexe les POSITIONS
   * que jusqu'au 16 383ᵉ lexème ; au-delà (codes de plusieurs milliers d'articles), la
   * recherche de phrase native échoue silencieusement. La sous-chaîne sur le texte folé
   * est exacte quelle que soit la taille, et reste accélérée par l'index GIN trigram.
   * Les jokers LIKE (`%`, `_`) y sont déjà échappés : cf. `escapeLike`.
   */
  phrases: string[]
}

/** Neutralise les jokers LIKE d'une saisie utilisateur (`%`, `_`, `\`). */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Construit le plan de requête. Renvoie null si la saisie ne contient aucun mot
 * exploitable (l'appelant retombe alors sur la navigation sans texte).
 */
export function buildTsQuery(raw: string): TsQueryPlan | null {
  const q = (raw ?? '').trim()
  if (!q) return null

  // Expressions entre guillemets : extraites pour un contrôle exact en sous-chaîne.
  const phrases: string[] = []
  for (const m of q.matchAll(/"([^"]+)"/g)) {
    const p = fold(m[1]).replace(/\s+/g, ' ').trim()
    if (p.replace(/[^a-z0-9]/g, '').length >= 3) phrases.push(escapeLike(p))
  }

  const words = [
    ...new Set(
      fold(q)
        .split(/\s+/)
        .map(lexeme)
        .filter((w) => w.length >= 2 && !STOPWORDS.has(w)),
    ),
  ]
  if (!words.length) return null

  // (mot:* | synonyme:* | …) & (mot2:* | …) — tous les mots exigés (ET).
  const query = words.map((w) => `(${alternatives(w).join(' | ')})`).join(' & ')
  return { query, words, phrases }
}

/** Variante permissive (OU) : repli quand le ET ne rapporte rien. */
export function toOrQuery(plan: TsQueryPlan): string | null {
  if (plan.words.length < 2) return null
  return plan.words.flatMap(alternatives).join(' | ')
}
