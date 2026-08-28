import Link from 'next/link'
import type { ReactNode } from 'react'
import { parseOfficialText } from '@/lib/doc/officiel'
import { articleAnchorFromHeading, articleAnchorFromNum } from '@/lib/doc/anchors'
import { ART_REF_RE, ART_OR_SEC_REF_RE, ART_NUM_RE, ART_EXT_AFTER, ART_EXT_BEFORE, ART_EXT_DESIGNATION } from '@/lib/doc/artrefs'
import { segmentText, type CircRef } from '@/lib/doc/crossref'
import { segmentCodeRefs, type CodeKey } from '@/lib/doc/coderefs'
import { codeArticleHref, CODE_LINK_CLS, CODE_NOM, type CodeHrefs } from './CodeRefText'
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

/** Comparaison de dénominations insensible aux accents (« pénal » ≡ « penal »). */
function sansAccent(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}
// « Civ., 51 et s » : le recueil laisse parfois tomber le « C. » (10 renvois du Code
// civil). Le point après « Civ » reste exigé, et un mot-frontière devant : « Cass. civ »
// n'existe pas dans ce corpus, mais la sentinelle coûte moins qu'un faux lien.
const CIV_RE =
  /(?<!\bproc[\wé]*\.\s{0,2})(?<!\bpr?\.\s{0,2})(?<![\w.])(?:C\.\s?)?civ\.[\s,]*((?:\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)(?:\s*(?:,|;|et)\s*\d{1,6}(?:\s*(?:[-–]|à)\s*\d{1,6})?(?:\s+(?:et\s+)?s\b\.?)?)*)/gi

// Mentions internes « la loi No 20 » / « loi Nº 16 » (Code civil : le Code est organisé en
// LOIS) → lien vers l'en-tête de la LOI correspondante (#sec-N), via la carte `loiAnchors`.
const LOI_RE = /\bloi\s+N[oº°]\.?\s*:?\s*(\d{1,2})\b/gi

// Cellule essentiellement numérique (montant, taux, %) → alignée à droite + chiffres
// tabulaires quand aucun alignement n'est donné. Conservateur : doit commencer par un
// chiffre et ne contenir que chiffres/séparateurs/devise (jamais « article 12 »).
function isNumericCell(s: string): boolean {
  const t = s.trim()
  if (!t || t.length > 24 || !/\d/.test(t)) return false
  return /^[(-]?\d[\d\s.,%)/-]*(\s?(HTG|USD|G|\$|%))?$/.test(t)
}

/**
 * Pastille d'état d'un article — un seul des trois cas à la fois.
 *
 *   `modifie` « Modifié »           → #hist-art-N, l'ancienne rédaction
 *   `abroge`  « Texte abrogé »      → #hist-art-N, le texte qui a été abrogé
 *   `ajout`   « Ajout — <acte> »    → la fiche de l'acte qui a inséré l'article
 */
export interface ArticleMark {
  kind: 'modifie' | 'abroge' | 'ajout'
  /** Libellé visible, court : la pastille vit dans une ligne de prose. */
  label: string
  /** Infobulle : le TITRE COMPLET de l'acte — deux textes peuvent partager une date. */
  title: string
  /** `#hist-art-N` (ancre interne) ou le chemin d'un document. */
  href: string
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
  articleMarks,
  noAnchors = false,
  civRefs = false,
  artRefs,
  sectionRefs = false,
  loiAnchors,
  codeHrefs,
  ownCode,
}: {
  text: string
  hrefFor?: (ref: CircRef) => string | null
  rich?: RichBlock[]
  locale?: Locale
  /** termes recherchés à surligner (folés) — propagés depuis ?q= au clic d'un résultat */
  terms?: string[]
  /** Pastille d'état par ancre d'article : réécrit, abrogé, ou ajouté. Une seule par
   *  article — les trois états s'excluent. Cf. `ArticleMark`. */
  articleMarks?: Map<string, ArticleMark>
  /** supprime l'émission d'ancres #art-N (ex. articles d'annexe à numérotation propre,
   *  pour ne pas dupliquer les id des articles du Code). */
  noAnchors?: boolean
  /** Code civil annoté : rend cliquables les renvois « C. civ., N » (liens #art-N). */
  civRefs?: boolean
  /** Code pénal annoté : ensemble des ancres d'articles existantes (« art-240 », « art-19-bis »).
   *  Rend cliquables les renvois internes « l'article N » / « les articles N, M » (liens #art-N),
   *  uniquement vers un article RÉEL et hors renvoi à un autre texte (décret/loi/…). */
  artRefs?: Set<string>
  /** Circulaires BRH : leurs divisions se citent « la section 7 », « les sections 4.2.1 et
   *  5.3 ». Étend le renvoi interne au mot « section » — réservé aux documents dont les
   *  divisions SONT les sections (ailleurs, « section 3 » n'est pas l'article 3). */
  sectionRefs?: boolean
  /** Numéro de LOI interne → ancre de section (« 20 » → « sec-193 ») : rend cliquables
   *  les mentions « la loi No 20 » du corps (liens #sec-N). */
  loiAnchors?: Record<string, string>
  /** Chemins des codes cités (« /fr/doc/cms7u… ») : les renvois « C. p. c. » et
   *  « C. pén. » du Code civil deviennent des liens SORTANTS vers ces documents, ancrés
   *  sur l'article cité quand il existe. Absent → aucun changement de rendu. */
  codeHrefs?: CodeHrefs
  /** Dénomination du code courant (« civil », « pénal ») : « l'article N du Code civil »
   *  lu DANS le Code civil est un renvoi interne, pas un renvoi à un autre texte. */
  ownCode?: string
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

  /**
   * ── LES TROIS PASTILLES D'ÉTAT ────────────────────────────────────────────────────────
   *
   * Un texte modificatif peut faire trois choses à un article : le RÉÉCRIRE, l'ABROGER, ou en
   * AJOUTER un qui n'existait pas. Chaque état porte son libellé, et chaque libellé mène
   * quelque part — à l'ancienne rédaction, au texte abrogé, ou à l'acte qui a inséré l'article.
   *
   * ⚠️ « ✎ MODIFIÉ » SE POSAIT AUSSI SUR LES ARTICLES ABROGÉS. On lisait « Article 110.-
   * [Abrogé] ✎ modifié » : le marqueur contredisait la ligne qu'il suivait. 95 articles sur
   * six textes étaient dans ce cas — Code civil (60), Code de commerce (13), décret Casinos
   * de 1960 (9), Administration Centrale (5), loi Loterie de 1958 (4), Code pénal (4).
   *
   * ⚠️ ET L'ABROGÉ NE RÉPÈTE PAS SON ÉTAT. Le corps affiche déjà « [Abrogé — <acte>] » :
   * la pastille y offre donc l'ACTION qui manque — lire le texte qui a été abrogé — au lieu
   * de redire ce qui est écrit une ligne plus haut. Le réécrit, lui, n'annonce rien dans le
   * corps : sa pastille doit porter l'état.
   *
   * ⚠️ AUCUNE N'EMPRUNTE D'ACCENT DE MARQUE. Sitwon est le trait du CERTIFICATEUR, RATIONNÉ à
   * une occurrence d'interface par écran (charte Klinik v3, avenant AV-02) — et le Code civil
   * afficherait à lui seul 60 articles abrogés. Toutes reprennent donc le vocabulaire NEUTRE
   * des pastilles de type : filet Liy fonsé, fond Pil, texte Chabon.
   */
  const CHIP_ETAT =
    'ml-2 inline-flex items-center whitespace-nowrap rounded-md border border-liy-fonse bg-pil ' +
    'px-2 py-0.5 align-middle text-[11px] font-semibold leading-[1.45] text-chabon no-underline ' +
    // ⚠️ CIBLE TACTILE. La pastille mesure 11 px de texte : à 17 px de haut, elle se manque au
    // doigt. Le pseudo-élément étend la zone cliquable à ~40 px SANS toucher au rythme des
    // lignes — un `py` suffisant, lui, écarterait les lignes de tout le corpus.
    'relative after:absolute after:inset-x-0 after:-inset-y-[11px] after:content-[""] ' +
    'hover:border-chabon hover:underline ' +
    // ⚠️ ET ELLE SE PREND AU CLAVIER. Aucun des marqueurs n'avait d'anneau de focus : à la
    // tabulation, le lecteur ne voyait pas où il était.
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chabon'

  function chipEtat(m: ArticleMark, key: string) {
    const inner = <>{m.label}</>
    return m.href.startsWith('#') ? (
      <a key={key} href={m.href} className={CHIP_ETAT} title={m.title}>
        {inner}
      </a>
    ) : (
      <Link key={key} href={m.href} className={CHIP_ETAT} title={m.title}>
        {inner}
      </Link>
    )
  }

  function etatMark(id: string | undefined) {
    const m = id ? articleMarks?.get(id) : undefined
    return m ? chipEtat(m, 'etat') : null
  }

  /**
   * Tête d'article, pour glisser la pastille JUSTE APRÈS le numéro.
   *
   * ⚠️ ELLE COUPAIT LES NUMÉROS À TIRET EN DEUX. Le motif d'hier cherchait un tiret après le
   * numéro : sur « Art. 1774-1 » il s'arrêtait au tiret INTERNE, et le lecteur lisait
   * « Art. 1774- [Ajout — …] 1 Une sûreté est… ». Les 57 articles des sûretés et les trois des
   * régimes matrimoniaux étaient tous dans ce cas. Le numéro se prend donc en ENTIER.
   *
   * ⚠️ ET TOUTES LES TÊTES NE PORTENT PAS DE SÉPARATEUR. Le Code civil écrit « Art. 3 Aucune
   * loi ne peut être abrogée », et « Art. 55 (D. du 14 novembre 1988, art. 1) Les déclarations
   * de naissance… » quand l'éditeur nomme l'acte. Sans ces deux formes, la pastille de ces
   * articles-là repartait en fin de paragraphe.
   */
  const TETE_ART =
    /^((?:Article|Art)\.?\s+\d+(?:er|ᵉʳ)?(?:[.-]\d+)*(?:\s+(?:bis|ter|quater|quinquies))?(?:\s*\.?\s*[—–-])?(?:\s*\([^)]{0,70}\))?\.?)\s*/

  /**
   * Le corps d'un article, pastille d'état comprise.
   *
   * ⚠️ LA PASTILLE SE PLACE APRÈS LE NUMÉRO, PAS EN FIN DE PARAGRAPHE. Mise à la suite du
   * texte — comme l'était le discret « ✎ modifié » —, elle atterrissait quinze lignes plus
   * bas, à la fin d'une énumération, parfois seule sur sa ligne : le lecteur qui parcourt les
   * têtes d'articles ne la voyait pas, et c'est précisément à lui qu'elle s'adresse.
   */
  function articleBody(textValue: string, id: string | undefined) {
    const chip = etatMark(id)
    if (!chip) return render(textValue)
    const m = TETE_ART.exec(textValue)
    if (!m) return [render(textValue), chip]
    return [<span key="t">{render(m[1])}</span>, chip, <span key="r"> {render(textValue.slice(m[1].length))}</span>]
  }

  // Terminaison de la chaîne de rendu : les renvois « l'article N » d'abord (si le document
  // fournit ses ancres), puis le surlignage. Sans ce relais, `civRefs` et `artRefs`
  // s'excluaient — le Code civil liait « C. civ., 969 » mais laissait « conformément à
  // l'article 170 » en texte mort (constat : arts 48, 79, 173, 183, 323…).
  function txt(value: string): ReactNode {
    return artRefs ? artLinks(value) : hl(value)
  }

  // Mentions « la loi No 20 » → lien vers l'en-tête de la LOI (#sec-N) ; le reste passe
  // par txt(). Ne s'active que si `loiAnchors` connaît le numéro (sinon texte inchangé).
  function loiLinks(value: string): ReactNode {
    if (!loiAnchors) return txt(value)
    const out: ReactNode[] = []
    let pos = 0
    let k = 0
    LOI_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = LOI_RE.exec(value))) {
      const anchor = loiAnchors[m[1]]
      if (!anchor) continue
      out.push(<span key={`p${k++}`}>{txt(value.slice(pos, m.index))}</span>)
      out.push(
        <a key={`l${k++}`} href={`#${anchor}`} className="font-medium text-chabon hover:underline">
          {m[0]}
        </a>,
      )
      pos = m.index + m[0].length
    }
    if (!out.length) return txt(value)
    out.push(<span key={`p${k++}`}>{txt(value.slice(pos))}</span>)
    return out
  }

  // Renvois SORTANTS « C. p. c. 956 » → le Code de procédure civile, ancré sur l'article.
  // Le Code civil en porte 348 (corps + annotations), sous onze graphies d'OCR. Les parts
  // de texte continuent leur chemin habituel (loiLinks → hl) : aucune régression ailleurs,
  // puisque tout dépend de la présence de cpcDocHref.
  function cpcLinks(value: string): ReactNode {
    const actifs = (Object.keys(codeHrefs ?? {}) as CodeKey[]).filter((k) => codeHrefs?.[k])
    if (!actifs.length) return loiLinks(value)
    const segs = segmentCodeRefs(value, actifs)
    if (!segs) return loiLinks(value)
    return segs.map((s, i) =>
      s.kind === 'text' ? (
        <span key={i}>{loiLinks(s.text)}</span>
      ) : (
        <Link
          key={i}
          href={codeArticleHref(codeHrefs![s.code]!, s.kind === 'article' ? s.article : null)}
          className={CODE_LINK_CLS}
          title={s.kind === 'article' ? `${CODE_NOM[s.code]}, article ${s.article}` : CODE_NOM[s.code]}
        >
          {s.text}
        </Link>
      ),
    )
  }

  // Renvois « C. civ., 969, 1102 » → chaque numéro devient un lien #art-N ; le reste du
  // texte passe par cpcLinks() puis loiLinks() puis hl(). Valeur inchangée si aucun renvoi.
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
      out.push(<span key={`t${k++}`}>{cpcLinks(value.slice(pos, numsStart))}</span>)
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
              <a key={j} href={`#art-${n}`} className="font-medium text-chabon hover:underline">
                {p}
              </a>
            )
          })}
        </span>,
      )
      pos = m.index + m[0].length
    }
    if (!out.length) return cpcLinks(value)
    out.push(<span key={`t${k++}`}>{cpcLinks(value.slice(pos))}</span>)
    return out
  }

  // Renvois internes du Code pénal « l'article 240 » / « les articles 63, 64 et 68 » → chaque
  // numéro qui EST un article du Code (artRefs) devient un lien #art-N ; les renvois EXTERNES
  // (« art. 2 du décret… ») sont laissés en texte. Le reste passe par hl().
  function artLinks(value: string): ReactNode {
    if (!artRefs) return hl(value)
    // « l'article 311 DU CODE CIVIL », cité DANS le Code civil, est un renvoi INTERNE. Le
    // garde ART_EXT_AFTER écarte tout « du Code … » (il protège des renvois aux AUTRES
    // codes) et aveuglait donc celui-ci. Seule la dénomination du code courant y échappe ;
    // « du Code de procédure civile » reste écarté (le mot capturé serait « de »).
    const dansSonPropreCode = (reste: string) => {
      if (!ownCode) return false
      const m = /^\s*(?:[:—–-]\s*)?\(?\s*du\s+code\s+(\p{L}+)/iu.exec(reste)
      return !!m && sansAccent(m[1]) === sansAccent(ownCode)
    }
    const out: ReactNode[] = []
    let pos = 0
    let k = 0
    const re = sectionRefs ? ART_OR_SEC_REF_RE : ART_REF_RE
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(value))) {
      const reste = value.slice(m.index + m[0].length)
      if (ART_EXT_AFTER.test(reste) && !dansSonPropreCode(reste)) continue // renvoi à un autre texte (après)
      const avant = value.slice(Math.max(0, m.index - 100), m.index)
      if (ART_EXT_BEFORE.test(avant)) continue // renvoi à un autre texte (annoncé avant)
      if (ART_EXT_DESIGNATION.test(avant)) continue // « Décret du 27 janvier 1959, art. 1 »
      out.push(<span key={`t${k++}`}>{hl(value.slice(pos, m.index))}</span>)
      const parts = m[0].split(ART_NUM_RE)
      out.push(
        <span key={`a${k++}`}>
          {parts.map((p, j) => {
            if (!/^\d/.test(p)) return p
            const anchor = articleAnchorFromNum(p.trim())
            if (!artRefs.has(anchor)) return p
            return (
              <a key={j} href={`#${anchor}`} className="font-medium text-chabon hover:underline">
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
          className="font-medium text-ank underline decoration-chabon/30 underline-offset-2 hover:decoration-chabon"
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
                <span aria-hidden className="select-none text-ank/80">
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
                  <span className="min-w-[2.5ch] shrink-0 font-semibold text-ank">{item.marker}</span>
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
          <p key={key} id={id} className="scroll-mt-24 pt-1.5 font-semibold text-ank">
            {articleBody(b.text, id)}
          </p>
        )
      }
      // Les articles longs (« Article 12.- … ») ne sont pas des intertitres mais doivent
      // tout de même porter une ancre #art-N (renvois croisés, index thématique).
      const pid = headingAnchor(b.text)
      return (
        <p key={key} id={pid} className={pid ? 'scroll-mt-24' : undefined}>
          {articleBody(b.text, pid)}
        </p>
      )
    })
  }

  function renderCell(cell: RichCell, c: number, isHeader: boolean, scope?: 'col' | 'row', sticky = false) {
    const Tag = isHeader ? 'th' : 'td'
    // Couleurs = palette Lam (jamais les hex bruts du PDF) : en-tête → soley-50,
    // cellule ombrée non-en-tête → ton soley translucide (lit la zébrure du <tr> par
    // transparence au lieu de la masquer comme un fond opaque). `cell.bg` = indicateur d'ombrage.
    const shade = isHeader ? 'bg-pil' : cell.bg ? 'bg-pil/50' : ''
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
        className={`border border-chabon/20 px-2.5 py-1.5 align-top text-ank/90 ${shade} ${auto ? 'tabular-nums' : ''} ${
          sticky ? 'sticky top-0 z-10' : ''
        } ${isHeader || cell.bold ? 'font-semibold text-ank' : ''}`}
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
          <figcaption className="text-sm font-semibold text-ank">
            {caption}
            {orphan && <span className="ml-2 text-xs font-normal text-ank/80">({ORPHAN_LABEL[locale] ?? ORPHAN_LABEL.fr})</span>}
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
          className={longTable ? 'max-h-[78vh] overflow-auto rounded-md border border-chabon/10' : 'overflow-x-auto'}
        >
          <table className="w-full border-collapse text-[13px] text-ank/90">
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
        {wide && <p className="mt-1 text-xs text-ank/80 sm:hidden">↔ {SCROLL_HINT[locale] ?? SCROLL_HINT.fr}</p>}
      </figure>
    )
  }

  function renderNote(n: RichNote, key: string) {
    // Encadré/cartouche aux couleurs Lam : fond soley-50, bordure soley (couleur
    // du type « Circulaires BRH ») — les hex du PDF ne sont jamais appliqués.
    return (
      <p
        key={key}
        className="my-3 rounded-lg border border-chabon/40 bg-pil px-4 py-2.5 text-sm leading-relaxed text-ank/90"
      >
        {render(n.text)}
      </p>
    )
  }

  let tableNo = 0 // numérotation « Tableau N » par ordre d'AFFICHAGE (orphelins en fin inclus)
  return (
    <div className="official-text space-y-3 text-[15px] text-ank/90">
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
