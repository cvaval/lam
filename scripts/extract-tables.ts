/**
 * Reproduction des tableaux & encadrés colorés des circulaires BRH.
 *
 *   npx tsx scripts/extract-tables.ts --dir "<dossier des PDF>" [--only 83-5] [--all] [--commit]
 *
 * Lit le RENDU VISUEL de chaque PDF via Claude (vision) — la couche texte OCR
 * aplatit tableaux et couleurs — et reconstruit des blocs structurés (tableaux
 * bordés, en-têtes ombrés, cartouches colorés) stockés dans Document.richBlocksJson.
 * Affichage seulement : bodyOriginal reste le texte officiel brut (§02).
 *
 * Sans --commit : inventaire (combien de blocs, combien replacés dans le flux).
 * Avec --commit : écrit richBlocksJson. Idempotent (réécrase le doc ciblé).
 * Nécessite ANTHROPIC_API_KEY (sinon le script s'arrête proprement).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseName } from './import-brh'
import { extractRichTables, isAiConfigured } from '../src/lib/ai/extract'
import { parseRichBlocks, buildBodySegments } from '../src/lib/doc/richblocks'

const prisma = new PrismaClient()

/** Référence canonique d'un fichier (même convention que import-brh). */
function numberFor(file: string): string | null {
  const parsed = parseName(file)
  if (!parsed || parsed === 'skip') return null
  const serie = parsed.kind === 'LETTRE' ? 'Lettre-Circulaire' : 'Circulaire'
  return `${serie} n° ${parsed.num}`
}

/** Heuristique « contient du tabulaire » (mêmes critères que le recensement admin). */
function tableScore(b: string): number {
  let score = 0
  for (const l of b.split('\n')) {
    const cells = l.trim().split(/\s{2,}|\t/).filter(Boolean)
    const nums = (l.match(/\b\d{1,3}([.,]\d+)?\s*%?/g) || []).length
    if ((cells.length >= 3 && nums >= 2) || (l.match(/%/g) || []).length >= 2) score++
  }
  return score
}

async function main() {
  const args = process.argv.slice(2)
  const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : process.env.BRH_DIR
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
  const all = args.includes('--all')
  const commit = args.includes('--commit')
  if (!dir) {
    console.error('Usage: npx tsx scripts/extract-tables.ts --dir "<dossier des PDF>" [--only 83-5] [--all] [--commit]')
    process.exit(1)
  }
  if (!isAiConfigured()) {
    console.error('⛔ ANTHROPIC_API_KEY non configurée — ajoutez-la dans .env avant de lancer l’extraction des tableaux.')
    process.exit(1)
  }

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'))
  // number → fichier (le plus volumineux = scan le plus complet en cas de doublon)
  const byNumber = new Map<string, string>()
  for (const f of files) {
    const num = numberFor(f)
    if (!num) continue
    const prev = byNumber.get(num)
    if (!prev || readFileSync(join(dir, f)).length > readFileSync(join(dir, prev)).length) byNumber.set(num, f)
  }

  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { id: true, number: true, titleFr: true, bodyOriginal: true, richBlocksJson: true },
  })
  const force = args.includes('--force')

  // Cibles : --only (un numéro), sinon tous les docs tabulaires (ou --all).
  // Par défaut on SAUTE celles qui ont déjà des tableaux (reprise après quota) ;
  // --force les retraite.
  const limit = args.includes('--limit') ? Math.max(1, Number(args[args.indexOf('--limit') + 1])) : 0
  let targets = docs.filter((d) => {
    if (!d.number || !byNumber.has(d.number)) return false
    if (!only && !force && d.richBlocksJson) return false
    if (only) return d.number.includes(only)
    return all || tableScore(d.bodyOriginal) >= 3
  })
  // --limit : traiter par petits lots (évite que le run dépasse le délai et soit tué).
  if (limit) targets = targets.slice(0, limit)

  console.log(`\n${targets.length} circulaire(s) ciblée(s)${commit ? ' — écriture' : ' — inventaire seul'} :\n`)
  let written = 0
  for (const d of targets) {
    const file = byNumber.get(d.number!)!
    process.stdout.write(`  ${d.number!.padEnd(24)} ← ${file.padEnd(34)} `)
    try {
      const { blocks, pages } = await extractRichTables(new Uint8Array(readFileSync(join(dir, file))), d.bodyOriginal)
      const json = JSON.stringify(blocks)
      const parsed = parseRichBlocks(json)
      const segs = buildBodySegments(d.bodyOriginal, parsed)
      const placed = segs.filter((s) => s.kind === 'rich').length
      const tables = parsed.filter((b) => b.type === 'table').length
      const notes = parsed.filter((b) => b.type === 'note').length
      console.log(`${pages}p · ${tables} tableau(x), ${notes} encadré(s) · ${placed}/${parsed.length} replacés dans le flux`)
      if (commit && parsed.length) {
        await prisma.document.update({ where: { id: d.id }, data: { richBlocksJson: json } })
        written++
      }
    } catch (e) {
      console.log('ÉCHEC :', String((e as Error).message ?? e).slice(0, 120))
    }
  }

  console.log(`\n${commit ? `✅ ${written} document(s) mis à jour (richBlocksJson).` : '(Inventaire — relancez avec --commit pour écrire.)'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
