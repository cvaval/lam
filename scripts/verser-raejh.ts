/**
 * RAEJH — VERSER LE RÉPERTOIRE ALPHABÉTIQUE (Salès) DANS LA SECTION JURISPRUDENCE.
 *
 *     npx tsx scripts/verser-raejh.ts            # simulation, n'écrit rien
 *     npx tsx scripts/verser-raejh.ts --apply    # écrit
 *     npx tsx scripts/verser-raejh.ts --purge --apply   # DÉFAIT tout le versement (audit DOC_DELETED)
 *
 * Prérequis : `scripts/extraire-raejh.ts` (jeu `scripts/data/raejh-sales/`), tables
 * `JurisExtrait` / `JurisExtraitRef` en base, racine déclarée dans `DOC_TYPE_META`.
 * Prompt : « Lam — Prompt Répertoire alphabétique de jurisprudence (Salès).md », § 6.
 *
 * ─── CE QUI EST ÉCRIT, ET DANS QUEL ORDRE ──────────────────────────────────────────────────
 * 1. THÈMES — racine `jurisprudence-sales` → 20 lettres → notions (parents virtuels du tiret
 *    compris). Slugs préfixés `jfs-` : `Theme.slug` est unique GLOBALEMENT et 745 notions
 *    face à la taxonomie sectorielle finiraient par se heurter.
 * 2. ARRÊTS — une identité (date, formation, parties) = un Document JURISPRUDENCE.
 *    · APPARIÉ à l'un des 162 existants (même date, même formation, parties ≥ 0,8) ⇒ on
 *      rattache ; ON NE TOUCHE NI AU CORPS NI AU RÉSUMÉ de l'existant.
 *    · AMBIGU (deux existants possibles) ⇒ rapport, ZÉRO écriture pour cette identité.
 *    · ABSENT ⇒ créé, dans la convention des arrêts existants : `titleFr` = les parties,
 *      `chambre`, `publicationDate` = date de l'arrêt, `moniteurRef` = citation, `recueilRef`
 *      = le volume, `source = RAEJH_SALES`, `summaryFr` NULL (aucun résumé inventé).
 *      ⚠️ `bodyOriginal` COMMENCE PAR UNE NOTICE « Extraits seulement » : une fiche d'extraits
 *      ne passe jamais pour un texte intégral. La notice est dans le corps parce que c'est le
 *      seul canal visible sans toucher au lecteur (`reserve` appartient à une session parallèle).
 * 3. DocumentTheme — une ligne par (arrêt, notion) ; `isPrimary` sur la première, SAUF si
 *    l'arrêt en a déjà une (85 en portent une sectorielle ; index partiel `_one_primary`).
 * 4. JurisExtrait — une ligne par entrée du livre ; JurisExtraitRef — une ligne par renvoi
 *    unitaire, EN DÉSIGNATION : `documentId`/`anchor` restent NULL, le résolveur les posera.
 * 5. reindexDocument() HORS transaction, pour chaque arrêt créé ou rattaché — il recalcule
 *    lui-même `searchText` (extraits + libellés de notions). Ne pas l'écrire à la main.
 *
 * ─── PAR LOTS, PAS LIGNE À LIGNE ───────────────────────────────────────────────────────────
 * ⚠️ Première version : ~900 `findUnique` un par un à travers le pooler, 400 ms chacun — une
 * SIMULATION de six minutes qui n'écrivait rien. Tout ce qui peut se lire en une requête se
 * lit en une requête ; tout ce qui peut s'écrire en `createMany` s'écrit ainsi. Restent
 * séquentiels : les niveaux de thèmes (le fils a besoin de l'id du père — quatre lots) et la
 * réindexation (une par document, par construction).
 *
 * ─── CE QUI N'EST JAMAIS ÉCRIT ─────────────────────────────────────────────────────────────
 * Aucun `ArticleVersion`, aucun `CrossRef`, aucune modification d'un document hors
 * JURISPRUDENCE, aucun retrait des 286 extraits du JSON du Code du travail (rapprochement
 * rapporté seulement — le retrait est une décision ultérieure).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { audit } from '../src/lib/auth/audit'

const DATA = join(process.cwd(), 'scripts/data/raejh-sales')
const APPLY = process.argv.includes('--apply')
const PURGE = process.argv.includes('--purge')
const prisma = new PrismaClient()

const RACINE = 'jurisprudence-sales'
const SOURCE = 'RAEJH_SALES'
const RECUEIL_REF = 'Salès — Recueil alphabétique d’extraits de jurisprudence haïtienne (1963-1989)'
const NOTICE =
  'Extraits seulement — le texte intégral de cet arrêt n’est pas au corpus. Source : J.-F. Salès, ' +
  'Recueil alphabétique d’extraits de jurisprudence haïtienne, octobre 1963 à décembre 1989.'

const lire = <T,>(f: string): T => JSON.parse(readFileSync(join(DATA, f), 'utf8')) as T
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const normParties = (s: string) =>
  // ⚠️ Le séparateur « c. » se normalise AVANT le repli de casse, et seulement quand c'est un
  // séparateur : « c. », « C. », « ȼ », ou « c » suivi d'une capitale (« c Nelson »). Un
  // `\\bc\\.?` appliqué après repli attrapait le « c » de « company » et fabriquait un jeton
  // « ompany » — partagé par deux arrêts HASCO du même jour, d'où une fausse ambiguïté.
  fold(s.replace(/ȼ/g, ' c. ').replace(/&/g, ' et ').replace(/\bc\.\s*/gi, ' c ').replace(/\bc\s+(?=[A-ZÀ-Ý0-9])/g, ' c '))
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
function trig(s: string) { const t = ` ${s} `; const o = new Set<string>(); for (let i = 0; i + 3 <= t.length; i++) o.add(t.slice(i, i + 3)); return o }
function sim(a: string, b: string) { const A = trig(a), B = trig(b); let n = 0; for (const x of A) if (B.has(x)) n++; return n / (A.size + B.size - n || 1) }
function arret(msg: string): never { console.error(`\n⛔ ARRÊT — ${msg}`); process.exit(1) }
/**
 * ⚠️ LES FICHES DE 1965-66 NE NOMMENT QUE LE POURVOYANT : « Pourvoi de sieur Efton DAVID »,
 * quand le recueil écrit « Reynolds Haïtian Mines, Inc. c. Efton DAVID ». Les trigrammes
 * plafonnent à 20-40 % sur le même arrêt : mesuré sur 45 paires, TOUTES le même arrêt. La
 * règle d'appariement est donc double — trigrammes ≥ 0,8, OU un nom propre partagé (≥ 6
 * lettres, ou deux noms ≥ 4 lettres), hors mots creux — et TOUJOURS un seul candidat : deux
 * candidats qui partagent un nom, c'est une ambiguïté, pas un choix.
 */
const CREUX = new Set(['compagnie', 'societe', 'sieur', 'sieurs', 'dame', 'dames', 'consorts', 'pourvoi', 'ministere', 'public', 'epoux', 'veuve', 'heritiers', 'anonyme', 'haitian', 'haytian', 'hasco', 'haitienne', 'haiti', 'company', 'national', 'nationale', 'limited', 'republique', 'banque', 'usine', 'maison', 'notaire', 'juge', 'tribunal', 'american', 'sugar', 'section', 'cassation', 'cour', 'premiere', 'deuxieme', 'reunies', 'sections'])
const nomsPropres = (s: string) => new Set(normParties(s).split(' ').filter((t) => t.length >= 4 && !CREUX.has(t) && !/^\d+$/.test(t)))
function parNoms(titreExistant: string, parties: string): boolean {
  const a = nomsPropres(titreExistant), b = nomsPropres(parties)
  const communs = [...a].filter((t) => b.has(t))
  return communs.some((t) => t.length >= 6) || communs.length >= 2
}
/**
 * EN DEUX TEMPS : les trigrammes d'abord — deux arrêts HASCO le même jour partagent
 * « american » sans être le même, mais un seul ressemble à ≥ 0,8 ; les noms ensuite, pour
 * les titres « Pourvoi de sieur X » qui n'ont pas de quoi ressembler.
 */
function candidats<T extends { titleFr: string }>(cands: T[], parties: string): T[] {
  const parSim = cands.filter((d) => sim(normParties(d.titleFr), normParties(parties)) >= 0.8)
  if (parSim.length === 1) return parSim
  if (parSim.length > 1) return parSim
  return cands.filter((d) => parNoms(d.titleFr, parties))
}

/** « ABANDON DU TOÎT MARITAL » → « Abandon du toit marital » ; les sigles pointés (O.A.V.C.T.) restent. */
function enPhrase(label: string): string {
  const s = label.split(' ').map((m) => (/^[A-ZÀ-Ý](\.[A-ZÀ-Ý])+\.?$/.test(m) ? m : m.toLowerCase())).join(' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
/** Exercice judiciaire : d'octobre à septembre. 16 janvier 1967 → 1966-1967. */
function exercice(iso: string): [number, number] { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)); return m >= 10 ? [y, y + 1] : [y - 1, y] }
const dateFr = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); const M = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; return `${d === 1 ? '1er' : d} ${M[m - 1]} ${y}` }
const cleDoc = (iso: string, chambre: string | null, titre: string) => `${iso}|${chambre ?? ''}|${normParties(titre)}`

type Notion = { label: string; lettre: string; parent: string | null; slug: string; virtuel: boolean; preambule: string[]; nb: number }
type Ref = { cible: string; cibleLibelle: string; article: string | null; posterieur: boolean }
type Extrait = { notion: string; rang: number; dateIso: string | null; formation: string | null; parties: string; texte: string; refsBrutes: string | null; refs: Ref[]; reliquatRefs: string | null }

async function purge() {
  const racine = await prisma.theme.findUnique({ where: { slug: RACINE } })
  console.log(`\n══ PURGE — ${await prisma.jurisExtraitRef.count()} renvois, ${await prisma.jurisExtrait.count()} extraits, thèmes sous « ${RACINE} », documents ${SOURCE}`)
  if (!APPLY) { console.log('(simulation — --purge --apply pour défaire)'); return }
  await prisma.jurisExtraitRef.deleteMany({})
  await prisma.jurisExtrait.deleteMany({})
  if (racine) {
    const ids: string[] = []
    let front = [racine.id]
    while (front.length) { ids.push(...front); front = (await prisma.theme.findMany({ where: { parentId: { in: front } }, select: { id: true } })).map((t) => t.id) }
    const dt = await prisma.documentTheme.deleteMany({ where: { themeId: { in: ids } } })
    console.log(`  DocumentTheme retirés (sous la racine seulement) : ${dt.count}`)
    for (const id of ids.reverse()) await prisma.theme.delete({ where: { id } })
    console.log(`  thèmes retirés : ${ids.length}`)
  }
  const n = await prisma.document.count({ where: { source: SOURCE } })
  if (n) {
    await prisma.document.deleteMany({ where: { source: SOURCE } })
    await audit({ action: 'DOC_DELETED', actorId: null, targetType: 'DOCUMENT', meta: { reason: 'purge RAEJH', count: n } })
    console.log(`  documents ${SOURCE} supprimés : ${n} (audit écrit)`)
  }
  console.log('✅ purge faite.')
}

async function main() {
  if (PURGE) return purge()
  const notions = lire<Notion[]>('notions.json')
  const extraits = lire<Extrait[]>('extraits.json')
  if (extraits.some((e) => e.texte.includes('<w:'))) arret('artefacts dans un extrait')
  const notionsAvecEntrees = new Set(extraits.map((e) => e.notion))
  const vides = new Set(notions.filter((n) => !n.virtuel && !notionsAvecEntrees.has(n.label)).map((n) => n.label))
  const sansDate = extraits.filter((e) => !e.dateIso).length
  console.log(`\n══ RAEJH — VERSEMENT ${APPLY ? '(ÉCRITURE)' : '(simulation)'} ══`)
  console.log(`notions : ${notions.length} (dont ${notions.filter((n) => n.virtuel).length} parents virtuels) · vides non créées : ${vides.size} · entrées : ${extraits.length} · sans date (écartées) : ${sansDate}`)

  // ── 1. THÈMES — quatre lots ──
  const existants = new Map((await prisma.theme.findMany({ where: { OR: [{ slug: RACINE }, { slug: { startsWith: 'jfs-' } }] }, select: { slug: true, id: true } })).map((t) => [t.slug, t.id]))
  let themesACreer = 0
  async function lot(rows: { slug: string; labelFr: string; parentId: string | null; position: number }[]) {
    const manquants = rows.filter((r) => !existants.has(r.slug))
    themesACreer += manquants.length
    if (!manquants.length) return
    if (!APPLY) { for (const r of manquants) existants.set(r.slug, `sim:${r.slug}`); return }
    await prisma.theme.createMany({ data: manquants.map((r) => ({ ...r, active: true })), skipDuplicates: true })
    for (const t of await prisma.theme.findMany({ where: { slug: { in: manquants.map((r) => r.slug) } }, select: { slug: true, id: true } })) existants.set(t.slug, t.id)
  }
  await lot([{ slug: RACINE, labelFr: 'Répertoire alphabétique (Salès, 1963-1989)', parentId: null, position: 90 }])
  const racineId = existants.get(RACINE)!
  const lettres = [...new Set(notions.map((n) => n.lettre))].sort()
  await lot(lettres.map((L, i) => ({ slug: `jfs-lettre-${L.toLowerCase()}`, labelFr: L, parentId: racineId, position: i })))
  const niveau1 = notions.filter((n) => !n.parent && !vides.has(n.label)).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  await lot(niveau1.map((n, i) => ({ slug: n.slug, labelFr: enPhrase(n.label), parentId: existants.get(`jfs-lettre-${n.lettre.toLowerCase()}`)!, position: i })))
  const slugParLabel = new Map(notions.map((n) => [n.label, n.slug]))
  const niveau2 = notions.filter((n) => n.parent && !vides.has(n.label)).sort((a, b) => a.label.localeCompare(b.label, 'fr'))
  await lot(niveau2.map((n, i) => ({ slug: n.slug, labelFr: enPhrase(n.label.slice(n.parent!.length).replace(/^\s*[-–]\s*/, '')), parentId: existants.get(slugParLabel.get(n.parent!) ?? '') ?? existants.get(`jfs-lettre-${n.lettre.toLowerCase()}`)!, position: i })))
  const themeIdParLabel = new Map(notions.map((n) => [n.label, existants.get(n.slug)!]))
  console.log(`thèmes : ${themesACreer} à créer · ${existants.size - themesACreer} déjà présents`)

  // ── 2. ARRÊTS ──
  type Ident = { cle: string; dateIso: string; formation: string | null; parties: string; entrees: Extrait[] }
  const idents = new Map<string, Ident>()
  for (const e of extraits) {
    if (!e.dateIso) continue
    const cle = cleDoc(e.dateIso, e.formation, e.parties)
    const id = idents.get(cle) ?? { cle, dateIso: e.dateIso, formation: e.formation, parties: e.parties, entrees: [] }
    id.entrees.push(e); idents.set(cle, id)
  }
  const anciens = await prisma.document.findMany({ where: { type: 'JURISPRUDENCE', source: { not: SOURCE } }, select: { id: true, titleFr: true, chambre: true, publicationDate: true } })
  const ancParDate = new Map<string, typeof anciens>()
  for (const d of anciens) { const k = d.publicationDate?.toISOString().slice(0, 10) ?? '?'; ancParDate.set(k, [...(ancParDate.get(k) ?? []), d]) }
  const dejaVerses = new Map((await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true, titleFr: true, publicationDate: true, chambre: true } })).map((d) => [cleDoc(d.publicationDate!.toISOString().slice(0, 10), d.chambre, d.titleFr), d.id]))

  let reutilises = 0, ambigus = 0, dejaLa = 0
  const ambigusListe: string[] = [], rattachements: string[] = []
  const docIdParCle = new Map<string, string>()
  const aCreer: { cle: string; data: Parameters<typeof prisma.document.create>[0]['data'] }[] = []
  for (const id of idents.values()) {
    if (dejaVerses.has(id.cle)) { docIdParCle.set(id.cle, dejaVerses.get(id.cle)!); dejaLa++; continue }
    const cands = (ancParDate.get(id.dateIso) ?? []).filter((d) => !id.formation || !d.chambre || d.chambre === id.formation)
    const proches = candidats(cands, id.parties)
    if (proches.length === 1) { docIdParCle.set(id.cle, proches[0].id); reutilises++; rattachements.push(`${id.dateIso} « ${id.parties.slice(0, 50)} » → « ${proches[0].titleFr.slice(0, 50)} »`); continue }
    if (proches.length > 1) { ambigus++; ambigusListe.push(`${id.dateIso} « ${id.parties.slice(0, 60)} » ↔ ${proches.map((p) => p.titleFr.slice(0, 40)).join(' | ')}`); continue }
    const [ed, ef] = exercice(id.dateIso)
    const parNotion = new Map<string, Extrait[]>()
    for (const e of id.entrees) parNotion.set(e.notion, [...(parNotion.get(e.notion) ?? []), e])
    const corps = [NOTICE, '', ...[...parNotion.entries()].flatMap(([notion, es]) => [`— ${enPhrase(notion)} —`, ...es.map((e) => e.texte), ''])].join('\n').trim()
    aCreer.push({ cle: id.cle, data: {
      type: 'JURISPRUDENCE', status: 'PUBLIE', source: SOURCE, originalLang: 'fr', titleFr: id.parties,
      juridiction: `Cour de Cassation de la République d’Haïti${id.formation ? ', ' + id.formation : ''}`,
      chambre: id.formation, publicationDate: new Date(id.dateIso + 'T00:00:00Z'), exerciceDebut: ed, exerciceFin: ef,
      moniteurRef: `Cour de Cassation · ${id.formation ?? 'formation non précisée'} · ${dateFr(id.dateIso)} — Salès, RAEJH`,
      recueilRef: RECUEIL_REF, bodyOriginal: corps,
    } })
  }
  console.log(`arrêts : ${idents.size} identités · ${reutilises} rattachés à un existant · ${aCreer.length} à créer · ${ambigus} ambigus (0 écriture) · ${dejaLa} déjà versés`)
  if (APPLY && aCreer.length) {
    for (let i = 0; i < aCreer.length; i += 200) await prisma.document.createMany({ data: aCreer.slice(i, i + 200).map((x) => x.data) })
    for (const d of await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true, titleFr: true, publicationDate: true, chambre: true } }))
      docIdParCle.set(cleDoc(d.publicationDate!.toISOString().slice(0, 10), d.chambre, d.titleFr), d.id)
    const perdus = aCreer.filter((x) => !docIdParCle.has(x.cle))
    if (perdus.length) arret(`${perdus.length} documents créés introuvables à la relecture par clé`)
  } else if (!APPLY) for (const x of aCreer) docIdParCle.set(x.cle, `sim:${x.cle}`)

  // ── 3 + 4. DocumentTheme, JurisExtrait, JurisExtraitRef — en lots ──
  const primaires = new Set((await prisma.documentTheme.findMany({ where: { isPrimary: true, document: { type: 'JURISPRUDENCE' } }, select: { documentId: true } })).map((x) => x.documentId))
  const dtRows: { documentId: string; themeId: string; isPrimary: boolean; assignedBy: string }[] = []
  const extRows: { decisionId: string; themeId: string; rang: number; texte: string; refsBrutes: string | null }[] = []
  const refsParCle = new Map<string, Ref[]>()
  const primairePosee = new Set<string>()
  for (const id of idents.values()) {
    const docId = docIdParCle.get(id.cle)
    if (!docId) continue
    const vues = new Set<string>()
    for (const e of id.entrees) {
      const themeId = themeIdParLabel.get(e.notion)
      if (!themeId) continue
      if (!vues.has(e.notion)) {
        vues.add(e.notion)
        const isPrimary = !primaires.has(docId) && !primairePosee.has(docId)
        if (isPrimary) primairePosee.add(docId)
        dtRows.push({ documentId: docId, themeId, isPrimary, assignedBy: 'ADMIN' })
      }
      extRows.push({ decisionId: docId, themeId, rang: e.rang, texte: e.texte, refsBrutes: e.refsBrutes })
      refsParCle.set(`${themeId}|${e.rang}`, e.refs)
    }
  }
  const nbRefs = [...refsParCle.values()].reduce((s, r) => s + r.length, 0)
  const nbPost = [...refsParCle.values()].flat().filter((r) => r.posterieur).length
  console.log(`rattachements thème : ${dtRows.length} · extraits : ${extRows.length} · renvois : ${nbRefs} (postérieurs : ${nbPost})`)
  if (APPLY) {
    for (let i = 0; i < dtRows.length; i += 500) await prisma.documentTheme.createMany({ data: dtRows.slice(i, i + 500), skipDuplicates: true })
    for (let i = 0; i < extRows.length; i += 300) await prisma.jurisExtrait.createMany({ data: extRows.slice(i, i + 300), skipDuplicates: true })
    const tous = await prisma.jurisExtrait.findMany({ select: { id: true, themeId: true, rang: true, _count: { select: { refs: true } } } })
    const refRows: { extraitId: string; cible: string; cibleLibelle: string; article: string | null; posterieur: boolean }[] = []
    for (const x of tous) {
      if (x._count.refs) continue // déjà posés — rejouer ne duplique pas
      for (const r of refsParCle.get(`${x.themeId}|${x.rang}`) ?? []) refRows.push({ extraitId: x.id, ...r })
    }
    for (let i = 0; i < refRows.length; i += 500) await prisma.jurisExtraitRef.createMany({ data: refRows.slice(i, i + 500) })
    console.log(`écrit : ${dtRows.length} DocumentTheme · ${extRows.length} extraits · ${refRows.length} renvois`)
  }

  // ── 6.4 : rapprochement des 286 du Code du travail (rapport seulement) ──
  const ct = await prisma.document.findFirst({ where: { source: 'CODE_TRAVAIL_ANNOTE' }, select: { annotationsJson: true } })
  if (ct?.annotationsJson) {
    const j = (JSON.parse(String(ct.annotationsJson)).jurisprudence ?? {}) as Record<string, { ref: string; excerpt: string }[]>
    const tous = Object.values(j).flat()
    const MO: Record<string, number> = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 }
    const cles = new Set(extraits.filter((e) => e.dateIso).map((e) => `${e.dateIso}|${normParties(e.parties).slice(0, 30)}`))
    let retrouves = 0
    for (const c of tous) {
      const m = /(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/i.exec(c.ref)
      if (!m) continue
      const iso = `${m[3]}-${String(MO[fold(m[2])] ?? 0).padStart(2, '0')}-${m[1].padStart(2, '0')}`
      const parties = c.ref.split(/section,?\s*/i).pop() ?? ''
      if (cles.has(`${iso}|${normParties(parties).slice(0, 30)}`)) retrouves++
    }
    console.log(`Code du travail : ${retrouves} / ${tous.length} extraits du JSON retrouvés dans le recueil (rien retiré)`)
  }
  if (ambigusListe.length) console.log(`\nAMBIGUS (non écrits) :\n  ${ambigusListe.slice(0, 10).join('\n  ')}`)
  if (rattachements.length) console.log(`\nRATTACHÉS À UN EXISTANT (${rattachements.length}) — 5 premiers :\n  ${rattachements.slice(0, 5).join('\n  ')}`)
  if (!APPLY) { console.log('\n(Simulation — relancer avec --apply pour écrire.)'); return }

  // ── 5. Réindexation HORS transaction ──
  const { reindexDocument } = await import('../src/lib/search/reindex')
  const ids = [...new Set(docIdParCle.values())]
  let i = 0
  for (const d of ids) { await reindexDocument(d); if (++i % 200 === 0) console.log(`  réindexés : ${i}/${ids.length}`) }
  console.log(`réindexés : ${ids.length}`)

  console.log('\n──── RELECTURE EN BASE ────')
  console.log('  documents RAEJH_SALES      :', await prisma.document.count({ where: { source: SOURCE } }))
  console.log('  fiches sans notice         :', await prisma.document.count({ where: { source: SOURCE, NOT: { bodyOriginal: { startsWith: 'Extraits seulement' } } } }))
  console.log('  JurisExtrait               :', await prisma.jurisExtrait.count())
  console.log('  JurisExtraitRef            :', await prisma.jurisExtraitRef.count(), '· postérieurs :', await prisma.jurisExtraitRef.count({ where: { posterieur: true } }))
  console.log('  thèmes jfs-                :', await prisma.theme.count({ where: { slug: { startsWith: 'jfs-' } } }))
  console.log('  DocumentTheme sur notions  :', await prisma.documentTheme.count({ where: { theme: { slug: { startsWith: 'jfs-' } } } }))
  console.log('  ⚠️ hors JURISPRUDENCE avec notion jfs :', await prisma.documentTheme.count({ where: { theme: { slug: { startsWith: 'jfs-' } }, document: { type: { not: 'JURISPRUDENCE' } } } }))
  const multi = await prisma.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM (SELECT "documentId" FROM "DocumentTheme" WHERE "isPrimary" GROUP BY "documentId" HAVING count(*) > 1) s`
  console.log('  documents à > 1 primaire   :', Number(multi[0].n))
  console.log('\n✅ écrit.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
