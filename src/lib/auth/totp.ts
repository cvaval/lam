import { authenticator } from 'otplib'
import QRCode from 'qrcode'

// Fenêtre de tolérance d'horloge : ±4 pas (±2 min). Cause n°1 des « codes rejetés »
// constatée en prod : l'horloge du téléphone de l'utilisateur est désynchronisée
// (réglage manuel, pas de synchro NTP) — un décalage > 60 s faisait échouer chaque
// code (un test E2E a confirmé qu'un code décalé de 90 s était refusé avec window:2).
// ±2 min couvre la dérive courante ; le verrouillage à 5 essais protège du brute-force.
// (Au-delà de ±2 min, l'utilisateur doit régler son téléphone sur l'heure automatique —
//  signalé à l'écran d'enrôlement ; le delta journalisé sur 2FA_FAIL permet d'ajuster.)
authenticator.options = { window: 4 }

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
