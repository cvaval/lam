/**
 * Circulaire BRH n° 120 du 25 mai 2021 — Appel public à l'épargne et placement restreint.
 * Le texte du Cabinet Salès (`scripts/data/circ-brh-120/_body.txt`, produit par
 * `extraire-circ-brh-120.ts`) REMPLACE l'extraction de la couche texte du PDF, et la fiche passe
 * au LECTEUR ANNOTÉ (sommaire, index latéral, 45 divisions ancrées, renvois).
 *
 *     SEARCH_PROVIDER=fts npx tsx scripts/reparer-circulaire-120.ts                 # SIMULATION
 *     SEARCH_PROVIDER=fts npx tsx scripts/reparer-circulaire-120.ts --voir=art-43   # aperçu d'une division
 *     SEARCH_PROVIDER=fts npx tsx scripts/reparer-circulaire-120.ts --apply         # écriture
 *
 * Gabarit : scripts/reparer-circulaire-127.ts (réparation EN PLACE d'une fiche existante). Prompt :
 * « Lam — Prompt circulaire BRH n° 120 (texte du Cabinet Salès, lecteur annoté).md » (§ 5.3 : les
 * gardes-fous, numérotés ci-dessous comme dans le prompt).
 *
 * La cible est résolue PAR ID puis contre-vérifiée par (type, number) ET par l'empreinte de son
 * corps actuel (`_avant.txt`) — jamais par le titre, jamais sur une base qui aurait changé.
 *
 * ─── CE QUI CHANGE, CE QUI NE CHANGE PAS ───────────────────────────────────────────────────
 *  · bodyOriginal ← corps du Cabinet Salès, quatre coquilles de la BRH RÉTABLIES (le fac-similé
 *    fait foi, fautes comprises — garde 7), trois notes replacées après leur appel (D2).
 *  · titleFr (D1), keywords (D3), source → CIRC_BRH_120 (durabilité : `import-brh --commit` purge
 *    source='BRH' ; '120_Circulaire.pdf' est inscrit dans SUPERSEDED_BY_WEB — garde 12),
 *    annotationsJson, searchText.
 *  · NE BOUGENT PAS : status, publicationDate, effectiveDate, sourcePdfUrl (fac-similé), matiere,
 *    sealed, abrogatedByNumber, DocumentTheme — ils ne sont pas dans le `data`.
 *  · L'ancien corps part INTÉGRALEMENT au journal d'audit (DOC_PUBLISHED, meta.sauvegarde) et
 *    reste dans `_avant.txt`.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
// BANC=1 : ne pas forcer la base du .env — répétition à blanc sur la base LOCALE du banc
// (`lam_banc`, config « lam-banc »), la fiche y ayant été copiée au préalable.
if (process.env.BANC !== '1') for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import { segmentAnnotated, type Annotations, type TocEntry } from '../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { parseCirculaireRef } from '../src/lib/brh/gaps'

const DIR = 'scripts/data/circ-brh-120'
const IMPORT_BRH = 'scripts/import-brh.ts'
const ID = 'cmqbnm0e00014smfzhqqq6g9d'
const NUMBER = 'Circulaire n° 120'
const SOURCE_CIBLE = 'CIRC_BRH_120'
const SOURCE_LOI = 'LOI_BANQUES_2012'
const TITRE = 'Circulaire BRH n° 120 — Appel public à l’épargne et placement restreint' // D1
const KEYWORDS = 'appel public à l’épargne; placement restreint; prospectus; visa; prestataire de service d’investissement; émetteur; investisseur averti; titres financiers' // D3
const NB_ARTICLES = 45

/** Les cinq chaînes du fac-similé qui DOIVENT être là, et les cinq du transcripteur qui ne doivent PAS (garde 7). */
const FACSIMILE = ['le plut tôt possible', 'être établit un document', /ne suit pas à l['’]émetteur/, /qu['’]elle qu['’]en soit la nature et méthode de calcul/]
const CORRIGEES = ['le plus tôt possible', 'être établi un document', /ne nuit pas à l['’]émetteur/, /(?<!qu['’]e)quelle qu['’]en soit la nature/]

const APPLY = process.argv.includes('--apply')
const VOIR = process.argv.find((a) => a.startsWith('--voir='))?.slice(7)
function fail(msg: string): never {
  throw new Error(`${msg} — annulé`)
}
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[’'`"«»“”]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
function shingles(s: string, n = 8) {
  const w = fold(s).split(' ').filter(Boolean)
  const set = new Set<string>()
  for (let i = 0; i + n <= w.length; i++) set.add(w.slice(i, i + n).join(' '))
  return { set, words: w }
}

interface Struct { points: string[]; labels: Record<string, string>; toc: TocEntry[]; navToc: Annotations['navToc'] }
interface RawIndex { subject: string; ctRefs: string[]; secRefs?: { label: string; anchor: string }[] }

async function main() {
  const body = readFileSync(`${DIR}/_body.txt`, 'utf8').trimEnd()
  const avant = readFileSync(`${DIR}/_avant.txt`, 'utf8')
  const st: Struct = JSON.parse(readFileSync(`${DIR}/_struct.json`, 'utf8'))
  const raw: RawIndex[] = JSON.parse(readFileSync(`${DIR}/_index.json`, 'utf8'))

  // ══ 1 · Cible : par ID, contre-vérifiée par (type, number) et par l'empreinte du corps ═══
  const doc = await prisma.document.findUnique({
    where: { id: ID },
    select: { id: true, type: true, number: true, source: true, status: true, sealed: true, titleFr: true, keywords: true, matiere: true, publicationDate: true, effectiveDate: true, sourcePdfUrl: true, bodyOriginal: true, bodyClean: true, annotationsJson: true, richBlocksJson: true, searchText: true },
  })
  if (!doc) fail(`document ${ID} introuvable`)
  if (doc.type !== 'CIRCULAIRE_BRH' || doc.number !== NUMBER) fail(`cible inattendue : type=${doc.type} number=${doc.number}`)
  if (doc.bodyOriginal !== avant) fail(`le corps en base (${doc.bodyOriginal.length} c., sha ${sha(doc.bodyOriginal).slice(0, 12)}) n'est plus celui de _avant.txt (${avant.length} c., sha ${sha(avant).slice(0, 12)}) — la base a changé, ou la réparation est déjà passée`)
  const parSource = await prisma.document.findMany({ where: { source: SOURCE_CIBLE }, select: { id: true } })
  if (parSource.some((d) => d.id !== doc.id)) fail(`un AUTRE document porte déjà source=${SOURCE_CIBLE}`)
  if (doc.annotationsJson && doc.annotationsJson.length > 2) fail(`annotationsJson n'est pas vide (${doc.annotationsJson.length} c.) — un appareil est déjà posé`)
  if (doc.richBlocksJson && doc.richBlocksJson.length > 2) fail(`richBlocksJson n'est pas vide — le prompt le disait nul`)
  // 2
  if (!parseCirculaireRef(doc.number)) fail(`numéro non canonique : ${doc.number}`)

  // ══ Le texte lié : la loi du 14 mai 2012, par SOURCE ═════════════════════════════════════
  const loi = await prisma.document.findFirst({ where: { source: SOURCE_LOI }, select: { id: true, titleFr: true, status: true, bodyOriginal: true } })
  if (!loi) fail(`aucun document source=${SOURCE_LOI}`)
  if (loi.status === 'ABROGE') fail(`${SOURCE_LOI} est ABROGÉ — le renvoi devrait le dire`)
  const ancresLoi = new Set(loi.bodyOriginal.split(/\r?\n/).map((l) => articleAnchorFromHeading(l.trim())).filter(Boolean))
  for (const a of ['art-2', 'art-4', 'art-191']) if (!ancresLoi.has(a)) fail(`la loi ${SOURCE_LOI} n'a pas d'ancre ${a}`) // 11

  const connexe: NonNullable<Annotations['connexe']> = {
    'art-1': [
      {
        label: 'Loi du 14 mai 2012 sur les banques et autres institutions financières — art. 4, 5, 7, 109, 161, 171, 191 et 199',
        text: 'Fondement de la circulaire, visé en son préambule : les banques et les sociétés de promotion des investissements sont tenues de respecter les présentes normes.',
        docId: loi.id,
        anchor: 'art-4',
      },
    ],
    'art-2': [
      {
        label: 'Loi du 14 mai 2012 sur les banques — art. 2',
        text: 'Les banques et autres institutions financières visées à l’article 2 de la loi sont des « investisseurs avertis » (définition w).',
        docId: loi.id,
        anchor: 'art-2',
      },
    ],
    'art-19': [
      {
        label: 'Loi du 14 mai 2012 sur les banques — art. 191 et suivants',
        text: 'La mention officielle du visa, portée sur la page de couverture du prospectus, s’ouvre sur ces articles.',
        docId: loi.id,
        anchor: 'art-191',
      },
    ],
  }

  // ══ Gardes-fous BLOQUANTS, tous avant la moindre écriture ═════════════════════════════════
  const blocks = segmentAnnotated(body, st.toc, st.points)
  const secs = blocks.filter((b) => b.kind === 'section').map((b) => b.anchor)
  const arts = blocks.filter((b) => b.kind === 'body' && b.anchor && !b.noAnchors).map((b) => b.anchor as string)
  const ids = [...secs, ...arts]
  const anchorSet = new Set(ids)

  // 0
  if (st.toc.some((t) => t.kind === 'connexe')) fail("toc : kind:'connexe' est un verrou à sens unique")
  // 3 — sommaire
  if (secs.length !== st.toc.length) {
    const vus = new Set(blocks.filter((b) => b.kind === 'section').map((b) => b.text))
    fail(`sommaire ${secs.length}/${st.toc.length} apparié — introuvables : ${st.toc.filter((t) => !vus.has(t.label)).map((t) => t.label).slice(0, 6).join(' | ')}`)
  }
  // 4 — divisions
  const wanted = st.points.map((p) => `art-${p}`)
  if (arts.length !== NB_ARTICLES || wanted.length !== NB_ARTICLES) fail(`${arts.length} divisions ancrées pour ${NB_ARTICLES} attendues`)
  if (arts.join(',') !== wanted.join(',')) fail(`divisions hors ordre ou manquantes : ${arts.filter((a) => !wanted.includes(a)).join(', ')} / ${wanted.filter((a) => !arts.includes(a)).join(', ')}`)
  const premiereAnnexe = blocks.findIndex((b) => b.kind === 'section' && /^ANNEXE\b/.test(b.text))
  const artsEnAnnexe = blocks.slice(premiereAnnexe).filter((b) => b.kind === 'body' && b.anchor && !b.noAnchors)
  if (artsEnAnnexe.length) fail(`${artsEnAnnexe.length} division(s) ancrée(s) dans les annexes : ${artsEnAnnexe.map((b) => b.anchor).join(', ')}`)
  const dup = ids.filter((a, i) => ids.indexOf(a) !== i)
  if (dup.length) fail(`ancres dupliquées : ${[...new Set(dup)].join(', ')}`)
  const labelMiss = wanted.filter((a) => !st.labels[a])
  if (labelMiss.length) fail(`libellés manquants : ${labelMiss.join(', ')}`)
  // 5 — texte rejoint = corps
  if (blocks.map((b) => b.text).join('\n') !== body) fail('texte perdu à la segmentation')
  // 6 — index
  const pointu = raw.flatMap((e) => e.ctRefs).filter((r) => r.includes('.'))
  if (pointu.length) fail(`index : ctRefs en POINTS : ${[...new Set(pointu)].join(', ')}`)
  const idxRefs = raw.flatMap((e) => [...e.ctRefs.map((r) => `art-${r}`), ...(e.secRefs ?? []).map((s) => s.anchor)])
  const deadIdx = idxRefs.filter((a) => !anchorSet.has(a))
  if (deadIdx.length) fail(`index : renvois morts ${[...new Set(deadIdx)].join(', ')}`)
  const covered = new Set(idxRefs)
  const niveau = new Map(st.toc.map((t) => [t.anchor, t.level]))
  // Chaque division, et chaque section de niveau 1 ou 2 ; les sous-subdivisions d'annexe
  // (niveau 3) se joignent par le sommaire — une entrée d'index par « 1.2. Renseignements
  // divers… » ne serait que du bruit alphabétique.
  const uncovered = ids.filter((a) => !covered.has(a) && (niveau.get(a) ?? 0) <= 2)
  if (uncovered.length) fail(`divisions/sections hors index : ${uncovered.join(', ')}`)
  const navDead = (JSON.stringify(st.navToc).match(/"anchor":"([^"]+)"/g) ?? []).map((s) => s.slice(10, -1)).filter((a) => !anchorSet.has(a))
  if (navDead.length) fail(`navToc : ancres mortes ${[...new Set(navDead)].join(', ')}`)
  const cxDead = Object.keys(connexe).filter((a) => !anchorSet.has(a))
  if (cxDead.length) fail(`connexe : clés orphelines ${cxDead.join(', ')}`)
  // commentaires : la clé est le jurisKey DÉRIVÉ du bloc art-45 — lue, jamais fabriquée
  const bloc45 = blocks.find((b): b is Extract<typeof b, { kind: 'body' }> => b.kind === 'body' && b.anchor === 'art-45')
  if (!bloc45?.jurisKey) fail('art-45 sans jurisKey')
  const commentaires: Record<string, string[]> = {
    [bloc45.jurisKey]: [
      'Circulaire signée à Port-au-Prince le 25 mai 2021 par Jean Baden Dubois, Gouverneur de la Banque de la République d’Haïti ; entrée en vigueur le 14 juin 2021. Fac-similé du texte officiel joint (49 pages, quatre annexes). Texte établi d’après la transcription du Cabinet Salès, relue sur le fac-similé, qui fait foi.',
    ],
  }
  // 7 — le fac-similé fait foi, fautes comprises
  for (const f of FACSIMILE) if (!(typeof f === 'string' ? body.includes(f) : f.test(body))) fail(`chaîne du fac-similé absente : ${String(f)}`)
  if ((body.match(/qu['’]elle qu['’]en soit la nature/g) ?? []).length !== 2) fail('« qu’elle qu’en soit » : deux occurrences attendues')
  for (const c of CORRIGEES) if (typeof c === 'string' ? body.includes(c) : c.test(body)) fail(`correction du transcripteur encore présente : ${String(c)}`)
  // 8 — propreté
  if (/^\[\d+\]$/m.test(body)) fail('marqueur de page dans le corps')
  if (/\t/.test(body)) fail('tabulation dans le corps')
  if (/rompus1|important 3\b/.test(body)) fail('appel de note collé')
  if (/\n\n\n/.test(body)) fail('lignes vides en triple')
  for (const n of ['(1) Droits d’attribution', '(2) Le rompu est', '(3) C’est un changement']) {
    const occ = body.split(n).length - 1
    if (occ !== 1) fail(`note « ${n} » : ${occ} occurrence(s)`)
    const iNote = body.indexOf(n)
    const iAppel = body.lastIndexOf(`(${n[1]})`, iNote - 1)
    if (iAppel < 0 || body.slice(iAppel, iNote).split('\n').length !== 2) fail(`note ${n[1]} : pas immédiatement après son appel`)
  }
  // 9 — mesure de sens contre l'ancien corps
  const A = shingles(avant.replace(/^\[\d+\]$/gm, '').replace(/-\n(?=[a-zé])/g, ''))
  const B = shingles(body)
  const absents = [...A.set].filter((s) => !B.set.has(s))
  const taux = absents.length / A.set.size
  if (taux > 0.01) fail(`mesure de sens : ${(100 * taux).toFixed(2)} % des shingles de l'ancien corps sont absents du nouveau (> 1 %)`)
  // zones absentes, pour lecture
  const flags = new Array<boolean>(A.words.length).fill(false)
  for (let i = 0; i + 8 <= A.words.length; i++) if (!B.set.has(A.words.slice(i, i + 8).join(' '))) for (let k = i; k < i + 8; k++) flags[k] = true
  const zones: string[] = []
  let s = -1
  for (let i = 0; i <= A.words.length; i++) {
    if (i < A.words.length && flags[i]) { if (s < 0) s = i }
    else if (s >= 0) { zones.push(A.words.slice(s, Math.min(i, s + 14)).join(' ')); s = -1 }
  }
  // 10 — fin, signature
  if (!body.endsWith('au regard de la gravité des faits en cause.')) fail('fin du corps inattendue')
  for (const k of ['Jean Baden Dubois\nGouverneur', 'Port-au-Prince, le 25 mai 2021.']) if (body.split(k).length - 1 !== 1) fail(`« ${k.replace('\n', ' / ')} » : pas exactement une fois`)
  // 12 — durabilité
  const brhSrc = existsSync(IMPORT_BRH) ? readFileSync(IMPORT_BRH, 'utf8') : ''
  if (!brhSrc.includes("'120_Circulaire.pdf'")) fail(`${IMPORT_BRH} : '120_Circulaire.pdf' absent de SUPERSEDED_BY_WEB — le ré-import recréerait un doublon source='BRH'`)
  // 14 — longueur
  if (body.length < 115_000 || body.length > 130_000) fail(`corps de ${body.length} c., hors de [115 000, 130 000]`)

  // ══ Appareil ═══════════════════════════════════════════════════════════════════════════════
  const indexEntries = raw.map((e) => ({
    subject: e.subject,
    ctRefs: e.ctRefs,
    ...(e.secRefs ? { docRefs: e.secRefs.map((x) => ({ label: x.label, id: doc.id, anchor: x.anchor })) } : {}),
  }))
  const annotations: Annotations & Record<string, unknown> = {
    title: TITRE,
    annotationAuthor: 'Lam Veritab',
    navToc: st.navToc,
    toc: st.toc,
    connexes: [],
    jurisprudence: {},
    indexEntries,
    labels: st.labels,
    pointAnchors: st.points,
    connexe,
    commentaires,
  }
  const annotationsJson = JSON.stringify(annotations)
  const searchText = buildSearchText({ titleFr: TITRE, number: doc.number, bodyOriginal: body, matiere: doc.matiere, keywords: KEYWORDS, annotationsJson } as any)

  // ══ Rapport ════════════════════════════════════════════════════════════════════════════════
  console.log(`CIRCULAIRE BRH n° 120 — ${doc.titleFr}`)
  console.log(`   cible       ${doc.id} · ${doc.type} · ${doc.number} · statut ${doc.status} · sealed ${doc.sealed} · thèmes intacts`)
  console.log(`   titre       → ${TITRE} (D1)`)
  console.log(`   keywords    « ${doc.keywords} » → « ${KEYWORDS} » (D3)`)
  console.log(`   source      ${doc.source} → ${SOURCE_CIBLE} · '120_Circulaire.pdf' dans SUPERSEDED_BY_WEB`)
  console.log(`   corps       ${doc.bodyOriginal.length} → ${body.length} c. · ${doc.bodyOriginal.split('\n').length} → ${body.split('\n').length} lignes · sha ${sha(body).slice(0, 12)}`)
  console.log(`   sommaire    ${secs.length}/${st.toc.length} sections appariées (niveau 1 : ${st.toc.filter((t) => t.level === 1).length}) · divisions ${arts.length}/${NB_ARTICLES}, aucune en annexe`)
  console.log(`   index       ${raw.length} entrées · ${idxRefs.length} renvois, 0 mort · 0 division/section (niv. ≤ 2) hors index`)
  console.log(`   navToc      ${(JSON.stringify(st.navToc).match(/"anchor"/g) ?? []).length} ancres, 0 morte`)
  console.log(`   renvois     ${Object.keys(connexe).length} ancres → ${loi.titleFr.slice(0, 60)} [${loi.status}] #art-4 #art-2 #art-191`)
  console.log(`   commentaire 1, clé ${bloc45.jurisKey}`)
  console.log(`   fac-similé  5 reversions présentes, 0 correction du transcripteur · 3 notes après leur appel`)
  console.log(`   sens        ${(100 * taux).toFixed(2)} % des shingles de l'ancien corps absents du nouveau (${absents.length}/${A.set.size}) — zones :`)
  for (const z of zones.slice(0, 12)) console.log(`               · ${z}`)
  console.log(`   searchText  ${doc.searchText?.length ?? 0} → ${searchText.length} c.`)
  console.log(`   inchangés   status ${doc.status} · publication ${doc.publicationDate?.toISOString().slice(0, 10)} · effet ${doc.effectiveDate?.toISOString().slice(0, 10)} · PDF ${doc.sourcePdfUrl ? 'oui' : 'NON'} · matière ${doc.matiere}`)

  if (VOIR) {
    const i = blocks.findIndex((b) => b.anchor === VOIR)
    if (i < 0) fail(`--voir : ancre ${VOIR} inconnue`)
    console.log(`\n── aperçu ${VOIR} ──`)
    console.log(blocks[i].text.slice(0, 2500))
    for (const b of connexe[VOIR] ?? []) console.log(`\n  ↪ ${b.label}\n    ${b.text}`)
    const bloc = blocks[i]
    const k = bloc.kind === 'body' ? bloc.jurisKey : null
    for (const t of (k && commentaires[k]) || []) console.log(`\n  ✎ [${k}] ${t}`)
  }

  if (!APPLY) {
    console.log('\n✓ contrôles verts. SIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  // ══ Écriture ════════════════════════════════════════════════════════════════════════════════
  // 60 s : la ligne d'audit emporte l'ancien corps entier (125 Ko) et le pooler est lent — les
  // 5 s par défaut ont expiré à 5,48 s au premier passage, transaction annulée, rien d'écrit.
  await prisma.$transaction(async (tx) => {
    await audit(
      {
        action: 'DOC_PUBLISHED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        meta: {
          actor: 'script:reparer-circulaire-120',
          motif: 'texte du Cabinet Salès (relu sur le fac-similé) en remplacement de l’extraction PDF + pose du lecteur annoté',
          sauvegarde: { source: doc.source, titleFr: doc.titleFr, keywords: doc.keywords, bodyOriginal: doc.bodyOriginal, searchText: doc.searchText },
          apres: { source: SOURCE_CIBLE, titleFr: TITRE, keywords: KEYWORDS, bodyLen: body.length, bodySha: sha(body), annotationsLen: annotationsJson.length },
          reversions: 5,
          notesReplacees: 3,
        },
      },
      tx as any,
    )
    await tx.document.update({
      where: { id: doc.id },
      data: { bodyOriginal: body, bodyClean: null, titleFr: TITRE, keywords: KEYWORDS, annotationsJson, searchText, source: SOURCE_CIBLE },
    })
  }, { timeout: 60_000, maxWait: 15_000 })
  await reindexDocument(doc.id)
  // audit() avale ses erreurs : on recompte
  const apres = await prisma.document.findUnique({ where: { id: doc.id }, select: { source: true, titleFr: true, bodyOriginal: true, annotationsJson: true } })
  const nAudit = await prisma.auditLog.count({ where: { action: 'DOC_PUBLISHED', targetId: doc.id } })
  console.log(`\n✓ écrit : ${doc.id} · source ${apres?.source} · corps ${apres?.bodyOriginal.length} c. · annotations ${apres?.annotationsJson?.length} c. · lignes DOC_PUBLISHED sur la fiche : ${nAudit}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(String(e instanceof Error ? e.message : e))
  await prisma.$disconnect()
  process.exit(1)
})
