import Link from 'next/link'
import type { EndReason } from '@/lib/auth/session-etat'
import { formatInstant } from '@/lib/i18n/format'
import type { Locale } from '@/lib/types'

/**
 * L'AVIS de l'écran de connexion : pourquoi la session précédente s'est terminée.
 *
 * Un abonné renvoyé à l'écran de connexion sans explication conclut à une panne — ou, pire, ne
 * conclut rien alors que quelqu'un d'autre vient d'entrer avec son mot de passe. Jusqu'au
 * 16 sept. 2026, l'inactivité posait `?timeout=1` dans l'URL et rien ne le lisait.
 *
 * ⚠️ D'OÙ VIENT LE MOTIF. De la LIGNE de session que le cookie désigne encore
 * (`lireFinDeSession`) — pour tout motif. L'URL n'est lue que pour `inactivite`, parce que la
 * coupure d'inactivité vient du navigateur, avant que le serveur l'ait constatée. Aucun autre
 * motif ne se prend de l'URL : n'importe qui peut taper une URL, et un avis « nouvelle
 * connexion » forgé ferait paniquer un confrère.
 *
 * ⚠️ SANS ADRESSE IP. L'avis « nouvelle connexion » nomme l'APPAREIL de la nouvelle connexion,
 * pas son adresse : si le navigateur évincé est celui d'un intrus, on ne lui livre pas
 * l'adresse du titulaire. L'IP va dans l'e-mail, que seul le titulaire reçoit.
 *
 * Aucune clé i18n nouvelle (fichiers de locale d'une autre session) : libellés locaux.
 */
const L = {
  EVICTED: {
    fr: (quand: string, appareil: string) => `Votre session a été fermée le ${quand} (heure de Port-au-Prince) : une nouvelle connexion à votre compte a été ouverte depuis ${appareil}. Un seul appareil à la fois par compte.`,
    en: (quand: string, appareil: string) => `Your session was closed on ${quand} (Port-au-Prince time): a new sign-in to your account was opened from ${appareil}. One device at a time per account.`,
    ht: (quand: string, appareil: string) => `Sesyon ou a te fèmen ${quand} (lè Pòtoprens) : yon nouvo koneksyon sou kont ou te louvri sou ${appareil}. Yon sèl aparèy alafwa pou chak kont.`,
  },
  pasVous: {
    fr: 'Si ce n’est pas vous, réinitialisez votre mot de passe dès maintenant.',
    en: 'If this was not you, reset your password now.',
    ht: 'Si se pa ou menm, reyinisyalize modpas ou kounye a.',
  },
  appareilInconnu: { fr: 'un navigateur non reconnu', en: 'an unrecognised browser', ht: 'yon navigatè nou pa rekonèt' },
  IDLE: {
    fr: 'Vous avez été déconnecté après 15 minutes d’inactivité. Reconnectez-vous pour continuer.',
    en: 'You were signed out after 15 minutes of inactivity. Sign in again to continue.',
    ht: 'Nou dekonekte w apre 15 minit san aktivite. Konekte ankò pou kontinye.',
  },
  EXPIRED: {
    fr: 'Votre session a expiré (7 jours). Reconnectez-vous pour continuer.',
    en: 'Your session has expired (7 days). Sign in again to continue.',
    ht: 'Sesyon ou a ekspire (7 jou). Konekte ankò pou kontinye.',
  },
  ADMIN: {
    fr: 'Votre session a été fermée par l’administrateur.',
    en: 'Your session was closed by the administrator.',
    ht: 'Administratè a fèmen sesyon ou a.',
  },
  SUSPENDED: {
    fr: 'Votre compte a été suspendu. Écrivez à contact@lam.ht.',
    en: 'Your account has been suspended. Write to contact@lam.ht.',
    ht: 'Kont ou a sispann. Ekri contact@lam.ht.',
  },
  TWOFA_RESET: {
    fr: 'Votre authentification à deux facteurs a été réinitialisée : reconnectez-vous pour l’enregistrer à nouveau.',
    en: 'Your two-factor authentication was reset: sign in again to enrol it anew.',
    ht: 'Otantifikasyon de-faktè ou a te reyinisyalize : konekte ankò pou anrejistre l.',
  },
  PASSWORD_RESET: {
    fr: 'Votre mot de passe a été réinitialisé : toutes vos sessions ont été fermées.',
    en: 'Your password was reset: all your sessions have been closed.',
    ht: 'Modpas ou a te reyinisyalize : tout sesyon ou yo fèmen.',
  },
} as const

export interface FinDeSession {
  reason: EndReason
  endedAt: Date
  remplacePar: { deviceLabel: string | null; createdAt: Date } | null
}

export function AvisSession({ locale, fin, motifUrl }: { locale: Locale; fin: FinDeSession | null; motifUrl?: string | null }) {
  const lt = <T extends { fr: unknown; en: unknown; ht: unknown }>(o: T): T['fr'] => (o as Record<string, T['fr']>)[locale] ?? o.fr
  // Une déconnexion volontaire n'a rien à expliquer.
  let reason: EndReason | null = fin && fin.reason !== 'LOGOUT' ? fin.reason : null
  // Le seul motif lu dans l'URL — et seulement s'il n'y a rien de plus précis sur la ligne.
  if (!reason && motifUrl === 'inactivite') reason = 'IDLE'
  if (!reason) return null

  let texte: string
  if (reason === 'EVICTED' && fin) {
    const quand = formatInstant(locale, fin.remplacePar?.createdAt ?? fin.endedAt, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    texte = lt(L.EVICTED)(quand, fin.remplacePar?.deviceLabel ?? lt(L.appareilInconnu))
  } else if (reason === 'EVICTED') {
    return null
  } else {
    texte = lt(L[reason])
  }
  const alerte = reason === 'EVICTED'
  return (
    <div role="status" className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-relaxed ${alerte ? 'border-wouj/40 bg-wouj/5 text-ank' : 'border-chabon/15 bg-koton text-ank'}`}>
      <p>{texte}</p>
      {alerte && (
        <p className="mt-1.5">
          <Link href={`/${locale}/forgot`} className="font-medium text-chabon underline underline-offset-2">{lt(L.pasVous)}</Link>
        </p>
      )}
    </div>
  )
}
