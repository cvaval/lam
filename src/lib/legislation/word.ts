/**
 * VERSION WORD d'un texte de la Législation annotée — consigne de Me Vaval (13 oct. 2026) :
 * « ajouter la version word pour législation annotée ».
 *
 * ⚠️ ELLE EST GÉNÉRÉE DU TEXTE OFFICIEL DE LA FICHE, jamais tirée du .docx d'origine
 * (`sourceFileUrl`, archive privée). Le .docx transmis est une TRANSCRIPTION : pour le Code fiscal
 * de 2026, la collation contre le fac-similé y a relevé 22 écarts au Journal officiel, corrigés
 * dans `bodyOriginal`. Servir l'archive aurait diffusé un texte que la fiche elle-même dément.
 *
 * Contenu : intitulé, référence, publication ; puis le corps tel que le lecteur annoté le
 * découpe (`segmentAnnotated`) — en-têtes de division, articles (tête en gras), tableaux à leur
 * place (`richBlocksJson`), notes de la rédaction attachées aux divisions (`crossRefs`). Ni index,
 * ni jurisprudence, ni commentaires : c'est le TEXTE. Même habillage que les annexes des
 * circulaires (filigrane Agora, mention légale, courriel et date du téléchargement).
 */
import { AlignmentType, BorderStyle, Document, Footer, Header, HorizontalPositionAlign, HorizontalPositionRelativeFrom, ImageRun, Packer, PageNumber, Paragraph, Table, TextRun, TextWrappingType, VerticalPositionAlign, VerticalPositionRelativeFrom } from 'docx'
import type { RichBlock, RichTable } from '@/lib/doc/richblocks'
import { BRAND } from '@/lib/brand'
import { BRAND_COLORS, ETAT_COLORS } from '@/lib/brand-colors'
import { formatDate } from '@/lib/i18n/format'
import type { Locale } from '@/lib/types'
import { disclaimer, docTable, watermarkPng } from '@/lib/annexes/generate'
import { segmentAnnotated, type Annotations, type CrossRefEntry } from './annotated'
import { libelle, MARQUEUR_TETE, natureDuBandeau, situationDuBandeau, situationDuMarqueur, situationDuStatutArticle, SITUATIONS, type Situation } from './situations'

const CHABON = BRAND_COLORS.chabon.replace('#', '')
const WOUJ = BRAND_COLORS.wouj.replace('#', '')
const ANK = BRAND_COLORS.ank.replace('#', '')
const GRIS = '6E6D8E'

/** Couleur de TEXTE d'une situation (le filet de sa gamme) — la même qu'au lecteur. Le libellé est
 *  toujours écrit : la couleur ne porte jamais seule l'information (charte, critère bloquant). */
const couleurDe = (s: Situation): string => (ETAT_COLORS[SITUATIONS[s].gamme as keyof typeof ETAT_COLORS]?.filet ?? `#${GRIS}`).replace('#', '')
/** Marqueur d'état écrit dans le corps en tête d'article : « (D. du …) », « [Abrogé — acte] ». */
const MARQUEUR_CORPS = new RegExp(`${MARQUEUR_TETE.source}|^\\[Abrog[ée][^\\]]{0,200}\\]`)

/** Tête d'article en début de bloc (« Article 1er.- », « Article 296. », « Article129.- », « Art. 12 »). */
const TETE = /^((?:(?:art(?:icle)?s?\.?|section)\s+|article(?=\d{1,4}\.-))(?:premier|\d{1,5}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)\s*[.)\-–]*)\s*/i

export interface LegislationWordInput {
  titleFr: string
  number: string | null
  moniteurRef: string | null
  body: string
  annotations: Annotations
  rich: RichBlock[]
  downloaderEmail: string
  locale: Locale
}

const rangeesDe = (t: RichTable) => t.rows.map((r) => r.map((c) => c.text).join(' | '))

/** Construit le .docx du texte (filigrane + mention légale en pied de page). */
export async function buildLegislationDocx(input: LegislationWordInput): Promise<Buffer> {
  const d = disclaimer(input.locale)
  const header = new Header({
    children: [
      new Paragraph({
        children: [
          new ImageRun({
            type: 'png',
            data: watermarkPng(),
            transformation: { width: 380, height: 169 },
            floating: {
              horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
              verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
              behindDocument: true,
              allowOverlap: true,
              wrap: { type: TextWrappingType.NONE },
            },
          }),
        ],
      }),
    ],
  })
  const footer = new Footer({
    children: [
      new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: CHABON } },
        spacing: { before: 60 },
        children: [new TextRun({ text: d.line1 + ' ', bold: true, color: CHABON, size: 14 }), new TextRun({ text: d.line2, color: CHABON, size: 14 })],
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `${BRAND.seal}  ·  ${input.downloaderEmail}  ·  ${formatDate(input.locale, new Date())}`, color: GRIS, size: 13 }),
          new TextRun({ text: '    p. ', color: GRIS, size: 13 }),
          new TextRun({ children: [PageNumber.CURRENT], color: GRIS, size: 13 }),
        ],
      }),
    ],
  })

  const children: (Paragraph | Table)[] = [
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: BRAND.name.toUpperCase(), bold: true, color: CHABON, size: 22 })] }),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: input.titleFr, bold: true, color: CHABON, size: 30 })] }),
  ]
  if (input.number && input.number !== input.titleFr)
    children.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: input.number, color: GRIS, size: 20 })] }))
  children.push(
    new Paragraph({
      spacing: { after: 240 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: WOUJ } },
      children: [new TextRun({ text: input.moniteurRef ?? '', color: GRIS, size: 20 })],
    }),
  )

  const a = input.annotations
  const notes = new Map<string, CrossRefEntry>((a.crossRefs ?? []).filter((c) => c.note && !c.docs?.length && !c.insertedArticles?.length).map((c) => [c.anchor, c]))
  const tables = input.rich.filter((b): b is RichTable => b.type === 'table')
  let curseur = 0

  for (const b of segmentAnnotated(input.body, a.toc ?? [], a.pointAnchors, a.repeatedHeads)) {
    if (b.kind === 'section') {
      const titre = b.tocKind === 'title'
      const taille = titre || b.level === 1 ? 24 : b.level === 2 ? 22 : 21
      children.push(
        new Paragraph({
          alignment: titre || b.level <= 2 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: titre ? 60 : 200, after: 80 },
          keepNext: true,
          children: [new TextRun({ text: b.text, bold: b.tocKind !== 'plan', italics: b.level >= 4, color: CHABON, size: taille })],
        }),
      )
      // La note dit sa NATURE (irrégularité du J.O., consolidation, provenance…) comme au lecteur,
      // et non plus « Note de la rédaction » pour tout (registre des situations, 17 oct. 2026).
      const note = notes.get(b.anchor)
      if (note) {
        const sit = situationDuBandeau(natureDuBandeau(note))
        children.push(
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: `${libelle(sit, 'fr')} — `, bold: true, color: couleurDe(sit), size: 18 }), new TextRun({ text: note.note!, italics: true, color: GRIS, size: 18 })],
          }),
        )
      }
      continue
    }
    const lignes = b.text.split('\n')
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i]
      // Rangées « a | b » d'un tableau : le tableau structuré à leur place.
      const t = tables[curseur]
      if (t) {
        const rangees = rangeesDe(t)
        if (ligne === rangees[0] && rangees.every((r, k) => lignes[i + k] === r)) {
          children.push(docTable(t))
          children.push(new Paragraph({ spacing: { after: 60 }, children: [] }))
          curseur++
          i += rangees.length - 1
          continue
        }
      }
      if (!ligne.trim()) continue
      const m = i === 0 && b.anchor ? TETE.exec(ligne) : null
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: m ? 160 : 0, after: 80 },
          children: m ? teteArticle(m[1], ligne.slice(m[0].length), situationDuStatutArticle(a.status?.[b.anchor!])) : [new TextRun({ text: ligne, color: ANK, size: 21 })],
        }),
      )
    }
  }

  const doc = new Document({
    creator: BRAND.name,
    title: input.titleFr,
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, headers: { default: header }, footers: { default: footer }, children }],
  })
  return Packer.toBuffer(doc)
}

/**
 * Tête d'article en gras, l'état de l'article (« [Amendé] », « [Nouveau] », « [Abrogé] » — la pastille
 * du lecteur, en toutes lettres et dans sa couleur), puis le corps. Un marqueur d'état écrit en tête du
 * corps (« (D. du 14 novembre 1988, art. 1) », « [Abrogé — acte] ») prend la couleur de sa situation ;
 * le TEXTE ne change pas d'un caractère. Un article dont le corps dit déjà son abrogation ne la redit pas.
 */
function teteArticle(tete: string, reste: string, etat: Situation | null): TextRun[] {
  const runs = [new TextRun({ text: tete, bold: true, color: CHABON, size: 21 })]
  const mk = MARQUEUR_CORPS.exec(reste)
  const dejaDit = mk && etat && situationDuMarqueur(mk[0]) === 'abroge' && etat === 'abroge'
  if (etat && !dejaDit) runs.push(new TextRun({ text: ` [${libelle(etat, 'fr')}]`, bold: true, color: couleurDe(etat), size: 18 }))
  if (!mk) return [...runs, new TextRun({ text: ' ' + reste, color: ANK, size: 21 })]
  const sit: Situation = situationDuMarqueur(mk[0])
  runs.push(new TextRun({ text: ' ' + mk[0], color: couleurDe(sit), size: 21 }))
  if (reste.length > mk[0].length) runs.push(new TextRun({ text: reste.slice(mk[0].length), color: ANK, size: 21 }))
  return runs
}
