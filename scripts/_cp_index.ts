/**
 * Index thématique du Code pénal d'Haïti (IA) → struct.indexEntries.
 * Alimente l'onglet « Index » du menu latéral ET les renvois croisés entre articles apparentés
 * (indexBacklinks : sous chaque article, les autres articles du même sujet — cliquables).
 * Gemini prioritaire, repli Claude ; INCRÉMENTAL (reprend après saturation de quota).
 *
 *   npx tsx scripts/_cp_index.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
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
import { withAiFallback, modelFor, parseGeminiJson } from '@/lib/ai/provider'
import { articleAnchorFromHeading } from '@/lib/doc/anchors'

const D = 'scripts/data/code-penal/parsed' // données versionnées (jamais dans /tmp — audit 2 juil. 2026)
const body = readFileSync(`${D}/bodyOriginal.txt`, 'utf8')
const struct = JSON.parse(readFileSync(`${D}/structure.json`, 'utf8'))
const heads = new Set<string>(struct.toc.map((e: any) => e.label))

// Segmente en articles : {num (suffixe d'ancre : « 240 », « 19-bis », « 227-1 »), anchor, text}
const arts: { num: string; anchor: string; text: string }[] = []
const seen = new Set<string>()
let cur: { num: string; anchor: string; text: string } | null = null
for (const raw of body.split('\n')) {
  const line = raw.trim()
  if (heads.has(line)) { cur = null; continue }
  const a = articleAnchorFromHeading(line)
  if (a) {
    if (seen.has(a)) { cur = null; continue } // 2ᵉ occurrence (art. 64 refondu par décret) : ignorée
    seen.add(a)
    cur = { num: a.replace(/^art-/, ''), anchor: a, text: line.replace(/^Art(?:icle)?\.?\s+\S+\s*/i, '') }
    arts.push(cur)
    continue
  }
  if (cur) cur.text += ' ' + line
}
console.log('Articles segmentés:', arts.length)

const PROMPT =
  `Tu indexes le Code pénal haïtien pour une recherche par thème. Pour CHAQUE article ci-dessous, ` +
  `donne 1 à 4 SUJETS d'index thématiques en français (notions et institutions du droit pénal : ` +
  `ex. « Meurtre », « Assassinat », « Vol », « Escroquerie », « Abus de confiance », « Faux », ` +
  `« Corruption », « Rébellion », « Diffamation », « Séquestration », « Récidive », « Peine de mort », ` +
  `« Travaux forcés », « Attentat à la sûreté de l'État », « Vagabondage »). RÉUTILISE le MÊME libellé ` +
  `de sujet pour un même thème d'un article à l'autre (vocabulaire cohérent, au singulier). ` +
  `Réponds UNIQUEMENT en JSON : {"<num>": ["Sujet A","Sujet B"], ...} où <num> est le numéro exact ` +
  `de l'article (ex. "240", "19-bis", "227-1").`

const defaults = { anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' }
async function themesFor(batch: { num: string; text: string }[]): Promise<Record<string, string[]>> {
  const doc = batch.map((a) => `Article ${a.num}: ${a.text.slice(0, 240)}`).join('\n')
  return withAiFallback({
    gemini: async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
      const r = await ai.models.generateContent({ model: modelFor('gemini', defaults), contents: `${PROMPT}\n\n${doc}`, config: { responseMimeType: 'application/json', maxOutputTokens: 8000 } })
      return parseGeminiJson(r.text ?? '{}') as Record<string, string[]>
    },
    anthropic: async () => {
      const an = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const r = await an.messages.create({ model: modelFor('anthropic', defaults), max_tokens: 4000, messages: [{ role: 'user', content: `${PROMPT}\n\n${doc}` }] })
      const txt = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
      return JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    },
  })
}

// Sujets trop génériques pour un index utile (bruit) — filtrés.
const BLOCK = new Set(['loi', 'droit', 'code pénal', 'code penal', 'article', 'infraction', 'peine', 'disposition', 'règle', 'principe', 'délit', 'crime'])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const B = 30
  const subj = new Map<string, Set<string>>() // sujet -> ensemble d'ancres
  // INCRÉMENTAL : repart des sujets déjà en place (structure.json) et ne retraite que les
  // articles encore sans sujet — permet de reprendre après saturation Gemini (503/429).
  const covered = new Set<string>()
  for (const e of struct.indexEntries ?? []) {
    const s = String(e.subject).trim()
    if (!s) continue
    if (!subj.has(s)) subj.set(s, new Set())
    for (const r of e.ctRefs) { subj.get(s)!.add(`art-${r}`); covered.add(`art-${r}`) }
  }
  const todo = arts.filter((a) => !covered.has(a.anchor))
  console.log(`Déjà couverts: ${covered.size} · à traiter: ${todo.length}`)
  for (let i = 0; i < todo.length; i += B) {
    const batch = todo.slice(i, i + B)
    let res: Record<string, string[]> = {}
    for (let attempt = 0; attempt < 4; attempt++) {
      try { res = await themesFor(batch); break } catch (e) {
        const msg = (e as Error).message?.slice(0, 80)
        if (attempt === 3) { console.warn('batch', i, 'abandonné:', msg); break }
        const wait = 20_000 * 2 ** attempt
        console.warn(`batch ${i} tentative ${attempt + 1} échec (${msg}) → nouvel essai dans ${wait / 1000}s`)
        await sleep(wait)
      }
    }
    let assigned = 0
    for (const a of batch) {
      const list = res[a.num] || res['Article ' + a.num] || res[a.num.replace(/-/g, ' ')] || []
      for (const sRaw of list) {
        const s = String(sRaw).trim().replace(/\s+/g, ' ')
        if (s.length < 2 || s.length > 60) continue
        if (BLOCK.has(s.toLowerCase())) continue
        if (!subj.has(s)) subj.set(s, new Set())
        subj.get(s)!.add(a.anchor); assigned++
      }
    }
    if ((i / B) % 5 === 0 || i + B >= todo.length) console.log(`  batch ${i}-${i + batch.length}: ${assigned} assignations · ${subj.size} sujets cumulés`)
    await sleep(4000) // rester sous le débit/minute de Gemini
  }
  // indexEntries : sujet -> ctRefs (suffixes d'ancre STRING : « 240 », « 19-bis », « 227-1 »),
  // triés numériquement ; dédup des sujets par forme folée.
  const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const merged = new Map<string, { subject: string; anchors: Set<string> }>()
  for (const [s, anchors] of subj) {
    const k = fold(s)
    if (!merged.has(k)) merged.set(k, { subject: s, anchors: new Set() })
    anchors.forEach((x) => merged.get(k)!.anchors.add(x))
  }
  const indexEntries = [...merged.values()].map((v) => ({
    subject: v.subject,
    ctRefs: [...v.anchors]
      .map((a) => a.replace(/^art-/, ''))
      .sort((x, y) => x.localeCompare(y, undefined, { numeric: true })),
  })).sort((a, b) => fold(a.subject).localeCompare(fold(b.subject)))
  struct.indexEntries = indexEntries
  writeFileSync(`${D}/structure.json`, JSON.stringify(struct))
  console.log('\nSujets d’index:', indexEntries.length, '| ex:', JSON.stringify(indexEntries.slice(0, 4)))
  console.log('Sujets partagés (≥2 articles):', indexEntries.filter((e) => e.ctRefs.length >= 2).length)
})()
