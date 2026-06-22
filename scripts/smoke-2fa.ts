/**
 * Test de fumée 2FA — bout-en-bout, contre un serveur en cours d'exécution.
 *
 * POURQUOI : la 2FA a été signalée « cassée pour les utilisateurs » plusieurs fois,
 * et à chaque fois le code était correct — la cause était opérationnelle (build
 * déployé périmé, horloge de téléphone). Ce test répond en quelques secondes à
 * « le CODE est-il OK ? » pour ne plus relancer d'enquête à chaque alerte.
 *
 * CE QU'IL VÉRIFIE, sur le VRAI chemin d'enrôlement (totpEnabled=false, comme les
 * comptes créés par l'admin — le seed pré-enrôle tout le monde et masque ce chemin) :
 *   1. login → step 'enroll'
 *   2. /verify persiste un secret TOTP
 *   3. un mauvais code est REFUSÉ (badCode)
 *   4. un code TOTP correct, calculé par une implémentation RFC 6238 INDÉPENDANTE
 *      d'otplib (sinon un bug de lib serait masqué), réussit l'enrôlement
 *   5. appareil de confiance émis pour les rôles NON sensibles, pas pour les sensibles
 *   6. 2ᵉ login : 'done' (2FA sautée) pour non-sensible, '2fa' pour sensible
 *
 * PRÉREQUIS : le serveur dev doit tourner (npm run dev) ET pointer sur la même base
 * que ce script (en local : prisma/dev.db). Lancer :  npm run test:2fa
 *
 * SÛRETÉ : n'opère QUE sur des comptes @smoke.invalid (TLD réservé, jamais réels),
 * et refuse toute URL non-locale sauf SMOKE_ALLOW_REMOTE=1 — pour ne JAMAIS créer
 * de comptes de test en production.
 */
import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000'
const PWD = 'Smoke2FA!2026'
const prisma = new PrismaClient()

const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)
if (!isLocal && process.env.SMOKE_ALLOW_REMOTE !== '1') {
  console.error(`✋ Refus : SMOKE_BASE_URL="${BASE}" n'est pas local. Ce test CRÉE et SUPPRIME`)
  console.error('   des comptes — ne le lance jamais contre la prod. Mets SMOKE_ALLOW_REMOTE=1 pour forcer.')
  process.exit(2)
}

// ── TOTP RFC 6238 indépendant (HMAC-SHA1) — volontairement PAS otplib ──
function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(c)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
    }
  }
  return Buffer.from(out)
}

function totp(secretB32: string, stepOffset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + stepOffset
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = createHmac('sha1', base32Decode(secretB32)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return (bin % 1_000_000).toString().padStart(6, '0')
}

// ── Mini-client HTTP avec gestion de cookies ──
class Jar {
  cookies = new Map<string, string>()
  absorb(res: Response) {
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(';')
      const eq = pair.indexOf('=')
      const name = pair.slice(0, eq).trim()
      const val = pair.slice(eq + 1).trim()
      if (val === '' || val === 'deleted') this.cookies.delete(name)
      else this.cookies.set(name, val)
    }
  }
  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }
}
async function post(jar: Jar, path: string, body: unknown) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: jar.header() },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
  jar.absorb(res)
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: res.status, json }
}
async function get(jar: Jar, path: string) {
  const res = await fetch(BASE + path, { headers: { cookie: jar.header() }, redirect: 'manual' })
  jar.absorb(res)
  return { status: res.status }
}

// ── Cadre d'assertions ──
const failures: string[] = []
function check(label: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? `  — ${detail}` : ''}`)
  if (!cond) failures.push(label)
}

async function cleanup(email: string) {
  await prisma.trustedDevice.deleteMany({ where: { user: { email } } }).catch(() => {})
  await prisma.session.deleteMany({ where: { user: { email } } }).catch(() => {})
  await prisma.user.deleteMany({ where: { email } }).catch(() => {})
}

async function runFor(label: string, role: string, sensitive: boolean) {
  const email = `smoke-2fa-${role.toLowerCase()}@smoke.invalid`
  console.log(`\n── ${label} (${role}, sensitive=${sensitive}) ──`)
  await cleanup(email)
  try {
    await prisma.user.create({
      data: {
        email,
        name: label,
        passwordHash: await hashPassword(PWD),
        role,
        status: 'ACTIVE',
        totpEnabled: false,
        totpSecret: null,
        activatedAt: new Date(),
      },
    })

    const jar = new Jar()
    const login = await post(jar, '/api/auth/login', { email, password: PWD })
    check('login → step "enroll"', login.json?.ok === true && login.json?.step === 'enroll', JSON.stringify(login.json))

    await get(jar, '/fr/verify') // déclenche beginEnrollment (persiste le secret)
    const secret = (await prisma.user.findUnique({ where: { email }, select: { totpSecret: true } }))?.totpSecret
    check('/verify persiste un secret', !!secret)
    if (!secret) return

    // Négatif : un code hors fenêtre (50 pas ≈ 25 min) doit être refusé.
    const bad = await post(jar, '/api/auth/verify', { code: totp(secret, 50), trustDevice: false })
    check('mauvais code REFUSÉ (badCode)', bad.json?.ok === false && bad.json?.error === 'badCode', JSON.stringify(bad.json))

    // Positif : code correct, calculé indépendamment.
    const good = await post(jar, '/api/auth/verify', { code: totp(secret), trustDevice: !sensitive })
    check('enrôlement avec TOTP indépendant', good.json?.ok === true, JSON.stringify(good.json))

    const after = await prisma.user.findUnique({ where: { email }, select: { totpEnabled: true } })
    check('totpEnabled = true après enrôlement', after?.totpEnabled === true)
    const devices = await prisma.trustedDevice.count({ where: { user: { email } } })
    check(`appareil de confiance : ${sensitive ? 0 : 1}`, devices === (sensitive ? 0 : 1), `trouvé ${devices}`)

    // 2ᵉ login : on conserve lv_device, on repart sans lv_session.
    const jar2 = new Jar()
    jar2.cookies = new Map(jar.cookies)
    jar2.cookies.delete('lv_session')
    const login2 = await post(jar2, '/api/auth/login', { email, password: PWD })
    const expected = sensitive ? '2fa' : 'done'
    check(`2ᵉ login → step "${expected}"`, login2.json?.step === expected, JSON.stringify(login2.json))
  } finally {
    await cleanup(email)
  }
}

async function main() {
  console.log(`Test de fumée 2FA → ${BASE}`)
  await runFor('Pwofesyonèl', 'PWOFESYONEL', false)
  await runFor('Enstitisyon', 'ENSTITISYON', false)
  await runFor('Éditeur', 'EDITEUR', true)

  console.log('\n' + '─'.repeat(48))
  if (failures.length === 0) {
    console.log('✅ TOUT PASSE — le code 2FA fonctionne (enrôlement inclus).')
  } else {
    console.log(`❌ ${failures.length} échec(s) :`)
    for (const f of failures) console.log(`   · ${f}`)
  }
  process.exitCode = failures.length === 0 ? 0 : 1
}

main()
  .catch((e) => {
    console.error('\n💥 Erreur (le serveur dev est-il lancé sur ' + BASE + ' ?)\n', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
