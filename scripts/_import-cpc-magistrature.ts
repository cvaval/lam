/**
 * LES TROIS LOIS DE 2007 SUR LA MAGISTRATURE — remplacement par le texte INTÉGRAL du J.O.
 *
 * Le recueil du Code de procédure civile les donnait amputées. Il tronquait le dernier
 * article des trois — la disposition abrogatoire ou d'exécution — et, pour la loi créant le
 * Conseil Supérieur du Pouvoir Judiciaire, il manquait les articles 6 à 25 : son auteur le
 * signalait lui-même (« Lacune de numérisation — la page 308 de l'exemplaire source est
 * absente »). Les transcriptions du Moniteur n° 112 du 20 décembre 2007 comblent le tout :
 *   Statut de la Magistrature        70 → 71 articles
 *   École de la Magistrature         50 → 51 articles
 *   Conseil Supérieur du Pouvoir J.  21 → 42 articles  (les 6 à 25 réapparaissent)
 *
 * Les documents sont mis à jour EN PLACE (mêmes `source`, donc mêmes identifiants et mêmes
 * URL) : les liens déjà partagés continuent de fonctionner.
 *
 * Le corps retient les visas, les considérants, la formule d'adoption, les articles, les
 * signatures et la promulgation — en français comme en créole, telle que le J.O. la publie.
 * Les anomalies que le transcripteur a relevées sur le texte IMPRIMÉ sont portées en note
 * sur les articles concernés : le lecteur doit savoir qu'une bizarrerie vient du Journal
 * Officiel et non de la plateforme.
 *
 * Idempotent.  npx tsx scripts/_import-cpc-magistrature.ts [--check]
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { segmentAnnotated, type Annotations, type TocEntry, type NavGroup, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/cpc'

interface Loi {
  source: string
  titre: string
  moniteur: string
  corps: string
  toc: TocEntry[]
  labels: Record<string, string>
  anomalies: Record<string, string[]>
  anomaliesGenerales: string[]
}

/** Date du vote, portée par le titre — elle distingue les trois lois du même fascicule. */
const VOTE: Record<string, string> = {
  CPC_APPENDICE_I_A_7_1: '2007-11-27',
  CPC_APPENDICE_I_A_7_2: '2007-11-15',
  CPC_APPENDICE_I_A_7_3: '2007-11-13',
}
const ATTENDUS: Record<string, number> = {
  CPC_APPENDICE_I_A_7_1: 71, CPC_APPENDICE_I_A_7_2: 51, CPC_APPENDICE_I_A_7_3: 42,
}

function buildNavToc(l: Loi): NavGroup[] {
  const racine: NavGroup = { label: l.titre, anchor: l.toc[0]?.anchor ?? 'art-1', children: [] }
  const parLabel = new Map(l.toc.map((t) => [t.label, t]))
  const pile: { level: number; noeud: any }[] = []
  for (const raw of l.corps.split('\n')) {
    const ligne = raw.trim()
    const t = parLabel.get(ligne)
    if (t) {
      const noeud = { label: ligne, anchor: t.anchor, children: [] as any[] }
      while (pile.length && pile[pile.length - 1].level >= t.level) pile.pop()
      ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push(noeud)
      pile.push({ level: t.level, noeud })
      continue
    }
    const a = articleAnchorFromHeading(ligne)
    if (!a || !l.labels[a]) continue
    ;(pile.length ? pile[pile.length - 1].noeud.children : racine.children).push({ label: l.labels[a], anchor: a })
  }
  return [racine]
}

async function main() {
  const lois = JSON.parse(readFileSync(`${DIR}/magistrature.json`, 'utf8')) as Loi[]

  // ── Contrôles bloquants, AVANT toute écriture ──
  for (const l of lois) {
    const blocks = segmentAnnotated(l.corps, l.toc)
    const secs = blocks.filter((b) => b.kind === 'section').length
    if (secs !== l.toc.length) throw new Error(`${l.source} : segmentation ${secs}/${l.toc.length} — annulé`)
    const anchors = blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor as string)
    if (blocks.some((b: any) => b.kind === 'body' && b.noAnchors)) throw new Error(`${l.source} : article sans ancre — annulé`)
    if (new Set(anchors).size !== anchors.length) throw new Error(`${l.source} : ancres dupliquées — annulé`)
    const orph = Object.keys(l.labels).filter((a) => !anchors.includes(a))
    if (orph.length) throw new Error(`${l.source} : libellés sans article ${orph.slice(0, 5).join(', ')} — annulé`)
    if (anchors.length !== ATTENDUS[l.source]) throw new Error(`${l.source} : ${anchors.length}/${ATTENDUS[l.source]} articles — annulé`)
    const notesOrph = Object.keys(l.anomalies).filter((a) => !anchors.includes(a))
    if (notesOrph.length) throw new Error(`${l.source} : note sur un article inexistant ${notesOrph.join(', ')} — annulé`)
    // La disposition finale doit être là : c'est précisément ce que le recueil tronquait.
    const dernier = `art-${ATTENDUS[l.source]}`
    if (!anchors.includes(dernier)) throw new Error(`${l.source} : ${dernier} absent — annulé`)
    console.log(`✓ ${l.source} : ${anchors.length} articles · ${secs} divisions · ${Object.keys(l.anomalies).length} articles annotés`)
  }
  if (process.argv.includes('--check')) {
    console.log('— mode contrôle : rien n’a été écrit')
    return prisma.$disconnect()
  }

  for (const l of lois) {
    const ex = await prisma.document.findFirst({ where: { source: l.source }, select: { id: true, bodyOriginal: true } })
    if (!ex) throw new Error(`${l.source} introuvable — importer l’Appendice d’abord`)
    const avant = (ex.bodyOriginal.match(/^Art\.?\s+\d/gm) ?? []).length

    const connexe: Record<string, ConnexeBlock[]> = {}
    for (const [ancre, notes] of Object.entries(l.anomalies))
      connexe[ancre] = notes.map((n) => ({
        label: 'Anomalie du texte imprimé — conservée telle quelle',
        text: `${n} Le Journal Officiel porte cette rédaction ; elle est reproduite sans correction.`,
      }))

    const ann: Annotations & Record<string, unknown> = {
      title: l.titre,
      annotationAuthor: '',
      navToc: buildNavToc(l),
      toc: l.toc,
      connexes: [],
      jurisprudence: {},
      indexEntries: [],
      labels: l.labels,
      status: {},
      connexe,
    }

    const nArt = Object.keys(l.labels).length
    const doc = await prisma.document.update({
      where: { id: ex.id },
      data: {
        bodyOriginal: l.corps,
        annotationsJson: JSON.stringify(ann),
        moniteurRef: l.moniteur,
        publicationDate: new Date(`${VOTE[l.source]}T00:00:00Z`),
        summaryFr: `${l.titre} — texte intégral : ${nArt} articles, publiés au ${l.moniteur}. `
          + `Visas, considérants, dispositif, signatures et promulgation (française et créole). `
          + (l.anomaliesGenerales.length
            ? `Anomalies relevées sur l’imprimé et conservées telles quelles : ${l.anomaliesGenerales.length} `
              + `(voir les notes portées sur les articles concernés).`
            : ''),
      },
      select: { id: true },
    })
    await reindexDocument(doc.id)
    console.log(`✓ ${l.source} : ${avant} → ${nArt} articles`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
