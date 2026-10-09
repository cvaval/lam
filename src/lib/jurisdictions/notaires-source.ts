/**
 * Lecture de la « Liste des Notaires de la République d'Haïti » publiée par le MJSP
 * (https://www.mjsp.gouv.ht/page/notaires, bouton « Télécharger en PDF »), après
 * `pdftotext -layout`. Fonctions PURES — testées dans notaires.test.ts.
 *
 * ⚠️ LE MOTIF N'EST ÉCRIT QU'ICI. Une première mesure, faite avec un motif mal échappé, n'a
 * placé que 124 communes et 418 entrées : les quatre « GRANDE RIVIERE DU NORD (PDD) »
 * manquaient sans que rien ne le signale. Le script d'extraction et l'import passent par
 * ce module, et un test compte les entrées.
 *
 * La liste est une source officielle : on la REPRODUIT, on ne l'améliore pas. Les noms
 * restent tels qu'imprimés (civilités « Mrie », « Mme », points espacés compris) ; seul le
 * marqueur final « (PDD) » ou « PD/CMM » est détaché dans `mention`, sans interprétation.
 */

export const MJSP_DEPARTMENTS = [
  'Ouest', 'Nord-Ouest', 'Nord-Est', 'Nord', 'Sud-Est', 'Sud', 'Centre', 'Artibonite', 'Nippes', "Grand'Anse",
] as const
export type MjspDepartment = (typeof MJSP_DEPARTMENTS)[number]

/**
 * Une entrée par ligne : numéro, nom, département, commune — colonnes séparées par au moins
 * deux espaces. ⚠️ L'ORDRE DES ALTERNATIVES COMPTE : `Nord-Ouest` et `Nord-Est` avant `Nord`,
 * `Sud-Est` avant `Sud`, sinon « Nord-Ouest » se lirait « Nord » suivi d'une commune « -Ouest… ».
 */
export const MJSP_LINE_RE =
  /^\s*(\d+)\s+(.+?)\s{2,}(Ouest|Nord-Ouest|Nord-Est|Nord|Sud-Est|Sud|Centre|Artibonite|Nippes|Grand'Anse)\s{2,}(.+?)\s*$/

/** « 423 notaires » en tête de liste : le compte que le ministère annonce. */
const ANNONCE_RE = /^\s*(\d+)\s+notaires\s*$/i

export interface MjspEntry {
  ordinal: number
  /** Nom tel qu'imprimé, marqueur compris. */
  name: string
  department: MjspDepartment
  /** Commune telle qu'imprimée, débordement de colonne compris. */
  commune: string
}

export interface MjspParse {
  announced: number | null
  entries: MjspEntry[]
  /** Lignes commençant par un nombre mais non reconnues (hors l'annonce) — doit être vide. */
  rejected: string[]
}

export function parseMjspText(text: string): MjspParse {
  let announced: number | null = null
  const entries: MjspEntry[] = []
  const rejected: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const a = ANNONCE_RE.exec(line)
    if (a) { announced = Number(a[1]); continue }
    const m = MJSP_LINE_RE.exec(line)
    if (m) {
      entries.push({ ordinal: Number(m[1]), name: m[2].trim(), department: m[3] as MjspDepartment, commune: m[4].trim() })
    } else if (/^\s*\d+\s/.test(line)) {
      rejected.push(line)
    }
  }
  return { announced, entries, rejected }
}

export type NotaryMention = 'PDD' | 'PD/CMM'

/** Marqueur FINAL du nom : « (PDD) » (avec parenthèses) ou « PD/CMM » (sans, #338). */
const MENTION_RE = /\s+(?:\((PDD)\)|(PD\/CMM))\s*$/

/**
 * Sépare le marqueur du nom, sans rien interpréter : « Mme Rolès DONATIEN (PDD) » →
 * { fullName: « Mme Rolès DONATIEN », mention: « PDD » }.
 */
export function splitMention(printedName: string): { fullName: string; mention: NotaryMention | null } {
  const m = MENTION_RE.exec(printedName)
  if (!m) return { fullName: printedName.trim(), mention: null }
  return { fullName: printedName.slice(0, m.index).trim(), mention: (m[1] ?? m[2]) as NotaryMention }
}

/**
 * « (PDD) » imprimé DANS LA COLONNE COMMUNE (#167-170 : « GRANDE RIVIERE DU NORD (PDD) ») :
 * débordement de colonne. On le retire pour apparier, et on le dit.
 */
const COMMUNE_OVERFLOW_RE = /\s*\((PDD)\)\s*$/

export function splitCommuneOverflow(printedCommune: string): { commune: string; overflow: NotaryMention | null } {
  const m = COMMUNE_OVERFLOW_RE.exec(printedCommune)
  if (!m) return { commune: printedCommune.trim(), overflow: null }
  return { commune: printedCommune.slice(0, m.index).trim(), overflow: m[1] as NotaryMention }
}

/** Affichage du marqueur « tel qu'imprimé » : « (PDD) » avec parenthèses, « PD/CMM » sans. */
export function mentionAsPrinted(mention: string | null): string | null {
  if (!mention) return null
  return mention === 'PDD' ? '(PDD)' : mention
}
