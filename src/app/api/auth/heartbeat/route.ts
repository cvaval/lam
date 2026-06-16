import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

// Ping d'activité (§sécurité, anti-inactivité). Le minuteur navigateur l'appelle
// pendant que l'utilisateur est actif : getCurrentUser() → loadSession() rafraîchit
// lastSeenAt, ce qui empêche le filet serveur de couper une session en cours de
// lecture. 401 si la session a déjà expiré (le client redirige alors vers /login).
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
