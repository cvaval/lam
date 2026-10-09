/**
 * Notaires du MJSP — transformation PURE du fichier d'amorçage
 * (data/judicial-map/notaires-mjsp-v1.json) en plan d'écriture, testée sans base.
 * Le script scripts/import-notaires-mjsp.ts ne fait que confronter ce plan à la base.
 *
 * LE DROIT, EN BASE (décret-loi du 27 novembre 1969 sur le notariat) : le notaire est
 * commissionné POUR UNE COMMUNE (art. 3 et 47), prête serment devant le tribunal civil de son
 * ressort (art. 16), et son répertoire est visé par le doyen du tribunal civil « dans le
 * ressort duquel se trouve la Commune » (art. 47). D'où le modèle : le notaire est rattaché à
 * une COMMUNE, et sa juridiction est le TPI compétent pour cette commune. Le TPI n'est PAS
 * stocké sur le notaire : il se déduit du rattachement `TPI_COMPETENT` — une seule source de
 * vérité, et si le ressort d'une commune change, ses notaires suivent.
 *
 * DEUX AUTORITÉS, PAS UNE. La liste dit QUI est notaire et OÙ ; la plateforme dit OÙ EST OÙ.
 *  - la commune s'apparie par son NOM, sur liste fermée : nom ou alias du référentiel, sinon
 *    un alias DÉCLARÉ dans le fichier d'amorçage — jamais un rapprochement flou en silence ;
 *  - le département SE DÉDUIT de la commune appariée ; la colonne imprimée reste telle
 *    quelle dans `sourceDepartment`, et chaque désaccord est consigné, jamais « corrigé ».
 */
import { z } from 'zod'
import { normalizePlaceName, compactPlaceName } from './normalize-place'
import { NOTARY_SIZE_STEPS } from './layers'
import {
  MJSP_DEPARTMENTS, splitCommuneOverflow, splitMention, type MjspEntry, type NotaryMention,
} from './notaires-source'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const stableId = z.string().min(3).max(120).regex(/^[a-z0-9][a-z0-9-]*$/)

export const notarySeedSchema = z.object({
  schemaVersion: z.literal('1'),
  description: z.string(),
  /** Date d'arrêté de la liste si la cliente la fournit ; à défaut, première consultation. */
  edition: isoDate,
  editionNote: z.string(),
  source: z.object({
    publisher: z.string().min(1),
    title: z.string().min(1),
    url: z.string().url(),
    /** « 423 notaires » : le compte annoncé en tête de liste. */
    announcedCount: z.number().int().positive(),
    extraction: z.string(),
    consultations: z.array(z.object({
      date: isoDate,
      file: z.string().min(1),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      bytes: z.number().int().positive(),
      producer: z.string().nullable(),
      pdfCreatedAt: z.string().nullable(),
    })).min(1),
    textIdenticalAcrossConsultations: z.boolean(),
  }),
  communeAliases: z.array(z.object({
    source: z.string().min(1),
    communeId: stableId,
    communeName: z.string().min(1),
    /** Rattachement qui n'est pas une simple variante d'orthographe : décision et source citée. */
    note: z.string().min(1).optional(),
    reference: z.object({ title: z.string().min(1), url: z.string().url(), consultedOn: isoDate }).optional(),
  })),
  unresolvedCommunes: z.array(z.object({ source: z.string().min(1), observation: z.string().min(1) })),
  decisions: z.array(z.object({
    ordinal: z.number().int().positive(),
    active: z.boolean(),
    decidedOn: isoDate,
    observation: z.string().min(1),
  })),
  /**
   * Coquille de la source tranchée par la cliente : le nom imprimé reste dans `fullName`, le
   * nom correct s'affiche (`displayName`). n° 9 : « Gamma » imprimé, « Gemma » confirmé.
   */
  nameDecisions: z.array(z.object({
    ordinal: z.number().int().positive(),
    printedName: z.string().min(1),
    displayName: z.string().min(1),
    decidedOn: isoDate,
    observation: z.string().min(1),
  })).default([]),
  /** Paires que la comparaison exacte des noms ne voit pas (noms abrégés). */
  knownPairs: z.array(z.object({ ordinals: z.tuple([z.number().int(), z.number().int()]), observation: z.string() })),
  /** Civilités et coquilles de la source, reproduites et signalées sans correction. */
  sourceQuirks: z.array(z.object({ ordinal: z.number().int().positive(), mustContain: z.string().min(1), observation: z.string().min(1) })),
  expected: z.object({
    entries: z.number().int(),
    inactive: z.number().int(),
    sourceCommunes: z.number().int(),
    directCommunes: z.number().int(),
    matchedCommunes: z.number().int(),
    unmatchedEntries: z.number().int(),
    departmentDisagreements: z.number().int(),
    placedActive: z.number().int(),
    /** TPI (identifiant de la juridiction) → notaires actifs placés dans son ressort. */
    tpiTotals: z.record(z.string(), z.number().int().nonnegative()),
  }),
  entries: z.array(z.object({
    ordinal: z.number().int().positive(),
    name: z.string().min(1),
    department: z.enum(MJSP_DEPARTMENTS),
    commune: z.string().min(1),
  })),
})
export type NotarySeed = z.infer<typeof notarySeedSchema>

/** Ce que l'appariement doit savoir d'une commune du référentiel (base ou amorçage). */
export interface CommuneRef {
  id: string
  name: string
  department: string
  aliases: string[]
  hasCentroid: boolean
  tpi: { id: string; name: string } | null
  appeal: { id: string; name: string } | null
}

export interface NotaryRow {
  id: string
  edition: string
  ordinal: number
  fullName: string
  /** Nom affiché quand la cliente a tranché une coquille de la source ; null sinon. */
  displayName: string | null
  mention: NotaryMention | null
  communeId: string | null
  sourceDepartment: string
  sourceCommune: string
  observation: string | null
  sourceJson: string
  active: boolean
}

export interface Anomaly { level: 'BLOQUANT' | 'AVERTISSEMENT'; message: string }

export interface NotaryPlan {
  rows: NotaryRow[]
  anomalies: Anomaly[]
  report: {
    entries: number
    inactive: number[]
    sourceCommunes: number
    direct: number
    aliasesUsed: Array<{ source: string; communeName: string; entries: number }>
    unresolved: Array<{ source: string; ordinals: number[] }>
    matchedCommunes: number
    placedEntries: number
    placedActive: number
    disagreements: Array<{ ordinal: number; name: string; commune: string; printed: string; actual: string }>
    duplicates: Array<{ ordinals: [number, number]; names: [string, string]; communes: [string, string]; kind: 'exact' | 'abrégée' }>
    mentions: { PDD: number; 'PD/CMM': number; columnOverflow: number[] }
    tpiTotals: Array<{ tpiId: string; tpiName: string; notaries: number; communes: number }>
    appealTotals: Array<{ appealId: string; appealName: string; notaries: number }>
    communesWithoutNotary: string[]
    sizeClasses: { small: number; medium: number; large: number; largeCommunes: Array<{ name: string; count: number }> }
  }
}

export const notaryId = (edition: string, ordinal: number) => `mjsp-${edition}-${ordinal}`

/** Comparaison de noms de PERSONNE : casse, accents, espaces et ponctuation neutralisés. */
const personKey = (s: string) => normalizePlaceName(s)

/** Comparaison de départements : « Grand'Anse » (liste) ≡ « Grand’Anse » (référentiel). */
const deptKey = (s: string) => normalizePlaceName(s)


export function buildNotaryPlan(seed: NotarySeed, communes: CommuneRef[]): NotaryPlan {
  const anomalies: Anomaly[] = []
  const bloque = (message: string) => anomalies.push({ level: 'BLOQUANT', message })
  const signale = (message: string) => anomalies.push({ level: 'AVERTISSEMENT', message })
  const ex = seed.expected

  // ── 1. Numérotation : 1..N, sans trou ni doublon, N = compte annoncé ────────
  const ordinals = seed.entries.map((e) => e.ordinal)
  const uniques = new Set(ordinals)
  if (uniques.size !== ordinals.length) bloque('numéros d’entrée dupliqués')
  for (let n = 1; n <= seed.entries.length; n++) if (!uniques.has(n)) bloque(`numéro ${n} absent de la liste`)
  if (seed.entries.length !== seed.source.announcedCount) {
    bloque(`${seed.entries.length} entrées lues, la liste en annonce ${seed.source.announcedCount}`)
  }
  if (seed.entries.length !== ex.entries) bloque(`${seed.entries.length} entrées, ${ex.entries} attendues`)
  const byOrdinal = new Map(seed.entries.map((e) => [e.ordinal, e]))

  // ── 2. Appariement des communes : liste FERMÉE ──────────────────────────────
  const index = new Map<string, Set<string>>()
  const put = (k: string, id: string) => { if (k) index.set(k, (index.get(k) ?? new Set()).add(id)) }
  for (const c of communes) {
    for (const n of [c.name, ...c.aliases]) { put(normalizePlaceName(n), c.id); put(`#${compactPlaceName(n)}`, c.id) }
  }
  const byId = new Map(communes.map((c) => [c.id, c]))
  const direct = (name: string): string[] => {
    const ids = new Set([...(index.get(normalizePlaceName(name)) ?? []), ...(index.get(`#${compactPlaceName(name)}`) ?? [])])
    return [...ids]
  }

  const aliasBySource = new Map(seed.communeAliases.map((a) => [a.source, a]))
  if (aliasBySource.size !== seed.communeAliases.length) bloque('alias déclaré deux fois')
  const unresolvedBySource = new Map(seed.unresolvedCommunes.map((u) => [u.source, u]))
  for (const a of seed.communeAliases) {
    const c = byId.get(a.communeId)
    if (!c) bloque(`alias « ${a.source} » → ${a.communeId} : commune inconnue du référentiel`)
    else if (c.name !== a.communeName) bloque(`alias « ${a.source} » : ${a.communeId} s’appelle « ${c.name} », pas « ${a.communeName} »`)
  }

  const sourceCommunes = [...new Set(seed.entries.map((e) => splitCommuneOverflow(e.commune).commune))]
  const resolution = new Map<string, { communeId: string | null; how: 'direct' | 'alias' | 'unresolved' }>()
  for (const s of sourceCommunes) {
    const d = direct(s)
    const alias = aliasBySource.get(s)
    const unresolved = unresolvedBySource.get(s)
    if (d.length === 1) {
      if (alias) bloque(`alias « ${s} » inutile : la commune se reconnaît d’elle-même (${byId.get(d[0])?.name}) — erreur de saisie ?`)
      if (unresolved) bloque(`« ${s} » déclarée non reconnue, mais elle se reconnaît d’elle-même`)
      resolution.set(s, { communeId: d[0], how: 'direct' })
    } else if (alias) {
      resolution.set(s, { communeId: alias.communeId, how: 'alias' })
    } else if (unresolved) {
      resolution.set(s, { communeId: null, how: 'unresolved' })
    } else {
      bloque(`commune « ${s} » : ${d.length === 0 ? 'introuvable' : `ambiguë (${d.length} candidates)`} — déclarer un alias ou la déclarer non reconnue`)
      resolution.set(s, { communeId: null, how: 'unresolved' })
    }
  }
  for (const a of seed.communeAliases) {
    if (!sourceCommunes.includes(a.source)) bloque(`alias « ${a.source} » jamais consommé : aucune entrée ne porte ce nom — erreur de saisie ?`)
  }
  for (const u of seed.unresolvedCommunes) {
    if (!sourceCommunes.includes(u.source)) bloque(`commune non reconnue « ${u.source} » : aucune entrée ne porte ce nom`)
  }

  // ── 3. Décisions (entrées retirées), paires, particularités ──────────────────
  const decisionByOrdinal = new Map(seed.decisions.map((d) => [d.ordinal, d]))
  for (const d of seed.decisions) if (!byOrdinal.has(d.ordinal)) bloque(`décision sur l’entrée n° ${d.ordinal}, absente de la liste`)
  const nameDecisionByOrdinal = new Map(seed.nameDecisions.map((d) => [d.ordinal, d]))
  for (const d of seed.nameDecisions) {
    const e = byOrdinal.get(d.ordinal)
    if (!e) { bloque(`décision de nom sur l’entrée n° ${d.ordinal}, absente de la liste`); continue }
    // La liste a peut-être été corrigée à la source : on le signale, on n'arrête rien.
    if (splitMention(e.name).fullName !== d.printedName) {
      signale(`n° ${d.ordinal} : le nom imprimé n’est plus « ${d.printedName} » mais « ${splitMention(e.name).fullName} » — décision de nom à revoir`)
    }
  }
  const quirksByOrdinal = new Map<number, string[]>()
  for (const q of seed.sourceQuirks) {
    const e = byOrdinal.get(q.ordinal)
    if (!e) { bloque(`particularité sur l’entrée n° ${q.ordinal}, absente de la liste`); continue }
    if (!e.name.includes(q.mustContain)) signale(`n° ${q.ordinal} : « ${q.mustContain} » n’est plus dans le nom imprimé — la liste a-t-elle été corrigée ?`)
    quirksByOrdinal.set(q.ordinal, [...(quirksByOrdinal.get(q.ordinal) ?? []), q.observation])
  }

  // Doublons : comparaison exacte des noms (marqueur retiré, accents neutralisés).
  const duplicates: NotaryPlan['report']['duplicates'] = []
  const parNom = new Map<string, MjspEntry[]>()
  for (const e of seed.entries) {
    const k = personKey(splitMention(e.name).fullName)
    parNom.set(k, [...(parNom.get(k) ?? []), e])
  }
  for (const group of parNom.values()) {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      duplicates.push({
        ordinals: [group[i].ordinal, group[j].ordinal],
        names: [group[i].name, group[j].name],
        communes: [group[i].commune, group[j].commune],
        kind: 'exact',
      })
    }
  }
  for (const p of seed.knownPairs) {
    const [a, b] = p.ordinals.map((o) => byOrdinal.get(o))
    if (!a || !b) { bloque(`paire déclarée ${p.ordinals.join('/')} : entrée absente`); continue }
    duplicates.push({ ordinals: p.ordinals, names: [a.name, b.name], communes: [a.commune, b.commune], kind: 'abrégée' })
  }
  duplicates.sort((x, y) => x.ordinals[0] - y.ordinals[0])
  const pairNotes = new Map<number, string[]>()
  for (const d of duplicates) {
    const [a, b] = d.ordinals
    const note = (other: number, commune: string) =>
      `${d.kind === 'exact' ? 'même nom' : 'nom abrégé de la même personne ?'} que l’entrée n° ${other} (${commune}) — non fusionné`
    pairNotes.set(a, [...(pairNotes.get(a) ?? []), note(b, d.communes[1])])
    pairNotes.set(b, [...(pairNotes.get(b) ?? []), note(a, d.communes[0])])
  }

  // ── 4. Lignes ────────────────────────────────────────────────────────────────
  const sourceJsonFor = (e: MjspEntry) => JSON.stringify({
    publisher: seed.source.publisher,
    title: seed.source.title,
    url: seed.source.url,
    edition: seed.edition,
    editionNote: seed.editionNote,
    consultations: seed.source.consultations,
    textIdenticalAcrossConsultations: seed.source.textIdenticalAcrossConsultations,
    extraction: seed.source.extraction,
    printed: { ordinal: e.ordinal, name: e.name, department: e.department, commune: e.commune },
  })

  const disagreements: NotaryPlan['report']['disagreements'] = []
  const columnOverflow: number[] = []
  const mentions = { PDD: 0, 'PD/CMM': 0 }
  const rows: NotaryRow[] = seed.entries.map((e) => {
    const { fullName, mention } = splitMention(e.name)
    const { commune: sourceCommune, overflow } = splitCommuneOverflow(e.commune)
    const r = resolution.get(sourceCommune)!
    const commune = r.communeId ? byId.get(r.communeId) ?? null : null
    const notes: string[] = []
    if (mention) mentions[mention]++
    if (overflow) {
      columnOverflow.push(e.ordinal)
      notes.push(`« (${overflow}) » imprimé dans la colonne Commune (débordement de colonne) ; retiré pour l’appariement`)
    }
    if (r.how === 'alias') {
      const alias = aliasBySource.get(sourceCommune)
      notes.push(`commune imprimée « ${sourceCommune} », appariée à ${commune?.name} par alias déclaré`)
      if (alias?.note) notes.push(alias.note)
    }
    if (r.how === 'unresolved') notes.push(unresolvedBySource.get(sourceCommune)?.observation ?? `commune « ${sourceCommune} » non reconnue`)
    if (commune && deptKey(commune.department) !== deptKey(e.department)) {
      disagreements.push({ ordinal: e.ordinal, name: e.name, commune: commune.name, printed: e.department, actual: commune.department })
      notes.push(`département imprimé « ${e.department} » ; ${commune.name} est dans le département ${commune.department} (référentiel de la plateforme)`)
    }
    notes.push(...(quirksByOrdinal.get(e.ordinal) ?? []), ...(pairNotes.get(e.ordinal) ?? []))
    const decision = decisionByOrdinal.get(e.ordinal)
    if (decision) notes.push(decision.observation)
    const nom = nameDecisionByOrdinal.get(e.ordinal)
    if (nom) notes.push(nom.observation)
    return {
      id: notaryId(seed.edition, e.ordinal),
      edition: seed.edition,
      ordinal: e.ordinal,
      fullName,
      displayName: nom && nom.displayName !== fullName ? nom.displayName : null,
      // Un débordement de colonne porte aussi le marqueur : il appartient au nom.
      mention: mention ?? overflow,
      communeId: commune?.id ?? null,
      sourceDepartment: e.department,
      sourceCommune: e.commune,
      observation: notes.length ? notes.join(' ; ') : null,
      sourceJson: sourceJsonFor(e),
      active: decision ? decision.active : true,
    }
  })

  // ── 5. Comptes et contrôles bloquants ────────────────────────────────────────
  const inactive = rows.filter((r) => !r.active).map((r) => r.ordinal)
  const placed = rows.filter((r) => r.communeId)
  const placedActive = placed.filter((r) => r.active)
  const matchedCommunes = new Set(placed.map((r) => r.communeId)).size
  const unresolvedEntries = rows.filter((r) => !r.communeId)
  const directCount = [...resolution.values()].filter((r) => r.how === 'direct').length

  if (inactive.length !== ex.inactive) bloque(`${inactive.length} entrée(s) inactive(s), ${ex.inactive} attendue(s)`)
  if (sourceCommunes.length !== ex.sourceCommunes) bloque(`${sourceCommunes.length} communes dans la source, ${ex.sourceCommunes} attendues`)
  if (directCount !== ex.directCommunes) bloque(`${directCount} communes reconnues d’elles-mêmes, ${ex.directCommunes} attendues`)
  if (matchedCommunes !== ex.matchedCommunes) bloque(`${matchedCommunes} communes appariées, ${ex.matchedCommunes} attendues`)
  if (unresolvedEntries.length !== ex.unmatchedEntries) bloque(`${unresolvedEntries.length} entrée(s) sans commune, ${ex.unmatchedEntries} attendue(s)`)
  if (disagreements.length !== ex.departmentDisagreements) bloque(`${disagreements.length} désaccords de département, ${ex.departmentDisagreements} attendus`)
  if (placedActive.length !== ex.placedActive) bloque(`${placedActive.length} notaires actifs placés, ${ex.placedActive} attendus`)
  for (const r of placed) {
    if (!byId.get(r.communeId!)?.hasCentroid) bloque(`n° ${r.ordinal} : commune ${r.communeId} sans centroïde — le notaire ne pourrait pas être placé`)
  }

  // Par TPI et par cour d'appel — déduits du référentiel, jamais stockés sur le notaire.
  const perCommune = new Map<string, number>()
  for (const r of placedActive) perCommune.set(r.communeId!, (perCommune.get(r.communeId!) ?? 0) + 1)
  const tpi = new Map<string, { tpiName: string; notaries: number; communes: Set<string> }>()
  const appeal = new Map<string, { appealName: string; notaries: number }>()
  for (const [communeId, n] of perCommune) {
    const c = byId.get(communeId)!
    if (!c.tpi) { bloque(`${c.name} : aucun TPI compétent au référentiel`); continue }
    const t = tpi.get(c.tpi.id) ?? { tpiName: c.tpi.name, notaries: 0, communes: new Set<string>() }
    t.notaries += n
    t.communes.add(communeId)
    tpi.set(c.tpi.id, t)
    if (c.appeal) {
      const a = appeal.get(c.appeal.id) ?? { appealName: c.appeal.name, notaries: 0 }
      a.notaries += n
      appeal.set(c.appeal.id, a)
    }
  }
  const tpiTotals = [...tpi].map(([tpiId, t]) => ({ tpiId, tpiName: t.tpiName, notaries: t.notaries, communes: t.communes.size }))
    .sort((a, b) => b.notaries - a.notaries || a.tpiName.localeCompare(b.tpiName, 'fr'))
  const attendus = Object.entries(ex.tpiTotals)
  for (const [id, n] of attendus) {
    const got = tpi.get(id)?.notaries ?? 0
    if (got !== n) bloque(`TPI ${id} : ${got} notaires dans le ressort, ${n} attendus — les rattachements ont-ils divergé de l’amorçage ?`)
  }
  for (const id of tpi.keys()) if (!(id in ex.tpiTotals)) bloque(`TPI ${id} : présent en base, absent des totaux attendus`)

  if (seed.decisions.some((d) => d.active)) signale('une décision « active: true » ne change rien : à retirer ?')

  const counts = [...perCommune.values()]
  const largeCommunes = [...perCommune].filter(([, n]) => n >= NOTARY_SIZE_STEPS.large)
    .map(([id, count]) => ({ name: byId.get(id)!.name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'))

  return {
    rows,
    anomalies,
    report: {
      entries: rows.length,
      inactive,
      sourceCommunes: sourceCommunes.length,
      direct: directCount,
      aliasesUsed: seed.communeAliases.map((a) => ({
        source: a.source,
        communeName: a.communeName,
        entries: seed.entries.filter((e) => splitCommuneOverflow(e.commune).commune === a.source).length,
      })),
      unresolved: seed.unresolvedCommunes.map((u) => ({
        source: u.source,
        ordinals: seed.entries.filter((e) => splitCommuneOverflow(e.commune).commune === u.source).map((e) => e.ordinal),
      })),
      matchedCommunes,
      placedEntries: placed.length,
      placedActive: placedActive.length,
      disagreements,
      duplicates,
      mentions: { ...mentions, columnOverflow },
      tpiTotals,
      appealTotals: [...appeal].map(([appealId, a]) => ({ appealId, ...a })).sort((x, y) => y.notaries - x.notaries),
      communesWithoutNotary: communes.filter((c) => !perCommune.has(c.id)).map((c) => c.name).sort((a, b) => a.localeCompare(b, 'fr')),
      sizeClasses: {
        small: counts.filter((n) => n < NOTARY_SIZE_STEPS.medium).length,
        medium: counts.filter((n) => n >= NOTARY_SIZE_STEPS.medium && n < NOTARY_SIZE_STEPS.large).length,
        large: counts.filter((n) => n >= NOTARY_SIZE_STEPS.large).length,
        largeCommunes,
      },
    },
  }
}

/**
 * Le référentiel des communes tel que l'amorçage de la carte le produit (seed-v1.json +
 * metadata.json) — pour les tests et l'extraction, sans base. L'import, lui, lit la BASE.
 */
export function communeRefsFromImportPlan(plan: {
  departments: Array<{ id: string; name: string }>
  communes: Array<{ id: string; name: string; departmentId: string; aliasesJson: string; centroidLat: number | null; centroidLng: number | null }>
  courts: Array<{ id: string; name: string }>
  jurisdictions: Array<{ courtId: string; communeId: string; relationship: string }>
}): CommuneRef[] {
  const dept = new Map(plan.departments.map((d) => [d.id, d.name]))
  const court = new Map(plan.courts.map((c) => [c.id, c.name]))
  const rel = (communeId: string, relationship: string) => {
    const j = plan.jurisdictions.find((x) => x.communeId === communeId && x.relationship === relationship)
    return j ? { id: j.courtId, name: court.get(j.courtId) ?? j.courtId } : null
  }
  return plan.communes.map((c) => ({
    id: c.id,
    name: c.name,
    department: dept.get(c.departmentId) ?? '',
    aliases: (() => { try { const a = JSON.parse(c.aliasesJson); return Array.isArray(a) ? a.filter((x): x is string => typeof x === 'string') : [] } catch { return [] } })(),
    hasCentroid: c.centroidLat != null && c.centroidLng != null,
    tpi: rel(c.id, 'TPI_COMPETENT'),
    appeal: rel(c.id, 'APPEL_COMPETENT'),
  }))
}

/** Champs comparés pour décider « inchangé » — tous ceux que l'import écrit. */
export const NOTARY_FIELDS = [
  'edition', 'ordinal', 'fullName', 'displayName', 'mention', 'communeId', 'sourceDepartment', 'sourceCommune',
  'observation', 'sourceJson', 'active',
] as const satisfies readonly (keyof NotaryRow)[]

/**
 * Plan contre base, par identifiant stable. AUCUNE SUPPRESSION IMPLICITE : une ligne en base
 * absente du fichier est rendue dans `orphans` pour être SIGNALÉE, jamais retirée.
 */
export function diffNotaries(
  rows: NotaryRow[],
  existing: Array<Partial<Record<keyof NotaryRow, unknown>> & { id: string }>,
): { create: NotaryRow[]; update: NotaryRow[]; unchanged: number; orphans: string[] } {
  const cur = new Map(existing.map((e) => [e.id, e]))
  const create: NotaryRow[] = []
  const update: NotaryRow[] = []
  let unchanged = 0
  for (const r of rows) {
    const e = cur.get(r.id)
    if (!e) create.push(r)
    else if (NOTARY_FIELDS.every((k) => (e[k] ?? null) === (r[k] ?? null))) unchanged++
    else update.push(r)
  }
  const planIds = new Set(rows.map((r) => r.id))
  return { create, update, unchanged, orphans: existing.filter((e) => !planIds.has(e.id)).map((e) => e.id) }
}
