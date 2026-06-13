/**
 * Ré-OCR intelligible des circulaires BRH.
 *
 *   npx tsx scripts/reocr-circulaires.ts --audit                       (sans clé)
 *   npx tsx scripts/reocr-circulaires.ts --dir "<PDF>" [--only 119] [--all] [--commit]
 *
 * La couche texte importée de certains scans est dégradée (mots collés, accents
 * et lettres mal reconnus). Ce script :
 *   --audit : note la LISIBILITÉ de chaque texte (heuristique, AUCUNE IA) et liste
 *             les plus dégradés — utilisable immédiatement, sans clé API.
 *   défaut  : re-transcrit le texte via Claude (vision PDF, corrige uniquement les
 *             erreurs d'OCR sans changer le sens) et met à jour bodyOriginal +
 *             searchText. Nécessite ANTHROPIC_API_KEY.
 *
 * bodyOriginal reste le texte officiel (§02) ; on ne fait que corriger l'OCR.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parseName } from './import-brh'
import { ocrDocument, isAiConfigured } from '../src/lib/ai/extract'
import { buildSearchText } from '../src/lib/search/normalize'

const prisma = new PrismaClient()

function numberFor(file: string): string | null {
  const parsed = parseName(file)
  if (!parsed || parsed === 'skip') return null
  return `${parsed.kind === 'LETTRE' ? 'Lettre-Circulaire' : 'Circulaire'} n° ${parsed.num}`
}

/**
 * Score de DÉGRADATION OCR pour 1000 caractères (plus haut = moins lisible) :
 * mots « collés » très longs, jonctions lettre/chiffre, et mots sans voyelle.
 */
function garbleScore(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return 0
  let bad = 0
  for (const w of words) {
    const letters = w.replace(/[^a-zà-ÿ]/gi, '')
    if (letters.length >= 18) bad++ // mot collé (espaces perdus)
    else if (/[a-zà-ÿ]/i.test(w) && /\d/.test(w) && !/^\d+[a-z]?$/i.test(w)) bad++ // « novembre2020 »
    else if (letters.length >= 5 && !/[aeiouyàâäéèêëïîôöùûü]/i.test(letters)) bad++ // sans voyelle
  }
  return Math.round((bad / text.length) * 1000 * 10) / 10
}

async function main() {
  const args = process.argv.slice(2)
  const audit = args.includes('--audit')
  const dir = args.includes('--dir') ? args[args.indexOf('--dir') + 1] : process.env.BRH_DIR
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
  const all = args.includes('--all')
  const commit = args.includes('--commit')

  // ── Mode audit : lisibilité, sans IA ──
  if (audit) {
    const docs = await prisma.document.findMany({
      where: { type: 'CIRCULAIRE_BRH' },
      select: { number: true, bodyOriginal: true },
    })
    const scored = docs
      .map((d) => ({ n: d.number ?? '?', score: garbleScore(d.bodyOriginal), len: d.bodyOriginal.length }))
      .filter((r) => r.len > 200) // ignore les placeholders
      .sort((a, b) => b.score - a.score)
    console.log('\nLisibilité OCR (score de dégradation /1000 c — plus haut = à re-transcrire) :\n')
    for (const r of scored) {
      const flag = r.score >= 8 ? '⚠️ dégradé' : r.score >= 4 ? '~ moyen' : 'ok'
      console.log(`  ${String(r.score).padStart(5)}  ${flag.padEnd(10)} ${r.n}`)
    }
    const bad = scored.filter((r) => r.score >= 8)
    console.log(`\n${bad.length} circulaire(s) nettement dégradée(s) à re-transcrire : ${bad.map((r) => r.n).join(', ') || '—'}`)
    console.log('→ Ajoutez ANTHROPIC_API_KEY dans .env puis relancez sans --audit (avec --commit) pour le ré-OCR IA.')
    await prisma.$disconnect()
    return
  }

  // ── Mode ré-OCR (IA vision) ──
  if (!dir) {
    console.error('Usage: npx tsx scripts/reocr-circulaires.ts --dir "<dossier PDF>" [--only 119] [--all] [--commit]   (ou --audit)')
    process.exit(1)
  }
  if (!isAiConfigured()) {
    console.error('⛔ ANTHROPIC_API_KEY non configurée. Lancez `--audit` pour le diagnostic sans IA, ou ajoutez la clé dans .env.')
    process.exit(1)
  }

  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.pdf'))
  const byNumber = new Map<string, string>()
  for (const f of files) {
    const num = numberFor(f)
    if (!num) continue
    const prev = byNumber.get(num)
    if (!prev || readFileSync(join(dir, f)).length > readFileSync(join(dir, prev)).length) byNumber.set(num, f)
  }

  const docs = await prisma.document.findMany({
    where: { type: 'CIRCULAIRE_BRH' },
    select: { id: true, number: true, titleFr: true, matiere: true, bodyOriginal: true },
  })
  const targets = docs.filter((d) => {
    if (!d.number || !byNumber.has(d.number)) return false
    if (only) return d.number.includes(only)
    return all || garbleScore(d.bodyOriginal) >= 8
  })

  console.log(`\n${targets.length} circulaire(s) à re-transcrire${commit ? '' : ' (essai — sans écriture)'} :\n`)
  let written = 0
  const skipped: string[] = []
  for (const d of targets) {
    const file = byNumber.get(d.number!)!
    process.stdout.write(`  ${d.number!.padEnd(24)} ← ${file.padEnd(34)} `)
    try {
      const { text, pages, truncated } = await ocrDocument(new Uint8Array(readFileSync(join(dir, file))))
      const before = garbleScore(d.bodyOriginal)
      const after = garbleScore(text)
      // Garde-fous : ne JAMAIS écraser l'original par une transcription incomplète
      // (tronquée : doc > 40 pages) ou anormalement longue (boucle du modèle :
      // > ~6000 c/page, ou > 3× la couche texte d'origine).
      const tooLong = text.length > pages * 6000 || text.length > d.bodyOriginal.length * 3
      const ok = text.length > 200 && !truncated && !tooLong
      const why = truncated ? ' · TRONQUÉ → ignoré' : tooLong ? ' · LONGUEUR ANORMALE (boucle ?) → ignoré' : ''
      console.log(`${pages}p · lisibilité ${before} → ${after} · ${text.length}c${why}`)
      if (commit && ok) {
        await prisma.document.update({
          where: { id: d.id },
          data: { bodyOriginal: text, searchText: buildSearchText({ titleFr: d.titleFr, number: d.number, bodyOriginal: text, matiere: d.matiere }) },
        })
        written++
      } else if (commit && !ok) {
        skipped.push(d.number!)
      }
    } catch (e) {
      console.log('ÉCHEC :', String((e as Error).message ?? e).slice(0, 120))
    }
  }
  if (skipped.length) console.log(`\n⚠️  Ignorées (tronquées / sortie anormale — original conservé) : ${skipped.join(', ')}`)
  console.log(`\n${commit ? `✅ ${written} circulaire(s) re-transcrite(s). Lancez ensuite \`npm run search:reindex\`.` : '(Essai — relancez avec --commit pour écrire.)'}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
