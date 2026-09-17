import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard } from '@/lib/security/ratelimit'
import { resolveLocale } from '@/lib/i18n/config'
import { csvConnexions, journalConnexions, lireFiltre, PAR_PAGE, PAGE_MAX } from '@/lib/admin/connexions'

export const runtime = 'nodejs'

/**
 * Export CSV du journal des connexions (décision D6) — mêmes filtres que l'écran, BORNÉ à la
 * période filtrée et à PAGE_MAX × PAR_PAGE lignes, heures de Port-au-Prince, journalisé EXPORT.
 * Frein : trois exportations par minute et par administrateur — un double-clic passe, un script
 * non.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminApi()
  if (!admin) return apiError('forbidden', 403)
  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'export', subject: `connexions:${admin.id}`, limit: 3, windowMs: 60_000 }, { actorId: admin.id, ip: ctx.ip }))) return apiError('rate', 429)

  const sp = Object.fromEntries(req.nextUrl.searchParams.entries())
  const filtre = { ...lireFiltre(sp), page: 1 }
  const locale = resolveLocale(sp.locale)
  // Toutes les pages de la période, dans la borne du journal (PAGE_MAX × PAR_PAGE).
  const premiere = await journalConnexions(filtre)
  const lignes = [...premiere.lignes]
  const remplacants = new Map(premiere.remplacants)
  for (let page = 2; page <= premiere.pages && lignes.length < PAGE_MAX * PAR_PAGE; page++) {
    const suite = await journalConnexions({ ...filtre, page })
    lignes.push(...suite.lignes)
    for (const [k, v] of suite.remplacants) remplacants.set(k, v)
  }
  const csv = csvConnexions(locale, lignes, remplacants)
  await audit({ action: 'EXPORT', actorId: admin.id, ip: ctx.ip, userAgent: ctx.userAgent, meta: { quoi: 'connexions', jours: filtre.jours, compte: filtre.compte, motif: filtre.motif, lignes: lignes.length } })
  const jour = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="connexions-${jour}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
