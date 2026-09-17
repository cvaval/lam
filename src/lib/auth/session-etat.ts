/**
 * L'ÉTAT d'une session — pur, sans base ni cookie, donc testable.
 *
 * `session.ts` porte les cookies et Prisma (et `cache` de React, que vitest ne fournit pas) ;
 * ce module porte les règles : ce qu'est une session vivante, comment se nomme une fin, et —
 * pour la règle « une seule connexion par compte » — comment se classent les sessions qu'une
 * connexion vérifiée trouve ouvertes.
 */

/**
 * Déconnexion automatique pour inactivité (§sécurité). Deux mécanismes de portées
 * distinctes — ne pas les confondre :
 *  - IDLE_TIMEOUT_MINUTES : la véritable déconnexion d'inactivité HUMAINE, appliquée
 *    côté NAVIGATEUR (minuteur précis basé sur l'activité réelle souris/clavier/
 *    défilement, voir IdleTimer), avec un avertissement avant la coupure.
 *  - Le SERVEUR applique un filet plus large (IDLE_BACKSTOP_MS) : il invalide la
 *    session après une absence TOTALE de requêtes (navigateur abandonné / onglet
 *    fermé / JS désactivé). Ce filet ne mesure PAS l'inactivité humaine : loadSession()
 *    rafraîchit lastSeenAt sur toute requête authentifiée — y compris un simple ping
 *    /api/auth/heartbeat. Un appelant (client légitime comme script automatisé) qui
 *    émet une requête à intervalle < IDLE_BACKSTOP_MS garde donc la session vivante
 *    indéfiniment ; la garantie se limite au cas « plus aucune requête n'arrive ».
 *    Le « +5 min » absorbe le délai entre les pings d'activité du client.
 */
export const IDLE_TIMEOUT_MINUTES = 15
export const IDLE_WARNING_SECONDS = 60
export const IDLE_BACKSTOP_MS = (IDLE_TIMEOUT_MINUTES + 5) * 60_000

/**
 * Les huit façons dont une session se termine. Chacune vient d'un chemin précis :
 *   LOGOUT         l'utilisateur s'est déconnecté (route logout)
 *   IDLE           plus aucune requête depuis IDLE_BACKSTOP_MS (loadSession)
 *   EXPIRED        les 7 jours sont passés (loadSession, ou la purge quotidienne)
 *   EVICTED        une autre connexion VÉRIFIÉE du même compte l'a remplacée
 *   ADMIN          le master admin l'a fermée depuis le journal des connexions
 *   SUSPENDED      le compte a été suspendu
 *   TWOFA_RESET    la 2FA du compte a été réinitialisée
 *   PASSWORD_RESET le mot de passe a été réinitialisé (reprise de contrôle du compte)
 */
export type EndReason = 'LOGOUT' | 'IDLE' | 'EXPIRED' | 'EVICTED' | 'ADMIN' | 'SUSPENDED' | 'TWOFA_RESET' | 'PASSWORD_RESET'
export const END_REASONS: readonly EndReason[] = ['LOGOUT', 'IDLE', 'EXPIRED', 'EVICTED', 'ADMIN', 'SUSPENDED', 'TWOFA_RESET', 'PASSWORD_RESET']

export interface EtatSession {
  endedAt: Date | null
  expiresAt: Date
  lastSeenAt: Date | null
}

/**
 * « VIVANTE » se définit sur TROIS conditions, pas une. Une ligne dont `expiresAt` est encore à
 * venir peut être morte d'inactivité depuis des jours (la fermeture est paresseuse : elle
 * n'arrive que si le cookie se représente — le 16 sept. 2026, trois sessions Windows « non
 * expirées » n'avaient plus été vues depuis leur premier quart d'heure). Le journal, la règle
 * « une seule connexion », le compteur « connexions en cours » et l'e-mail d'alerte emploient
 * tous ce prédicat.
 */
export function estVivante(s: EtatSession, now = Date.now()): boolean {
  if (s.endedAt) return false
  if (s.expiresAt.getTime() <= now) return false
  const last = s.lastSeenAt?.getTime()
  return last === undefined || now - last <= IDLE_BACKSTOP_MS
}

/**
 * Ce qu'une session fraîchement VÉRIFIÉE fait des autres sessions ouvertes du compte.
 *
 * Seules les sessions VIVANTES sont « évincées » : c'est le mot du journal pour une
 * simultanéité réelle, et c'est lui qui déclenche l'e-mail au titulaire. Une session morte
 * d'inactivité ou expirée, jamais fermée parce que son cookie ne s'est plus présenté, se
 * ferme pour ce qu'elle est — IDLE ou EXPIRED, datée de sa vraie fin — pas pour ce qu'elle
 * n'a pas été. Une session en attente de 2FA (jamais vérifiée) ne compte pas comme
 * connexion, mais ne survit pas non plus à une connexion vérifiée : évincée, sans e-mail.
 */
export interface Fermeture { id: string; reason: EndReason; endedAt: Date; vivante: boolean }

export function classerAutresSessions(
  autres: (EtatSession & { id: string; twoFactorVerified: boolean })[],
  now = Date.now(),
): Fermeture[] {
  const maintenant = new Date(now)
  return autres.map((s): Fermeture => {
    if (s.expiresAt.getTime() <= now) return { id: s.id, reason: 'EXPIRED', endedAt: s.expiresAt, vivante: false }
    const last = s.lastSeenAt?.getTime()
    if (last !== undefined && now - last > IDLE_BACKSTOP_MS) return { id: s.id, reason: 'IDLE', endedAt: new Date(last + IDLE_BACKSTOP_MS), vivante: false }
    // Vivante — ou jamais vue. En attente de 2FA : évincée mais pas une « connexion » (pas d'e-mail).
    return { id: s.id, reason: 'EVICTED', endedAt: maintenant, vivante: s.twoFactorVerified }
  })
}
