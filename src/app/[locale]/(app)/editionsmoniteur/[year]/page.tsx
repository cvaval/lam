import { notFound, redirect } from 'next/navigation'
import { dictFor } from '@/lib/i18n/server'
import { requireUser } from '@/lib/auth/guard'
import { canReadService } from '@/lib/access'
import { prisma } from '@/lib/db'
import { LegislationYearView } from '@/components/LegislationYearView'

export const dynamic = 'force-dynamic'

// « LM2025-1 » → {num:1}, « LM2025-SP70B » → {special, num:70, suffix:'B'}.
function parseNum(number: string): { special: boolean; num: number; suffix: string } {
  const special = /-SP/i.test(number)
  const m = number.match(/-(?:SP)?(\d+)\s*([A-Za-z]*)$/i)
  return { special, num: m ? Number(m[1]) : 0, suffix: m && m[2] ? m[2].toUpperCase() : '' }
}

export default async function LegislationYearPage({ params }: { params: { locale: string; year: string } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireUser(locale)
  if (!canReadService(user, 'LEGISLATION')) redirect(`/${locale}/dashboard`)

  const year = Number(params.year)
  if (!Number.isInteger(year) || year < 1800 || year > 3000) notFound()

  // Projection légère (jamais le corps) : on ne lit que l'identité de l'édition.
  const docs = await prisma.document.findMany({
    where: { source: `MONITEUR_PDF_${year}` },
    select: { id: true, titleFr: true, number: true, publicationDate: true },
  })
  if (!docs.length) notFound()

  // Ventilation par mois, puis tri des éditions (régulières d'abord, par numéro).
  const byMonth = new Map<number, typeof docs>()
  for (const d of docs) {
    const m = d.publicationDate ? d.publicationDate.getUTCMonth() : 0
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)!.push(d)
  }
  const months = [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([idx, list]) => ({
      idx,
      editions: list
        .map((d) => {
          const p = parseNum(d.number ?? '')
          return {
            id: d.id,
            title: d.titleFr,
            number: d.number ?? '',
            dateISO: d.publicationDate ? d.publicationDate.toISOString().slice(0, 10) : null,
            special: p.special,
            num: p.num,
            suffix: p.suffix,
          }
        })
        .sort((a, b) => Number(a.special) - Number(b.special) || a.num - b.num || a.suffix.localeCompare(b.suffix)),
    }))

  return <LegislationYearView locale={locale} year={year} months={months} />
}
