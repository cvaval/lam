/**
 * Fournisseur IA actif + REPLI automatique (redondance Gemini ↔ Anthropic).
 *
 * Configuration dans .env :
 *   LV_AI_PROVIDER=gemini   → GEMINI_API_KEY requis (primaire)
 *   LV_AI_PROVIDER=anthropic (ou absent) → ANTHROPIC_API_KEY requis (primaire)
 *
 * Si les DEUX clés sont présentes, l'autre fournisseur sert de REPLI : quand le
 * primaire est saturé (quota épuisé, 429/503/529), l'opération bascule
 * automatiquement sur le second (voir withAiFallback). Cela évite d'attendre la
 * réinitialisation du quota Gemini — Claude prend le relais immédiatement.
 *
 * LV_AI_MODEL surcharge le modèle du PRIMAIRE uniquement ; le repli garde son
 * défaut. Valeurs par défaut : claude-opus-4-8 (Anthropic) · gemini-2.0-flash (Gemini).
 */

export type AiProvider = 'anthropic' | 'gemini'

export function getProvider(): AiProvider {
  return process.env.LV_AI_PROVIDER?.toLowerCase() === 'gemini' ? 'gemini' : 'anthropic'
}

/** Le fournisseur de repli = l'autre que le primaire. */
export function fallbackProvider(): AiProvider {
  return getProvider() === 'gemini' ? 'anthropic' : 'gemini'
}

/** Une clé est-elle configurée pour ce fournisseur ? */
export function hasKey(p: AiProvider): boolean {
  return p === 'gemini' ? Boolean(process.env.GEMINI_API_KEY) : Boolean(process.env.ANTHROPIC_API_KEY)
}

/** Au moins une clé (primaire OU repli) est configurée. */
export function isAiConfigured(): boolean {
  return hasKey('gemini') || hasKey('anthropic')
}

export function resolveModel(defaults: { anthropic: string; gemini: string }): string {
  const envModel = process.env.LV_AI_MODEL
  return envModel || (getProvider() === 'gemini' ? defaults.gemini : defaults.anthropic)
}

/** Modèle pour un fournisseur donné — LV_AI_MODEL ne surcharge QUE le primaire. */
export function modelFor(provider: AiProvider, defaults: { anthropic: string; gemini: string }): string {
  if (provider === getProvider() && process.env.LV_AI_MODEL) return process.env.LV_AI_MODEL
  return provider === 'gemini' ? defaults.gemini : defaults.anthropic
}

/**
 * Erreur de SATURATION (quota/débit/surcharge) qui justifie de basculer sur le
 * repli — Gemini (« exceeded your current quota », RESOURCE_EXHAUSTED, 429/503)
 * comme Anthropic (429 rate-limit, 529 overloaded). Une erreur déterministe
 * (requête invalide, 400…) n'est PAS une saturation et ne déclenche pas le repli.
 */
export function isExhausted(e: unknown): boolean {
  const msg = String((e as { message?: string })?.message ?? e)
  const status = (e as { status?: number })?.status
  if (status === 429 || status === 503 || status === 529) return true
  return /\b429\b|\b503\b|\b529\b|RESOURCE_EXHAUSTED|UNAVAILABLE|exceeded your current quota|overloaded|rate.?limit|high demand|\bquota\b/i.test(
    msg,
  )
}

/**
 * Exécute l'opération IA sur le primaire, avec repli automatique sur l'autre
 * fournisseur en cas de saturation. `impls` fournit une implémentation par
 * fournisseur ; seules celles dont la clé existe sont tentées, primaire d'abord.
 */
export async function withAiFallback<T>(impls: Record<AiProvider, () => Promise<T>>): Promise<T> {
  const order = ([getProvider(), fallbackProvider()] as AiProvider[]).filter(hasKey)
  if (order.length === 0) throw new Error('Aucune clé IA configurée (GEMINI_API_KEY / ANTHROPIC_API_KEY)')
  let lastErr: unknown
  for (let i = 0; i < order.length; i++) {
    try {
      return await impls[order[i]]()
    } catch (e) {
      lastErr = e
      if (i < order.length - 1 && isExhausted(e)) {
        console.warn(`[ai] ${order[i]} saturé → repli sur ${order[i + 1]} : ${String((e as Error)?.message ?? e).slice(0, 120)}`)
        continue
      }
      throw e
    }
  }
  throw lastErr
}

/** Nettoie le JSON d'une réponse Gemini (retire les balises ```json``` éventuelles). */
export function parseGeminiJson(text: string): unknown {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  return JSON.parse(clean)
}
