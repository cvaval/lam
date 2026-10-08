import Link from 'next/link'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { Locale } from '@/lib/types'
import { CALENDRIER_COURANT } from '@/lib/delais/feries'
import { dateEnToutesLettres } from '@/lib/delais/format'
import { aujourdhuiHaiti, prochaineFete } from '@/lib/agora-holidays'

/**
 * « Prochain repère du calendrier » sur l'accueil. L'accueil ne lit pas la base
 * (`Landing.test.tsx`) : on lit donc le calendrier COURANT du code, celui que la graine a
 * versé en base et que le calculateur applique — pas une liste à part.
 */
export function AgoraNextHoliday({ locale }: { locale: Locale }) {
  const tr = (fr: string, en: string, ht: string) => (locale === 'en' ? en : locale === 'ht' ? ht : fr)
  const fete = prochaineFete(CALENDRIER_COURANT, aujourdhuiHaiti(), locale)
  if (!fete) return null
  return (
    <aside className="ag-next-holiday ag-container">
      <CalendarDays size={27} aria-hidden="true" />
      <div>
        <p className="ag-eyebrow">{tr('Prochaine fête légale', 'Next public holiday', 'Pwochen jou ferye')}</p>
        <h2>{fete.libelle}</h2>
        <p>
          {dateEnToutesLettres(fete.date, locale)}
          {fete.demiJournee && (
            <span className="ag-decree-note"> · {tr('demi-journée', 'half day', 'mwatye jounen')}</span>
          )}
        </p>
      </div>
      <Link className="ag-text-link" href={`/${locale}/fetes-legales`}>
        {tr('Voir le calendrier', 'View calendar', 'Gade kalandriye a')}
        <ChevronRight size={17} aria-hidden="true" />
      </Link>
    </aside>
  )
}
