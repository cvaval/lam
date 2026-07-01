/**
 * Catalogage des fascicules scannés du Moniteur (un dossier par mois) dans le corpus Lam.
 *
 *   npx tsx scripts/import-moniteur-pdf.ts --dir "<dossier ANNÉE>" --year 2021 [--commit] [--purge-demo]
 *
 * Sans --commit : inventaire seul (table de relecture, aucun écrit).
 * Avec --commit  : purge la source MONITEUR_PDF_{year} puis recrée (idempotent).
 * Avec --purge-demo : supprime d'abord les documents de démonstration (source=SEED
 *                     + décret CMS LM2025-SP55), avec journal d'audit DOC_DELETED.
 *
 * Les PDF sont des SCANS (pas de couche texte) : on catalogue l'édition (numéro,
 * type régulière/spéciale, mois, nb pages, chemin du PDF). Le texte intégral et
 * l'extraction des actes/sociétés se font ensuite par édition (OCR à la demande)
 * ou en lot quand le quota IA le permet — voir UploadStudio / scripts d'OCR.
 */
import { readdirSync, statSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PDFDocument } from 'pdf-lib'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

const MONTHS: Record<string, number> = {
  JANVIER: 0, 'FÉVRIER': 1, FEVRIER: 1, MARS: 2, AVRIL: 3, MAI: 4, JUIN: 5,
  JUILLET: 6, 'AOÛT': 7, AOUT: 7, SEPTEMBRE: 8, OCTOBRE: 9, NOVEMBRE: 10, 'DÉCEMBRE': 11, DECEMBRE: 11,
}
const MONTH_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface Edition {
  special: boolean
  num: number
  suffix: string // « A » pour « Spécial No. 30-A »
  monthIdx: number
  day: number | null // jour de parution lu dans le nom de fichier (ex. « 2Avril » → 2)
  files: string[]
}

/** « Le Moniteur [Spécial] No. 30-A … » → { special, num, suffix }.
 *  NB : noms de fichiers macOS en NFD (« Spe´cial ») → normalisation NFC obligatoire. */
function parseEditionName(name: string): { special: boolean; num: number; suffix: string } | null {
  const s = name.normalize('NFC').replace(/\.pdf$/i, '')
  const special = /sp[ée]cial/i.test(s)
  const m = s.match(/No\.?\s*(\d+)\s*(?:-\s*([A-Za-z])\b)?/i)
  if (!m) return null
  return { special, num: Number(m[1]), suffix: m[2] ? m[2].toUpperCase() : '' }
}

function monthFromName(name: string): number | null {
  const up = name.normalize('NFC').toUpperCase()
  for (const [k, v] of Object.entries(MONTHS)) if (up.includes(k)) return v
  return null
}

/** « … No.44 2Avril 2026.pdf » → 2. Le jour précède le nom du mois dans le fichier
 *  (best-effort : null si absent — ex. « No.50 Avril 2026 » → date approx. au 1er). */
function dayFromName(name: string): number | null {
  const m = name
    .normalize('NFC')
    .match(/(\d{1,2})\s*(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)/i)
  if (!m) return null
  const d = Number(m[1])
  return d >= 1 && d <= 31 ? d : null
}

/** « 20190104 No 1.pdf » → { monthIdx: 0, day: 4 }. Fascicules classés « par numéro » (dossier
 *  à plat, sans nom de mois) : le mois ET le jour de parution sont dans le préfixe AAAAMMJJ. */
function dateFromName(name: string): { monthIdx: number; day: number } | null {
  const m = name.normalize('NFC').match(/^(\d{4})(\d{2})(\d{2})\b/)
  if (!m) return null
  const monthIdx = Number(m[2]) - 1
  const day = Number(m[3])
  if (monthIdx < 0 || monthIdx > 11 || day < 1 || day > 31) return null
  return { monthIdx, day }
}

function editionKey(e: { special: boolean; num: number; suffix: string }): string {
  return `${e.special ? 'SP' : 'R'}-${e.num}-${e.suffix}`
}

function editionRef(e: Edition, year: number): string {
  // Le suffixe (-A, -B…) distingue des éditions DISTINCTES du même numéro : il doit figurer
  // dans la référence des éditions RÉGULIÈRES aussi (sinon No.31, No.31-A… se collisionnent
  // toutes sur LM{year}-31). Les spéciales l'incluaient déjà.
  return e.special ? `LM${year}-SP${e.num}${e.suffix}` : `LM${year}-${e.num}${e.suffix ? `-${e.suffix}` : ''}`
}

function editionLabel(e: Edition, year: number): string {
  const month = MONTH_FR[e.monthIdx]
  if (e.special) return `Le Moniteur — Édition spéciale n° ${e.num}${e.suffix ? `-${e.suffix}` : ''} — ${month} ${year}`
  return `Le Moniteur n° ${e.num}${e.suffix ? `-${e.suffix}` : ''} — ${month} ${year}`
}

async function pageCount(file: string): Promise<number> {
  try {
    const doc = await PDFDocument.load(readFileSync(file), { ignoreEncryption: true, updateMetadata: false })
    return doc.getPageCount()
  } catch {
    return 0
  }
}

function collectEditions(dir: string): Edition[] {
  const byKey = new Map<string, Edition>()
  for (const monthEntry of readdirSync(dir)) {
    const monthPath = join(dir, monthEntry)
    if (!statSync(monthPath).isDirectory()) continue
    const monthIdx = monthFromName(monthEntry)
    if (monthIdx == null) {
      // Dossier « à plat » sans nom de mois (ex. « 2019 Moniteur par numéro », « … Numéros
      // spéciaux ») : chaque PDF porte un préfixe AAAAMMJJ → mois ET jour lus dans le fichier.
      // (Les dossiers réellement inconnus, sans PDF daté, restent ignorés avec un avertissement.)
      let dated = 0
      for (const entry of readdirSync(monthPath)) {
        if (!entry.toLowerCase().endsWith('.pdf')) continue
        const entryPath = join(monthPath, entry)
        if (statSync(entryPath).isDirectory()) continue
        const parsed = parseEditionName(entry)
        const dt = dateFromName(entry)
        if (!parsed || !dt) {
          console.warn(`⚠ fichier daté non reconnu : ${entry}`)
          continue
        }
        addEdition(byKey, { ...parsed, monthIdx: dt.monthIdx, day: dt.day, files: [realpathSync(entryPath)] })
        dated++
      }
      if (!dated) console.warn(`⚠ mois non reconnu, ignoré : ${monthEntry}`)
      continue
    }
    for (const entry of readdirSync(monthPath)) {
      const entryPath = join(monthPath, entry)
      const isDir = statSync(entryPath).isDirectory()
      if (isDir) {
        // Sous-dossier = une édition multi-parties (plusieurs PDF de pages).
        const parsed = parseEditionName(entry)
        if (!parsed) {
          console.warn(`⚠ sous-dossier non reconnu : ${entry}`)
          continue
        }
        const sub = readdirSync(entryPath).filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => realpathSync(join(entryPath, f)))
        addEdition(byKey, { ...parsed, monthIdx, day: dayFromName(sub[0] ?? entry), files: sub })
      } else if (entry.toLowerCase().endsWith('.pdf')) {
        const parsed = parseEditionName(entry)
        if (!parsed) {
          console.warn(`⚠ fichier non reconnu : ${entry}`)
          continue
        }
        addEdition(byKey, { ...parsed, monthIdx, day: dayFromName(entry), files: [realpathSync(entryPath)] })
      }
    }
  }
  return [...byKey.values()].sort(
    (a, b) => Number(a.special) - Number(b.special) || a.num - b.num || a.suffix.localeCompare(b.suffix),
  )
}

function addEdition(byKey: Map<string, Edition>, e: Edition) {
  const key = editionKey(e)
  const existing = byKey.get(key)
  if (existing) {
    existing.files.push(...e.files)
    if (existing.day == null) existing.day = e.day
  } else byKey.set(key, e)
}

async function purgeDemo(actorId: string | null) {
  const seed = await prisma.document.findMany({ where: { source: 'SEED' }, select: { id: true } })
  const demoDecret = await prisma.document.findMany({ where: { source: 'CMS', number: 'LM2025-SP55' }, select: { id: true } })
  const ids = [...seed, ...demoDecret].map((d) => d.id)
  if (!ids.length) {
    console.log('Purge démo : rien à supprimer.')
    return
  }
  await prisma.document.deleteMany({ where: { id: { in: ids } } })
  await audit({ action: 'DOC_DELETED', actorId, targetType: 'DOCUMENT', meta: { reason: 'purge démo avant import Moniteur 2021', count: ids.length, seed: seed.length, demoDecret: demoDecret.length } })
  console.log(`Purge démo : ${ids.length} documents supprimés (${seed.length} SEED + ${demoDecret.length} décret CMS), audit DOC_DELETED écrit.`)
}

async function main() {
  const args = process.argv.slice(2)
  const dir = args[args.indexOf('--dir') + 1]
  const year = Number(args[args.indexOf('--year') + 1]) || 2021
  const commit = args.includes('--commit')
  const doPurge = args.includes('--purge-demo')
  if (!dir || args.indexOf('--dir') < 0) {
    console.error('Usage: npx tsx scripts/import-moniteur-pdf.ts --dir "<dossier>" --year 2021 [--commit] [--purge-demo]')
    process.exit(1)
  }
  const SOURCE = `MONITEUR_PDF_${year}`

  const editions = collectEditions(dir)
  console.log(`\n${editions.length} éditions détectées pour ${year}.\n`)

  // Comptage des pages (best-effort) + table de relecture.
  let reg = 0
  let sp = 0
  const rows: { ref: string; type: string; month: string; pages: number; parts: number; label: string }[] = []
  for (const e of editions) {
    let pages = 0
    for (const f of e.files) pages += await pageCount(f)
    if (e.special) sp++
    else reg++
    rows.push({ ref: editionRef(e, year), type: e.special ? 'SPÉCIALE' : 'régulière', month: MONTH_FR[e.monthIdx], pages, parts: e.files.length, label: editionLabel(e, year) })
  }
  console.log('RÉFÉRENCE'.padEnd(14), 'TYPE'.padEnd(10), 'MOIS'.padEnd(11), 'PAGES'.padStart(6), ' PARTIES')
  for (const r of rows) {
    console.log(r.ref.padEnd(14), r.type.padEnd(10), r.month.padEnd(11), String(r.pages).padStart(6), '  ' + r.parts)
  }
  console.log(`\n→ ${reg} éditions régulières · ${sp} éditions spéciales · ${rows.reduce((s, r) => s + r.pages, 0)} pages au total`)

  if (!commit) {
    console.log('\n(Inventaire seul — relancer avec --commit pour écrire, et --purge-demo pour effacer la démo)')
    return
  }

  const admin = await prisma.user.findFirst({ where: { role: 'MASTER_ADMIN' }, select: { id: true } })
  if (doPurge) await purgeDemo(admin?.id ?? null)

  // Idempotent : on repart de zéro pour cette source.
  const purged = await prisma.document.deleteMany({ where: { source: SOURCE } })
  if (purged.count) console.log(`Réimport : ${purged.count} fiches ${SOURCE} précédentes supprimées.`)

  let created = 0
  for (let i = 0; i < editions.length; i++) {
    const e = editions[i]
    const r = rows[i]
    const ref = editionRef(e, year)
    const label = editionLabel(e, year)
    const moniteurRef = e.special
      ? `Le Moniteur — Édition spéciale n° ${e.num}${e.suffix ? `-${e.suffix}` : ''} de ${MONTH_FR[e.monthIdx]} ${year}`
      : `Le Moniteur n° ${e.num}${e.suffix ? `-${e.suffix}` : ''} de ${MONTH_FR[e.monthIdx]} ${year}`
    const body = `[Fascicule scanné du journal officiel « Le Moniteur » — ${r.pages || '?'} page(s)${e.files.length > 1 ? `, ${e.files.length} parties` : ''}. Texte intégral non encore océrisé : se référer au PDF source. Fichier : ${e.files.map((f) => f.split('/').pop()).join(' ; ')}]`
    await prisma.document.create({
      data: {
        // Fascicule scanné du Moniteur = source de législation → onglet
        // « Législation haïtienne » (et non l'Index Moniteur, réservé aux
        // références d'index sans PDF). Le texte intégral suit par OCR.
        type: 'LEGISLATION',
        status: 'EN_VIGUEUR',
        titleFr: label,
        bodyOriginal: body,
        number: ref,
        moniteurRef,
        // Jour lu dans le nom de fichier quand disponible (sinon 1er du mois, approx.).
        publicationDate: new Date(Date.UTC(year, e.monthIdx, e.day ?? 1)),
        editionType: e.special ? 'SPECIALE' : 'REGULIERE',
        sourcePdfUrl: e.files[0],
        source: SOURCE,
        sealed: true,
        // Année de parution dérivée (Le Moniteur, fondé en 1845 : année = millésime − 1845).
        metaJson: JSON.stringify({ edition: { anneeParution: year - 1845, directeurGeneral: null, issn: null, ville: 'Port-au-Prince' }, pages: r.pages, parts: e.files.length, dateSource: e.day != null ? 'filename' : 'approx' }),
        searchText: buildSearchText({ titleFr: label, number: ref, moniteurRef }),
      },
    })
    created++
  }
  console.log(`\n✅  ${created} fascicules ${year} catalogués (source=${SOURCE}).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
