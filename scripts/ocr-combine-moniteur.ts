/**
 * Océrisation COMBINÉE (Claude + Tesseract) des fascicules du Moniteur sans texte.
 *
 *   # 1. Lectures, page par page, reprenables (rien n'est écrit en base) — les deux en parallèle :
 *   npx tsx scripts/ocr-combine-moniteur.ts --moteur tesseract --travail <dossier> [--locaux <inventaires>]
 *   npx tsx scripts/ocr-combine-moniteur.ts --moteur claude    --travail <dossier> [--locaux <inventaires>]
 *   # 2. Fusion (aucun appel IA) :
 *   npx tsx scripts/ocr-combine-moniteur.ts --fusionner --travail <dossier>
 *   # 3. Écriture : à blanc, puis --commit :
 *   npx tsx scripts/ocr-combine-moniteur.ts --ecrire --travail <dossier> [--commit]
 *   Options : --annees 2019,2020 · --refs LM2019-81 · --limit N · --concurrence N
 *
 * CIBLE : les fiches d'Éditions (source MONITEUR_PDF_*) qui n'ont NI transcription dans le corps
 * NI couche de texte cherchable (< 200 c./page — le seuil de la fiche). 1 968 au 12 oct. 2026.
 *
 * POURQUOI DEUX MOTEURS : voir `lib/fusion-ocr.ts`. Claude rend un texte propre mais saute parfois
 * des mots ; Tesseract (local, gratuit, modèle `fra`) lit tout mais estropie des lettres. On garde
 * le texte de Claude et on y réinsère ce que Tesseract seul a lu. Les divergences de plusieurs mots
 * sont comptées par fascicule (`_fusion.json`), jamais tranchées d'office.
 *
 * ÉCRITURE : comme `verser-texte-moniteur-dans-corps.ts` — en-tête de provenance conservé (trois
 * scripts y lisent le nom du fichier), débarrassé de « Texte intégral non encore océrisé » ; puis la
 * transcription. L'index (`searchText`) est reconstruit du même texte, jamais à la baisse.
 * `metaJson.ocr` garde la provenance. Le fac-similé reste la source citable.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import { OCR_PROMPT, cleanOcrText } from '../src/lib/ai/extract'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { getPrivateBlob, isBlobUrl } from '../src/lib/storage/blob'
import { fusionner } from './lib/fusion-ocr'

const prisma = new PrismaClient()
const MODELE = process.env.LV_AI_MODEL || 'claude-haiku-5-5'

interface Cible {
  id: string
  number: string
  sourcePdfUrl: string
  pages: number
}

const args = process.argv.slice(2)
const opt = (nom: string) => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined)
const travail = opt('--travail')
if (!travail) throw new Error('--travail <dossier> requis')
mkdirSync(travail, { recursive: true })
const p3 = (k: number) => String(k).padStart(3, '0')

/** Les fiches sans aucun texte (corps = en-tête seul, index < 200 c./page). */
async function cibles(): Promise<Cible[]> {
  const annees = opt('--annees')?.split(',')
  const refs = opt('--refs')?.split(',')
  const lignes = await prisma.$queryRaw<{ id: string; number: string; sourcePdfUrl: string; pages: number; source: string }[]>`
    SELECT id, number, "sourcePdfUrl", source,
           coalesce(nullif(substring("metaJson" from '"pages":(\\d+)'), '')::int, 1) AS pages
    FROM "Document"
    WHERE type = 'LEGISLATION' AND source LIKE 'MONITEUR_PDF_%'
      AND length(btrim(regexp_replace("bodyOriginal", '^\\[[^]]*\\]', ''))) = 0
      AND coalesce(length("searchText"), 0) < 200 * coalesce(nullif(substring("metaJson" from '"pages":(\\d+)'), '')::int, 1)
    ORDER BY "publicationDate", number`
  return lignes
    .filter((l) => (!annees || annees.includes(l.source.slice(13))) && (!refs || refs.includes(l.number)))
    .slice(0, Number(opt('--limit') ?? Infinity))
}

/** Parties locales du fascicule (inventaires du versement), sinon le PDF en ligne téléchargé une fois. */
function localiser(): (c: Cible) => Promise<string[]> {
  const locaux = new Map<string, string[]>()
  const dossier = opt('--locaux')
  if (dossier) {
    for (const f of readdirSync(dossier).filter((x) => /^\d{4}\.json$/.test(x))) {
      for (const x of (JSON.parse(readFileSync(join(dossier, f), 'utf8')) as { fascicules: { ref: string; fichiers: string[] }[] }).fascicules) {
        if (x.fichiers.every((p) => existsSync(p))) locaux.set(x.ref.toUpperCase().replace(/-/g, ''), x.fichiers)
      }
    }
  }
  return async (c) => {
    const l = locaux.get(c.number.toUpperCase().replace(/-/g, ''))
    if (l) return l
    const cache = join(travail!, c.number, 'source.pdf')
    if (!existsSync(cache)) {
      if (!isBlobUrl(c.sourcePdfUrl)) throw new Error(`${c.number} : ni fichier local ni PDF en ligne`)
      const b = await getPrivateBlob(c.sourcePdfUrl)
      if (!b?.stream) throw new Error(`${c.number} : blob introuvable`)
      mkdirSync(join(travail!, c.number), { recursive: true })
      writeFileSync(cache, Buffer.from(await new Response(b.stream).arrayBuffer()))
    }
    return [cache]
  }
}

function nbPages(f: string): number {
  return Number(/^Pages:\s+(\d+)/m.exec(execFileSync('pdfinfo', [f], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))?.[1] ?? 0)
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

/** Lit chaque page avec un moteur ; une page déjà lue (fichier présent) est sautée. */
async function lire(moteur: 'tesseract' | 'claude') {
  const liste = await cibles()
  const loc = localiser()
  const travaux: { ref: string; part: string; page: number; k: number }[] = []
  for (const c of liste) {
    let k = 0
    for (const part of await loc(c)) {
      const n = nbPages(part)
      for (let p = 1; p <= n; p++) {
        k++
        if (!existsSync(join(travail!, c.number, `p${p3(k)}.${moteur}.txt`))) travaux.push({ ref: c.number, part, page: p, k })
      }
    }
  }
  console.log(`${liste.length} fascicule(s) · ${travaux.length} page(s) à lire avec ${moteur === 'claude' ? MODELE : 'Tesseract (fra)'}`)
  const client = moteur === 'claude' ? new Anthropic() : null
  let faites = 0
  let echecs = 0
  const debut = Date.now()
  await pool(travaux, Number(opt('--concurrence') ?? (moteur === 'claude' ? 12 : 8)), async (t) => {
    const dir = join(travail!, t.ref)
    mkdirSync(dir, { recursive: true })
    const tmp = mkdtempSync(join(tmpdir(), `ocr-${moteur}-`))
    try {
      let texte: string
      if (moteur === 'tesseract') {
        execFileSync('pdftoppm', ['-f', String(t.page), '-l', String(t.page), '-r', '300', '-gray', '-png', '-singlefile', t.part, join(tmp, 'p')], { stdio: 'ignore' })
        execFileSync('tesseract', [join(tmp, 'p.png'), join(tmp, 'p'), '-l', 'fra', '--psm', '3'], { stdio: 'ignore' })
        texte = readFileSync(join(tmp, 'p.txt'), 'utf8')
      } else {
        execFileSync('pdfseparate', ['-f', String(t.page), '-l', String(t.page), t.part, join(tmp, 'p.pdf')], { stdio: 'ignore' })
        const data = readFileSync(join(tmp, 'p.pdf')).toString('base64')
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
        appendFileSync(join(travail!, '_usage.jsonl'), JSON.stringify({ ref: t.ref, k: t.k, in: m.usage.input_tokens, out: m.usage.output_tokens }) + '\n')
        texte = cleanOcrText(m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n'))
      }
      writeFileSync(join(dir, `p${p3(t.k)}.${moteur}.txt`), texte)
      faites++
    } catch (e) {
      echecs++
      appendFileSync(join(travail!, `_echecs-${moteur}.log`), `${t.ref} p${t.k} : ${(e as Error).message.slice(0, 200)}\n`)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
    if ((faites + echecs) % 200 === 0) {
      const min = (Date.now() - debut) / 60000
      console.log(`   ${faites + echecs}/${travaux.length} · ${echecs} échec(s) · ${min.toFixed(0)} min`)
    }
  })
  console.log(`✅ ${moteur} : ${faites} page(s) lue(s), ${echecs} échec(s) (relancer : les pages lues sont sautées)`)
}

/** Fusionne page à page ; une page lue par un seul moteur garde cette lecture (et c'est noté). */
async function fusionnerTout() {
  const rapport: Record<string, { pages: number; reinseres: number; desaccords: number; claudeSeul: number; tesseractSeul: number; manquantes: number }> = {}
  for (const ref of readdirSync(travail!).filter((x) => /^LM\d{4}-/.test(x))) {
    const dir = join(travail!, ref)
    const ks = [...new Set(readdirSync(dir).map((f) => /^p(\d{3})\.(claude|tesseract)\.txt$/.exec(f)?.[1]).filter(Boolean))].sort() as string[]
    const r = { pages: ks.length, reinseres: 0, desaccords: 0, claudeSeul: 0, tesseractSeul: 0, manquantes: 0 }
    for (const k of ks) {
      const c = join(dir, `p${k}.claude.txt`)
      const t = join(dir, `p${k}.tesseract.txt`)
      let texte: string
      if (existsSync(c) && existsSync(t)) {
        const f = fusionner(readFileSync(c, 'utf8'), readFileSync(t, 'utf8'))
        texte = f.texte
        r.reinseres += f.reinseres.length
        r.desaccords += f.desaccords.length
      } else if (existsSync(c)) {
        texte = readFileSync(c, 'utf8')
        r.claudeSeul++
      } else {
        texte = readFileSync(t, 'utf8')
        r.tesseractSeul++
      }
      writeFileSync(join(dir, `p${k}.fusion.txt`), texte)
    }
    rapport[ref] = r
  }
  writeFileSync(join(travail!, '_fusion.json'), JSON.stringify(rapport, null, 1))
  const v = Object.values(rapport)
  const s = (k: keyof (typeof v)[number]) => v.reduce((n, x) => n + x[k], 0)
  console.log(`${v.length} fascicule(s) · ${s('pages')} page(s) · ${s('reinseres')} passage(s) réinséré(s) depuis Tesseract · ${s('desaccords')} désaccord(s) · ${s('claudeSeul')} page(s) Claude seul · ${s('tesseractSeul')} Tesseract seul`)
}

/** L'en-tête de provenance, débarrassé de sa clause devenue fausse (cf. verser-texte-moniteur-dans-corps). */
function entete(ancien: string): string {
  const m = /^\[(.*?)\]/s.exec(ancien)
  if (!m) return ''
  return `[${m[1].replace(/\s*Texte intégral non encore océrisé\s*:\s*se référer au PDF source\.?/i, '').replace(/\s{2,}/g, ' ').trim()}]`
}
const mots = (s: string) => (s.match(/\S+/g) ?? []).length

async function ecrire() {
  const commit = args.includes('--commit')
  const liste = await cibles()
  const rapport = JSON.parse(readFileSync(join(travail!, '_fusion.json'), 'utf8')) as Record<string, { pages: number }>
  let ecrites = 0
  let incompletes = 0
  const exemples: string[] = []
  for (const c of liste) {
    const dir = join(travail!, c.number)
    const r = rapport[c.number]
    // Toutes les pages doivent être lues : un fascicule à moitié transcrit ferait croire au lecteur
    // que la fiche est complète.
    if (!r || r.pages < c.pages) {
      incompletes++
      continue
    }
    const ks = readdirSync(dir).filter((f) => /^p\d{3}\.fusion\.txt$/.test(f)).sort()
    const texte = ks.map((f) => readFileSync(join(dir, f), 'utf8').trim()).filter(Boolean).join('\n\n')
    const d = await prisma.document.findUnique({ where: { id: c.id }, select: { bodyOriginal: true, titleFr: true, moniteurRef: true, searchText: true, metaJson: true } })
    if (!d) continue
    const corps = `${entete(d.bodyOriginal)}\n\n${texte}`
    const indexe = [buildSearchText({ titleFr: d.titleFr, number: c.number, moniteurRef: d.moniteurRef }), fold(texte)].filter(Boolean).join(' ')
    const meta = JSON.parse(d.metaJson ?? '{}')
    meta.ocr = { moteurs: `${MODELE} + tesseract-fra`, date: new Date().toISOString().slice(0, 10), pages: ks.length }
    if (exemples.length < 3) exemples.push(`${c.number} · ${ks.length} p. · ${texte.length.toLocaleString('fr-FR')} c. · « ${texte.slice(0, 160).replace(/\s+/g, ' ')}… »`)
    if (commit) {
      await prisma.document.update({
        where: { id: c.id },
        data: { bodyOriginal: corps, metaJson: JSON.stringify(meta), ...(mots(indexe) > mots(d.searchText ?? '') ? { searchText: indexe } : {}) },
      })
    }
    ecrites++
  }
  for (const e of exemples) console.log(`   ${e}`)
  console.log(`\n${commit ? '✅' : '(à blanc)'} ${ecrites} fiche(s) ${commit ? 'écrites' : 'à écrire'} · ${incompletes} sautée(s) faute de toutes leurs pages lues`)
}

async function main() {
  const moteur = opt('--moteur')
  if (moteur === 'tesseract' || moteur === 'claude') await lire(moteur)
  else if (args.includes('--fusionner')) await fusionnerTout()
  else if (args.includes('--ecrire')) await ecrire()
  else throw new Error('préciser --moteur tesseract|claude, --fusionner ou --ecrire')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
