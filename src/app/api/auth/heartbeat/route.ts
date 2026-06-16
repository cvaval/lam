import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'
import { getClientCtx } from '@/lib/auth/request'
import { guard, LIMITS } from '@/lib/security/ratelimit'

export const runtime = 'nodejs'

// Ping d'activité (§sécurité, anti-inactivité). Le minuteur navigateur (IdleTimer)
// l'appelle pendant que l'utilisateur est réellement actif : getCurrentUser() →
// loadSession() rafraîchit lastSeenAt, ce qui empêche le filet serveur de couper une
// session en cours de lecture. 401 si la session a déjà expiré (le client redirige
// alors vers /login).
// NB : l'endpoint ne contrôle que l'authentification, pas une activité humaine réelle ;
// tout appelant authentifié peut donc rafraîchir lastSeenAt à volonté. La déconnexion
// pour inactivité humaine repose sur le minuteur navigateur, pas sur ce ping — voir
// loadSession() (session.ts) pour la portée exacte du filet serveur.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  // Plafonne la lecture DB déclenchée par chaque ping (un appelant authentifié peut
  // appeler cet endpoint à volonté). Dépassement → 429 + SCRAPING_ALERT (meta.rule =
  // 'heartbeat'). Le seuil reste large pour l'usage normal — voir LIMITS.heartbeat.
  const ctx = getClientCtx(req)
  if (!(await guard({ action: 'heartbeat', subject: user.id, ...LIMITS.heartbeat }, { actorId: user.id, ip: ctx.ip }))) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }
  return NextResponse.json({ ok: true })
}
