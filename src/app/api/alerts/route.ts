import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { MAX_ALERTS, toAlertDto } from '@/lib/alerts'
import { DOC_TYPES } from '@/lib/types'

export const runtime = 'nodejs'

// Alertes de veille (§ alerts, capacité Pwofesyonèl/Enstitisyon) : une alerte =
// une recherche sauvegardée (requête + type éventuel). Le cron quotidien
// /api/cron/alerts envoie les nouveaux documents correspondants par e-mail.
// v1 : le grant 'sectoral' (Enstitisyon) reçoit les mêmes alertes libres que
// 'true' — Alert.sector n'est pas encore câblé (alertes sectorielles = v2).

const createSchema = z.object({
  q: z.string().trim().min(2).max(300),
  type: z.enum(DOC_TYPES).optional(),
})

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'alerts')) return apiError('forbidden', 403)
  const alerts = await prisma.alert.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json({ ok: true, alerts: alerts.map(toAlertDto) })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'alerts')) return apiError('forbidden', 403)

  const parsed = createSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { q, type } = parsed.data

  // Idempotence : recréer la même alerte renvoie l'existante (pas de doublon).
  // Le plafond est un garde-fou SOUPLE (deux créations simultanées peuvent le
  // franchir d'une unité — pas de contrainte d'unicité en base, acceptable ici).
  const [existing, count] = await Promise.all([
    prisma.alert.findFirst({ where: { userId: user.id, query: q, type: type ?? null } }),
    prisma.alert.count({ where: { userId: user.id } }),
  ])
  if (existing) return NextResponse.json({ ok: true, alert: toAlertDto(existing) })
  if (count >= MAX_ALERTS) return apiError('alertLimit', 400)

  const alert = await prisma.alert.create({
    data: { userId: user.id, label: q, query: q, type: type ?? null },
  })
  return NextResponse.json({ ok: true, alert: toAlertDto(alert) })
}
