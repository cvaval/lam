/**
 * Logique PURE de la navigation entre occurrences (`NavigationOccurrences`), testée sans navigateur.
 */

/**
 * Occurrence de départ : la 1ʳᵉ située APRÈS l'article désigné par l'adresse (`#art-N`) — `apres[i]`
 * dit si l'occurrence i est dans cet article ou au-delà —, sinon la toute 1ʳᵉ.
 */
export function indexDepart(apres: boolean[]): number {
  const k = apres.indexOf(true)
  return k >= 0 ? k : 0
}

/** Occurrence voisine, en boucle : après la dernière, la première ; avant la première, la dernière. */
export function indexVoisin(nombre: number, actuel: number, sens: 1 | -1): number {
  if (nombre <= 0) return -1
  if (actuel < 0) return sens === 1 ? 0 : nombre - 1
  return (actuel + sens + nombre) % nombre
}
