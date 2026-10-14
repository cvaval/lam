/**
 * OCR COMBINÉ (Claude + Tesseract) d'UN PDF local, HORS BASE — le témoin propre d'une collation.
 *
 *   set -a; source .env; set +a
 *   npx tsx scripts/ocr-combine-pdf.ts --pdf <fichier.pdf> --travail <dossier> [--moteur tesseract|claude] [--pages 1-184] [--concurrence N] [--relire-faibles]
 *   npx tsx scripts/ocr-combine-pdf.ts --pdf <fichier.pdf> --travail <dossier> --fusionner
 *   # Écriture de la transcription dans UNE fiche d'Éditions nommée (à blanc, puis --commit) :
 *   npx tsx scripts/ocr-combine-pdf.ts --pdf <fichier.pdf> --travail <dossier> --ecrire --ref LM2026-SP48-A [--remplacer-index] [--commit]
 *
 * Même chaîne que `ocr-combine-moniteur.ts`, page pour page (même rendu 300 ppp gris, même modèle
 * `fra`, même invite `OCR_PROMPT`, même `fusionner()` de `lib/fusion-ocr.ts`), mais sur un fichier
 * nommé et SANS PRISMA : rien n'est lu ni écrit en base. Sans `--moteur`, les deux moteurs tournent.
 *
 * `--ecrire --ref` : comme `ocr-combine-moniteur.ts --ecrire`, mais pour une fiche NOMMÉE. Celle-ci
 * ne figure pas forcément parmi ses « cibles » : un scan HP porte sa propre couche texte, que
 * `import-moniteur-pdf.ts` verse dans `searchText` — la fiche n'est alors plus « sans texte »
 * alors que son corps n'affiche rien. Toutes les pages doivent avoir leur fusion ; le PDF de la
 * fiche (Blob) doit être le même fichier que `--pdf` (empreinte comparée).
 *
 * En plus des lectures (`pNNN.claude.txt`, `pNNN.tesseract.txt`, `pNNN.fusion.txt`), Tesseract garde
 * ses boîtes de mots (`pNNN.tesseract.tsv`, même passe de reconnaissance) : elles situent sur l'image
 * chaque divergence d'une collation, pour qu'elle se tranche à l'œil (Code fiscal 2026, 13 oct.).
 *
 * ⚠️ `LV_AI_MODEL` du `.env` vaut « gemini-… » : il ne s'applique pas ici. `--modele` (défaut
 * claude-haiku-5-5, celui de la chaîne) choisit le modèle Claude.
 */
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'node:crypto'
import { OCR_PROMPT, cleanOcrText } from '../src/lib/ai/extract'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { getPrivateBlob } from '../src/lib/storage/blob'
import { formeVocabulaire, fusionner, tesseractPropre } from './lib/fusion-ocr'

const executer = promisify(execFile)
const args = process.argv.slice(2)
const opt = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined)
const pdf = opt('--pdf')
const travail = opt('--travail')
if (!pdf || !existsSync(pdf)) throw new Error('--pdf <fichier> requis (et existant)')
if (!travail) throw new Error('--travail <dossier> requis')
mkdirSync(travail, { recursive: true })
const MODELE = opt('--modele') ?? 'claude-haiku-5-5'
const p3 = (k: number) => String(k).padStart(3, '0')
const nbMots = (s: string) => (s.match(/\p{L}{3,}/gu) ?? []).length

function nbPages(f: string): number {
  return Number(/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))?.[1] ?? 0)
}

function pagesVoulues(): number[] {
  const n = nbPages(pdf!)
  const [a, b] = (opt('--pages') ?? `1-${n}`).split('-').map(Number)
  return Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i).filter((p) => p >= 1 && p <= n)
}

/** Même critère que la chaîne : Claude a rendu moins de 60 % des mots de Tesseract. */
function claudeFaible(k: string): boolean {
  const c = join(travail!, `p${k}.claude.txt`)
  const t = join(travail!, `p${k}.tesseract.txt`)
  if (!existsSync(c) || !existsSync(t)) return false
  const mt = nbMots(readFileSync(t, 'utf8'))
  return mt >= 80 && nbMots(readFileSync(c, 'utf8')) < 0.6 * mt
}

async function pool<T>(items: T[], n: number, fn: (it: T) => Promise<void>) {
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  }))
}

async function appel<T>(fn: () => Promise<T>): Promise<T> {
  for (let essai = 1; ; essai++) {
    try {
      return await fn()
    } catch (e) {
      const status = (e as { status?: number }).status
      if (essai >= 6 || !(status === undefined || status === 429 || status >= 500)) throw e
      await new Promise((r) => setTimeout(r, Math.min(2000 * 2 ** (essai - 1), 60000)))
    }
  }
}

async function lire(moteur: 'tesseract' | 'claude') {
  const pages = pagesVoulues().filter(
    (p) => !existsSync(join(travail!, `p${p3(p)}.${moteur}.txt`)) || (moteur === 'claude' && args.includes('--relire-faibles') && claudeFaible(p3(p))),
  )
  console.log(`${pages.length} page(s) à lire avec ${moteur === 'claude' ? MODELE : 'Tesseract (fra)'}`)
  const client = moteur === 'claude' ? new Anthropic() : null
  let faites = 0
  let echecs = 0
  await pool(pages, Number(opt('--concurrence') ?? (moteur === 'claude' ? 6 : 8)), async (p) => {
    const tmp = mkdtempSync(join(tmpdir(), `ocrpdf-${moteur}-`))
    try {
      let texte: string
      if (moteur === 'tesseract') {
        await executer('pdftoppm', ['-f', String(p), '-l', String(p), '-r', '300', '-gray', '-png', '-singlefile', pdf!, join(tmp, 'p')])
        await executer('tesseract', [join(tmp, 'p.png'), join(tmp, 'p'), '-l', 'fra', '--psm', '3', 'txt', 'tsv'])
        texte = readFileSync(join(tmp, 'p.txt'), 'utf8')
        writeFileSync(join(travail!, `p${p3(p)}.tesseract.tsv`), readFileSync(join(tmp, 'p.tsv')))
      } else {
        await executer('pdfseparate', ['-f', String(p), '-l', String(p), pdf!, join(tmp, 'p.pdf')])
        const data = readFileSync(join(tmp, 'p.pdf')).toString('base64')
        texte = ''
        for (let essai = 1; essai <= 2 && texte.trim().length < 40; essai++) {
          const m = await appel(() =>
            client!.messages
              .stream({
                model: MODELE,
                max_tokens: 16000,
                output_config: { effort: 'low' },
                messages: [{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }, { type: 'text', text: OCR_PROMPT }] }],
              })
              .finalMessage(),
          )
          appendFileSync(join(travail!, '_usage.jsonl'), JSON.stringify({ page: p, modele: MODELE, in: m.usage.input_tokens, out: m.usage.output_tokens }) + '\n')
          texte = cleanOcrText(m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n'))
        }
        if (texte.trim().length < 40) throw new Error(`réponse sans texte (${texte.trim().length} c.)`)
      }
      writeFileSync(join(travail!, `p${p3(p)}.${moteur}.txt`), texte)
      faites++
    } catch (e) {
      echecs++
      appendFileSync(join(travail!, `_echecs-${moteur}.log`), `p${p} : ${(e as Error).message.slice(0, 200)}\n`)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
    if ((faites + echecs) % 20 === 0) console.log(`   ${faites + echecs}/${pages.length} · ${echecs} échec(s)`)
  })
  console.log(`✅ ${moteur} : ${faites} page(s) lue(s), ${echecs} échec(s) (relancer : les pages lues sont sautées)`)
}

/** Fusion page à page, avec le vocabulaire de Claude sur TOUT le fichier (cf. ocr-combine-moniteur). */
function fusionnerTout() {
  const ks = [...new Set(readdirSync(travail!).map((f) => /^p(\d{3})\.(claude|tesseract)\.txt$/.exec(f)?.[1]).filter(Boolean))].sort() as string[]
  const vocabulaire = new Set<string>()
  for (const k of ks) {
    const c = join(travail!, `p${k}.claude.txt`)
    if (existsSync(c)) for (const w of readFileSync(c, 'utf8').split(/\s+/)) if (formeVocabulaire(w)) vocabulaire.add(formeVocabulaire(w))
  }
  const stats: Record<string, { mode: string; reinseres: string[]; desaccords: { tesseract: string; claude: string }[] }> = {}
  for (const k of ks) {
    const c = join(travail!, `p${k}.claude.txt`)
    const t = join(travail!, `p${k}.tesseract.txt`)
    let texte: string
    if (claudeFaible(k)) {
      texte = tesseractPropre(readFileSync(t, 'utf8'))
      stats[k] = { mode: 'repliTesseract', reinseres: [], desaccords: [] }
    } else if (existsSync(c) && existsSync(t)) {
      const f = fusionner(readFileSync(c, 'utf8'), readFileSync(t, 'utf8'), vocabulaire)
      texte = f.texte
      stats[k] = { mode: 'fusion', reinseres: f.reinseres, desaccords: f.desaccords }
    } else if (existsSync(c)) {
      texte = readFileSync(c, 'utf8')
      stats[k] = { mode: 'claudeSeul', reinseres: [], desaccords: [] }
    } else {
      texte = tesseractPropre(readFileSync(t, 'utf8'))
      stats[k] = { mode: 'tesseractSeul', reinseres: [], desaccords: [] }
    }
    writeFileSync(join(travail!, `p${k}.fusion.txt`), texte)
  }
  writeFileSync(join(travail!, '_fusion.json'), JSON.stringify(stats, null, 1))
  const v = Object.values(stats)
  const n = (m: string) => v.filter((x) => x.mode === m).length
  console.log(
    `${v.length} page(s) · ${v.reduce((a, x) => a + x.reinseres.length, 0)} passage(s) réinséré(s) · ${v.reduce((a, x) => a + x.desaccords.length, 0)} désaccord(s) · ${n('claudeSeul')} Claude seul · ${n('tesseractSeul')} Tesseract seul · ${n('repliTesseract')} repli(s) Tesseract`,
  )
}

/** L'en-tête de provenance, débarrassé de sa clause devenue fausse (cf. ocr-combine-moniteur). */
function entete(ancien: string): string {
  const m = /^\[(.*?)\]/s.exec(ancien)
  if (!m) return ''
  return `[${m[1].replace(/\s*Texte intégral non encore océrisé\s*:\s*se référer au PDF source\.?/i, '').replace(/\s{2,}/g, ' ').trim()}]`
}

async function ecrire() {
  const ref = opt('--ref')
  if (!ref) throw new Error('--ref <référence de la fiche d’Éditions> requis')
  const commit = args.includes('--commit')
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  try {
    const fiches = await prisma.document.findMany({
      where: { type: 'LEGISLATION', source: { startsWith: 'MONITEUR_PDF_' }, number: ref },
      select: { id: true, bodyOriginal: true, titleFr: true, moniteurRef: true, searchText: true, metaJson: true, sourcePdfUrl: true },
    })
    if (fiches.length !== 1) throw new Error(`${fiches.length} fiche(s) d’Éditions ${ref}`)
    const d = fiches[0]
    // Le PDF en ligne est-il bien celui qu'on a lu ?
    const b = d.sourcePdfUrl ? await getPrivateBlob(d.sourcePdfUrl) : null
    if (!b?.stream) throw new Error(`${ref} : PDF en ligne introuvable`)
    const enLigne = createHash('sha256').update(Buffer.from(await new Response(b.stream).arrayBuffer())).digest('hex')
    const local = createHash('sha256').update(readFileSync(pdf!)).digest('hex')
    if (enLigne !== local) throw new Error(`${ref} : le PDF en ligne (${enLigne.slice(0, 12)}…) n’est pas --pdf (${local.slice(0, 12)}…)`)
    const n = nbPages(pdf!)
    const ks = Array.from({ length: n }, (_, i) => p3(i + 1))
    const manque = ks.filter((k) => !existsSync(join(travail!, `p${k}.fusion.txt`)))
    if (manque.length) throw new Error(`${manque.length} page(s) sans fusion (${manque.slice(0, 5).join(', ')}…) — lancer --fusionner`)
    const stats = JSON.parse(readFileSync(join(travail!, '_fusion.json'), 'utf8')) as Record<string, { mode: string }>
    const texte = ks.map((k) => readFileSync(join(travail!, `p${k}.fusion.txt`), 'utf8').trim()).filter(Boolean).join('\n\n')
    const corps = `${entete(d.bodyOriginal)}\n\n${texte}`
    const indexe = [buildSearchText({ titleFr: d.titleFr, number: ref, moniteurRef: d.moniteurRef }), fold(texte)].filter(Boolean).join(' ')
    const mots = (s: string) => (s.match(/\S+/g) ?? []).length
    const usages = existsSync(join(travail!, '_usage.jsonl'))
      ? [...new Set(readFileSync(join(travail!, '_usage.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => (JSON.parse(l) as { modele?: string }).modele).filter(Boolean))]
      : []
    const meta = JSON.parse(d.metaJson ?? '{}')
    const replis = ks.filter((k) => stats[k]?.mode !== 'fusion').length
    meta.ocr = { moteurs: `${usages.join(', ') || MODELE} + tesseract-fra`, date: new Date().toISOString().slice(0, 10), pages: n, ...(replis ? { pagesUnMoteur: replis } : {}) }
    // L'index ne baisse jamais en nombre de mots… sauf décision nommée (`--remplacer-index`) : la
    // couche d'un scanner HP COUPE les mots à chaque accent (« comptabilit é », « d éclaration »),
    // ce qui gonfle son compte de fragments. Mesuré sur le Spécial 48-A (13 oct. 2026) : 93 067
    // jetons contre 91 205, et les 2 580 « mots » du scanner absents de la transcription sont
    // TOUS des fragments (« claration », « rification », « comptabilit ») — aucun mot réel perdu.
    const remplaceIndex = mots(indexe) >= mots(d.searchText ?? '') || args.includes('--remplacer-index')
    console.log(`${ref} · ${n} p. · ${texte.length.toLocaleString('fr-FR')} c. · index : ${mots(d.searchText ?? '')} → ${mots(indexe)} mots (${remplaceIndex ? 'remplacé' : 'GARDÉ — la transcription en porte moins'})`)
    console.log(`   « ${texte.slice(0, 200).replace(/\s+/g, ' ')}… »`)
    if (!commit) {
      console.log('(à blanc — --commit pour écrire)')
      return
    }
    await prisma.document.update({
      where: { id: d.id },
      data: { bodyOriginal: corps, metaJson: JSON.stringify(meta), ...(remplaceIndex ? { searchText: indexe } : {}) },
    })
    const relu = await prisma.document.findUnique({ where: { id: d.id }, select: { bodyOriginal: true } })
    if (relu?.bodyOriginal !== corps) throw new Error('relecture : corps différent')
    console.log(`✅ ${ref} : transcription écrite (${corps.length.toLocaleString('fr-FR')} c.), relue`)
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const moteur = opt('--moteur')
  if (args.includes('--ecrire')) await ecrire()
  else if (args.includes('--fusionner')) fusionnerTout()
  else if (moteur === 'tesseract' || moteur === 'claude') await lire(moteur)
  else if (!moteur) await Promise.all([lire('tesseract'), lire('claude')])
  else throw new Error('--moteur tesseract|claude, ou --fusionner')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
