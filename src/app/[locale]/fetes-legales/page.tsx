import Link from 'next/link'
import type { Metadata } from 'next'
import { dictFor } from '@/lib/i18n/server'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { AgoraHolidayCalendar } from '@/components/AgoraHolidayCalendar'
import { CALENDRIER_COURANT, type EntreeCalendrier } from '@/lib/delais/feries'
import { chargerCalendrier, versionCalendrierCourante } from '@/lib/delais/service-base'
import { aujourdhuiHaiti, PREMIERE_ANNEE_PUBLIQUE } from '@/lib/agora-holidays'
import '@/components/agora-portal.css'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { locale: string } }): Metadata {
  return {
    title:
      params.locale === 'en'
        ? 'Agora — Haitian public holidays'
        : params.locale === 'ht'
          ? 'Agora — Jou ferye ayisyen yo'
          : 'Agora — Fêtes légales haïtiennes',
  }
}

/**
 * Le calendrier que le calculateur de délais applique : la version courante EN BASE (une
 * édition de l'administration s'y voit), et le calendrier du code si la base ne répond pas —
 * une page d'information publique ne tombe pas pour autant.
 */
async function calendrierPublic(): Promise<readonly EntreeCalendrier[]> {
  try {
    const version = await versionCalendrierCourante()
    const lu = version == null ? null : await chargerCalendrier(version)
    if (lu?.ok) return lu.entrees
  } catch {
    /* base injoignable : repli ci-dessous */
  }
  return CALENDRIER_COURANT
}

export default async function HolidaysPage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  const tr = (fr: string, en: string, ht: string) => (locale === 'en' ? en : locale === 'ht' ? ht : fr)
  const year = Math.max(PREMIERE_ANNEE_PUBLIQUE, aujourdhuiHaiti().y)
  const entrees = await calendrierPublic()
  return (
    <div className="agora-portal">
      <a className="ag-skip" href="#agora-main">{tr('Aller au contenu', 'Skip to content', 'Ale nan kontni an')}</a>
      <header className="ag-header">
        <div className="ag-container ag-header-inner">
          <Link href={`/${locale}`} className="ag-brand" aria-label={tr('Agora — accueil', 'Agora — home', 'Agora — akèy')}>
            {/* eslint-disable-next-line @next/next/no-img-element -- logotype du kit, PNG réduit (voir Logo.tsx) */}
            <img src="/brand/agora/logo.png" alt="agora.ht" width="190" height="63" />
          </Link>
          <nav className="ag-nav" aria-label={tr('Navigation principale', 'Main navigation', 'Navigasyon prensipal')}>
            <Link href={`/${locale}/juridictions`}>{tr('Carte judiciaire', 'Judicial map', 'Kat jidisyè')}</Link>
            <Link href={`/${locale}#jours-francs`}>{tr('Jours francs', 'Clear days', 'Jou fran')}</Link>
            <Link href={`/${locale}#presentation`}>{tr('Présentation', 'About the map', 'Prezantasyon')}</Link>
            <Link href={`/${locale}/fetes-legales`} aria-current="page">{tr('Fêtes légales', 'Public holidays', 'Jou ferye')}</Link>
          </nav>
          <div className="ag-header-actions">
            <div className="ag-language"><LocaleSwitcher current={locale} /></div>
            <Link href={`/${locale}/login`} className="ag-button ag-login">{tr('Accès sécurisé', 'Secure access', 'Aksè sekirize')}</Link>
          </div>
        </div>
      </header>
      <main id="agora-main">
        <AgoraHolidayCalendar locale={locale} initialYear={year} entrees={entrees} />
      </main>
      <footer className="ag-footer">
        <div className="ag-container">
          <div className="ag-footer-bottom">
            <span>© {year} Agora</span>
            <Link href={`/${locale}`}>{tr('Retour à l’accueil', 'Back to home', 'Retounen nan akèy la')}</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
