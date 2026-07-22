/**
 * Mots vides ignorés par le moteur — source UNIQUE.
 *
 * Servent à deux choses qui doivent rester cohérentes : le filtrage plein-texte
 * (`tsquery.ts`, un « de » n'a pas à être exigé) et le calcul de couverture des mots
 * de la requête (`fts.ts`, un « de » ne doit pas compter comme un mot manquant).
 * La liste était dupliquée dans les deux fichiers — toute divergence faisait diverger
 * silencieusement le filtrage et le classement.
 *
 * ⚠️ La configuration plein-texte employée est `simple`, qui n'écarte AUCUN mot vide
 * côté index : c'est donc cette liste, côté requête, qui joue ce rôle.
 */
export const STOPWORDS = new Set([
  'de', 'la', 'le', 'les', 'des', 'du', 'et', 'en', 'au', 'aux', 'un', 'une', 'sur', 'pour', 'par',
  'of', 'the', 'and', 'for', 'to', 'in', 'on',
])
