import { OfficialText } from './OfficialText'
import { Jurisprudence } from './Jurisprudence'
import { segmentAnnotated, indexBacklinks, type Annotations } from '@/lib/legislation/annotated'
import { labelFromAnchor } from '@/lib/legislation/articles'
import type { Locale } from '@/lib/types'

const INDEX_LBL: Record<Locale, string> = { fr: 'Index', en: 'Index', ht: 'Endèks' }
// En-tête « Article N.- » en tête d'un bloc d'article : retiré du corps (affiché en badge).
const LEAD_ART = /^Article\s+(?:premier|\d{1,3})\s*(?:er|ère|re|e|°)?\s*(?:bis|ter|quater)?\s*[.)\-–]+\s*/i

/**
 * Lecteur d'un texte annoté (Code du travail) : chaque article est une unité visuelle
 * (numéro en badge, accent latéral), suivie des renvois d'index et de la jurisprudence
 * repliable. bodyOriginal reste le texte officiel (§02) ; annotations = AFFICHAGE.
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
  const blocks = segmentAnnotated(text, annotations.toc)
  const juris = annotations.jurisprudence ?? {}
  // Renvoi inverse de l'index (sujet ← article), affiché sur la 1ʳᵉ occurrence de chaque art-N.
  const backlinks = indexBacklinks(annotations.indexEntries ?? [])
  const shownIndex = new Set<string>()
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        // ── En-tête de section ──
        if (b.kind === 'section') {
          if (b.level === 1) {
            return (
              <h3
                key={i}
                id={b.anchor}
                className="mt-7 flex scroll-mt-24 items-center gap-2.5 border-b-2 border-soley/30 pb-2 font-serif text-lg font-bold uppercase tracking-wide text-lank first:mt-0"
              >
                <span aria-hidden className="h-5 w-1.5 rounded-full bg-soley" />
                {b.text}
              </h3>
            )
          }
          return (
            <p key={i} id={b.anchor} className="scroll-mt-24 pt-1 text-sm font-semibold uppercase tracking-wide text-soley-700">
              {b.text}
            </p>
          )
        }

        // ── Corps : article ou préambule ──
        const cases = b.jurisKey ? juris[b.jurisKey] : undefined
        let subjects: string[] | undefined
        if (b.anchor && !shownIndex.has(b.anchor)) {
          subjects = backlinks.get(b.anchor)
          if (subjects) shownIndex.add(b.anchor)
        }
        // Annotations (renvois d'index + jurisprudence) communes aux deux rendus.
        const extra = (
          <>
            {subjects && subjects.length > 0 && (
              <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                <span className="rounded bg-soley-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-soley-700">
                  {lt(INDEX_LBL)}
                </span>
                {subjects.slice(0, 6).map((s, k, arr) => (
                  <span key={s} className="text-[11px] text-lank/55">
                    {s}
                    {k < arr.length - 1 && <span className="text-lank/25"> ·</span>}
                  </span>
                ))}
                {subjects.length > 6 && <span className="text-[11px] text-lank/40">+{subjects.length - 6}</span>}
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
        // Préambule / texte hors-article.
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
