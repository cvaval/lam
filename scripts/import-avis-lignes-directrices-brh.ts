/**
 * AVIS aux agents de change + LIGNES DIRECTRICES du 14 décembre 2020 (Jean Baden Dubois,
 * Gouverneur) — création en « Circulaires BRH » au format LECTEUR ANNOTÉ, statut EN VIGUEUR.
 *
 * Pris en application de l'ARTICLE 56 du décret du 25 novembre 2020 sur les intermédiaires
 * de change. Provenance : site brh.ht (l'Avis le dit lui-même) — le texte NE FIGURE PAS au
 * Moniteur Spécial n° 41 du 30 novembre 2020, qui lui est antérieur de deux semaines.
 *
 *     npx tsx scripts/import-avis-lignes-directrices-brh.ts              # SIMULATION
 *     npx tsx scripts/import-avis-lignes-directrices-brh.ts --voir=art-3 # aperçu d'un bloc
 *     npx tsx scripts/import-avis-lignes-directrices-brh.ts --apply      # écriture
 *
 * Gabarit : scripts/_import-circ-brh-105-2-117-1.ts. Données : scripts/data/avis-ld-brh-2020/.
 *
 * ── PIÈGES RENCONTRÉS, tous mesurés et non supposés ─────────────────────────────────────
 *
 *  1. NUMÉRO ABSENT. Le texte n'est pas une circulaire : il ne porte aucun numéro. Le
 *     garde-fou `parseCirculaireRef(c.number)` du gabarit refuserait toute valeur ⇒ il est
 *     REMPLACÉ ici par une exception explicite (number = null, assumée). Ce document sera le
 *     seul CIRCULAIRE_BRH non numéroté du corpus (0 aujourd'hui, mesuré en base). Les chemins
 *     vérifiés le tolèrent : parseCirculaireRef(null) → null, donc ignoré dans le refIndex de
 *     doc/[id]/page.tsx comme dans brh/gaps.ts ; l'en-tête est gardé par `doc.number &&`.
 *
 *  2. « 2.1.Constitution du dossier » — SANS ESPACE au fac-similé (recadrage 9×).
 *     POINT_HEAD_RE (annotated.ts) exige au moins une espace après la désignation : la forme
 *     collée ne peut recevoir AUCUNE ancre art-. Arbitrage : la fidélité prime, « 2.1 » sort
 *     de pointAnchors et la ligne est inscrite au SOMMAIRE, qui apparie par égalité de chaîne
 *     et ne dépend d'aucune regex. Effet de bord assumé : la nouvelle section décale
 *     curSection, les jurisKeys des points 2.2 à 6 passent de sec-2|art-N à sec-3|art-N.
 *     C'est pourquoi les clés de `commentaires` sont DÉRIVÉES en appelant segmentAnnotated
 *     (contrôle 10 ci-dessous), jamais écrites à la main.
 *
 *  3. LA MÊME LIGNE, au NIVEAU 2, était rendue en CAPITALES. AnnotatedText compose les
 *     en-têtes de niveaux 1, 2 et 4 avec la classe `uppercase` ; le niveau 3 est le SEUL qui
 *     conserve la casse. La leçon de l'imprimé, sauvée dans la donnée au prix d'une ancre,
 *     était détruite à l'écran — défaut invisible à tout contrôle portant sur la donnée.
 *     La ligne est donc déclarée de niveau 3.
 *
 *  4. `kind:'connexe'` N'EST JAMAIS UTILISÉ : inAnnexe (annotated.ts) est un verrou à sens
 *     unique — tout ce qui suit perdrait son ancre. Contrôlé (garde-fou 0).
 *
 *  5. seenArt : seule la PREMIÈRE occurrence d'une désignation reçoit son ancre ; les
 *     suivantes reçoivent noAnchors. Les ancres RÉELLES se comptent donc
 *     « b.anchor && !b.noAnchors », jamais « b.anchor ».
 *
 *  6. LE PLIABLE D'ANNOTATIONS S'INTITULE « JURISPRUDENCE » tant que la source n'est pas
 *     inscrite dans ANNOTATIONS_VARIANT_SOURCES (doc/[id]/page.tsx). Les deux notes de ce
 *     document sont éditoriales — dont une note de PROVENANCE — sur un texte qui n'a aucune
 *     jurisprudence. Le lot de code accompagnant ce script ajoute AVIS_LD_AGENTS_CHANGE_2020
 *     aux trois listes blanches (variante « Annotations », index inline masqué, renvois
 *     « article N » cliquables). Le garde-fou 15 REFUSE d'écrire si l'ajout manque.
 *
 *  7. Les renvois d'index vers les ANNEXES passent par `docRefs`, dont l'id ne peut être
 *     rempli qu'APRÈS création du document (il n'existe pas avant) — cf. gabarit.
 */
import { readFileSync, existsSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['BLOB_READ_WRITE_TOKEN', 'DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { uploadToBlob } from '../src/lib/storage/blob'
import { buildSearchText } from '../src/lib/search/normalize'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'
import { segmentAnnotated, type Annotations, type TocEntry, type ConnexeBlock } from '../src/lib/legislation/annotated'

const DATA = 'scripts/data/avis-ld-brh-2020/source.json'
const PAGE_TSX = 'src/app/[locale]/(app)/doc/[id]/page.tsx'
const SOURCE = 'AVIS_LD_AGENTS_CHANGE_2020'
const TYPE = 'CIRCULAIRE_BRH'
const MATIERE = 'Droit bancaire'
const C127_ID = 'cmqbnm0eb001bsmfzfiddjilj' // circulaire n° 127 — renvoi réciproque

const APPLY = process.argv.includes('--apply')
const VOIR = process.argv.find((a) => a.startsWith('--voir='))?.slice(7)
const FORCE = process.argv.includes('--force')

interface Source {
  corps: string[]
  toc: TocEntry[]
  navToc: Annotations['navToc']
  pointAnchors: string[]
  labels: Record<string, string>
  index: { subject: string; ctRefs: string[]; docRefs?: { label: string; id: string; anchor: string }[]; origine?: string }[]
  connexe: Record<string, ConnexeBlock[]>
  commentaires: Record<string, string[]>
  commentairesParAncre: Record<string, string[]>
  meta: Record<string, any>
}

function fail(msg: string): never {
  throw new Error(`${msg} — annulé`)
}

async function main() {
  const src: Source = JSON.parse(readFileSync(DATA, 'utf8'))
  const body = src.corps.join('\n')
  const m = src.meta

  // ══ Garde-fous BLOQUANTS, tous avant la moindre écriture ═══════════════════════════════
  const blocks = segmentAnnotated(body, src.toc, src.pointAnchors)
  const secs = blocks.filter((b) => b.kind === 'section').map((b) => b.anchor)
  // Ancres RÉELLES : segmentAnnotated ne retire pas l'ancre d'une répétition, il pose noAnchors.
  const arts = blocks.filter((b) => b.kind === 'body' && b.anchor && !b.noAnchors).map((b) => b.anchor as string)
  const ids = [...secs, ...arts]
  const anchorSet = new Set(ids)

  // 0 — le verrou à sens unique ne doit jamais être armé
  if (src.toc.some((t) => t.kind === 'connexe')) fail("toc : kind:'connexe' arme inAnnexe et prive d'ancre tout ce qui suit")
  // 1 — appariement sommaire ↔ corps (les libellés DOIVENT être des lignes exactes du corps)
  if (secs.length !== src.toc.length) {
    const vus = new Set(blocks.filter((b) => b.kind === 'section').map((b) => (b as any).text))
    const manquants = src.toc.filter((t) => !vus.has(t.label)).map((t) => t.label)
    fail(`sommaire ${secs.length}/${src.toc.length} apparié — introuvables au corps : ${manquants.join(' | ')}`)
  }
  // 2 — toutes les divisions déclarées portent bien leur ancre
  const wanted = src.pointAnchors.map((p) => `art-${p.replace(/\./g, '-')}`)
  const missing = wanted.filter((a) => !arts.includes(a))
  if (missing.length) fail(`divisions non ancrées : ${missing.join(', ')}`)
  // 3 — zéro identifiant HTML en double
  const dup = ids.filter((a, i) => ids.indexOf(a) !== i)
  if (dup.length) fail(`ancres dupliquées : ${[...new Set(dup)].join(', ')}`)
  // 4 — aucune ligne perdue à la segmentation (recollage identique à l'octet)
  if (blocks.map((b) => b.text).join('\n') !== body) fail('texte perdu à la segmentation')
  // 5 — pas de libellé d'article sans ancre
  const labelMiss = Object.keys(src.labels).filter((a) => !arts.includes(a))
  if (labelMiss.length) fail(`libellés sans ancre : ${labelMiss.join(', ')}`)
  // 6 — index : zéro renvoi mort. ⚠ le rendu fabrique `#art-${r}` SANS normaliser
  //     (CodeSidebar.tsx, AnnotatedText.tsx) : un ctRef « 2.1 » donnerait #art-2.1 quand
  //     l'ancre posée est art-2-1. Les ctRefs doivent donc être écrits EN TIRETS.
  const pointu = src.index.flatMap((e) => e.ctRefs).filter((r) => r.includes('.'))
  if (pointu.length) fail(`index : ctRefs en POINTS (le rendu ne normalise pas) : ${[...new Set(pointu)].join(', ')}`)
  const idxRefs = src.index.flatMap((e) => [...e.ctRefs.map((r) => `art-${r}`), ...(e.docRefs ?? []).map((d) => d.anchor)])
  const deadIdx = idxRefs.filter((a) => !anchorSet.has(a))
  if (deadIdx.length) fail(`index : renvois morts ${[...new Set(deadIdx)].join(', ')}`)
  // 7 — aucune division hors index (le lecteur doit pouvoir atteindre chaque ancre)
  const covered = new Set(idxRefs)
  const uncovered = ids.filter((a) => !covered.has(a))
  if (uncovered.length) fail(`divisions hors index : ${uncovered.join(', ')}`)
  // 8 — sommaire latéral : aucune ancre morte
  const navDead = (JSON.stringify(src.navToc).match(/"anchor":"([^"]+)"/g) ?? [])
    .map((s) => s.slice(10, -1))
    .filter((a) => !anchorSet.has(a))
  if (navDead.length) fail(`navToc : ancres mortes ${[...new Set(navDead)].join(', ')}`)
  // 9 — renvois `connexe` : clé = ANCRE (art-N), pas jurisKey
  const cxDead = Object.keys(src.connexe).filter((a) => !anchorSet.has(a))
  if (cxDead.length) fail(`connexe : clés orphelines ${cxDead.join(', ')}`)
  // 10 — commentaires : clé = jurisKey « sec-K|art-N », DÉRIVÉE du corps, jamais écrite à la
  //      main (ajouter une entrée de toc décale toutes les clés suivantes).
  const jurisFor = new Map<string, string>()
  for (const b of blocks) if (b.kind === 'body' && b.anchor && b.jurisKey) jurisFor.set(b.anchor, b.jurisKey)
  const attendu: Record<string, string[]> = {}
  for (const [anchor, txts] of Object.entries(src.commentairesParAncre)) {
    const k = jurisFor.get(anchor)
    if (!k) fail(`commentaires : l'ancre ${anchor} ne porte aucun jurisKey`)
    attendu[k] = txts
  }
  if (JSON.stringify(attendu) !== JSON.stringify(src.commentaires)) {
    fail(`commentaires : clés écrites ${Object.keys(src.commentaires).join(', ')} ≠ clés dérivées ${Object.keys(attendu).join(', ')}`)
  }
  const commDead = Object.keys(src.commentaires).filter((k) => ![...jurisFor.values()].includes(k))
  if (commDead.length) fail(`commentaires : clés orphelines ${commDead.join(', ')}`)

  // 11 — liens sortants : le document cible doit EXISTER, et un renvoi vers un texte ABROGÉ
  //      doit le dire (sinon le lecteur croit la règle applicable).
  const linked = [...new Set(Object.values(src.connexe).flat().map((b) => b.docId).filter(Boolean))] as string[]
  const cibles = await prisma.document.findMany({ where: { id: { in: linked } }, select: { id: true, titleFr: true, status: true } })
  const found = new Map(cibles.map((d) => [d.id, d]))
  const orphanLinks = linked.filter((id) => !found.has(id))
  if (orphanLinks.length) fail(`liens morts : ${orphanLinks.join(', ')}`)
  const muets = Object.values(src.connexe)
    .flat()
    .filter((b) => b.docId && found.get(b.docId)!.status === 'ABROGE' && !/abrog|remplac|antérieur/i.test(`${b.label} ${b.text}`))
    .map((b) => b.label)
  if (muets.length) fail(`renvoi vers un texte ABROGÉ sans le dire : ${muets.join(' | ')}`)
  // 12 — les ancres visées chez le voisin doivent exister chez lui
  for (const b of Object.values(src.connexe).flat()) {
    if (!b.docId || !b.anchor) continue
    const cible = await prisma.document.findUnique({ where: { id: b.docId }, select: { bodyOriginal: true, bodyClean: true, annotationsJson: true } })
    const txt = cible!.bodyClean ?? cible!.bodyOriginal
    const num = b.anchor.replace(/^art-/, '').replace(/-/g, '.')
    const vivant =
      new RegExp(`^\\s*Article\\s+${num.replace('.', '\\.')}\\b`, 'im').test(txt) ||
      (cible!.annotationsJson ?? '').includes(`"${b.anchor}"`)
    if (!vivant) fail(`renvoi ${b.label} : l'ancre #${b.anchor} n'existe pas dans le document cible ${b.docId}`)
  }
  // 13 — idempotence : jamais de doublon
  const existing = await prisma.document.findFirst({ where: { source: SOURCE }, select: { id: true, titleFr: true } })
  if (existing && !FORCE) fail(`un document porte déjà source=${SOURCE} (${existing.id}) — relancer avec --force pour le METTRE À JOUR`)
  // 14 — thèmes : les identifiants proposés doivent exister
  const themeIds: string[] = (m.thèmesProposés ?? []).map((t: any) => t.id)
  const themes = await prisma.theme.findMany({ where: { id: { in: themeIds } }, select: { id: true, labelFr: true } })
  const themeMiss = themeIds.filter((id) => !themes.some((t) => t.id === id))
  if (themeMiss.length) fail(`thèmes introuvables : ${themeMiss.join(', ')}`)
  if ((m.thèmesProposés ?? []).filter((t: any) => t.primaire).length > 1) fail('plus d’un thème primaire (contrainte DocumentTheme_one_primary)')
  // 15 — le lot de code doit accompagner la donnée, sinon les deux notes éditoriales
  //      seraient publiées sous le titre « Jurisprudence » et l'index s'afficherait deux fois.
  const page = existsSync(PAGE_TSX) ? readFileSync(PAGE_TSX, 'utf8') : ''
  const blocsCode = ['HIDE_INLINE_INDEX_SOURCES', 'ART_REFS_SOURCES', 'ANNOTATIONS_VARIANT_SOURCES'].filter((set) => {
    const i = page.indexOf(`const ${set} = new Set([`)
    return i < 0 || !page.slice(i, page.indexOf('])', i)).includes(`'${SOURCE}'`)
  })
  if (blocsCode.length) fail(`${PAGE_TSX} : ${SOURCE} absent de ${blocsCode.join(', ')} (sans ANNOTATIONS_VARIANT_SOURCES, les notes éditoriales s'affichent sous le titre « Jurisprudence »)`)

  // ══ Rapport ════════════════════════════════════════════════════════════════════════════
  console.log('AVIS + LIGNES DIRECTRICES du 14 décembre 2020 — Banque de la République d’Haïti')
  console.log(`   titre       ${m.titreFrProposé}`)
  console.log(`   source      ${SOURCE} · type ${TYPE} · matière ${MATIERE} · statut ${m.statutProposé}`)
  console.log(`   numéro      ${m.numero ?? 'AUCUN (le texte n’est pas une circulaire — exception assumée)'}`)
  console.log(`   corps       ${src.corps.length} lignes · ${body.length} caractères · ${(m.sic ?? []).length} marques [sic]`)
  console.log(`   sommaire    ${secs.length}/${src.toc.length} appariés · divisions ancrées ${arts.length} (${arts.join(', ')})`)
  console.log(`   index       ${src.index.length} entrées · ${idxRefs.length} renvois, 0 mort · 0 division hors index`)
  console.log(`   navToc      ${(JSON.stringify(src.navToc).match(/"anchor"/g) ?? []).length} ancres, 0 morte`)
  console.log(`   renvois     ${Object.keys(src.connexe).length} ancres porteuses · ${linked.length} documents liés, tous vivants`)
  for (const b of Object.values(src.connexe).flat()) {
    if (b.docId) console.log(`               → ${found.get(b.docId)!.titleFr.slice(0, 52)} [${found.get(b.docId)!.status}]${b.anchor ? ` #${b.anchor}` : ''}`)
  }
  console.log(`   annotations ${Object.keys(src.commentaires).length} commentaires, clés DÉRIVÉES : ${Object.keys(src.commentaires).join(' · ')}`)
  console.log(`   thèmes      ${themes.map((t) => t.labelFr).join(' · ')}`)
  console.log(`   fac-similé  ${m.facSimilé} (${m.facSimiléPages} p.) — ${existsSync(m.facSimilé) ? 'présent' : 'ABSENT du disque'}`)

  if (VOIR) {
    const i = blocks.findIndex((b) => b.anchor === VOIR)
    if (i < 0) fail(`--voir : ancre ${VOIR} inconnue (${[...anchorSet].join(', ')})`)
    console.log(`\n── aperçu ${VOIR} ─────────────────────────────────────────────────────────`)
    console.log(blocks[i].text)
    for (const b of src.connexe[VOIR] ?? []) console.log(`\n  ↪ ${b.label}\n    ${b.text}`)
    const k = (blocks[i] as any).jurisKey
    for (const t of (k && src.commentaires[k]) || []) console.log(`\n  ✎ [${k}] ${t}`)
  }

  if (!APPLY) {
    console.log('\n✓ 15/15 contrôles verts. SIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }

  // ══ Écriture ═══════════════════════════════════════════════════════════════════════════
  const indexEntries = src.index.map((e) => ({
    subject: e.subject,
    ctRefs: e.ctRefs,
    ...(e.docRefs ? { docRefs: e.docRefs.map((d) => ({ label: d.label, id: '', anchor: d.anchor })) } : {}),
  }))
  const annotations: Annotations = {
    title: m.titreFrProposé,
    annotationAuthor: 'Lam Veritab',
    navToc: src.navToc,
    toc: src.toc,
    connexes: [],
    jurisprudence: {},
    indexEntries,
    labels: src.labels,
    pointAnchors: src.pointAnchors,
    connexe: src.connexe,
    commentaires: src.commentaires,
  }
  const base = {
    type: TYPE,
    status: m.statutProposé,
    titleFr: m.titreFrProposé,
    bodyOriginal: body,
    bodyClean: null,
    richBlocksJson: null,
    number: null, // exception assumée : le texte n'est pas numéroté (piège 1)
    publicationDate: new Date(`${m.date}T00:00:00Z`),
    matiere: MATIERE,
    source: SOURCE,
    sealed: true,
    abrogatedByNumber: null,
  }

  const docId = await prisma.$transaction(async (tx) => {
    const doc = existing
      ? await tx.document.update({ where: { id: existing.id }, data: base })
      : await tx.document.create({ data: base })
    // L'id n'existe qu'après création : les renvois d'index vers les annexes le portent.
    for (const e of indexEntries) for (const d of (e as any).docRefs ?? []) d.id = doc.id
    annotations.indexEntries = indexEntries
    const annotationsJson = JSON.stringify(annotations)
    await tx.document.update({
      where: { id: doc.id },
      data: {
        annotationsJson,
        searchText: buildSearchText({ titleFr: base.titleFr, bodyOriginal: body, matiere: MATIERE, annotationsJson } as any),
      },
    })
    for (const t of m.thèmesProposés ?? []) {
      await tx.documentTheme.upsert({
        where: { documentId_themeId: { documentId: doc.id, themeId: t.id } },
        create: { documentId: doc.id, themeId: t.id, isPrimary: !!t.primaire, assignedBy: 'ADMIN' },
        update: { isPrimary: !!t.primaire },
      })
    }
    await audit(
      {
        action: 'DOC_PUBLISHED',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        meta: {
          actor: 'script:import-avis-lignes-directrices-brh',
          source: SOURCE,
          provenance: m.provenance,
          statutMotif: m.statutMotif,
          lignes: src.corps.length,
          divisions: arts,
          sic: (m.sic ?? []).length,
          miseAJour: !!existing,
        },
      },
      tx as any,
    )
    return doc.id
  })

  // Fac-similé (hors transaction : dépôt réseau).
  if (existsSync(m.facSimilé) && process.env.BLOB_READ_WRITE_TOKEN) {
    const buf = readFileSync(m.facSimilé)
    const url = await uploadToBlob('source-pdf/brh/Avis-lignes-directrices-agents-de-change-14-12-2020.pdf', buf, 'application/pdf', { multipart: true })
    await prisma.document.update({ where: { id: docId }, data: { sourcePdfUrl: url } })
    console.log(`   fac-similé déposé (${(buf.length / 1024 / 1024).toFixed(1)} Mo)`)
  } else {
    console.log('   ⚠ fac-similé NON déposé (fichier absent ou BLOB_READ_WRITE_TOKEN manquant)')
  }
  await reindexDocument(docId)

  console.log(`\n✓ écrit : ${docId}`)
  console.log(`   RESTE À FAIRE — renvoi RÉCIPROQUE sur la circulaire n° 127 (${C127_ID}) : le jeton`)
  console.log(`   __AVIS_LIGNES_DIRECTRICES_ID__ de scripts/data/circ-brh-127/reparation.json se`)
  console.log(`   résout désormais tout seul par source=${SOURCE}. Lancer :`)
  console.log('       npx tsx scripts/reparer-circulaire-127.ts --apply')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(String(e instanceof Error ? e.message : e))
  await prisma.$disconnect()
  process.exit(1)
})
