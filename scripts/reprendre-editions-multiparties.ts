/**
 * Reprise de cinq fiches d'Éditions Le Moniteur versées avant le correctif des éditions en
 * plusieurs parties (12 oct. 2026). À blanc par défaut ; `--commit` écrit.
 *
 *   npx tsx scripts/reprendre-editions-multiparties.ts --inventaire <dossier> [--fusion-dir <dossier>]
 *     [--journal <fichier.json>] [--commit]
 *
 * <dossier> : les <année>.json de `import-moniteur-pdf.ts --inventaire-json` (2021, 2025, 2026),
 * qui donnent les parties de chaque édition DANS L'ORDRE DES PAGES.
 *
 * Ce qui était faux, et pourquoi :
 *  - LM2021-SP22 (4 parties), LM2021-SP36 (2) : l'ancien import ne mettait en ligne que la
 *    1re partie (`files[0]`) — 30 pages sur 104, 30 sur 60. On réunit les parties (pdfunite)
 *    et on téléverse le PDF complet sous un NOUVEAU chemin Blob (l'ancien reste, inerte :
 *    réécrire le même chemin exposerait un PDF tronqué resté en cache) ;
 *  - LM2021-SP30 : même défaut, et la fiche avait absorbé les parties des n° 30-A et 30-B
 *    (« 240 pages, 10 parties ») — désormais fiches distinctes. On ne garde que ses 4 parties ;
 *  - LM2025-SP12 : « 60 pages, 15 parties » — les 14 éditions 12-A1 … 12-M1 et 12-E2 y étaient
 *    fondues (suffixe à chiffre mal lu). Son PDF est juste ; seuls le compte et l'en-tête mentent ;
 *  - LM2026-33 : « 24 pages, 2 parties » — le second fichier, « No.33 11Mars 2026 », était un
 *    second scan du n° 34 (même sommaire), retiré depuis du dossier. PDF et transcription justes.
 *
 * Seules changent : `sourcePdfUrl` (les trois de 2021), `metaJson.pages` / `metaJson.parts`, et la
 * PREMIÈRE ligne du corps (« [Fascicule scanné … — N page(s), K parties. … Fichier : …] »). Le reste
 * du corps (transcription) n'est pas touché. L'état avant/après est écrit dans `--journal`.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { uploadToBlob } from '../src/lib/storage/blob'

const prisma = new PrismaClient()

/** Fiche → faut-il réunir les parties et remettre le PDF en ligne ? */
const REPRISES: { ref: string; refairePdf: boolean }[] = [
  { ref: 'LM2021-SP22', refairePdf: true },
  { ref: 'LM2021-SP36', refairePdf: true },
  { ref: 'LM2021-SP30', refairePdf: true },
  { ref: 'LM2025-SP12', refairePdf: false },
  { ref: 'LM2026-33', refairePdf: false },
]

function pages(fichier: string): number {
  const m = execFileSync('pdfinfo', [fichier], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).match(/^Pages:\s+(\d+)/m)
  return m ? Number(m[1]) : 0
}

async function main() {
  const args = process.argv.slice(2)
  const opt = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined)
  const commit = args.includes('--commit')
  const dossierInv = opt('--inventaire')
  if (!dossierInv) throw new Error('--inventaire <dossier> requis')
  const fusionDir = opt('--fusion-dir')
  const journalFichier = opt('--journal')

  const parRef = new Map<string, string[]>()
  for (const f of readdirSync(dossierInv).filter((x) => /^\d{4}\.json$/.test(x))) {
    for (const x of (JSON.parse(readFileSync(join(dossierInv, f), 'utf8')) as { fascicules: { ref: string; fichiers: string[] }[] }).fascicules) {
      parRef.set(x.ref, x.fichiers)
    }
  }

  const journal: Record<string, unknown>[] = []
  for (const { ref, refairePdf } of REPRISES) {
    const fichiers = parRef.get(ref)
    if (!fichiers) throw new Error(`${ref} absent de l'inventaire`)
    const d = await prisma.document.findFirst({
      where: { number: ref, type: 'LEGISLATION', source: { startsWith: 'MONITEUR_PDF_' } },
      select: { id: true, type: true, bodyOriginal: true, metaJson: true, sourcePdfUrl: true },
    })
    if (!d) throw new Error(`${ref} absent de la base`)
    const meta = JSON.parse(d.metaJson ?? '{}')
    const total = fichiers.reduce((s, f) => s + pages(f), 0)
    const noms = fichiers.map((f) => basename(f))

    // Première ligne du corps : « [Fascicule scanné … ] » — on ne réécrit QUE le crochet initial.
    const fin = d.bodyOriginal.indexOf(']')
    if (!d.bodyOriginal.startsWith('[Fascicule scanné') || fin < 0) throw new Error(`${ref} : corps inattendu`)
    const ancienneTete = d.bodyOriginal.slice(0, fin + 1)
    const resteNonOcr = ancienneTete.includes('Texte intégral non encore océrisé') ? ' Texte intégral non encore océrisé : se référer au PDF source.' : ''
    const nouvelleTete = `[Fascicule scanné du journal officiel « Le Moniteur » — ${total} page(s)${fichiers.length > 1 ? `, ${fichiers.length} parties` : ''}.${resteNonOcr} Fichier : ${noms.join(' ; ')}]`

    console.log(`\n${ref} · pages ${meta.pages} → ${total} · parties ${meta.parts} → ${fichiers.length}${refairePdf ? ' · PDF : parties réunies' : ''}`)
    console.log(`   avant : ${ancienneTete.slice(0, 160)}…`)
    console.log(`   après : ${nouvelleTete.slice(0, 160)}…`)

    let url = d.sourcePdfUrl
    if (refairePdf && commit) {
      if (!fusionDir) throw new Error('--fusion-dir requis avec --commit')
      mkdirSync(fusionDir, { recursive: true })
      const fusion = join(fusionDir, `${ref}-complet.pdf`)
      execFileSync('pdfunite', [...fichiers, fusion])
      if (pages(fusion) !== total) throw new Error(`${ref} : la fusion compte ${pages(fusion)} pages pour ${total}`)
      const buf = readFileSync(fusion)
      url = await uploadToBlob(`source-pdf/${d.type.toLowerCase()}/${d.id}-complet.pdf`, buf, 'application/pdf', { multipart: buf.length > 20_000_000 })
      console.log(`   PDF complet en ligne : ${(buf.length / 1e6).toFixed(1)} Mo`)
    }
    journal.push({ ref, id: d.id, avant: { sourcePdfUrl: d.sourcePdfUrl, metaJson: d.metaJson, tete: ancienneTete }, apres: { sourcePdfUrl: url, pages: total, parts: fichiers.length, tete: nouvelleTete } })
    if (commit) {
      await prisma.document.update({
        where: { id: d.id },
        data: {
          sourcePdfUrl: url,
          metaJson: JSON.stringify({ ...meta, pages: total, parts: fichiers.length }),
          bodyOriginal: nouvelleTete + d.bodyOriginal.slice(fin + 1),
        },
      })
    }
  }
  if (journalFichier) writeFileSync(journalFichier, JSON.stringify(journal, null, 1))
  console.log(commit ? '\n✅ 5 fiches reprises.' : '\n(à blanc — relancer avec --commit --fusion-dir <dossier>)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
