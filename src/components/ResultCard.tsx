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
  texte = true,
  pdf = false,
}: {
  hit: SearchHit
  locale: Locale
  t: Dictionary
  q?: string
  /** Numéro du texte qui abroge celui-ci — affiché à côté de la pastille « Abrogée ».
   *  Non cliquable ici : la carte entière est déjà un lien (une ancre imbriquée serait
   *  invalide) ; la fiche du texte porte le renvoi cliquable. */
  abrogatedByNumber?: string | null
  /** Le document a un TEXTE (corps transcrit) : action « Lire le texte ». */
  texte?: boolean
  /** Un PDF original servable ET le droit de le voir (décidé par la page, mêmes règles que la fiche). */
  pdf?: boolean
}) {
  // Propage la requête au document/société → surlignage des termes à l'arrivée (§09).
  const qs = q && q.trim() ? `?q=${encodeURIComponent(q.trim().slice(0, 200))}` : ''

  if (hit.kind === 'company') {
    return (
      <Link
        href={`/${locale}/company/${hit.id}${qs}`}
        className="block rounded-2xl border border-chabon/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-chabon"
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
  // Le clic mène AU PASSAGE : la requête (surlignage, navigation entre occurrences) et l'ARTICLE de
  // la 1ʳᵉ occurrence quand le moteur l'a localisé (`#art-N`, R3 du 24 oct. 2026).
  const fiche = `/${locale}/doc/${hit.id}${qs}${hit.anchor ? `#${hit.anchor}` : ''}`
  const actionSecondaire = 'relative z-10 inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-chabon/15 bg-white px-3 text-[13px] font-medium text-chabon transition hover:border-chabon hover:bg-pil'
  const actionPrincipale = 'relative z-10 inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-chabon px-3 text-[13px] font-medium text-white transition hover:bg-chabon/90'
  return (
    // La carte reste cliquable PARTOUT (le lien du titre la couvre, `after:inset-0`) ; les actions
    // « Lire le texte » et « PDF » passent au-dessus (`z-10`) — aucun lien imbriqué.
    <div className="relative rounded-2xl border border-chabon/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-chabon">
      <div className="flex items-start gap-3">
        {hit.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-chabon/10 object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={type} />
            {hit.status && <StatusChip status={hit.status} label={t.statuses[hit.status]} effectiveDate={hit.effectiveDate} locale={locale} />}
            {hit.status === 'ABROGE' && abrogatedByNumber && (
              <span className="text-[11px] font-medium text-ank/80">
                {t.search.abrogatedBy} {abrogatedByNumber}
              </span>
            )}
            {hit.fuzzy && <FuzzyTag t={t} />}
            {hit.number && <span className="text-xs font-medium text-ank/80">{hit.number}</span>}
          </div>
          <h3 className="mt-2 font-semibold leading-snug text-ank">
            <Link href={fiche} className="after:absolute after:inset-0 after:rounded-2xl hover:underline">
              {hit.title}
            </Link>
          </h3>
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
          {(texte || pdf) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {texte && (
                <Link href={fiche} className={actionSecondaire}>
                  {t.search.readText} <span aria-hidden="true">→</span>
                </Link>
              )}
              {pdf && (
                // L'original, servi par la route authentifiée (Blob privé, droits vérifiés à chaque appel).
                <a
                  href={`/api/doc/${hit.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${t.search.openPdfLabel} — ${hit.title}`}
                  className={texte ? actionSecondaire : actionPrincipale}
                >
                  {t.search.openPdf} <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FuzzyTag({ t }: { t: Dictionary }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pil px-2 py-0.5 text-[10px] font-medium text-chabon">
      ≈ {t.search.fuzzyTag}
    </span>
  )
}
