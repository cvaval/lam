import Link from 'next/link'
import { parseOfficialText } from '@/lib/doc/officiel'
import { segmentText, type CircRef } from '@/lib/doc/crossref'
import { buildBodySegments, tableShortCaption, type RichBlock, type RichTable, type RichNote, type RichCell } from '@/lib/doc/richblocks'
import { TableActions } from './TableActions'
import type { Locale } from '@/lib/types'

const TABLE_LABEL: Record<Locale, string> = { fr: 'Tableau', en: 'Table', ht: 'Tablo' }
const ORPHAN_LABEL: Record<Locale, string> = { fr: 'emplacement approximatif', en: 'approximate position', ht: 'kote apwoksimatif' }
const SCROLL_HINT: Record<Locale, string> = { fr: 'Faites glisser pour voir tout le tableau', en: 'Swipe to see the full table', ht: 'Glise pou wè tout tablo a' }

// Cellule essentiellement numérique (montant, taux, %) → alignée à droite + chiffres
// tabulaires quand aucun alignement n'est donné. Conservateur : doit commencer par un
// chiffre et ne contenir que chiffres/séparateurs/devise (jamais « article 12 »).
function isNumericCell(s: string): boolean {
  const t = s.trim()
  if (!t || t.length > 24 || !/\d/.test(t)) return false
  return /^[(-]?\d[\d\s.,%)/-]*(\s?(HTG|USD|G|\$|%))?$/.test(t)
}

/**
 * Rendu structuré du texte officiel : puces, numérotations (marqueur original
 * conservé, jamais renuméroté), paragraphes recousus et intertitres — mise en
 * forme d'AFFICHAGE uniquement, bodyOriginal reste brut en base (§02).
 *
 * Liens croisés (circulaires BRH) : si hrefFor est fourni, les renvois à d'autres
 * circulaires deviennent des hyperliens ; les têtes d'article reçoivent une ancre.
 *
 * Tableaux & encadrés colorés : si `rich` est fourni (Document.richBlocksJson), la
 * zone aplatie par l'OCR est retirée du flux et remplacée par le rendu structuré
 * (couleurs déjà validées en hex en amont) — pas de doublon, prose inchangée.
 */
export function OfficialText({
  text,
  hrefFor,
  rich = [],
  locale = 'fr',
}: {
  text: string
  hrefFor?: (ref: CircRef) => string | null
  rich?: RichBlock[]
  locale?: Locale
}) {
  const segments = buildBodySegments(text, rich)
  const usedAnchors = new Set<string>()

  function markerAnchor(marker: string): string | undefined {
    if (!/^\(?\d{1,3}[.)\-–°]?\)?$/.test(marker)) return undefined
    const id = `art-${marker.replace(/\D/g, '')}`
    if (usedAnchors.has(id)) return undefined
    usedAnchors.add(id)
    return id
  }

  function headingAnchor(textLine: string): string | undefined {
    const m = textLine.match(/^(?:article|section)\s+(\d{1,3})\b/i)
    if (!m) return undefined
    const id = `art-${m[1]}`
    if (usedAnchors.has(id)) return undefined
    usedAnchors.add(id)
    return id
  }

  // Renvois croisés → liens, sinon texte brut.
  function render(textValue: string) {
    if (!hrefFor) return textValue
    const segs = segmentText(textValue, hrefFor)
    if (segs.length === 1 && !segs[0].href) return textValue
    return segs.map((s, i) =>
      s.href ? (
        <Link
          key={i}
          href={s.href}
          className="font-medium text-lank underline decoration-lank/30 underline-offset-2 hover:decoration-lank"
        >
          {s.text}
        </Link>
      ) : (
        <span key={i}>{s.text}</span>
      ),
    )
  }

  // Rendu d'un segment de texte (puces / numérotations / intertitres / paragraphes).
  function renderTextSegment(textValue: string, segKey: number) {
    return parseOfficialText(textValue).map((b, i) => {
      const key = `${segKey}-${i}`
      if (b.kind === 'ul') {
        return (
          <ul key={key} className="space-y-1.5 pl-2">
            {b.items.map((item, k) => (
              <li key={k} className="flex gap-2.5">
                <span aria-hidden className="select-none text-lank/45">
                  •
                </span>
                <span>{render(item)}</span>
              </li>
            ))}
          </ul>
        )
      }
      if (b.kind === 'ol') {
        return (
          <ol key={key} className="space-y-1.5 pl-2">
            {b.items.map((item, k) => {
              const id = markerAnchor(item.marker)
              return (
                <li key={k} id={id} className="flex scroll-mt-24 gap-2.5">
                  <span className="min-w-[2.5ch] shrink-0 font-semibold text-lank">{item.marker}</span>
                  <span>{render(item.text)}</span>
                </li>
              )
            })}
          </ol>
        )
      }
      if (b.heading) {
        const id = headingAnchor(b.text)
        return (
          <p key={key} id={id} className="scroll-mt-24 pt-1.5 font-semibold text-lank">
            {render(b.text)}
          </p>
        )
      }
      return <p key={key}>{render(b.text)}</p>
    })
  }

  function renderCell(cell: RichCell, c: number, isHeader: boolean, scope?: 'col' | 'row', sticky = false) {
    const Tag = isHeader ? 'th' : 'td'
    // Couleurs = palette Lam (jamais les hex bruts du PDF) : en-tête → soley-50,
    // cellule ombrée non-en-tête → paper. `cell.bg` ne sert que d'indicateur d'ombrage.
    const shade = isHeader ? 'bg-soley-50' : cell.bg ? 'bg-paper' : ''
    // Alignement : explicite prioritaire ; sinon les nombres se calent à droite.
    const auto = !isHeader && !cell.align && isNumericCell(cell.text)
    const align = cell.align ?? (auto ? 'right' : undefined)
    return (
      <Tag
        key={c}
        scope={scope}
        colSpan={cell.colSpan}
        rowSpan={cell.rowSpan}
        style={align ? { textAlign: align } : undefined}
        className={`border border-lank/20 px-2.5 py-1.5 align-top text-lank/90 ${shade} ${auto ? 'tabular-nums' : ''} ${
          sticky ? 'sticky top-0 z-10' : ''
        } ${isHeader || cell.bold ? 'font-semibold text-lank' : ''}`}
      >
        {render(cell.text)}
      </Tag>
    )
  }

  function renderTable(t: RichTable, key: string, num: number, orphan = false) {
    // En-tête sémantique : si la 1re ligne est entièrement en-tête → <thead> + scope.
    const firstAllHeader = t.rows[0]?.length > 0 && t.rows[0].every((c) => c.header)
    const headerRow = firstAllHeader ? t.rows[0] : null
    const bodyRows = firstAllHeader ? t.rows.slice(1) : t.rows
    // Légende numérotée (« Tableau N ») — AFFICHAGE seulement, jamais en base (§02).
    const cap = tableShortCaption(t)
    const caption = `${TABLE_LABEL[locale] ?? TABLE_LABEL.fr} ${num}${cap ? ' — ' + cap : ''}`
    // Tableau long → panneau défilant à hauteur bornée pour que l'en-tête figé (sticky)
    // fonctionne ; sinon simple défilement horizontal. Large → indice de défilement mobile.
    const longTable = bodyRows.length > 20
    const wide = Math.max(1, ...t.rows.map((r) => r.reduce((n, c) => n + (c.colSpan ?? 1), 0))) >= 4
    return (
      <figure key={key} id={`tableau-${num}`} className="my-4 scroll-mt-24">
        <div className="mb-1.5 flex items-start justify-between gap-3">
          <figcaption className="text-sm font-semibold text-lank">
            {caption}
            {orphan && <span className="ml-2 text-xs font-normal text-lank/45">({ORPHAN_LABEL[locale] ?? ORPHAN_LABEL.fr})</span>}
          </figcaption>
          <TableActions rows={t.rows} locale={locale} />
        </div>
        <div
          role="region"
          aria-label={caption}
          tabIndex={0}
          className={longTable ? 'max-h-[78vh] overflow-auto rounded-md border border-lank/10' : 'overflow-x-auto'}
        >
          <table className="w-full border-collapse text-[13px] text-lank/90">
            <caption className="sr-only">{caption}</caption>
            {headerRow && <thead><tr>{headerRow.map((cell, c) => renderCell(cell, c, true, 'col', true))}</tr></thead>}
            <tbody>
              {bodyRows.map((row, r) => (
                <tr key={r}>{row.map((cell, c) => renderCell(cell, c, !!cell.header, cell.header && c === 0 ? 'row' : undefined))}</tr>
              ))}
            </tbody>
          </table>
        </div>
        {wide && <p className="mt-1 text-xs text-lank/40 sm:hidden">↔ {SCROLL_HINT[locale] ?? SCROLL_HINT.fr}</p>}
      </figure>
    )
  }

  function renderNote(n: RichNote, key: string) {
    // Encadré/cartouche aux couleurs Lam : fond soley-50, bordure soley (couleur
    // du type « Circulaires BRH ») — les hex du PDF ne sont jamais appliqués.
    return (
      <p
        key={key}
        className="my-3 rounded-lg border border-soley/40 bg-soley-50 px-4 py-2.5 text-sm leading-relaxed text-lank/90"
      >
        {render(n.text)}
      </p>
    )
  }

  let tableNo = 0 // numérotation « Tableau N » par ordre d'AFFICHAGE (orphelins en fin inclus)
  return (
    <div className="official-text space-y-3 text-[15px] text-lank/90">
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return renderTextSegment(seg.text, i)
        if (seg.block.type === 'table') {
          tableNo += 1
          return renderTable(seg.block, `rich-${i}`, tableNo, seg.orphan)
        }
        return renderNote(seg.block, `rich-${i}`)
      })}
    </div>
  )
}
