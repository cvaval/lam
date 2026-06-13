import { cookies } from 'next/headers'
import { prisma } from '../db'
import { randomToken, sign, unsign } from './crypto'
import { DEVICE_COOKIE, deviceCookieOpts } from './session'

export const TRUSTED_DEVICE_TTL_DAYS = 30

/** Lit le cookie signé et charge l'appareil de confiance correspondant (ou null). */
async function readTrustedDeviceFromCookie(userId: string) {
  const deviceId = unsign(cookies().get(DEVICE_COOKIE)?.value)
  if (!deviceId) return null
  return prisma.trustedDevice.findUnique({ where: { userId_deviceId: { userId, deviceId } } })
}

/** Émet un appareil de confiance (30 jours) + cookie signé HMAC (§04). */
export async function issueTrustedDevice(userId: string, fingerprint: string, ip: string | null) {
  const deviceId = randomToken(18)
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_TTL_DAYS * 86400_000)
  await prisma.trustedDevice.create({
    data: { userId, deviceId, fingerprint, lastIp: ip, expiresAt },
  })
  cookies().set(DEVICE_COOKIE, sign(deviceId), deviceCookieOpts(TRUSTED_DEVICE_TTL_DAYS))
}

/**
 * Retourne l'appareil de confiance valide pour cet utilisateur, ou null.
 * Au 30ᵉ jour, ou si l'empreinte (UA) diffère, la 2FA sera redemandée.
 */
export async function getValidTrustedDevice(userId: string, fingerprint: string) {
  const device = await readTrustedDeviceFromCookie(userId)
  if (!device) return null
  if (device.expiresAt.getTime() < Date.now()) {
    await prisma.trustedDevice.delete({ where: { id: device.id } }).catch(() => {})
    return null
  }
  if (device.fingerprint !== fingerprint) return null // nouvel appareil / entête inhabituel
  return device
}

/** Jours restants avant expiration — alimente le rappel J-3 (§04). */
export async function trustedDeviceDaysLeft(userId: string): Promise<number | null> {
  const device = await readTrustedDeviceFromCookie(userId)
  if (!device) return null
  const ms = device.expiresAt.getTime() - Date.now()
  if (ms <= 0) return 0
  return Math.ceil(ms / 86400_000)
}

export async function revokeTrustedDevices(userId: string) {
  await prisma.trustedDevice.deleteMany({ where: { userId } })
}
