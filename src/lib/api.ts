import { NextResponse } from 'next/server'

/**
 * Contrat d'erreur JSON unique des routes API : `{ ok: false, error: <code> }`.
 * Codes en camelCase, stables, mappables sur t.errors côté client (postJson lit
 * ce champ). Évite les trois conventions qui coexistaient ({ok:false} nu,
 * camelCase, snake_case — constat d'audit #27).
 */
export function apiError(code: string, status: number) {
  return NextResponse.json({ ok: false, error: code }, { status })
}

/** Codes standard, pour éviter les variantes orthographiques entre routes. */
export const API_ERRORS = {
  unauthorized: 'unauthorized', // 401 — pas de session
  forbidden: 'forbidden', // 403 — rôle insuffisant
  invalidFields: 'invalidFields', // 400 — corps invalide (zod)
  notFound: 'notFound', // 404
  exists: 'exists', // 409 — doublon (e-mail, code…)
  rate: 'rate', // 429 — anti-scraping
} as const
