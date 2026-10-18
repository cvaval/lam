/**
 * Affichage d'un numéro haïtien — module SANS dépendance, utilisable côté client (la fiche du
 * notaire en fenêtre modale) comme côté serveur. `coordonnees.ts` le réexporte.
 */

/** « +50929984747 » → « +509 2998-4747 » : un seul format affiché, quel que soit celui reçu. */
export function formatPhone(e164: string): string {
  const m = /^\+509(\d{4})(\d{4})$/.exec(e164)
  return m ? `+509 ${m[1]}-${m[2]}` : e164
}
