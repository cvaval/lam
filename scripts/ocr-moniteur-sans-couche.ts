/**
 * Océrise les fascicules du Moniteur dont le PDF n'a AUCUNE couche texte.
 *
 *   npx tsx scripts/ocr-moniteur-sans-couche.ts --year 1996            (à blanc)
 *   npx tsx scripts/ocr-moniteur-sans-couche.ts --year 1996 --commit   (écrit)
 *
 * ⚠️ CIBLÉ, ET C'EST TOUT L'INTÉRÊT. `scripts/ocr-fascicules.ts` sélectionne sur le corps
 * de la fiche (« Fascicule scanné… ») : pour 1991-2000, TOUS les fascicules le portent,
 * puisque leur texte vit dans `searchText` et non dans `bodyOriginal`. Le lancer ici
 * océriserait les 886 fascicules de la décennie — dont 876 ont déjà leur texte, hérité du
 * Paper Capture d'Acrobat. On ne paie donc l'IA que pour ceux qui n'ont RIEN : le PDF
 * lui-même est interrogé, page par page, et non la fiche.
 *
 * ⚠️ LE TEXTE VA DANS `searchText`, PAS DANS `bodyOriginal` — même règle que le reste de
 * la décennie. Un OCR de microfilm sert à TROUVER, pas à CITER : le fac-similé fait foi.
 * (`ocr-fascicules.ts` écrit dans `bodyOriginal` ; c'était le choix des années 2016-2026,
 * qui n'avaient aucun texte du tout.)
 */
import { readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { PrismaClient } from '@prisma/client'
import { ocrDocument } from '../src/lib/ai/extract'
import { isExhausted } from '../src/lib/ai/provider'
import { buildSearchText, fold } from '../src/lib/search/normalize'

const prisma = new PrismaClient()
const RACINE = '/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur'

/** Le dossier de décennie qui abrite une année : 1990 vit dans « 1981-1990 », 1991 dans
 *  « 1991-2000 ». Coder la seule décennie 1991-2000 rendait 1990 introuvable — en silence,
 *  le fascicule étant simplement compté « PDF source introuvable ». */
function dossierDecennie(year: number): string {
  const debut = Math.floor((year - 1) / 10) * 10 + 1
  return `${debut}-${debut + 9}`
}

/** Le nom du fichier d'origine, consigné dans le corps de la fiche au catalogage. */
function fichierSource(bodyOriginal: string | null, year: number): string | null {
  const m = /Fichier\s*:\s*(.+?)\]/.exec(bodyOriginal ?? '')
  if (!m) return null
  const chemin = join(RACINE, dossierDecennie(year), `${year} par numéro`, m[1].split(' ; ')[0].trim())
  return existsSync(chemin) ? chemin : null
}

/** Texte déjà présent dans le PDF — c'est LUI qui décide, pas la fiche. */
function texteDuPdf(fichier: string): string {
  try {
    return execFileSync('pdftotext', ['-q', fichier, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return ''
  }
}

/** OCR par tranches : un fascicule de 24 pages dépasse la limite d'un seul appel. */
async function ocrParTranches(fichier: string, tranche: number): Promise<string> {
  const bytes = new Uint8Array(readFileSync(fichier))
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const total = src.getPageCount()
  const morceaux: string[] = []
  for (let i = 0; i < total; i += tranche) {
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, Array.from({ length: Math.min(tranche, total - i) }, (_, k) => i + k))
    for (const p of pages) out.addPage(p)
    const { text } = await ocrDocument(await out.save())
    morceaux.push(text)
  }
  return morceaux.join('\n\n').trim()
}

async function main() {
  const args = process.argv.slice(2)
  const year = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
  const tranche = args.includes('--tranche') ? Math.max(2, Number(args[args.indexOf('--tranche') + 1])) : 8
  const commit = args.includes('--commit')

  const docs = await prisma.document.findMany({
    where: { source: year ? `MONITEUR_PDF_${year}` : { startsWith: 'MONITEUR_PDF_19' } },
    select: { id: true, number: true, titleFr: true, moniteurRef: true, bodyOriginal: true, metaJson: true, source: true, searchText: true },
    orderBy: { publicationDate: 'asc' },
  })

  const aFaire: { id: string; number: string; titleFr: string; moniteurRef: string | null; fichier: string; pages: number }[] = []
  const introuvables: string[] = []
  for (const d of docs) {
    const an = Number(d.source!.replace('MONITEUR_PDF_', ''))
    const fichier = fichierSource(d.bodyOriginal, an)
    if (!fichier) { introuvables.push(d.number!); continue }
    const pages = (JSON.parse(String(d.metaJson)).pages as number) || 1
    // ⚠️ DEUX CONDITIONS, ET LA SECONDE REND LE SCRIPT IDEMPOTENT. On n'écrit JAMAIS dans
    // le PDF d'archive : après un océrisage, le fichier reste sans couche et le seul test
    // du PDF redemanderait le même travail à l'IA, indéfiniment. La fiche fait donc foi
    // pour ce qui est DÉJÀ fait, le PDF pour ce qui reste à faire.
    if ((d.searchText ?? '').length >= 200 * pages) continue
    // Le seuil du catalogage : moins de 200 c./page = pas de couche exploitable.
    if (texteDuPdf(fichier).length >= 200 * pages) continue
    aFaire.push({ id: d.id, number: d.number!, titleFr: d.titleFr, moniteurRef: d.moniteurRef, fichier, pages })
  }

  console.log(`${docs.length} fascicules examinés · ${aFaire.length} SANS couche texte`)
  if (introuvables.length) console.log(`⚠ PDF source introuvable pour ${introuvables.length} fiche(s) : ${introuvables.slice(0, 5).join(', ')}`)
  const totalPages = aFaire.reduce((n, x) => n + x.pages, 0)
  console.log(`→ ${totalPages} pages à océriser, soit ~${aFaire.reduce((n, x) => n + Math.ceil(x.pages / tranche), 0)} appels IA (tranches de ${tranche})\n`)
  for (const x of aFaire) console.log(`   ${x.number.padEnd(16)} ${String(x.pages).padStart(3)} p.  ${x.fichier.split('/').pop()}`)

  if (!commit) {
    console.log('\n(exécution à blanc — ajouter --commit pour océriser)')
    await prisma.$disconnect()
    return
  }

  let faits = 0, echecs = 0
  for (const x of aFaire) {
    try {
      const texte = await ocrParTranches(x.fichier, tranche)
      // ⚠️ UN OCR TROP COURT N'EST PAS UN OCR. Écrire 40 caractères pour 24 pages
      // marquerait le fascicule comme traité et personne n'y reviendrait.
      if (texte.length < 200 * x.pages) {
        console.log(`  ⚠ ${x.number} : ${texte.length} c. pour ${x.pages} p. — trop court, fiche INCHANGÉE`)
        echecs++
        continue
      }
      await prisma.document.update({
        where: { id: x.id },
        data: {
          searchText: [buildSearchText({ titleFr: x.titleFr, number: x.number, moniteurRef: x.moniteurRef }), fold(texte)]
            .filter(Boolean)
            .join(' '),
        },
      })
      faits++
      console.log(`  ✓ ${x.number} : ${texte.length} c. (${Math.round(texte.length / x.pages)} c./page)`)
    } catch (e) {
      if (isExhausted(e)) {
        console.log(`  ⏸ ${x.number} : quota IA épuisé — arrêt propre, reprise au prochain lancement.`)
        break
      }
      console.log(`  ✗ ${x.number} : ${String((e as Error)?.message ?? e).slice(0, 120)}`)
      echecs++
    }
  }
  console.log(`\n${faits} océrisé(s) · ${echecs} en échec · ${aFaire.length - faits - echecs} non traité(s)`)
  await prisma.$disconnect()
}

main()
