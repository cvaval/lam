import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sonde de disponibilité (publique, sans donnée sensible) : vérifie que la base répond et
// expose le SHA de build. Branchable sur un moniteur d'uptime (UptimeRobot, etc.) — 503 si KO.
export async function GET() {
  const started = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      ok: true,
      db: 'up',
      sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      ms: Date.now() - started,
    })
  } catch {
    return NextResponse.json({ ok: false, db: 'down' }, { status: 503 })
  }
}
