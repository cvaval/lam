import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { LOCALES } from '@/lib/types'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'

export const runtime = 'nodejs'

const schema = z.object({ locale: z.enum(LOCALES) })

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const user = await getCurrentUser()
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale: parsed.data.locale } })
  return NextResponse.json({ ok: true })
}
