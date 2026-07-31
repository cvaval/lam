/**
 * LE MONITEUR N° 69 DU 30 SEPTEMBRE 1985 — deux textes, plus une correction de statut.
 *
 * 1. TARIF JUDICIAIRE (I.E) — reconstitué par recoupement de deux sources incomplètes qui
 *    se complètent presque exactement : la transcription du J.O. porte les articles 1–10,
 *    29–48 et 64–148 (trois pages absentes) ; le recueil du Code de procédure civile, déjà
 *    en ligne, portait 1–5 et 149–168 (une page absente). Réunis : 25 → 135 articles.
 *    Manquent encore les articles 11–28 et 49–63, dont aucune des deux sources ne dispose ;
 *    les notes de lacune restent dans le corps pour que le lecteur sache pourquoi.
 *
 * 2. LOI DU 18 SEPTEMBRE 1985 SUR L'ORGANISATION JUDICIAIRE — document NOUVEAU. Absente du
 *    recueil, elle est pourtant l'un des textes que le Code de procédure civile cite : son
 *    article 18 a été modifié par elle. 142 articles et 15 sous-articles, série complète.
 *
 * 3. Correction : sept articles de l'Appendice portaient la mention « Abr D-L 23 juin 1942 »
 *    ou « Abr D. 30 sept 1974 » et avaient reçu la pastille « modifié ». Une abrogation
 *    n'est pas une modification — ils passent à « abrogé ».
 *
 * Idempotent.  npx tsx scripts/_import-cpc-1985.ts [--check]
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { segmentAnnotated, parseAnnotations, type Annotations, type TocEntry, type NavGroup, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/cpc'

interface Texte {
  source: string
  titre: string
  moniteur: string
  date: string
  corps: string
  toc: TocEntry[]
  labels: Record<string, string>
  plages: string
  manquants: string
}

const ATTENDUS: Record<string, number> = {
  CPC_APPENDICE_I_E_1: 135,
  LOI_ORGANISATION_JUDICIAIRE_1985: 157,
}

function buildNavToc(t: Texte): NavGroup[] {
  const racine: NavGroup = { label: t.titre, anchor: t.toc[0]?.anchor ?? 'art-1', children: [] }
  const parLabel = new Map(t.toc.map((x) => [x.label, x]))
  const pile: { level: number; noeud: any }[] = []
  for (const raw of t.corps.split('\n')) {
    const ligne = raw.trim()
    const d = parLabel.get(ligne)
    if (d) {
      const noeud = { label: ligne, anchor: d.anchor, children: [] as any[] }
      while (pile.length && pile[pile.length - 1].level >= d.level) pile.pop()
      ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push(noeud)
      pile.push({ level: d.level, noeud })
      continue
    }
    const a = articleAnchorFromHeading(ligne)
    if (!a || !t.labels[a]) continue
    ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push({ label: t.labels[a], anchor: a })
  }
  return [racine]
}

/** Les lacunes signalées dans le corps deviennent aussi une note sur l'article qui précède. */
function notesDeLacune(t: Texte): Record<string, ConnexeBlock[]> {
  const out: Record<string, ConnexeBlock[]> = {}
  let dernier: string | null = null
  for (const raw of t.corps.split('\n')) {
    const l = raw.trim()
    const a = articleAnchorFromHeading(l)
    if (a && t.labels[a]) { dernier = a; continue }
    if (!/^\[Lacune/.test(l) || !dernier) continue
    out[dernier] = [{
      label: 'Lacune de la source',
      text: l.replace(/^\[|\]$/g, '') + ' Le texte manquant ne figure dans aucune des sources disponibles.',
    }]
  }
  return out
}

async function main() {
  const textes = JSON.parse(readFileSync(`${DIR}/moniteur1985.json`, 'utf8')) as Texte[]

  // ── Contrôles bloquants, AVANT toute écriture ──
  for (const t of textes) {
    const blocks = segmentAnnotated(t.corps, t.toc)
    const secs = blocks.filter((b) => b.kind === 'section').length
    if (secs !== t.toc.length) throw new Error(`${t.source} : segmentation ${secs}/${t.toc.length} — annulé`)
    const anchors = blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor as string)
    if (blocks.some((b: any) => b.kind === 'body' && b.noAnchors)) throw new Error(`${t.source} : article sans ancre — annulé`)
    if (new Set(anchors).size !== anchors.length) throw new Error(`${t.source} : ancres dupliquées — annulé`)
    const orph = Object.keys(t.labels).filter((a) => !anchors.includes(a))
    if (orph.length) throw new Error(`${t.source} : libellés sans article ${orph.slice(0, 5).join(', ')} — annulé`)
    if (anchors.length !== ATTENDUS[t.source]) throw new Error(`${t.source} : ${anchors.length}/${ATTENDUS[t.source]} articles — annulé`)
    console.log(`✓ ${t.source} : ${anchors.length} articles · ${secs} divisions · articles ${t.plages}`)
    if (t.manquants) console.log(`   ⚑ manquent encore : ${t.manquants}`)
  }
  if (process.argv.includes('--check')) {
    console.log('— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  const pc = await prisma.theme.findFirst({ where: { slug: 'procedure-civile' } })
  if (!pc) throw new Error('thème procedure-civile introuvable')

  for (const t of textes) {
    const connexe = notesDeLacune(t)
    const ann: Annotations & Record<string, unknown> = {
      title: t.titre, annotationAuthor: '',
      navToc: buildNavToc(t), toc: t.toc,
      connexes: [], jurisprudence: {}, indexEntries: [],
      labels: t.labels, status: {}, connexe,
    }
    const nArt = Object.keys(t.labels).length
    const estTarif = t.source.startsWith('CPC_APPENDICE')
    const commun = {
      bodyOriginal: t.corps,
      annotationsJson: JSON.stringify(ann),
      moniteurRef: t.moniteur,
      publicationDate: new Date(`${t.date}T00:00:00Z`),
      summaryFr: estTarif
        ? `${t.titre} ${nArt} articles reconstitués en recoupant la transcription du Journal `
          + `Officiel et le recueil du Code de procédure civile, chacun amputé de pages différentes : `
          + `articles ${t.plages}. Restent introuvables les articles ${t.manquants}, absents des deux `
          + `sources. Barème des taxes et vacations des juges de paix, greffiers, huissiers, experts, `
          + `interprètes et avocats, droits de greffe et règlements généraux.`
        : `${t.titre} — texte intégral : ${nArt} articles (142 articles et 15 sous-articles), publiés `
          + `au ${t.moniteur}. Organisation du corps judiciaire, nomination et discipline des juges, `
          + `Cour de cassation, cours d’appel, tribunaux de première instance, tribunaux de paix, `
          + `ministère public, greffes et huissiers. C’est cette loi qui a modifié l’article 18 du Code `
          + `de procédure civile. Le décret du 22 août 1995 sur l’organisation judiciaire, qui lui `
          + `succède, figure à l’Appendice I.B.`,
    }

    const ex = await prisma.document.findFirst({ where: { source: t.source }, select: { id: true, bodyOriginal: true } })
    let id: string
    if (ex) {
      const avant = (ex.bodyOriginal.match(/^(?:Art|Article)\.?\s+\d/gm) ?? []).length
      id = (await prisma.document.update({ where: { id: ex.id }, data: commun, select: { id: true } })).id
      console.log(`✓ ${t.source} : ${avant} → ${nArt} articles`)
    } else {
      const doc = await prisma.document.create({
        data: {
          ...commun, originalLang: 'fr', source: t.source,
          type: 'LEGISLATION', status: 'EN_VIGUEUR',
          titleFr: t.titre,
          number: 'Loi du 18 septembre 1985',
          matiere: 'procedure-civile',
          keywords: 'organisation judiciaire; corps judiciaire; magistrature; Cour de cassation; '
            + 'cour d’appel; tribunal de première instance; tribunal de paix; juge de paix; '
            + 'ministère public; commissaire du gouvernement; greffier; huissier; discipline; '
            + 'année judiciaire; vacances judiciaires; serment',
        },
        select: { id: true },
      })
      id = doc.id
      await prisma.documentTheme.create({ data: { documentId: id, themeId: pc.id, isPrimary: true, assignedBy: 'IMPORT' } })
      console.log(`✓ ${t.source} : créé (${nArt} articles) · thème « ${pc.labelFr} »`)
    }
    await reindexDocument(id)
  }

  // ── Correction : « Abr … » vaut abrogation, non modification ──
  let corriges = 0
  const suspects = await prisma.document.findMany({
    where: { source: { startsWith: 'CPC_APPENDICE_' }, annotationsJson: { contains: 'Article modifié — Abr' } },
    select: { id: true, source: true, annotationsJson: true },
  })
  for (const d of suspects) {
    const a = parseAnnotations(d.annotationsJson) as any
    if (!a) continue
    let n = 0
    for (const [ancre, blocs] of Object.entries(a.connexe as Record<string, ConnexeBlock[]>)) {
      const b = blocs[0]
      if (!b?.label.startsWith('Article modifié — Abr')) continue
      const mention = b.label.replace(/^Article modifié — Abr\.?\s*/, '')
      a.status[ancre] = 'abrogé'
      blocs[0] = {
        label: `Article abrogé — ${mention}`,
        text: `Le présent article a été abrogé par : ${mention}.`,
      }
      n++
    }
    if (!n) continue
    await prisma.document.update({ where: { id: d.id }, data: { annotationsJson: JSON.stringify(a) } })
    corriges += n
    console.log(`✓ ${d.source} : ${n} article(s) « modifié » → « abrogé »`)
  }
  console.log(`✓ statuts corrigés : ${corriges}`)

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
