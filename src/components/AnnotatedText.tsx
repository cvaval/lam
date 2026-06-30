import { OfficialText } from './OfficialText'
import { Jurisprudence } from './Jurisprudence'
import { segmentAnnotated, indexBacklinks, type Annotations } from '@/lib/legislation/annotated'
import type { Locale } from '@/lib/types'

const INDEX_LBL: Record<Locale, string> = { fr: 'Index', en: 'Index', ht: 'Endèks' }

/**
 * Lecteur d'un texte annoté (Code du travail) : rend le texte officiel (via OfficialText,
 * mise en forme d'AFFICHAGE) découpé en sections ancrées (#sec-N — pour la TOC et les
 * deep-links des lois connexes), avec la jurisprudence repliable injectée après chaque
 * article. bodyOriginal reste intact en base (§02) ; la jurisprudence vit dans annotationsJson.
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
  // Renvoi inverse de l'index (sujet ← article). On l'affiche sur la PREMIÈRE occurrence de
  // chaque art-N : le Code précède les annexes, donc l'index (qui cite les articles du Code)
  // se rattache au bon article, jamais à un article homonyme d'une annexe.
  const backlinks = indexBacklinks(annotations.indexEntries ?? [])
  const shownIndex = new Set<string>()
  const lt = (o: Record<Locale, string>) => o[locale] ?? o.fr

  return (
    <div className="space-y-1">
      {blocks.map((b, i) => {
        if (b.kind === 'section') {
          // En-tête de section : ancre #sec-N (cible TOC + deep-links connexes). Niveau 1
          // = division majeure (TITRE/ANNEXE), niveau 2 = sous-titre.
          if (b.level === 1) {
            return (
              <h3
                key={i}
                id={b.anchor}
                className="scroll-mt-24 border-t border-lank/10 pt-4 text-sm font-bold uppercase tracking-wide text-lank"
              >
                {b.text}
              </h3>
            )
          }
          return (
            <p key={i} id={b.anchor} className="scroll-mt-24 pt-1.5 font-semibold text-lank">
              {b.text}
            </p>
          )
        }
        // Corps d'article (ou préambule) : prose officielle + renvois d'index + jurisprudence.
        // Clé jurisprudence qualifiée par section (anti-collision Code ↔ annexes).
        const cases = b.jurisKey ? juris[b.jurisKey] : undefined
        let subjects: string[] | undefined
        if (b.anchor && !shownIndex.has(b.anchor)) {
          subjects = backlinks.get(b.anchor)
          if (subjects) shownIndex.add(b.anchor)
        }
        return (
          <div key={i}>
            <OfficialText text={b.text} locale={locale} terms={terms} noAnchors={b.noAnchors} />
            {subjects && subjects.length > 0 && (
              <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px] leading-relaxed text-lank/45">
                <span className="font-semibold uppercase tracking-wide text-lank/40">{lt(INDEX_LBL)}</span>
                {subjects.slice(0, 6).map((s, k, arr) => (
                  <span key={s}>
                    {s}
                    {k < arr.length - 1 && <span className="text-lank/25"> ·</span>}
                  </span>
                ))}
                {subjects.length > 6 && <span className="text-lank/35">+{subjects.length - 6}</span>}
              </p>
            )}
            {cases && cases.length > 0 && <Jurisprudence cases={cases} locale={locale} />}
          </div>
        )
      })}
    </div>
  )
}
