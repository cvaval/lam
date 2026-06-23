import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { guard } from '@/lib/security/ratelimit'
import { canReadService } from '@/lib/access'
import { prisma } from '@/lib/db'
import { tariffWhere } from '@/lib/tarifs'

export const runtime = 'nodejs'

const MAX = 100 // doit refléter le MAX de src/components/TariffTable.tsx

/**
 * Recherche dynamique de la table des tarifs douaniers (frappe au clavier, §07).
 * Réservée au service Tarifs douaniers (§03) ; ne consomme pas le quota mensuel.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  if (!canReadService(user, 'TARIF_DOUANIER')) return apiError('forbidden', 403)

  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'tarif', subject: user.id, limit: 150, windowMs: 60_000 }, { actorId: user.id, ip: ctx.ip }))) {
    return NextResponse.json({ ok: true, rows: [], total: 0 })
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120)
  if (q.length < 2) return NextResponse.json({ ok: true, rows: [], total: 0 })

  const where = tariffWhere(q)
  const [rows, total] = await Promise.all([
    prisma.customsTariff.findMany({
      where,
      orderBy: [{ chapter: 'asc' }, { position: 'asc' }, { code: 'asc' }],
      take: MAX,
      select: { id: true, code: true, designation: true, unite: true, dd: true, tca: true, accises: true, note: true },
    }),
    prisma.customsTariff.count({ where }),
  ])
  return NextResponse.json({ ok: true, rows, total })
}
