import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Le cookie de session stocke un token aléatoire vérifié en base (jamais signé) ;
// seul le cookie d'appareil de confiance est signé — un seul secret suffit.
const DEVICE_SECRET = process.env.TRUSTED_DEVICE_SECRET ?? 'dev-device-secret'

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
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

/** Empreinte d'appareil (dissuasion du vol de cookie) — UA + langue. */
export function deviceFingerprint(userAgent: string | null, acceptLang: string | null): string {
  return hmac(DEVICE_SECRET, `${userAgent ?? ''}|${acceptLang ?? ''}`).slice(0, 24)
}
