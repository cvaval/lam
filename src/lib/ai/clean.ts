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
// Chevauchement entre tranches (préserve le contexte de couture)
const OVERLAP_CHARS = 400

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
 * Nettoie le texte d'un document. Pour les très longs textes, découpe aux
 * frontières de paragraphes et traite tranche par tranche.
 */
export async function cleanBodyText(body: string): Promise<string> {
  if (!body.trim()) return body

  // Document court : traitement direct
  if (body.length <= MAX_CHARS) return cleanChunk(body)

  // Documents longs : découpe aux frontières de paragraphes
  const segments: string[] = []
  let pos = 0

  while (pos < body.length) {
    const end = Math.min(pos + MAX_CHARS, body.length)

    // Cherche la dernière frontière de paragraphe avant la limite
    let cutAt = end
    if (end < body.length) {
      const nnIdx = body.lastIndexOf('\n\n', end)
      const nIdx = body.lastIndexOf('\n', end)
      cutAt = nnIdx > pos + MAX_CHARS * 0.6 ? nnIdx : nIdx > pos + MAX_CHARS * 0.6 ? nIdx : end
    }

    segments.push(body.slice(pos, cutAt))
    if (cutAt >= body.length) break
    // Chevauchement : reprend un peu avant la coupure pour préserver le contexte
    pos = Math.max(cutAt - OVERLAP_CHARS, pos + 1)
  }

  // Traitement séquentiel (préserve l'ordre ; parallèle surchargerait les quotas)
  const cleaned: string[] = []
  for (const seg of segments) {
    cleaned.push(await cleanChunk(seg))
  }

  return cleaned.join('\n')
}
