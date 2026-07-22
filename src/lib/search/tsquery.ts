/**
 * Construction de la requête plein-texte PostgreSQL (`tsquery`) — Option A.
 *
 * Deux modes :
 *  - EXPRESSION : dès que la saisie contient des guillemets, on délègue à
 *    `websearch_to_tsquery` qui gère nativement "expression exacte", le OR et
 *    l'exclusion -mot (syntaxe familière « à la Google »).
 *  - MOTS : on construit `(mot | synonyme | …) & (mot2 | …)` — TOUS les mots doivent
 *    être présents (ET), chacun pouvant être satisfait par un de ses synonymes.
 *    C'est ce qui préserve la synonymie FR/HT du moteur historique.
 *
 * Sécurité : après `fold()` les termes ne contiennent que [a-z0-9]; tout le reste est
 * retiré avant la mise en requête — aucune syntaxe tsquery ne peut être injectée.
 */
import { fold } from './normalize'
import { SYNONYMS } from './synonyms'

// Mots vides ignorés (identiques au moteur historique) — n'apportent rien au filtrage.
const STOPWORDS = new Set([
  'de', 'la', 'le', 'les', 'des', 'du', 'et', 'en', 'au', 'aux', 'un', 'une', 'sur', 'pour', 'par',
  'of', 'the', 'and', 'for', 'to', 'in', 'on',
])

/** Ne garde que ce qui est indexable comme lexème (le fold a déjà retiré les accents). */
function lexeme(w: string): string {
  return w.replace(/[^a-z0-9]/g, '')
}

export interface TsQueryPlan {
  /** Expression à passer à to_tsquery / websearch_to_tsquery. */
  query: string
  /** true → utiliser websearch_to_tsquery (l'utilisateur a écrit une expression). */
  websearch: boolean
  /** Mots de contenu retenus (diagnostic / repli). */
  words: string[]
  /**
   * Expressions entre guillemets, foldées — vérifiées en SOUS-CHAÎNE sur `searchText`.
   * Pourquoi pas la recherche de phrase de tsquery : PostgreSQL n'indexe les POSITIONS
   * que jusqu'au 16 383ᵉ lexème ; au-delà (codes de plusieurs milliers d'articles), la
   * recherche de phrase native échoue silencieusement. La sous-chaîne sur le texte folé
   * est exacte quelle que soit la taille, et reste accélérée par l'index GIN trigram.
   */
  phrases: string[]
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
    if (p.replace(/[^a-z0-9]/g, '').length >= 3) phrases.push(p)
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

  // (mot | synonyme | …) & (mot2 | …)
  const groups = words.map((w) => {
    const set = new Set([w])
    for (const s of SYNONYMS[w] ?? []) {
      const l = lexeme(fold(s))
      if (l) set.add(l)
    }
    const alts = [...set]
    return alts.length > 1 ? `(${alts.join(' | ')})` : alts[0]
  })
  return { query: groups.join(' & '), websearch: false, words, phrases }
}

/** Variante permissive (OU) : repli quand le ET ne rapporte rien. */
export function toOrQuery(plan: TsQueryPlan): string | null {
  if (plan.websearch || !plan.words.length) return null
  const groups = plan.words.map((w) => {
    const set = new Set([w])
    for (const s of SYNONYMS[w] ?? []) {
      const l = lexeme(fold(s))
      if (l) set.add(l)
    }
    return [...set].join(' | ')
  })
  return groups.join(' | ')
}
