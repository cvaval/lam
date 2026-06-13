import Link from 'next/link'
import { parseOfficialText } from '@/lib/doc/officiel'
import { segmentText, type CircRef } from '@/lib/doc/crossref'
import { buildBodySegments, type RichBlock, type RichTable, type RichNote } from '@/lib/doc/richblocks'

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
}: {
  text: string
  hrefFor?: (ref: CircRef) => string | null
  rich?: RichBlock[]
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

  function renderTable(t: RichTable, key: string) {
    return (
      <figure key={key} className="my-4 overflow-x-auto">
        {t.caption && <figcaption className="mb-1.5 text-sm font-semibold text-lank">{t.caption}</figcaption>}
        <table className="w-full border-collapse text-[13px] text-lank/90">
          <tbody>
            {t.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => {
                  const Tag = cell.header ? 'th' : 'td'
                  // Couleurs = palette Lam (jamais les hex bruts du PDF) : en-tête →
                  // soley-50 (couleur du type « Circulaires BRH »), cellule ombrée
                  // non-en-tête → paper. `cell.bg` ne sert que d'indicateur d'ombrage.
                  const shade = cell.header ? 'bg-soley-50' : cell.bg ? 'bg-paper' : ''
                  return (
                    <Tag
                      key={c}
                      colSpan={cell.colSpan}
                      rowSpan={cell.rowSpan}
                      style={cell.align ? { textAlign: cell.align } : undefined}
                      className={`border border-lank/20 px-2.5 py-1.5 align-top text-lank/90 ${shade} ${
                        cell.header || cell.bold ? 'font-semibold text-lank' : ''
                      }`}
                    >
                      {render(cell.text)}
                    </Tag>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
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

  return (
    <div className="official-text space-y-3 text-[15px] text-lank/90">
      {segments.map((seg, i) =>
        seg.kind === 'text'
          ? renderTextSegment(seg.text, i)
          : seg.block.type === 'table'
            ? renderTable(seg.block, `rich-${i}`)
            : renderNote(seg.block, `rich-${i}`),
      )}
    </div>
  )
}
