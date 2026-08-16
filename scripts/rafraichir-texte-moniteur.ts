/**
 * Reverse dans l'index la couche texte des PDF du Moniteur — après un océrisage fait
 * dans Acrobat, hors de la plateforme.
 *
 *   npx tsx scripts/rafraichir-texte-moniteur.ts --year 1988            (à blanc)
 *   npx tsx scripts/rafraichir-texte-moniteur.ts --year 1988 --commit   (écrit)
 *
 * Ni IA, ni purge, ni écriture dans les fiches autres que `searchText` : on relit les
 * fichiers d'archive et l'on met l'index à niveau. C'est le pendant gratuit de
 * `ocr-moniteur-sans-couche.ts`, qui, lui, appelle l'IA.
 *
 * ⚠️ NE JAMAIS REMPLACER UN TEXTE PAR UN PLUS PAUVRE. Les dix fascicules de 1996-1997
 * océrisés par IA ont un index plein et un PDF toujours muet : les relire aveuglément
 * effacerait 687 000 caractères payés. On n'écrit donc QUE si le PDF apporte plus que ce
 * que la fiche porte déjà — et jamais l'inverse.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'

const prisma = new PrismaClient()
const RACINE = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur'

/** 1990 vit dans « 1981-1990 », 1991 dans « 1991-2000 ». */
function dossierDecennie(year: number): string {
  const debut = Math.floor((year - 1) / 10) * 10 + 1
  return `${debut}-${debut + 9}`
}

function texteDuPdf(fichier: string): string {
  try {
    return execFileSync('pdftotext', ['-q', fichier, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return ''
  }
}

async function main() {
  const args = process.argv.slice(2)
  const year = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
  const commit = args.includes('--commit')
  // Dossier de sortie d'Acrobat, quand l'océrisation n'a pas écrasé les originaux.
  const source = args.includes('--depuis') ? args[args.indexOf('--depuis') + 1] : null

  const docs = await prisma.document.findMany({
    where: { source: year ? `MONITEUR_PDF_${year}` : { startsWith: 'MONITEUR_PDF_' } },
    select: { id: true, number: true, titleFr: true, moniteurRef: true, bodyOriginal: true, metaJson: true, source: true, searchText: true },
    orderBy: { publicationDate: 'asc' },
  })

  const aMettreAJour: { id: string; number: string; titleFr: string; moniteurRef: string | null; texte: string; avant: number; pages: number }[] = []
  let inchanges = 0
  let introuvables = 0
  const maigres: { number: string; pages: number; c: number }[] = []

  for (const d of docs) {
    const an = Number(d.source!.replace('MONITEUR_PDF_', ''))
    const m = /Fichier\s*:\s*(.+?)\]/.exec(d.bodyOriginal ?? '')
    if (!m) { introuvables++; continue }
    const nom = m[1].split(' ; ')[0].trim()
    const fichier = source ? join(source, nom) : join(RACINE, dossierDecennie(an), `${an} par numéro`, nom)
    if (!existsSync(fichier)) { introuvables++; continue }

    const pages = (JSON.parse(String(d.metaJson)).pages as number) || 1
    const texte = texteDuPdf(fichier).replace(/\s+/g, ' ').trim()
    const avant = (d.searchText ?? '').length

    // ⚠️ LE PDF NE GAGNE QUE S'IL APPORTE PLUS. Marge de 10 % pour ne pas réécrire toute
    // la base sur un écart d'arrondi entre deux extractions.
    if (texte.length <= avant * 1.1) {
      inchanges++
      if (texte.length < 200 * pages && avant < 200 * pages) maigres.push({ number: d.number!, pages, c: texte.length })
      continue
    }
    aMettreAJour.push({ id: d.id, number: d.number!, titleFr: d.titleFr, moniteurRef: d.moniteurRef, texte, avant, pages })
  }

  console.log(`${docs.length} fiches examinées · ${aMettreAJour.length} à mettre à jour · ${inchanges} inchangées · ${introuvables} PDF introuvables\n`)
  for (const x of aMettreAJour) {
    console.log(`   ${x.number.padEnd(16)} ${String(x.pages).padStart(3)} p. · ${String(x.avant).padStart(7)} → ${String(x.texte.length).padStart(7)} c. (${Math.round(x.texte.length / x.pages)} c./page)`)
  }
  if (maigres.length) {
    console.log(`\n⚠ ${maigres.length} fascicule(s) restent SOUS le seuil de 200 c./page — océrisation partielle ou absente :`)
    for (const x of maigres) console.log(`   ${x.number.padEnd(16)} ${String(x.pages).padStart(3)} p. · ${x.c} c. (${Math.round(x.c / x.pages)} c./page)`)
  }

  if (!commit) {
    console.log('\n(exécution à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }

  for (const x of aMettreAJour) {
    await prisma.document.update({
      where: { id: x.id },
      data: {
        searchText: [buildSearchText({ titleFr: x.titleFr, number: x.number, moniteurRef: x.moniteurRef }), fold(x.texte)]
          .filter(Boolean)
          .join(' '),
      },
    })
  }
  const gain = aMettreAJour.reduce((n, x) => n + x.texte.length - x.avant, 0)
  console.log(`\n✅ ${aMettreAJour.length} fiches mises à jour · ${(gain / 1e6).toFixed(2)} M caractères gagnés.`)
  console.log('   Penser à réindexer (npx tsx scripts/reindex.ts) si le miroir OpenSearch est en service.')
  await prisma.$disconnect()
}

main()
