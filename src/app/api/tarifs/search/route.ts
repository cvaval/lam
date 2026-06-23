import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { guard } from '@/lib/security/ratelimit'
import { canReadService } from '@/lib/access'
import { prisma } from '@/lib/db'
import { tariffWhere, TARIFS_PAGE_SIZE } from '@/lib/tarifs'

export const runtime = 'nodejs'

/**
 * Recherche dynamique de la table des tarifs douaniers (frappe au clavier, §07).
 * Filtre par texte et/ou chapitre SH, paginé (skip). Réservée au service Tarifs
 * douaniers (§03) ; ne consomme pas le quota mensuel. Renvoie un signal distinct en
 * cas de dépassement de débit (≠ « aucun résultat ») pour ne pas tromper l'utilisateur.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)
  if (!canReadService(user, 'TARIF_DOUANIER')) return apiError('forbidden', 403)

  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'tarif', subject: user.id, limit: 150, windowMs: 60_000 }, { actorId: user.id, ip: ctx.ip }))) {
    return apiError('rate', 429)
  }

  const sp = req.nextUrl.searchParams
  const q = (sp.get('q') ?? '').trim().slice(0, 120)
  const chapter = (sp.get('chapter') ?? '').trim().slice(0, 2) || null
  const skip = Math.max(0, Math.min(20000, Number(sp.get('skip') ?? '0') || 0))
  // Il faut au moins un critère (texte ≥ 2 car. OU chapitre).
  if (q.length < 2 && !chapter) return NextResponse.json({ ok: true, rows: [], total: 0 })

  const where = tariffWhere(q.length >= 2 ? q : '', chapter)
  const [rows, total] = await Promise.all([
    prisma.customsTariff.findMany({
      where,
      orderBy: [{ chapter: 'asc' }, { position: 'asc' }, { code: 'asc' }],
      skip,
      take: TARIFS_PAGE_SIZE,
      select: { id: true, code: true, designation: true, unite: true, dd: true, ddRef: true, tca: true, accises: true, note: true },
    }),
    skip === 0 ? prisma.customsTariff.count({ where }) : Promise.resolve(-1),
  ])
  return NextResponse.json({ ok: true, rows, total })
}
