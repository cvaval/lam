import { authenticator } from 'otplib'
import QRCode from 'qrcode'

// Fenêtre de tolérance d'horloge : ±2 pas (±1 min). Compromis sécurité/ergonomie (audit §04) :
// assez large pour absorber une horloge de téléphone légèrement déréglée (cause n°1 des « codes
// rejetés » en prod), mais bien plus serrée que l'ancien ±2 min — surface de devinette et de
// rejeu réduite. Anti-REJEU : un code n'est accepté qu'une seule fois (User.lastTotpStep ;
// voir verifyTotpStep + service.verifyTwoFactor). Anti-brute-force : verrouillage 5 essais +
// limitation de débit par IP sur /verify.
// (Au-delà de ±1 min, régler le téléphone sur l'heure automatique — le delta, recherché sur
//  ±5 min via totpDelta et journalisé sur 2FA_FAIL, permet de diagnostiquer.)
const TOTP_WINDOW = 2
const STEP_SECONDS = 30
authenticator.options = { window: TOTP_WINDOW }

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
 * Valide un code TOTP et renvoie le PAS ABSOLU correspondant (floor(epoch/30) + delta),
 * ou null si le code est invalide (hors fenêtre). Le pas sert d'anti-rejeu : l'appelant
 * refuse un code dont le pas est ≤ au dernier pas accepté (User.lastTotpStep).
 */
export function verifyTotpStep(token: string, secret: string): number | null {
  try {
    const delta = authenticator.checkDelta(token.replace(/\s/g, ''), secret) // utilise options.window
    if (delta === null) return null
    return Math.floor(Date.now() / 1000 / STEP_SECONDS) + delta
  } catch {
    return null
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
