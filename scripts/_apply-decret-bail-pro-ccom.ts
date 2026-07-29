/**
 * DÉCRET DU 9 AVRIL 2020 SUR LE BAIL À USAGE PROFESSIONNEL → Code de commerce annoté.
 *
 * Opérations (art. 1er à 10 du décret ; textes VERBATIM du décret téléversé) :
 *   - Titre VII du livre 1er RE-TITRÉ « Des contrats commerciaux » ;
 *   - CHAPITRE PREMIER « Des achats et des ventes » NOUVEAU, comprenant le seul
 *     article 1710-1 — RENUMÉROTATION de l'article 111, « dont le libellé demeure
 *     inchangé » (art. 1er). Le texte est donc REPRIS TEL QUEL du corps existant : il
 *     n'est ni réécrit ni retranscrit depuis le décret (qui ne le cite pas) ;
 *   - CHAPITRE II « Du bail à usage professionnel » NOUVEAU : 9 sections, 33 articles
 *     (1721-1 → 1729-3), insérés entre le Titre VII et le Titre VIII.
 *
 * Pastilles : « modifié » ×1 (1710-1, ancienne numérotation repliable) et
 * « nouveau » ×33. Notes connexes cliquables → décret, à l'ancre homonyme.
 *
 * ⚠️ Les 8 entrées d'index qui visaient l'article 111 sont RÉAIGUILLÉES vers 1710-1 :
 * sans cela, la renumérotation les transformerait en renvois morts.
 *
 * ⚠️ Les ancres sec-N existantes ne sont JAMAIS renumérotées (les clés de jurisprudence
 * « sec-K|art-N » et les crossRefs en dépendent) : les 11 en-têtes nouveaux prennent des
 * ancres au-delà du maximum utilisé, insérées à la bonne POSITION dans la toc.
 *
 * Sauvegarde préalable : backups/backup-before-bail-pro-*.json. Idempotent.
 *   npx tsx scripts/_apply-decret-bail-pro-ccom.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated, type Annotations, type TocEntry } from '../src/lib/legislation/annotated'

const DIR = 'scripts/data/decret-bail-pro-2020'
const REF = 'Décret du 9 avril 2020 sur le Bail à Usage Professionnel'
const MONITEUR = 'Le Moniteur, 175e Année, Spécial N° 4 du 11 mai 2020'

const TITRE7_OLD = 'Titre VII — Des achats et ventes'
const TITRE7_NEW = 'Titre VII — Des contrats commerciaux'
const CH1 = 'Chapitre Premier — Des achats et des ventes'
const CH2 = 'Chapitre II — Du bail à usage professionnel'

/** Intitulés des 9 sections — mot pour mot ceux que posent les articles 2 à 10 du décret. */
const SECTIONS: [string, string][] = [
  ['1', 'Champ d’application'],
  ['2', 'Conclusion et durée du bail'],
  ['3', 'Obligations du bailleur'],
  ['4', 'Obligations du preneur'],
  ['5', 'Loyer'],
  ['6', 'Cession et sous-location'],
  ['7', 'Conditions et formes du renouvellement'],
  ['8', 'Résiliation du bail'],
  ['9', 'Dispositions finales'],
]

/** Article du DÉCRET ayant inséré un article du Code (pour la note connexe). */
const DECRET_ART = (n: string): string => String(Number(n.slice(3, 4)) + 1)

async function main() {
  const cc = await prisma.document.findFirst({ where: { source: 'CODE_COMMERCE_ANNOTE' } })
  const dec = await prisma.document.findFirst({ where: { source: 'DECRET_BAIL_PRO_2020' }, select: { id: true } })
  if (!cc?.bodyOriginal || !cc.annotationsJson) throw new Error('Code de commerce introuvable')
  if (!dec) throw new Error('Décret bail pro introuvable — lancer _import-decret-bail-pro.ts d’abord')
  const ann = JSON.parse(cc.annotationsJson) as Annotations & Record<string, any>

  // ── Extraction des 33 articles depuis le corps du DÉCRET (déjà nettoyé par parse_dbp.py) ──
  const dLines = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8').split('\n')
  const quoted = new Map<string, string[]>()
  for (let i = 0; i < dLines.length; i++) {
    const m = dLines[i].match(/^Article\s+(17\d\d-\d+)\.-\s*(.*)$/)
    if (!m) continue
    const buf = [m[2].trim()]
    for (let j = i + 1; j < dLines.length; j++) {
      const l = dLines[j].trim()
      // Bornes : tête d'article (du décret ou insérée) ou en-tête de section.
      if (!l || /^Article\s+\d/.test(l) || /^SECTION \d+ —/.test(l) || /^DISPOSITIONS FINALES/.test(l)) break
      buf.push(l)
    }
    quoted.set(m[1], buf)
  }
  if (quoted.size !== 33) throw new Error(`articles extraits : ${quoted.size}/33 — annulé`)
  // Anti-circularité : chaînes relevées à la main dans le .docx, qui DOIVENT s'y trouver.
  const SENTINELS: [string, string][] = [
    ['1721-1', 'Terrains nus sur lequel ont été édifiées'],
    ['1723-2', 'des gros murs, des voûtes, des poutres'],
    ['1723-8', 'Le bail ne prend pas fin par le décès'],
    ['1724-1', 'par correspondance ou par voie électronique'],
    ['1726-2', '80%'],
    ['1727-2', 'est déchu du droit de renouvellement du bail'],
    ['1727-2', 'au plus tard sept mois avant la date d’expiration du bail'],
    ['1728-2', 'Le non-paiement du loyer pendant deux mois consécutifs'],
    ['1729-3', 'Le chapitre II de la Loi no. 23 du Code civil sur le louage des choses'],
  ]
  for (const [n, s] of SENTINELS)
    if (!(quoted.get(n) ?? []).join(' ').includes(s)) throw new Error(`sentinelle absente du bloc ${n} : « ${s} »`)
  // Garde anti-narration : aucun bloc ne doit avoir avalé le dispositif du décret.
  for (const [n, ls] of quoted)
    if (ls.some((l) => /est intitulée\s*:|comprend les articles suivants/.test(l)))
      throw new Error(`bloc ${n} pollué par la narration du décret`)
  console.log(`✓ ${quoted.size} articles extraits du décret · ${SENTINELS.length} sentinelles OK`)

  // ── Texte d'origine de l'article 111, capturé AVANT toute édition du corps ──
  // (au 2ᵉ passage il a déjà été renuméroté : on conserve alors la version déjà stockée).
  const src = cc.bodyOriginal.split('\n')
  const i111 = src.findIndex((l) => /^Article 111\.-/.test(l.trim()))
  let old111: string | null = null
  if (i111 >= 0) {
    const fin = src.findIndex((l, k) => k > i111 && /^(Titre|Chapitre|Section|Article)\s/i.test(l.trim()))
    old111 = src.slice(i111, fin > 0 ? fin : i111 + 1).join('\n').trimEnd()
  }

  // ── Repérage dans le corps du Code (par recherche, jamais par n° de ligne figé) ──
  let lines = cc.bodyOriginal.split('\n')
  if (lines.some((l) => /^Article 1721-1\.-/.test(l.trim()))) {
    console.log('✓ déjà appliqué (article 1721-1 présent) — corps inchangé')
  } else {
    const iT7 = lines.findIndex((l) => l.trim() === TITRE7_OLD)
    if (iT7 < 0) throw new Error(`« ${TITRE7_OLD} » introuvable dans le corps`)
    const iA111 = lines.findIndex((l, k) => k > iT7 && /^Article 111\.-/.test(l.trim()))
    if (iA111 < 0) throw new Error('article 111 introuvable après le Titre VII')
    const iT8 = lines.findIndex((l, k) => k > iA111 && /^Titre VIII —/.test(l.trim()))
    if (iT8 < 0) throw new Error('Titre VIII introuvable après l’article 111')

    // Bloc du chapitre II : en-tête + 9 sections + 33 articles.
    const bloc: string[] = [CH2]
    for (const [num, label] of SECTIONS) {
      bloc.push(`Section ${num} — ${label}`)
      for (const [n, body] of quoted) if (n.slice(0, 4) === `172${num}`) bloc.push(`Article ${n}.- ${body[0]}`, ...body.slice(1))
    }

    // Applications de BAS EN HAUT : les indices calculés restent valides.
    lines.splice(iT8, 0, ...bloc)
    lines[iA111] = lines[iA111].replace(/^Article 111\.-/, 'Article 1710-1.-')
    lines.splice(iA111, 0, CH1)
    lines[iT7] = TITRE7_NEW
    console.log(`✓ corps : Titre VII re-titré · ${CH1} · art. 111 → 1710-1 · ${bloc.length} lignes insérées avant le Titre VIII`)
  }
  const body = lines.join('\n')

  // ── Table des matières : nouvelles ancres AU-DELÀ du maximum (aucune renumérotation) ──
  const usedMax = Math.max(...ann.toc.map((t) => Number(String(t.anchor).replace('sec-', '')) || 0))
  let next = usedMax
  const newSec = () => `sec-${++next}`
  const iTocT7 = ann.toc.findIndex((t) => t.label === TITRE7_OLD)
  if (iTocT7 >= 0) {
    ann.toc[iTocT7] = { ...ann.toc[iTocT7], label: TITRE7_NEW }
    const ajouts: TocEntry[] = [
      { level: 4, label: CH1, anchor: newSec(), kind: 'chapitre' },
      { level: 4, label: CH2, anchor: newSec(), kind: 'chapitre' },
      ...SECTIONS.map(([num, label]) => ({ level: 5, label: `Section ${num} — ${label}`, anchor: newSec(), kind: 'section' })),
    ]
    ann.toc.splice(iTocT7 + 1, 0, ...ajouts)
    // navToc : le Titre VII est une feuille sous « Livre Premier » — on l'enrichit.
    const livre1 = ann.navToc?.[0]?.children?.[0]
    const noeudT7 = livre1?.children?.find((c: any) => c.label === TITRE7_OLD)
    if (noeudT7) {
      noeudT7.label = TITRE7_NEW
      noeudT7.children = [
        { label: CH1, anchor: ajouts[0].anchor },
        { label: CH2, anchor: ajouts[1].anchor },
      ]
    }
    console.log(`✓ toc : ${ajouts.length} en-têtes ajoutés (${ajouts[0].anchor} → ${ajouts[ajouts.length - 1].anchor}), ancres existantes intactes`)
  } else console.log('✓ toc déjà à jour')

  // ── Libellés, statuts, ancienne version, notes connexes ──
  ann.labels ??= {}
  ann.status ??= {}
  ann.oldVersions ??= {}
  ann.connexe ??= {}

  delete ann.labels['art-111'] // l'ancre n'existe plus : l'article est désormais 1710-1
  ann.labels['art-1710-1'] = 'Article 1710-1'
  ann.status['art-1710-1'] = 'modifié'
  // Ancienne version repliable : ce qui a changé est le NUMÉRO, le libellé est inchangé.
  if (old111)
    ann.oldVersions['art-1710-1'] =
      `${old111}\n(Numérotation antérieure au décret du 9 avril 2020 : article 111. ` +
      `Le libellé demeure inchangé — art. 1er du décret.)`
  if (!ann.oldVersions['art-1710-1']) throw new Error('ancienne version de l’article 111 introuvable — annulé')
  ann.connexe['art-1710-1'] = [
    {
      label: REF,
      text:
        'Article 1er du décret : le chapitre Ier du titre VII comprend un article 1710-1 qui est la nouvelle ' +
        'numérotation de l’article 111, dont le libellé demeure inchangé.',
      docId: dec.id,
      anchor: 'art-1',
    },
  ]

  for (const n of quoted.keys()) {
    ann.labels[`art-${n}`] = `Article ${n}`
    ann.status[`art-${n}`] = 'nouveau'
    ann.connexe[`art-${n}`] = [
      {
        label: REF,
        text: `Article inséré par le décret du 9 avril 2020 (${MONITEUR}), art. ${DECRET_ART(n)}.`,
        docId: dec.id,
        anchor: `art-${n}`,
      },
    ]
  }

  // ── Index : les renvois vers 111 suivent la renumérotation ──
  let reaig = 0
  for (const e of ann.indexEntries as any[]) {
    const i = e.ctRefs.findIndex((r: any) => String(r) === '111')
    if (i >= 0) { e.ctRefs[i] = '1710-1'; reaig++ }
  }
  console.log(`✓ index : ${reaig} entrées réaiguillées 111 → 1710-1`)

  // ── Contrôles bloquants AVANT écriture ──
  const blocks = segmentAnnotated(body, ann.toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const anchors = new Set(blocks.filter((b: any) => b.kind === 'body' && b.anchor).map((b: any) => b.anchor))
  if (secs !== ann.toc.length) throw new Error(`segmentation ${secs}/${ann.toc.length} — annulé`)
  const attendus = ['art-1710-1', ...[...quoted.keys()].map((n) => `art-${n}`)]
  const absents = attendus.filter((a) => !anchors.has(a))
  if (absents.length) throw new Error(`articles absents du corps : ${absents.join(', ')} — annulé`)
  if (anchors.has('art-111')) throw new Error('l’ancre art-111 subsiste — annulé')
  const orphelins = Object.keys(ann.labels).filter((a) => !anchors.has(a))
  if (orphelins.length) throw new Error(`libellés sans article : ${orphelins.slice(0, 8).join(', ')} — annulé`)
  const morts = (ann.indexEntries as any[]).flatMap((e) => e.ctRefs).filter((r) => !anchors.has(`art-${r}`))
  if (morts.length) throw new Error(`index : renvois morts ${[...new Set(morts)].slice(0, 8).join(', ')} — annulé`)
  console.log(`✓ contrôles : ${secs} en-têtes · ${anchors.size} articles · index 0 renvoi mort`)

  await prisma.document.update({ where: { id: cc.id }, data: { bodyOriginal: body, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(cc.id)
  console.log(`✓ Code de commerce mis à jour (${cc.id}) — 33 « nouveau » + 1 « modifié », réindexé`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
