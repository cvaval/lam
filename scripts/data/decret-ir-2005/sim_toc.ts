/**
 * TÂCHE 2 — simulation du sommaire cible, des ancres et de la re-clé des annotations.
 * Script JETABLE (hors dépôt). Lecture seule : n'ouvre aucune connexion Prisma.
 * Il importe la VRAIE segmentAnnotated du dépôt — aucune réimplémentation.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { segmentAnnotated, type TocEntry, type AnnBlock } from '../../../src/lib/legislation/annotated'
import { articleAnchorFromHeading } from '../../../src/lib/doc/anchors'

const DIR = path.join(process.cwd(), 'scripts/data/decret-ir-2005')
const OUT = path.join(DIR, 'toc-cible.json')

const MD5_CORPS_DEPART = '78be764c29e46db69e7b93379502d2c1'
const rawBody = fs.readFileSync(path.join(DIR, 'etat-2026-08-25-corps.txt'), 'utf8')
const corpsActuel = rawBody.endsWith('\n') ? rawBody.slice(0, -1) : rawBody
const md5 = (s: string) => createHash('md5').update(s, 'utf8').digest('hex')
// § D9 — sans empreinte, « 749 lignes commençant par TITRE I » se satisfait de n'importe quel
// corps. On la vérifie AVANT de mesurer quoi que ce soit.
if (md5(corpsActuel) !== MD5_CORPS_DEPART)
  throw new Error(`corps de départ : md5 ${md5(corpsActuel)} — attendu ${MD5_CORPS_DEPART}`)
const ann = JSON.parse(fs.readFileSync(path.join(DIR, 'etat-2026-08-25-annotations.json'), 'utf8'))
const tocActuel: TocEntry[] = ann.toc

const CLES_COMMENTAIRES: string[] = Object.keys(ann.commentaires)

// ── outils de mesure ───────────────────────────────────────────────────────────
function mesures(body: string, toc: TocEntry[], cles: string[]) {
  const blocks: AnnBlock[] = segmentAnnotated(body, toc)
  const secs = blocks.filter((b) => b.kind === 'section').length
  const join = blocks.map((b) => b.text).join('\n')
  const arts = blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => (b as any).anchor as string)
  const jurisKeys = new Set(
    blocks.filter((b) => b.kind === 'body' && (b as any).jurisKey).map((b) => (b as any).jurisKey as string),
  )
  const secAnchors = new Set(blocks.filter((b) => b.kind === 'section').map((b) => (b as any).anchor as string))
  const artAnchors = new Set(arts)
  const collision = [...secAnchors].filter((a) => artAnchors.has(a))
  return {
    blocks,
    secs,
    tocLen: toc.length,
    joinEgal: join === body,
    joinDelta: join.length - body.length,
    ancresArt: arts.length,
    ancresArtDistinctes: artAnchors.size,
    jurisKeys,
    clesAtteintes: cles.filter((k) => jurisKeys.has(k)),
    clesOrphelines: cles.filter((k) => !jurisKeys.has(k)),
    collisionSecArt: collision,
  }
}
function trace(titre: string, m: ReturnType<typeof mesures>, cles: string[]) {
  console.log(`\n=== ${titre} ===`)
  console.log(`secs=${m.secs}  toc.length=${m.tocLen}  → ${m.secs === m.tocLen ? 'OK' : '*** ÉCHEC ***'}`)
  console.log(`join === corps : ${m.joinEgal ? 'OK' : `*** ÉCHEC *** (delta ${m.joinDelta} car.)`}`)
  console.log(`ancres d'article : ${m.ancresArt} (distinctes ${m.ancresArtDistinctes})`)
  console.log(`clés de commentaires atteintes : ${m.clesAtteintes.length}/${cles.length}`)
  if (m.clesOrphelines.length) console.log(`  orphelines : ${m.clesOrphelines.join(', ')}`)
  console.log(`collision d'ancre sec-*/art-* : ${m.collisionSecArt.length}`)
}

// ── 1. BASELINE ────────────────────────────────────────────────────────────────
const base = mesures(corpsActuel, tocActuel, CLES_COMMENTAIRES)
trace('BASELINE — corps et appareil actuels', base, CLES_COMMENTAIRES)
const lignesActuelles = corpsActuel.split('\n')
console.log(`corps : ${corpsActuel.length} caractères, ${lignesActuelles.length} lignes`)
console.log(`têtes d'article (articleAnchorFromHeading) : ${lignesActuelles.filter((l) => articleAnchorFromHeading(l.trim())).length}`)
if (!(base.secs === 32 && base.tocLen === 32 && base.joinEgal && base.ancresArt === 191 && base.clesOrphelines.length === 0)) {
  console.error('\n*** LA BASELINE NE TIENT PAS — on s’arrête. ***')
  process.exit(1)
}

// ── 2. CORPS CIBLE (état attendu APRÈS § 7.1 préambule + § 7.3 ligne 185) ──────
// Préambule : J.O. de la cliente ¶13→¶40 (blanche ¶16 retirée), apostrophes repliées
// en COURBES pour rester dans la convention du corps en base (1 550 courbes / 0 droite).
const jo = fs.readFileSync(path.join(DIR, 'piece-jo-2005-moniteur-sp10.txt'), 'utf8').split('\n')
const preambule = jo
  .slice(12, 40) // ¶13 « DÉCRET » → ¶40 « DÉCRÈTE »
  .map((l) => l.replace(/'/g, '’').trim())
  .filter((l) => l.length > 0)

const L = [...lignesActuelles]
// § 7.3 : la ligne 185 est coupée en deux dans le corps (185 + 186). On les fond, et on
// retire le point final que le J.O. ne porte pas (ligne de division, pas du dispositif).
const LIGNE_TRONQUEE = 185 // 1-indexé
const fusion = `${L[LIGNE_TRONQUEE - 1]} ${L[LIGNE_TRONQUEE].replace(/\.$/, '')}`
L.splice(LIGNE_TRONQUEE - 1, 2, fusion)
const corpsCible = [...preambule, ...L].join('\n')
const OFFSET = preambule.length - 1 // décalage des lignes ≥ 187 (préambule ajouté, 2 lignes fondues en 1)

// ── 3. TOC CIBLE ───────────────────────────────────────────────────────────────
// Les libellés NEUFS sont LUS du corps cible (jamais retapés) : apostrophes courbes garanties.
const lignesCible = corpsCible.split('\n')
const idx = (s: string) => {
  const n = lignesCible.indexOf(s)
  if (n < 0) throw new Error(`libellé introuvable dans le corps cible : ${JSON.stringify(s)}`)
  return n
}
// Repérage par NUMÉRO DE LIGNE (les libellés se répètent : « Sous Section I : Définition » ×5).
const lignesSousSection: number[] = []
lignesCible.forEach((l, i) => {
  if (/^Sous Section /.test(l)) lignesSousSection.push(i)
})
const LETTRES_ATTENDUES = [
  'a) Régime Simplifié pour Certaines Activités professionnelles',
  'b) Régime du Bénéfice Réel',
  'c) Acompte Provisionnel',
]
const lignesLettres = LETTRES_ATTENDUES.map((s) => idx(s))
const lignePreambule = 0 // « DÉCRET »

console.log(`\nsous-sections repérées dans le corps cible : ${lignesSousSection.length}`)
console.log(`lettres A)/B)/C) repérées : ${lignesLettres.length} → lignes ${lignesLettres.map((n) => n + 1).join(', ')}`)

// Position de chacune des 32 entrées existantes, par appariement SÉQUENTIEL (comme la fonction).
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
const posExistantes: number[] = []
{
  let p = 0
  lignesCible.forEach((l, i) => {
    if (p < tocActuel.length && norm(l.trim()) === norm(tocActuel[p].label)) {
      posExistantes.push(i)
      p++
    }
  })
  if (posExistantes.length !== 32) throw new Error(`appariement des 32 entrées existantes : ${posExistantes.length}`)
}

// Ancres neuves : les 20 sous-sections sec-33…sec-52 (ordre du corps), les 3 lettres
// sec-53…sec-55, le préambule sec-56. Aucune ancre existante n'est renumérotée.
type Neuve = { ligne: number; level: number; anchor: string; label: string; role: string }
const neuves: Neuve[] = []
lignesSousSection.forEach((n, k) => {
  neuves.push({ ligne: n, level: 4, anchor: `sec-${33 + k}`, label: lignesCible[n], role: 'sous-section' })
})
lignesLettres.forEach((n, k) => {
  neuves.push({ ligne: n, level: 4, anchor: `sec-${53 + k}`, label: lignesCible[n], role: 'lettre' })
})
neuves.push({ ligne: lignePreambule, level: 1, anchor: 'sec-56', label: lignesCible[0], role: 'préambule' })

// Fusion INTERCALÉE : tri par numéro de ligne dans le corps.
type Rang = { ligne: number; entry: TocEntry; role: string }
const rangs: Rang[] = [
  ...posExistantes.map((n, k) => ({ ligne: n, entry: tocActuel[k], role: 'existante' })),
  ...neuves.map((x) => ({
    ligne: x.ligne,
    entry: { level: x.level, label: x.label, anchor: x.anchor, kind: 'code' } as TocEntry,
    role: x.role,
  })),
].sort((a, b) => a.ligne - b.ligne)
const tocCible: TocEntry[] = rangs.map((r) => r.entry)

// ── 4. SIMULATION ──────────────────────────────────────────────────────────────
const cible = mesures(corpsCible, tocCible, CLES_COMMENTAIRES)
trace('CIBLE — entrées INTERCALÉES dans l’ordre du corps', cible, CLES_COMMENTAIRES)
console.log(`corps cible : ${corpsCible.length} caractères, ${lignesCible.length} lignes`)
console.log(
  `têtes d'article : ${lignesCible.filter((l) => articleAnchorFromHeading(l.trim())).length}`,
)

// ── 5. RE-CLÉ DES 6 COMMENTAIRES — clés LUES du résultat de segmentAnnotated ────
const artDesCles = CLES_COMMENTAIRES.map((k) => k.split('|')[1])
const cleParArticle = new Map<string, string>()
for (const b of cible.blocks) {
  if (b.kind === 'body' && (b as any).anchor && (b as any).jurisKey) {
    const a = (b as any).anchor as string
    if (artDesCles.includes(a) && !cleParArticle.has(a)) cleParArticle.set(a, (b as any).jurisKey as string)
  }
}
const recle = CLES_COMMENTAIRES.map((avant) => {
  const art = avant.split('|')[1]
  const apres = cleParArticle.get(art)
  if (!apres) throw new Error(`aucun bloc ancré ${art} dans le corps cible`)
  return { avant, apres, change: avant !== apres, nbEntrees: ann.commentaires[avant].length }
})
console.log('\n=== RE-CLÉ DES COMMENTAIRES (lue du résultat de segmentAnnotated) ===')
for (const r of recle) console.log(`${r.avant.padEnd(16)} → ${r.apres.padEnd(16)} ${r.change ? 'CHANGE' : '(inchangée)'}  [${r.nbEntrees} entrée(s)]`)
const clesApres = recle.map((r) => r.apres)
console.log(`clés cibles atteintes : ${clesApres.filter((k) => cible.jurisKeys.has(k)).length}/${clesApres.length}`)
console.log(`clés cibles distinctes : ${new Set(clesApres).size}/${clesApres.length}`)

// ── 5 bis. TABLE DES jurisKey — lue du résultat, jamais recopiée (§ 12.7, défaut D2) ──
// Le fichier appareil-et-notes.json consomme cette table : les deux fichiers ne peuvent plus
// se contredire, puisqu'un seul les produit.
const ARTICLES_SUIVIS = [
  'art-8','art-15','art-17','art-19','art-20','art-21','art-24','art-29','art-33','art-35',
  'art-42','art-43','art-45','art-49','art-54','art-57','art-76','art-81','art-86','art-92',
  'art-95','art-96','art-99','art-104','art-109','art-113','art-116','art-118','art-123',
  'art-126','art-128','art-149',
]
const cleAvant = new Map<string, string>()
for (const b of base.blocks) {
  if (b.kind === 'body' && b.anchor && b.jurisKey && !cleAvant.has(b.anchor)) cleAvant.set(b.anchor, b.jurisKey)
}
const cleApres = new Map<string, string>()
for (const b of cible.blocks) {
  if (b.kind === 'body' && b.anchor && b.jurisKey && !cleApres.has(b.anchor)) cleApres.set(b.anchor, b.jurisKey)
}
const jurisKeysArticles: Record<string, { actuelle: string; apres: string; change: boolean }> = {}
for (const a of ARTICLES_SUIVIS) {
  const av = cleAvant.get(a)
  const ap = cleApres.get(a)
  if (!av || !ap) throw new Error(`article suivi sans bloc ancré : ${a}`)
  jurisKeysArticles[a] = { actuelle: av, apres: ap, change: av !== ap }
}
// Ancres neuves, avec leur ligne dans le corps CIBLE et leur libellé LU du corps cible.
const ancresNeuves: Record<string, { role: string; ligneCorpsCible: number; libelle: string }> = {}
for (const r of rangs) {
  if (r.role === 'existante') continue
  ancresNeuves[r.entry.anchor] = { role: r.role, ligneCorpsCible: r.ligne + 1, libelle: r.entry.label }
}

// ── 6. CONTRE-ÉPREUVE : entrées ajoutées à la FIN du tableau ────────────────────
const tocFin: TocEntry[] = [...tocActuel, ...neuves.map((x) => ({ level: x.level, label: x.label, anchor: x.anchor, kind: 'code' } as TocEntry))]
const contre = mesures(corpsCible, tocFin, CLES_COMMENTAIRES)
trace('CONTRE-ÉPREUVE — les mêmes entrées AJOUTÉES À LA FIN', contre, CLES_COMMENTAIRES)

// ── 7. contrôles complémentaires ───────────────────────────────────────────────
const ancres = tocCible.map((t) => t.anchor)
console.log(`\nancres du toc cible : ${ancres.length}, distinctes ${new Set(ancres).size}`)
console.log(`sec-1 toujours présent (crossRefs) : ${ancres.includes('sec-1')}`)
console.log(`ancres 1..32 inchangées et à leur libellé : ${tocActuel.every((t, i) => tocCible.some((c) => c.anchor === t.anchor && c.label === t.label && c.level === t.level))}`)
const niveaux: Record<number, number> = {}
for (const t of tocCible) niveaux[t.level] = (niveaux[t.level] ?? 0) + 1
console.log('répartition des niveaux du toc cible :', JSON.stringify(niveaux))

// ── 8. navToc ──────────────────────────────────────────────────────────────────
// Parent réel de chaque nouvel en-tête = dernière entrée de NIVEAU ≤ 3 qui la précède.
type NavItem = { label: string; anchor: string; children?: NavItem[] }
const parentDe = new Map<string, string>()
{
  let dernierNiv3: string | null = null
  let derniereSousSection: string | null = null
  for (const r of rangs) {
    if (r.entry.level <= 3) {
      dernierNiv3 = r.entry.anchor
      derniereSousSection = null
    } else if (r.role === 'sous-section') {
      parentDe.set(r.entry.anchor, dernierNiv3!)
      derniereSousSection = r.entry.anchor
    } else if (r.role === 'lettre') {
      parentDe.set(r.entry.anchor, derniereSousSection ?? dernierNiv3!)
    }
  }
}
// Libellés du navToc = la « lecture rectifiée » du sommaire de la cliente (§ 7.4).
const LECTURE: Record<string, string> = JSON.parse(fs.readFileSync(path.join(DIR, 'navtoc-lecture.json'), 'utf8'))
const navToc = JSON.parse(JSON.stringify(ann.navToc)) as NavItem[]
function trouve(items: NavItem[], anchor: string): NavItem | null {
  for (const it of items) {
    if (it.anchor === anchor) return it
    const k = it.children ? trouve(it.children, anchor) : null
    if (k) return k
  }
  return null
}
for (const r of rangs) {
  if (r.role !== 'sous-section' && r.role !== 'lettre') continue
  const p = parentDe.get(r.entry.anchor)!
  const noeud = trouve(navToc, p)
  if (!noeud) throw new Error(`parent ${p} absent du navToc pour ${r.entry.anchor}`)
  const label = LECTURE[r.entry.anchor]
  if (!label) throw new Error(`pas de lecture rectifiée pour ${r.entry.anchor}`)
  ;(noeud.children ??= []).push({ label, anchor: r.entry.anchor })
}
// Le préambule : nouveau groupe de tête du navToc.
navToc.unshift({ label: 'Préambule', anchor: 'sec-56', children: [] } as any)
const ancresNav: string[] = []
;(function collecte(items: NavItem[]) {
  for (const it of items) {
    ancresNav.push(it.anchor)
    if (it.children) collecte(it.children)
  }
})(navToc)
console.log(`\nnavToc : ${navToc.length} groupes, ${ancresNav.length} ancres`)
console.log(`ancres du navToc toutes présentes dans le toc cible : ${ancresNav.every((a) => ancres.includes(a))}`)

// ── 8 bis. labels (§ 11.3) ─────────────────────────────────────────────────────
const ancresBlocs = new Set(
  cible.blocks.filter((b) => b.kind === 'body' && (b as any).anchor).map((b) => (b as any).anchor as string),
)
const labelsSansBloc = Object.keys(ann.labels).filter((k) => !ancresBlocs.has(k))
const blocsSansLabel = [...ancresBlocs].filter((a) => !(a in ann.labels))
console.log(`\nlabels : ${Object.keys(ann.labels).length} · sans bloc ancré ${labelsSansBloc.length} · blocs ancrés sans label ${blocsSansLabel.length}`)

// ── 8 ter. 2ᵉ oracle du § 8 : plages d'articles du sommaire de la cliente ───────
const plagesReelles = new Map<string, { premier: string; dernier: string }>()
{
  const ouverts: { anchor: string; level: number }[] = []
  for (const b of cible.blocks) {
    if (b.kind === 'section') {
      while (ouverts.length && ouverts[ouverts.length - 1].level >= b.level) ouverts.pop()
      ouverts.push({ anchor: b.anchor, level: b.level })
    } else if ((b as any).anchor) {
      const n = ((b as any).anchor as string).replace(/^art-/, '')
      for (const o of ouverts) {
        const e = plagesReelles.get(o.anchor)
        if (!e) plagesReelles.set(o.anchor, { premier: n, dernier: n })
        else e.dernier = n
      }
    }
  }
}
const som = fs.readFileSync(path.join(DIR, 'piece-sommaire-cliente.txt'), 'utf8').split('\n')
const MAP_PLAGES: [string, number][] = [
  ['sec-2', 5], ['sec-5', 8], ['sec-6', 9], ['sec-8', 11],
  ['sec-33', 12], ['sec-34', 13], ['sec-35', 14],
  ['sec-9', 15], ['sec-36', 16], ['sec-37', 17], ['sec-38', 18], ['sec-39', 19], ['sec-40', 20], ['sec-41', 21],
  ['sec-10', 22], ['sec-42', 23], ['sec-43', 24], ['sec-44', 25], ['sec-53', 26], ['sec-54', 27], ['sec-55', 28],
  ['sec-11', 30], ['sec-45', 31], ['sec-46', 32],
  ['sec-12', 34], ['sec-13', 35], ['sec-47', 36], ['sec-48', 37], ['sec-49', 38],
  ['sec-14', 39], ['sec-50', 40], ['sec-51', 41], ['sec-52', 42],
]
const ecartsPlages: { anchor: string; sommaire: string; corps: string; label: string }[] = []
let plagesOk = 0
for (const [anchor, para] of MAP_PLAGES) {
  const m = /\(articles?\s+(\d+)(?:\s*(?:à|et)\s*(\d+))?/.exec(som[para - 1])
  const att = { premier: m![1], dernier: m![2] ?? m![1] }
  const r = plagesReelles.get(anchor)!
  if (r.premier === att.premier && r.dernier === att.dernier) plagesOk++
  else
    ecartsPlages.push({
      anchor,
      sommaire: `${att.premier}–${att.dernier}`,
      corps: `${r.premier}–${r.dernier}`,
      label: tocCible.find((t) => t.anchor === anchor)!.label,
    })
}
console.log(`\n2ᵉ oracle (§ 8) — plages du sommaire cliente : ${plagesOk}/${MAP_PLAGES.length} concordantes`)
for (const e of ecartsPlages) console.log(`  · ${e.anchor} : sommaire ${e.sommaire} · corps ${e.corps}   « ${e.label} »`)

// ── 9. sortie ──────────────────────────────────────────────────────────────────
const sortie = {
  _lisezMoi:
    'TÂCHE 2 — sommaire cible, ancres neuves et re-clé des annotations du décret IR 2005 ' +
    '(document cms43ptub00008lo8tv3y25kk). Produit par simulation contre la VRAIE segmentAnnotated ' +
    '(src/lib/legislation/annotated.ts). AUCUNE écriture en base. Le toc suppose le corps CIBLE décrit ' +
    'par corpsAttendu ci-dessous (préambule § 7.1 en tête + ligne 185 fondue, § 7.3).',
  corpsAttendu: {
    premiereLigne: lignesCible[0],
    preambuleNbLignes: preambule.length,
    ligneTronqueeAvant: [lignesActuelles[184], lignesActuelles[185]],
    ligneTronqueeApres: fusion,
    lignesAvant: lignesActuelles.length,
    lignesApres: lignesCible.length,
    caracteresAvant: corpsActuel.length,
    caracteresApres: corpsCible.length,
    md5Depart: md5(corpsActuel),
    md5: md5(corpsCible),
    _md5: 'md5Depart = empreinte du corps EN BASE au 25 août 2026 (première assertion du script ' +
      'd’import) ; md5 = empreinte du corps APRÈS les seules étapes § 7.1 (préambule) et § 7.3 ' +
      '(ligne 185 fondue) — c’est l’état, et le seul, sous lequel le tableau « toc » ci-dessous ' +
      's’apparie. Les étapes suivantes (§ 7.8 appareil, § 7.5 débris, § 7.9 tableau) modifient le ' +
      'corps SANS toucher aucune ligne d’en-tête : le toc reste valable, mais l’empreinte change.',
    decalage: {
      'lignes_1_a_184': '+27',
      'lignes_185_et_186': 'fondues en une seule, qui devient la 212',
      'lignes_187_et_au-dela': '+26',
      _pourquoi:
        'DEUX décalages, pas un. Avant la ligne 185, seules les 27 lignes du préambule sont ' +
        'insérées : +27. La fusion 185+186 retire ensuite une ligne, d’où +26 à partir de la 187. ' +
        'Un offset unique décalerait d’une ligne les neuf blocs d’appareil situés avant la 185 ' +
        '(l. 51, 52, 68-73, 78, 92-100, 128, 154).',
    },
  },
  jurisKeysArticles,
  ancresNeuvesParAncre: ancresNeuves,
  toc: tocCible,
  navToc,
  recle,
  mesures: {
    baseline: {
      secs: base.secs,
      tocLength: base.tocLen,
      joinEgalCorps: base.joinEgal,
      ancresArticle: base.ancresArt,
      clesCommentairesAtteintes: `${base.clesAtteintes.length}/${CLES_COMMENTAIRES.length}`,
      collisionSecArt: base.collisionSecArt.length,
    },
    cible: {
      secs: cible.secs,
      tocLength: cible.tocLen,
      joinEgalCorps: cible.joinEgal,
      ancresArticle: cible.ancresArt,
      ancresArticleDistinctes: cible.ancresArtDistinctes,
      clesCommentairesAtteintes: `${clesApres.filter((k) => cible.jurisKeys.has(k)).length}/${clesApres.length}`,
      collisionSecArt: cible.collisionSecArt.length,
      ancresTocDistinctes: `${new Set(ancres).size}/${ancres.length}`,
      crossRefsSec1DansToc: ancres.includes('sec-1'),
      niveaux,
      ancresNavTocToutesDansToc: ancresNav.every((a) => ancres.includes(a)),
      labelsSansBlocAncre: labelsSansBloc.length,
      blocsAncresSansLabel: blocsSansLabel.length,
    },
    oraclePlagesSommaireCliente: {
      controlees: MAP_PLAGES.length,
      concordantes: plagesOk,
      ecarts: ecartsPlages,
      _note:
        'Plage = SOUS-ARBRE de l’en-tête (du 1er article qui le suit au dernier avant le prochain ' +
        'en-tête de niveau ≤ au sien), sémantique du sommaire de la cliente. Les 3 écarts sont ' +
        'structurels et attendus, pas des défauts : sec-44 et sec-55 parce que la rubrique « Obligations ' +
        'déclaratives, Livre-Journal et sanctions (77 à 87) » du sommaire cliente n’a AUCUN en-tête dans ' +
        'le corps et n’est donc pas inscrite (§ 4.1, interdit n° 4) — les articles 77 à 87 tombent sous ' +
        'la lettre C) ; sec-46 parce que la « Sous Section III — Modalités d’imposition » (92-96) n’est ' +
        'PAS rétablie (décision de Me Vaval du 25 août) — les articles 92 à 96 restent sous la ' +
        'sous-section II. C’est précisément ce que la note à porter sous l’article 92 (§ 7.3) explique ' +
        'au lecteur.',
    },
    contreEpreuveEntreesEnFinDeTableau: {
      secs: contre.secs,
      tocLength: contre.tocLen,
      joinEgalCorps: contre.joinEgal,
      clesCommentairesAtteintes: `${contre.clesAtteintes.length}/${CLES_COMMENTAIRES.length}`,
      verdict:
        contre.secs === contre.tocLen
          ? 'AUCUN EFFET — la simulation ne mord pas'
          : `secs s’effondre à ${contre.secs} pour ${contre.tocLen} entrées déclarées : l’assertion § 11.1 part`,
    },
  },
  avertissements: [
    'ANCRES — les 20 sous-sections prennent sec-33…sec-52 dans l’ordre du corps, les 3 lettres ' +
      'A)/B)/C) sec-53…sec-55, le préambule sec-56. Aucune des ancres sec-1…sec-32 n’est renumérotée ' +
      '(crossRefs.anchor = « sec-1 » préservé).',
    'DIVERGENCE MESURÉE avec la table du § 6 du prompt : elle prédit sec-9|art-81 → sec-44|art-81 ; ' +
      'la simulation donne sec-55|art-81. La table du § 6 n’avait inséré QUE les 20 sous-sections ; ' +
      'avec les 3 lettres, l’en-tête le plus proche au-dessus de l’article 81 est « c) Acompte ' +
      'Provisionnel » (sec-55) et non la sous-section III (sec-44). Les 5 autres lignes concordent. ' +
      'C’est l’illustration exacte de l’interdit n° 7 : la clé se LIT du résultat, elle ne se recopie pas.',
    'CONTRAT DE CORPS — ce toc n’est valable que sur le corps décrit par « corpsAttendu » : première ' +
      'ligne « DÉCRET » (¶13 du J.O.), et lignes 185+186 fondues en une seule sans le point final que ' +
      'le J.O. ne porte pas. Si l’étape § 7.1 verse un préambule dont la 1ʳᵉ ligne diffère, ou si la ' +
      'ligne 185 est écrite autrement, l’entrée correspondante ne s’apparie plus et secs tombe.',
    'PRÉAMBULE — le libellé du toc est « DÉCRET », la ligne que le J.O. porte réellement ; on ne ' +
      'fabrique pas une ligne « PRÉAMBULE » dans le corps (§ 7.1). Conséquence connue : ' +
      'AnnotatedText.tsx l. 141 ne cherche un « preambleAnchor » que sur un libellé /^pr[ée]ambule$/i ' +
      '— il ne sera donc pas trouvé. Sans effet ici : ce mécanisme ne sert qu’à afficher ' +
      'oldVersions["preambule"], et ce document n’a pas d’oldVersions. Le navToc, lui, lit « Préambule ».',
    'INDEX — sec-56 est l’ancre à donner aux 4 entrées « Préambule » du sommaire cliente (§ 4.2/§ 7.1). ' +
      'Elles ne doivent PAS passer par ctRefs (#art-Préambule est un lien mort).',
    'LETTRES A)/B)/C) — vérifiées présentes dans le corps aux lignes 322, 326 et 328 (numérotation ' +
      'actuelle), en bas de casse et casse de titre (« a) Régime Simplifié pour Certaines Activités ' +
      'professionnelles »), et non en capitales comme au J.O. Le toc les porte au niveau 4 comme les ' +
      'sous-sections (§ 7.4) — le niveau 5 n’existe pas dans AnnotatedText et retomberait sur le rendu ' +
      'du niveau 2, plus voyant. Le navToc, lui, les niche SOUS la sous-section III, comme le sommaire ' +
      'de la cliente (ilvl 2 sous ilvl 1).',
    'AFFICHAGE — AnnotatedText rend le niveau 4 en CAPITALES (« SOUS SECTION I : DÉFINITION ») et ' +
      'TreeNode n’ouvre par défaut que la profondeur 0 : les 23 entrées de NIVEAU 4 (20 sous-sections ' +
      '+ 3 lettres) arriveront repliées dans la barre latérale ; la 24ᵉ entrée neuve, le préambule, ' +
      'est de niveau 1 et reste visible. Ni faux ni bloquant (§ 7.4).',
    'NON FAIT ICI, et volontairement : la sous-section III « Modalités d’imposition » (92-96) n’est ' +
      'pas rétablie (décision de Me Vaval du 25 août) ; la rubrique « Obligations déclaratives, ' +
      'Livre-Journal et sanctions » du sommaire cliente n’est pas inscrite (aucun en-tête dans le corps).',
  ],
  entreesNeuves: rangs
    .filter((r) => r.role !== 'existante')
    .map((r) => ({ anchor: r.entry.anchor, level: r.entry.level, role: r.role, ligneCorpsCible: r.ligne + 1, label: r.entry.label })),
}
fs.writeFileSync(OUT, JSON.stringify(sortie, null, 2) + '\n', 'utf8')
console.log(`\nécrit : ${OUT}`)
