import { audit } from '../auth/audit'

/**
 * Anti-scraping (§09) : limitation de débit en mémoire (fenêtre glissante par clé) +
 * détection d'extraction massive. Au-delà du seuil, la requête est bloquée et un
 * événement SCRAPING_ALERT est journalisé (alimente le KPI admin) — throttlé pour ne
 * pas inonder le journal. Première ligne de défense : tout est derrière l'authentification.
 *
 * Dev/instance unique : Map mémoire. En production multi-instances, remplacer par Redis.
 */
interface Bucket {
  count: number
  reset: number
}
const buckets = new Map<string, Bucket>()
const lastAlert = new Map<string, number>()
const ALERT_THROTTLE_MS = 5 * 60_000

const nowMs = () => Date.now()

export interface RateRule {
  /** identifiant logique (ex. 'search', 'doc', 'export') */
  action: string
  /** clé d'isolation (userId, ip…) */
  subject: string
  limit: number
  windowMs: number
}

interface RateResult {
  ok: boolean
  remaining: number
  retryAfterMs: number
}

function rateLimit({ action, subject, limit, windowMs }: RateRule): RateResult {
  const key = `${action}:${subject}`
  const t = nowMs()
  let b = buckets.get(key)
  if (!b || b.reset <= t) {
    b = { count: 0, reset: t + windowMs }
    buckets.set(key, b)
  }
  b.count++
  // Garde-fou mémoire : purge occasionnelle des seaux périmés.
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.reset <= t) buckets.delete(k)
  const ok = b.count <= limit
  return { ok, remaining: Math.max(0, limit - b.count), retryAfterMs: ok ? 0 : b.reset - t }
}

/**
 * Applique une règle et journalise une alerte de scraping en cas de dépassement.
 * Retourne true si la requête est autorisée.
 */
export async function guard(rule: RateRule, ctx: { actorId?: string | null; ip?: string | null } = {}): Promise<boolean> {
  const res = rateLimit(rule)
  if (res.ok) return true
  const alertKey = `${rule.action}:${rule.subject}`
  const t = nowMs()
  const last = lastAlert.get(alertKey) ?? 0
  if (t - last > ALERT_THROTTLE_MS) {
    lastAlert.set(alertKey, t)
    await audit({
      action: 'SCRAPING_ALERT',
      actorId: ctx.actorId ?? null,
      ip: ctx.ip ?? null,
      meta: { rule: rule.action, limit: rule.limit, windowMs: rule.windowMs },
    })
  }
  return false
}

// Seuils par défaut (généreux pour l'usage humain, bloquants pour l'extraction massive).
export const LIMITS = {
  search: { limit: 80, windowMs: 60_000 },
  doc: { limit: 150, windowMs: 60_000 },
  export: { limit: 20, windowMs: 60_000 },
  // Heartbeat : le client légitime ne bat qu'une fois / 5 min par onglet (IdleTimer),
  // donc 6/min laisse de la marge (multi-onglets, clic « Rester connecté ») tout en
  // bornant la lecture DB déclenchée par chaque ping.
  heartbeat: { limit: 6, windowMs: 60_000 },
  // Réinitialisation de mot de passe : anti-abus (énumération d'e-mails, spam d'envois).
  forgot: { limit: 5, windowMs: 600_000 },
  reset: { limit: 10, windowMs: 600_000 },
  // Connexion / 2FA : frein PAR IP (le verrouillage est par compte) contre la force brute
  // distribuée de mots de passe et de codes TOTP, et le DoS par verrouillage (§04, audit).
  login: { limit: 12, windowMs: 60_000 },
  verify: { limit: 12, windowMs: 60_000 },
  // Activation de code promo : empêche le brute-force de codes (auto-élévation de palier).
  redeem: { limit: 8, windowMs: 3_600_000 },
}
