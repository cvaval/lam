import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { getClientCtx } from '@/lib/auth/request'
import { getNotaryProfile } from '@/lib/jurisdictions/data'
import { ID_NOTAIRE_RE, versFichePublique } from '@/lib/jurisdictions/fiche-notaire'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Fiche d'un notaire pour la FENÊTRE MODALE de l'annuaire — PUBLIC, lecture seule.
 *   GET /api/public/jurisdictions/notaires/{id}
 *
 *  - 200 `{ fiche }` : la liste blanche `versFichePublique` — coordonnées PROFESSIONNELLES publiées
 *    et date de confirmation si une confirmation valide vise la version publiée ; RIEN d'autre (ni
 *    empreinte, ni provenance détaillée, ni demande, ni donnée de l'administration) ;
 *  - 404 : inscription inconnue, retirée (n° 37) ou identifiant mal formé ;
 *  - 503 : incident de lecture — DISTINCT d'une absence (la modale propose « Réessayer ») ;
 *  - `no-store` : une correction ou une invalidation du badge se voit aussitôt.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { ip } = getClientCtx(req)
  if (!(await guard({ action: 'jur-notaire', subject: ip ?? 'anon', ...LIMITS.jurNotaire }, { ip }))) {
    return apiError('rate_limited', 429)
  }
  if (!ID_NOTAIRE_RE.test(params.id)) return apiError('notary_not_found', 404)
  let profil
  try {
    profil = await getNotaryProfile(params.id)
  } catch (e) {
    console.error('[fiche notaire]', e)
    return apiError('unavailable', 503)
  }
  if (!profil) return apiError('notary_not_found', 404)
  const res = NextResponse.json({ fiche: versFichePublique(profil) })
  res.headers.set('Cache-Control', 'no-store')
  return res
}
