/**
 * Import des Lois de finances (budget de l'État) dans le corpus Lam — type
 * LOI_FINANCES, texte intégral. Exercice fiscal = 1er octobre → 30 septembre de
 * l'année suivante ; fichiers nommés « {début}-{fin}[ _rectificative ].pdf ».
 *
 *   npx tsx scripts/import-lois-finances.ts --dir "<dossier>" [--commit]
 *
 * Sans --commit : table de relecture (métadonnées analysées, aucun écrit).
 * Avec --commit  : purge la source LOIS_FINANCES puis recrée (idempotent).
 *
 * Les PDF « Clean » ont déjà une couche texte (OCR) → bodyOriginal = texte intégral.
 * Métadonnées extraites de la 1re page : date de publication, année de parution,
 * référence « Spécial n° X » du Moniteur, nature (Loi/Décret). fiscalYear = année
 * de DÉBUT de l'exercice.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PDFParse } from 'pdf-parse'
import { cleanOcrText } from '../src/lib/ai/extract'
import { buildSearchText } from '../src/lib/search/normalize'
import { joinKeywords, heuristicKeywords } from '../src/lib/ai/keywords'

const prisma = new PrismaClient()
const SOURCE = 'LOIS_FINANCES'

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
}

interface ParsedFile {
  start: number
  end: number
  rectificative: boolean
  tome: string | null
  file: string
}

/** « 2007-2008_rectificative.pdf », « 2009_2010_rectificatif.pdf », « 2009-2010_Tome-I.pdf »,
 *  « Loi de Finance 2025-2026.pdf » (mode --file). La plage d'années peut figurer n'importe où. */
function parseFileName(name: string): ParsedFile | null {
  const m = name.match(/(\d{4})[-_](\d{4})/)
  if (!m) return null
  const lower = name.toLowerCase()
  const tomeM = name.match(/tome[-_\s]*([IVX0-9]+)/i)
  return {
    start: Number(m[1]),
    end: Number(m[2]),
    rectificative: /rectif/.test(lower),
    tome: tomeM ? tomeM[1].toUpperCase() : null,
    file: name,
  }
}

function extractDate(text: string): string | null {
  const head = text.slice(0, 4000).replace(/\s+/g, ' ')
  const m = head.match(/(\d{1,2})(?:er)?\s+([A-Za-zûéèà]+)\s+(\d{4})/)
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()]
    const y = Number(m[3])
    if (mo && y >= 2004 && y <= 2030) return `${y}-${String(mo).padStart(2, '0')}-${String(Number(m[1])).padStart(2, '0')}`
  }
  return null
}

function extractMoniteurRef(text: string): { annee: number | null; special: string | null } {
  const head = text.slice(0, 3000)
  const an = head.match(/(\d{2,3})\s*[èeé]?\s*me?\s*Ann[ée]e/i)
  const sp = head.match(/Sp[ée]cial\s*N?[o°.]*\s*(\d+)/i)
  return { annee: an ? Number(an[1]) : null, special: sp ? sp[1] : null }
}

function natureFromText(text: string): 'Loi' | 'Décret' {
  const head = text.slice(0, 2500).toUpperCase()
  // L'instrument figure dans le sommaire / titre (« DÉCRET ÉTABLISSANT LE BUDGET »
  // ou « LOI DE FINANCES »).
  const decret = head.indexOf('DÉCRET') >= 0 || head.indexOf('DECRET') >= 0
  const loi = head.search(/\bLOI\b/) >= 0
  if (decret && (!loi || head.indexOf('DÉCRET') < head.search(/\bLOI\b/))) return 'Décret'
  return 'Loi'
}

// Plafond du texte stocké/affiché : les budgets détaillés (annexes ministère par
// ministère) peuvent faire des milliers de pages → on garde le décret + les tableaux
// de tête (le PDF source reste lié pour le détail intégral). 600k ≈ la plus grosse
// loi déjà importée (442k) avec marge.
const MAX_BODY = 600_000
const MAX_PAGES_READ = 300 // borne l'extraction sur les très gros fascicules

async function fullText(path: string): Promise<{ text: string; pages: number; truncated: boolean }> {
  const parser = new PDFParse({ data: new Uint8Array(readFileSync(path)) })
  try {
    const r = await parser.getText({ first: MAX_PAGES_READ })
    let text = cleanOcrText(r.text ?? '')
    const truncated = text.length > MAX_BODY || r.pages.length >= MAX_PAGES_READ
    if (text.length > MAX_BODY) text = text.slice(0, MAX_BODY)
    if (truncated) {
      text +=
        '\n\n[…] [Texte tronqué à des fins d\'affichage — le budget détaillé complet (tableaux par ministère) figure dans le PDF source officiel.]'
    }
    return { text, pages: r.pages.length, truncated }
  } finally {
    await parser.destroy()
  }
}

interface Row extends ParsedFile {
  path: string
  title: string
  number: string
  date: string | null
  annee: number | null
  special: string | null
  nature: string
  pages: number
  chars: number
  body: string
}

async function main() {
  const args = process.argv.slice(2)
  const dir = args.indexOf('--dir') >= 0 ? args[args.indexOf('--dir') + 1] : null
  const file = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null
  const commit = args.includes('--commit')
  if (!dir && !file) {
    console.error('Usage: import-lois-finances.ts (--dir "<dossier>" | --file "<fichier.pdf>") [--commit]')
    process.exit(1)
  }

  // Liste des chemins absolus à traiter : tout le dossier, ou un fichier unique.
  const paths = dir
    ? readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf')).sort().map((f) => join(dir, f))
    : [file!]
  const rows: Row[] = []

  for (const path of paths) {
    const base = path.split('/').pop()!
    const p = parseFileName(base)
    if (!p) {
      console.warn(`⚠ nom non reconnu : ${base}`)
      continue
    }
    const { text, pages } = await fullText(path)
    const date = extractDate(text)
    const { annee, special } = extractMoniteurRef(text)
    const nature = natureFromText(text)
    const exercice = `${p.start}-${p.end}`
    const title =
      `Loi de finances${p.rectificative ? ' rectificative' : ''} de l'exercice ${exercice}` +
      (p.tome ? ` — Tome ${p.tome}` : '')
    const number = `LF${exercice}${p.rectificative ? '-R' : ''}${p.tome ? `-T${p.tome}` : ''}`
    rows.push({ ...p, path, title, number, date, annee, special, nature, pages, chars: text.length, body: text })
  }

  rows.sort((a, b) => a.start - b.start || Number(a.rectificative) - Number(b.rectificative))

  console.log('\n══ TABLE DE RELECTURE ══')
  console.log('RÉFÉRENCE'.padEnd(16), 'EXERCICE'.padEnd(10), 'TYPE'.padEnd(13), 'NATURE'.padEnd(8), 'DATE'.padEnd(11), 'MONITEUR'.padEnd(18), 'PAGES')
  for (const r of rows) {
    const moniteur = `${r.annee ?? '?'}e A. Sp.${r.special ?? '?'}`
    console.log(
      r.number.padEnd(16),
      `${r.start}-${r.end}`.padEnd(10),
      (r.rectificative ? 'rectificative' : 'régulière').padEnd(13),
      r.nature.padEnd(8),
      (r.date ?? '— ? —').padEnd(11),
      moniteur.padEnd(18),
      r.pages,
    )
  }
  const reg = rows.filter((r) => !r.rectificative).length
  console.log(`\n→ ${reg} lois régulières · ${rows.length - reg} rectificatives · ${rows.length} documents`)

  if (!commit) {
    console.log('\n(Inventaire seul — relancer avec --commit pour écrire)')
    return
  }

  const admin = await prisma.user.findFirst({ where: { role: 'MASTER_ADMIN' }, select: { id: true } })
  if (dir) {
    // Mode dossier : on repart de zéro pour toute la source (idempotent).
    const purged = await prisma.document.deleteMany({ where: { source: SOURCE } })
    if (purged.count) console.log(`Réimport : ${purged.count} fiches ${SOURCE} précédentes supprimées.`)
  } else {
    // Mode fichier : upsert ciblé — ne supprime que les numéros importés.
    const nums = rows.map((r) => r.number)
    const purged = await prisma.document.deleteMany({ where: { source: SOURCE, number: { in: nums } } })
    if (purged.count) console.log(`Upsert : ${purged.count} fiche(s) existante(s) remplacée(s).`)
  }

  let created = 0
  for (const r of rows) {
    const moniteurRef = r.annee
      ? `Le Moniteur — ${r.annee}ᵉ Année${r.special ? `, Spécial n° ${r.special}` : ''}`
      : null
    const summaryFr =
      `${r.nature === 'Décret' ? 'Décret' : 'Loi'} de finances${r.rectificative ? ' rectificative' : ''} fixant le budget général de la République d'Haïti pour l'exercice ${r.start}-${r.end} (1er octobre ${r.start} – 30 septembre ${r.end}).`
    const keywords = joinKeywords(
      heuristicKeywords({ titleFr: r.title, matiere: 'Finances publiques ; budget', body: r.body.slice(0, 4000) }),
    )
    await prisma.document.create({
      data: {
        type: 'LOI_FINANCES',
        status: 'EN_VIGUEUR',
        titleFr: r.title,
        bodyOriginal: r.body,
        summaryFr,
        number: r.number,
        fiscalYear: r.start, // année de début de l'exercice
        publicationDate: r.date ? new Date(`${r.date}T00:00:00Z`) : null,
        moniteurRef,
        matiere: 'Finances publiques',
        keywords,
        source: SOURCE,
        sealed: true,
        sourcePdfUrl: r.path,
        searchText: buildSearchText({ titleFr: r.title, number: r.number, moniteurRef, summaryFr, keywords, bodyOriginal: r.body }),
      },
    })
    created++
  }
  console.log(`\n✅  ${created} lois de finances importées (source=${SOURCE}).`) // eslint-disable-line
  if (admin) void admin
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
