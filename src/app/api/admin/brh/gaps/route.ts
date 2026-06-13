import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { requireAdminApi } from '@/lib/auth/guard'
import { loadBrhGaps, type MissingCirculaire } from '@/lib/brh/gaps'

export const runtime = 'nodejs'

const CSV_MOTIFS: Record<MissingCirculaire['reason'], string> = {
  numero: 'numero saute',
  revision: 'revision sautee',
  originale: 'originale absente',
}

/**
 * Numéros manquants des Circulaires et Lettres-Circulaires BRH (trous internes
 * de chaque série + sous-séries de révisions N-M).
 *  GET /api/admin/brh/gaps              → JSON { ok, total, circulaires, lettres }
 *  GET /api/admin/brh/gaps?format=csv   → fichier CSV téléchargeable (2 séries)
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdminApi())) return apiError('forbidden', 403)

  const { circulaires, lettres, missing } = await loadBrhGaps()

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const lines = ['serie;numero;reference;motif']
    for (const m of missing) {
      const serie = m.serie === 'LETTRE' ? 'Lettre-Circulaire' : 'Circulaire'
      lines.push(`${serie};${m.base}${m.rev ? `-${m.rev}` : ''};${m.ref};${CSV_MOTIFS[m.reason]}`)
    }
    return new NextResponse(lines.join('\n'), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="circulaires-brh-numeros-manquants.csv"',
      },
    })
  }

  return NextResponse.json({
    ok: true,
    total: missing.length,
    circulaires: { present: circulaires.present, missing: circulaires.missing },
    lettres: { present: lettres.present, missing: lettres.missing },
  })
}
