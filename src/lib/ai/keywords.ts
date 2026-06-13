import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { GoogleGenAI } from '@google/genai'
// L'helper zod du SDK requiert l'API zod v4 (sous-chemin fourni par zod ≥ 3.25).
import { z } from 'zod/v4'
import { fold } from '../search/normalize'
import { getProvider, isAiConfigured, resolveModel, parseGeminiJson } from './provider'

/**
 * Mots-clés THÉMATIQUES d'un document (indexation par thèmes pour la recherche).
 *
 * Deux moteurs, même philosophie que l'extraction du CMS (src/lib/ai/extract.ts) :
 *  - IA (Claude ou Gemini, sortie structurée) si la clé du fournisseur est configurée ;
 *  - repli heuristique par LEXIQUE juridique haïtien (regex sur texte accent-folé)
 *    sinon — la plateforme reste utilisable sans clé.
 *
 * Fournisseur : LV_AI_PROVIDER=gemini → GEMINI_API_KEY (tier gratuit disponible)
 *               LV_AI_PROVIDER=anthropic (défaut) → ANTHROPIC_API_KEY
 *
 * Stockage : Document.keywords, chaîne « kw1; kw2; … » (SQLite — pas de tableaux).
 * Consommé par buildSearchText (poids dans search/fields.ts) et la fiche document.
 */

export { isAiConfigured } from './provider'

export const KEYWORDS_SEPARATOR = '; '
const MAX_KEYWORDS = 10

export const KeywordsSchema = z.object({
  keywords: z
    .array(z.string())
    .describe(
      "5 à 10 mots-clés thématiques en FRANÇAIS, du plus au moins central : matières juridiques, notions, institutions, objets du texte (ex. « politique monétaire », « réserves obligatoires », « blanchiment de capitaux », « société anonyme »). Minuscules sauf noms propres/sigles ; pas de phrases.",
    ),
})

/** Nettoie une liste de mots-clés : trim, vides ôtés, doublons (insensible casse/accents) ôtés. */
export function normalizeKeywords(list: (string | null | undefined)[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const kw = (raw ?? '').replace(/\s+/g, ' ').trim().replace(/^[-•·;,]+|[;,.]+$/g, '').trim()
    if (kw.length < 2 || kw.length > 80) continue
    const key = fold(kw)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(kw)
    if (out.length >= MAX_KEYWORDS) break
  }
  return out
}

/** « kw1; kw2 » ↔ liste — formes de stockage et d'édition (champ du CMS). */
export function joinKeywords(list: string[]): string | null {
  const norm = normalizeKeywords(list)
  return norm.length ? norm.join(KEYWORDS_SEPARATOR) : null
}
export function splitKeywords(stored: string | null | undefined): string[] {
  return normalizeKeywords((stored ?? '').split(/[;,]/))
}

// ── Repli heuristique : lexique des thèmes du corpus juridique haïtien ──
// Regex appliquées au texte accent-folé (minuscules, sans accents — voir fold()).
const LEXICON: { kw: string; re: RegExp }[] = [
  // Droit bancaire & BRH
  { kw: 'politique monétaire', re: /politique monetaire/g },
  { kw: 'réserves obligatoires', re: /reserves? obligatoires?/g },
  { kw: "taux d'intérêt", re: /taux d'?interets?/g },
  { kw: 'marché des changes', re: /marche des changes|operations? en devises|taux de change/g },
  { kw: 'ratio de solvabilité', re: /ratio de solvabilite|adequation du capital/g },
  { kw: 'classification des prêts', re: /classification des prets/g },
  { kw: 'provisions pour créances douteuses', re: /provisions? pour creances douteuses/g },
  { kw: 'supervision bancaire', re: /supervision bancaire|inspection des banques/g },
  { kw: 'liquidité', re: /\bliquidites?\b|coefficient de liquidite/g },
  { kw: 'blanchiment de capitaux', re: /blanchiment (de capitaux|des capitaux|d'argent)/g },
  { kw: 'financement du terrorisme', re: /financement du terrorisme/g },
  { kw: 'LBC/FT', re: /\blbc\/?ft\b|lutte contre le blanchiment/g },
  { kw: 'vigilance et connaissance de la clientèle (KYC)', re: /\bkyc\b|connaissance de la clientele|obligations? de vigilance/g },
  { kw: 'UCREF', re: /\bucref\b/g },
  { kw: 'monnaie électronique', re: /monnaie electronique|services financiers numeriques|portefeuille electronique/g },
  { kw: 'maisons de transfert', re: /maisons? de transfert|transfert de fonds/g },
  { kw: "coopératives d'épargne et de crédit", re: /cooperatives? d'?epargne/g },
  { kw: 'banques commerciales', re: /banques? commerciales?/g },
  { kw: "banques d'épargne et de logement", re: /banques? d'?epargne et de logement/g },
  { kw: 'cartes de crédit', re: /cartes? de credit/g },
  { kw: 'prêts au logement', re: /prets? au logement|credit hypothecaire/g },
  { kw: 'garanties', re: /garanties? admissibles?|suretes mobilieres|nantissement/g },
  { kw: 'capital minimum', re: /capital (social )?minimum/g },
  // Sociétés, commerce, fiscalité
  { kw: 'société anonyme', re: /societes? anonymes?/g },
  { kw: 'registre du commerce', re: /registre du commerce/g },
  { kw: 'marque de fabrique et de commerce', re: /marques? de fabrique|marques? de commerce/g },
  { kw: 'propriété intellectuelle', re: /propriete intellectuelle|droits? d'auteur/g },
  // « taxes » exclu : trop fréquent au sens « frais » dans les circulaires bancaires.
  { kw: 'fiscalité', re: /\bfiscalite\b|\bimpots?\b|matiere fiscale/g },
  { kw: 'douanes', re: /\bdouanes?\b|droits de douane/g },
  { kw: "budget de l'État", re: /loi de finances|budget (general |de l'etat)/g },
  { kw: 'exercice fiscal', re: /exercice fiscal/g },
  // Institutions & procédure
  { kw: 'Cour de cassation', re: /cour de cassation/g },
  { kw: 'procédure civile', re: /procedure civile/g },
  { kw: 'droit du travail', re: /droit du travail|code du travail/g },
  { kw: 'fonction publique', re: /fonction publique|fonctionnaires?/g },
  { kw: 'élections', re: /\belectoral(e|es)?\b|\belections?\b/g },
  { kw: "état d'urgence", re: /etat d'urgence/g },
  { kw: 'nomination', re: /\bnommant\b|\bnominations?\b/g },
  { kw: 'autorisation de fonctionnement', re: /autorisation de fonctionnement|autorisant le fonctionnement/g },
]

/**
 * Extraction heuristique : score chaque entrée du lexique par fréquence dans le
 * corps + bonus si présente dans le titre/matière. Pure et déterministe.
 */
export function heuristicKeywords(input: { titleFr?: string | null; matiere?: string | null; body?: string | null }): string[] {
  const head = fold(`${input.titleFr ?? ''} ${input.matiere ?? ''}`)
  const body = fold((input.body ?? '').slice(0, 40_000))
  const scored: { kw: string; score: number }[] = []
  for (const { kw, re } of LEXICON) {
    const inBody = (body.match(re) ?? []).length
    const inHead = (head.match(re) ?? []).length
    const score = Math.min(inBody, 8) + inHead * 5
    if (score > 0) scored.push({ kw, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return normalizeKeywords(scored.map((s) => s.kw))
}

// ── Moteur IA ──

const MAX_BODY_CHARS = 24_000 // ~6k tokens : largement assez pour les thèmes

const PROMPT = `Tu es documentaliste juridique pour Lam, plateforme de recherche du droit haïtien.
Extrais les mots-clés THÉMATIQUES de ce document (loi, circulaire BRH, arrêt, doctrine, loi de finances ou marque) pour son indexation : matières juridiques, notions, institutions et objets centraux du texte.
Règles : en français ; 5 à 10 mots-clés, du plus au moins central ; courts (1 à 5 mots, jamais de phrase) ; minuscules sauf noms propres et sigles (BRH, UCREF, KYC…) ; ne reprends pas le numéro ni la date du document.`

export interface KeywordsOutcome {
  keywords: string[]
  ai: boolean
}

// ── Anthropic ──

async function anthropicKeywords(
  input: { titleFr?: string | null; matiere?: string | null; body?: string | null },
  model: string,
): Promise<string[]> {
  const client = new Anthropic()
  const doc = [
    input.titleFr ? `Titre : ${input.titleFr}` : null,
    input.matiere ? `Matière : ${input.matiere}` : null,
    `Texte :\n${(input.body ?? '').slice(0, MAX_BODY_CHARS)}`,
  ]
    .filter(Boolean)
    .join('\n')
  const response = await client.messages.parse({
    model,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: `${PROMPT}\n\n${doc}` }],
    output_config: { format: zodOutputFormat(KeywordsSchema) },
  })
  if (!response.parsed_output) throw new Error('Extraction de mots-clés : sortie non analysable')
  return normalizeKeywords(response.parsed_output.keywords)
}

// ── Gemini ──

const GEMINI_JSON_HINT =
  '\n\nRéponds UNIQUEMENT en JSON valide : {"keywords": ["mot-clé 1", "mot-clé 2", ...]}'

async function geminiKeywords(
  input: { titleFr?: string | null; matiere?: string | null; body?: string | null },
  model: string,
): Promise<string[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const doc = [
    input.titleFr ? `Titre : ${input.titleFr}` : null,
    input.matiere ? `Matière : ${input.matiere}` : null,
    `Texte :\n${(input.body ?? '').slice(0, MAX_BODY_CHARS)}`,
  ]
    .filter(Boolean)
    .join('\n')
  const response = await ai.models.generateContent({
    model,
    contents: `${PROMPT}\n\n${doc}${GEMINI_JSON_HINT}`,
    config: { responseMimeType: 'application/json' },
  })
  const parsed = parseGeminiJson(response.text ?? '{}')
  const result = KeywordsSchema.safeParse(parsed)
  if (!result.success) throw new Error('Gemini : réponse invalide pour les mots-clés')
  return normalizeKeywords(result.data.keywords)
}

// ── Dispatch ──

async function aiKeywords(
  input: { titleFr?: string | null; matiere?: string | null; body?: string | null },
  model?: string,
): Promise<string[]> {
  const m = model ?? resolveModel({ anthropic: 'claude-opus-4-8', gemini: 'gemini-2.0-flash' })
  return getProvider() === 'gemini' ? geminiKeywords(input, m) : anthropicKeywords(input, m)
}

/** Point d'entrée : IA si configurée, heuristique sinon (jamais d'échec sec). */
export async function extractKeywords(
  input: { titleFr?: string | null; matiere?: string | null; body?: string | null },
  opts?: { model?: string },
): Promise<KeywordsOutcome> {
  if (isAiConfigured()) {
    try {
      return { keywords: await aiKeywords(input, opts?.model), ai: true }
    } catch (e) {
      console.warn('Mots-clés IA échoués, repli heuristique :', (e as Error).message)
    }
  }
  return { keywords: heuristicKeywords(input), ai: false }
}
