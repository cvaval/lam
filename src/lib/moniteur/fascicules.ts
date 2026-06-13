import { prisma } from '../db'
import { parseEditionRef } from './gaps'

/**
 * Fascicules PDF manquants d'une année — distinct des « numéros manquants ».
 *
 *  - Numéros manquants (gaps.ts) : références qu'AUCUNE source ne connaît (trous
 *    internes de la séquence) → éditions dont on ignore l'existence.
 *  - Fascicules PDF manquants (ici) : références CONNUES (présentes dans l'Index
 *    ou dans le catalogue scanné) dont le PDF n'a PAS encore été importé, c.-à-d.
 *    sans document de source MONITEUR_PDF_{année}. C'est le « il me manque ce
 *    scan » d'une année incomplète.
 *
 * N'a de sens que pour une année où des scans ont été importés (catalogue non
 * vide) : sinon on retourne null (indicateur non applicable).
 */
export interface MissingFascicule {
  ref: string
  special: boolean
}

export interface FasciculeStatus {
  /** nombre de fascicules PDF importés (source MONITEUR_PDF_{année}) */
  imported: number
  /** éditions connues sans PDF importé, triées */
  missing: MissingFascicule[]
}

export async function loadMissingFascicules(year: number): Promise<FasciculeStatus | null> {
  const source = `MONITEUR_PDF_${year}`
  const gte = new Date(Date.UTC(year, 0, 1))
  const lt = new Date(Date.UTC(year + 1, 0, 1))

  const [catalogue, known] = await Promise.all([
    prisma.document.findMany({ where: { source }, select: { number: true } }),
    // Toutes les références distinctes connues pour l'année (toutes sources).
    prisma.document.findMany({
      where: { number: { startsWith: `LM${year}-` }, publicationDate: { gte, lt } },
      select: { number: true },
      distinct: ['number'],
    }),
  ])

  if (catalogue.length === 0) return null // aucune édition scannée pour cette année

  const refKey = (n: string) => {
    const p = parseEditionRef(n)
    return p ? `${p.special ? 'SP' : 'R'}-${p.num}-${p.suffix ?? ''}` : null
  }

  const withPdf = new Set<string>()
  for (const d of catalogue) {
    const k = refKey(d.number ?? '')
    if (k) withPdf.add(k)
  }

  // Une édition est « connue » via n'importe quelle source ; manquante si aucun PDF.
  const seen = new Set<string>()
  const missing: MissingFascicule[] = []
  for (const d of known) {
    const p = parseEditionRef(d.number ?? '')
    if (!p) continue
    const k = `${p.special ? 'SP' : 'R'}-${p.num}-${p.suffix ?? ''}`
    if (seen.has(k) || withPdf.has(k)) continue
    seen.add(k)
    missing.push({ ref: d.number!, special: p.special })
  }

  missing.sort((a, b) => {
    const pa = parseEditionRef(a.ref)!
    const pb = parseEditionRef(b.ref)!
    return Number(pa.special) - Number(pb.special) || pa.num - pb.num || (pa.suffix ?? '').localeCompare(pb.suffix ?? '')
  })

  return { imported: withPdf.size, missing }
}
