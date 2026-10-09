/**
 * Coordonnées des études de notaires — fonctions PURES (testées dans coordonnees.test.ts).
 *
 * DEUX AUTORITÉS. La liste du MJSP dit qui est notaire et où il est commissionné ; les
 * coordonnées disent comment joindre son étude. Elles ont leur propre provenance et leur
 * propre date, et ne touchent jamais à la liste. Une adresse ne déplace pas le notaire (il
 * est commissionné pour une commune, décret-loi du 27 novembre 1969, art. 3 et 47) et n'est
 * jamais géolocalisée.
 *
 * Rien n'est « amélioré » : adresse et courriel restent tels que communiqués. Seuls les
 * téléphones sont normalisés — en E.164 pour le lien `tel:`, et affichés d'une seule façon.
 */
import { z } from 'zod'
import { normalizePlaceName } from './normalize-place'

// ── Téléphones ───────────────────────────────────────────────────────────────

/**
 * « +509 2998-47-47 », « 2942-3848 », « (509) 2813 1299 » → « +50929984747 ». Un numéro
 * haïtien a 8 chiffres après l'indicatif 509 ; tout le reste est refusé (null), jamais
 * « deviné ».
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '')
  const sans = digits.replace(/^\+/, '')
  if (/^509\d{8}$/.test(sans)) return `+${sans}`
  if (/^\d{8}$/.test(sans)) return `+509${sans}`
  return null
}

/** « +50929984747 » → « +509 2998-4747 » : un seul format affiché, quel que soit celui reçu. */
export function formatPhone(e164: string): string {
  const m = /^\+509(\d{4})(\d{4})$/.exec(e164)
  return m ? `+509 ${m[1]}-${m[2]}` : e164
}

/** Forme d'adresse électronique plausible — on ne vérifie RIEN d'autre (aucun envoi). */
export const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

// ── Amorçage ─────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const contactSeedSchema = z.object({
  schemaVersion: z.literal('1'),
  description: z.string(),
  entries: z.array(z.object({
    notaryId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    /** Le nom IMPRIMÉ (`fullName`) attendu en base : verrou contre un décalage de numéros. */
    expectedName: z.string().min(1),
    address: z.string().min(1).max(200).nullable(),
    /** Tels que communiqués ; normalisés par le plan. */
    phones: z.array(z.string().min(1).max(40)),
    email: z.string().min(3).max(120).nullable(),
    searchAliases: z.array(z.string().min(1)).default([]),
    observation: z.string().nullable(),
    upToDateOn: isoDate,
    source: z.object({
      providedBy: z.string().min(1),
      providedOn: isoDate,
      channel: z.string().min(1),
      evidence: z.string().nullable().default(null),
    }),
  })),
})
export type ContactSeed = z.infer<typeof contactSeedSchema>

export interface ContactRow {
  id: string
  notaryId: string
  address: string | null
  phonesJson: string
  email: string | null
  searchAliasesJson: string
  observation: string | null
  sourceJson: string
  upToDateOn: Date
  active: boolean
}

export interface ContactAnomaly { level: 'BLOQUANT' | 'AVERTISSEMENT'; message: string }

/** Ce que le plan doit savoir de l'entrée de la liste visée. */
export interface NotaryRef { id: string; fullName: string; active: boolean }

export const contactId = (notaryId: string) => `contact-${notaryId}`

export function buildContactPlan(seed: ContactSeed, notaries: NotaryRef[]): { rows: ContactRow[]; anomalies: ContactAnomaly[] } {
  const anomalies: ContactAnomaly[] = []
  const bloque = (message: string) => anomalies.push({ level: 'BLOQUANT', message })
  const byId = new Map(notaries.map((n) => [n.id, n]))
  const vus = new Set<string>()
  const rows: ContactRow[] = []

  for (const e of seed.entries) {
    const n = byId.get(e.notaryId)
    if (vus.has(e.notaryId)) bloque(`${e.notaryId} : deux fiches pour la même entrée`)
    vus.add(e.notaryId)
    if (!n) { bloque(`${e.notaryId} : entrée inconnue de la liste`); continue }
    if (!n.active) bloque(`${e.notaryId} : entrée RETIRÉE de la liste (n° 37 ?) — aucune coordonnée ne s'y rattache`)
    // Le verrou : si une édition décale les numéros, la fiche ne se colle pas sur un autre nom.
    if (normalizePlaceName(n.fullName) !== normalizePlaceName(e.expectedName)) {
      bloque(`${e.notaryId} : la liste porte « ${n.fullName} », la fiche attend « ${e.expectedName} »`)
    }
    const phones: string[] = []
    for (const p of e.phones) {
      const norm = normalizePhone(p)
      if (!norm) bloque(`${e.notaryId} : numéro « ${p} » illisible (+509 suivi de 8 chiffres attendu)`)
      else if (!phones.includes(norm)) phones.push(norm)
    }
    if (e.email && !EMAIL_RE.test(e.email)) bloque(`${e.notaryId} : courriel « ${e.email} » mal formé`)
    if (!e.address && !phones.length && !e.email) bloque(`${e.notaryId} : aucune coordonnée`)
    rows.push({
      id: contactId(e.notaryId),
      notaryId: e.notaryId,
      address: e.address,
      phonesJson: JSON.stringify(phones),
      email: e.email,
      searchAliasesJson: JSON.stringify(e.searchAliases),
      observation: e.observation,
      sourceJson: JSON.stringify(e.source),
      upToDateOn: new Date(`${e.upToDateOn}T00:00:00.000Z`),
      active: true,
    })
  }
  return { rows, anomalies }
}

export const CONTACT_FIELDS = [
  'notaryId', 'address', 'phonesJson', 'email', 'searchAliasesJson', 'observation', 'sourceJson', 'upToDateOn', 'active',
] as const satisfies readonly (keyof ContactRow)[]

const same = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? new Date(a as Date).getTime() === new Date(b as Date).getTime()
    : (a ?? null) === (b ?? null)

/** Plan contre base, par identifiant stable ; AUCUNE suppression implicite (orphelines signalées). */
export function diffContacts(
  rows: ContactRow[],
  existing: Array<Partial<Record<keyof ContactRow, unknown>> & { id: string }>,
): { create: ContactRow[]; update: ContactRow[]; unchanged: number; orphans: string[] } {
  const cur = new Map(existing.map((e) => [e.id, e]))
  const create: ContactRow[] = []
  const update: ContactRow[] = []
  let unchanged = 0
  for (const r of rows) {
    const e = cur.get(r.id)
    if (!e) create.push(r)
    else if (CONTACT_FIELDS.every((k) => same(e[k], r[k]))) unchanged++
    else update.push(r)
  }
  const ids = new Set(rows.map((r) => r.id))
  return { create, update, unchanged, orphans: existing.filter((e) => !ids.has(e.id)).map((e) => e.id) }
}

/** Lecture tolérante de `phonesJson` (E.164) pour l'affichage. */
export function readPhones(json: string | null | undefined): string[] {
  try {
    const v = JSON.parse(json ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^\+\d{8,15}$/.test(x)) : []
  } catch { return [] }
}
