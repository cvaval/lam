import Link from 'next/link'
import { MapPin } from 'lucide-react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import type { NotaryAnnuaire } from '@/lib/jurisdictions/data'
import { compte } from '@/lib/jurisdictions/notaires-format'
import { mentionAsPrinted } from '@/lib/jurisdictions/notaires-source'
import {
  filtresActifs, paginerAnnuaire, qsAnnuaire, type AnnuaireEntry, type AnnuaireParams,
} from '@/lib/jurisdictions/annuaire-notaires'
import { AnnuaireFiltres } from './AnnuaireFiltres'
import { CarteNotaires } from './CarteNotaires'
import { notarySourceLine } from './NotariesSection'

/** Résultat du chargement : la PANNE n'est jamais confondue avec une liste vide. */
export type EtatAnnuaire =
  | { kind: 'ok'; annuaire: NotaryAnnuaire; trouves: Set<string> | null }
  | { kind: 'indisponible' }
  | { kind: 'erreur' }

type MapProps = React.ComponentProps<typeof CarteNotaires>['map']

const SAUGE = 'bg-[#E9EDE7]'

/**
 * Onglet « Notaires » de la carte judiciaire : la carte À GAUCHE et l'« Annuaire des notaires »
 * À DROITE sur ordinateur ; sur téléphone, l'annuaire d'abord et un bouton « Afficher la carte ».
 * L'état (recherche, juridiction, commune, page) est dans l'URL : partageable, conservé au retour
 * d'une fiche. Rendu serveur, lisible sans JavaScript.
 */
export function NotaryAnnuaireView({
  locale, t, etat, params, layersParam, map, couches, pied, carteOuverte,
}: {
  locale: Locale
  t: Dictionary
  etat: EtatAnnuaire
  params: AnnuaireParams
  /** `?layers=` explicite de l'onglet (null = défaut de l'onglet). */
  layersParam: string | null
  map: MapProps
  /** Filtres de couches et légende (serveur), posés avec la carte. */
  couches: React.ReactNode
  pied: React.ReactNode
  /** Téléphone : ouvrir la carte d'office (`?carte=1`, lien « Situer la commune sur la carte »). */
  carteOuverte: boolean
}) {
  const j = t.judicial
  const base = `/${locale}/juridictions`
  const extra = { layers: layersParam }
  const lien = (p: Partial<AnnuaireParams>, ancre = '#ag-annuaire-resultats') => `${base}?${qsAnnuaire(p, extra)}${ancre}`
  // La carte situe la COMMUNE (aucune étude n'est géolocalisée) ; sur téléphone, elle s'ouvre.
  const lienCarte = (communeId: string) => `${base}?${qsAnnuaire({ commune: communeId }, { ...extra, carte: '1' })}`
  const labelsCarte = { show: j.annuaireShowMap, hide: j.annuaireHideMap, region: j.annuaireMapLabel }
  const portee = <p className="text-xs leading-relaxed text-[#52656B]">{j.annuaireMapScope}</p>

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(400px,500px)] lg:items-start">
      {/* Ordinateur : la carte, à gauche, reste visible pendant qu'on parcourt l'annuaire. */}
      <div id="ag-carte-notaires" className="hidden scroll-mt-24 lg:sticky lg:top-24 lg:block">
        <CarteNotaires place="colonne" map={map} labels={labelsCarte} entete={couches} pied={pied} />
        <div className="mt-2">{portee}</div>
      </div>

      <section id="ag-annuaire" aria-labelledby="ag-annuaire-titre" className="flex min-w-0 scroll-mt-24 flex-col gap-4">
        <div className="rounded-xl border border-[#D7DCD7] bg-white p-4 sm:p-5">
          <h2 id="ag-annuaire-titre" className="font-serif text-2xl font-semibold text-chabon">
            <span aria-hidden="true" className="mr-2">👤</span>{j.annuaireTitle}
          </h2>
          <div className="mt-4">
            {etat.kind === 'ok' ? (
              <AnnuaireFiltres
                key={`${params.q}|${params.juridiction ?? ''}|${params.commune ?? ''}`}
                locale={locale}
                q={params.q}
                juridiction={params.juridiction}
                commune={params.commune}
                communeJuridiction={etat.annuaire.communes.find((c) => c.id === params.commune)?.jurisdictionId ?? null}
                juridictions={etat.annuaire.juridictions}
                layers={layersParam}
                labels={{
                  search: j.annuaireSearchLabel, placeholder: j.annuaireSearchPlaceholder, submit: j.annuaireSearchSubmit,
                  jurisdiction: j.annuaireJurisdictionLabel, all: j.annuaireAllJurisdictions, loading: j.annuaireLoading,
                }}
              />
            ) : null}
          </div>
          {etat.kind === 'ok' && <FiltresActifs locale={locale} t={t} params={params} annuaire={etat.annuaire} lien={lien} />}
        </div>

        {/* Téléphone : la carte sous un bouton, au-dessus des résultats. */}
        <div id="ag-carte-notaires-mobile" className="scroll-mt-24 lg:hidden">
          <CarteNotaires place="mobile" map={map} labels={labelsCarte} entete={couches} pied={pied} ouverteParDefaut={carteOuverte} cle={params.commune} />
          <div className="mt-2">{portee}</div>
        </div>

        <Resultats locale={locale} t={t} etat={etat} params={params} lien={lien} lienCarte={lienCarte} />
      </section>
    </div>
  )
}

function FiltresActifs({
  locale, t, params, annuaire, lien,
}: { locale: Locale; t: Dictionary; params: AnnuaireParams; annuaire: NotaryAnnuaire; lien: (p: Partial<AnnuaireParams>, ancre?: string) => string }) {
  const j = t.judicial
  const n = filtresActifs(params)
  if (!n) return null
  const nomJur = annuaire.juridictions.find((x) => x.id === params.juridiction)?.label ?? params.juridiction
  const nomCommune = annuaire.communes.find((x) => x.id === params.commune)?.name ?? params.commune
  const puce = (texte: string, href: string, accent = false) => (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-label={`${texte} — ${j.annuaireRemoveFilter}`}
        className={`inline-flex min-h-[36px] items-center gap-2 rounded-md border border-[#D7DCD7] px-3 text-[13px] text-chabon transition hover:border-chabon ${accent ? `${SAUGE} border-l-[3px] border-l-[#9B422C]` : 'bg-white'}`}
      >
        {texte} <span aria-hidden="true" className="text-[#52656B]">✕</span>
      </Link>
    </li>
  )
  return (
    <div className="mt-4 border-t border-[#D7DCD7] pt-3">
      <p className="text-[13px] font-medium text-chabon">{compte(n, locale, j.annuaireFiltersOne, j.annuaireFiltersMany)}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {params.commune && puce(j.annuaireFilterCommune.replace('{name}', nomCommune ?? ''), lien({ ...params, commune: null, page: 1 }), true)}
        {params.juridiction && puce(j.annuaireFilterJurisdiction.replace('{name}', nomJur ?? ''), lien({ ...params, juridiction: null, page: 1 }))}
        {params.q && puce(j.annuaireFilterSearch.replace('{q}', params.q), lien({ ...params, q: '', page: 1 }))}
      </ul>
      <p className="mt-2 flex flex-wrap gap-x-4">
        {params.commune && (
          <Link href={lien({})} scroll={false} className="inline-flex min-h-[44px] items-center text-sm font-medium text-chabon underline underline-offset-2 hover:text-[#9B422C]">
            {j.annuaireSeeAll}
          </Link>
        )}
        <Link href={lien({})} scroll={false} className="inline-flex min-h-[44px] items-center text-sm text-[#52656B] underline underline-offset-2 hover:text-[#9B422C]">
          {j.annuaireClearFilters}
        </Link>
      </p>
    </div>
  )
}

function Resultats({
  locale, t, etat, params, lien, lienCarte,
}: {
  locale: Locale; t: Dictionary; etat: EtatAnnuaire; params: AnnuaireParams
  lien: (p: Partial<AnnuaireParams>, ancre?: string) => string; lienCarte: (communeId: string) => string
}) {
  const j = t.judicial
  if (etat.kind === 'erreur') {
    return (
      <div id="ag-annuaire-resultats" role="alert" className="scroll-mt-24 rounded-xl border border-[#9B422C]/40 bg-white p-5">
        <p className="font-medium text-chabon">{j.annuaireErrorTitle}</p>
        <p className="mt-1 text-sm text-[#52656B]">{j.annuaireErrorBody}</p>
        <a href={lien(params, '')} className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-chabon px-4 text-sm font-medium text-white">
          {j.annuaireRetry}
        </a>
      </div>
    )
  }
  if (etat.kind === 'indisponible') {
    return <p id="ag-annuaire-resultats" role="status" className="rounded-xl border border-[#D7DCD7] bg-white px-4 py-3 text-sm text-[#52656B]">{j.notariesUnavailable}</p>
  }

  const { annuaire, trouves } = etat
  const liste = annuaire.entries.filter((e) =>
    (!trouves || trouves.has(e.id))
    && (!params.juridiction || e.jurisdictionId === params.juridiction)
    && (!params.commune || e.communeId === params.commune),
  )
  const page = paginerAnnuaire(liste, params.page)
  const parJuridiction = new Map<string, number>()
  for (const e of liste) parJuridiction.set(e.jurisdictionId ?? '', (parJuridiction.get(e.jurisdictionId ?? '') ?? 0) + 1)
  const pourFiche = qsAnnuaire({ ...params, page: page.page })

  return (
    <div id="ag-annuaire-resultats" className="flex scroll-mt-24 flex-col gap-4">
      {/* Région annoncée : son texte change à chaque mise à jour de la liste. */}
      <p role="status" aria-live="polite" className="text-sm font-medium text-chabon">
        {compte(page.total, locale, j.annuaireResultsOne, j.annuaireResultsMany)}
        {page.total > 0 && page.pages > 1 && (
          <span className="font-normal text-[#52656B]"> · {j.annuaireResultsRange.replace('{from}', String(page.de)).replace('{to}', String(page.a)).replace('{n}', String(page.total))}</span>
        )}
      </p>

      {page.total === 0 ? (
        <div className="rounded-xl border border-[#D7DCD7] bg-white p-5">
          <p className="font-medium text-chabon">{j.annuaireNoResults}</p>
          <p className="mt-1 text-sm text-[#52656B]">{j.annuaireNoResultsHelp}</p>
          <Link href={lien({})} scroll={false} className="mt-3 inline-flex min-h-[44px] items-center rounded-lg bg-chabon px-4 text-sm font-medium text-white">
            {j.annuaireClearFilters}
          </Link>
        </div>
      ) : (
        <section aria-label={j.annuaireResultsLabel} className="flex flex-col gap-5">
          {page.groupes.map((g) => {
            const idTitre = `ag-annuaire-${g.jurisdictionId ?? 'sans-juridiction'}-p${page.page}`
            return (
              <section key={`${g.jurisdictionId}-${g.entries[0].id}`} aria-labelledby={idTitre}>
                <h3 id={idTitre} className="flex flex-wrap items-baseline gap-x-2 border-b border-[#D7DCD7] pb-1.5 font-serif text-lg font-semibold text-chabon">
                  {g.label && g.jurisdictionId ? g.label : j.annuaireUndetermined}
                  {g.suite && <span className="font-sans text-xs font-normal text-[#52656B]">({j.annuaireContinued})</span>}
                  <span className="ml-auto font-sans text-xs font-normal text-[#52656B]">
                    {compte(parJuridiction.get(g.jurisdictionId ?? '') ?? 0, locale, j.notaryCountOne, j.notaryCountMany)}
                  </span>
                </h3>
                <ol className="mt-3 flex flex-col gap-2.5">
                  {g.entries.map((e) => (
                    <CarteNotaire key={e.id} e={e} locale={locale} t={t} retour={pourFiche} lienCarte={lienCarte} />
                  ))}
                </ol>
              </section>
            )
          })}
        </section>
      )}

      {page.pages > 1 && <Pagination t={t} page={page.page} pages={page.pages} lien={(p) => lien({ ...params, page: p })} />}

      <div className="rounded-xl border border-[#D7DCD7] bg-white px-4 py-3 text-[12px] leading-relaxed text-[#52656B]">
        <p>{j.annuaireSort}</p>
        <p className="mt-1">{j.annuaireScope}</p>
        {annuaire.activeEntries < annuaire.totalEntries && <p className="mt-1">{j.notariesCountNote}</p>}
        <p className="mt-1">{notarySourceLine(annuaire.provenance, locale, t)}</p>
      </div>
    </div>
  )
}

function CarteNotaire({
  e, locale, t, retour, lienCarte,
}: { e: AnnuaireEntry; locale: Locale; t: Dictionary; retour: string; lienCarte: (communeId: string) => string }) {
  const j = t.judicial
  const mention = mentionAsPrinted(e.mention)
  const surLaCarte = e.communeId ? lienCarte(e.communeId) : null
  const fiche = `/${locale}/juridictions/notaires/${e.id}?retour=${encodeURIComponent(retour)}`
  return (
    <li className="rounded-lg border border-[#D7DCD7] bg-white p-3.5 sm:p-4">
      <p className="text-[15px] font-semibold leading-snug text-chabon">
        {e.name}
        {mention && <span className="ml-1.5 font-mono text-[11px] font-normal text-[#52656B]">{mention}</span>}
      </p>
      <p className="mt-1 text-[13px] text-[#52656B]">
        <span className="font-medium">{j.annuaireCommission}</span> :{' '}
        {e.communeId ? (
          <>{e.communeName}{e.department && <span> ({e.department})</span>}</>
        ) : (
          <>{j.annuaireUnmatchedCommune.replace('{name}', e.communeName ?? '')}</>
        )}
      </p>
      {e.address ? (
        <p className="mt-1.5 text-[13px] text-chabon">
          <span className="sr-only">{j.annuaireAddress} : </span>
          {surLaCarte ? (
            <Link
              href={surLaCarte}
              scroll={false}
              aria-label={j.annuaireAddressOnMap.replace('{address}', e.address).replace('{commune}', e.communeName ?? '')}
              className="inline-flex items-start gap-1.5 underline decoration-[#D7DCD7] underline-offset-2 hover:text-[#9B422C] hover:decoration-[#9B422C]"
            >
              <MapPin aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{e.address}</span>
            </Link>
          ) : (
            <span>{e.address}</span>
          )}
        </p>
      ) : (
        <p className="mt-1.5 text-[12px] italic text-[#52656B]/90">{j.annuaireNoAddress}</p>
      )}
      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          href={fiche}
          aria-label={j.annuaireSeeProfileLabel.replace('{name}', e.name)}
          className="inline-flex min-h-[44px] items-center text-sm font-semibold text-chabon underline underline-offset-2 hover:text-[#9B422C]"
        >
          {j.annuaireSeeProfile} <span aria-hidden="true" className="ml-1">→</span>
        </Link>
        {surLaCarte && (
          <Link
            href={surLaCarte}
            scroll={false}
            aria-label={j.annuaireLocateLabel.replace('{commune}', e.communeName ?? '').replace('{name}', e.name)}
            className="inline-flex min-h-[44px] items-center gap-1 text-[13px] text-[#52656B] underline-offset-2 hover:text-[#9B422C] hover:underline"
          >
            <MapPin aria-hidden="true" className="h-3.5 w-3.5" /> {j.annuaireLocate}
          </Link>
        )}
      </p>
    </li>
  )
}

function Pagination({ t, page, pages, lien }: { t: Dictionary; page: number; pages: number; lien: (p: number) => string }) {
  const j = t.judicial
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)
  const btn = 'inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border px-3 text-sm transition'
  return (
    <nav aria-label={j.annuairePagination}>
      <ul className="flex flex-wrap items-center gap-1.5">
        <li>
          {page > 1 ? (
            <Link href={lien(page - 1)} className={`${btn} border-[#D7DCD7] bg-white text-chabon hover:border-chabon`}>← {j.annuairePrev}</Link>
          ) : (
            <span aria-disabled="true" className={`${btn} border-[#D7DCD7] bg-white text-[#52656B]/60`}>← {j.annuairePrev}</span>
          )}
        </li>
        {nums.map((n, i) => (
          <li key={n} className="flex items-center gap-1.5">
            {i > 0 && n - nums[i - 1] > 1 && <span aria-hidden="true" className="text-[#52656B]">…</span>}
            {n === page ? (
              <span aria-current="page" className={`${btn} border-chabon ${SAUGE} font-semibold text-chabon`}>
                <span className="sr-only">{j.annuairePageN.replace('{n}', '')}</span>{n}
              </span>
            ) : (
              <Link href={lien(n)} aria-label={j.annuairePageN.replace('{n}', String(n))} className={`${btn} border-[#D7DCD7] bg-white text-chabon hover:border-chabon`}>{n}</Link>
            )}
          </li>
        ))}
        <li>
          {page < pages ? (
            <Link href={lien(page + 1)} className={`${btn} border-[#D7DCD7] bg-white text-chabon hover:border-chabon`}>{j.annuaireNext} →</Link>
          ) : (
            <span aria-disabled="true" className={`${btn} border-[#D7DCD7] bg-white text-[#52656B]/60`}>{j.annuaireNext} →</span>
          )}
        </li>
      </ul>
    </nav>
  )
}
