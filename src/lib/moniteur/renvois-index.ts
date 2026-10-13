import { prisma } from '../db'

/**
 * Renvois entre l'INDEX du Moniteur et les ÉDITIONS (fascicules scannés et transcrits).
 *
 * Une entrée d'Index désigne un acte publié dans un fascicule ; la fiche d'Édition porte le
 * fac-similé et la transcription de ce fascicule. Les deux se rejoignent par la référence
 * (`number`) — mais pas à la lettre :
 *
 * ⚠️ DEUX ÉCRITURES DU MÊME FASCICULE. L'Index d'origine colle le suffixe (« LM2020-99A »,
 * parfois en minuscule : « LM2016-99b ») ; les Éditions le détachent (« LM2020-99-A »,
 * « LM2025-SP12-A1 »). Comparées à la lettre, la moitié des renvois mourraient. On compare donc
 * la référence sans tirets ni casse, dans le seul millésime (`source` = MONITEUR_PDF_{année}).
 */
export function cleFascicule(number: string): string {
  return number.toUpperCase().replace(/-/g, '')
}

function annee(number: string): string | null {
  return /^LM(\d{4})/i.exec(number)?.[1] ?? null
}

/** La fiche d'Édition (fascicule) qui publie l'acte d'une entrée d'Index, ou null si non numérisée. */
export async function editionDuFascicule(number: string | null | undefined): Promise<{ id: string; number: string } | null> {
  const an = number ? annee(number) : null
  if (!number || !an) return null
  const rows = await prisma.$queryRaw<{ id: string; number: string }[]>`
    SELECT id, number FROM "Document"
    WHERE type = 'LEGISLATION' AND source = ${`MONITEUR_PDF_${an}`}
      AND upper(replace(number, '-', '')) = ${cleFascicule(number)}
    LIMIT 1`
  return rows[0] ?? null
}

/**
 * Les entrées d'Index (actes publiés) d'un fascicule d'Édition.
 * Bornes d'intervalle plutôt que `LIKE 'LM2025%'` : l'index sur `number` les sert (2 ms au lieu de 21).
 */
export async function actesDuFascicule(number: string | null | undefined): Promise<{ id: string; titleFr: string; category: string | null }[]> {
  const an = number ? annee(number) : null
  if (!number || !an) return []
  return prisma.$queryRaw<{ id: string; titleFr: string; category: string | null }[]>`
    SELECT id, "titleFr", category FROM "Document"
    WHERE type = 'INDEX' AND number >= ${`LM${an}`} AND number < ${`LM${Number(an) + 1}`}
      AND upper(replace(number, '-', '')) = ${cleFascicule(number)}
    ORDER BY "createdAt", "titleFr"
    LIMIT 300`
}
