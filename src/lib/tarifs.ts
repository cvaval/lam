import type { Prisma } from '@prisma/client'

/** Taille de page commune (résultats de recherche + lot « charger plus »). */
export const TARIFS_PAGE_SIZE = 100

/** Chiffres seuls d'un code (« 0101.21 00 » → « 01012100 ») pour la recherche/indexation. */
export function digitsOnly(code: string): string {
  return (code ?? '').replace(/\D/g, '')
}

/**
 * Filtre d'une position tarifaire : par texte (code pointé OU chiffres seuls via
 * searchCode, OU désignation) et/ou par chapitre SH. Partagé par /tarifs, l'API de
 * recherche et /admin/tarifs.
 */
export function tariffWhere(q: string, chapter?: string | null): Prisma.CustomsTariffWhereInput {
  const s = (q ?? '').trim()
  const and: Prisma.CustomsTariffWhereInput[] = []
  if (chapter) and.push({ chapter })
  if (s) {
    const or: Prisma.CustomsTariffWhereInput[] = [
      { code: { contains: s, mode: 'insensitive' } },
      { designation: { contains: s, mode: 'insensitive' } },
    ]
    const digits = digitsOnly(s)
    if (digits.length >= 2) or.push({ searchCode: { contains: digits } })
    and.push({ OR: or })
  }
  return and.length ? { AND: and } : {}
}
