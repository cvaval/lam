import type { Alert } from '@prisma/client'
import { prisma } from './db'
import { fold } from './search/normalize'
import { accessibleTypes, parseServices } from './access'
import { sendMail, alertDigestEmail, type AlertDigestItem } from './mail'
import type { DocType, Role } from './types'
import { DOC_TYPES } from './types'

/** Nombre maximal d'alertes par compte (anti-abus). */
export const MAX_ALERTS = 20
/** Nombre maximal de documents cités par alerte dans un e-mail de veille. */
const MAX_HITS_PER_ALERT = 10
/** Borne du lot de documents examinés par passe — au-delà, la fenêtre s'arrête
 *  au dernier document chargé et le reste est repris à la passe suivante. */
const MAX_DOCS_PER_RUN = 500

/** DTO sérialisable d'une alerte (composants client + routes API). */
export interface AlertDto {
  id: string
  label: string
  query: string | null
  type: DocType | null
  active: boolean
  lastNotifiedAt: string | null
  createdAt: string
}

export function toAlertDto(a: Alert): AlertDto {
  return {
    id: a.id,
    label: a.label,
    query: a.query,
    type: a.type && (DOC_TYPES as readonly string[]).includes(a.type) ? (a.type as DocType) : null,
    active: a.active,
    lastNotifiedAt: a.lastNotifiedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }
}

/**
 * Passe de veille (déclenchée par le cron quotidien /api/cron/alerts) : pour
 * chaque alerte active d'un compte ACTIF, cherche les nouveaux documents puis
 * envoie UN e-mail par utilisateur (toutes ses alertes regroupées).
 *
 * Une seule requête documents par passe (pas une par alerte) : les documents
 * créés depuis la plus ancienne fenêtre sont chargés une fois, puis rapprochés
 * de chaque alerte en mémoire — tous les termes (repliés comme buildSearchText)
 * présents dans searchText, borné aux types que le COMPTE peut lire (§03), une
 * alerte ne divulgue jamais un service non accordé.
 *
 * Fenêtre sans trou : la borne haute est figée AVANT la lecture (un document
 * créé pendant la passe appartient à la suivante), et si le lot déborde
 * MAX_DOCS_PER_RUN la borne recule au dernier document chargé — rien n'est
 * silencieusement perdu, l'e-mail liste au plus MAX_HITS_PER_ALERT documents
 * et signale le surplus. Best-effort comme tout l'e-mail transactionnel : un
 * échec d'envoi n'interrompt pas la passe.
 */
export async function runAlertsDigest(): Promise<{ alerts: number; emails: number; matches: number }> {
  const alerts = await prisma.alert.findMany({
    where: { active: true, user: { status: 'ACTIVE' } },
    include: { user: { select: { id: true, email: true, locale: true, role: true, services: true } } },
    orderBy: { createdAt: 'asc' },
  })
  if (!alerts.length) return { alerts: 0, emails: 0, matches: 0 }

  // Borne haute FIGÉE avant la lecture ; borne basse = plus ancienne fenêtre.
  let windowEnd = new Date()
  const sinceOf = (a: Alert) => a.lastNotifiedAt ?? a.createdAt
  const minSince = new Date(Math.min(...alerts.map((a) => sinceOf(a).getTime())))

  const docs = await prisma.document.findMany({
    where: { createdAt: { gt: minSince, lte: windowEnd } },
    orderBy: { createdAt: 'asc' },
    take: MAX_DOCS_PER_RUN,
    select: {
      id: true,
      titleFr: true,
      type: true,
      number: true,
      moniteurRef: true,
      createdAt: true,
      searchText: true,
    },
  })
  // Lot tronqué : la fenêtre s'arrête au dernier document chargé, le reste
  // sera traité à la prochaine passe (aucun document sauté).
  if (docs.length === MAX_DOCS_PER_RUN) windowEnd = docs[docs.length - 1].createdAt

  const byUser = new Map<string, { email: string; locale: string; items: AlertDigestItem[] }>()
  let matches = 0

  for (const alert of alerts) {
    const allowed = accessibleTypes({ role: alert.user.role as Role, services: parseServices(alert.user.services) })
    const types = alert.type ? allowed.filter((t) => t === alert.type) : allowed
    if (!types.length) continue
    const since = sinceOf(alert)
    const terms = fold(alert.query ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
    const hits = docs.filter(
      (d) =>
        d.createdAt > since &&
        d.createdAt <= windowEnd &&
        (types as string[]).includes(d.type) &&
        terms.every((term) => (d.searchText ?? '').includes(term)),
    )
    if (!hits.length) continue
    matches += hits.length
    const entry = byUser.get(alert.user.id) ?? { email: alert.user.email, locale: alert.user.locale, items: [] }
    entry.items.push({
      label: alert.label,
      docs: hits
        .slice(0, MAX_HITS_PER_ALERT)
        .map((d) => ({ id: d.id, title: d.titleFr, ref: d.moniteurRef ?? d.number ?? null })),
      more: Math.max(0, hits.length - MAX_HITS_PER_ALERT),
    })
    byUser.set(alert.user.id, entry)
  }

  // Fenêtre suivante : toutes les alertes examinées repartent de la borne haute
  // (même sans correspondance — évite de rebalayer tout l'historique).
  await prisma.alert.updateMany({ where: { id: { in: alerts.map((a) => a.id) } }, data: { lastNotifiedAt: windowEnd } })

  // Envois indépendants (sendMail avale ses propres échecs) — en parallèle.
  await Promise.all(
    [...byUser.values()].map(({ email, locale, items }) => sendMail(alertDigestEmail(email, locale, items))),
  )

  return { alerts: alerts.length, emails: byUser.size, matches }
}
