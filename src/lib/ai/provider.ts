/**
 * Fournisseur IA actif : Anthropic (défaut) ou Google Gemini.
 *
 * Configuration dans .env :
 *   LV_AI_PROVIDER=gemini   → GEMINI_API_KEY requis
 *   LV_AI_PROVIDER=anthropic (ou absent) → ANTHROPIC_API_KEY requis
 *
 * LV_AI_MODEL peut surcharger le modèle dans les deux cas.
 * Valeurs par défaut : claude-opus-4-8 (Anthropic) · gemini-2.0-flash (Gemini).
 */

export type AiProvider = 'anthropic' | 'gemini'

export function getProvider(): AiProvider {
  return process.env.LV_AI_PROVIDER?.toLowerCase() === 'gemini' ? 'gemini' : 'anthropic'
}

export function isAiConfigured(): boolean {
  return getProvider() === 'gemini'
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY)
}

export function resolveModel(defaults: { anthropic: string; gemini: string }): string {
  const envModel = process.env.LV_AI_MODEL
  return envModel || (getProvider() === 'gemini' ? defaults.gemini : defaults.anthropic)
}

/** Nettoie le JSON d'une réponse Gemini (retire les balises ```json``` éventuelles). */
export function parseGeminiJson(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(clean)
}
