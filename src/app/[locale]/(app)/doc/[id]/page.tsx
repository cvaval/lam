import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { TypeBadge, Pastille } from '@/components/TypeBadge'
import { FavoriteButton } from '@/components/DocActions'
import { dictFor } from '@/lib/i18n/server'
import { formatDate } from '@/lib/i18n/format'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { canReadFull, can } from '@/lib/rbac'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { StatusChip } from '@/components/StatusChip'
import { OfficialText } from '@/components/OfficialText'
import { splitKeywords } from '@/lib/ai/keywords'
import { parseCirculaireRef } from '@/lib/brh/gaps'
import type { CircRef } from '@/lib/doc/crossref'
import { parseRichBlocks } from '@/lib/doc/richblocks'
import { pickLocale } from '@/lib/i18n/pick'
import { DOC_TYPE_META } from '@/lib/brand'
import type { DocType, DocStatus } from '@/lib/types'

export default async function DocPage({ params }: { params: { locale: string; id: string } }) {
  const { locale, t } = dictFor(params.locale)
  const user = await requireUser(locale)

  // Anti-scraping : plafond de consultations de documents par minute (§09).
  if (!(await guard({ action: 'doc', subject: user.id, ...LIMITS.doc }, { actorId: user.id }))) {
    return <RateLimitNotice t={t} />
  }

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    include: {
      versions: { orderBy: { effectiveDate: 'desc' } },
      citationsFrom: { include: { to: true } },
      citationsTo: { include: { from: true } },
    },
  })
  if (!doc) notFound()

  const type = doc.type as DocType
  const isIndex = type === 'INDEX'
  // Accès « Index seulement » : pas de lecture des textes intégraux.
  if (user.indexOnly && !isIndex) redirect(`/${locale}/search?type=index`)

  const meta = DOC_TYPE_META[type]
  // L'Index ne contient que des références → toujours visible en entier (pas de paywall).
  const fullAccess = isIndex || canReadFull(user.role)
  const fav = await prisma.favorite.findUnique({
    where: { userId_documentId: { userId: user.id, documentId: doc.id } },
  })

  const summary = pickLocale(doc.summaryFr, doc.summaryEn, doc.summaryHt, locale)
  const means = pickLocale(doc.meansFr, doc.meansEn, doc.meansHt, locale)
  const title = pickLocale(doc.titleFr, doc.titleEn, doc.titleHt, locale) || doc.titleFr

  const extract = fullAccess ? doc.bodyOriginal : doc.bodyOriginal.slice(0, 650)
  // Tableaux & encadrés colorés (reproduction du rendu visuel du PDF) — affichés
  // seulement en lecture intégrale, pour ne pas déborder de l'extrait du paywall.
  const richBlocks = fullAccess ? parseRichBlocks(doc.richBlocksJson) : []

  // Liens croisés entre circulaires BRH : index numéro → fiche du corpus.
  // « article N de la présente circulaire » → ancre #art-N de la fiche courante.
  let hrefFor: ((ref: CircRef) => string | null) | undefined
  if (type === 'CIRCULAIRE_BRH') {
    const refDocs = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH' },
      select: { id: true, number: true },
    })
    const refIndex: Record<string, string> = {}
    for (const r of refDocs) {
      const p = parseCirculaireRef(r.number)
      if (p) refIndex[`${p.serie}|${p.base}|${p.rev ?? 0}`] = r.id
    }
    hrefFor = (ref) => {
      const targetId = ref.present ? doc.id : refIndex[`${ref.serie}|${ref.base}|${ref.rev ?? 0}`]
      if (!targetId) return null
      return `/${locale}/doc/${targetId}${ref.article ? `#art-${ref.article}` : ''}`
    }
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link href={`/${locale}/search?type=${meta.slug}`} className="text-sm text-lank/50 hover:text-lank">
        ← {meta.label[locale]}
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={type} />
          {doc.number && <span className="text-sm font-medium text-lank/50">{doc.number}</span>}
          {doc.status && <StatusChip status={doc.status} label={t.statuses[doc.status as DocStatus]} />}
          {doc.sealed && (
            <span className="inline-flex items-center gap-1 rounded-full bg-lank px-2 py-0.5 text-[11px] font-semibold text-white">
              <Pastille type={type} className="!bg-sitwon" /> {t.doc.verified}
            </span>
          )}
        </div>
        <h1 className="font-serif text-3xl font-semibold leading-tight text-lank">{title}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-lank/50">
          {doc.moniteurRef && (
            <span>
              {t.doc.moniteur} {doc.moniteurRef}
            </span>
          )}
          {doc.publicationDate && <span>{formatDate(locale, doc.publicationDate)}</span>}
          {doc.effectiveDate && (
            <span>
              {t.brh.effDate} : {formatDate(locale, doc.effectiveDate)}
            </span>
          )}
          {doc.holder && <span>{doc.holder}</span>}
          {doc.niceClasses && <span>Nice {doc.niceClasses}</span>}
          {doc.bhdaNumber && <span>BHDA {doc.bhdaNumber}</span>}
        </div>
        {/* Mots-clés thématiques — cliquables vers la recherche */}
        {doc.keywords && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-lank/40">{t.doc.keywords}</span>
            {splitKeywords(doc.keywords).map((kw) => (
              <Link
                key={kw}
                href={`/${locale}/search?q=${encodeURIComponent(kw)}`}
                className="rounded-full border border-lank/15 bg-paper px-2.5 py-0.5 text-xs text-lank/70 hover:border-sitwon hover:text-lank"
              >
                {kw}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Barre d'actions */}
      <div className="flex flex-wrap gap-2">
        <FavoriteButton documentId={doc.id} initial={!!fav} t={t} />
        {can(user.role, 'export.sealed') ? (
          <a
            href={`/api/export?id=${doc.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-lank px-3 py-1.5 text-sm font-semibold text-white hover:bg-lank-600"
          >
            ↓ {t.doc.export}
          </a>
        ) : null}
        {doc.sourcePdfUrl && (
          <a
            href={doc.sourcePdfUrl}
            className="inline-flex items-center rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm text-lank/70"
          >
            {t.doc.source}
          </a>
        )}
      </div>

      {doc.status === 'ABROGE' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {t.doc.abrogatedBanner}
        </div>
      )}

      {isIndex && (
        <div className="rounded-xl border border-endeks/30 bg-endeks-50 px-4 py-2.5 text-sm text-endeks-700">
          {t.doc.indexNote}
        </div>
      )}

      {/* Marque : reproduction si publiée */}
      {type === 'MARQUE' && doc.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={doc.imageUrl} alt={title} className="h-40 w-40 rounded-xl border border-lank/10 object-contain p-2" />
      )}

      {/* Résumé éditorial */}
      {summary && (
        <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-lank">{t.doc.editorialSummary}</h2>
            <span className="rounded bg-lank-50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-lank/50">
              {t.doc.editorial}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-lank/75">{summary}</p>
        </section>
      )}

      {/* « Sa sa vle di / What it means » */}
      {means && (
        <section className="rounded-2xl border-2 border-lagon bg-lagon-50 p-5">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-lank">{t.doc.means}</h2>
            <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium uppercase text-lank/50">
              {t.doc.editorial}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-lank/80">{means}</p>
        </section>
      )}

      {/* Texte officiel — jamais traduit (§02) */}
      <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-lank/10 pb-3">
          <h2 className="text-sm font-semibold text-lank">{t.doc.officialText}</h2>
          <span className="rounded-md bg-soley-50 px-2 py-1 text-[11px] text-soley-700">
            {locale === 'fr' ? t.doc.officialBannerFr : t.doc.officialBanner}
          </span>
        </div>
        <p className="mb-3 rounded-lg bg-lank-50 px-3 py-2 text-[11px] leading-relaxed text-lank/60">
          {t.doc.unofficialNote}
        </p>
        <div className="relative">
          <OfficialText text={extract} hrefFor={hrefFor} rich={richBlocks} />
          {!fullAccess && (
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-0 -top-24 h-24 bg-gradient-to-b from-transparent to-white" />
              <div className="rounded-xl border border-soley/40 bg-soley-50 p-5 text-center">
                <p className="text-sm font-medium text-lank">{t.paywall.extractOnly}</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-lank/65">{t.paywall.upgrade}</p>
                <Link
                  href={`/${locale}/account`}
                  className="mt-3 inline-block rounded-lg bg-lank px-4 py-2 text-sm font-semibold text-white"
                >
                  {t.paywall.cta}
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Versions & historique (type 1) */}
      {doc.versions.length > 0 && (
        <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-lank">{t.doc.versions}</h2>
          <ul className="space-y-2">
            {doc.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-sm">
                <span className="text-lank">{v.versionLabel}</span>
                <span className="text-xs text-lank/45">{v.changeNote}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Citations croisées */}
      {(doc.citationsFrom.length > 0 || doc.citationsTo.length > 0) && (
        <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-lank">{t.doc.citations}</h2>
          <ul className="space-y-2">
            {doc.citationsFrom.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/doc/${c.to.id}`} className="flex items-center gap-2 text-sm text-lank hover:underline">
                  <Pastille type={c.to.type as DocType} />
                  <span className="text-lank/45">{c.kind} →</span> {c.to.titleFr}
                </Link>
              </li>
            ))}
            {doc.citationsTo.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/doc/${c.from.id}`} className="flex items-center gap-2 text-sm text-lank hover:underline">
                  <Pastille type={c.from.type as DocType} />
                  <span className="text-lank/45">← {c.kind}</span> {c.from.titleFr}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
