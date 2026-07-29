/**
 * Rubriques de sommaire manquantes : décrets de 2015 (signature) et 2016 (administration
 * électronique) — la cliente n'avait fourni de sommaire pour aucun des deux.
 * Gemini prioritaire, repli Claude. → scripts/data/electronique-2015-2025/rubriques.json
 *   npx tsx scripts/_gen-rubriques-electronique.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
for (const f of ['.env.local', '.env']) {
  try { for (const l of readFileSync(f, 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']\s*$/g, '').trim() } } catch { /* absent */ }
}
import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { withAiFallback, modelFor, parseGeminiJson } from '../src/lib/ai/provider'
const DIR = 'scripts/data/electronique-2015-2025'
const textes = JSON.parse(readFileSync(`${DIR}/textes.json`, 'utf8')) as Record<string, { articles: { num: string; text: string }[] }>
const CIBLES: [string, string][] = [
  ['decret-2015-signature', 'Décret du 9 décembre 2015 sur la signature électronique'],
  ['decret-2016-administration', 'Décret du 6 janvier 2016 reconnaissant le droit de tout administré à s’adresser à l’administration publique par des moyens électroniques'],
]
const defaults = { anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const out: Record<string, Record<string, string>> = existsSync(`${DIR}/rubriques.json`)
    ? JSON.parse(readFileSync(`${DIR}/rubriques.json`, 'utf8')) : {}
  for (const [slug, titre] of CIBLES) {
    const deja = out[slug] ?? {}
    const todo = textes[slug].articles.filter((a) => !deja[a.num])
    if (!todo.length) { console.log(`✓ ${slug} complet`); continue }
    console.log(`\n══ ${titre.slice(0, 66)}\n   ${todo.length} rubriques à produire`)
    for (let i = 0; i < todo.length; i += 18) {
      const lot = todo.slice(i, i + 18)
      const p = `Tu rédiges le SOMMAIRE ANALYTIQUE de « ${titre} » (droit haïtien).\n`
        + `Pour CHAQUE article, une RUBRIQUE : phrase nominale de moins de 110 caractères, sans verbe conjugué, `
        + `décrivant l'objet de l'article (ex. « Conditions de qualification des prestataires de certification »).\n`
        + `Réponds UNIQUEMENT en JSON : {"<num>": "<rubrique>", …}\n\n`
        + lot.map((a) => `Article ${a.num}: ${a.text.slice(0, 700)}`).join('\n')
      let res: Record<string, string> = {}
      for (let e = 0; e < 4; e++) {
        try {
          res = await withAiFallback({
            gemini: async () => {
              const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
              const r = await ai.models.generateContent({ model: modelFor('gemini', defaults), contents: p, config: { responseMimeType: 'application/json', maxOutputTokens: 6000 } })
              return parseGeminiJson(r.text ?? '{}') as Record<string, string>
            },
            anthropic: async () => {
              const an = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
              const r = await an.messages.create({ model: modelFor('anthropic', defaults), max_tokens: 3000, messages: [{ role: 'user', content: p }] })
              const t = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
              return JSON.parse(t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
            },
          }); break
        } catch (err) { if (e === 3) { console.warn(`   ⚠ lot ${i} abandonné`); break }; await sleep(15_000 * 2 ** e) }
      }
      for (const a of lot) { const v = res[a.num] || res[`Article ${a.num}`]; if (v) deja[a.num] = String(v).trim().replace(/\s+/g, ' ') }
      out[slug] = deja
      writeFileSync(`${DIR}/rubriques.json`, JSON.stringify(out, null, 1))
      console.log(`   ${Object.keys(deja).length}/${textes[slug].articles.length}`)
      await sleep(3000)
    }
  }
  for (const [slug] of CIBLES) console.log(`  ${slug.padEnd(30)} ${Object.keys(out[slug] ?? {}).length}/${textes[slug].articles.length} rubriques`)
})().catch((e) => { console.error(e); process.exit(1) })
