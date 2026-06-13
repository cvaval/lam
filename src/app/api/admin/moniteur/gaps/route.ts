import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAdminApi } from '@/lib/auth/guard'
import { loadGaps } from '@/lib/moniteur/gaps'

export const runtime = 'nodejs'

/**
 * Numéros manquants du Moniteur (numéros sautés + lettres sautées).
 *  GET /api/admin/moniteur/gaps              → JSON { ok, total, years: [{ year, missing }] }
 *  GET /api/admin/moniteur/gaps?annee=2018   → restreint à une année
 *  GET /api/admin/moniteur/gaps?format=csv   → fichier CSV téléchargeable
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi())) return apiError('forbidden', 403)

  const annee = req.nextUrl.searchParams.get('annee')
  const year = annee ? Number(annee) : undefined
  const gaps = await loadGaps(Number.isFinite(year) ? year : undefined)
  const total = gaps.reduce((s, y) => s + y.missing.length, 0)

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const lines = ['annee;sequence;reference;motif']
    for (const y of gaps) {
      for (const m of y.missing) {
        lines.push(`${y.year};${m.special ? 'SPECIALE' : 'REGULIERE'};${m.ref};${m.reason === 'numero' ? 'numero saute' : 'lettre sautee'}`)
      }
    }
    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="moniteur-numeros-manquants${year ? `-${year}` : ''}.csv"`,
      },
    })
  }

  return NextResponse.json({ ok: true, total, years: gaps })
}
