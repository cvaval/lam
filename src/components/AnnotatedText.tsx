import Link from 'next/link'
import { OfficialText } from './OfficialText'
import { Jurisprudence } from './Jurisprudence'
import { OldVersion } from './OldVersion'
import { RelatedLaw } from './RelatedLaw'
import { segmentAnnotated, indexBacklinks, cleanIndexSubject, prettyRef, type Annotations, type Backlink, type ArtRef } from '@/lib/legislation/annotated'
import { labelFromAnchor } from '@/lib/legislation/articles'
import type { Locale } from '@/lib/types'

const INDEX_LBL: Record<Locale, string> = { fr: 'Index', en: 'Index', ht: 'Endèks' }
// En-tête d'article en tête d'un bloc (« Article 12.- … » du Code du travail, « Article 12.1 »
// de la Constitution, « Art. 2047 » du Code civil) : retiré du corps (affiché en badge).
const LEAD_ART =
  /^(?:art(?:icle)?\.?|section)\s+(?:premier|\d{1,4}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*[.)\-–]*\s*/i
// Statut d'amendement (Constitution) → pastille colorée.
const STATUS_BADGE: Record<string, { fr: string; cls: string }> = {
  modifié: { fr: 'modifié', cls: 'bg-brim-50 text-brim-700' },
  nouveau: { fr: 'nouveau', cls: 'bg-sitwon-50 text-sitwon-700' },
  abrogé: { fr: 'abrogé', cls: 'bg-red-50 text-red-700' },
}

/**
 * Lecteur d'un texte annoté (Code du travail) : chapitres et articles en unités visuelles
 * distinctes, suivies des renvois d'index (cliquables vers les articles connexes) et de la
 * jurisprudence repliable. bodyOriginal reste le texte officiel (§02) ; annotations = AFFICHAGE.
 */
export function AnnotatedText({
  text,
  annotations,
  locale = 'fr',
  terms,
  hideInlineIndex = false,
  linkCivRefs = false,
  annotationsVariant = 'juris',
}: {
  text: string
  annotations: Annotations
  locale?: Locale
  terms?: string[]
  /** Masque les renvois d'index sous chaque article (l'index reste dans le menu latéral).
   *  Constitution : la ligne « sujet → n°s » sous les articles est retirée à la demande. */
  hideInlineIndex?: boolean
  /** Code civil : rend cliquables les renvois « C. civ., 969, 1102 » du texte (liens #art-N). */
  linkCivRefs?: boolean
  /** Libellé du pliable d'annotations : « Jurisprudence » (Code du travail) ou
   *  « Annotations » (Code civil : commentaires de l'auteur + jurisprudence). */
  annotationsVariant?: 'juris' | 'annotations'
}) {
  const blocks = segmentAnnotated(text, annotations.toc ?? [])
  const juris = annotations.jurisprudence ?? {}
  const backlinks = indexBacklinks(annotations.indexEntries ?? [])
  const crossRefMap = new Map((annotations.crossRefs ?? []).map((c) => [c.anchor, c]))
  const oldVersions = annotations.oldVersions ?? {}
  const statusMap = annotations.status ?? {}
  const labelsMap = annotations.labels ?? {}
  const connexeMap = annotations.connexe ?? {}
  const commentMap = annotations.commentaires ?? {}
  const shownIndex = new Set<string>()
  // Le Préambule est un chapitre du sommaire (pas un article) : son ancienne version (1987)
  // ne s'accroche à aucune ancre #art-N. On la rattache au bloc de corps qui suit son en-tête.
  const preambleAnchor = (annotations.toc ?? []).find((e) => /^pr[ée]ambule$/i.test(e.label))?.anchor
  const oldPreamble = oldVersions['preambule']
  let preambleBodyNext = false
  let titleShown = false // 1ʳᵉ ligne de la page de titre = plus grande (déterministe, sans `first:`)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        // ── En-têtes de section ──
        if (b.kind === 'section') {
          if (b.anchor === preambleAnchor) preambleBodyNext = true // le corps suivant portera l'ancien préambule
          const xref = crossRefMap.get(b.anchor)
          const bigTitle = b.tocKind === 'title' && !titleShown
          if (b.tocKind === 'title') titleShown = true
          const header =
            b.tocKind === 'title' ? (
              // Page de titre du décret (CODE DU TRAVAIL / DUVALIER…) — centrée ; 1ʳᵉ ligne agrandie.
              <p
                key={i}
                id={b.anchor}
                className={`scroll-mt-24 text-center font-serif font-bold uppercase tracking-wide ${bigTitle ? 'text-xl text-soley-700' : 'text-lank'}`}
              >
                {b.text}
              </p>
            ) : b.level === 1 ? (
              // TITRE / ANNEXE : séparateur majeur.
              <h3 key={i} id={b.anchor} className="mt-7 flex scroll-mt-24 items-center gap-2.5 border-b-2 border-soley/30 pb-2 font-serif text-lg font-bold uppercase tracking-wide text-lank first:mt-0">
                <span aria-hidden className="h-5 w-1.5 rounded-full bg-soley" />
                {b.text}
              </h3>
            ) : b.level === 3 ? (
              // Chapitre : « Chapitre N — Titre ».
              <h5 key={i} id={b.anchor} className="mt-5 flex scroll-mt-24 items-baseline gap-2 font-serif text-[15px] font-semibold text-lank">
                <span aria-hidden className="text-base leading-none text-soley-600">§</span>
                {b.text}
              </h5>
            ) : b.level === 4 ? (
              // Section (sous-titre d'un chapitre).
              <p key={i} id={b.anchor} className="mt-3 scroll-mt-24 pl-4 text-[12.5px] font-semibold uppercase tracking-wide text-lank/50">
                {b.text}
              </p>
            ) : (
              // Niveau 2 : sous-titre (livre / « LOI No. X »).
              <p key={i} id={b.anchor} className="scroll-mt-24 pt-1 text-sm font-semibold uppercase tracking-wide text-soley-700">
                {b.text}
              </p>
            )
          if (!xref) return header
          // Renvoi croisé éditorial : vers des articles du Code (ex. Liberté syndicale → art. 225)
          // et/ou vers un AUTRE document de la plateforme (ex. loi modificatrice → /doc/{id}).
          const hasDocs = !!xref.docs?.length
          return (
            <div key={i}>
              {header}
              <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-md border border-sitwon/30 bg-sitwon-50 px-3 py-1.5 text-[11.5px] text-lank/75">
                <span className="font-bold uppercase tracking-wide text-sitwon-700">↪ Renvoi{xref.articles.length > 0 ? ' au Code' : ''}&nbsp;:</span>
                {hasDocs && xref.note && <span className="text-lank/55">{xref.note}</span>}
                {xref.docs!== undefined && xref.docs.map((d, k) => (
                  <Link key={d.id + k} href={`/${locale}/doc/${d.id}`} className="font-semibold text-sitwon-700 underline decoration-sitwon/40 underline-offset-2 hover:decoration-sitwon">
                    {d.label}
                  </Link>
                ))}
                {xref.articles.map((n, k, arr) => (
                  <span key={n}>
                    <a href={`#art-${n}`} className="font-semibold text-sitwon-700 hover:underline">
                      article {n}
                    </a>
                    {k < arr.length - 1 && <span className="text-lank/30">, </span>}
                  </span>
                ))}
                {!hasDocs && xref.note && <span className="text-lank/55">— {xref.note}</span>}
              </p>
            </div>
          )
        }

        // ── Corps : article ou préambule ──
        const showOldPreamble = preambleBodyNext // consommé par le bloc de corps suivant l'en-tête
        preambleBodyNext = false
        const cases = b.jurisKey ? juris[b.jurisKey] : undefined
        const comm = b.jurisKey ? commentMap[b.jurisKey] : undefined
        let subjects: Backlink[] | undefined
        if (b.anchor && !shownIndex.has(b.anchor)) {
          subjects = backlinks.get(b.anchor)
          if (subjects) shownIndex.add(b.anchor)
        }
        // Renvois d'index : sujets pointant vers d'AUTRES articles (cliquables), libellés nettoyés
        // (« définition ») et DÉDUPLIQUÉS (plusieurs sujets se nettoient parfois en un même terme
        // → on fusionne leurs articles). Les sujets sans renvoi (gris) sont retirés.
        const dedup = new Map<string, Set<ArtRef>>()
        for (const s of subjects ?? []) {
          if (s.refs.length === 0) continue
          const cs = cleanIndexSubject(s.subject)
          if (!cs) continue
          const cur = dedup.get(cs)
          if (cur) s.refs.forEach((r) => cur.add(r))
          else dedup.set(cs, new Set(s.refs))
        }
        const linked = [...dedup.entries()].map(([subject, refs]) => ({
          subject,
          refs: [...refs].sort((x, y) => String(x).localeCompare(String(y), undefined, { numeric: true })),
        }))
        const extra = (
          <>
            {!hideInlineIndex && linked.length > 0 && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="rounded bg-soley-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-soley-700">{lt(INDEX_LBL)}</span>
                {linked.slice(0, 8).map((s) => (
                  <span key={s.subject} className="text-[11px] text-lank/55">
                    {s.subject}
                    {' → '}
                    {s.refs.slice(0, 4).map((r, j, a) => (
                      <span key={String(r)}>
                        <a href={`#art-${r}`} className="font-semibold text-soley-700 hover:underline">
                          {prettyRef(r)}
                        </a>
                        {j < a.length - 1 ? ', ' : s.refs.length > 4 ? '…' : ''}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            )}
            {((cases && cases.length > 0) || (comm && comm.length > 0)) && (
              <Jurisprudence cases={cases ?? []} comments={comm} variant={annotationsVariant} locale={locale} />
            )}
          </>
        )

        // Article : badge « Article N » (porte l'ancre) + statut d'amendement + corps allégé de
        // son en-tête + ancienne version repliable (Constitution).
        if (b.anchor && LEAD_ART.test(b.text)) {
          const body = b.text.replace(LEAD_ART, '').trimStart()
          const label = labelsMap[b.anchor] ?? labelFromAnchor(b.anchor)
          const st = statusMap[b.anchor]
          const badge = st ? STATUS_BADGE[st] : undefined
          const old = oldVersions[b.anchor]
          const cx = connexeMap[b.anchor]
          return (
            <article key={i} className="scroll-mt-24 rounded-r-lg border-l-2 border-soley/20 pl-4 transition-colors hover:border-soley/60">
              <h4 id={b.noAnchors ? undefined : b.anchor} className="mb-1 flex scroll-mt-24 flex-wrap items-center gap-2">
                <span className="font-serif text-[15px] font-bold text-soley-700">{label}</span>
                {badge && (
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.cls}`}>{badge.fr}</span>
                )}
              </h4>
              <OfficialText text={body} locale={locale} terms={terms} noAnchors civRefs={linkCivRefs} />
              {(cx && cx.length > 0) || (old && annotationsVariant === 'annotations') ? (
                // Code civil : ancienne version + législation connexe dans un même pliable
                // (même sans bloc connexe — le libellé d'OldVersion est propre à la Constitution).
                <RelatedLaw old={old} blocks={cx} locale={locale} />
              ) : (
                old && <OldVersion text={old} locale={locale} />
              )}
              {extra}
            </article>
          )
        }
        return (
          <div key={i} className="scroll-mt-24">
            <OfficialText text={b.text} locale={locale} terms={terms} noAnchors={b.noAnchors} civRefs={linkCivRefs} />
            {showOldPreamble && oldPreamble && <OldVersion text={oldPreamble} locale={locale} />}
            {extra}
          </div>
        )
      })}
    </div>
  )
}
