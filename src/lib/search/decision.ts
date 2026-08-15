/**
 * Critères propres aux DÉCISIONS : parties, domaine, magistrats.
 *
 * Ces quatre filtres partagent une exigence : ils doivent se comporter à l'identique dans
 * les trois moteurs — Prisma (navigation), SQL brut (recherche texte) et OpenSearch
 * (miroir local). Leur sémantique est donc définie ICI, une seule fois, et chaque moteur
 * la traduit dans sa syntaxe.
 */
import { motsMagistrat } from '@/lib/jurisprudence/composition'

/** Les rôles qui JUGENT. Le ministère public et le greffe n'en sont pas. */
export const ROLES_SIEGE = ['PRESIDENT', 'VICE_PRESIDENT', 'PRESIDENT_FF', 'JUGE'] as const
export const ROLES_PRESIDENCE = ['PRESIDENT', 'VICE_PRESIDENT', 'PRESIDENT_FF'] as const

export type VentilationRole = 'PRESIDENCE' | 'SIEGE' | 'MINISTERE_PUBLIC' | 'GREFFE'

/**
 * ⚠️ « SIEGE » EXCLUT LA PRÉSIDENCE. Les deux ventilations que demande la rédaction —
 * décisions PRÉSIDÉES et décisions auxquelles le magistrat a PARTICIPÉ — doivent être
 * disjointes : un arrêt qui figurerait dans les deux listes serait compté deux fois.
 */
export function rolesDe(v: VentilationRole): string[] {
  if (v === 'PRESIDENCE') return [...ROLES_PRESIDENCE]
  if (v === 'SIEGE') return ['JUGE']
  return [v]
}

/**
 * Les mots d'un critère de parties : « CESAR c. LALANNE » → ['cesar', 'lalanne'].
 * Le « c. » de l'intitulé et les mots d'une lettre sont écartés — ils apparieraient tout.
 */
export function motsDe(critere: string): string[] {
  return [
    ...new Set(
      critere
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((m) => m.length > 1 && m !== 'et'),
    ),
  ].slice(0, 6) // borne : six mots suffisent à désigner des parties, et bornent la requête
}

/** Filtre Prisma imbriqué sur le nom d'un magistrat, insensible aux accents et à la casse. */
export function nomMagistrat(nom: string) {
  const mots = motsMagistrat(nom)
  if (!mots.length) return {}
  // La clé de rapprochement porte déjà la normalisation (accents, casse, « St »/« Saint ») :
  // chercher dedans évite de la refaire en SQL et fait tomber « Noel » sur « NOËL ».
  return { judge: { AND: mots.slice(0, 4).map((m) => ({ matchKey: { contains: m } })) } }
}

/**
 * Les mêmes mots, pour le `LIKE` SQL : la clé stockée est déjà normalisée, il ne reste
 * qu'à échapper les jokers pour qu'un nom contenant « % » ou « _ » n'apparie pas tout.
 */
export function motsMagistratSql(nom: string): string[] {
  return motsMagistrat(nom)
    .slice(0, 4)
    .map((m) => m.replace(/[%_\\]/g, '\\$&'))
}
