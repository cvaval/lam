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
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'

const prisma = new PrismaClient()
const RACINE = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur'

/**
 * Index « nom de fichier → chemin » d'une arborescence, pour `--depuis`.
 *
 * ⚠️ LES LIVRAISONS NE SONT PAS RANGÉES COMME L'ARCHIVE. Le fonds ancien tient dans
 * « <décennie>/<année> par numéro/ », à plat ; les livraisons de la cliente arrivent en
 * « LES MONITEURS <MOIS> 2026/ », un dossier par mois. Chercher au chemin calculé n'y
 * trouve rien — on indexe donc l'arbre une fois, et on résout par nom.
 */
function indexerArbre(racine: string): Map<string, string> {
  const m = new Map<string, string>()
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) parcourir(p)
      else if (n.toLowerCase().endsWith('.pdf')) m.set(n.normalize('NFC'), p)
    }
  }
  parcourir(racine)
  // ⚠️ SECOND JEU DE CLÉS : LA RÉFÉRENCE. Le même fascicule change de nom d'une livraison à
  // l'autre — « … No.27-A 2Juin 2026.pdf » ici, « … No.27-A Mardi 2 Juin 2026.pdf » là. Cinq
  // éditions spéciales de juin, cataloguées lors d'une livraison antérieure, restaient
  // introuvables pour cette seule raison. On indexe donc aussi par « SP27A », insensible au
  // tiret comme au jour de la semaine.
  for (const [nom, chemin] of [...m]) {
    const t = nom
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
    const mn = /n[o°]s?\.?\s*(\d+)\s*-?\s*([a-z]?)(?![a-z0-9])/.exec(t)
    if (!mn) continue
    const cle = `${/\bspecial/.test(t) ? 'SP' : ''}${mn[1]}${mn[2].toUpperCase()}`
    if (!m.has(cle)) m.set(cle, chemin)
  }
  return m
}

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

/**
 * ⚠️ ON COMPARE DES MOTS, JAMAIS DES CARACTÈRES. `pdftotext -layout` restitue les colonnes
 * du journal par des ESPACES : le même texte y pèse 40 % de caractères de plus qu'une
 * extraction à plat. Comparer les longueurs faisait donc paraître Acrobat plus riche que
 * l'IA sur les dix fascicules de 1996-97, alors qu'il rendait 2 % de texte en MOINS —
 * l'écart n'était que du blanc. Le nombre de mots, lui, ne se laisse pas gonfler.
 */
const mots = (s: string) => (s.match(/\S+/g) ?? []).length

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
  // Arborescence de livraison (un dossier par mois) au lieu de l'archive rangée par année.
  const depuis = args.includes('--depuis') ? args[args.indexOf('--depuis') + 1] : null
  const arbre = depuis ? indexerArbre(depuis) : null
  if (arbre) console.log(`--depuis : ${arbre.size} PDF indexés\n`)

  const docs = await prisma.document.findMany({
    where: { source: year ? `MONITEUR_PDF_${year}` : { startsWith: 'MONITEUR_PDF_' } },
    select: { id: true, number: true, titleFr: true, moniteurRef: true, bodyOriginal: true, metaJson: true, source: true, searchText: true },
    orderBy: { publicationDate: 'asc' },
  })

  const aFaire: { id: string; number: string; corps: string; pages: number; avant: number; indexe: string | null }[] = []
  let deja = 0
  let sansCouche = 0
  let introuvables = 0

  for (const d of docs) {
    const an = Number(d.source!.replace('MONITEUR_PDF_', ''))
    const ancien = d.bodyOriginal ?? ''
    // Déjà versé : le corps ne se réduit plus à son en-tête entre crochets.
    // ⚠️ « DÉJÀ VERSÉ » NE VEUT PAS DIRE « RIEN À FAIRE ». Une fiche peut porter sa
    // transcription et garder un index d'avant : on ne la saute que si les DEUX sont à jour.
    const corpsPose = ancien.replace(/^\[.*?\]/s, '').trim().length
    if (corpsPose > 0 && (d.searchText ?? '').length >= corpsPose * 0.5) {
      deja++
      continue
    }
    const m = /Fichier\s*:\s*(.+?)\]/.exec(ancien)
    if (!m) {
      introuvables++
      continue
    }
    const nom = m[1].split(' ; ')[0].trim()
    // Par nom d'abord ; à défaut par référence (cf. indexerArbre) — « LM2026-SP27A » → « SP27A ».
    const parRef = (d.number ?? '').toUpperCase().replace(/^LM\d{4}-/, '').replace(/-/g, '')
    const fichier = arbre
      ? arbre.get(nom.normalize('NFC')) ?? arbre.get(parRef) ?? ''
      : join(RACINE, dossierDecennie(an), `${an} par numéro`, nom)
    if (!fichier || !existsSync(fichier)) {
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
    // ⚠️ LE CORPS ET L'INDEX VIENNENT DE LA MÊME EXTRACTION, OU L'UN MENT SUR L'AUTRE.
    // 253 fiches de 2026 affichaient leur transcription tout en restant introuvables par un
    // mot qu'elle contient : leur `searchText` datait d'un versement où le PDF n'avait pas
    // encore de couche. On le reconstruit ici — mais JAMAIS à la baisse : les dix fascicules
    // de 1996-97 océrisés par IA ont un index riche que le PDF ne saurait pas refaire.
    const indexe = [buildSearchText({ titleFr: d.titleFr, number: d.number!, moniteurRef: d.moniteurRef }), fold(texte)]
      .filter(Boolean)
      .join(' ')
    aFaire.push({
      id: d.id,
      number: d.number!,
      corps: `${entete(ancien)}\n\n${texte}`,
      pages,
      avant: ancien.length,
      indexe: mots(indexe) > mots(d.searchText ?? '') ? indexe : null,
    })
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
    await prisma.document.update({
      where: { id: x.id },
      data: { bodyOriginal: x.corps, ...(x.indexe ? { searchText: x.indexe } : {}) },
    })
    if (++faits % 100 === 0) process.stdout.write(`\r   ${faits}/${aFaire.length}`)
  }
  console.log(`\n\n✅ ${faits} fiches : la transcription est désormais AFFICHÉE.`)
  console.log(`   dont ${aFaire.filter((x) => x.indexe).length} dont l'index a été remis au niveau du corps.`)
  console.log('   Penser à réindexer (npx tsx scripts/reindex.ts).')
  await prisma.$disconnect()
}

main()
