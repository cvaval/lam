import { NextResponse } from 'next/server'
import { destroyCurrentSession, getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'

export const runtime = 'nodejs'

export async function POST() {
  const user = await getCurrentUser()
  await destroyCurrentSession()
  if (user) await audit({ action: 'LOGOUT', actorId: user.id })
  return NextResponse.json({ ok: true })
}
