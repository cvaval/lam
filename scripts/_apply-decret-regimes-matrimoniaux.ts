/**
 * DÉCRET SUR LES RÉGIMES MATRIMONIAUX → Code civil annoté (source CODE_CIVIL_ANNOTE).
 *
 * Source : table de concordance « Regime matrimoniaux.docx » (174 lignes de données),
 * extraite en scripts/data/code-civil/regimes-matrimoniaux/concordance.json.
 * Référence fournie par la cliente : Le Moniteur, Spécial n° 6 du 13 mai 2020.
 *
 * Patron IDENTIQUE à la Loi Filiation (scripts/_import-loi-filiation.ts) :
 *   - 93 articles AMENDÉS   → amendArticle (nouvelle version affichée, pastille « modifié »,
 *     ancienne version + jurisprudence d'époque dans le repliable « Ancienne version »).
 *   - 58 articles ABROGÉS   → abrogateArticle (« Article N.- [Abrogé — …] », pastille
 *     « abrogé », ancien texte intégral dans le repliable). Inclut l'art. 1310 (ligne 144 :
 *     libellé source « Amandé par l'article 5 » SANS nouvelle version — anomalie préservée
 *     en note ; traité en abrogation conformément au prompt §4/art. 5).
 *   - Art. 1212 : INTACT (consigne cliente — non modifié, non abrogé par le Décret).
 *
 * Intitulés (corps + toc + navToc) : nouvelle arborescence des régimes matrimoniaux
 * (SECTION III + Paragraphes 1-3 ; DEUXIÈME PARTIE, SECTIONS I-VI conventionnelles).
 * Les intitulés des blocs ABROGÉS (SECTION V, § 1er, § II, SECTION VI, SECTION IX…)
 * sont CONSERVÉS au-dessus de leurs fiches abrogées (pas de trou muet).
 * ⚠ « SECTION IV — parts inégales » : absente de la table (réserve) — libellé repris du
 * prompt §6, documenté dans la note de livraison.
 *
 * Sauvegarde AVANT écriture : backup-before.json (corps + annotations + ArticleVersions).
 * Idempotent : relançable (pré-purge des ArticleVersion du Décret, édits par état-cible).
 *   npx tsx scripts/_apply-decret-regimes-matrimoniaux.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { amendArticle, abrogateArticle } from '../src/lib/legislation/amendments'
import { splitArticles } from '../src/lib/legislation/segment'
import { segmentAnnotated, type Annotations, type TocEntry, type AnnBlock } from '../src/lib/legislation/annotated'
import { reindexDocument } from '../src/lib/search/reindex'

type BodyBlock = Extract<AnnBlock, { kind: 'body' }>
const DIR = 'scripts/data/code-civil/regimes-matrimoniaux'
const REF = 'Décret sur les régimes matrimoniaux (Le Moniteur, Spécial n° 6 du 13 mai 2020)'
const REF_COURT = 'D. du 13 mai 2020'
const EFFECTIVE = new Date('2020-05-13')
const MONITEUR = 'Le Moniteur, Spécial n° 6 du 13 mai 2020'

interface Op { row: number; kind: string; art: string | null; label: string | null; decret_art: string | null; new: string; mention: string; old: string; note: string }
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

// ── Intitulés : plan d'édition ────────────────────────────────────────────────
// Nouveaux libellés (une seule ligne, jointure « — » au style du Code).
const H = {
  passif: '§ II — Du passif de la communauté, et des actions qui en résultent contre la communauté',
  admin: 'SECTION II — DE L’ADMINISTRATION DE LA COMMUNAUTÉ ET DES BIENS PROPRES',
  dissolution: 'SECTION III — DE LA DISSOLUTION DE LA COMMUNAUTÉ ET DE QUELQUES-UNES DE SES SUITES',
  p1: 'Paragraphe 1.- Des causes de dissolution et de la séparation de biens',
  p2: 'Paragraphe 2.- De la liquidation et du partage de la communauté',
  p3: 'Paragraphe 3.- De l’obligation et de la contribution au passif après la dissolution',
  partie2: 'DEUXIÈME PARTIE — DE LA COMMUNAUTÉ CONVENTIONNELLE ET DES CONVENTIONS QUI PEUVENT MODIFIER OU MÊME EXCLURE LA COMMUNAUTÉ LÉGALE',
  s1: 'SECTION PREMIÈRE — DE LA COMMUNAUTÉ DES MEUBLES ET ACQUÊTS',
  s2: 'SECTION II — DE LA CLAUSE DE PRÉLÈVEMENT MOYENNANT INDEMNITÉ',
  s3: 'SECTION III — DU PRÉCIPUT CONVENTIONNEL',
  s4: 'SECTION IV — DES CLAUSES PAR LESQUELLES ON ASSIGNE À CHACUN DES ÉPOUX DES PARTS INÉGALES DANS LA COMMUNAUTÉ', // libellé du prompt §6 (absent de la table — réserve)
  s5: 'SECTION V — DE LA COMMUNAUTÉ À TITRE UNIVERSEL',
  dispCinq: 'DISPOSITIONS COMMUNES AUX CINQ SECTIONS CI-DESSUS',
  s6: 'SECTION VI — DE LA CLAUSE DE SÉPARATION DE BIENS',
  dispHuit: 'Dispositions communes aux huit sections ci-dessus', // ligne existante, promue en toc
}
// Lignes nues (hors toc) à retirer du corps — remplacées par la nouvelle arborescence.
const PLAIN_REMOVE = [
  'De la communauté réduite aux acquêts',
  'De la clause qui exclut de la communauté le mobilier en tout ou en partie',
  'De la clause d’ameublissement',
  'De la Clause de séparation des dettes',
  'De la faculté accordée à la femme de reprendre son apport franc et quitte',
  'Du préciput conventionnel',
]

async function main() {
  const ops = (JSON.parse(readFileSync(`${DIR}/concordance.json`, 'utf8')) as Op[])
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!doc?.bodyOriginal || !doc.annotationsJson) throw new Error('Code civil annoté introuvable')
  const ann = JSON.parse(doc.annotationsJson) as Annotations & Record<string, any>

  // ── Classification finale ──
  const AMEND = ops.filter((o) => o.kind === 'amend_article')
  const ABROG = [
    ...ops.filter((o) => o.kind === 'abrog_article'),
    ...ops.filter((o) => o.row === 144), // art. 1310 — « Amandé » sans nouvelle version → abrogation (prompt §4 art. 5), anomalie consignée
  ].map((o) => (o.row === 144 ? { ...o, art: '1310' } : o))
  if (AMEND.length !== 93) throw new Error(`amendés attendus 93, trouvés ${AMEND.length}`)
  if (ABROG.length !== 58) throw new Error(`abrogés attendus 58, trouvés ${ABROG.length}`)
  if (AMEND.some((o) => !o.new.trim() && o.row !== 144)) throw new Error('un amendé sans nouvelle version')

  // ── Vérif d'ordre de la table : chaque intitulé s'insère avant l'article attendu ──
  const nextArt = (row: number): string | null => {
    for (const o of ops) if (o.row > row && (o.kind === 'amend_article' || o.kind === 'abrog_article') && o.art) return o.art
    return null
  }
  const EXPECT: [number, string][] = [[35, '1216'], [45, '1225'], [60, '1239'], [106, '1282'], [108, '1283'], [113, '1287'], [119, '1291'], [129, '1299'], [131, '1300'], [134, '1302']]
  for (const [row, art] of EXPECT) {
    const got = nextArt(row)
    if (got !== art) throw new Error(`ordre table : ligne ${row} devrait précéder l'art. ${art}, trouve ${got}`)
  }
  console.log('✓ ordre de la table conforme (10 intitulés positionnés par leurs voisins)')

  // ── SAUVEGARDE (une seule fois : le vrai « avant ») ──
  const avs0 = await prisma.articleVersion.findMany({ where: { documentId: doc.id } })
  if (!existsSync(`${DIR}/backup-before.json`)) {
    writeFileSync(`${DIR}/backup-before.json`, JSON.stringify({ id: doc.id, bodyOriginal: doc.bodyOriginal, annotationsJson: doc.annotationsJson, articleVersions: avs0 }, null, 1))
    console.log('✓ sauvegarde écrite : backup-before.json')
  } else console.log('✓ sauvegarde déjà présente (conservée)')

  // ── Snapshot des textes d'origine (AVANT édition du corps), bornés par toc + lignes nues ──
  const tocLabels = new Set(ann.toc.map((t) => norm(t.label)))
  const plainSet = new Set([...PLAIN_REMOVE, 'DEUXIÈME PARTIE', 'De la communauté conventionnelle et des conventions qui peuvent modifier ou même exclure la communauté légale', H.dispHuit].map(norm))
  const isBoundary = (line: string) => tocLabels.has(norm(line)) || plainSet.has(norm(line))
  const orig = new Map<string, string>()
  for (const seg of splitArticles(doc.bodyOriginal, isBoundary)) if (seg.anchor && !orig.has(seg.anchor)) orig.set(seg.anchor, seg.lines.join('\n'))
  for (const o of [...AMEND, ...ABROG]) if (!orig.has(`art-${o.art}`)) throw new Error(`art. ${o.art} introuvable dans le corps`)

  // ── ÉDITION DU CORPS (intitulés seulement — les textes d'articles restent, overlay §02) ──
  let lines = doc.bodyOriginal.split('\n')
  const already = lines.some((l) => norm(l) === norm(H.p1)) // relance : édits déjà appliqués ?
  const journal: string[] = []
  if (!already) {
    const lineOfToc = (anchor: string): number => {
      const label = ann.toc.find((t) => t.anchor === anchor)?.label
      const i = lines.findIndex((l) => norm(l) === norm(label ?? ' '))
      if (i < 0) throw new Error(`ligne toc ${anchor} introuvable`)
      return i
    }
    const artLine = (n: string): number => {
      const i = lines.findIndex((l) => new RegExp(`^Art\\.?\\s*${n}\\b`).test(l.trim()))
      if (i < 0) throw new Error(`tête d'article ${n} introuvable`)
      return i
    }
    // 1) Remplacements de libellés (sec-198, sec-199) — même position.
    lines[lineOfToc('sec-198')] = H.passif
    lines[lineOfToc('sec-199')] = H.admin
    journal.push('sec-198 et sec-199 : libellés remplacés')
    // 2) Retraits : ancien SECTION III (sec-200, déplacé), SECTION IV acceptation (sec-201),
    //    SECTION VII (sec-206, « Eliminé »), SECTION VIII (sec-207), lignes nues conventionnelles,
    //    et la paire « DEUXIÈME PARTIE » + sous-titre (fusionnée en un libellé).
    const drop = new Set<number>([lineOfToc('sec-200'), lineOfToc('sec-201'), lineOfToc('sec-206'), lineOfToc('sec-207')])
    for (const p of PLAIN_REMOVE) {
      const i = lines.findIndex((l) => norm(l) === norm(p))
      if (i < 0) throw new Error(`ligne nue introuvable : ${p}`)
      drop.add(i)
    }
    const iP2 = lines.findIndex((l) => norm(l) === 'DEUXIÈME PARTIE')
    if (iP2 < 0 || norm(lines[iP2 + 1]) !== norm('De la communauté conventionnelle et des conventions qui peuvent modifier ou même exclure la communauté légale'))
      throw new Error('paire DEUXIÈME PARTIE introuvable')
    drop.add(iP2 + 1)
    lines[iP2] = H.partie2 // la 1ʳᵉ ligne de la paire devient le libellé joint
    // 3) Insertions « avant l'article N » (ordre de la table).
    const inserts: [string, string[]][] = [
      ['1216', [H.dissolution, H.p1]], ['1225', [H.p2]], ['1239', [H.p3]],
      ['1283', [H.s1]], ['1287', [H.s2]], ['1291', [H.s3]], ['1295', [H.s4]],
      ['1299', [H.s5]], ['1300', [H.dispCinq]], ['1302', [H.s6]],
    ]
    const out: string[] = []
    const insertAt = new Map<number, string[]>()
    for (const [n, hs] of inserts) insertAt.set(artLine(n), hs)
    lines.forEach((l, i) => {
      if (insertAt.has(i)) out.push(...insertAt.get(i)!)
      if (!drop.has(i)) out.push(l)
    })
    lines = out
    journal.push(`corps : ${drop.size} lignes retirées, ${inserts.reduce((s, [, h]) => s + h.length, 0)} intitulés insérés, paire DEUXIÈME PARTIE fusionnée`)
  } else console.log('✓ corps déjà édité (relance) — intitulés en place')
  const newBody = lines.join('\n')

  // ── NOUVELLE TOC (ordre = ordre du corps) ──
  const maxSec = Math.max(...ann.toc.map((t) => Number((t.anchor.match(/^sec-(\d+)$/) ?? [])[1] ?? 0)))
  let next = maxSec
  const mk = (label: string, level: number): TocEntry => ({ label, level, anchor: `sec-${++next}`, kind: 'section' })
  const keep = (t: TocEntry) => !['sec-201', 'sec-206', 'sec-207'].includes(t.anchor)
  const newToc: TocEntry[] = []
  const existingNew = new Map((ann.toc as TocEntry[]).map((t) => [norm(t.label), t])) // relance : réutiliser les ancres déjà créées
  const add = (label: string, level: number) => newToc.push(existingNew.get(norm(label)) ?? mk(label, level))
  for (const t of ann.toc as TocEntry[]) {
    if (!keep(t)) continue
    if (t.anchor === 'sec-198') { newToc.push({ ...t, label: H.passif }); continue }
    if (t.anchor === 'sec-199') { newToc.push({ ...t, label: H.admin }); continue }
    if (t.anchor === 'sec-200') {
      newToc.push({ ...t, label: H.dissolution })
      add(H.p1, 3); add(H.p2, 3); add(H.p3, 3)
      continue
    }
    if (t.anchor === 'sec-205') {
      newToc.push(t)
      add(H.partie2, 2); add(H.s1, 3); add(H.s2, 3); add(H.s3, 3); add(H.s4, 3); add(H.s5, 3); add(H.dispCinq, 3); add(H.s6, 3); add(H.dispHuit, 3)
      continue
    }
    newToc.push(t)
  }
  // ── Vérification de segmentation AVANT toute écriture ──
  const blocks = segmentAnnotated(newBody, newToc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const bodies = blocks.filter((b): b is BodyBlock => b.kind === 'body')
  const anchors = new Set(bodies.filter((b) => b.anchor).map((b) => b.anchor))
  if (secs !== newToc.length) throw new Error(`segmentation : ${secs}/${newToc.length} en-têtes appariés — ANNULÉ`)
  if (anchors.size !== 2047) throw new Error(`ancres d'articles : ${anchors.size} ≠ 2047 — ANNULÉ`)
  console.log(`✓ segmentation projetée : ${secs}/${newToc.length} en-têtes · 2047 articles intacts`)

  // ── navToc : reconstruire les enfants du CHAPITRE II (sec-195) ──
  const range = newToc.slice(newToc.findIndex((t) => t.anchor === 'sec-196'), newToc.findIndex((t) => t.anchor === 'sec-210') + 1)
  const patchNav = (items: any[]): boolean => {
    for (const it of items) {
      if (it.anchor === 'sec-195') { it.children = range.map((t) => ({ label: t.label, anchor: t.anchor })); return true }
      if (it.children?.length && patchNav(it.children)) return true
    }
    return false
  }
  if (!patchNav(ann.navToc[0].children ?? ann.navToc)) throw new Error('CHAPITRE II introuvable dans navToc')

  // ── OVERLAY : purge des versions du Décret (idempotence) puis application ──
  const scope = [...AMEND, ...ABROG].map((o) => `art-${o.art}`)
  await prisma.articleVersion.deleteMany({ where: { documentId: doc.id, anchor: { in: scope }, amendedByNumber: REF } })
  ann.status = ann.status ?? {}; ann.oldVersions = ann.oldVersions ?? {}; ann.connexe = ann.connexe ?? {}
  const juris = (ann.jurisprudence ?? {}) as Record<string, { ref?: string; excerpt?: string }[]>
  const comms = (ann.commentaires ?? {}) as Record<string, string[]>
  const jurisText = (n: string): string => {
    const parts: string[] = []
    for (const k of Object.keys(juris)) if (k.endsWith(`|art-${n}`)) {
      for (const c of juris[k]) parts.push([c.ref, c.excerpt].filter(Boolean).join(' — '))
      delete juris[k]
    }
    for (const k of Object.keys(comms)) if (k.endsWith(`|art-${n}`)) { parts.push(...comms[k]); delete comms[k] }
    return parts.length ? `\n\nJurisprudence et notes sous l’ancien texte :\n${parts.map((p) => `• ${p}`).join('\n')}` : ''
  }
  const connexe = ann.connexe as Record<string, { label: string; text: string }[]>
  const addConnexe = (anchor: string, text: string) => {
    const arr = (connexe[anchor] = connexe[anchor] ?? [])
    if (!arr.some((b) => b.text === text)) arr.push({ label: '', text })
  }
  let nA = 0
  for (const o of AMEND) {
    const n = o.art!, anchor = `art-${n}`
    // Note col. 4 : jointe au repliable, SAUF l'anomalie de l'art. 1194 (« Il n'y a pas de
    // note corriger… » — réserve, non affichée) et sauf doublon avec la jurisprudence en base.
    const hadDbJuris = Object.keys(juris).some((k) => k.endsWith(`|art-${n}`))
    const extra = jurisText(n) || (o.note && n !== '1194' && !hadDbJuris ? `\n\nJurisprudence sous l’ancien texte :\n• ${o.note}` : '')
    // §10 : apostrophe typographique dans les NOUVELLES versions uniquement (correction
    // silencieuse journalisée) — les textes historiques restent verbatim, scories comprises.
    const newText = (`Art. ${n} (${REF_COURT}) ` + o.new.replace(/^«?\s*Article\s+\d+\s*\.?-?\s*/i, '')).replace(/'/g, '’')
    await amendArticle({ documentId: doc.id, anchor, label: `Article ${n}`, originalBody: orig.get(anchor)!, newBody: newText, amendedByDocId: null, amendedByNumber: REF, effectiveDate: EFFECTIVE, origin: 'MANUAL' })
    ann.status[anchor] = 'modifié'
    // Idempotence : ne pas écraser un repliable déjà enrichi (la jurisprudence d'époque est
    // RETIRÉE de la carte au 1er passage — une relance la perdrait si on réécrivait).
    if (!ann.oldVersions[anchor]) ann.oldVersions[anchor] = orig.get(anchor)! + extra
    addConnexe(anchor, `${o.mention} — ${MONITEUR}.`)
    if (++nA % 20 === 0) console.log(`  … ${nA}/93 amendés`)
  }
  console.log(`✓ ${nA} articles amendés (overlay + pastille + repliable)`)
  let nB = 0
  for (const o of ABROG) {
    const n = o.art!, anchor = `art-${n}`
    await abrogateArticle({ documentId: doc.id, anchor, label: `Article ${n}`, originalBody: orig.get(anchor)!, amendedByDocId: null, amendedByNumber: REF, effectiveDate: EFFECTIVE })
    ann.status[anchor] = 'abrogé'
    if (!ann.oldVersions[anchor]) ann.oldVersions[anchor] = orig.get(anchor)! + jurisText(n)
    const mention = o.row === 144 ? `${o.mention} [libellé de la source reproduit tel quel ; opération réelle : abrogation — art. 5 du Décret]` : o.mention
    addConnexe(anchor, `${mention} — ${MONITEUR}.`)
    nB++
  }
  console.log(`✓ ${nB} articles abrogés (pastille + ancien texte repliable)`)

  // ── INDEX alphabétique : entrées nouvelles (§7 du prompt) ──
  const IDX: [string, (number | string)[]][] = [
    ['Logement familial', [1174, 1205]], ['Changement de régime matrimonial', [1181, 1216]],
    ['Acquêts', [1187, 1188]], ['Biens propres', [1189, 1190, 1191, 1192, 1193, 1205, 1206]],
    ['Récompenses (communauté)', [1197, 1198, 1199, 1207, 1211, 1226, 1227, 1228, 1229, 1230, 1231, 1232]],
    ['Emploi et remploi', [1208, 1209, 1210]], ['Administration conjointe de la communauté', [1201, 1203]],
    ['Dissolution de la communauté', [1216, 1217, 1218, 1219, 1220, 1221, 1222, 1223, 1224]],
    ['Séparation de biens judiciaire', [1218, 1219, 1220, 1221, 1222, 1223, 1224]],
    ['Liquidation et partage de la communauté', [1225, 1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234, 1235, 1236, 1237, 1238]],
    ['Recel de communauté', [1235]], ['Passif après dissolution', [1239, 1240, 1241, 1242, 1243, 1244, 1245, 1246, 1247, 1248]],
    ['Communauté des meubles et acquêts', [1282, 1283, 1284, 1285, 1286]],
    ['Clause de prélèvement moyennant indemnité', [1287, 1288, 1289, 1290]],
    ['Préciput conventionnel', [1291, 1292, 1293, 1294]], ['Parts inégales (communauté)', [1295, 1296, 1297, 1298]],
    ['Communauté universelle', [1299]], ['Clause de séparation de biens', [1302, 1303, 1304, 1305, 1306, 1307, 1308, 1309]],
    ['Mandat entre époux', [1305, 1306, 1307]],
  ]
  const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  let idxNew = 0, idxMerged = 0
  for (const [subject, refs] of IDX) {
    const ex = ann.indexEntries.find((e: any) => fold(e.subject) === fold(subject))
    if (ex) { ex.ctRefs = [...new Set([...ex.ctRefs, ...refs])]; idxMerged++ }
    else { ann.indexEntries.push({ subject, ctRefs: refs }); idxNew++ }
  }
  ann.indexEntries.sort((a: any, b: any) => fold(a.subject).localeCompare(fold(b.subject)))
  console.log(`✓ index : ${idxNew} sujets créés, ${idxMerged} enrichis`)

  ann.toc = newToc
  await prisma.document.update({ where: { id: doc.id }, data: { bodyOriginal: newBody, annotationsJson: JSON.stringify(ann) } })
  await reindexDocument(doc.id)
  console.log('✓ document écrit + réindexé (recherche : nouveaux textes ET anciens textes repliés)')

  // ── ANNEXE : renvois du corpus vers les articles abrogés (rapport CSV, aucune réécriture) ──
  const abrogNums = ABROG.map((o) => o.art!)
  const others = await prisma.document.findMany({ where: { bodyOriginal: { contains: 'C. civ' } }, select: { id: true, titleFr: true, bodyOriginal: true } })
  const csv: string[] = ['document;titre;article_abroge;occurrences']
  for (const d of others) {
    for (const n of abrogNums) {
      const m = d.bodyOriginal!.match(new RegExp(`C\\.\\s*civ\\.?,?\\s*${n}(?!\\d)`, 'g'))
      if (m?.length) csv.push(`${d.id};${d.titleFr.replace(/;/g, ',').slice(0, 60)};${n};${m.length}`)
    }
  }
  writeFileSync(`${DIR}/annexe_renvois.csv`, csv.join('\n'))
  console.log(`✓ annexe_renvois.csv : ${csv.length - 1} renvoi(s) vers des articles abrogés recensé(s)`)
  if (journal.length) console.log('\nJournal corps :', journal.join(' · '))
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
