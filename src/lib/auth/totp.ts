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
 * Décalage (en pas de 30 s) entre le code saisi et l'horloge serveur, cherché sur une
 * fenêtre LARGE (±20 pas = ±10 min) — DIAGNOSTIC uniquement, n'autorise rien.
 *
 * ⚠️ NE PAS REVENIR À `clone({ window: [10, 10] }).checkDelta(...)`. Cette forme
 * N'ÉCRASE PAS la fenêtre globale (`authenticator.options = { window: 2 }`) : mesuré,
 * elle plafonne à ±2 pas et rend `null` au-delà. L'instrument était donc AVEUGLE depuis
 * sa mise en place — tout échec hors ±1 min était journalisé `delta: null`, si bien
 * qu'une horloge déréglée et une mauvaise clé rendaient le MÊME diagnostic. C'est ce qui
 * a fait conclure à tort « ce n'est pas le code » lors de l'enquête de juin.
 *
 * On balaie donc les pas à la main : `clone({ epoch })`, lui, fonctionne pour la
 * GÉNÉRATION, et comparer le code attendu à chaque décalage ne dépend d'aucune option.
 */
const DIAG_STEPS = 20

export function totpDelta(token: string, secret: string): number | null {
  const code = token.replace(/\s/g, '')
  try {
    const now = Date.now()
    for (let k = 0; k <= DIAG_STEPS; k++) {
      // Du plus proche au plus lointain : le premier trouvé est le décalage le plus probable.
      for (const signe of k === 0 ? [0] : [1, -1]) {
        const d = k * signe
        if (authenticator.clone({ epoch: now + d * STEP_SECONDS * 1000 }).generate(secret) === code) return d
      }
    }
    return null
  } catch {
    return null
  }
}

/** Code courant — réservé au confort de démonstration en dev (jamais en prod). */
export function currentTotp(secret: string): string {
  return authenticator.generate(secret)
}
