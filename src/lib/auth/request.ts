import type { NextRequest } from 'next/server'

/** Contexte client extrait des en-têtes (IP, UA, langue) — consommé par service.ts. */
export interface ClientCtx {
  ip: string | null
  userAgent: string | null
  acceptLang: string | null
}

export function getClientCtx(req: NextRequest): ClientCtx {
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd ? fwd.split(',')[0].trim() : req.headers.get('x-real-ip')
  return {
    ip: ip ?? null,
    userAgent: req.headers.get('user-agent'),
    acceptLang: req.headers.get('accept-language'),
  }
}
