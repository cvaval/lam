import type { Prisma } from '@prisma/client'
import { prisma } from '../db'
import { IDLE_BACKSTOP_MS, END_REASONS, type EndReason } from '../auth/session-etat'
import { decrireAppareil } from '../auth/appareil'
import { formatInstant } from '../i18n/format'
import type { Locale } from '../types'

/**
 * Le JOURNAL DES CONNEXIONS du master admin — requêtes et mise en forme, partagées par la page
 * `/admin/connexions` et par l'export CSV, pour que l'écran et le fichier disent la même chose.
 *
 * Trois vues, une source : la ligne `Session` (fermée, jamais supprimée — session.ts) pour les
 * connexions en cours et le journal ; le journal d'audit pour les tentatives échouées, qui
 * n'ont jamais eu de session.
 *
 * ⚠️ PAGINATION BORNÉE. Une page non bornée est un déni de service (audit de la recherche,
 * juillet 2026) : 50 lignes par page, 200 pages au plus.
 * ⚠️ TOUTE HEURE EST UN INSTANT → `formatInstant` (Port-au-Prince), jamais `formatDate` (UTC).
 */
export const PAR_PAGE = 50
export const PAGE_MAX = 200
export const JOURS = [7, 30, 90, 365] as const
export type Jours = (typeof JOURS)[number]

export interface FiltreJournal {
  compte?: string | null
  jours: Jours
  motif?: EndReason | 'EN_COURS' | null
  page: number
}

/** Lit et borne les paramètres d'URL — une valeur inconnue retombe sur le défaut, jamais sur « tout ». */
export function lireFiltre(sp: Record<string, string | string[] | undefined> | undefined): FiltreJournal {
  const un = (k: string) => (typeof sp?.[k] === 'string' ? (sp![k] as string) : null)
  const jours = Number(un('jours'))
  const motif = un('motif')
  const page = Number(un('page'))
  return {
    compte: un('compte') || null,
    jours: (JOURS as readonly number[]).includes(jours) ? (jours as Jours) : 30,
    motif: motif === 'EN_COURS' || (END_REASONS as readonly string[]).includes(motif ?? '') ? (motif as EndReason | 'EN_COURS') : null,
    page: Number.isInteger(page) && page >= 1 ? Math.min(page, PAGE_MAX) : 1,
  }
}

/** Les trois conditions de « vivante », en SQL Prisma — identiques à `estVivante`. */
export function whereVivante(now = new Date()) {
  return {
    endedAt: null,
    expiresAt: { gt: now },
    twoFactorVerified: true,
    OR: [{ lastSeenAt: null }, { lastSeenAt: { gt: new Date(now.getTime() - IDLE_BACKSTOP_MS) } }],
  }
}

const SELECTION = {
  id: true, userId: true, createdAt: true, endedAt: true, endReason: true, evictedById: true, lastSeenAt: true, expiresAt: true,
  ip: true, userAgent: true, deviceLabel: true, verifiedVia: true, twoFactorVerified: true,
  user: { select: { email: true, name: true, role: true } },
} as const

export type LigneSession = Prisma.SessionGetPayload<{ select: typeof SELECTION }>

export async function sessionsEnCours() {
  return prisma.session.findMany({ where: whereVivante(), select: SELECTION, orderBy: { createdAt: 'desc' } })
}

export async function journalConnexions(f: FiltreJournal) {
  const depuis = new Date(Date.now() - f.jours * 86400_000)
  const where = {
    createdAt: { gte: depuis },
    ...(f.compte ? { userId: f.compte } : {}),
    ...(f.motif === 'EN_COURS' ? { endedAt: null } : f.motif ? { endReason: f.motif } : {}),
  }
  const [total, lignes] = await Promise.all([
    prisma.session.count({ where }),
    prisma.session.findMany({ where, select: SELECTION, orderBy: { createdAt: 'desc' }, take: PAR_PAGE, skip: (f.page - 1) * PAR_PAGE }),
  ])
  // Les sessions qui en ont remplacé d'autres : pour le lien « nouvelle connexion → … ».
  const remplacants = [...new Set(lignes.map((l) => l.evictedById).filter((x): x is string => !!x))]
  const parId = new Map(
    remplacants.length
      ? (await prisma.session.findMany({ where: { id: { in: remplacants } }, select: { id: true, deviceLabel: true, createdAt: true } })).map((s) => [s.id, s])
      : [],
  )
  return { total, lignes, pages: Math.min(PAGE_MAX, Math.max(1, Math.ceil(total / PAR_PAGE))), remplacants: parId }
}

/** Tentatives échouées de la période : elles n'ont jamais eu de session, elles vivent au journal d'audit. */
export async function tentativesEchouees(f: Pick<FiltreJournal, 'jours' | 'compte'>) {
  const depuis = new Date(Date.now() - f.jours * 86400_000)
  return prisma.auditLog.findMany({
    where: { action: { in: ['LOGIN_FAIL', '2FA_FAIL', 'LOCKOUT'] }, createdAt: { gte: depuis }, ...(f.compte ? { actorId: f.compte } : {}) },
    select: { id: true, action: true, createdAt: true, ip: true, userAgent: true, metaJson: true, actor: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
}

/** Comptes proposés au filtre : tous, avec leur e-mail — neuf comptes, une liste suffit. */
export async function comptesPourFiltre() {
  return prisma.user.findMany({ select: { id: true, email: true, role: true }, orderBy: { email: 'asc' } })
}

// ─── Mise en forme partagée (écran et CSV) ───

export const LIBELLE_MOTIF: Record<EndReason | 'EN_COURS' | 'INCONNU', { fr: string; en: string; ht: string }> = {
  EN_COURS: { fr: 'en cours', en: 'open', ht: 'an kou' },
  LOGOUT: { fr: 'déconnexion', en: 'sign-out', ht: 'dekoneksyon' },
  IDLE: { fr: 'inactivité', en: 'inactivity', ht: 'inaktivite' },
  EXPIRED: { fr: 'expiration (7 jours)', en: 'expiry (7 days)', ht: 'ekspirasyon (7 jou)' },
  EVICTED: { fr: 'nouvelle connexion', en: 'new sign-in', ht: 'nouvo koneksyon' },
  ADMIN: { fr: 'fermée par l’administrateur', en: 'closed by the administrator', ht: 'administratè a fèmen l' },
  SUSPENDED: { fr: 'compte suspendu', en: 'account suspended', ht: 'kont sispann' },
  TWOFA_RESET: { fr: 'réinitialisation 2FA', en: '2FA reset', ht: 'reyinisyalizasyon 2FA' },
  PASSWORD_RESET: { fr: 'réinitialisation du mot de passe', en: 'password reset', ht: 'reyinisyalizasyon modpas' },
  // Les 37 lignes antérieures au journal (fermées par suppression, avant le 17 sept. 2026) et
  // toute ligne fermée sans motif : on ne sait pas, on le dit.
  INCONNU: { fr: 'fin non enregistrée', en: 'end not recorded', ht: 'fen pa anrejistre' },
}
export const LIBELLE_VERIFICATION: Record<'TOTP' | 'TRUSTED_DEVICE' | 'NONE' | 'INCONNUE', { fr: string; en: string; ht: string }> = {
  TOTP: { fr: 'code 2FA', en: '2FA code', ht: 'kòd 2FA' },
  TRUSTED_DEVICE: { fr: 'appareil de confiance', en: 'trusted device', ht: 'aparèy konfyans' },
  NONE: { fr: 'non vérifiée', en: 'not verified', ht: 'pa verifye' },
  // Lignes antérieures au journal : vérifiées, mais le chemin n'était pas enregistré. On ne devine pas.
  INCONNUE: { fr: 'vérifiée (chemin non enregistré)', en: 'verified (path not recorded)', ht: 'verifye (chemen pa anrejistre)' },
}

export function motifDe(l: { endedAt: Date | null; endReason: string | null }): EndReason | 'EN_COURS' | 'INCONNU' {
  if (!l.endedAt) return 'EN_COURS'
  return (END_REASONS as readonly string[]).includes(l.endReason ?? '') ? (l.endReason as EndReason) : 'INCONNU'
}
export function verificationDe(l: { verifiedVia: string | null; twoFactorVerified: boolean }): 'TOTP' | 'TRUSTED_DEVICE' | 'NONE' | 'INCONNUE' {
  if (l.verifiedVia === 'TOTP' || l.verifiedVia === 'TRUSTED_DEVICE') return l.verifiedVia
  return l.twoFactorVerified ? 'INCONNUE' : 'NONE'
}
/** L'appareil : le libellé figé à la création ; à défaut, ce que l'UA brut dit aujourd'hui ; à défaut, rien. */
export function appareilDe(l: { deviceLabel: string | null; userAgent: string | null }): { libelle: string; reconnu: boolean; ua: string | null } {
  if (l.deviceLabel) return { libelle: l.deviceLabel, reconnu: true, ua: l.userAgent }
  const a = decrireAppareil(l.userAgent)
  return { libelle: a.libelle, reconnu: a.reconnu, ua: l.userAgent }
}

/** « 2 h 05 », « 14 min », « 3 j 4 h » — ou null si la fin n'est pas connue. */
export function duree(l: { createdAt: Date; endedAt: Date | null }): string | null {
  if (!l.endedAt) return null
  const ms = Math.max(0, l.endedAt.getTime() - l.createdAt.getTime())
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, '0')}`
  const j = Math.floor(h / 24)
  return `${j} j ${h % 24} h`
}

// ─── CSV ───

function celluleCsv(v: string | null | undefined): string {
  const s = v ?? ''
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Le journal en CSV — UTF-8 avec BOM (Excel), séparateur « ; » (Excel francophone), heures de
 * Port-au-Prince. Pur : testable sans base.
 */
export function csvConnexions(locale: Locale, lignes: LigneSession[], remplacants: Map<string, { deviceLabel: string | null; createdAt: Date }>): string {
  const lt = (o: { fr: string; en: string; ht: string }) => o[locale] ?? o.fr
  const entete = ['compte', 'role', 'debut (Port-au-Prince)', 'fin (Port-au-Prince)', 'duree', 'motif de fin', 'remplacee par', 'appareil', 'user-agent', 'ip', 'verification', 'derniere activite (Port-au-Prince)']
  const rows = lignes.map((l) => {
    const r = l.evictedById ? remplacants.get(l.evictedById) : null
    return [
      l.user.email, l.user.role,
      formatInstant(locale, l.createdAt), l.endedAt ? formatInstant(locale, l.endedAt) : '', duree(l) ?? '',
      lt(LIBELLE_MOTIF[motifDe(l)]),
      r ? `${r.deviceLabel ?? '?'} · ${formatInstant(locale, r.createdAt)}` : '',
      appareilDe(l).libelle, l.userAgent ?? '', l.ip ?? '',
      lt(LIBELLE_VERIFICATION[verificationDe(l)]),
      l.lastSeenAt ? formatInstant(locale, l.lastSeenAt) : '',
    ].map(celluleCsv).join(';')
  })
  return '\uFEFF' + [entete.join(';'), ...rows].join('\r\n') + '\r\n'
}
