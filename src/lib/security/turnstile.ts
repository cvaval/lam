/**
 * VÉRIFICATION HUMAINE — Cloudflare Turnstile (prompt : docs/prompt-verification-humaine-turnstile.md).
 *
 * Toute demande d'un tiers pour figurer sur la plateforme (notaire aujourd'hui, avocat demain)
 * passe par `verifierHumain` AVANT d'être enregistrée. Le module ne connaît aucune profession :
 * il reçoit l'`action` (`notary-request`, `lawyer-request`…). Un test sentinelle impose son
 * appel à toute route publique de demande.
 *
 * ⚠️ AUCUN IMPORT NODE : la constante de CSP est lue par le middleware (runtime edge).
 * ⚠️ JAMAIS le jeton ni la clé secrète dans un journal, un audit ou un message d'erreur.
 *
 * Clés : `TURNSTILE_SITE_KEY` (publique, lue côté serveur et passée au composant — pas de
 * `NEXT_PUBLIC_` : changer de clé ne doit pas exiger de reconstruire) et `TURNSTILE_SECRET_KEY`.
 * En local et sur le banc : les clés de TEST publiques de Cloudflare (`1x000…AA`).
 */

export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com'
/** Rendu EXPLICITE (React garde la main). Adresse EXACTE : ni copie, ni proxy, ni cache. */
export const TURNSTILE_SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`
export const SITEVERIFY_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/siteverify`
/** Nom du champ caché que le widget ajoute au formulaire. */
export const CHAMP_JETON = 'cf-turnstile-response'
/** Hôtes déclarés dans le widget de production (tableau de bord Cloudflare, 9 oct. 2026). */
export const HOTES_PRODUCTION = ['agora.ht', 'www.agora.ht'] as const
export const ACTIONS_HUMAIN = { notaryRequest: 'notary-request', lawyerRequest: 'lawyer-request' } as const
export const JETON_MAX = 2048
/** Un jeton vaut 300 s à compter de la résolution du défi. */
export const AGE_MAX_MS = 300_000
const DELAI_APPEL_MS = 5_000

/**
 * Pages qui affichent le widget — et elles SEULES reçoivent la CSP élargie à Cloudflare
 * (`script-src` + `frame-src`). Aucune autre page ne doit pouvoir appeler Cloudflare.
 */
const PAGES_WIDGET = [/^\/(fr|en|ht)\/juridictions\/notaires\/demande\/?$/]
export const pageAvecVerificationHumaine = (chemin: string) => PAGES_WIDGET.some((re) => re.test(chemin))

/** Clés de test publiques de Cloudflare : `1x`, `2x` ou `3x`, des zéros, deux lettres. */
export const estCleDeTest = (cle: string) => /^[123]x0{10,}[A-F]{2}$/.test(cle)

type Env = Record<string, string | undefined>

/**
 * Les deux clés, ou `null` si l'une manque. En PRODUCTION Vercel (`VERCEL_ENV=production`), des
 * clés de test comptent comme absentes : elles laisseraient passer n'importe qui.
 * (Pas `NODE_ENV` : le banc local tourne en `next start`, donc en « production », avec des clés
 * de test.)
 */
export function clesTurnstile(env: Env = process.env): { siteKey: string; secretKey: string } | null {
  const siteKey = env.TURNSTILE_SITE_KEY?.trim()
  const secretKey = env.TURNSTILE_SECRET_KEY?.trim()
  if (!siteKey || !secretKey) return null
  if (env.VERCEL_ENV === 'production' && (estCleDeTest(siteKey) || estCleDeTest(secretKey))) return null
  return { siteKey, secretKey }
}

/** Langue du widget : Turnstile ne connaît pas le créole — le français sur /ht. */
export const langueTurnstile = (locale: string): 'fr' | 'en' => (locale === 'en' ? 'en' : 'fr')

export type MotifEchec = 'absent' | 'invalide' | 'expire' | 'action' | 'hote' | 'indisponible' | 'configuration'
export type ResultatHumain =
  | { ok: true; verifieLe: Date }
  | { ok: false; motif: MotifEchec; codes: string[] }

/** Le jeton n'a pas été présenté à Cloudflare : l'utilisateur peut le réutiliser. */
export const jetonConsomme = (r: ResultatHumain) => r.ok || (r.motif !== 'absent' && r.motif !== 'configuration')

/**
 * Lecture PURE de la réponse de siteverify. `controles: false` (clé secrète de test) : ni
 * l'action ni l'hôte ne sont contrôlés — les réponses factices de Cloudflare ne les portent pas.
 *
 * ⚠️ La clé secrète de test `1x…AA` accepte N'IMPORTE QUEL jeton (vérifié le 9 oct. 2026 :
 * `{"success":true,"metadata":{"result_with_testing_key":true}}`). En production, une réponse
 * marquée « clé de test » est donc REFUSÉE (`refuserTest`), même si la clé a échappé au filtre
 * de `clesTurnstile`.
 */
export function lireReponseSiteverify(
  json: unknown,
  attendu: { action: string; hotes: readonly string[]; maintenant: number; controles: boolean; refuserTest?: boolean },
): ResultatHumain {
  const r = (json && typeof json === 'object' ? json : {}) as {
    success?: unknown; action?: unknown; hostname?: unknown; challenge_ts?: unknown; 'error-codes'?: unknown
    metadata?: { result_with_testing_key?: unknown }
  }
  const codes = Array.isArray(r['error-codes']) ? r['error-codes'].filter((c): c is string => typeof c === 'string').slice(0, 10) : []
  if (attendu.refuserTest && r.metadata?.result_with_testing_key === true) return { ok: false, motif: 'configuration', codes: ['testing-key'] }
  if (r.success !== true) {
    if (codes.includes('internal-error')) return { ok: false, motif: 'indisponible', codes }
    if (codes.some((c) => c.includes('secret') || c === 'bad-request')) return { ok: false, motif: 'configuration', codes }
    if (codes.includes('timeout-or-duplicate')) return { ok: false, motif: 'expire', codes }
    if (codes.includes('missing-input-response')) return { ok: false, motif: 'absent', codes }
    return { ok: false, motif: 'invalide', codes }
  }
  const ts = typeof r.challenge_ts === 'string' ? Date.parse(r.challenge_ts) : NaN
  if (attendu.controles) {
    if (r.action !== attendu.action) return { ok: false, motif: 'action', codes }
    if (typeof r.hostname !== 'string' || !attendu.hotes.includes(r.hostname)) return { ok: false, motif: 'hote', codes }
    if (!Number.isFinite(ts) || attendu.maintenant - ts > AGE_MAX_MS) return { ok: false, motif: 'expire', codes }
  }
  return { ok: true, verifieLe: new Date(Number.isFinite(ts) ? ts : attendu.maintenant) }
}

/**
 * Vérifie le jeton auprès de Cloudflare. Jeton absent ou trop long : refus SANS appel. Délai
 * de 5 s ; UNE nouvelle tentative (même `idempotency_key`) sur échec réseau ou `internal-error`.
 * Cloudflare injoignable → `indisponible` : la route REFUSE (défaut de la question 4).
 */
export async function verifierHumain(
  { jeton, ip, action }: { jeton: string | null | undefined; ip: string | null | undefined; action: string },
  deps: { fetch?: typeof fetch; env?: Env; maintenant?: () => number } = {},
): Promise<ResultatHumain> {
  const env = deps.env ?? process.env
  const cles = clesTurnstile(env)
  if (!cles) return { ok: false, motif: 'configuration', codes: [] }
  const t = (jeton ?? '').trim()
  if (!t) return { ok: false, motif: 'absent', codes: [] }
  if (t.length > JETON_MAX) return { ok: false, motif: 'invalide', codes: ['token-too-long'] }

  const corps = new URLSearchParams({ secret: cles.secretKey, response: t, idempotency_key: crypto.randomUUID() })
  if (ip) corps.set('remoteip', ip)
  const appeler = deps.fetch ?? fetch
  const attendu = {
    action, hotes: HOTES_PRODUCTION, controles: !estCleDeTest(cles.secretKey), refuserTest: env.VERCEL_ENV === 'production',
  }
  let dernier: ResultatHumain = { ok: false, motif: 'indisponible', codes: [] }
  for (let essai = 0; essai < 2; essai++) {
    try {
      const res = await appeler(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: corps.toString(),
        signal: AbortSignal.timeout(DELAI_APPEL_MS),
        cache: 'no-store',
      })
      const json = await res.json().catch(() => null)
      dernier = json ? lireReponseSiteverify(json, { ...attendu, maintenant: (deps.maintenant ?? Date.now)() }) : { ok: false, motif: 'indisponible', codes: [`http-${res.status}`] }
      if (dernier.ok || dernier.motif !== 'indisponible') return dernier
    } catch {
      dernier = { ok: false, motif: 'indisponible', codes: ['reseau'] }
    }
  }
  return dernier
}
