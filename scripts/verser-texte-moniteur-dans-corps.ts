/**
 * Verse la TRANSCRIPTION des fascicules scannés du Moniteur dans `bodyOriginal`, pour
 * qu'elle s'AFFICHE sur la fiche — et non plus seulement qu'elle se cherche.
 *
 *   npx tsx scripts/verser-texte-moniteur-dans-corps.ts --year 1987            (à blanc)
 *   npx tsx scripts/verser-texte-moniteur-dans-corps.ts --commit               (toutes années)
 *
 * ⚠️ `searchText` NE PEUT PAS ÊTRE AFFICHÉ. Il passe par `fold()` : minuscules, accents
 * retirés. « JOURNAL OFFICIEL DE LA RÉPUBLIQUE » y est écrit « journal officiel de la
 * republique ». Le texte lisible doit donc être RELU dans le PDF, pas recopié de l'index.
 *
 * ⚠️ ON NE TOUCHE PAS AUX FASCICULES SANS COUCHE. Les 1 557 fascicules de 2016-2026 n'ont
 * aucun texte dans leur PDF : leur corps garde son étiquette, et leur fiche continue de
 * dire — à juste titre — que le texte n'est pas océrisé.
 *
 * ⚠️ L'EN-TÊTE DE PROVENANCE EST CONSERVÉ. C'est lui qui porte le nom du fichier source, et
 * `rafraichir-texte-moniteur.ts` comme `ocr-moniteur-sans-couche.ts` le lisent pour
 * retrouver le PDF (`/Fichier\s*:\s*(.+?)\]/`). Le perdre les rendrait tous aveugles.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const RACINE = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur'

/** 1990 vit dans « 1981-1990 », 1991 dans « 1991-2000 ». */
function dossierDecennie(year: number): string {
  const debut = Math.floor((year - 1) / 10) * 10 + 1
  return `${debut}-${debut + 9}`
}

/**
 * Texte lisible du PDF. `-layout` préserve les colonnes du journal officiel : sans lui, les
 * deux colonnes du Moniteur s'entrelacent ligne à ligne et le texte devient illisible.
 */
function texteDuPdf(fichier: string): string {
  try {
    return execFileSync('pdftotext', ['-q', '-layout', fichier, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return ''
  }
}

/**
 * Nettoyage minimal — on ne corrige RIEN du contenu. Les coquilles de l'OCR (« JOU.RNAL
 * OFFICJEL ») restent : les redresser serait réécrire le journal officiel. On ne fait que
 * réduire les blancs, que le rendu HTML avalerait de toute façon.
 */
function assainir(texte: string): string {
  return texte
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/\f/g, '\n\n')
    .trim()
}

/** L'en-tête de provenance, débarrassé de sa clause devenue fausse. */
function entete(ancien: string): string {
  const m = /^\[(.*?)\]/s.exec(ancien)
  if (!m) return ancien
  const dedans = m[1]
    .replace(/\s*Texte intégral non encore océrisé\s*:\s*se référer au PDF source\.?/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return `[${dedans}]`
}

async function main() {
  const args = process.argv.slice(2)
  const year = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
  const commit = args.includes('--commit')

  const docs = await prisma.document.findMany({
    where: { source: year ? `MONITEUR_PDF_${year}` : { startsWith: 'MONITEUR_PDF_' } },
    select: { id: true, number: true, bodyOriginal: true, metaJson: true, source: true },
    orderBy: { publicationDate: 'asc' },
  })

  const aFaire: { id: string; number: string; corps: string; pages: number; avant: number }[] = []
  let deja = 0
  let sansCouche = 0
  let introuvables = 0

  for (const d of docs) {
    const an = Number(d.source!.replace('MONITEUR_PDF_', ''))
    const ancien = d.bodyOriginal ?? ''
    // Déjà versé : le corps ne se réduit plus à son en-tête entre crochets.
    if (ancien.replace(/^\[.*?\]/s, '').trim().length > 0) {
      deja++
      continue
    }
    const m = /Fichier\s*:\s*(.+?)\]/.exec(ancien)
    if (!m) {
      introuvables++
      continue
    }
    const fichier = join(RACINE, dossierDecennie(an), `${an} par numéro`, m[1].split(' ; ')[0].trim())
    if (!existsSync(fichier)) {
      introuvables++
      continue
    }

    const pages = (JSON.parse(String(d.metaJson)).pages as number) || 1
    const texte = assainir(texteDuPdf(fichier))
    // Seuil du catalogage : sous 200 c./page, il n'y a pas de couche exploitable.
    if (texte.length < 200 * pages) {
      sansCouche++
      continue
    }
    aFaire.push({ id: d.id, number: d.number!, corps: `${entete(ancien)}\n\n${texte}`, pages, avant: ancien.length })
  }

  const c = aFaire.reduce((n, x) => n + x.corps.length, 0)
  console.log(`${docs.length} fascicules examinés`)
  console.log(`   ${aFaire.length} à verser · ${deja} déjà faits · ${sansCouche} sans couche (corps inchangé) · ${introuvables} PDF introuvables`)
  console.log(`   ${(c / 1e6).toFixed(1)} M caractères à écrire\n`)
  for (const x of aFaire.slice(0, 8)) {
    console.log(`   ${x.number.padEnd(16)} ${String(x.pages).padStart(3)} p. · ${String(x.avant).padStart(5)} → ${String(x.corps.length).padStart(7)} c.`)
  }
  if (aFaire.length > 8) console.log(`   … et ${aFaire.length - 8} autres`)

  if (!commit) {
    console.log('\n(exécution à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }

  let faits = 0
  for (const x of aFaire) {
    await prisma.document.update({ where: { id: x.id }, data: { bodyOriginal: x.corps } })
    if (++faits % 100 === 0) process.stdout.write(`\r   ${faits}/${aFaire.length}`)
  }
  console.log(`\n\n✅ ${faits} fiches : la transcription est désormais AFFICHÉE.`)
  console.log('   Penser à réindexer (npx tsx scripts/reindex.ts).')
  await prisma.$disconnect()
}

main()
