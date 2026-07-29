/**
 * SOMMAIRE ANALYTIQUE + INDEX ALPHABÉTIQUE du décret-loi du 27 novembre 1969 sur le
 * Notariat — les deux manquent (le texte fourni est une transcription brute du J.O.).
 *
 * Un seul appel par lot produit les DEUX : la rubrique de sommaire (une phrase décrivant
 * l'article) et les sujets d'index (notions juridiques). Les faire ensemble garantit que
 * le vocabulaire de l'index et celui du sommaire concordent.
 *
 * Gemini prioritaire, repli Claude. INCRÉMENTAL : relancer reprend où l'on s'est arrêté.
 * Sortie : scripts/data/notariat-1969/sommaire-index.json
 *
 *   npx tsx scripts/_gen-notariat-sommaire-index.ts
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

const DIR = 'scripts/data/notariat-1969'
const OUT = `${DIR}/sommaire-index.json`

// Découpe du corps en articles (le corps est déjà réparé par parse_notariat.py).
const body = readFileSync(`${DIR}/bodyOriginal.txt`, 'utf8')
const struct = JSON.parse(readFileSync(`${DIR}/structure.json`, 'utf8')) as { toc: { label: string }[] }
const entetes = new Set(struct.toc.map((t) => t.label))
const arts: { num: string; text: string }[] = []
let cur: { num: string; text: string } | null = null
for (const raw of body.split('\n')) {
  const l = raw.trim()
  if (entetes.has(l)) { cur = null; continue }
  const m = l.match(/^Article\s+(\d{1,3})\.\s*—\s*(.*)$/)
  if (m) { cur = { num: m[1], text: m[2] }; arts.push(cur); continue }
  if (cur) cur.text += ' ' + l
}
console.log(`Articles segmentés : ${arts.length}`)

const PROMPT =
  `Tu prépares l'appareil éditorial du DÉCRET-LOI DU 27 NOVEMBRE 1969 SUR LE NOTARIAT (droit haïtien).\n` +
  `Le notaire y est un OFFICIER PUBLIC : accès à la fonction, examen, stage, serment, incompatibilités, ` +
  `discipline, actes notariés et leur validité, minutes, grosses, expéditions, répertoires, tarif des ` +
  `honoraires, timbre mobile spécial, cautionnement, archives.\n\n` +
  `Pour CHAQUE article, produis :\n` +
  `  "r" = la RUBRIQUE de sommaire : une phrase nominale courte (moins de 110 caractères), sans verbe ` +
  `conjugué, décrivant l'objet de l'article (ex. « Conditions d'accès à la fonction de notaire », ` +
  `« Serment du notaire commissionné ; dépôt du spécimen de signature »).\n` +
  `  "s" = 1 à 5 SUJETS d'index : notions juridiques, substantif au singulier, majuscule initiale ` +
  `(ex. « Cautionnement », « Minute », « Grosse », « Répertoire », « Destitution »).\n` +
  `Règles impératives : RÉUTILISE le MÊME libellé de sujet pour une même notion d'un article à l'autre ; ` +
  `pas de sujet vague (« Loi », « Disposition », « Article », « Règle ») ; n'invente rien.\n` +
  `Le texte est une transcription OCR : ignore les coquilles, ne les recopie pas dans tes libellés.\n` +
  `Réponds UNIQUEMENT en JSON : {"<num>": {"r": "...", "s": ["...", "..."]}, …}`

const defaults = { anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' }

type Sortie = Record<string, { r: string; s: string[] }>

async function pourLot(batch: { num: string; text: string }[]): Promise<Sortie> {
  const doc = batch.map((a) => `Article ${a.num}: ${a.text.slice(0, 900)}`).join('\n')
  const p = `${PROMPT}\n\n${doc}`
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

const BLOC = new Set(['loi', 'droit', 'article', 'disposition', 'principe', 'regle', 'règle', 'decret', 'décret', 'notariat général'])
const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const acquis: Sortie = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {}
  const todo = arts.filter((a) => !acquis[a.num]?.r)
  console.log(`Déjà traités : ${Object.keys(acquis).length} · à traiter : ${todo.length}`)

  const B = 12
  for (let i = 0; i < todo.length; i += B) {
    const lot = todo.slice(i, i + B)
    let res: Sortie = {}
    for (let essai = 0; essai < 4; essai++) {
      try { res = await pourLot(lot); break } catch (e) {
        const msg = (e as Error).message?.slice(0, 90)
        if (essai === 3) { console.warn(`  ⚠ lot ${i} abandonné : ${msg}`); break }
        const w = 15_000 * 2 ** essai
        console.warn(`  lot ${i}, tentative ${essai + 1} échouée (${msg}) → reprise dans ${w / 1000}s`)
        await sleep(w)
      }
    }
    for (const a of lot) {
      const v = res[a.num] || res[`Article ${a.num}`]
      if (!v?.r) continue
      const sujets = (v.s || [])
        .map((x) => String(x).trim().replace(/\s+/g, ' '))
        .filter((x) => x.length >= 3 && x.length <= 70 && !BLOC.has(fold(x)))
      acquis[a.num] = { r: String(v.r).trim().replace(/\s+/g, ' '), s: [...new Set(sujets)] }
    }
    writeFileSync(OUT, JSON.stringify(acquis, null, 1))
    console.log(`  lot ${i}-${i + lot.length} : ${Object.keys(acquis).length}/${arts.length} articles couverts`)
    await sleep(3000)
  }

  const sans = arts.filter((a) => !acquis[a.num]?.r).map((a) => a.num)
  const nSujets = new Set(Object.values(acquis).flatMap((v) => v.s.map(fold))).size
  console.log(`\n✓ ${Object.keys(acquis).length}/${arts.length} rubriques · ${nSujets} sujets distincts → ${OUT}`)
  if (sans.length) console.log(`⚠ articles sans rubrique : ${sans.join(', ')}`)
})().catch((e) => { console.error(e); process.exit(1) })
