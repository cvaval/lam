import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { TypeBadge, Pastille } from '@/components/TypeBadge'
import { FavoriteButton } from '@/components/DocActions'
import { dictFor } from '@/lib/i18n/server'
import { formatDate } from '@/lib/i18n/format'
import { requireUser } from '@/lib/auth/guard'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { canReadService, canSeeSourcePdf } from '@/lib/access'
import { isBlobUrl } from '@/lib/storage/blob'
import { guard, LIMITS } from '@/lib/security/ratelimit'
import { RateLimitNotice } from '@/components/RateLimitNotice'
import { StatusChip } from '@/components/StatusChip'
import { BackLink } from '@/components/BackLink'
import { OfficialText } from '@/components/OfficialText'
import { splitKeywords } from '@/lib/ai/keywords'
import { parseCirculaireRef } from '@/lib/brh/gaps'
import type { CircRef } from '@/lib/doc/crossref'
import { parseRichBlocks, buildBodySegments, tableShortCaption, type RichTable } from '@/lib/doc/richblocks'
import { CodeThemeBrowser, type ThemeArticle } from '@/components/CodeThemeBrowser'
import { expandQuery } from '@/lib/search/synonyms'
import { parseEditionHeader } from '@/lib/doc/edition-meta'
import { pickLocale } from '@/lib/i18n/pick'
import { DOC_TYPE_META } from '@/lib/brand'
import type { DocType, DocStatus } from '@/lib/types'
import { getThemeTree } from '@/lib/legislation/themes'
import { resolveCrossRefs, outgoingRefs, backlinks } from '@/lib/legislation/refs'
import { listArticles } from '@/lib/legislation/articles'
import { LegislationAdminPanel } from '@/components/LegislationAdminPanel'
import { getAmendments } from '@/lib/legislation/amendments'
import { applyAmendments } from '@/lib/legislation/segment'
import { CiteButton } from '@/components/CiteButton'
import { labelFromAnchor } from '@/lib/legislation/articles'
import { AmendmentHistory, type AmendItem } from '@/components/AmendmentHistory'
import { parseAnnotations } from '@/lib/legislation/annotated'
import { AnnotatedText } from '@/components/AnnotatedText'
import { CodeSidebar } from '@/components/CodeSidebar'

export default async function DocPage({
  params,
  searchParams,
}: {
  params: { locale: string; id: string }
  searchParams: { q?: string | string[] }
}) {
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
  // Accès par service (§03) : un type non accordé est invisible → redirection vers l'Index.
  // L'Index reste toujours accessible ; un service accordé donne la lecture intégrale.
  if (!canReadService(user, type)) redirect(`/${locale}/search?type=index`)

  const meta = DOC_TYPE_META[type]
  const fav = await prisma.favorite.findUnique({
    where: { userId_documentId: { userId: user.id, documentId: doc.id } },
  })

  // Renvoi d'abrogation : le texte qui abroge celui-ci, résolu par NUMÉRO (robuste au
  // ré-import qui change les id) → note + lien sur la fiche (statut ABROGE).
  const abrogatedBy =
    doc.status === 'ABROGE' && doc.abrogatedByNumber
      ? await prisma.document.findFirst({
          where: { type: 'CIRCULAIRE_BRH', number: doc.abrogatedByNumber },
          select: { id: true, number: true },
        })
      : null

  const summary = pickLocale(doc.summaryFr, doc.summaryEn, doc.summaryHt, locale)
  const means = pickLocale(doc.meansFr, doc.meansEn, doc.meansHt, locale)
  const title = pickLocale(doc.titleFr, doc.titleEn, doc.titleHt, locale) || doc.titleFr

  // bodyClean : version corrigée (OCR + orthographe) par l'IA — affichée si disponible,
  // bodyOriginal sinon. L'original reste intact en base (§02). L'accès étant accordé par
  // service (sinon redirection ci-dessus), le texte est toujours affiché en intégralité.
  const body = doc.bodyClean ?? doc.bodyOriginal

  // Texte annoté (Code du travail, Constitution, Code civil…) : table des matières,
  // jurisprudence et index, stockés hors du texte officiel (annotationsJson).
  const annotations = parseAnnotations(doc.annotationsJson)

  // Amendements au niveau article (overlay §02) : le texte affiché montre par défaut la
  // version EN VIGUEUR de chaque article amendé ; l'historique (anciennes versions) reste
  // lisible plus bas (AmendmentHistory). Aucune ligne d'overlay = texte original inchangé.
  // Textes annotés : les libellés du sommaire BORNENT les segments d'article, sinon le
  // remplacement du dernier article d'un chapitre engloutirait l'en-tête suivant.
  const amendments = await getAmendments(doc.id)
  const normHead = (s: string) => s.replace(/\s+/g, ' ').trim()
  const tocLabels = annotations ? new Set(annotations.toc.map((e) => normHead(e.label))) : null
  const effectiveBody = applyAmendments(body, amendments, tocLabels ? (line) => tocLabels.has(normHead(line)) : undefined)
  const amendedAnchors = amendments.size ? new Set(amendments.keys()) : undefined
  const amendItems: AmendItem[] = [...amendments.values()].map((ov) => {
    const ab = ov.history.find((v) => v.status === 'ABROGE')
    const statusLine = ov.abrogated
      ? `Abrogé${ab?.effectiveDate ? ' le ' + formatDate(locale, ab.effectiveDate) : ''}${ab?.amendedByNumber ? ' — ' + ab.amendedByNumber : ''}`
      : `En vigueur${ov.inForce?.effectiveDate ? ' depuis le ' + formatDate(locale, ov.inForce.effectiveDate) : ''}${ov.inForce?.amendedByNumber ? ' (' + ov.inForce.amendedByNumber + ')' : ''}`
    return {
      anchor: ov.anchor,
      label: ov.label ?? labelFromAnchor(ov.anchor),
      abrogated: ov.abrogated,
      statusLine,
      history: ov.history.map((v) => ({
        heading: `${v.status === 'ABROGE' ? 'Version abrogée' : 'Ancienne version'}${v.effectiveDate ? ' — ' + formatDate(locale, v.effectiveDate) : ''}${v.amendedByNumber ? ' (' + v.amendedByNumber + ')' : ''}`,
        body: v.body,
      })),
    }
  })

  // Tableaux & encadrés colorés (reproduction du rendu visuel du PDF).
  const richBlocks = parseRichBlocks(doc.richBlocksJson)
  // Index thématique IA (codes/lois longs) — alimente le navigateur par thème + renvois.
  let themeIndex: ThemeArticle[] = []
  try { if (doc.themeIndexJson) themeIndex = JSON.parse(doc.themeIndexJson) as ThemeArticle[] } catch { themeIndex = [] }
  // Annexes téléchargeables (Word/Excel) : circulaires dont les annexes sont des
  // tableaux/formulaires reconstruits. Réservé aux paliers exportateurs (§09).
  const annexCount = richBlocks.filter((b) => b.type === 'table').length

  // Édition scannée du Moniteur : le contenu EST le PDF (le « corps » n'est qu'un libellé de
  // fascicule) → on propose une consultation directe du PDF au lieu d'un texte officiel vide.
  const isScannedEdition = (doc.source ?? '').startsWith('MONITEUR_PDF_') && isBlobUrl(doc.sourcePdfUrl)
  const canViewPdf = type === 'CIRCULAIRE_BRH' || canSeeSourcePdf(user)
  // Citation juridique copiable : désignation + référence Moniteur / numéro + date.
  const citation =
    `${title}${doc.moniteurRef ? ` — ${doc.moniteurRef}` : doc.number ? ` (${doc.number})` : ''}` +
    `${doc.publicationDate ? `, ${formatDate(locale, doc.publicationDate)}` : ''}`

  // Sommaire des tableaux : numérotation par ordre d'AFFICHAGE (même source que
  // OfficialText → buildBodySegments), pour des ancres #tableau-N cohérentes.
  const tableEntries = buildBodySegments(effectiveBody, richBlocks)
    .filter((s) => s.kind === 'rich' && s.block.type === 'table')
    .map((s, i) => ({ num: i + 1, cap: tableShortCaption((s as { block: RichTable }).block), orphan: Boolean((s as { orphan?: boolean }).orphan) }))
  const tl = (o: { fr: string; en: string; ht: string }) => o[locale as 'fr' | 'en' | 'ht'] ?? o.fr
  const TLBL = {
    heading: tl({ fr: 'Tableaux du document', en: 'Document tables', ht: 'Tablo dokiman an' }),
    table: tl({ fr: 'Tableau', en: 'Table', ht: 'Tablo' }),
    orphan: tl({ fr: 'emplacement approximatif', en: 'approximate position', ht: 'kote apwoksimatif' }),
  }

  // Renvois croisés (CrossRef) résolus + rétroliens — affichés sur la fiche, access-aware (§03).
  const [outRefs, inRefs] = await Promise.all([
    outgoingRefs(doc.id, user),
    backlinks({ id: doc.id, type: doc.type, number: doc.number }, user),
  ])

  // Outils éditoriaux (Master Admin) : thèmes, renvois et amendements de cette fiche.
  const adminPanel =
    user.role === 'MASTER_ADMIN'
      ? await (async () => {
          const [tree, dThemes, crossRefs] = await Promise.all([
            getThemeTree({ activeOnly: true }),
            prisma.documentTheme.findMany({ where: { documentId: doc.id }, select: { themeId: true, isPrimary: true } }),
            prisma.crossRef.findMany({ where: { fromId: doc.id }, orderBy: { position: 'asc' } }),
          ])
          const resolved = await resolveCrossRefs(crossRefs)
          return {
            tree,
            currentThemeIds: dThemes.map((dt) => dt.themeId),
            primaryThemeId: dThemes.find((dt) => dt.isPrimary)?.themeId ?? null,
            articles: listArticles(body),
            refs: resolved.map((r) => ({ refId: r.refId, kind: r.kind, label: r.label, toId: r.toId, pending: r.pending, anchor: r.anchor })),
          }
        })()
      : null

  // Termes recherchés à surligner dans le texte et les tableaux (depuis ?q= au clic
  // d'un résultat de recherche) — mêmes termes étendus que le moteur (synonymes).
  // ?q peut arriver en tableau (lien forgé « ?q=a&q=b ») : normaliser avant .trim/.slice.
  const rawQ = Array.isArray(searchParams?.q) ? searchParams.q[0] : searchParams?.q
  const hlTerms = rawQ?.trim() ? expandQuery(rawQ.slice(0, 200)) : undefined

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

  const editionHeader = parseEditionHeader(doc.metaJson)

  return (
    <article className={`mx-auto space-y-6 ${annotations ? 'max-w-6xl' : 'max-w-3xl'}`}>
      <BackLink fallback={`/${locale}/search?type=${meta.slug}`} label={meta.label[locale]} />

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
          {/* En-tête du fascicule (numéro Moniteur) capturé au téléversement */}
          {editionHeader?.anneeParution != null && (
            <span>
              {editionHeader.anneeParution}
              <sup>e</sup> {t.doc.anneeLabel}
            </span>
          )}
          {editionHeader?.directeurGeneral && (
            <span>
              {t.doc.dgLabel} : {editionHeader.directeurGeneral}
            </span>
          )}
          {editionHeader?.issn && <span>ISSN {editionHeader.issn}</span>}
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
        <CiteButton citation={citation} label={t.doc.cite} copiedLabel={t.doc.copied} />
        {can(user.role, 'export.sealed') ? (
          <a
            href={`/api/export?id=${doc.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-lank px-3 py-1.5 text-sm font-semibold text-white hover:bg-lank-600"
          >
            ↓ {t.doc.export}
          </a>
        ) : null}
        {/* PDF original — servi par une route authentifiée depuis le Blob privé, seulement
            si migré (URL Blob). Circulaires BRH : TÉLÉCHARGEMENT ouvert à tout lecteur de
            circulaires. Autres types : lien « source » réservé (canSeeSourcePdf). */}
        {isBlobUrl(doc.sourcePdfUrl) && (type === 'CIRCULAIRE_BRH' || canSeeSourcePdf(user)) && (
          <a
            href={`/api/doc/${doc.id}/pdf${type === 'CIRCULAIRE_BRH' ? '?download=1' : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm text-lank/70 hover:bg-lank-50"
          >
            {type === 'CIRCULAIRE_BRH' ? `↓ ${t.doc.downloadPdf}` : t.doc.source}
          </a>
        )}
      </div>

      {/* Annexes à compléter : téléchargement Word (formulaires) / Excel (tableaux),
          filigrane Lam + mention légale (src/lib/annexes/generate.ts). */}
      {type === 'CIRCULAIRE_BRH' && can(user.role, 'export.sealed') && annexCount > 0 && (
        <div className="rounded-xl border border-lank/10 bg-paper/60 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-lank">{t.doc.annexes}</p>
              <p className="text-xs text-lank/55">{t.doc.annexesHint}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/doc/${doc.id}/annexes?format=docx&locale=${locale}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm font-medium text-lank hover:bg-lank-50"
              >
                ↓ Word
              </a>
              <a
                href={`/api/doc/${doc.id}/annexes?format=xlsx&locale=${locale}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-lank/15 bg-white px-3 py-1.5 text-sm font-medium text-lank hover:bg-lank-50"
              >
                ↓ Excel
              </a>
            </div>
          </div>
        </div>
      )}

      {doc.status === 'ABROGE' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {abrogatedBy ? (
            <>
              {t.doc.abrogatedByPrefix}{' '}
              <Link
                href={`/${locale}/doc/${abrogatedBy.id}`}
                className="font-semibold underline underline-offset-2 hover:text-red-900"
              >
                {abrogatedBy.number}
              </Link>
              .
            </>
          ) : doc.abrogatedByNumber ? (
            `${t.doc.abrogatedByPrefix} ${doc.abrogatedByNumber}.`
          ) : (
            t.doc.abrogatedBanner
          )}
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

      {/* Texte officiel — jamais traduit (§02). Texte annoté : menu latéral (recherche +
          sommaire + index) à GAUCHE ; sinon rendu standard pleine largeur. */}
      {annotations ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <CodeSidebar docId={doc.id} groups={annotations.navToc} indexEntries={annotations.indexEntries} locale={locale} />
          <section className="min-w-0 rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-lank/10 pb-3">
              <h2 className="text-sm font-semibold text-lank">{t.doc.officialText}</h2>
              <span className="rounded-md bg-soley-50 px-2 py-1 text-[11px] text-soley-700">
                {locale === 'fr' ? t.doc.officialBannerFr : t.doc.officialBanner}
              </span>
            </div>
            <p className="mb-3 rounded-lg bg-lank-50 px-3 py-2 text-[11px] leading-relaxed text-lank/60">{t.doc.unofficialNote}</p>
            <AnnotatedText
              text={effectiveBody}
              annotations={annotations}
              locale={locale}
              terms={hlTerms}
              hideInlineIndex={doc.source === 'CONSTITUTION_1987' || doc.source === 'CODE_CIVIL_ANNOTE' || doc.source === 'CODE_DOUANES_ANNOTE' || doc.source === 'DECRET_REGIMES_MATRIMONIAUX' || doc.source === 'LOI_FILIATION_2014'}
              linkCivRefs={doc.source === 'CODE_CIVIL_ANNOTE'}
              linkArtRefs={doc.source === 'CODE_PENAL_ANNOTE' || doc.source === 'CODE_DOUANES_ANNOTE' || doc.source === 'DECRET_REGIMES_MATRIMONIAUX' || doc.source === 'LOI_FILIATION_2014'}
              annotationsVariant={doc.source === 'CODE_CIVIL_ANNOTE' ? 'annotations' : 'juris'}
            />
          </section>
        </div>
      ) : isScannedEdition ? (
        <section className="rounded-2xl border border-lank/10 bg-white p-6 text-center shadow-card">
          <p className="mx-auto mb-4 max-w-md text-sm leading-relaxed text-lank/70">{t.doc.scannedEdition}</p>
          {canViewPdf ? (
            <a
              href={`/api/doc/${doc.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-lank px-4 py-2.5 text-sm font-semibold text-white hover:bg-lank-600"
            >
              ↗ {t.doc.openPdf}
            </a>
          ) : (
            <p className="text-xs text-lank/45">{t.doc.pdfNotIncluded}</p>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-lank/10 pb-3">
            <h2 className="text-sm font-semibold text-lank">{t.doc.officialText}</h2>
            <span className="rounded-md bg-soley-50 px-2 py-1 text-[11px] text-soley-700">
              {locale === 'fr' ? t.doc.officialBannerFr : t.doc.officialBanner}
            </span>
          </div>
          <p className="mb-3 rounded-lg bg-lank-50 px-3 py-2 text-[11px] leading-relaxed text-lank/60">{t.doc.unofficialNote}</p>
          {themeIndex.length > 0 && <div className="mb-4"><CodeThemeBrowser index={themeIndex} t={t} /></div>}
          {tableEntries.length >= 2 && (
            <details className="mb-4 rounded-xl border border-lank/10 bg-paper/40 px-4 py-2.5">
              <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-lank/55">
                {TLBL.heading} ({tableEntries.length})
              </summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {tableEntries.map((e) => (
                  <li key={e.num}>
                    <a href={`#tableau-${e.num}`} className="text-sm text-endeks-700 hover:underline">
                      {TLBL.table} {e.num}
                      {e.cap && <span className="text-lank/60"> — {e.cap}</span>}
                      {e.orphan && <span className="text-lank/40"> ({TLBL.orphan})</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div className="relative">
            <OfficialText text={effectiveBody} hrefFor={hrefFor} rich={richBlocks} locale={locale} terms={hlTerms} amendedAnchors={amendedAnchors} />
          </div>
        </section>
      )}

      {amendItems.length > 0 && <AmendmentHistory items={amendItems} locale={locale} />}

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

      {/* Citations croisées & renvois : CrossRef éditoriaux (sortants) + rétroliens + Citation legacy */}
      {(doc.citationsFrom.length > 0 || doc.citationsTo.length > 0 || outRefs.length > 0 || inRefs.length > 0) && (
        <section className="rounded-2xl border border-lank/10 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-semibold text-lank">{t.doc.citations}</h2>
          <ul className="space-y-2">
            {outRefs.map((r) => {
              const inner = (
                <>
                  {r.type && <Pastille type={r.type} />}
                  <span className="text-lank/45">{r.kind} →</span> {r.label}
                  {r.anchor && <span className="text-xs text-lank/40">(art. {r.anchor.replace('art-', '')})</span>}
                  {r.pending && <span className="text-xs text-soley-600">· cible non importée</span>}
                </>
              )
              return (
                <li key={r.refId}>
                  {r.accessible && r.toId ? (
                    <Link href={`/${locale}/doc/${r.toId}${r.anchor ? '#' + r.anchor : ''}`} className="flex items-center gap-2 text-sm text-lank hover:underline">
                      {inner}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-lank/70">{inner}</span>
                  )}
                </li>
              )
            })}
            {doc.citationsFrom.map((c) => (
              <li key={c.id}>
                <Link href={`/${locale}/doc/${c.to.id}`} className="flex items-center gap-2 text-sm text-lank hover:underline">
                  <Pastille type={c.to.type as DocType} />
                  <span className="text-lank/45">{c.kind} →</span> {c.to.titleFr}
                </Link>
              </li>
            ))}
            {inRefs.map((b) => {
              const inner = (
                <>
                  <Pastille type={b.fromType} />
                  <span className="text-lank/45">← {b.kind}</span> {b.fromTitleFr || t.doc.otherService}
                </>
              )
              return (
                <li key={`bl-${b.refId}`}>
                  {b.accessible ? (
                    <Link href={`/${locale}/doc/${b.fromId}`} className="flex items-center gap-2 text-sm text-lank hover:underline">
                      {inner}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-lank/70">{inner}</span>
                  )}
                </li>
              )
            })}
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

      {adminPanel && (
        <LegislationAdminPanel
          documentId={doc.id}
          themeTree={adminPanel.tree}
          currentThemeIds={adminPanel.currentThemeIds}
          primaryThemeId={adminPanel.primaryThemeId}
          articles={adminPanel.articles}
          refs={adminPanel.refs}
        />
      )}
    </article>
  )
}
