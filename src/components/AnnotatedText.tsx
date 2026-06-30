import { OfficialText } from './OfficialText'
import { Jurisprudence } from './Jurisprudence'
import { segmentAnnotated, indexBacklinks, type Annotations, type Backlink } from '@/lib/legislation/annotated'
import { labelFromAnchor } from '@/lib/legislation/articles'
import type { Locale } from '@/lib/types'

const INDEX_LBL: Record<Locale, string> = { fr: 'Index', en: 'Index', ht: 'Endèks' }
// En-tête « Article N.- » en tête d'un bloc d'article : retiré du corps (affiché en badge).
const LEAD_ART = /^Article\s+(?:premier|\d{1,3})\s*(?:er|ère|re|e|°)?\s*(?:bis|ter|quater)?\s*[.)\-–]+\s*/i

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
}: {
  text: string
  annotations: Annotations
  locale?: Locale
  terms?: string[]
}) {
  const blocks = segmentAnnotated(text, annotations.toc ?? [])
  const juris = annotations.jurisprudence ?? {}
  const backlinks = indexBacklinks(annotations.indexEntries ?? [])
  const crossRefMap = new Map((annotations.crossRefs ?? []).map((c) => [c.anchor, c]))
  const shownIndex = new Set<string>()
  let titleShown = false // 1ʳᵉ ligne de la page de titre = plus grande (déterministe, sans `first:`)
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        // ── En-têtes de section ──
        if (b.kind === 'section') {
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
          // Renvoi croisé éditorial vers des articles du Code (ex. Liberté syndicale → art. 225).
          return (
            <div key={i}>
              {header}
              <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded-md border border-sitwon/30 bg-sitwon-50 px-3 py-1.5 text-[11.5px] text-lank/75">
                <span className="font-bold uppercase tracking-wide text-sitwon-700">↪ Renvoi au Code&nbsp;:</span>
                {xref.articles.map((n, k, arr) => (
                  <span key={n}>
                    <a href={`#art-${n}`} className="font-semibold text-sitwon-700 hover:underline">
                      article {n}
                    </a>
                    {k < arr.length - 1 && <span className="text-lank/30">, </span>}
                  </span>
                ))}
                {xref.note && <span className="text-lank/55">— {xref.note}</span>}
              </p>
            </div>
          )
        }

        // ── Corps : article ou préambule ──
        const cases = b.jurisKey ? juris[b.jurisKey] : undefined
        let subjects: Backlink[] | undefined
        if (b.anchor && !shownIndex.has(b.anchor)) {
          subjects = backlinks.get(b.anchor)
          if (subjects) shownIndex.add(b.anchor)
        }
        const extra = (
          <>
            {subjects && subjects.length > 0 && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="rounded bg-soley-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-soley-700">{lt(INDEX_LBL)}</span>
                {subjects.slice(0, 8).map((s) => (
                  <span key={s.subject} className="text-[11px] text-lank/55">
                    {s.subject}
                    {s.refs.length > 0 && (
                      <>
                        {' → '}
                        {s.refs.slice(0, 4).map((r, j, a) => (
                          <span key={r}>
                            <a href={`#art-${r}`} className="font-semibold text-soley-700 hover:underline">
                              {r}
                            </a>
                            {j < a.length - 1 ? ', ' : s.refs.length > 4 ? '…' : ''}
                          </span>
                        ))}
                      </>
                    )}
                  </span>
                ))}
              </div>
            )}
            {cases && cases.length > 0 && <Jurisprudence cases={cases} locale={locale} />}
          </>
        )

        // Article : badge « Article N » (porte l'ancre) + corps allégé de son en-tête.
        if (b.anchor && LEAD_ART.test(b.text)) {
          const body = b.text.replace(LEAD_ART, '').trimStart()
          return (
            <article key={i} className="scroll-mt-24 rounded-r-lg border-l-2 border-soley/20 pl-4 transition-colors hover:border-soley/60">
              <h4 id={b.noAnchors ? undefined : b.anchor} className="mb-1 scroll-mt-24 font-serif text-[15px] font-bold text-soley-700">
                {labelFromAnchor(b.anchor)}
              </h4>
              <OfficialText text={body} locale={locale} terms={terms} noAnchors />
              {extra}
            </article>
          )
        }
        return (
          <div key={i} className="scroll-mt-24">
            <OfficialText text={b.text} locale={locale} terms={terms} noAnchors={b.noAnchors} />
            {extra}
          </div>
        )
      })}
    </div>
  )
}
