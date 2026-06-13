/** Normalisation canonique des adresses e-mail — à appliquer à TOUTE écriture/recherche. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}
