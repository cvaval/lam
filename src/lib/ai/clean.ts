import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import { withAiFallback, modelFor } from './provider'

/**
 * Correction orthographique et grammaticale du corps d'un document juridique.
 *
 * Utilise le fournisseur IA actif (Gemini ou Anthropic, avec repli automatique).
 * Modèles légers suffisants pour la correction (Haiku / Flash) — coût minimal.
 *
 * Résultat : bodyClean (String?) sur le Document — affiché à la place de
 * bodyOriginal, qui reste intact en base (§02). Si bodyClean est null, la page
 * affiche bodyOriginal tel quel.
 *
 * Traitement par tranches pour les lois de finances longues (>80 000 caractères)
 * avec découpe aux frontières de paragraphes.
 */

const MODELS = { anthropic: 'claude-haiku-4-5-20251001', gemini: 'gemini-2.0-flash' }

// Caractères max par appel IA (~20k tokens input)
const MAX_CHARS = 80_000

const PROMPT = `Tu es correcteur de textes juridiques officiels haïtiens (lois de finances, décrets, circulaires BRH).
Corrige UNIQUEMENT les erreurs d'orthographe, de grammaire et d'OCR dans le texte suivant.

RÈGLES ABSOLUES :
1. Conserve tels quels : montants et chiffres, dates, numéros d'articles/alinéas, noms propres, sigles (BRH, DGI, MEF, UCREF, HTG, USD…), terminologie juridique.
2. Ne reformule pas, ne résume pas, ne complète pas le texte.
3. Conserve la structure exacte : titres, numérotations, sauts de ligne, paragraphes.
4. Corrige : accents manquants ou erronés, lettres confondues par l'OCR (ex. « I » → « l », « 0 » → « O »), mots coupés par l'OCR, doubles espaces, fautes de grammaire manifestes.
5. En cas de doute, laisse le texte tel quel.

Restitue UNIQUEMENT le texte corrigé, sans commentaire.

---
`

async function cleanChunk(text: string): Promise<string> {
  return withAiFallback({
    gemini: async () => {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
      const response = await ai.models.generateContent({
        model: modelFor('gemini', MODELS),
        contents: PROMPT + text,
      })
      return response.text?.trim() ?? text
    },
    anthropic: async () => {
      const client = new Anthropic()
      const msg = await client.messages.create({
        model: modelFor('anthropic', MODELS),
        max_tokens: 16000,
        messages: [{ role: 'user', content: PROMPT + text }],
      })
      const block = msg.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
      return block?.text.trim() ?? text
    },
  })
}

/**
 * Découpe un long texte en tranches CONTIGUËS (sans chevauchement) aux frontières
 * de paragraphes (sinon de lignes). Le séparateur de chaque coupure est EXCLU de
 * la tranche et mémorisé à part — `cleanChunk` rogne les espaces de bord, donc la
 * tranche ne doit pas porter le séparateur, qu'on réinsère ensuite à l'identique.
 * Propriété : `parts.map(p => p.text + p.sep).join('') === body` (reconstruction
 * fidèle, sans duplication ni perte). Exporté pour test unitaire.
 */
export function splitForCleaning(body: string): { text: string; sep: string }[] {
  const parts: { text: string; sep: string }[] = []
  let pos = 0
  while (pos < body.length) {
    let end = Math.min(pos + MAX_CHARS, body.length)
    let sep = ''
    if (end < body.length) {
      // Dernière frontière de paragraphe (sinon de ligne) après 60 % de la tranche.
      const floor = pos + Math.floor(MAX_CHARS * 0.6)
      const nn = body.lastIndexOf('\n\n', end)
      const n = body.lastIndexOf('\n', end)
      if (nn >= floor) {
        end = nn
        sep = '\n\n'
      } else if (n >= floor) {
        end = n
        sep = '\n'
      }
      // sinon : coupe dure sans séparateur (rare — fenêtre sans saut de ligne)
    }
    parts.push({ text: body.slice(pos, end), sep })
    pos = end + sep.length // avance APRÈS le séparateur (jamais réinclus)
  }
  return parts
}

/**
 * Nettoie le texte d'un document. Les très longs textes sont traités par tranches
 * contiguës (voir splitForCleaning) puis réassemblés avec leur séparateur exact.
 */
export async function cleanBodyText(body: string): Promise<string> {
  if (!body.trim()) return body

  // Document court : traitement direct
  if (body.length <= MAX_CHARS) return cleanChunk(body)

  // Documents longs : traitement séquentiel (parallèle surchargerait les quotas).
  const out: string[] = []
  for (const part of splitForCleaning(body)) {
    out.push(await cleanChunk(part.text))
    out.push(part.sep)
  }
  return out.join('')
}
