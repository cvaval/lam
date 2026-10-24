import { Prisma } from '@prisma/client'

/**
 * Reprise automatique d'une requête dont l'ATTENTE D'UNE CONNEXION a expiré (Prisma P2024).
 *
 * En production, `DATABASE_URL` limite le pool à UNE connexion par instance, partagée par les
 * requêtes simultanées (Vercel en sert plusieurs par instance) : pendant la frappe dans la
 * recherche, l'autocomplétion et la recherche se la disputent, et la perdante abandonne au bout de
 * 10 s → « Une erreur est survenue ». Mesuré le 24 oct. 2026 : 40 fois en 7 jours
 * (`/api/search/suggest` 32, `/fr/search` 5, battement de session 2, carte 1).
 *
 * P2024 dit que la requête n'a JAMAIS été envoyée à la base : la rejouer est sans risque,
 * écriture comprise. Toute autre erreur remonte telle quelle, au premier échec.
 */
export const REESSAIS_CONNEXION = 2

export function estAttenteConnexion(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2024'
}

export async function avecReessaiConnexion<T>(
  executer: () => Promise<T>,
  { reessais = REESSAIS_CONNEXION, journal = console.warn }: { reessais?: number; journal?: (m: string) => void } = {},
): Promise<T> {
  for (let essai = 0; ; essai++) {
    try {
      return await executer()
    } catch (e) {
      if (!estAttenteConnexion(e) || essai >= reessais) throw e
      // Journalisé pour compter les reprises dans les journaux Vercel (« P2024 reprise »).
      journal(`[prisma] P2024 reprise ${essai + 1}/${reessais} — attente de connexion expirée`)
    }
  }
}
