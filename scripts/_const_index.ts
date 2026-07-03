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

const D = 'scripts/data/constitution/parsed' // données versionnées (rescapées de /tmp — audit 2 juil. 2026)
const body = readFileSync(`${D}/bodyOriginal.txt`, 'utf8')
const struct = JSON.parse(readFileSync(`${D}/structure.json`, 'utf8'))
const heads = new Set<string>(struct.toc.map((e: any) => e.label))

// Segmente en articles : {num, anchor, text}
const arts: { num: string; anchor: string; text: string }[] = []
let cur: { num: string; anchor: string; text: string } | null = null
const NUM_RE = /^Article\s+(premier|\d{1,3}(?:\s*(?:er|ère))?(?:\s*(?:bis|ter|quater))?(?:[.\-]\d+)*)/i
for (const raw of body.split('\n')) {
  const line = raw.trim()
  const a = articleAnchorFromHeading(line)
  if (a) {
    const m = line.match(NUM_RE)
    cur = { num: m ? m[1].replace(/\s+/g, '') : a.replace('art-', ''), anchor: a, text: '' }
    arts.push(cur)
    continue
  }
  if (heads.has(line)) { cur = null; continue }
  if (cur) cur.text += ' ' + line
}
console.log('Articles segmentés:', arts.length)

const PROMPT =
  `Tu indexes la Constitution haïtienne de 1987 pour une recherche par thème. Pour CHAQUE article ci-dessous, ` +
  `donne 1 à 4 SUJETS d'index thématiques en français (notions, droits, institutions, procédures du droit ` +
  `constitutionnel : ex. « Nationalité », « Liberté d'expression », « Pouvoir législatif », « Élection ` +
  `présidentielle », « Décentralisation »). RÉUTILISE le MÊME libellé de sujet pour un même thème d'un article ` +
  `à l'autre (vocabulaire cohérent, au singulier). Réponds UNIQUEMENT en JSON : {"<num>": ["Sujet A","Sujet B"], ...}.`

const defaults = { anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' }
async function themesFor(batch: { num: string; text: string }[]): Promise<Record<string, string[]>> {
  const doc = batch.map((a) => `Article ${a.num}: ${a.text.slice(0, 260)}`).join('\n')
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

;(async () => {
  const B = 30
  const subj = new Map<string, Set<string>>() // sujet -> ensemble d'ancres
  for (let i = 0; i < arts.length; i += B) {
    const batch = arts.slice(i, i + B)
    let res: Record<string, string[]> = {}
    try { res = await themesFor(batch) } catch (e) { console.warn('batch', i, 'échec', (e as Error).message?.slice(0, 80)) }
    let assigned = 0
    for (const a of batch) {
      const list = res[a.num] || res['Article ' + a.num] || []
      for (const sRaw of list) {
        const s = String(sRaw).trim().replace(/\s+/g, ' ')
        if (s.length < 2 || s.length > 60) continue
        if (!subj.has(s)) subj.set(s, new Set())
        subj.get(s)!.add(a.anchor); assigned++
      }
    }
    console.log(`  batch ${i}-${i + batch.length}: ${assigned} assignations`)
  }
  // indexEntries : sujet -> ctRefs (désignations, triées) ; dédup sujets par forme folée
  const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const merged = new Map<string, { subject: string; anchors: Set<string> }>()
  for (const [s, anchors] of subj) {
    const k = fold(s)
    if (!merged.has(k)) merged.set(k, { subject: s, anchors: new Set() })
    anchors.forEach((x) => merged.get(k)!.anchors.add(x))
  }
  const indexEntries = [...merged.values()].map((v) => ({
    subject: v.subject,
    ctRefs: [...v.anchors].map((a) => a.replace(/^art-/, '')), // désignation d'ancre (ex. « 12-1 »)
  })).sort((a, b) => fold(a.subject).localeCompare(fold(b.subject)))
  struct.indexEntries = indexEntries
  writeFileSync(`${D}/structure.json`, JSON.stringify(struct))
  console.log('\nSujets d’index:', indexEntries.length, '| ex:', JSON.stringify(indexEntries.slice(0, 4)))
  console.log('Sujets partagés (≥2 articles):', indexEntries.filter((e) => e.ctRefs.length >= 2).length)
})()
