/**
 * Recherche DANS le Code du travail (et autres textes annotés) : appariement des articles
 * applicables à une requête, au fil de la frappe, avec expansion IA optionnelle (thèmes
 * proches via Gemini ↔ Claude). Les articles sont segmentés une fois puis mis en cache.
 */
import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db'
import { fold } from '../search/normalize'
import { parseAnnotations, segmentAnnotated } from './annotated'
import { labelFromAnchor } from './articles'
import { withAiFallback, isAiConfigured, modelFor, parseGeminiJson } from '../ai/provider'

export interface CodeArticle {
  n: number
  anchor: string // art-N
  label: string // « Article 12 »
  fold: string // corps accent-folé (matching)
  snippet: string // extrait d'affichage
}
export interface CodeHit {
  n: number
  anchor: string
  label: string
  snippet: string
}

// Segmentation mise en cache par document (recalculée seulement si le doc change d'id).
// Bornée (LRU simple) : un ré-import crée un nouvel id → on purge les entrées périmées.
const cache = new Map<string, CodeArticle[]>()
const CACHE_MAX = 8

/** Course contre un timeout : un appel IA lent ne doit pas bloquer la requête. */
function withTimeout<T>(p: Promise<T>, ms = 7000): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('ai-timeout')), ms))])
}

export async function getCodeArticles(docId: string): Promise<CodeArticle[]> {
  const hit = cache.get(docId)
  if (hit) return hit
  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { bodyOriginal: true, annotationsJson: true } })
  const ann = doc && parseAnnotations(doc.annotationsJson)
  if (!doc || !ann) return []
  const seen = new Set<string>()
  const arts: CodeArticle[] = []
  for (const b of segmentAnnotated(doc.bodyOriginal, ann.toc)) {
    // Articles du Code uniquement (1ʳᵉ occurrence — noAnchors écarte les homonymes d'annexes).
    if (b.kind !== 'body' || !b.anchor || b.noAnchors || seen.has(b.anchor)) continue
    const m = b.anchor.match(/^art-(\d+)/)
    if (!m) continue
    seen.add(b.anchor)
    const body = b.text.replace(/^Article\s+[^\n.]*[.\-–]\s*/i, '').replace(/\s+/g, ' ').trim()
    arts.push({ n: Number(m[1]), anchor: b.anchor, label: labelFromAnchor(b.anchor), fold: fold(b.text), snippet: body.slice(0, 180) })
  }
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string) // évince la plus ancienne
  cache.set(docId, arts)
  return arts
}

// Mots-vides FR (≤4 lettres) : ignorés pour ne pas appareiller sur du bruit grammatical.
const STOP = new Set(
  'les des une est que qui par sur aux son ses ont pour dans avec sont cette ces leur leurs tout tous nous vous elle ils mais lors dont sans plus peut doit etre fait sous'.split(' '),
)

/**
 * Articles applicables : on tokenise la requête (et les thèmes IA, souvent des locutions) en
 * MOTS significatifs ; le score = nombre de mots distincts trouvés (+ bonus numéro d'article).
 */
export function matchArticles(articles: CodeArticle[], rawTerms: string[], numQuery: number | null, limit = 40): CodeArticle[] {
  const words = [
    ...new Set(rawTerms.flatMap((t) => fold(t).split(/[^a-z0-9]+/)).filter((w) => w.length >= 3 && !STOP.has(w))),
  ]
  if (!words.length && numQuery == null) return []
  const scored = articles
    .map((a) => {
      let score = 0
      for (const w of words) if (a.fold.includes(w)) score++
      if (numQuery != null && a.n === numQuery) score += 5 // « 112 » → article 112 en tête
      return { a, score }
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.a.n - y.a.n)
  return scored.slice(0, limit).map((x) => x.a)
}

/** Thèmes/termes juridiques proches de la requête (IA Gemini, repli Claude). [] si non configuré. */
export async function expandThemes(query: string): Promise<string[]> {
  if (!isAiConfigured()) return []
  const prompt =
    `Tu aides à rechercher dans le Code du travail haïtien. Pour la requête « ${query.slice(0, 100)} », ` +
    `donne 6 à 10 termes ou concepts juridiques PROCHES en français (synonymes, notions liées, vocabulaire ` +
    `du droit du travail) utiles pour retrouver les articles applicables. ` +
    `Réponds UNIQUEMENT en JSON : {"terms": ["terme 1", "terme 2", ...]}`
  const defaults = { anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.0-flash' }
  const take = (v: unknown): string[] => {
    const t = (v as { terms?: unknown })?.terms
    return Array.isArray(t) ? t.filter((x): x is string => typeof x === 'string').slice(0, 12) : []
  }
  try {
    return await withAiFallback({
      gemini: async () => {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
        const r = await withTimeout(ai.models.generateContent({ model: modelFor('gemini', defaults), contents: prompt, config: { responseMimeType: 'application/json' } }))
        return take(parseGeminiJson(r.text ?? '{}'))
      },
      anthropic: async () => {
        const a = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
        const r = await withTimeout(a.messages.create({ model: modelFor('anthropic', defaults), max_tokens: 300, messages: [{ role: 'user', content: prompt }] }))
        const txt = r.content.map((c) => (c.type === 'text' ? c.text : '')).join('')
        return take(JSON.parse(txt.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()))
      },
    })
  } catch {
    return []
  }
}
