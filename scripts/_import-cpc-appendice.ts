/**
 * APPENDICE DU CODE DE PROCÉDURE CIVILE — 116 textes annexés.
 *
 * Le recueil range ces textes en cinq divisions — l'ordre judiciaire, l'ordre administratif,
 * les professions judiciaires, les procédures diverses, la fiscalité — subdivisées en
 * 92 rubriques cotées (« IV.1.- La déclaration tardive de naissance »). Sous chaque rubrique
 * il reproduit les articles utiles d'un ou plusieurs textes : 1 678 en-têtes au total.
 *
 * ⚠️ UN DOCUMENT PAR COUPLE (RUBRIQUE, TEXTE), et non par rubrique ni par texte :
 *  · par rubrique, les trois lois de 2007 sur la magistrature — Statut, École, Conseil
 *    supérieur — se retrouveraient dans un même corps, où 71 de leurs 141 articles
 *    perdraient leur ancre, chacune renumérotant depuis l'article 1 ;
 *  · par texte, il faudrait fusionner les extraits épars d'une même loi ; or les trois
 *    « Loi du 10 avril 2002 » de I.B.5, I.B.6 et I.B.7 sont TROIS lois différentes du même
 *    jour, créant chacune un tribunal (Miragoâne, les Côteaux, la Croix-des-Bouquets), que
 *    le sommaire abrège à leur date. Les fondre en écraserait deux sur trois.
 * Résultat : 1 678 ancres pour 1 678 en-têtes, aucune collision.
 *
 * ⚠️ Aucune mention d'édition, d'éditeur ni d'annotateur : la plateforme publie le TEXTE
 * DE LOI, non une édition commerciale.
 *
 * Le Code lui-même est importé par `_import-cpc.ts` (source CODE_PROCEDURE_CIVILE).
 * Idempotent (upsert par source).
 *   npx tsx scripts/_import-cpc-appendice.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { segmentAnnotated, type Annotations, type TocEntry, type NavGroup, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/cpc'
const PREFIXE = 'CPC_APPENDICE'

interface Doc {
  cote: string
  rubrique: string
  titre: string
  moniteur: string | null
  corps: string
  toc: TocEntry[]
  labels: Record<string, string>
  mentions: Record<string, string>
}

const DIVISIONS: Record<string, string> = {
  I: 'L’ordre judiciaire',
  II: 'L’ordre administratif',
  III: 'Les professions judiciaires',
  IV: 'Procédures diverses',
  V: 'Fiscalité',
}

// Le recueil abrège les mois de façon irrégulière (« 28 sept 1977 », « 30 oct 1986 ») et
// les écrit parfois en toutes lettres, y compris en CAPITALES. On indexe donc sur les
// quatre premières lettres — le seuil au-dessous duquel « juin » et « juillet » se
// confondraient — en gardant les formes courtes du recueil.
const MOIS: Record<string, number> = {
  janv: 1, jan: 1, févr: 2, fevr: 2, fév: 2, fev: 2, mars: 3, avri: 4, avr: 4, mai: 5,
  juin: 6, juil: 7, août: 8, aout: 8, sept: 9, octo: 10, oct: 10, nove: 11, nov: 11,
  déce: 12, dece: 12, déc: 12, dec: 12,
}

/** Date de signature lue dans le titre (« Décret du 28 sept 1977 … »), null si absente. */
function dateDuTitre(titre: string): Date | null {
  // ⚠️ `\w` reste ASCII même sous le drapeau u : `[^\W\d_]` ne verrait ni « août » ni
  // « déc ». Il faut la propriété Unicode \p{L}.
  const m = titre.match(/\bdu\s+(\d{1,2})(?:er)?\s+(\p{L}+)\.?\s+(\d{4})\b/iu)
  if (!m) return null
  const k = m[2].toLowerCase()
  const mois = MOIS[k] ?? MOIS[k.slice(0, 4)] ?? MOIS[k.slice(0, 3)]
  if (!mois) return null
  const d = new Date(Date.UTC(Number(m[3]), mois - 1, Number(m[1])))
  return Number.isNaN(d.getTime()) ? null : d
}

/** navToc : arbre des divisions du texte, les articles en feuilles sous leur division. */
function buildNavToc(d: Doc): NavGroup[] {
  const racine: NavGroup = { label: d.titre, anchor: d.toc[0]?.anchor ?? Object.keys(d.labels)[0], children: [] }
  const parLabel = new Map(d.toc.map((t) => [t.label, t]))
  const pile: { level: number; noeud: any }[] = []
  for (const raw of d.corps.split('\n')) {
    const l = raw.trim()
    const t = parLabel.get(l)
    if (t) {
      const noeud = { label: l, anchor: t.anchor, children: [] as any[] }
      while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
      ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push(noeud)
      pile.push({ level: t.level, noeud })
      continue
    }
    const a = articleAnchorFromHeading(l)
    if (!a || !d.labels[a]) continue
    ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push({ label: d.labels[a], anchor: a })
  }
  return [racine]
}

async function main() {
  const docs = JSON.parse(readFileSync(`${DIR}/appendice.json`, 'utf8')) as Doc[]

  // ── Contrôles bloquants, AVANT toute écriture ──
  let nAncres = 0
  const sources = new Set<string>()
  for (const d of docs) {
    const blocks = segmentAnnotated(d.corps, d.toc)
    const secs = blocks.filter((b) => b.kind === 'section').length
    if (secs !== d.toc.length) throw new Error(`${d.cote} « ${d.titre.slice(0, 50)} » : segmentation ${secs}/${d.toc.length} — annulé`)
    const anchors = blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor as string)
    const muets = blocks.filter((b: any) => b.kind === 'body' && b.noAnchors).length
    if (muets) throw new Error(`${d.cote} : ${muets} article(s) sans ancre (numéro répété) — annulé`)
    const orph = Object.keys(d.labels).filter((a) => !anchors.includes(a))
    if (orph.length) throw new Error(`${d.cote} : libellés sans article ${orph.slice(0, 5).join(', ')} — annulé`)
    if (new Set(anchors).size !== anchors.length) throw new Error(`${d.cote} : ancres dupliquées — annulé`)
    nAncres += anchors.length
  }
  if (nAncres !== 1678) throw new Error(`ancres ${nAncres}/1678 attendues — annulé`)
  // Le Code français a été retiré du corpus du CPC ; l'appendice doit l'être aussi.
  // ⚠️ Le « \b » de JavaScript est ASCII : dans « frères », le « è » compte comme frontière.
  const fr = docs.filter((d) => /(?<!\p{L})fr(?!\p{L})/u.test(d.corps)).map((d) => d.cote)
  if (fr.length) throw new Error(`renvoi au Code français résiduel : ${fr.slice(0, 5).join(', ')} — annulé`)
  console.log(`✓ contrôles : ${docs.length} documents · ${nAncres} ancres, 0 collision · 0 renvoi français`)
  if (process.argv.includes('--check')) {
    console.log('— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  const pc = await prisma.theme.findFirst({ where: { slug: 'procedure-civile' } })
  if (!pc) throw new Error('thème procedure-civile introuvable — importer le Code d’abord')
  const fisc = await prisma.theme.findFirst({ where: { slug: 'fiscalite' } })
  if (!fisc) throw new Error('thème fiscalite introuvable')

  let cree = 0
  let maj = 0
  const parRubrique: Record<string, number> = {}
  for (const d of docs) {
    const rang = (parRubrique[d.cote] = (parRubrique[d.cote] ?? 0) + 1)
    const source = `${PREFIXE}_${d.cote.replace(/[^A-Za-z0-9]+/g, '_')}_${rang}`
    if (sources.has(source)) throw new Error(`source dupliquée ${source} — annulé`)
    sources.add(source)

    const division = DIVISIONS[d.cote.split('.')[0]] ?? ''
    const nArt = Object.keys(d.labels).length

    const status: Record<string, string> = {}
    const connexe: Record<string, ConnexeBlock[]> = {}
    for (const [ancre, mention] of Object.entries(d.mentions)) {
      // Une mention de SOURCE (« Const du 29 mars 1987 ») situe l'article ; une mention de
      // MODIFICATION (« L. 27 août 1980 ») emporte en outre la pastille « modifié ».
      const estSource = /^Const\b/.test(mention)
      if (!estSource) status[ancre] = 'modifié'
      connexe[ancre] = [{
        label: estSource ? `Source — ${mention}` : `Article modifié — ${mention}`,
        text: estSource
          ? `Le présent article est reproduit d’après ${mention.replace(/^Const\b/, 'la Constitution')}.`
          : `Le présent article a été modifié par : ${mention}. La rédaction affichée est celle en `
            + `vigueur ; le texte antérieur ne figure pas au document publié au Journal Officiel.`,
      }]
    }

    const ann: Annotations & Record<string, unknown> = {
      title: d.titre,
      annotationAuthor: '',
      navToc: buildNavToc(d),
      toc: d.toc,
      connexes: [],
      jurisprudence: {},
      indexEntries: [],
      labels: d.labels,
      status,
      connexe,
    }

    const data = {
      type: 'LEGISLATION' as const,
      status: 'EN_VIGUEUR' as const,
      titleFr: d.titre,
      number: `Appendice ${d.cote}`,
      matiere: 'procedure-civile',
      moniteurRef: d.moniteur,
      publicationDate: dateDuTitre(d.titre),
      keywords: [d.rubrique, division, 'appendice du Code de procédure civile', 'texte annexé']
        .filter(Boolean).join('; '),
      summaryFr: `${d.titre} — ${nArt} article${nArt > 1 ? 's' : ''}. Texte annexé au Code de procédure `
        + `civile d’Haïti, rubrique ${d.cote} « ${d.rubrique} », division ${division.toLowerCase()}.`,
      bodyOriginal: d.corps,
      annotationsJson: JSON.stringify(ann),
      source,
    }

    const ex = await prisma.document.findFirst({ where: { source }, select: { id: true } })
    const doc = ex ? await prisma.document.update({ where: { id: ex.id }, data })
                   : await prisma.document.create({ data: { ...data, originalLang: 'fr' } })
    ex ? maj++ : cree++

    const themes = d.cote.startsWith('V') ? [pc, fisc] : [pc]
    for (const t of themes) {
      if (!(await prisma.documentTheme.findFirst({ where: { documentId: doc.id, themeId: t.id } })))
        await prisma.documentTheme.create({ data: { documentId: doc.id, themeId: t.id, isPrimary: t.id === pc.id, assignedBy: 'IMPORT' } })
    }
    await reindexDocument(doc.id)
  }

  console.log(`✓ ${cree} créés · ${maj} mis à jour · ${nAncres} articles · thème « ${pc.labelFr} »`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
