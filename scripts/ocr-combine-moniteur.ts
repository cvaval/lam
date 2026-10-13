/**
 * Océrisation COMBINÉE (Claude + Tesseract) des fascicules du Moniteur sans texte.
 *
 *   # 1. Lectures, page par page, reprenables (rien n'est écrit en base) — les deux en parallèle :
 *   npx tsx scripts/ocr-combine-moniteur.ts --moteur tesseract --travail <dossier> [--locaux <inventaires>]
 *   npx tsx scripts/ocr-combine-moniteur.ts --moteur claude    --travail <dossier> [--locaux <inventaires>]
 *   # 2. Fusion (aucun appel IA ; incrémentale — `--tout` refait toutes les pages) :
 *   npx tsx scripts/ocr-combine-moniteur.ts --fusionner --travail <dossier>
 *   # 3. Écriture : à blanc, puis --commit. Rejouable PAR LOTS pendant que les moteurs tournent :
 *   #    n'est écrit qu'un fascicule dont CHAQUE page a ses deux lectures et une fusion à jour.
 *   npx tsx scripts/ocr-combine-moniteur.ts --ecrire --travail <dossier> [--final] [--commit]
 *   --final (une fois les moteurs ET la relecture des pages faibles terminés) : accepte qu'une page
 *   n'ait qu'une lecture (Claude en échec sur une page blanche, Tesseract sur une page illisible) ou
 *   que Claude y reste incomplet — le repli est compté dans `metaJson.ocr`.
 *   Options : --annees 2019,2020 · --refs LM2019-81 · --limit N · --concurrence N
 *   --relire-faibles (avec --moteur claude) : relit les pages où Claude a rendu moins de 60 % des
 *   mots de Tesseract (réponse vide ou tronquée — 4 pages sur les 2 100 premières).
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
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import { OCR_PROMPT, cleanOcrText } from '../src/lib/ai/extract'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { getPrivateBlob, isBlobUrl } from '../src/lib/storage/blob'
import { SEUIL_LISIBLE, formeVocabulaire, fusionner, partLisible, tesseractPropre } from './lib/fusion-ocr'

const prisma = new PrismaClient()
// ⚠️ ASYNCHRONE, OU LE « PARALLÈLE » EST UN LEURRE : `execFileSync` bloque la boucle d'événements,
// et huit « travailleurs » s'exécutaient alors un par un — 23 pages/min au lieu de 300.
const executer = promisify(execFile)
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
const nbMots = (s: string) => (s.match(/\p{L}{3,}/gu) ?? []).length

/**
 * Lecture de Claude manifestement incomplète face à celle de Tesseract.
 * ⚠️ AUDIT DU 12 OCT. 2026 : trois pages de 2013 avaient une réponse VIDE (Claude avait pourtant
 * produit ~2 000 jetons, sans bloc de texte exploitable) et une quatrième la moitié du texte. La
 * fusion part du texte de Claude : une base vide aurait donné une page vide, alors que Tesseract
 * en avait lu 480 mots.
 */
function claudeFaible(dossier: string, k: string): boolean {
  const c = join(dossier, `p${k}.claude.txt`)
  const t = join(dossier, `p${k}.tesseract.txt`)
  if (!existsSync(c) || !existsSync(t)) return false
  const mt = nbMots(readFileSync(t, 'utf8'))
  return mt >= 80 && nbMots(readFileSync(c, 'utf8')) < 0.6 * mt
}

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
      -- ⚠️ « pages »: 0 (ancien compteur, avant le repli pdfinfo) rendait le seuil nul : 15 fiches
      -- sans texte se croyaient cherchables. On compte au moins une page.
      AND coalesce(length("searchText"), 0) < 200 * greatest(coalesce(nullif(substring("metaJson" from '"pages":(\\d+)'), '')::int, 1), 1)
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
      // Écrit puis renommé : l'autre moteur, qui tourne en parallèle, ne lit jamais un fichier à moitié écrit.
      const partiel = `${cache}.${process.pid}.part`
      writeFileSync(partiel, Buffer.from(await new Response(b.stream).arrayBuffer()))
      renameSync(partiel, cache)
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
        const dejaLue = existsSync(join(travail!, c.number, `p${p3(k)}.${moteur}.txt`))
        const aRelire = moteur === 'claude' && args.includes('--relire-faibles') && claudeFaible(join(travail!, c.number), p3(k))
        if (!dejaLue || aRelire) travaux.push({ ref: c.number, part, page: p, k })
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
        await executer('pdftoppm', ['-f', String(t.page), '-l', String(t.page), '-r', '300', '-gray', '-png', '-singlefile', t.part, join(tmp, 'p')])
        await executer('tesseract', [join(tmp, 'p.png'), join(tmp, 'p'), '-l', 'fra', '--psm', '3'])
        texte = readFileSync(join(tmp, 'p.txt'), 'utf8')
      } else {
        await executer('pdfseparate', ['-f', String(t.page), '-l', String(t.page), t.part, join(tmp, 'p.pdf')])
        const data = readFileSync(join(tmp, 'p.pdf')).toString('base64')
        texte = ''
        // Une réponse sans texte exploitable est redemandée une fois, puis tenue pour un échec :
        // rien n'est écrit, et la relance la reprendra.
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
          appendFileSync(join(travail!, '_usage.jsonl'), JSON.stringify({ ref: t.ref, k: t.k, in: m.usage.input_tokens, out: m.usage.output_tokens }) + '\n')
          texte = cleanOcrText(m.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n'))
        }
        if (texte.trim().length < 40) throw new Error(`réponse sans texte (${texte.trim().length} c.)`)
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

type ModeFusion = 'fusion' | 'claudeSeul' | 'tesseractSeul' | 'repliTesseract' | 'claudeGarde' | 'illisible'
type StatPage = { mode: ModeFusion; reinseres: number; desaccords: number }
const lireStats = (dir: string): Record<string, StatPage> => (existsSync(join(dir, '_fusion.json')) ? JSON.parse(readFileSync(join(dir, '_fusion.json'), 'utf8')) : {})
const mtime = (f: string) => (existsSync(f) ? statSync(f).mtimeMs : 0)
/** La fusion de la page est postérieure à ses deux lectures (une relecture la rend périmée). */
const fusionAJour = (dir: string, k: string) => {
  const f = mtime(join(dir, `p${k}.fusion.txt`))
  return f > 0 && f >= mtime(join(dir, `p${k}.claude.txt`)) && f >= mtime(join(dir, `p${k}.tesseract.txt`))
}

/**
 * Fusionne page à page ; une page lue par un seul moteur garde cette lecture (et c'est noté).
 * INCRÉMENTALE : une page dont la fusion est postérieure à ses deux lectures est sautée (28 000 pages
 * d'alignement mot à mot à chaque lot, sinon). Les comptes par page restent dans `<ref>/_fusion.json`.
 */
async function fusionnerTout() {
  const tout = args.includes('--tout')
  const rapport: Record<string, { pages: number; reinseres: number; desaccords: number; claudeSeul: number; tesseractSeul: number; repliTesseract: number; claudeGarde: number; illisible: number }> = {}
  // Vocabulaire de Claude sur TOUT le corpus lu : un mot que Claude n'écrit nulle part n'est pas une
  // omission mais une faute ou un débris de Tesseract (audit du 12 oct. : 271 → 55 réinsertions).
  const refs = readdirSync(travail!).filter((x) => /^LM\d{4}-/.test(x))
  const vocabulaire = new Set<string>()
  for (const ref of refs)
    for (const f of readdirSync(join(travail!, ref)).filter((x) => x.endsWith('.claude.txt')))
      for (const w of readFileSync(join(travail!, ref, f), 'utf8').split(/\s+/)) {
        const v = formeVocabulaire(w)
        if (v) vocabulaire.add(v)
      }
  for (const ref of refs) {
    const dir = join(travail!, ref)
    const ks = [...new Set(readdirSync(dir).map((f) => /^p(\d{3})\.(claude|tesseract)\.txt$/.exec(f)?.[1]).filter(Boolean))].sort() as string[]
    const stats = lireStats(dir)
    for (const k of ks) {
      if (!tout && stats[k] && fusionAJour(dir, k)) continue
      const c = join(dir, `p${k}.claude.txt`)
      const t = join(dir, `p${k}.tesseract.txt`)
      let texte: string
      let s: StatPage = { mode: 'fusion', reinseres: 0, desaccords: 0 }
      if (claudeFaible(dir, k)) {
        // Claude vide ou tronqué même après relecture : Tesseract complet vaut mieux qu'une page vide —
        // À CONDITION QU'IL AIT LU. Sur un tableau imprimé en travers, ses « mots » sont du texte à
        // l'envers (cf. `partLisible`) : la lecture partielle de Claude, qui le signale, est gardée.
        const tt = tesseractPropre(readFileSync(t, 'utf8'))
        if (partLisible(tt, vocabulaire) >= SEUIL_LISIBLE) {
          texte = tt
          s.mode = 'repliTesseract'
        } else {
          texte = readFileSync(c, 'utf8')
          s.mode = 'claudeGarde'
        }
      } else if (existsSync(c) && existsSync(t)) {
        const f = fusionner(readFileSync(c, 'utf8'), readFileSync(t, 'utf8'), vocabulaire)
        texte = f.texte
        s = { mode: 'fusion', reinseres: f.reinseres.length, desaccords: f.desaccords.length }
      } else if (existsSync(c)) {
        texte = readFileSync(c, 'utf8')
        s.mode = 'claudeSeul'
      } else {
        // Tesseract brut porte les débris de marge : la même toilette que pour le repli. Illisible
        // (Claude refusé — filtre de contenu — sur un tableau tourné), on le dit plutôt que de le verser.
        const tt = tesseractPropre(readFileSync(t, 'utf8'))
        if (partLisible(tt, vocabulaire) >= SEUIL_LISIBLE) {
          texte = tt
          s.mode = 'tesseractSeul'
        } else {
          texte = `[Page ${Number(k)} non transcrite : se reporter au fac-similé.]`
          s.mode = 'illisible'
        }
      }
      writeFileSync(join(dir, `p${k}.fusion.txt`), texte)
      stats[k] = s
    }
    writeFileSync(join(dir, '_fusion.json'), JSON.stringify(stats))
    const v = Object.values(stats)
    const n = (m: ModeFusion) => v.filter((x) => x.mode === m).length
    rapport[ref] = {
      pages: v.length,
      reinseres: v.reduce((a, x) => a + x.reinseres, 0),
      desaccords: v.reduce((a, x) => a + x.desaccords, 0),
      claudeSeul: n('claudeSeul'),
      tesseractSeul: n('tesseractSeul'),
      repliTesseract: n('repliTesseract'),
      claudeGarde: n('claudeGarde'),
      illisible: n('illisible'),
    }
  }
  writeFileSync(join(travail!, '_fusion.json'), JSON.stringify(rapport, null, 1))
  const v = Object.values(rapport)
  const s = (k: keyof (typeof v)[number]) => v.reduce((n, x) => n + x[k], 0)
  console.log(`${v.length} fascicule(s) · ${s('pages')} page(s) · ${s('reinseres')} passage(s) réinséré(s) depuis Tesseract · ${s('desaccords')} désaccord(s) · ${s('claudeSeul')} page(s) Claude seul · ${s('tesseractSeul')} Tesseract seul · ${s('repliTesseract')} repli(s) sur Tesseract (Claude incomplet) · ${s('claudeGarde')} page(s) où Claude est gardé (Tesseract illisible) · ${s('illisible')} illisible(s)`)
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
  const final = args.includes('--final')
  const liste = await cibles()
  const loc = localiser()
  let ecrites = 0
  const sautees = { pagesNonLues: 0, uneSeuleLecture: 0, claudeIncomplet: 0, fusionPerimee: 0 }
  const exemples: string[] = []
  for (const c of liste) {
    const dir = join(travail!, c.number)
    // Toutes les pages doivent être lues : un fascicule à moitié transcrit ferait croire au lecteur
    // que la fiche est complète. ⚠️ On compte les pages des FICHIERS, pas `metaJson.pages`, qui vaut
    // 0 ou manque sur des fiches anciennes (audit du 12 oct.).
    // ⚠️ ET PAR LES DEUX MOTEURS : écrit par lots pendant que les lectures tournent, un fascicule déjà lu
    // par Claude mais pas encore par Tesseract partirait en base sans la fusion — et, sorti des cibles
    // (il a désormais un texte), ne serait jamais repris.
    const pagesReelles = (await loc(c)).reduce((n, f) => n + nbPages(f), 0)
    const ks = Array.from({ length: pagesReelles }, (_, i) => p3(i + 1))
    const stats = lireStats(dir)
    const motif = (k: string): keyof typeof sautees | null => {
      const aC = existsSync(join(dir, `p${k}.claude.txt`))
      const aT = existsSync(join(dir, `p${k}.tesseract.txt`))
      if (!aC && !aT) return 'pagesNonLues'
      if (!(aC && aT) && !final) return 'uneSeuleLecture'
      if (claudeFaible(dir, k) && !final) return 'claudeIncomplet'
      if (!stats[k] || !fusionAJour(dir, k)) return 'fusionPerimee'
      return null
    }
    const motifs = ks.map(motif).filter((m): m is keyof typeof sautees => m !== null)
    if (pagesReelles === 0 || motifs.length) {
      sautees[motifs[0] ?? 'pagesNonLues']++
      continue
    }
    const texte = ks.map((k) => readFileSync(join(dir, `p${k}.fusion.txt`), 'utf8').trim()).filter(Boolean).join('\n\n')
    const replis = ks.filter((k) => stats[k].mode !== 'fusion').length
    const d = await prisma.document.findUnique({ where: { id: c.id }, select: { bodyOriginal: true, titleFr: true, moniteurRef: true, searchText: true, metaJson: true } })
    if (!d) continue
    const corps = `${entete(d.bodyOriginal)}\n\n${texte}`
    const indexe = [buildSearchText({ titleFr: d.titleFr, number: c.number, moniteurRef: d.moniteurRef }), fold(texte)].filter(Boolean).join(' ')
    const meta = JSON.parse(d.metaJson ?? '{}')
    meta.ocr = { moteurs: `${MODELE} + tesseract-fra`, date: new Date().toISOString().slice(0, 10), pages: ks.length, ...(replis ? { pagesUnMoteur: replis } : {}) }
    if (!meta.pages) meta.pages = pagesReelles
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
  console.log(`\n${commit ? '✅' : '(à blanc)'} ${ecrites} fiche(s) ${commit ? 'écrites' : 'à écrire'} · sautées : ${sautees.pagesNonLues} pages non lues, ${sautees.uneSeuleLecture} une seule lecture, ${sautees.claudeIncomplet} Claude incomplet (à relire), ${sautees.fusionPerimee} fusion à refaire`)
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
