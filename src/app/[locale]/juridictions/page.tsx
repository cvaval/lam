import Link from 'next/link'
import type { Metadata } from 'next'
import { PublicHeader } from '@/components/PublicHeader'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { CookieBanner } from '@/components/CookieBanner'
import { dictFor } from '@/lib/i18n/server'
import { isLocale, LOCALES } from '@/lib/types'
import { getCommuneRecord, getCommuneDirectory, type CommuneRecord } from '@/lib/jurisdictions/data'
import { ALL_LAYER_SLUGS, type LayerSlug } from '@/lib/jurisdictions/constants'
import { JudicialSearch } from '@/components/jurisdictions/JudicialSearch'
import { JudicialFilters } from '@/components/jurisdictions/JudicialFilters'
import { JudicialResults } from '@/components/jurisdictions/JudicialResults'
import { MapLegend } from '@/components/jurisdictions/MapLegend'
import { JudicialMapClient } from '@/components/jurisdictions/JudicialMapClient'
import { MobileResultsSheet } from '@/components/jurisdictions/MobileResultsSheet'

export const dynamic = 'force-dynamic'

/**
 * Carte judiciaire d'Haïti — page PUBLIQUE (hors groupe authentifié (app)).
 * La carte est un complément visuel : la totalité de l'information existe en
 * texte (fiche + liste complète des communes), utilisable sans JavaScript.
 * L'URL porte l'état (?commune=…&layers=…) — partageable, historique naturel.
 */

const COMMUNE_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

function readParams(searchParams: { commune?: string | string[]; layers?: string | string[] }) {
  const rawCommune = Array.isArray(searchParams.commune) ? searchParams.commune[0] : searchParams.commune
  const commune = rawCommune && COMMUNE_RE.test(rawCommune) ? rawCommune : null
  const rawLayers = Array.isArray(searchParams.layers) ? searchParams.layers[0] : searchParams.layers
  let layers: LayerSlug[] = [...ALL_LAYER_SLUGS]
  if (rawLayers != null && rawLayers.length <= 60) {
    const asked = rawLayers.split(',').filter((s): s is LayerSlug => (ALL_LAYER_SLUGS as string[]).includes(s))
    if (asked.length) layers = [...new Set(asked)]
  }
  return { commune, layers }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { commune?: string | string[] }
}): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const { commune } = readParams(searchParams)
  const record = commune ? await getCommuneRecord(commune) : null
  const title = record ? `${record.commune.name} — ${t.judicial.metaTitle}` : t.judicial.metaTitle
  const languages = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/juridictions`]))
  return {
    title,
    description: t.judicial.metaDescription,
    alternates: { canonical: `/${locale}/juridictions`, languages: { ...languages, 'x-default': '/fr/juridictions' } },
  }
}

export default async function JuridictionsPage({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: { commune?: string | string[]; layers?: string | string[] }
}) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const { commune, layers } = readParams(searchParams)
  const [record, directory] = await Promise.all([
    commune ? getCommuneRecord(commune) : Promise.resolve(null),
    getCommuneDirectory(),
  ])
  const notFound = Boolean(commune && !record)
  const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || 'Limites administratives : CNIGS / OCHA (COD-AB Haïti, CC BY-IGO)'
  const reportIssueUrl = process.env.NEXT_PUBLIC_MAP_REPORT_ISSUE_URL || 'https://www.openstreetmap.org/fixthemap'
  const layersQs = layers.length === ALL_LAYER_SLUGS.length ? '' : `&layers=${layers.join(',')}`

  const resultsPanel = (
    <section aria-label={t.judicial.resultsRegion} className="flex min-w-0 flex-col gap-4">
      {notFound && (
        <p role="status" className="rounded-xl border border-chabon/40 bg-pil px-4 py-3 text-sm text-ank/80">
          {t.judicial.notFoundCommune}
        </p>
      )}
      {record ? (
        <JudicialResults record={record} locale={locale} t={t} />
      ) : (
        !notFound && <p className="rounded-xl border border-chabon/10 bg-white px-4 py-3 text-sm text-grafit">{t.judicial.selectPrompt}</p>
      )}
      <p className="text-xs leading-relaxed text-ank/80">{t.judicial.disclaimer}</p>
    </section>
  )

  return (
    <div className="min-h-screen bg-koton">
      <PublicHeader locale={locale} t={t} width="max-w-7xl" />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-6">
        <nav aria-label="Fil d’Ariane" className="text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center transition hover:text-chabon hover:underline">{t.judicial.breadcrumbHome}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ank">{t.judicial.breadcrumbHere}</li>
          </ol>
        </nav>

        <h1 className="mt-3 font-serif text-3xl font-semibold text-ank lg:text-4xl">{t.judicial.title}</h1>
        <p className="mt-2 max-w-3xl leading-relaxed text-grafit">{t.judicial.intro}</p>

        <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <JudicialSearch locale={locale} t={t} layersQs={layersQs} />
          <JudicialFilters locale={locale} t={t} active={layers} commune={record?.commune.id ?? null} />
        </div>

        {/* Ordinateur : panneau (380–440 px) + carte. Mobile : carte puis feuille de résultats. */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(380px,440px)_minmax(0,1fr)] lg:items-start">
          <div className="order-2 hidden lg:block">
            <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">{resultsPanel}</div>
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <div className="overflow-hidden rounded-2xl border border-chabon/10 bg-white">
              <JudicialMapClient
                locale={locale}
                selectedCommuneId={record?.commune.id ?? null}
                layers={layers}
                attribution={attribution}
                loadingLabel={t.judicial.loadingMap}
                fallback={
                  <div className="p-6">
                    <p className="text-sm leading-relaxed text-grafit">{t.judicial.mapFallback}</p>
                  </div>
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-chabon/10 bg-koton px-3 py-2">
                <p className="text-[11px] text-ank/80">
                  <span className="font-medium">{t.judicial.attributionLabel} :</span> {attribution}
                </p>
 <a href={reportIssueUrl} target="_blank"rel="noopener noreferrer"className="inline-flex min-h-[44px] items-center text-[11px] font-medium text-ank underline underline-offset-2 transition hover:text-chabon">
                  {t.judicial.reportIssue}
                </a>
              </div>
            </div>
            <p className="mt-2 text-sm text-ank/80">{t.judicial.mapUsage}</p>
            <MapLegend t={t} />

            {/* Mobile : résultats dans une feuille repliable sous la carte. */}
            <div className="mt-4 lg:hidden">
              <MobileResultsSheet label={t.judicial.resultsRegion} defaultOpen={Boolean(record) || notFound}>
                {resultsPanel}
              </MobileResultsSheet>
            </div>
          </div>
        </div>

        {/* Liste textuelle COMPLÈTE et accessible (la carte n'est jamais le seul accès). */}
        <section className="mt-10" aria-label={t.judicial.communeList}>
          <details className="rounded-2xl border border-chabon/10 bg-white" open={!record}>
            <summary className="cursor-pointer px-5 py-4 font-serif text-lg font-semibold text-ank">
              {t.judicial.communeList} ({directory.length})
            </summary>
            <div className="grid gap-x-8 gap-y-1 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              {directory.map((c) => (
                <Link
                  key={c.id}
                  href={`/${locale}/juridictions?commune=${c.id}${layersQs}`}
                  aria-current={c.id === record?.commune.id ? 'page' : undefined}
 className={`flex min-h-[44px] items-center justify-between gap-2 rounded-lg px-2 text-sm transition hover:bg-pil ${c.id === record?.commune.id ? 'bg-pil font-semibold text-ank' : 'text-ank/80'}`}
                >
                  <span>
                    {c.name}
                    <span className="ml-1.5 text-xs text-ank/80">{c.department}</span>
                    {!c.boundaryConfirmed && <span className="ml-1.5 text-[10px] text-chabon">({t.judicial.boundaryUnconfirmed})</span>}
                  </span>
                  {c.postalCode && <span className="font-mono text-xs text-ank/80">{c.postalCode}</span>}
                </Link>
              ))}
            </div>
          </details>
        </section>
      </main>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ank/80">
          <span>© 2026 Lam</span>
          <nav className="flex gap-4">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
          </nav>
        </div>
      </footer>

      <CookieBanner
        text={locale === 'en'
          ? 'Lam uses strictly necessary cookies (session, authentication, language). With your consent, analytics cookies help us improve the Platform.'
          : locale === 'ht'
            ? 'Lam itilize cookies ki estrikteman nesesè (sesyon, otantifikasyon, lang). Ak akò ou, cookies analiz ede nou amelyore Platfòm nan.'
            : "Lam utilise des cookies strictement nécessaires (session, authentification, langue). Avec votre accord, des cookies d'analyse nous aident à améliorer la Plateforme."}
        accept={locale === 'en' ? 'Accept all' : locale === 'ht' ? 'Aksepte tout' : 'Tout accepter'}
        reject={locale === 'en' ? 'Reject non-essential' : locale === 'ht' ? 'Refize sa ki pa esansyèl' : 'Refuser les non essentiels'}
        manage={locale === 'en' ? 'Manage' : locale === 'ht' ? 'Jere' : 'Gérer'}
        manageHref={`/${locale}/confidentialite#s9`}
      />
    </div>
  )
}

export type { CommuneRecord }
