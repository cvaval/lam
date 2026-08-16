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
 * On catalogue l'édition : numéro, type régulière/spéciale, mois, nb pages, chemin du PDF.
 *
 * ⚠️ LA COUCHE TEXTE NE SE SUPPOSE PAS, ELLE SE MESURE. Les fascicules 2016-2026 étaient
 * des scans nus ; ceux de 1991-2000 sortent du *Paper Capture* d'Acrobat et portent déjà
 * 2 600 caractères par page. Le script lit donc chaque PDF : s'il y trouve du texte, il
 * le verse dans `searchText` — le fascicule devient cherchable sans un centime d'OCR.
 * S'il n'en trouve pas, il catalogue comme avant et l'OCR reste à faire.
 *
 * ⚠️ CE TEXTE EST CHERCHABLE, IL N'EST PAS CITABLE. De l'OCR sur microfilm rend
 * « JOU.RNAL OFFICJEL » et « No. 30047l » pour un n° 1. Il alimente l'index (`searchText`,
 * jamais affiché) et NON `bodyOriginal` : un texte montré est un texte qu'on cite, et
 * c'est le fac-similé qui fait foi.
 */
import { readdirSync, statSync, readFileSync, realpathSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, basename } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { PDFDocument } from 'pdf-lib'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

/**
 * Fascicules ÉCARTÉS du versement, avec le motif.
 *
 * ⚠️ UN FASCICULE INCOMPLET EST PIRE QU'UN FASCICULE ABSENT. Une fiche en base est une
 * fiche que la recherche rend : un lecteur qui l'ouvre croit tenir le numéro entier, et
 * rien à l'écran ne lui dirait qu'il manque six pages. L'absence, elle, se voit — le numéro
 * ne répond pas, et l'on sait qu'il faut le chercher ailleurs.
 *
 * ⚠️ L'EXCLUSION SE DIT, ELLE NE SE DEVINE PAS. Le script imprime ce qu'il écarte et
 * pourquoi, à chaque exécution : une liste noire muette finirait par écarter des fascicules
 * dont plus personne ne saurait la raison.
 */
const FASCICULES_ECARTES: { fichier: string; raison: string }[] = [
  {
    fichier: '20000234 No 16.pdf',
    raison:
      'numérisation incomplète — 10 pages présentes pour 16 annoncées (« pages 255 à 270 »), ' +
      'sans manchette, le texte commence en milieu de phrase. Date du nom de fichier erronée ' +
      '(le 34 février) ; le fascicule est du jeudi 24 février 2000.',
  },
  // ⚠️ CES DEUX-LÀ SE DÉNONCENT EUX-MÊMES : l'archiviste a porté la lacune EN TÊTE du
  // scan, à la main. C'est le signal le plus sûr qui soit — bien plus qu'un décompte de
  // pages — et il n'y en a aucun dans toute l'année 1991.
  { fichier: '19920106 No 1.pdf', raison: 'lacune annotée sur le scan : « Manque page 6, 7 et 8 »' },
  { fichier: '19920109 No 2.pdf', raison: 'lacune annotée sur le scan : « Manque page 17 et 18 »' },
  { fichier: '19900430 No 40-A.pdf', raison: 'lacune annotée sur le scan : « Manque page III »' },
  { fichier: '19890512 No 38-B.pdf', raison: 'lacune annotée : « Manque les pages : II à Xvii ; IX et X ; XXIX et XXX »' },
  { fichier: '19890615 No 45-B.pdf', raison: 'lacune annotée : « Manque pages II à V »' },
  {
    fichier: '19890706 No 51 et 51A.pdf',
    raison:
      'DOUBLON — re-scan des n° 51 et 51-A réunis (8 + 16 = 24 pages, l’arithmétique le dit), ' +
      'quand les deux existent déjà séparément et correctement nommés. Le verser ferait paraître ' +
      'deux fois le même contenu et transformerait le n° 51 en édition de 32 pages.',
  },
]

/**
 * Fascicules dont le NOM DE FICHIER ment, et que la première page dément.
 *
 * ⚠️ LE DOCUMENT FAIT FOI, PAS SON NOM. « 20000811 No 4 Sup.pdf » porte en manchette
 * « Supplément du Spécial No. 2 » : lu par son nom, il devenait le n° 4 ordinaire — celui
 * du 13 janvier — et les deux se fondaient en UNE édition de deux parties, à quatre mois
 * d'écart. Rien ne l'aurait montré : la fiche eût simplement compté deux PDF.
 */
const FASCICULES_RECTIFIES: Record<string, { special: boolean; num: number; suffix: string; motif: string }> = {
  '20000811 No 2 Sup.pdf': {
    special: true, num: 2, suffix: '',
    motif: 'la manchette dit « Spécial No. 2 — Vendredi 11 Août 2000 » (proclamation des résultats définitifs des élections)',
  },
  '20000811 No 4 Sup.pdf': {
    special: true, num: 2, suffix: 'SUP',
    motif: 'la manchette dit « Supplément du Spécial No. 2 » — le « 4 » du nom de fichier ne correspond à rien',
  },
}

const MONTHS: Record<string, number> = {
  JANVIER: 0, 'FÉVRIER': 1, FEVRIER: 1, MARS: 2, AVRIL: 3, MAI: 4, JUIN: 5,
  JUILLET: 6, 'AOÛT': 7, AOUT: 7, SEPTEMBRE: 8, OCTOBRE: 9, NOVEMBRE: 10, 'DÉCEMBRE': 11, DECEMBRE: 11,
}
const MONTH_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

interface Edition {
  special: boolean
  num: number
  /** Second numéro d'un fascicule double (« No 76+77 » → 77). */
  num2: number | null
  suffix: string // « A » pour « Spécial No. 30-A »
  monthIdx: number
  day: number | null // jour de parution lu dans le nom de fichier (ex. « 2Avril » → 2)
  files: string[]
}

/** « Le Moniteur [Spécial] No. 30-A … » → { special, num, suffix }.
 *  NB : noms de fichiers macOS en NFD (« Spe´cial ») → normalisation NFC obligatoire. */
function parseEditionName(name: string): { special: boolean; num: number; num2: number | null; suffix: string } | null {
  const rectifie = FASCICULES_RECTIFIES[name.normalize('NFC')]
  if (rectifie) {
    rectifies.push(`${name} → ${rectifie.special ? 'SPÉCIALE' : 'régulière'} n° ${rectifie.num}${rectifie.suffix ? `-${rectifie.suffix}` : ''} — ${rectifie.motif}`)
    return { special: rectifie.special, num: rectifie.num, num2: null, suffix: rectifie.suffix }
  }
  const s = name.normalize('NFC').replace(/\.pdf$/i, '')
  const special = /sp[ée]cial/i.test(s)
  // ⚠️ « No 76+77 » EST UN SEUL FASCICULE PORTANT DEUX NUMÉROS. Ne lire que le premier
  // faisait disparaître le second : le n° 77 de 1991 n'existait pas, alors que le
  // fascicule était en base sous un autre numéro — et rien ne le signalait.
  //
  // ⚠️ ET LE LIEN S'ÉCRIT DE TROIS FAÇONS. 1991 « No 76+77 », 1992-1993 « No 105 & 106 »,
  // 1994 « No 73 74 » — un simple espace. Les fascicules disent tous la même chose :
  // « Nos. 73 et 74, Lundi 19 et jeudi 22 septembre ». Un analyseur qui ne connaîtrait que
  // le « + » aurait perdu six numéros de 1992-1993 et le n° 74 de 1994.
  const m = s.match(/No\.?s?\s*(\d+)\s*(?:[+&]\s*(\d+))?\s*(?:-\s*([A-Za-z])\b)?/i)
  if (!m) return null
  const num = Number(m[1])
  let num2 = m[2] ? Number(m[2]) : null
  // ⚠️ L'ESPACE EST UN SÉPARATEUR AMBIGU, ET LA CONSÉCUTIVITÉ EST CE QUI LE DÉSAMBIGUÏSE.
  // Les dossiers 2016-2026 écrivent « No.44 2Avril 2026 » : le jour SUIT le numéro, séparé
  // par un espace lui aussi. Lire « 44 2 » comme un double transformerait le n° 44 d'avril
  // 2026 en « n° 44 et 2 » — un fascicule qui n'a jamais existé. Un fascicule double porte
  // TOUJOURS deux numéros consécutifs ; on n'accepte donc l'espace qu'à cette condition.
  if (num2 == null) {
    const esp = /No\.?s?\s*\d+\s+(\d+)(?![^\s])/i.exec(s)
    if (esp && Number(esp[1]) === num + 1) num2 = Number(esp[1])
  }
  return { special, num, num2, suffix: m[3] ? m[3].toUpperCase() : '' }
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

function editionKey(e: { special: boolean; num: number; num2: number | null; suffix: string }): string {
  return `${e.special ? 'SP' : 'R'}-${e.num}${e.num2 ? `+${e.num2}` : ''}-${e.suffix}`
}

/** « 76 » ou « 76+77 » — la partie numérique de la référence. */
function numLabel(e: Edition): string {
  return `${e.num}${e.num2 ? `+${e.num2}` : ''}${e.suffix ? `-${e.suffix}` : ''}`
}

function editionRef(e: Edition, year: number): string {
  // Le suffixe (-A, -B…) distingue des éditions DISTINCTES du même numéro : il doit figurer
  // dans la référence des éditions RÉGULIÈRES aussi (sinon No.31, No.31-A… se collisionnent
  // toutes sur LM{year}-31). Les spéciales l'incluaient déjà.
  return e.special ? `LM${year}-SP${numLabel(e)}` : `LM${year}-${numLabel(e)}`
}

function editionLabel(e: Edition, year: number): string {
  const month = MONTH_FR[e.monthIdx]
  // ⚠️ « n° 76 et 77 », NON « n° 76+77 ». PostgreSQL découpe « 76+77 » en jetons « -76 » et
  // « +77 » : chercher « 77 » ne trouvait RIEN. Écrit « 76 et 77 », chaque numéro devient
  // un jeton à lui seul et le fascicule se trouve par l'un comme par l'autre (vérifié).
  const num = `${e.num}${e.num2 ? ` et ${e.num2}` : ''}${e.suffix ? `-${e.suffix}` : ''}`
  if (e.special) return `Le Moniteur — Édition spéciale n° ${num} — ${month} ${year}`
  return `Le Moniteur n° ${num} — ${month} ${year}`
}

/**
 * Texte déjà présent dans le PDF (couche OCR d'archivage). Rend '' quand il n'y en a pas —
 * le fascicule est alors catalogué sans texte, comme avant, et l'OCR reste à faire.
 *
 * `pdftotext` fait partie de Poppler ; son absence n'est pas une erreur d'import, seulement
 * une occasion manquée : on le signale une fois et l'on continue.
 */
let pdftotextAbsent = false
function pdfText(file: string): string {
  if (pdftotextAbsent) return ''
  try {
    return execFileSync('pdftotext', ['-q', file, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') {
      pdftotextAbsent = true
      console.warn('⚠ pdftotext introuvable (Poppler) : les fascicules seront catalogués SANS texte.')
    }
    return ''
  }
}

/** Millésimes rencontrés dans les noms de fichiers — garde-fou du §3a. */
function anneesDesFichiers(editions: Edition[]): Set<number> {
  const out = new Set<number>()
  for (const e of editions) {
    for (const f of e.files) {
      const m = basename(f).match(/^(\d{4})\d{4}\b/)
      if (m) out.add(Number(m[1]))
    }
  }
  return out
}

async function pageCount(file: string): Promise<number> {
  try {
    const doc = await PDFDocument.load(readFileSync(file), { ignoreEncryption: true, updateMetadata: false })
    return doc.getPageCount()
  } catch {
    return 0
  }
}

/** Motif d'exclusion d'un fichier, ou null s'il doit être versé. */
const ecartes: string[] = []
const rectifies: string[] = []
const fusionsSuspectes: string[] = []
function motifExclusion(entry: string, exclusionsCli: string[]): string | null {
  const nom = entry.normalize('NFC')
  const connu = FASCICULES_ECARTES.find((x) => x.fichier.normalize('NFC') === nom)
  if (connu) return connu.raison
  const cli = exclusionsCli.find((m) => nom.includes(m))
  return cli ? `écarté par --exclure "${cli}"` : null
}

let EXCLUSIONS_CLI: string[] = []

/** Lit les PDF posés DIRECTEMENT dans un dossier (nommés « AAAAMMJJ No N.pdf »). */
function collectFlat(byKey: Map<string, Edition>, dossier: string): number {
  let lus = 0
  for (const entry of readdirSync(dossier)) {
    if (!entry.toLowerCase().endsWith('.pdf')) continue
    const entryPath = join(dossier, entry)
    if (statSync(entryPath).isDirectory()) continue
    const motif = motifExclusion(entry, EXCLUSIONS_CLI)
    if (motif) {
      ecartes.push(`${entry} — ${motif}`)
      continue
    }
    const parsed = parseEditionName(entry)
    const dt = dateFromName(entry)
    if (!parsed || !dt) {
      console.warn(`⚠ fichier daté non reconnu : ${entry}`)
      continue
    }
    addEdition(byKey, { ...parsed, monthIdx: dt.monthIdx, day: dt.day, files: [realpathSync(entryPath)] })
    lus++
  }
  return lus
}

function collectEditions(dir: string): Edition[] {
  const byKey = new Map<string, Edition>()

  // ⚠️ UN DOSSIER PLAT NE DOIT PAS RENDRE LE SCRIPT AVEUGLE. La boucle ci-dessous n'ouvre
  // que les SOUS-DOSSIERS : pointée sur « 1991 par numéro », qui contient ses 124 PDF à
  // même la racine, elle ne trouvait rien — et le disait par un simple « 0 édition ».
  // Contourner en pointant le dossier parent était pire : il contient dix millésimes, que
  // le script aurait tous versés sous une seule année, SANS ERREUR.
  const platDirect = collectFlat(byKey, dir)
  if (platDirect) {
    console.log(`Dossier plat : ${platDirect} PDF lus directement dans --dir.`)
    return [...byKey.values()].sort(
      (a, b) => Number(a.special) - Number(b.special) || a.num - b.num || a.suffix.localeCompare(b.suffix),
    )
  }

  for (const monthEntry of readdirSync(dir)) {
    const monthPath = join(dir, monthEntry)
    if (!statSync(monthPath).isDirectory()) continue
    const monthIdx = monthFromName(monthEntry)
    if (monthIdx == null) {
      // Dossier « à plat » sans nom de mois (ex. « 2019 Moniteur par numéro », « … Numéros
      // spéciaux ») : chaque PDF porte un préfixe AAAAMMJJ → mois ET jour lus dans le fichier.
      // (Les dossiers réellement inconnus, sans PDF daté, restent ignorés avec un avertissement.)
      const dated = collectFlat(byKey, monthPath)
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
        const motif = motifExclusion(entry, EXCLUSIONS_CLI)
        if (motif) {
          ecartes.push(`${entry} — ${motif}`)
          continue
        }
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
    // ⚠️ DEUX PDF DU MÊME NUMÉRO NE SONT UNE ÉDITION EN DEUX PARTIES QUE S'ILS PARAISSENT
    // LE MÊME JOUR. Sinon, ce sont deux documents distincts qu'un nom de fichier trompeur
    // rapproche — et les fondre les rend tous deux inconsultables, sans le dire.
    // ⚠️ DANS UN DOSSIER PLAT, TOUTE FUSION EST SUSPECTE. Une édition en plusieurs parties
    // vient d'un SOUS-DOSSIER (convention 2016-2026) ; ici, deux fichiers qui partagent une
    // clé sont soit deux jours confondus par un nom trompeur, soit un doublon — comme
    // « No 51 et 51A », re-scan des n° 51 et 51-A réunis alors que les deux existent déjà.
    // Le premier cas se voyait aux dates ; le second, du même jour, passait inaperçu.
    fusionsSuspectes.push(
      `${editionRef(e, 0).replace('LM0-', 'n° ')} : ${existing.files.map((f) => f.split('/').pop()).join(', ')} ` +
        `(${existing.day}/${existing.monthIdx + 1}) et ${e.files.map((f) => f.split('/').pop()).join(', ')} (${e.day}/${e.monthIdx + 1})`,
    )
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
  // `--exclure "<fragment de nom>"`, répétable : écarte un fascicule pour cette exécution.
  EXCLUSIONS_CLI = args.map((a, i) => (a === '--exclure' ? args[i + 1] : null)).filter((x): x is string => !!x)
  const doPurge = args.includes('--purge-demo')
  if (!dir || args.indexOf('--dir') < 0) {
    console.error('Usage: npx tsx scripts/import-moniteur-pdf.ts --dir "<dossier>" --year 2021 [--commit] [--force] [--purge-demo]')
    process.exit(1)
  }
  const SOURCE = `MONITEUR_PDF_${year}`

  const editions = collectEditions(dir)
  if (rectifies.length) {
    console.log(`\n✎ ${rectifies.length} fascicule(s) RECTIFIÉ(S) — le document dément son nom de fichier :`)
    for (const r of rectifies) console.log(`   ${r}`)
  }
  if (fusionsSuspectes.length) {
    console.error(`\n⛔ ARRÊT — ${fusionsSuspectes.length} fusion(s) suspecte(s) : même numéro, JOURS DIFFÉRENTS.`)
    for (const f of fusionsSuspectes) console.error(`   ${f}`)
    console.error("   Dans un dossier plat, deux fichiers de même numéro sont un doublon ou une erreur de nom :")
    console.error('   les rectifier (FASCICULES_RECTIFIES) ou en écarter un (FASCICULES_ECARTES).')
    process.exit(1)
  }
  if (ecartes.length) {
    console.log(`\n⛔ ${ecartes.length} fascicule(s) ÉCARTÉ(S) — non versés :`)
    for (const e of ecartes) console.log(`   ${e}`)
  }
  console.log(`\n${editions.length} éditions détectées pour ${year}.\n`)

  // ⚠️ UNE ANNÉE À LA FOIS. Pointé sur un dossier qui en contient plusieurs, le script
  // daterait tous les fascicules de `--year` et les rangerait sous une seule source : dix
  // millésimes écrasés en un, sans une ligne d'erreur. On refuse plutôt que de réussir.
  const annees = anneesDesFichiers(editions)
  const etrangeres = [...annees].filter((a) => a !== year).sort()
  if (etrangeres.length) {
    console.error(
      `\n⛔ ARRÊT — le dossier mêle plusieurs millésimes : ${[...annees].sort().join(', ')}.\n` +
        `   --year vaut ${year} ; les fascicules de ${etrangeres.join(', ')} seraient datés à tort.\n` +
        `   Relancer une année à la fois, en pointant --dir sur son dossier.`,
    )
    process.exit(1)
  }

  // Comptage des pages (best-effort) + table de relecture.
  let reg = 0
  let sp = 0
  const rows: { ref: string; type: string; month: string; pages: number; parts: number; label: string; texte: string }[] = []
  for (const e of editions) {
    let pages = 0
    for (const f of e.files) pages += await pageCount(f)
    if (e.special) sp++
    else reg++
    const texte = e.files.map(pdfText).join('\n').replace(/\s+/g, ' ').trim()
    rows.push({ ref: editionRef(e, year), type: e.special ? 'SPÉCIALE' : 'régulière', month: MONTH_FR[e.monthIdx], pages, parts: e.files.length, label: editionLabel(e, year), texte })
  }
  console.log('RÉFÉRENCE'.padEnd(16), 'TYPE'.padEnd(10), 'DATE'.padEnd(11), 'PAGES'.padStart(6), 'PARTIES', 'TEXTE')
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const e = editions[i]
    const date = `${String(e.day ?? 1).padStart(2, '0')} ${MONTH_FR[e.monthIdx].slice(0, 4)}`
    console.log(r.ref.padEnd(16), r.type.padEnd(10), date.padEnd(11), String(r.pages).padStart(6), String(r.parts).padStart(7), `  ${r.texte.length ? `${(r.texte.length / 1000).toFixed(1)} k` : '—'}`)
  }
  const avecTexte = rows.filter((r) => r.texte.length > 200 * Math.max(r.pages, 1))
  console.log(`\n→ ${reg} éditions régulières · ${sp} éditions spéciales · ${rows.reduce((s, r) => s + r.pages, 0)} pages au total`)
  console.log(`→ couche texte exploitable : ${avecTexte.length}/${rows.length} fascicules · ${(rows.reduce((s, r) => s + r.texte.length, 0) / 1e6).toFixed(2)} M caractères`)

  // ⚠️ UN COMPTE NE DIT PAS LESQUELS. Un fascicule sans couche OCR est COMPLET — le
  // fac-similé se lit — mais il reste introuvable par son contenu : seuls son numéro, son
  // titre et sa date le désignent. Il se verse quand même, et il se NOMME, pour que la
  // rédaction sache exactement ce qui attend un océrisage.
  const sansTexte = rows.filter((r) => r.texte.length <= 200 * Math.max(r.pages, 1))
  if (sansTexte.length) {
    console.log(`\n⚠ ${sansTexte.length} fascicule(s) SANS couche texte — versés, mais cherchables par leur seule référence :`)
    for (const r of sansTexte) {
      console.log(`   ${r.ref.padEnd(16)} ${String(r.pages).padStart(3)} p. · ${r.texte.length} c.`)
    }
  }

  // Les références doivent être DISTINCTES : c'est la collision de suffixe qui a laissé
  // 22 numéros dupliqués en 2025. On le voit ici, avant d'écrire.
  const refs = rows.map((r) => r.ref)
  const collisions = refs.filter((r, i) => refs.indexOf(r) !== i)
  if (collisions.length) {
    console.error(`\n⛔ ARRÊT — références en double : ${[...new Set(collisions)].join(', ')}`)
    process.exit(1)
  }

  if (!commit) {
    console.log('\n(Inventaire seul — relancer avec --commit pour écrire, et --purge-demo pour effacer la démo)')
    return
  }

  const admin = await prisma.user.findFirst({ where: { role: 'MASTER_ADMIN' }, select: { id: true } })
  if (doPurge) await purgeDemo(admin?.id ?? null)

  // ⚠️ `--commit` REPART DE ZÉRO POUR CETTE SOURCE. Idempotent au premier versement,
  // destructeur au second : toute correction éditoriale — date rectifiée, titre amendé,
  // rattachement thématique — serait emportée par un ré-import lancé « pour ne rien
  // changer ». On ne purge donc une source EXISTANTE que sur demande explicite.
  const dejaLa = await prisma.document.count({ where: { source: SOURCE } })
  if (dejaLa && !args.includes('--force')) {
    console.error(
      `\n⛔ ARRÊT — ${dejaLa} fiches existent déjà sous ${SOURCE}.\n` +
        `   Les réécrire effacerait toute correction éditoriale portée depuis le versement.\n` +
        `   Ajouter --force pour purger et recréer en connaissance de cause.`,
    )
    process.exit(1)
  }
  const purged = await prisma.document.deleteMany({ where: { source: SOURCE } })
  if (purged.count) {
    await audit({ action: 'DOC_DELETED', actorId: admin?.id ?? null, targetType: 'DOCUMENT', meta: { reason: `ré-import ${SOURCE}`, count: purged.count } })
    console.log(`Réimport : ${purged.count} fiches ${SOURCE} précédentes supprimées (audit écrit).`)
  }

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
        // ⚠️ LE TEXTE OCR VA DANS L'INDEX, PAS DANS LA FICHE. `searchText` alimente le
        // vecteur plein-texte (poids C) et n'est JAMAIS affiché : le fascicule devient
        // cherchable, et c'est le fac-similé qui reste la source citable.
        searchText: [buildSearchText({ titleFr: label, number: ref, moniteurRef }), fold(r.texte)]
          .filter(Boolean)
          .join(' '),
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
