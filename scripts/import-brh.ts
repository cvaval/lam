/**
 * Import des circulaires de la BRH (PDF océrisés) dans le corpus Lam.
 *
 *   npx tsx scripts/import-brh.ts --dir "<dossier>" [--commit] [--purge]
 *
 * Sans --commit : inventaire seul (table de relecture, aucun écrit en base).
 * Avec --commit : RÉCONCILIE (apparie sur numéro + intitulé, met à jour le contenu, crée
 *   ce qui manque, SIGNALE sans supprimer ce qui n'est plus dans la source). Les thèmes,
 *   notes, favoris et renvois survivent.
 * Avec --commit --purge : ancien comportement — supprime tout source='BRH' avant d'importer.
 *   ⚠️ DÉTRUIT les 84 rattachements thématiques. À n'employer qu'à dessein.
 *
 * Volontairement heuristique + relecture humaine/IA : les titres et dates extraits
 * sont affichés pour validation ; les corrections vivent dans MANUAL_FIXES.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PDFParse } from 'pdf-parse'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

// ── Classification par nom de fichier ─────────────────────────────────────────

export interface ParsedName {
  kind: 'CIRCULAIRE' | 'LETTRE'
  /** numéro canonique, ex. « 120 », « 81-6 », « 01-19 » */
  num: string
  /** note additionnelle (suffixe _NA[_NoX]) */
  noteNo: number | null
  /** seconde numérisation du même document (suffixe -2) */
  altScan: boolean
}

// Fichiers hors série (compilations, lois, lignes directrices, avis) — signalés mais non importés.
const SKIP_PATTERNS = [
  /^Circulaires BRH( Full)?\.pdf$/i,
  /^loi sur les banques/i,
  /^CIRCULAIRE_textes?_Portant_BANQUES\.pdf$/i,
  /Lignes_Directrices/i,
  /^AVIS-AU-PUBLIC/i,
  /^\d{8}_Avis\.pdf$/i,
]

// Cas particuliers nommés sans convention.
const SPECIAL: Record<string, ParsedName> = {
  // (Le recueil CirculaireAuxBanques.pdf n'est plus éclaté : ses ~24 circulaires de
  // réserves obligatoires sont désormais des téléversements individuels autoritatifs
  // source='BRH-WEB' — scripts/import-circ-batch.ts/import-reserves-batch.ts. Le PDF
  // est donc SAUTÉ (SUPERSEDED_BY_WEB) pour éviter tout doublon.)
  'circulaires_maisons_transfert.pdf': { kind: 'CIRCULAIRE', num: '98', noteNo: null, altScan: true }, // n° 98 « maisons de transfert » (98_Circulaire.pdf = banques)
  // Fichier mal nommé : le texte OCR dit « NOTE ADDITIONNELLE — CIRCULAIRE 99-3 »
  // (vigilance renforcée LBC/FT), pas une Lettre-Circulaire n° 93-3.
  '93-3_Lettre-Circulaire.pdf': { kind: 'CIRCULAIRE', num: '99-3', noteNo: 1, altScan: false },
}

// Fichiers du dossier dont la circulaire est désormais gérée HORS pipeline via le
// recueil 2017 (source 'BRH-WEB', version officielle docx) — scripts/import-recueil-2017.ts.
// On les SAUTE pour ne pas recréer un doublon source='BRH' au ré-import (dédup §
// « la nouvelle version prévaut »). (72-3, 78-1, 86-12-L et toutes les réserves
// obligatoires sont maintenant des téléversements individuels — cf. SUPERSEDED_BY_WEB.)
const SUPERSEDED_BY_RECUEIL = new Set([
  '87_Circulaire.pdf', '93_Circulaire.pdf', '97_Circulaire.pdf', '98_Circulaire.pdf',
  'circulaires_maisons_transfert.pdf', '103-1_Circulaire.pdf', '83-4_Circulaire.pdf',
  '04_Lettre-Circulaire.pdf', '05_Lettre-Circulaire.pdf', '06_Lettre-Circulaire.pdf',
  '07_Lettre-Circulaire.pdf', '09-1_Lettre-Circulaire.pdf', '11_Lettre-Circulaire.pdf',
])

// Circulaires désormais gérées HORS pipeline via téléversement docx+pdf (source
// 'BRH-WEB', version fournie qui prévaut) — scripts/import-circ-batch.ts. On SAUTE
// le PDF du dossier pour ne pas recréer un doublon source='BRH' au ré-import.
const SUPERSEDED_BY_WEB = new Set([
  // Recueil des réserves obligatoires : éclatement abandonné → les ~24 circulaires
  // sont des téléversements individuels (import-reserves-batch.ts), le PDF est sauté.
  'CirculaireAuxBanques.pdf',
  '121_Circulaire.pdf',
  // n° 127 : corps OCR RÉPARÉ + lecteur annoté (source dédiée 'CIRC_BRH_127') par
  // scripts/reparer-circulaire-127.ts. Sans ce saut, le ré-import recréerait un doublon
  // source='BRH' à côté du document réparé.
  '127_Circulaire.pdf',
  '126_Circulaire.pdf',
  'Circulaire-129.pdf',
  'Circulaire-129-1-Aux-Institutions-FinancieEres-6-feevrier-2026-Lutte-contre-le-blanchiment-de-capitaux._0001.pdf',
  'Circulaire 131 - Aux-Institutions-Financieres-6-fevrier-2026-Protection-des-consommateurs-de-produits-et-services-financiers_0001.pdf',
])

export function parseName(file: string): ParsedName | 'skip' | null {
  if (SUPERSEDED_BY_RECUEIL.has(file) || SUPERSEDED_BY_WEB.has(file)) return 'skip'
  if (SKIP_PATTERNS.some((re) => re.test(file))) return 'skip'
  if (SPECIAL[file]) return SPECIAL[file]

  let m = file.match(/^(\d+(?:-\d+)?)_Circulaire(_NA(?:_No(\d+))?)?(-2)?\.pdf$/i)
  if (m) return { kind: 'CIRCULAIRE', num: m[1], noteNo: m[2] ? Number(m[3] ?? 1) : null, altScan: Boolean(m[4]) }

  m = file.match(/^(\d+(?:-\d+)?)_Lettre-Circulaire\.pdf$/i)
  if (m) return { kind: 'LETTRE', num: m[1], noteNo: null, altScan: false }

  // « Circulaire-129.pdf », « Circulaire-129-1-Aux-… », « Circulaire 131 - … », « Circulaire-130-secteur-… »
  m = file.match(/^Circulaire[\s-]+(\d+(?:-\d+)?)\b/i)
  if (m) return { kind: 'CIRCULAIRE', num: m[1], noteNo: null, altScan: /\(OCR\)/i.test(file) === false && /_0001/.test(file) }

  return null
}

// ── Extraction de métadonnées depuis le texte OCR ─────────────────────────────

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
}

function normalizeOcr(s: string): string {
  // Corrections OCR fréquentes sur les dates (« f~er », « feevrier », « 1cr », « 21novembre2023 »)
  return s
    .replace(/f[~e]e?vrier/gi, 'février')
    .replace(/\b1cr\b/g, '1er')
    .replace(/\bler\b/g, '1er')
    .replace(/(\d)(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)/gi, '$1 $2')
    .replace(/(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)(\d)/gi, '$1 $2')
}

export function extractDate(text: string, filename: string): { date: Date | null; from: string } {
  const t = normalizeOcr(text)
  // 1) Date de signature « Port-au-Prince, le … »
  const sig = [...t.matchAll(/Port-au-Prince\s*,?\s*le\s+(\d{1,2})(?:er)?\s+([a-zéûà]+)\s+(\d{4})/gi)].pop()
  if (sig) {
    const mo = MONTHS[sig[2].toLowerCase()]
    if (mo) return { date: new Date(Date.UTC(Number(sig[3]), mo - 1, Number(sig[1]))), from: 'signature' }
  }
  // 2) Date dans le nom de fichier (ex. « …-6-fevrier-2026-… »)
  const fn = normalizeOcr(filename).match(/(\d{1,2})-([a-zéû]+)-(\d{4})/i)
  if (fn) {
    const mo = MONTHS[fn[2].toLowerCase()]
    if (mo) return { date: new Date(Date.UTC(Number(fn[3]), mo - 1, Number(fn[1]))), from: 'fichier' }
  }
  // 3) Dernière date du document (signature en fin de texte, hors « loi du 14 mai 2012 »)
  const all = [...t.matchAll(/(?<!loi du )(?<!décret du )(\d{1,2})(?:er)?\s+([a-zéûà]+)\s+(\d{4})/gi)]
    .filter((m) => MONTHS[m[2].toLowerCase()] && Number(m[3]) >= 1979 && Number(m[3]) <= 2030)
  const last = all.pop()
  if (last) {
    return { date: new Date(Date.UTC(Number(last[3]), MONTHS[last[2].toLowerCase()] - 1, Number(last[1]))), from: 'texte' }
  }
  return { date: null, from: 'aucune' }
}

export function extractSubject(text: string): string | null {
  const t = text.slice(0, 2500).replace(/\s+/g, ' ')
  const patterns = [
    /en mati[èe]re de\s+([^.;]{6,90})/i,
    /relatives?\s+(?:à|aux?)\s+([^.;]{6,90})/i,
    /normes?\s+relatives?\s+(?:à|aux?)\s+([^.;]{6,90})/i,
    /portant\s+sur\s+([^.;]{6,90})/i,
    /dispositions?\s+de\s+la\s+pr[ée]sente\s+(?:lettre-)?circulaire\s+en\s+([^.;]{6,90})/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m) {
      let s = m[1].trim().replace(/\s{2,}/g, ' ')
      s = s.replace(/\s+(les?|la|leurs?|sa|ses)$/i, '')
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
  }
  return null
}

export function extractAudience(text: string): string | null {
  const m = text.slice(0, 1200).match(/\bAUX?\s+[A-ZÉÈÀÇ][A-ZÉÈÀÇ' ,\n-]{8,120}/)
  if (!m) return null
  return m[0].replace(/\s+/g, ' ').trim().toLowerCase().replace(/^aux?\s/, '')
}

// ── Corrections manuelles (relecture IA des cas douteux) ─────────────────────
// clé = nom de fichier ; valeurs = champs à forcer.
const MANUAL_FIXES: Record<string, { title?: string; date?: string; skip?: boolean; note?: string }> = {
  // Relecture IA du 12 juin 2026 (inventaire --dir … sans --commit) :
  '63-3_Circulaire.pdf': { title: 'Circulaire BRH n° 63-3 aux banques et autres institutions financières' },
  '81-6_Circulaire.pdf': { title: 'Circulaire BRH n° 81-6 — Gestion du risque de change' },
  '82-3_Circulaire.pdf': { title: 'Circulaire BRH n° 82-3 — Actionnariat des institutions financières' },
  '83-4_Circulaire.pdf': { title: "Circulaire BRH n° 83-4 aux banques commerciales et banques d'épargne et de logement" },
  '87_Circulaire.pdf': { title: "Circulaire BRH n° 87 aux banques commerciales et banques d'épargne et de logement" },
  '88-1_Circulaire.pdf': { title: 'Circulaire BRH n° 88-1 — Fonds propres réglementaires' },
  '92-1_Circulaire.pdf': { title: 'Circulaire BRH n° 92-1 — Surveillance consolidée de la situation financière et des opérations' },
  '95-4_Circulaire.pdf': { title: 'Circulaire BRH n° 95-4 — Conditions et modalités de transmission des déclarations de transactions' },
  '97_Circulaire.pdf': { title: "Circulaire BRH n° 97 aux banques commerciales et banques d'épargne et de logement" },
  'circulaires_maisons_transfert.pdf': {
    title: 'Circulaire BRH n° 98 — Efficience, intégrité et sécurité du système de paiements',
    date: '2011-05-20', // signature « Port-au-Prince, le 20 mai 2011 »
  },
  '99-4_Circulaire.pdf': { title: 'Circulaire BRH n° 99-4 — Connaissance du client (LBC/FT)' },
  '93-3_Lettre-Circulaire.pdf': { title: 'Circulaire BRH n° 99-3 — Note additionnelle — Mesures de vigilance renforcée (LBC/FT)' },
  '100-4_Circulaire.pdf': {
    title: 'Circulaire BRH n° 100-4 — Prévention du blanchiment de capitaux, du financement du terrorisme et de la prolifération des armes',
  },
  '103-1_Circulaire.pdf': { title: 'Circulaire BRH n° 103-1 — Règles applicables aux chèques émis en Haïti' },
  '105-1_Circulaire.pdf': { title: 'Circulaire BRH n° 105-1 — Transmission des informations sur les crédits octroyés' },
  '107-3_Circulaire.pdf': { title: 'Circulaire BRH n° 107-3 — Connaissance du client (LBC/FT)' },
  '109-1_Circulaire.pdf': { title: "Circulaire BRH n° 109-1 — Divulgation et affichage des taux d'intérêt, tarifs, frais et commissions" },
  '110-1_Circulaire.pdf': { title: 'Circulaire BRH n° 110-1 — Pénalités pour retards de soumission des rapports' },
  '113_Circulaire.pdf': { title: "Circulaire BRH n° 113 — Supervision des coopératives d'épargne et de crédit" },
  // OCR ajouté par l'admin le 12 juin 2026 (anciens scans sans couche texte) :
  '83-5_Circulaire.pdf': { title: 'Circulaire BRH n° 83-5 — Limites de concentration des risques de crédit' },
  '114-3_Circulaire_NA_No1.pdf': {
    title: 'Circulaire BRH n° 114-3 — Note additionnelle n° 1 — Mise en veilleuse temporaire d’obligations (transferts de fonds internationaux sans contrepartie)',
  },
  '119_Circulaire.pdf': {
    title: 'Circulaire BRH n° 119 — Transmission des informations sur les opérations des intermédiaires de change',
    date: '2021-05-11', // signature (admin, 13 juin 2026) ; entrée en vigueur le 1er juin 2021
  },
  '126_Circulaire.pdf': { title: 'Circulaire BRH n° 126 — Sécurité informatique des institutions financières' },
  '115-2_Circulaire.pdf': { title: 'Circulaire BRH n° 115-2 — Prêts octroyés à la clientèle' },
  '115-5_Circulaire.pdf': { title: 'Circulaire BRH n° 115-5 — Prêts octroyés à la clientèle' },
  '115-6_Circulaire.pdf': { title: 'Circulaire BRH n° 115-6 — Prêts octroyés à la clientèle' },
  '121_Circulaire.pdf': { title: 'Circulaire BRH n° 121 — Fournisseurs de services de paiement électronique' },
  '123_Circulaire.pdf': { title: 'Circulaire BRH n° 123 — Règles de capital social minimum' },
  '124_Circulaire.pdf': { title: "Circulaire BRH n° 124 — Obligation d'information de la BRH" },
  '127_Circulaire.pdf': {
    title: 'Circulaire BRH n° 127 — Intermédiaires de change',
    date: '2022-01-13', // signature confirmée par l'admin (13 juin 2026)
  },
  '128-1_Circulaire.pdf': { title: 'Circulaire BRH n° 128-1 — Mesures préventives LBC/FT applicables aux bureaux de change' },
  'Circulaire-129-1-Aux-Institutions-FinancieEres-6-feevrier-2026-Lutte-contre-le-blanchiment-de-capitaux._0001.pdf': {
    title: 'Circulaire BRH n° 129-1 — Lutte contre le blanchiment de capitaux',
  },
  // PDF remplacé le 12 juin 2026 par une version avec couche texte (OCR de l'admin).
  'Circulaire-129.pdf': { title: 'Circulaire BRH n° 129 — Mesures préventives LBC/FT applicables aux institutions financières' },
  'Circulaire-130-secteur-touristique.pdf': { title: 'Circulaire BRH n° 130 — Crédit au secteur touristique' },
  'Circulaire 131 - (OCR).pdf': {
    title: 'Circulaire BRH n° 131 — Protection des consommateurs de produits et services financiers',
  },
  // n° 87-1 (refonte 2026 de la classification des prêts, distincte du n° 87 de 1997) :
  // gérée HORS pipeline (source 'BRH-WEB', version HTML du .docx) via
  // scripts/import-circulaires-docx.ts → on SAUTE le PDF ici pour éviter un doublon
  // source='BRH' au ré-import.
  'CIRCULAIRE-87-1.pdf': { skip: true, note: 'Gérée hors pipeline (BRH-WEB) — import-circulaires-docx.ts' },
  // 106_Circulaire.pdf CONFLATE deux textes (106 p.1-3 + 106-1 p.4-6). Désormais gérés
  // séparément hors pipeline (source 'BRH-WEB', PDF officiels distincts) via
  // scripts/apply-version-arbitrage.ts → on saute le fichier conflaté.
  '106_Circulaire.pdf': { skip: true, note: '106 + 106-1 gérées hors pipeline (BRH-WEB) — apply-version-arbitrage.ts' },
  '05_Lettre-Circulaire.pdf': { title: 'Lettre-Circulaire BRH n° 05 — Restructuration de prêts' },
  '06_Lettre-Circulaire.pdf': { title: "Lettre-Circulaire BRH n° 06 aux banques commerciales et banques d'épargne et de logement" },
  '07_Lettre-Circulaire.pdf': { title: "Lettre-Circulaire BRH n° 07 aux banques commerciales, banques d'épargne et de logement et maisons de transfert" },
  '09-1_Lettre-Circulaire.pdf': { title: 'Lettre-Circulaire BRH n° 09-1 aux banques' },
  '10-1_Lettre-Circulaire.pdf': { title: 'Lettre-Circulaire BRH n° 10-1 aux banques' },
  '11_Lettre-Circulaire.pdf': { title: 'Lettre-Circulaire BRH n° 11 aux banques' },
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

interface Row {
  file: string
  kind: 'CIRCULAIRE' | 'LETTRE'
  num: string
  noteNo: number | null
  number: string
  title: string
  date: Date | null
  dateFrom: string
  textLen: number
  body: string
  flags: string[]
}

async function readPdfText(path: string): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(path)) })
  try {
    const res = await parser.getText()
    return res.text ?? ''
  } finally {
    await parser.destroy()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dirIdx = args.indexOf('--dir')
  const dir = dirIdx >= 0 ? args[dirIdx + 1] : process.env.BRH_DIR
  const commit = args.includes('--commit')
  const purge = args.includes('--purge')
  if (!dir) {
    console.error('Usage: npx tsx scripts/import-brh.ts --dir "<dossier des PDF>" [--commit]')
    process.exit(1)
  }

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'))
  const rows: Row[] = []
  const skipped: string[] = []
  const unrecognized: string[] = []

  for (const file of files.sort()) {
    const parsed = parseName(file)
    if (parsed === 'skip') { skipped.push(file); continue }
    if (!parsed) { unrecognized.push(file); continue }
    const fix = MANUAL_FIXES[file]
    if (fix?.skip) { skipped.push(`${file} (manuel)`); continue }

    const sizeMb = statSync(join(dir, file)).size / 1e6
    const text = await readPdfText(join(dir, file)).catch(() => '')
    const cleanText = text.replace(/-- \d+ of \d+ --/g, '').trim()
    const flags: string[] = []
    if (cleanText.length < 200) flags.push('SANS_TEXTE')
    if (sizeMb > 40) flags.push(`GROS(${Math.round(sizeMb)}Mo)`)

    const { date: autoDate, from: dateFrom } = extractDate(cleanText, file)
    const date = fix?.date === 'null' ? null : fix?.date ? new Date(`${fix.date}T00:00:00Z`) : autoDate
    if (!date) flags.push('DATE?')

    const serie = parsed.kind === 'LETTRE' ? 'Lettre-Circulaire' : 'Circulaire'
    const number = `${serie} n° ${parsed.num}`
    const subject = extractSubject(cleanText)
    const audience = extractAudience(cleanText)
    const notePart = parsed.noteNo != null ? ` — Note additionnelle${parsed.noteNo > 1 || /No\d/.test(file) ? ` n° ${parsed.noteNo}` : ''}` : ''
    let title =
      fix?.title ??
      (subject
        ? `${serie} BRH n° ${parsed.num}${notePart} — ${subject}`
        : `${serie} BRH n° ${parsed.num}${notePart}${audience ? ` aux ${audience}` : ''}`)
    if (cleanText.length < 200 && !fix?.title) title = `${serie} BRH n° ${parsed.num}${notePart} (document numérisé — texte non extrait)`
    else if (!subject && !fix?.title) flags.push('TITRE?')

    const body =
      cleanText.length >= 200
        ? cleanText
        : '[Document numérisé sans couche texte exploitable — texte intégral non disponible ; se référer au PDF source BRH.]'

    rows.push({ file, kind: parsed.kind, num: parsed.num, noteNo: parsed.noteNo, number, title, date, dateFrom, textLen: cleanText.length, body, flags })
  }

  // (L'éclatement du recueil « réserves obligatoires » a été retiré : ces circulaires
  // sont désormais des téléversements individuels source='BRH-WEB'. Le PDF recueil est
  // sauté plus haut, donc `rows` ne contient plus de ligne recueil à éclater.)
  const expanded: Row[] = rows

  // Doublons de scan : même numéro + même note → on garde la couche texte la plus riche.
  const byKey = new Map<string, Row[]>()
  for (const r of expanded) {
    const k = `${r.kind}|${r.num}|${r.noteNo ?? ''}`
    byKey.set(k, [...(byKey.get(k) ?? []), r])
  }
  const keep: Row[] = []
  const dropped: string[] = []
  for (const group of byKey.values()) {
    group.sort((a, b) => b.textLen - a.textLen)
    keep.push(group[0])
    for (const d of group.slice(1)) dropped.push(`${d.file} (doublon de ${group[0].file})`)
  }
  keep.sort((a, b) => a.kind.localeCompare(b.kind) || baseNum(a.num) - baseNum(b.num) || a.num.localeCompare(b.num))

  // ── Table de relecture ──
  console.log('\n══ TABLE DE RELECTURE ══')
  for (const r of keep) {
    console.log(
      [
        r.number.padEnd(26),
        (r.date ? r.date.toISOString().slice(0, 10) : '— DATE ? —').padEnd(12),
        `src:${r.dateFrom}`.padEnd(14),
        String(r.textLen).padStart(7) + 'c',
        (r.flags.join(',') || 'ok').padEnd(18),
        r.title.slice(0, 95),
      ].join(' | '),
    )
  }
  console.log(`\n${keep.length} documents à importer · ${dropped.length} doublons écartés · ${skipped.length} hors série · ${unrecognized.length} non reconnus`)
  if (dropped.length) console.log('Doublons écartés :\n  ' + dropped.join('\n  '))
  if (skipped.length) console.log('Hors série (non importés) :\n  ' + skipped.join('\n  '))
  if (unrecognized.length) console.log('NON RECONNUS :\n  ' + unrecognized.join('\n  '))

  // ── Plan de réconciliation (calculé toujours) puis écriture (si --commit) ──
  // ────────────────────────────────────────────────────────────────────────────
  // RÉCONCILIATION — et non purge puis recréation.
  //
  // ⚠️ Ce bloc PURGEAIT `source='BRH'` avant de tout recréer, en se disant idempotent.
  // Il ne l'était pas : recréer un document lui donne un identifiant neuf, et tout ce
  // qui pendait à l'ancien tombait avec lui. Mesuré le 17 août 2026, à la veille d'être
  // corrigé : 42 documents et **84 rattachements thématiques** — le classement sur deux
  // axes (matière et assujetti) établi d'après la taxonomie de la BRH elle-même, plusieurs
  // jours de travail — étaient détruits à CHAQUE exécution. Et demain, avec eux : les
  // notes de lecteurs, les mises en favori, les renvois croisés, les annotations.
  //
  // On apparie donc sur (numéro, intitulé) — `number` n'est PAS unique, quatre circulaires
  // portent le même numéro que leur « Note additionnelle » — et l'on met à jour le CONTENU
  // sans jamais toucher aux relations. Un document absent de la source est SIGNALÉ, non
  // supprimé : c'est à un humain de décider qu'un texte doit disparaître du fonds.
  //
  // `--purge` rétablit l'ancien comportement, à dessein et en le disant.
  // ────────────────────────────────────────────────────────────────────────────
  const cle = (n: string | null, t: string | null) => `${n ?? ''}\u0000${t ?? ''}`
  const existants = await prisma.document.findMany({
    where: { source: 'BRH' },
    select: { id: true, number: true, titleFr: true, _count: { select: { themes: true } } },
  })
  const parCle = new Map(existants.map((d) => [cle(d.number, d.titleFr), d]))

  if (purge) {
    const liens = existants.reduce((a, d) => a + d._count.themes, 0)
    console.log(`\n⚠️  --purge : suppression de ${existants.length} documents et de ${liens} rattachements thématiques.`)
    const supprimes = await prisma.document.deleteMany({ where: { source: 'BRH' } })
    await audit(
      {
        action: 'DOC_DELETED',
        targetType: 'DOCUMENT',
        meta: {
          actor: 'script:import-brh',
          reason: 'purge EXPLICITE demandée par --purge',
          source: 'BRH',
          count: supprimes.count,
          themeLinksLost: liens,
          ids: existants.map((d) => d.id),
          numbers: existants.map((d) => d.number),
        },
      },
      prisma,
    )
    parCle.clear()
  }

  // Le PLAN est calculé et affiché dans tous les cas ; seule l'écriture dépend de --commit.
  // Sans cela, on ne peut vérifier l'appariement qu'en écrivant — c'est-à-dire trop tard.
  let created = 0
  let updated = 0
  let inchanges = 0
  for (const r of keep) {
    const contenu = {
      titleFr: r.title,
      bodyOriginal: r.body,
      publicationDate: r.date,
      searchText: buildSearchText({ titleFr: r.title, number: r.number, bodyOriginal: r.body, matiere: 'Droit bancaire' }),
    }
    const dejaLa = parCle.get(cle(r.number, r.title))
    if (dejaLa) {
      // Mise à jour du CONTENU seulement. On ne touche ni au statut éditorial, ni au
      // sceau, ni aux thèmes, ni à quoi que ce soit qui ait été posé à la main.
      const av = await prisma.document.findUnique({ where: { id: dejaLa.id }, select: { bodyOriginal: true, titleFr: true } })
      if (av?.bodyOriginal === r.body && av?.titleFr === r.title) inchanges++
      else {
        if (commit) await prisma.document.update({ where: { id: dejaLa.id }, data: contenu })
        updated++
      }
      parCle.delete(cle(r.number, r.title))
      continue
    }
    if (commit) {
      await prisma.document.create({
        data: {
          type: 'CIRCULAIRE_BRH',
          status: 'EN_VIGUEUR',
          number: r.number,
          matiere: 'Droit bancaire',
          source: 'BRH',
          sealed: true,
          ...contenu,
        },
      })
    }
    created++
    if (!commit) console.log(`      + ${String(r.number).padEnd(28)} ${String(r.title).slice(0, 66)}`)
  }

  console.log(`\n${commit ? 'Réconciliation' : 'PLAN (aucune écriture)'} : ${created} à créer · ${updated} à mettre à jour · ${inchanges} inchangés`)
  if (!commit && created > 5) {
    console.log(`\n   ⚠️  ${created} créations pour ${keep.length} documents en source : si vous attendiez des mises`)
    console.log('      à jour, l\'appariement (numéro + intitulé) a changé — vérifiez AVANT de lancer --commit,')
    console.log('      sinon vous obtiendrez des doublons.')
  }
  if (parCle.size > 0) {
    console.log(`\n⚠️  ${parCle.size} document(s) en base SANS correspondance dans la source — NON supprimés :`)
    for (const d of parCle.values()) console.log(`      ${String(d.number).padEnd(30)} ${String(d.titleFr).slice(0, 60)}`)
    console.log('   Les retirer est une décision éditoriale : le faire à la main, ou relancer avec --purge.')
  }

  if (!commit) {
    console.log('\n(Simulation — rien n\'a été écrit. Relire le plan et la table, compléter MANUAL_FIXES,')
    console.log(' puis relancer avec --commit.)')
    await prisma.$disconnect()
    return
  }

  // ── Versions HTML pérennisées (réserves obligatoires) ──────────────────────────
  // Enrichissements bodyClean + richBlocksJson (tableaux de coefficients) générés
  // depuis CirculaireAuxBanques.docx, RÉAPPLIQUÉS à chaque ré-import pour survivre à
  // la purge ; + 3 circulaires absentes du recueil (86-12, 86-12-A, 78-1).
  // Source de vérité : scripts/brh-enrichments.json (régénérable depuis la base).
  const enrichPath = join(process.cwd(), 'scripts', 'brh-enrichments.json')
  if (existsSync(enrichPath)) {
    const { html, supplement, status } = JSON.parse(readFileSync(enrichPath, 'utf8')) as {
      html: { number: string; bodyClean: string | null; richBlocksJson: string | null }[]
      // `source` et `annotationsJson` (facultatifs) : les circulaires au LECTEUR ANNOTÉ
      // (105-2, 117-1) ont leur propre source — elles échappent donc à la purge — mais
      // une reconstruction complète de la base les recréerait dépouillées sans ces deux
      // champs. `effective` : date d'entrée en vigueur, distincte de la publication.
      supplement: {
        number: string; title: string; date: string | null; bodyOriginal: string
        bodyClean: string | null; richBlocksJson: string | null
        source?: string; annotationsJson?: string | null; effective?: string | null
      }[]
      // Statuts éditoriaux (ex. ABROGE) + renvoi d'abrogation (abrogatedByNumber) — la
      // création remet status='PUBLIE'/abrogatedByNumber=null, donc on les RÉAPPLIQUE à
      // chaque import. Source de vérité : brh-enrichments.json.
      status?: { number: string; status: string; abrogatedByNumber?: string | null }[]
    }
    let enriched = 0
    for (const h of html) {
      const r = await prisma.document.updateMany({
        where: { type: 'CIRCULAIRE_BRH', number: h.number },
        data: { bodyClean: h.bodyClean, richBlocksJson: h.richBlocksJson },
      })
      if (r.count === 0) console.warn(`   ⚠ enrichissement non appliqué (cible absente) : ${h.number}`)
      enriched += r.count
    }
    let supp = 0
    for (const s of supplement) {
      if (await prisma.document.findFirst({ where: { type: 'CIRCULAIRE_BRH', number: s.number }, select: { id: true } })) continue
      await prisma.document.create({
        data: {
          type: 'CIRCULAIRE_BRH', status: 'EN_VIGUEUR', titleFr: s.title,
          bodyOriginal: s.bodyOriginal, bodyClean: s.bodyClean, richBlocksJson: s.richBlocksJson,
          number: s.number, publicationDate: s.date ? new Date(`${s.date}T00:00:00Z`) : null,
          effectiveDate: s.effective ? new Date(`${s.effective}T00:00:00Z`) : null,
          annotationsJson: s.annotationsJson ?? null,
          matiere: 'Droit bancaire', source: s.source ?? 'BRH', sealed: true,
          searchText: buildSearchText({
            titleFr: s.title, number: s.number, bodyOriginal: s.bodyOriginal,
            matiere: 'Droit bancaire', annotationsJson: s.annotationsJson ?? null,
          } as Parameters<typeof buildSearchText>[0]),
        },
      })
      supp++
    }
    let statusSet = 0
    for (const st of status ?? []) {
      const r = await prisma.document.updateMany({
        where: { type: 'CIRCULAIRE_BRH', number: st.number },
        data: { status: st.status, ...(st.abrogatedByNumber !== undefined ? { abrogatedByNumber: st.abrogatedByNumber } : {}) },
      })
      if (r.count === 0) console.warn(`   ⚠ statut non appliqué (cible absente) : ${st.number}`)
      statusSet += r.count
    }
    console.log(`   versions HTML réappliquées : ${enriched} enrichies · ${supp} suppléments créés · ${statusSet} statuts éditoriaux`)
  } else {
    console.warn('   ⚠ scripts/brh-enrichments.json introuvable — versions HTML NON réappliquées.')
  }

  console.log(`✅  ${created} circulaires importées.`)
}

function baseNum(num: string): number {
  return Number(num.split('-')[0])
}

// Exécuté seulement en CLI direct (npx tsx scripts/import-brh.ts …) — sinon le
// module n'expose que ses helpers (parseName, extractDate, extractSubject…),
// réutilisables sans déclencher l'import.
if (process.argv[1] && /import-brh\.ts$/.test(process.argv[1])) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(() => prisma.$disconnect())
}
