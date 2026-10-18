import Link from 'next/link'
import type { Metadata } from 'next'
import { AgoraPublicHeader } from '@/components/AgoraPublicHeader'
import '@/components/agora-portal.css'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import { CookieBanner } from '@/components/CookieBanner'
import { dictFor } from '@/lib/i18n/server'
import { isLocale, LOCALES } from '@/lib/types'
import { getCommuneRecord, getCommuneDirectory, type CommuneRecord } from '@/lib/jurisdictions/data'
import { parseLayersPour, serializeLayersPour, type VueCarte } from '@/lib/jurisdictions/layers'
import { lireParamsAnnuaire } from '@/lib/jurisdictions/annuaire-notaires'
import { chargerAnnuaire } from '@/lib/jurisdictions/annuaire-chargement'
import { attributionsCarte } from '@/lib/jurisdictions/fond-de-rues'
import { JudicialSearch } from '@/components/jurisdictions/JudicialSearch'
import { JudicialFilters } from '@/components/jurisdictions/JudicialFilters'
import { JudicialResults } from '@/components/jurisdictions/JudicialResults'
import { demandesOuvertes } from '@/lib/jurisdictions/notaires-demandes'
import { MapLegend } from '@/components/jurisdictions/MapLegend'
import { JudicialMapClient } from '@/components/jurisdictions/JudicialMapClient'
import { MobileResultsSheet } from '@/components/jurisdictions/MobileResultsSheet'
import { JudicialTabs } from '@/components/jurisdictions/JudicialTabs'
import { NotaryAnnuaireView, type EtatAnnuaire } from '@/components/jurisdictions/NotaryAnnuaireView'
import { FicheNotaireModale } from '@/components/jurisdictions/FicheNotaireModale'
import { libellesModale } from '@/components/jurisdictions/fiche-libelles'
import { ficheInitiale, metadonneesFiche } from '@/lib/jurisdictions/fiche-chargement'

export const dynamic = 'force-dynamic'

/**
 * Carte judiciaire et notaires — page PUBLIQUE (hors groupe authentifié (app)), DEUX onglets :
 *  - « Juridictions » (défaut) : la carte des tribunaux et la fiche de la commune ;
 *  - « Notaires » (`?vue=notaires`) : la même carte, à gauche, et l'« Annuaire des notaires »
 *    (recherche, juridiction, commune choisie sur la carte, pages) — `NotaryAnnuaireView`.
 * La carte est un complément visuel : la totalité de l'information existe en texte (fiche,
 * annuaire, liste complète des communes), utilisable sans JavaScript. L'URL porte l'état
 * (?vue=…&commune=…&layers=…&q=…&juridiction=…&page=…) — partageable, historique naturel.
 * `&notaire=<id>` : la fiche d'un notaire, en fenêtre modale au-dessus de la carte ou de
 * l'annuaire (`FicheNotaireModale`) — le lien personnalisé des courriels (`lienFicheNotaire`).
 */

const COMMUNE_RE = /^[a-z0-9][a-z0-9-]{2,119}$/

type SP = Record<string, string | string[] | undefined>
const premier = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

function readParams(searchParams: SP) {
  const vue: VueCarte = premier(searchParams.vue) === 'notaires' ? 'notaires' : 'juridictions'
  const rawCommune = premier(searchParams.commune)
  const commune = rawCommune && COMMUNE_RE.test(rawCommune) ? rawCommune : null
  // Le registre est le SEUL lecteur de `?layers=` (absent ⇒ défaut DE L'ONGLET, vide ⇒ aucune couche).
  return { vue, commune, layers: parseLayersPour(vue, premier(searchParams.layers)) }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { locale: string }
  searchParams: SP
}): Promise<Metadata> {
  const { locale, t } = dictFor(params.locale)
  const fiche = await metadonneesFiche(searchParams.notaire, locale, t)
  if (fiche) return fiche
  const { vue, commune } = readParams(searchParams)
  if (vue === 'notaires') {
    // L'annuaire est une page à part entière, indexable sous sa propre adresse canonique.
    const langues = Object.fromEntries(LOCALES.map((l) => [l, `/${l}/juridictions?vue=notaires`]))
    return {
      title: t.judicial.annuaireMetaTitle,
      description: t.judicial.annuaireMetaDescription,
      alternates: { canonical: `/${locale}/juridictions?vue=notaires`, languages: { ...langues, 'x-default': '/fr/juridictions?vue=notaires' } },
    }
  }
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
  searchParams: SP
}) {
  const { locale, t } = dictFor(isLocale(params.locale) ? params.locale : 'fr')
  const { vue, commune, layers } = readParams(searchParams)
  const enNotaires = vue === 'notaires'
  // La mention OpenStreetMap (ODbL) s'ajoute TOUJOURS : la variable ne remplace que celle des limites.
  const attribution = attributionsCarte(process.env.NEXT_PUBLIC_MAP_ATTRIBUTION).join(' · ')
  const reportIssueUrl = process.env.NEXT_PUBLIC_MAP_REPORT_ISSUE_URL || 'https://www.openstreetmap.org/fixthemap'
  const layersParam = serializeLayersPour(vue, layers)
  const layersQs = layersParam === null ? '' : `&layers=${layersParam}`
  const popupLabels = {
    notaryCountOne: t.judicial.notaryCountOne,
    notaryCountMany: t.judicial.notaryCountMany,
    seeList: enNotaires ? t.judicial.annuaireTitle : t.judicial.notaryPopupSeeList,
  }
  const mapFallback = (
    <div className="p-6">
      <p className="text-sm leading-relaxed text-grafit">{t.judicial.mapFallback}</p>
    </div>
  )
  const attributionRow = (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-chabon/10 bg-koton px-3 py-2">
      <p className="text-[11px] text-ank/80">
        <span className="font-medium">{t.judicial.attributionLabel} :</span> {attribution}
      </p>
      <a href={reportIssueUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-[11px] font-medium text-ank underline underline-offset-2 transition hover:text-chabon">
        {t.judicial.reportIssue}
      </a>
    </div>
  )

  // Fiche demandée par l'URL (lien direct, courriel) : rendue d'emblée, au-dessus de la page.
  const initialFiche = await ficheInitiale(searchParams.notaire)

  // ── Onglet « Notaires » : l'annuaire ne charge ni la fiche d'une commune ni la liste des 149.
  let annuaire: { etat: EtatAnnuaire; params: ReturnType<typeof lireParamsAnnuaire>; notFound: boolean } | null = null
  if (enNotaires) {
    // Même chargement que la page d'annuaire ; une PANNE n'est jamais présentée comme une liste vide.
    const r = await chargerAnnuaire(lireParamsAnnuaire(searchParams))
    annuaire = { etat: r.etat, params: r.params, notFound: r.communeInconnue }
  }

  const [record, directory] = enNotaires
    ? [null, null]
    : await Promise.all([commune ? getCommuneRecord(commune) : Promise.resolve(null), getCommuneDirectory()])
  const notFound = enNotaires ? Boolean(annuaire?.notFound) : Boolean(commune && !record)
  const communeChoisie = enNotaires ? annuaire?.params.commune ?? null : record?.commune.id ?? null

  const resultsPanel = (
    <section aria-label={t.judicial.resultsRegion} className="flex min-w-0 flex-col gap-4">
      {notFound && (
        <p role="status" className="rounded-xl border border-chabon/40 bg-pil px-4 py-3 text-sm text-ank/80">
          {t.judicial.notFoundCommune}
        </p>
      )}
      {record ? (
        <JudicialResults record={record} locale={locale} t={t} demandes={demandesOuvertes()} />
      ) : (
        !notFound && <p className="rounded-xl border border-chabon/10 bg-white px-4 py-3 text-sm text-grafit">{t.judicial.selectPrompt}</p>
      )}
      <p className="text-xs leading-relaxed text-ank/80">{t.judicial.disclaimer}</p>
    </section>
  )

  return (
    <div className="agora-portal ag-judicial-page min-h-screen bg-koton">
      <AgoraPublicHeader locale={locale} />

      <main className="mx-auto max-w-none px-4 pb-16 pt-6 md:px-[clamp(24px,4vw,96px)]">
        <nav aria-label="Fil d’Ariane" className="text-sm text-ank/80">
          <ol className="flex flex-wrap items-center gap-1.5">
            <li><Link href={`/${locale}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center transition hover:text-chabon hover:underline">{t.judicial.breadcrumbHome}</Link></li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-ank">{t.judicial.breadcrumbHere}</li>
          </ol>
        </nav>

        <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-chabon lg:text-4xl">{t.judicial.pageTitle}</h1>
            <p className="mt-2 max-w-3xl leading-relaxed text-[#52656B]">{t.judicial.pageIntro}</p>
          </div>
          {/* Accès PERMANENT à l'annuaire : visible sans couche ni clic sur la carte. */}
          <Link
            href={`/${locale}/juridictions?vue=notaires#ag-annuaire`}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-2 self-start rounded-lg bg-chabon px-4 text-sm font-medium text-white transition hover:bg-chabon/90 lg:self-auto"
          >
            {t.judicial.annuaireTitle} <span aria-hidden="true">→</span>
          </Link>
        </div>

        <JudicialTabs locale={locale} t={t} vue={vue} commune={communeChoisie} />

        {enNotaires && annuaire ? (
          <>
            {notFound && (
              <p role="status" className="mt-4 rounded-xl border border-chabon/40 bg-pil px-4 py-3 text-sm text-ank/80">
                {t.judicial.notFoundCommune}
              </p>
            )}
            <NotaryAnnuaireView
              locale={locale}
              t={t}
              etat={annuaire.etat}
              params={annuaire.params}
              layersParam={layersParam}
              carteOuverte={premier(searchParams.carte) === '1'}
              map={{
                locale,
                selectedCommuneId: annuaire.params.commune,
                layers,
                attribution,
                loadingLabel: t.judicial.loadingMap,
                popupLabels,
                fallback: mapFallback,
              }}
              couches={
                <JudicialFilters
                  locale={locale}
                  t={t}
                  active={layers}
                  commune={annuaire.params.commune}
                  vue="notaires"
                  conserver={{ q: annuaire.params.q, juridiction: annuaire.params.juridiction }}
                />
              }
              pied={
                <>
                  {attributionRow}
                  <div className="border-t border-chabon/10 px-3 pb-2"><MapLegend t={t} active={layers} /></div>
                </>
              }
            />
          </>
        ) : (
          <>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-grafit">{t.judicial.intro}</p>
          <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <JudicialSearch locale={locale} t={t} layersQs={layersQs} />
            <JudicialFilters locale={locale} t={t} active={layers} commune={record?.commune.id ?? null} />
          </div>

          <nav className="ag-map-shortcuts" aria-label={locale === 'en' ? 'Map navigation' : locale === 'ht' ? 'Navigasyon kat la' : 'Navigation de la carte'}><a href="#ag-judicial-map">{locale === 'en' ? 'Map' : locale === 'ht' ? 'Kat' : 'Carte'}</a><a href="#ag-commune-list">{locale === 'en' ? 'Commune list' : locale === 'ht' ? 'Lis komin yo' : 'Liste des communes'}</a><Link href={`/${locale}/juridictions/notaires`}><span aria-hidden="true" className="mr-1.5">👤</span>{t.judicial.notariesByJurisdiction}</Link></nav>
          {/* Ordinateur : panneau (380–440 px) + carte. Mobile : carte puis feuille de résultats. */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(380px,440px)_minmax(0,1fr)] lg:items-start">
            <div className="order-2 hidden lg:block">
              <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-1">{resultsPanel}</div>
            </div>

            <div id="ag-judicial-map" className="order-1 min-w-0 lg:order-2">
              <div className="overflow-hidden rounded-2xl border border-chabon/10 bg-white">
                <JudicialMapClient
                  locale={locale}
                  selectedCommuneId={record?.commune.id ?? null}
                  layers={layers}
                  attribution={attribution}
                  loadingLabel={t.judicial.loadingMap}
                  popupLabels={popupLabels}
                  fallback={mapFallback}
                />
                {attributionRow}
              </div>
              <p className="mt-2 text-sm text-ank/80">{t.judicial.mapUsage}</p>
              <MapLegend t={t} active={layers} />

              {/* Mobile : résultats dans une feuille repliable sous la carte. */}
              <div className="mt-4 lg:hidden">
                <MobileResultsSheet label={t.judicial.resultsRegion} defaultOpen={Boolean(record) || notFound}>
                  {resultsPanel}
                </MobileResultsSheet>
              </div>
            </div>
          </div>

          {/* Liste textuelle COMPLÈTE et accessible (la carte n'est jamais le seul accès). */}
          <section id="ag-commune-list" className="mt-10" aria-label={t.judicial.communeList}>
            <details className="rounded-2xl border border-chabon/10 bg-white" open={!record}>
              <summary className="cursor-pointer px-5 py-4 font-serif text-lg font-semibold text-ank">
                {t.judicial.communeList} ({directory?.length ?? 0})
              </summary>
              <div className="grid gap-x-8 gap-y-1 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
                {(directory ?? []).map((c) => (
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
          </>
        )}
      </main>

      <footer className="border-t border-chabon/10 bg-white">
        <div className="mx-auto flex max-w-none flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-ank/80 md:px-[clamp(24px,4vw,96px)]">
          <span>© 2026 Agora</span>
          <nav className="flex flex-wrap gap-x-4">
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/cgu`}>{t.legal.cgu}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/confidentialite`}>{t.legal.confidentialite}</Link>
            <Link className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href={`/${locale}/mentions-legales`}>{t.legal.mentions}</Link>
            <a className="inline-flex min-h-[44px] items-center transition hover:text-chabon" href="mailto:legal@agora.ht">legal@agora.ht</a>
          </nav>
        </div>
      </footer>

      <FicheNotaireModale
        locale={locale} l={libellesModale(t)} demandes={demandesOuvertes()} contexte={enNotaires ? 'onglet' : 'juridictions'} initial={initialFiche}
        titres={{
          page: enNotaires ? t.judicial.annuaireMetaTitle : record ? `${record.commune.name} — ${t.judicial.metaTitle}` : t.judicial.metaTitle,
          fiche: t.judicial.notaryMetaTitle,
        }}
      />

      <CookieBanner
        text={t.cookies.text}
        accept={t.cookies.accept}
        reject={t.cookies.reject}
        manage={t.cookies.manage}
        manageHref={`/${locale}/confidentialite#s9`}
      />
    </div>
  )
}

export type { CommuneRecord }
