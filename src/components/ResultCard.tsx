import Link from 'next/link'
import { TypeBadge } from './TypeBadge'
import { StatusChip } from './StatusChip'
import { formatDate } from '@/lib/i18n/format'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { SearchHit } from '@/lib/search/types'
import type { DocType, Locale } from '@/lib/types'

// Convention : t est passé en prop (le parent a déjà le dictionnaire) — pas de
// getDictionary par carte.
export function ResultCard({
  hit,
  locale,
  t,
  q,
  abrogatedByNumber,
}: {
  hit: SearchHit
  locale: Locale
  t: Dictionary
  q?: string
  /** Numéro du texte qui abroge celui-ci — affiché à côté de la pastille « Abrogée ».
   *  Non cliquable ici : la carte entière est déjà un lien (une ancre imbriquée serait
   *  invalide) ; la fiche du texte porte le renvoi cliquable. */
  abrogatedByNumber?: string | null
}) {
  // Propage la requête au document/société → surlignage des termes à l'arrivée (§09).
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim().slice(0, 200))}` : ''

  if (hit.kind === 'company') {
    return (
      <Link
        href={`/${locale}/company/${hit.id}${qs}`}
        className="block rounded-2xl border border-chabon/10 bg-white p-4 transition hover:-translate-y-0.5 hover:"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-chabon px-2 py-0.5 text-[11px] font-semibold text-white">
            {t.search.companies.toUpperCase()}
          </span>
          {hit.fuzzy && <FuzzyTag t={t} />}
          <h3 className="font-semibold text-ank">{hit.title}</h3>
        </div>
        {/* Référence unique de la société (et non l'ensemble de l'édition). */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ank/80">
          {hit.moniteurRef && <span>{hit.moniteurRef}</span>}
          {hit.refCount != null && hit.refCount > 1 && (
            <span className="rounded-full bg-pil px-2 py-0.5 font-medium text-grafit">
              {hit.refCount} {t.search.publications}
            </span>
          )}
        </div>
      </Link>
    )
  }

  const type = hit.type as DocType
  return (
    <Link
      href={`/${locale}/doc/${hit.id}${qs}`}
      className="block rounded-2xl border border-chabon/10 bg-white p-4 transition hover:-translate-y-0.5 hover:"
    >
      <div className="flex items-start gap-3">
        {hit.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-chabon/10 object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={type} />
            {hit.status && <StatusChip status={hit.status} label={t.statuses[hit.status]} />}
            {hit.status === 'ABROGE' && abrogatedByNumber && (
              <span className="text-[11px] font-medium text-ank/80">
                {t.search.abrogatedBy} {abrogatedByNumber}
              </span>
            )}
            {hit.fuzzy && <FuzzyTag t={t} />}
            {hit.number && <span className="text-xs font-medium text-ank/80">{hit.number}</span>}
          </div>
          <h3 className="mt-2 font-semibold leading-snug text-ank">{hit.title}</h3>
          {hit.snippet && (
            <p className="mt-1.5 text-sm leading-relaxed text-grafit" dangerouslySetInnerHTML={{ __html: hit.snippet }} />
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ank/80">
            {hit.publicationDate && <span>{formatDate(locale, hit.publicationDate)}</span>}
            {hit.moniteurRef && <span>{hit.moniteurRef}</span>}
            {hit.bhdaNumber && <span>BHDA {hit.bhdaNumber}</span>}
            {hit.niceClasses && <span>{t.search.niceClass}: {hit.niceClasses}</span>}
            {hit.holder && <span>{hit.holder}</span>}
          </div>
        </div>
      </div>
    </Link>
  )
}

function FuzzyTag({ t }: { t: Dictionary }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pil px-2 py-0.5 text-[10px] font-medium text-chabon">
      ≈ {t.search.fuzzyTag}
    </span>
  )
}
