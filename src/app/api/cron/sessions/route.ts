import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { purgerConnexions } from '@/lib/admin/purge-connexions'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { seuilPurgeDemandes } from '@/lib/jurisdictions/notaires-demandes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Purge quotidienne des données de connexion (vercel.json → crons, 4 h UTC) — voir
 * `purgerConnexions` pour ce qu'elle fait et pourquoi. Mêmes autorisations que
 * /api/cron/alerts : `Authorization: Bearer ${CRON_SECRET}`, session MASTER_ADMIN, ou dev local.
 *
 * `?simulation=1` compte sans écrire : la recette en production passe par là avant la
 * première exécution planifiée.
 *
 * Elle purge AUSSI les demandes des tiers sur les notaires (chantier D) décidées depuis plus de
 * 12 mois — acceptées ou refusées ; une demande ouverte n'est jamais purgée. Vercel n'accorde
 * que deux crons à ce projet : la purge s'ajoute ici plutôt que dans un troisième.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  let allowed = Boolean(secret && req.headers.get('authorization') === `Bearer ${secret}`)
  if (!allowed) {
    const user = await getCurrentUser().catch(() => null)
    allowed = user?.role === 'MASTER_ADMIN'
  }
  if (!allowed && process.env.NODE_ENV !== 'production') allowed = true
  if (!allowed) return apiError('forbidden', 403)

  const simulation = req.nextUrl.searchParams.get('simulation') === '1'
  const bilan = await purgerConnexions(prisma, { simulation })
  const whereDemandes = { status: { in: ['ACCEPTEE', 'REFUSEE'] }, decidedAt: { lt: seuilPurgeDemandes(new Date()) } }
  let demandesNotairesSupprimees = 0
  try {
    demandesNotairesSupprimees = simulation
      ? await prisma.notaryRequest.count({ where: whereDemandes })
      : (await prisma.notaryRequest.deleteMany({ where: whereDemandes })).count
  } catch (e) {
    if (!estSchemaAbsent(e)) throw e // table pas encore créée : rien à purger
  }
  console.log(`[cron] purge connexions ${simulation ? '(simulation) ' : ''}: expirées fermées ${bilan.sessionsFermeesExpirees} · sessions supprimées ${bilan.sessionsSupprimees} · audit supprimé ${bilan.auditSupprime} · demandes notaires supprimées ${demandesNotairesSupprimees} · seuil ${bilan.seuil}`)
  return NextResponse.json({ ok: true, ...bilan, demandesNotairesSupprimees })
}
