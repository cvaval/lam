import Link from 'next/link'
import type { ReactNode } from 'react'
import { parseOfficialText } from '@/lib/doc/officiel'
import { articleAnchorFromHeading, articleAnchorFromNum } from '@/lib/doc/anchors'
import { segmentText, type CircRef } from '@/lib/doc/crossref'
import { buildBodySegments, tableShortCaption, type RichBlock, type RichTable, type RichNote, type RichCell } from '@/lib/doc/richblocks'
import { TableActions } from './TableActions'
import { TableFilter } from './TableFilter'
import { highlightRegex } from '@/lib/search/highlight'
import type { Locale } from '@/lib/types'

const TABLE_LABEL: Record<Locale, string> = { fr: 'Tableau', en: 'Table', ht: 'Tablo' }
const ORPHAN_LABEL: Record<Locale, string> = { fr: 'emplacement approximatif', en: 'approximate position', ht: 'kote apwoksimatif' }
const SCROLL_HINT: Record<Locale, string> = { fr: 'Faites glisser pour voir tout le tableau', en: 'Swipe to see the full table', ht: 'Glise pou wè tout tablo a' }

// Renvois internes du Code civil annoté (« C. civ., 969, 1102 et s. », « 1839-1843 ») :
// la liste de numéros qui suit « C. civ. » devient des liens #art-N — AFFICHAGE seulement,
// le texte officiel reste inchangé (§02). « C. pr. civ. » / « C.p.c » ne matchent pas ;
// « c. civ. » minuscule (variantes du texte) matche (/i). Numéros jusqu'à 6 chiffres capturés
// pour couvrir les rares réfs OCR non désambiguïsables — le lien n'est émis que pour 1..2047.
const CIV_MAX_ART = 2047
const CIV_RE =
  /C\.\s?civ\.[\s,]*((?:\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)(?:\s*(?:,|;|et)\s*\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)*)/gi

// Mentions internes « la loi No 20 » / « loi Nº 16 » (Code civil : le Code est organisé en
// LOIS) → lien vers l'en-tête de la LOI correspondante (#sec-N), via la carte `loiAnchors`.
const LOI_RE = /\bloi\s+N[oº°]\.?\s*:?\s*(\d{1,2})\b/gi

// Renvois internes du Code pénal : « l'article 240 », « les articles 63, 64 et 68 » → liens
// #art-N. Le Code pénal se cite par le NUMÉRO NU (pas de préfixe « C. pén. ») ; on ne lie donc
// que si (1) le numéro EST réellement un article du Code (`artRefs`, anti-lien-mort) et (2) le
// renvoi n'est PAS externe (« art. 2 DU DÉCRET… », « article 5 DE LA LOI… », « du code
// d'instruction criminelle ») — « du présent code » reste un renvoi interne (donc lié).
const ART_REF_RE =
  /\b(?:articles?|art\.)\s+\d{1,3}(?!\d)(?:\s*(?:bis|ter))?(?:\s*(?:,|;|et|à)\s*\d{1,3}(?!\d)(?:\s*(?:bis|ter))?)*/gi
const ART_NUM_RE = /(\d{1,3}(?!\d)(?:\s*(?:bis|ter))?)/i
const ART_EXT_AFTER = /^\s*(?:du|de\s+la|de\s+l['’]|des)\s+(?:d[ée]cret|loi|ordonnance|arr[êe]t[ée]|constitution|code\s+d)/i

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
  terms,
  amendedAnchors,
  noAnchors = false,
  civRefs = false,
  artRefs,
  loiAnchors,
}: {
  text: string
  hrefFor?: (ref: CircRef) => string | null
  rich?: RichBlock[]
  locale?: Locale
  /** termes recherchés à surligner (folés) — propagés depuis ?q= au clic d'un résultat */
  terms?: string[]
  /** ancres d'articles amendés → marqueur « ✎ modifié » renvoyant vers l'historique. */
  amendedAnchors?: Set<string>
  /** supprime l'émission d'ancres #art-N (ex. articles d'annexe à numérotation propre,
   *  pour ne pas dupliquer les id des articles du Code). */
  noAnchors?: boolean
  /** Code civil annoté : rend cliquables les renvois « C. civ., N » (liens #art-N). */
  civRefs?: boolean
  /** Code pénal annoté : ensemble des ancres d'articles existantes (« art-240 », « art-19-bis »).
   *  Rend cliquables les renvois internes « l'article N » / « les articles N, M » (liens #art-N),
   *  uniquement vers un article RÉEL et hors renvoi à un autre texte (décret/loi/…). */
  artRefs?: Set<string>
  /** Numéro de LOI interne → ancre de section (« 20 » → « sec-193 ») : rend cliquables
   *  les mentions « la loi No 20 » du corps (liens #sec-N). */
  loiAnchors?: Record<string, string>
}) {
  const segments = buildBodySegments(text, rich)
  const usedAnchors = new Set<string>()
  const hlRe = terms && terms.length ? highlightRegex(terms) : null

  // Surligne les termes recherchés dans un texte brut (split sur le groupe capturé).
  function hl(value: string) {
    if (!hlRe) return value
    const parts = value.split(hlRe)
    if (parts.length <= 1) return value
    return parts.map((p, i) => (i % 2 === 1 ? <mark key={i} className="hl">{p}</mark> : p))
  }

  function markerAnchor(marker: string): string | undefined {
    if (noAnchors) return undefined
    if (!/^\(?\d{1,3}[.)\-–°]?\)?$/.test(marker)) return undefined
    const id = `art-${marker.replace(/\D/g, '')}`
    if (usedAnchors.has(id)) return undefined
    usedAnchors.add(id)
    return id
  }

  function headingAnchor(textLine: string): string | undefined {
    if (noAnchors) return undefined
    // Normalisation partagée avec CodeThemeBrowser (gère « 1er »/« premier » et bis/ter).
    const id = articleAnchorFromHeading(textLine)
    if (!id || usedAnchors.has(id)) return undefined
    usedAnchors.add(id)
    return id
  }

  // Marqueur « ✎ modifié » sur un article amendé → lien vers son historique (#hist-art-N).
  function amendMark(id: string | undefined) {
    if (!id || !amendedAnchors?.has(id)) return null
    return (
      <a href={`#hist-${id}`} className="ml-1.5 align-super text-[10px] font-semibold text-sitwon-600 no-underline hover:underline" title="Article amendé — voir l'historique">
        ✎ modifié
      </a>
    )
  }

  // Mentions « la loi No 20 » → lien vers l'en-tête de la LOI (#sec-N) ; le reste passe
  // par hl(). Ne s'active que si `loiAnchors` connaît le numéro (sinon texte inchangé).
  function loiLinks(value: string): ReactNode {
    if (!loiAnchors) return hl(value)
    const out: ReactNode[] = []
    let pos = 0
    let k = 0
    LOI_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = LOI_RE.exec(value))) {
      const anchor = loiAnchors[m[1]]
      if (!anchor) continue
      out.push(<span key={`p${k++}`}>{hl(value.slice(pos, m.index))}</span>)
      out.push(
        <a key={`l${k++}`} href={`#${anchor}`} className="font-medium text-soley-700 hover:underline">
          {m[0]}
        </a>,
      )
      pos = m.index + m[0].length
    }
    if (!out.length) return hl(value)
    out.push(<span key={`p${k++}`}>{hl(value.slice(pos))}</span>)
    return out
  }

  // Renvois « C. civ., 969, 1102 » → chaque numéro devient un lien #art-N ; le reste du
  // texte passe par loiLinks() puis hl(). Retourne la valeur telle quelle si aucun renvoi.
  // Le lien n'est émis que pour un numéro d'article PLAUSIBLE (1..2047) — un numéro OCR
  // résiduel reste en texte simple plutôt qu'en lien mort. Dans une paire « A-B », un B
  // plus court que A est un ordinal/alinéa (« 2102-4 »), pas un article → pas de lien.
  function civ(value: string): ReactNode {
    const out: ReactNode[] = []
    let pos = 0
    let k = 0
    CIV_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = CIV_RE.exec(value))) {
      const numsStart = m.index + m[0].length - m[1].length
      out.push(<span key={`t${k++}`}>{loiLinks(value.slice(pos, numsStart))}</span>)
      const parts = m[1].split(/(\d+)/)
      out.push(
        <span key={`c${k++}`}>
          {parts.map((p, j) => {
            if (!/^\d+$/.test(p)) return p
            const n = Number(p)
            const prevNum = parts[j - 2] // numéro précédant un éventuel tiret (paire « A-B »)
            const afterDash = j >= 2 && /^\s*[-–]\s*$/.test(parts[j - 1] ?? '')
            const ordinal = afterDash && typeof prevNum === 'string' && p.length < prevNum.length
            if (n < 1 || n > CIV_MAX_ART || ordinal) return p
            return (
              <a key={j} href={`#art-${n}`} className="font-medium text-soley-700 hover:underline">
                {p}
              </a>
            )
          })}
        </span>,
      )
      pos = m.index + m[0].length
    }
    if (!out.length) return loiLinks(value)
    out.push(<span key={`t${k++}`}>{loiLinks(value.slice(pos))}</span>)
    return out
  }

  // Renvois internes du Code pénal « l'article 240 » / « les articles 63, 64 et 68 » → chaque
  // numéro qui EST un article du Code (artRefs) devient un lien #art-N ; les renvois EXTERNES
  // (« art. 2 du décret… ») sont laissés en texte. Le reste passe par hl().
  function artLinks(value: string): ReactNode {
    if (!artRefs) return hl(value)
    const out: ReactNode[] = []
    let pos = 0
    let k = 0
    ART_REF_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = ART_REF_RE.exec(value))) {
      if (ART_EXT_AFTER.test(value.slice(m.index + m[0].length))) continue // renvoi à un autre texte
      out.push(<span key={`t${k++}`}>{hl(value.slice(pos, m.index))}</span>)
      const parts = m[0].split(ART_NUM_RE)
      out.push(
        <span key={`a${k++}`}>
          {parts.map((p, j) => {
            if (!/^\d/.test(p)) return p
            const anchor = articleAnchorFromNum(p.trim())
            if (!artRefs.has(anchor)) return p
            return (
              <a key={j} href={`#${anchor}`} className="font-medium text-soley-700 hover:underline">
                {p}
              </a>
            )
          })}
        </span>,
      )
      pos = m.index + m[0].length
    }
    if (!out.length) return hl(value)
    out.push(<span key={`t${k++}`}>{hl(value.slice(pos))}</span>)
    return out
  }

  // Renvois croisés → liens, sinon texte brut ; termes recherchés surlignés (hl).
  function render(textValue: string) {
    if (!hrefFor) return civRefs ? civ(textValue) : artRefs ? artLinks(textValue) : hl(textValue)
    const segs = segmentText(textValue, hrefFor)
    if (segs.length === 1 && !segs[0].href) return hl(textValue)
    return segs.map((s, i) =>
      s.href ? (
        <Link
          key={i}
          href={s.href}
          className="font-medium text-lank underline decoration-lank/30 underline-offset-2 hover:decoration-lank"
        >
          {hl(s.text)}
        </Link>
      ) : (
        <span key={i}>{hl(s.text)}</span>
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
            {amendMark(id)}
          </p>
        )
      }
      // Les articles longs (« Article 12.- … ») ne sont pas des intertitres mais doivent
      // tout de même porter une ancre #art-N (renvois croisés, index thématique).
      const pid = headingAnchor(b.text)
      return (
        <p key={key} id={pid} className={pid ? 'scroll-mt-24' : undefined}>
          {render(b.text)}
          {amendMark(pid)}
        </p>
      )
    })
  }

  function renderCell(cell: RichCell, c: number, isHeader: boolean, scope?: 'col' | 'row', sticky = false) {
    const Tag = isHeader ? 'th' : 'td'
    // Couleurs = palette Lam (jamais les hex bruts du PDF) : en-tête → soley-50,
    // cellule ombrée non-en-tête → ton soley translucide (lit la zébrure du <tr> par
    // transparence au lieu de la masquer comme un fond opaque). `cell.bg` = indicateur d'ombrage.
    const shade = isHeader ? 'bg-soley-50' : cell.bg ? 'bg-soley-100/50' : ''
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
    const longTable = bodyRows.length > 12 // borne la hauteur + en-tête figé dès ~13 lignes
    const wide = Math.max(1, ...t.rows.map((r) => r.reduce((n, c) => n + (c.colSpan ?? 1), 0))) >= 4
    // Filtre masquant des <tr> : sûr seulement sans fusion verticale (sinon un rowSpan
    // masqué décale/efface des colonnes des lignes dépendantes).
    const hasRowSpan = bodyRows.some((row) => row.some((c) => (c.rowSpan ?? 1) > 1))
    const showFilter = bodyRows.length >= 8 && !hasRowSpan
    return (
      <figure key={key} id={`tableau-${num}`} className="my-4 scroll-mt-24">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <figcaption className="text-sm font-semibold text-lank">
            {caption}
            {orphan && <span className="ml-2 text-xs font-normal text-lank/45">({ORPHAN_LABEL[locale] ?? ORPHAN_LABEL.fr})</span>}
          </figcaption>
          <div className="flex items-center gap-2">
            {showFilter && <TableFilter total={bodyRows.length} locale={locale} />}
            <TableActions rows={t.rows} locale={locale} />
          </div>
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
                // Zébrage piloté par classe (et non :nth-child) pour rester correct après
                // filtrage : TableFilter recalcule .zebra sur les lignes visibles.
                <tr key={r} className={r % 2 === 1 ? 'zebra' : undefined}>
                  {row.map((cell, c) => renderCell(cell, c, !!cell.header, cell.header && c === 0 ? 'row' : undefined))}
                </tr>
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
