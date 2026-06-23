import type { Prisma } from '@prisma/client'

/** Chiffres seuls d'un code (« 0101.21 00 » → « 01012100 ») pour la recherche/indexation. */
export function digitsOnly(code: string): string {
  return (code ?? '').replace(/\D/g, '')
}

/**
 * Filtre de recherche d'une position tarifaire : par code (forme pointée OU chiffres
 * seuls via searchCode) et par désignation. Partagé par /tarifs et /admin/tarifs.
 */
export function tariffWhere(q: string): Prisma.CustomsTariffWhereInput {
  const s = (q ?? '').trim()
  if (!s) return {}
  const or: Prisma.CustomsTariffWhereInput[] = [
    { code: { contains: s, mode: 'insensitive' } },
    { designation: { contains: s, mode: 'insensitive' } },
  ]
  // Saisie « 01012100 » (sans point/espace) → recherche sur le code en chiffres seuls.
  const digits = digitsOnly(s)
  if (digits.length >= 2) or.push({ searchCode: { contains: digits } })
  return { OR: or }
}
