/**
 * Génération des INDEX ALPHABÉTIQUES manquants — corpus « électronique » :
 *   · Décret du 9 décembre 2015 sur la signature électronique
 *   · Décret du 6 janvier 2016 sur l'administration électronique
 *   · Loi du 14 février 2017 sur les échanges électroniques
 *
 * (La loi de 2017 sur la signature et le décret de 2025 ont déjà leur index, fourni par la
 * cliente — ils ne sont pas retraités ici.)
 *
 * Gemini prioritaire, repli Claude. INCRÉMENTAL : relancer le script reprend là où il s'est
 * arrêté (les sujets déjà obtenus sont relus depuis index-<slug>.json).
 *
 * Sortie : scripts/data/electronique-2015-2025/index-<slug>.json
 *          { sujet: [refs…] } trié alphabétiquement (tri français, insensible aux accents).
 * Le rendu Word (format de la cliente) est produit ensuite par render_index_docx.py.
 *
 *   npx tsx scripts/_gen-index-electronique.ts
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

const DIR = 'scripts/data/electronique-2015-2025'
const data = JSON.parse(readFileSync(`${DIR}/articles.json`, 'utf8')) as Record<
  string,
  { titre: string; articles: { num: string; text: string }[] }
>

/** Orientation thématique par texte : oriente le vocabulaire, sans le dicter. */
const CADRAGE: Record<string, string> = {
  'decret-2015-signature':
    'signature électronique, preuve littérale, acte authentique, acte sous seing privé, notariat, ' +
    'prestataire de services de certification électronique, certificat électronique, CONATEL, ' +
    'qualification, inspection, responsabilité, cessation d’activités',
  'decret-2016-administration':
    'administration électronique, administré, service public, démarche administrative, guichet unique, ' +
    'identification électronique, authentification, interopérabilité, registre administratif, ' +
    'notification électronique, archivage, protection des données, accessibilité',
  'loi-2017-echanges':
    'échanges électroniques, message de données, échange de données informatisées (EDI), expéditeur, ' +
    'destinataire, accusé de réception, formation du contrat, force probante, conservation, ' +
    'transport de marchandises, connaissement',
}

const defaults = { anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' }

function promptFor(slug: string, titre: string): string {
  return (
    `Tu construis un INDEX ALPHABÉTIQUE juridique pour « ${titre} » (droit haïtien).\n` +
    `Pour CHAQUE article ci-dessous, donne 1 à 5 SUJETS d'index en français.\n` +
    `Règles impératives :\n` +
    `— un sujet est une NOTION juridique, un substantif au SINGULIER, en minuscules sauf ` +
    `majuscule initiale (ex. « Accusé de réception », « Force probante », « Prestataire de ` +
    `services de certification ») ;\n` +
    `— RÉUTILISE rigoureusement le MÊME libellé pour une même notion d'un article à l'autre ` +
    `(un index n'a de valeur que si le vocabulaire est constant) ;\n` +
    `— pas de sujet vague (« Loi », « Disposition », « Article », « Principe », « Règle ») ;\n` +
    `— n'invente rien : le sujet doit être réellement traité par l'article.\n` +
    `Univers thématique attendu : ${CADRAGE[slug]}.\n` +
    `Réponds UNIQUEMENT en JSON : {"<num>": ["Sujet A","Sujet B"], …} où <num> est le numéro ` +
    `exact de l'article tel qu'il t'est donné (ex. "1", "9-1", "51").`
  )
}

async function sujetsPour(slug: string, titre: string, batch: { num: string; text: string }[]) {
  const doc = batch.map((a) => `Article ${a.num}: ${a.text.slice(0, 700)}`).join('\n')
  const p = `${promptFor(slug, titre)}\n\n${doc}`
  return withAiFallback({
    gemini: async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
      const r = await ai.models.generateContent({
        model: modelFor('gemini', defaults),
        contents: p,
        config: { responseMimeType: 'application/json', maxOutputTokens: 8000 },
      })
      return parseGeminiJson(r.text ?? '{}') as Record<string, string[]>
    },
    anthropic: async () => {
      const an = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
      const r = await an.messages.create({
        model: modelFor('anthropic', defaults),
        max_tokens: 4000,
        messages: [{ role: 'user', content: p }],
      })
      const txt = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
      return JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim())
    },
  })
}

/** Sujets trop génériques pour un index utile. */
const BLOC = new Set([
  'loi', 'droit', 'article', 'disposition', 'principe', 'règle', 'regle', 'décret', 'decret',
  'texte', 'objet', 'champ d’application générale', 'généralités', 'generalites',
])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fold = (x: string) => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
/** Tri français : accents ignorés, puis ordre naturel. */
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
/** Tri des renvois : « 9 » avant « 9-1 » avant « 10 ». */
function cmpRef(a: string, b: string): number {
  const [a1, a2] = a.split('-').map(Number)
  const [b1, b2] = b.split('-').map(Number)
  return a1 - b1 || (a2 || 0) - (b2 || 0)
}

;(async () => {
  for (const [slug, { titre, articles }] of Object.entries(data)) {
    const out = `${DIR}/index-${slug}.json`
    const subj = new Map<string, Set<string>>()
    const couverts = new Set<string>()
    if (existsSync(out)) {
      const prev = JSON.parse(readFileSync(out, 'utf8')) as Record<string, string[]>
      for (const [s, refs] of Object.entries(prev)) {
        subj.set(s, new Set(refs))
        refs.forEach((r) => couverts.add(r))
      }
    }
    const todo = articles.filter((a) => !couverts.has(a.num))
    console.log(`\n══ ${titre}`)
    console.log(`   ${articles.length} articles · déjà couverts ${couverts.size} · à traiter ${todo.length}`)
    if (!todo.length) { console.log('   ✓ index déjà complet'); continue }

    const B = 15
    for (let i = 0; i < todo.length; i += B) {
      const batch = todo.slice(i, i + B)
      let res: Record<string, string[]> = {}
      for (let essai = 0; essai < 4; essai++) {
        try { res = await sujetsPour(slug, titre, batch); break } catch (e) {
          const msg = (e as Error).message?.slice(0, 90)
          if (essai === 3) { console.warn(`   ⚠ lot ${i} abandonné : ${msg}`); break }
          const w = 15_000 * 2 ** essai
          console.warn(`   lot ${i}, tentative ${essai + 1} échouée (${msg}) → reprise dans ${w / 1000}s`)
          await sleep(w)
        }
      }
      let n = 0
      for (const a of batch) {
        const list = res[a.num] || res[`Article ${a.num}`] || []
        for (const brut of list) {
          const s = String(brut).trim().replace(/\s+/g, ' ')
          if (s.length < 3 || s.length > 70) continue
          if (BLOC.has(fold(s))) continue
          if (!subj.has(s)) subj.set(s, new Set())
          subj.get(s)!.add(a.num)
          n++
        }
      }
      console.log(`   lot ${i}-${i + batch.length} : ${n} assignations · ${subj.size} sujets cumulés`)
      // Sauvegarde après CHAQUE lot : une interruption ne perd rien.
      const partiel = Object.fromEntries([...subj].map(([s, r]) => [s, [...r].sort(cmpRef)]))
      writeFileSync(out, JSON.stringify(partiel, null, 1))
      await sleep(3000)
    }

    // Fusion des doublons de casse/accent, puis tri alphabétique français.
    const fusion = new Map<string, { sujet: string; refs: Set<string> }>()
    for (const [s, refs] of subj) {
      const k = fold(s)
      if (!fusion.has(k)) fusion.set(k, { sujet: s, refs: new Set() })
      refs.forEach((r) => fusion.get(k)!.refs.add(r))
    }
    const trie = [...fusion.values()].sort((a, b) => collator.compare(a.sujet, b.sujet))
    const final = Object.fromEntries(trie.map((e) => [e.sujet, [...e.refs].sort(cmpRef)]))
    writeFileSync(out, JSON.stringify(final, null, 1))
    const nRefs = Object.values(final).reduce((s, r) => s + r.length, 0)
    const orphelins = articles.filter((a) => !Object.values(final).some((r) => r.includes(a.num)))
    console.log(`   ✓ ${Object.keys(final).length} sujets · ${nRefs} renvois → ${out}`)
    if (orphelins.length) console.log(`   ⚠ articles sans aucun sujet : ${orphelins.map((a) => a.num).join(', ')}`)
  }
})().catch((e) => { console.error(e); process.exit(1) })
