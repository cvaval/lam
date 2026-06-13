import { authenticator } from 'otplib'
import QRCode from 'qrcode'

// Fenêtre de tolérance d'un pas (±30 s) pour absorber le décalage d'horloge.
authenticator.options = { window: 1 }

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

/** Code courant — réservé au confort de démonstration en dev (jamais en prod). */
export function currentTotp(secret: string): string {
  return authenticator.generate(secret)
}
