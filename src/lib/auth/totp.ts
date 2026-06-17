import { authenticator } from 'otplib'
import QRCode from 'qrcode'

// Fenêtre de tolérance de deux pas (±60 s) pour absorber le décalage d'horloge
// entre le serveur et le téléphone de l'utilisateur (cause n°1 des codes rejetés).
authenticator.options = { window: 2 }

const ISSUER = process.env.TOTP_ISSUER ?? 'Lam'

export function generateTotpSecret(): string {
  return authenticator.generateSecret()
}

function totpUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret)
}

export async function totpQrDataUrl(email: string, secret: string): Promise<string> {
  return QRCode.toDataURL(totpUri(email, secret), { margin: 1, width: 220 })
}

export function verifyTotp(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.replace(/\s/g, ''), secret })
  } catch {
    return false
  }
}

/**
 * Décalage (en pas de 30 s) entre le code saisi et l'horloge serveur, recherché sur
 * une fenêtre LARGE (±10 pas = ±5 min) — DIAGNOSTIC uniquement, n'autorise rien.
 * Journalisé sur 2FA_FAIL : un |delta| > 2 révèle une horloge de téléphone déréglée
 * (cause n°1 des « codes invalides »), distincte d'un mauvais secret (delta = null).
 */
export function totpDelta(token: string, secret: string): number | null {
  try {
    return authenticator.clone({ window: [10, 10] }).checkDelta(token.replace(/\s/g, ''), secret)
  } catch {
    return null
  }
}

/** Code courant — réservé au confort de démonstration en dev (jamais en prod). */
export function currentTotp(secret: string): string {
  return authenticator.generate(secret)
}
