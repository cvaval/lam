/**
 * Import des circulaires de la BRH (PDF océrisés) dans le corpus Lam.
 *
 *   npx tsx scripts/import-brh.ts --dir "<dossier>" [--commit]
 *
 * Sans --commit : inventaire seul (table de relecture, aucun écrit en base).
 * Avec --commit : purge les documents source='BRH' puis importe (idempotent).
 *
 * Volontairement heuristique + relecture humaine/IA : les titres et dates extraits
 * sont affichés pour validation ; les corrections vivent dans MANUAL_FIXES.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PDFParse } from 'pdf-parse'
import { buildSearchText } from '../src/lib/search/normalize'
import { RECUEIL_SOURCE, splitRecueil } from './recueil-reserves'
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
  // RECUEIL : ce PDF réunit ~24 textes sur les réserves obligatoires. parseName le
  // reconnaît (num du texte de tête), puis il est ÉCLATÉ en autant de lignes plus
  // bas (splitRecueil) — il ne devient jamais un Document unique.
  'CirculaireAuxBanques.pdf': { kind: 'CIRCULAIRE', num: '01-19', noteNo: null, altScan: false },
  'circulaires_maisons_transfert.pdf': { kind: 'CIRCULAIRE', num: '98', noteNo: null, altScan: true }, // n° 98 « maisons de transfert » (98_Circulaire.pdf = banques)
  // Fichier mal nommé : le texte OCR dit « NOTE ADDITIONNELLE — CIRCULAIRE 99-3 »
  // (vigilance renforcée LBC/FT), pas une Lettre-Circulaire n° 93-3.
  '93-3_Lettre-Circulaire.pdf': { kind: 'CIRCULAIRE', num: '99-3', noteNo: 1, altScan: false },
}

export function parseName(file: string): ParsedName | 'skip' | null {
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
  // (CirculaireAuxBanques.pdf : recueil éclaté par splitRecueil — titres/dates dans recueil-reserves.ts.)
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
  '106_Circulaire.pdf': { title: 'Circulaire BRH n° 106 — Constitution des réserves obligatoires sur toutes les ressources utilisées' },
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

  // Éclatement du recueil « réserves obligatoires » en ses textes constituants
  // (cf. recueil-reserves.ts). Sa ligne unique est remplacée par ~23 lignes ; on
  // clé le dédoublonnage sur le `number` complet pour ne pas fusionner avec les PDF
  // autonomes de même base (ex. le n° 87 « classification des prêts »).
  const expanded: Row[] = []
  for (const r of rows) {
    if (r.file !== RECUEIL_SOURCE) { expanded.push(r); continue }
    for (const s of splitRecueil(r.body)) {
      expanded.push({ file: r.file, kind: s.kind, num: s.number, noteNo: null, number: s.number, title: s.title, date: s.date, dateFrom: 'recueil', textLen: s.body.length, body: s.body, flags: [] })
    }
  }

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

  if (!commit) {
    console.log('\n(Inventaire seul — relire la table, compléter MANUAL_FIXES, puis relancer avec --commit)')
    return
  }

  // ── Écriture ──
  // Toute suppression de documents (a fortiori scellés) doit laisser une trace dans AuditLog.
  const toPurge = await prisma.document.findMany({
    where: { source: 'BRH' },
    select: { id: true, number: true, sealed: true },
  })
  const purged = await prisma.document.deleteMany({ where: { source: 'BRH' } })
  console.log(`\nPurge source=BRH : ${purged.count} (tracé AuditLog DOC_DELETED)`)
  if (purged.count > 0) {
    await audit(
      {
        action: 'DOC_DELETED',
        targetType: 'DOCUMENT',
        meta: {
          actor: 'script:import-brh',
          reason: 'purge avant ré-import (--commit)',
          source: 'BRH',
          count: purged.count,
          sealedCount: toPurge.filter((d) => d.sealed).length,
          ids: toPurge.map((d) => d.id),
          numbers: toPurge.map((d) => d.number),
        },
      },
      prisma,
    )
  }
  let created = 0
  for (const r of keep) {
    await prisma.document.create({
      data: {
        type: 'CIRCULAIRE_BRH',
        status: 'PUBLIE',
        titleFr: r.title,
        bodyOriginal: r.body,
        number: r.number,
        publicationDate: r.date,
        matiere: 'Droit bancaire',
        source: 'BRH',
        sealed: true,
        searchText: buildSearchText({ titleFr: r.title, number: r.number, bodyOriginal: r.body, matiere: 'Droit bancaire' }),
      },
    })
    created++
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
