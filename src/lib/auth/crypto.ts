import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Le cookie de session stocke un token aléatoire vérifié en base (jamais signé) ;
// seul le cookie d'appareil de confiance est signé — un seul secret suffit.
// Fail-fast (audit) : en production, un secret absent laisserait signer avec la valeur de dev
// (appareils de confiance forgeables). On refuse de démarrer plutôt que de dégrader en silence.
if (process.env.NODE_ENV === 'production' && !process.env.TRUSTED_DEVICE_SECRET) {
  throw new Error('TRUSTED_DEVICE_SECRET manquant en production (signature des appareils de confiance).')
}
const DEVICE_SECRET = process.env.TRUSTED_DEVICE_SECRET ?? 'dev-device-secret'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** Empreinte SHA-256 (hex) — stockage des jetons à usage unique (réinit. mot de passe).
 *  On ne stocke jamais le jeton en clair : une fuite de la base ne livre rien d'utilisable. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// Caractères lisibles (sans I/O/0/1/l ambigus) pour mots de passe & codes promo.
const READABLE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function readable(len: number): string {
  const buf = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += READABLE[buf[i] % READABLE.length]
  return out
}

/** Mot de passe temporaire lisible (compte créé par le master admin). */
export function randomPassword(): string {
  return `${readable(4)}-${readable(4)}-${readable(4)}`
}

/** Code promo lisible, ex. « LV-7K2P-9QHT ». */
export function randomPromoCode(): string {
  return `LV-${readable(4)}-${readable(4)}`
}

function hmac(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

/** Cookie signé : `value.signature`. Empêche la falsification (cookie de confiance §04). */
export function sign(value: string): string {
  return `${value}.${hmac(DEVICE_SECRET, value)}`
}

export function unsign(signed: string | undefined | null): string | null {
  if (!signed) return null
  const idx = signed.lastIndexOf('.')
  if (idx < 0) return null
  const value = signed.slice(0, idx)
  const sig = signed.slice(idx + 1)
  const expected = hmac(DEVICE_SECRET, value)
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  return value
}

/**
 * Empreinte d'appareil (dissuasion du vol de cookie) — User-Agent SEULEMENT.
 *
 * N'inclut PLUS Accept-Language : sur un site trilingue (FR/EN/HT) la langue varie
 * d'une connexion à l'autre, et les CDN/proxys normalisent cet en-tête. L'y inclure
 * faisait échouer la reconnaissance de l'« appareil de confiance » au moindre
 * changement de langue → la 2FA était redemandée à CHAQUE connexion pour les comptes
 * non sensibles (les seuls à disposer d'appareils de confiance), donnant l'impression
 * que « la 2FA ne marche pas pour les utilisateurs ». L'admin (rôle sensible, 2FA à
 * chaque session, sans appareil de confiance) n'était pas affecté.
 */
export function deviceFingerprint(userAgent: string | null): string {
  return hmac(DEVICE_SECRET, userAgent ?? '').slice(0, 24)
}
