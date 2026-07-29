/**
 * SOMMAIRES ANALYTIQUES + INDEX ALPHABÉTIQUES des 7 textes de la compilation Notariat
 * (arrêté 1919, loi 1919, loi 1862, loi 1877, décret-loi 1941, décrets 1974 et 1986).
 *
 * Un appel par texte : rubrique de sommaire + sujets d'index pour chaque article, produits
 * ensemble afin que les deux appareils partagent le même vocabulaire.
 *
 * Gemini prioritaire, repli Claude. INCRÉMENTAL. Sortie : sommaire-index.json.
 *   npx tsx scripts/_gen-notariat-compilation.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
for (const f of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']\s*$/g, '').trim()
    }
  } catch {
    /* absent */
  }
}
import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { withAiFallback, modelFor, parseGeminiJson } from '../src/lib/ai/provider'

const DIR = 'scripts/data/notariat-compilation'
const OUT = `${DIR}/sommaire-index.json`
const textes = JSON.parse(readFileSync(`${DIR}/textes.json`, 'utf8')) as Record<
  string,
  { titre: string; date: string; articles: { num: string; text: string }[] }
>

const CONTEXTE =
  `Le NOTARIAT haïtien : le notaire est un officier public. Matières récurrentes — accès à la ` +
  `fonction (examen, jury, stage, diplôme), nomination et serment, résidence et compétence ` +
  `territoriale, incompatibilités, actes notariés et leur validité, témoins instrumentaires, ` +
  `minutes, grosses, expéditions, répertoires, archives, discipline (suspension, destitution), ` +
  `cautionnement, honoraires et tarif, timbre.`

const defaults = { anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' }
type Sortie = Record<string, { r: string; s: string[] }>

function prompt(titre: string): string {
  return (
    `Tu prépares l'appareil éditorial de « ${titre} » (droit haïtien).\n${CONTEXTE}\n\n` +
    `Pour CHAQUE article, produis :\n` +
    `  "r" = la RUBRIQUE de sommaire : phrase nominale de moins de 110 caractères, sans verbe ` +
    `conjugué, décrivant l'objet de l'article.\n` +
    `  "s" = 1 à 5 SUJETS d'index : notions juridiques, substantif au SINGULIER, majuscule ` +
    `initiale seulement (ex. « Cautionnement », « Minute », « Répertoire », « Destitution ») — ` +
    `sauf les institutions, qui gardent leurs capitales (« Ministère Public », « Tribunal Civil »).\n` +
    `Règles : RÉUTILISE le MÊME libellé pour une même notion d'un article à l'autre ; pas de ` +
    `sujet vague (« Loi », « Disposition », « Article », « Règle ») ; n'invente rien.\n` +
    `Le texte est une transcription OCR : ignore les coquilles, ne les recopie pas.\n` +
    `Réponds UNIQUEMENT en JSON : {"<num>": {"r": "...", "s": ["..."]}, …}`
  )
}

async function pourTexte(titre: string, arts: { num: string; text: string }[]): Promise<Sortie> {
  const doc = arts.map((a) => `Article ${a.num}: ${a.text.slice(0, 800)}`).join('\n')
  const p = `${prompt(titre)}\n\n${doc}`
  return withAiFallback({
    gemini: async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
      const r = await ai.models.generateContent({
        model: modelFor('gemini', defaults),
        contents: p,
        config: { responseMimeType: 'application/json', maxOutputTokens: 8000 },
      })
      return parseGeminiJson(r.text ?? '{}') as Sortie
    },
    anthropic: async () => {
      const an = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const r = await an.messages.create({
        model: modelFor('anthropic', defaults),
        max_tokens: 4000,
        messages: [{ role: 'user', content: p }],
      })
      const t = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
      return JSON.parse(t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    },
  })
}

const BLOC = new Set(['loi', 'droit', 'article', 'disposition', 'principe', 'regle', 'règle', 'decret', 'décret', 'arrete', 'arrêté'])
const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const acquis: Record<string, Sortie> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  for (const [slug, t] of Object.entries(textes)) {
    const deja = acquis[slug] ?? {}
    const todo = t.articles.filter((a) => !deja[a.num]?.r)
    if (!todo.length) { console.log(`✓ ${slug} — déjà complet (${Object.keys(deja).length})`); continue }
    console.log(`\n══ ${t.titre.slice(0, 70)}`)
    console.log(`   ${t.articles.length} articles · à traiter ${todo.length}`)
    const B = 20
    for (let i = 0; i < todo.length; i += B) {
      const lot = todo.slice(i, i + B)
      let res: Sortie = {}
      for (let essai = 0; essai < 4; essai++) {
        try { res = await pourTexte(t.titre, lot); break } catch (e) {
          const msg = (e as Error).message?.slice(0, 90)
          if (essai === 3) { console.warn(`   ⚠ lot ${i} abandonné : ${msg}`); break }
          const w = 15_000 * 2 ** essai
          console.warn(`   lot ${i}, tentative ${essai + 1} échouée (${msg}) → reprise dans ${w / 1000}s`)
          await sleep(w)
        }
      }
      for (const a of lot) {
        const v = res[a.num] || res[`Article ${a.num}`]
        if (!v?.r) continue
        const sujets = (v.s || [])
          .map((x) => String(x).trim().replace(/\s+/g, ' '))
          .filter((x) => x.length >= 3 && x.length <= 70 && !BLOC.has(fold(x)))
        deja[a.num] = { r: String(v.r).trim().replace(/\s+/g, ' '), s: [...new Set(sujets)] }
      }
      acquis[slug] = deja
      writeFileSync(OUT, JSON.stringify(acquis, null, 1))
      console.log(`   lot ${i}-${i + lot.length} : ${Object.keys(deja).length}/${t.articles.length}`)
      await sleep(3000)
    }
  }
  console.log('\n── Bilan ──')
  for (const [slug, t] of Object.entries(textes)) {
    const d = acquis[slug] ?? {}
    const sans = t.articles.filter((a) => !d[a.num]?.r).map((a) => a.num)
    const nS = new Set(Object.values(d).flatMap((v) => v.s.map(fold))).size
    console.log(`  ${slug.padEnd(32)} ${Object.keys(d).length}/${t.articles.length} rubriques · ${nS} sujets`
      + (sans.length ? `  ⚠ manquants ${sans.join(', ')}` : ''))
  }
})().catch((e) => { console.error(e); process.exit(1) })
