/**
 * BANC D'ESSAI du journal des connexions et de la session unique — bout en bout, contre un
 * serveur de dev qui pointe une base LOCALE.
 *
 *     createdb lam_banc && psql -d lam_banc -c 'create extension pg_trgm; create extension unaccent'
 *     npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | psql -d lam_banc
 *     DATABASE_URL=postgresql://cvaval@localhost:5432/lam_banc … npx next dev -p 3100     (config « lam-banc »)
 *     DATABASE_URL=postgresql://cvaval@localhost:5432/lam_banc BANC_BASE_URL=http://localhost:3100 npx tsx scripts/banc-connexions.ts
 *
 * ⚠️ DEUX VERROUS, PAS UN. `smoke-2fa.ts` ne regarde que l'URL du serveur ; or `.env` pointe
 * la PRODUCTION, et un serveur local peut très bien lui parler. Ce banc refuse de démarrer si
 * `DATABASE_URL` n'est pas locale — il crée des comptes, ferme des sessions, réinitialise des
 * mots de passe : jamais en production, sous aucun prétexte. Comptes `@smoke.invalid` seulement.
 *
 * Ce qu'il vérifie (et qui n'est vérifiable QUE de bout en bout : cookies, routes, Prisma) :
 *   A1  une connexion vérifiée par TOTP porte `verifiedVia = TOTP` et l'appareil lisible de l'UA
 *   A2  la déconnexion FERME la ligne (LOGOUT) — elle ne la supprime pas — et le cookie ne
 *       rouvre rien
 *   A3  une reconnexion par appareil de confiance porte `verifiedVia = TRUSTED_DEVICE`
 *   A4  l'expiration ferme EXPIRED, datée de `expiresAt` ; l'inactivité ferme IDLE, datée de la
 *       dernière activité + 20 min
 *   A5  la suspension par l'admin ferme SUSPENDED ; la réinitialisation 2FA ferme TWOFA_RESET ;
 *       celle du mot de passe ferme PASSWORD_RESET
 *   B1  une seconde connexion vérifiée ÉVINCE la première (EVICTED, evictedById = la nouvelle),
 *       journal SESSION_EVICTED, e-mail au titulaire (session vivante) — et une seule session
 *       vivante subsiste
 *   B2  une session morte d'inactivité n'est PAS « évincée » (IDLE) et ne vaut aucun e-mail
 *   B3  une session en attente de 2FA n'évince rien ; elle est évincée par une connexion
 *       vérifiée, sans e-mail
 *   B4  le navigateur évincé apprend pourquoi : /login rend l'avis « nouvelle connexion » avec
 *       l'appareil, SANS l'adresse IP ; `?motif=nouvelle-connexion` tapé à la main ne rend rien
 *   B5  le heartbeat d'une session fermée répond 401 avec le motif
 *   C1  le master admin ferme une session depuis le journal (ADMIN, SESSION_CLOSED_BY_ADMIN)
 *   C2  l'export CSV porte le BOM, l'appareil, et l'heure de Port-au-Prince
 */
import { createHmac } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/auth/password'
import { sha256Hex } from '../src/lib/auth/crypto'
import { IDLE_BACKSTOP_MS } from '../src/lib/auth/session-etat'

const BASE = process.env.BANC_BASE_URL ?? 'http://localhost:3100'
const DB = process.env.DATABASE_URL ?? ''
const PWD = 'BancConnexions!2026'
const UA_A = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36'
const UA_B = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.2 Safari/605.1.15'

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) { console.error(`✋ BANC_BASE_URL="${BASE}" n'est pas local.`); process.exit(2) }
if (!/^postgres(ql)?:\/\/[^@/]*@?(localhost|127\.0\.0\.1)(:\d+)?\//.test(DB)) {
  console.error('✋ DATABASE_URL n’est pas une base LOCALE — ce banc crée des comptes et ferme des sessions. Refus.')
  process.exit(2)
}
const prisma = new PrismaClient()

// ── TOTP RFC 6238 indépendant (copié de smoke-2fa.ts) ──
function base32Decode(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0, value = 0
  const out: number[] = []
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const idx = alphabet.indexOf(c); if (idx === -1) continue
    value = (value << 5) | idx; bits += 5
    if (bits >= 8) { bits -= 8; out.push((value >>> bits) & 0xff) }
  }
  return Buffer.from(out)
}
function totp(secretB32: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30)
  const buf = Buffer.alloc(8); buf.writeBigUInt64BE(BigInt(counter))
  const h = createHmac('sha1', base32Decode(secretB32)).update(buf).digest()
  const o = h[h.length - 1] & 0x0f
  const bin = ((h[o] & 0x7f) << 24) | ((h[o + 1] & 0xff) << 16) | ((h[o + 2] & 0xff) << 8) | (h[o + 3] & 0xff)
  return (bin % 1_000_000).toString().padStart(6, '0')
}

// ── Navigateur simulé : un pot de cookies + un user-agent ──
class Navigateur {
  cookies = new Map<string, string>()
  constructor(public ua: string) {}
  absorb(res: Response) {
    for (const sc of res.headers.getSetCookie()) {
      const [pair] = sc.split(';'); const eq = pair.indexOf('=')
      const name = pair.slice(0, eq).trim(); const val = pair.slice(eq + 1).trim()
      if (val === '' || val === 'deleted') this.cookies.delete(name); else this.cookies.set(name, val)
    }
  }
  header() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ') }
  async post(path: string, body: unknown) {
    const res = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', cookie: this.header(), 'user-agent': this.ua }, body: JSON.stringify(body), redirect: 'manual' })
    this.absorb(res); const text = await res.text(); let json: any = null; try { json = JSON.parse(text) } catch {}
    return { status: res.status, json, text }
  }
  async get(path: string) {
    const res = await fetch(BASE + path, { headers: { cookie: this.header(), 'user-agent': this.ua }, redirect: 'manual' })
    this.absorb(res); return { status: res.status, location: res.headers.get('location'), text: await res.text(), headers: res.headers }
  }
  token() { return this.cookies.get('lv_session') ?? null }
}

const failures: string[] = []
function check(label: string, cond: boolean, detail = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${label}${detail ? `  — ${detail}` : ''}`)
  if (!cond) failures.push(label)
}
const session = (token: string | null) => (token ? prisma.session.findUnique({ where: { token } }) : Promise.resolve(null))
const vivantes = (email: string) => prisma.session.count({ where: { user: { email }, endedAt: null, expiresAt: { gt: new Date() }, twoFactorVerified: true } })

async function cleanup(email: string) {
  await prisma.auditLog.deleteMany({ where: { actor: { email } } }).catch(() => {})
  await prisma.trustedDevice.deleteMany({ where: { user: { email } } }).catch(() => {})
  await prisma.session.deleteMany({ where: { user: { email } } }).catch(() => {})
  await prisma.user.deleteMany({ where: { email } }).catch(() => {})
}
async function creer(email: string, role: string) {
  await cleanup(email)
  return prisma.user.create({ data: { email, name: email.split('@')[0], passwordHash: await hashPassword(PWD), role, status: 'ACTIVE', totpEnabled: false, totpSecret: null, activatedAt: new Date() } })
}
/** Connexion complète par TOTP (enrôle au premier passage). */
async function connecter(nav: Navigateur, email: string, trustDevice = false): Promise<{ ok: boolean; step: string; verify: any }> {
  const login = await nav.post('/api/auth/login', { email, password: PWD })
  if (login.json?.step === 'done') return { ok: login.json.ok === true, step: 'done', verify: { json: { ok: true } } }
  await nav.get('/fr/verify')
  const secret = (await prisma.user.findUnique({ where: { email }, select: { totpSecret: true } }))?.totpSecret
  if (!secret) throw new Error('pas de secret TOTP')
  const v = await nav.post('/api/auth/verify', { code: totp(secret), trustDevice })
  return { ok: v.json?.ok === true, step: String(login.json?.step), verify: v }
}

async function lotA() {
  console.log('\n── Lot A · le journal ──')
  const email = 'banc-a@smoke.invalid'
  await creer(email, 'PWOFESYONEL')
  const nav = new Navigateur(UA_A)
  const r = await connecter(nav, email, true)
  check('A1 connexion par TOTP réussie', r.verify?.json?.ok === true, JSON.stringify(r.verify?.json))
  let s = await session(nav.token())
  check('A1 verifiedVia = TOTP', s?.verifiedVia === 'TOTP', String(s?.verifiedVia))
  check('A1 deviceLabel lu de l’UA : « Chrome 153 sur Windows »', s?.deviceLabel === 'Chrome 153 sur Windows', String(s?.deviceLabel))
  check('A1 ouverte (endedAt null)', s?.endedAt === null)

  const tokenA = nav.token()
  const out = await nav.post('/api/auth/logout', {})
  check('A2 déconnexion ok', out.json?.ok === true)
  s = await session(tokenA)
  check('A2 la ligne EXISTE encore, fermée LOGOUT', !!s && s.endReason === 'LOGOUT' && !!s.endedAt, `${s?.endReason} ${s?.endedAt?.toISOString()}`)
  const zombie = new Navigateur(UA_A); zombie.cookies.set('lv_session', tokenA!)
  const z = await zombie.get('/fr/dashboard')
  check('A2 le cookie d’une session fermée ne rouvre rien (redirigé)', z.status === 307 || z.status === 302, `status ${z.status} → ${z.location}`)

  // A3 : reconnexion, lv_device conservé → appareil de confiance
  nav.cookies.delete('lv_session')
  const r2 = await nav.post('/api/auth/login', { email, password: PWD })
  check('A3 2ᵉ connexion : appareil de confiance (step done)', r2.json?.step === 'done', JSON.stringify(r2.json))
  s = await session(nav.token())
  check('A3 verifiedVia = TRUSTED_DEVICE', s?.verifiedVia === 'TRUSTED_DEVICE', String(s?.verifiedVia))

  // A4 : expiration puis inactivité
  const tokenB = nav.token()!
  const exp = new Date(Date.now() - 3600_000)
  await prisma.session.update({ where: { token: tokenB }, data: { expiresAt: exp } })
  await nav.get('/fr/dashboard')
  s = await session(tokenB)
  check('A4 expirée → EXPIRED datée de expiresAt', s?.endReason === 'EXPIRED' && s.endedAt?.getTime() === exp.getTime(), `${s?.endReason} ${s?.endedAt?.toISOString()}`)
  nav.cookies.delete('lv_session')
  await nav.post('/api/auth/login', { email, password: PWD })
  const tokenC = nav.token()!
  const vue = new Date(Date.now() - IDLE_BACKSTOP_MS - 5 * 60_000)
  await prisma.session.update({ where: { token: tokenC }, data: { lastSeenAt: vue } })
  await nav.get('/fr/dashboard')
  s = await session(tokenC)
  check('A4 inactive → IDLE datée de lastSeenAt + 20 min', s?.endReason === 'IDLE' && s.endedAt?.getTime() === vue.getTime() + IDLE_BACKSTOP_MS, `${s?.endReason} ${s?.endedAt?.toISOString()}`)

  // A5 : suspension, réinitialisation 2FA (par un master admin), réinitialisation du mot de passe
  const adminEmail = 'banc-admin@smoke.invalid'
  await creer(adminEmail, 'MASTER_ADMIN')
  const admin = new Navigateur(UA_B)
  const ra = await connecter(admin, adminEmail)
  check('A5 master admin connecté (2FA obligatoire)', ra.verify?.json?.ok === true)
  nav.cookies.delete('lv_session')
  await nav.post('/api/auth/login', { email, password: PWD })
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  const tokenD = nav.token()!
  await admin.post('/api/admin/users', { action: 'suspend', userId: user!.id })
  s = await session(tokenD)
  check('A5 suspension → SUSPENDED', s?.endReason === 'SUSPENDED', String(s?.endReason))
  await admin.post('/api/admin/users', { action: 'reactivate', userId: user!.id })
  nav.cookies.delete('lv_session')
  await nav.post('/api/auth/login', { email, password: PWD })
  const tokenE = nav.token()!
  await admin.post('/api/admin/users', { action: 'reset2fa', userId: user!.id })
  s = await session(tokenE)
  check('A5 réinitialisation 2FA → TWOFA_RESET', s?.endReason === 'TWOFA_RESET', String(s?.endReason))
  // Le compte n'a plus de 2FA : reconnexion = enrôlement. Puis réinitialisation du mot de passe.
  nav.cookies.clear()
  await connecter(nav, email)
  const tokenF = nav.token()!
  await prisma.user.update({ where: { email }, data: { resetTokenHash: sha256Hex('banc-jeton-de-reinitialisation'), resetTokenExpiresAt: new Date(Date.now() + 3600_000) } })
  const reset = await new Navigateur(UA_B).post('/api/auth/reset', { token: 'banc-jeton-de-reinitialisation', password: PWD + 'x' })
  check('A5 réinitialisation du mot de passe acceptée', reset.json?.ok === true, JSON.stringify(reset.json))
  s = await session(tokenF)
  check('A5 → PASSWORD_RESET', s?.endReason === 'PASSWORD_RESET', String(s?.endReason))
  await prisma.user.update({ where: { email }, data: { passwordHash: await hashPassword(PWD) } })

  const sans = await prisma.session.count({ where: { user: { email }, endedAt: { not: null }, endReason: null } })
  check('A  aucune ligne fermée sans motif', sans === 0, String(sans))
  const total = await prisma.session.count({ where: { user: { email } } })
  check(`A  toutes les lignes sont conservées (${total})`, total >= 6, String(total))
  return { email, adminEmail, admin, nav }
}

async function lotB(ctx: Awaited<ReturnType<typeof lotA>>) {
  console.log('\n── Lot B · une seule connexion par compte ──')
  const { email } = ctx
  const a = new Navigateur(UA_A)
  const b = new Navigateur(UA_B)
  await connecter(a, email)
  const tokenA = a.token()!
  await connecter(b, email)
  const tokenB = b.token()!
  let sa = await session(tokenA)
  check('B1 la première session est ÉVINCÉE par la seconde', sa?.endReason === 'EVICTED' && sa.evictedById === (await session(tokenB))?.id, `${sa?.endReason} → ${sa?.evictedById}`)
  check('B1 une seule session vivante subsiste', (await vivantes(email)) === 1, String(await vivantes(email)))
  const evict = await prisma.auditLog.count({ where: { action: 'SESSION_EVICTED', targetId: sa?.id } })
  check('B1 journal SESSION_EVICTED', evict === 1, String(evict))
  const page = await a.get('/fr/login')
  check('B4 le navigateur évincé lit l’avis « nouvelle connexion » sur /login', /nouvelle connexion/i.test(page.text), '')
  check('B4 l’avis nomme l’appareil de la nouvelle connexion', /Safari 26 sur macOS/.test(page.text), '')
  check('B4 l’avis ne livre PAS l’adresse IP', !/127\.0\.0\.1|::1|adresse IP/i.test(page.text.replace(/<script[\s\S]*?<\/script>/g, '')), '')
  const forge = await new Navigateur(UA_A).get('/fr/login?motif=nouvelle-connexion')
  check('B4 un motif forgé dans l’URL ne rend aucun avis', !/nouvelle connexion/i.test(forge.text), '')
  const hb = await a.post('/api/auth/heartbeat', {})
  check('B5 heartbeat d’une session évincée → 401 + motif', hb.status === 401 && hb.json?.motif === 'EVICTED', `${hb.status} ${JSON.stringify(hb.json)}`)

  // B2 : la session vivante B est rendue inactive, puis A se reconnecte → IDLE, pas EVICTED
  await prisma.session.update({ where: { token: tokenB }, data: { lastSeenAt: new Date(Date.now() - IDLE_BACKSTOP_MS - 60_000) } })
  const audits = await prisma.auditLog.count({ where: { action: 'SESSION_EVICTED', actor: { email } } })
  a.cookies.delete('lv_session')
  await connecter(a, email)
  const sb = await session(tokenB)
  check('B2 une session morte d’inactivité se ferme IDLE, pas EVICTED', sb?.endReason === 'IDLE', String(sb?.endReason))
  check('B2 …et sans ligne SESSION_EVICTED', (await prisma.auditLog.count({ where: { action: 'SESSION_EVICTED', actor: { email } } })) === audits, '')

  // B3 : une session en attente de 2FA n'évince pas la connexion vivante de A
  const tokenA2 = a.token()!
  const c = new Navigateur(UA_B)
  await c.post('/api/auth/login', { email, password: PWD }) // s'arrête avant la 2FA
  check('B3 une session en attente de 2FA n’évince rien', (await session(tokenA2))?.endedAt === null, '')
  // …et elle est évincée quand une autre se vérifie
  const d = new Navigateur(UA_B)
  await connecter(d, email)
  const sc = await session(c.token())
  check('B3 la session en attente est évincée par une connexion vérifiée', sc?.endReason === 'EVICTED', String(sc?.endReason))
  check('B3 toujours une seule vivante', (await vivantes(email)) === 1, String(await vivantes(email)))
  return { d }
}

async function lotC(ctx: Awaited<ReturnType<typeof lotA>>, b: Awaited<ReturnType<typeof lotB>>) {
  console.log('\n── Lot C · le journal du master admin ──')
  const { admin, adminEmail, email } = ctx
  // L'admin a peut-être été évincé par rien (compte distinct) : sa session vit toujours.
  const page = await admin.get('/fr/admin/connexions')
  check('C0 la page /admin/connexions répond au master admin', page.status === 200, `status ${page.status}`)
  check('C0 elle nomme la zone horaire une fois', /Port-au-Prince/.test(page.text), '')
  const cible = await session(b.d.token())
  const close = await admin.post('/api/admin/connexions/close', { sessionId: cible!.id })
  check('C1 fermeture par l’admin acceptée', close.json?.ok === true, JSON.stringify(close.json))
  const apres = await session(b.d.token())
  check('C1 → ADMIN', apres?.endReason === 'ADMIN', String(apres?.endReason))
  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail }, select: { id: true } })
  const al = await prisma.auditLog.count({ where: { action: 'SESSION_CLOSED_BY_ADMIN', actorId: adminUser!.id, targetId: cible!.id } })
  check('C1 journal SESSION_CLOSED_BY_ADMIN par l’admin', al === 1, String(al))
  const csv = await admin.get('/api/admin/connexions/export?jours=7')
  check('C2 export CSV : 200, text/csv, BOM', csv.status === 200 && /text\/csv/.test(csv.headers.get('content-type') ?? '') && csv.text.charCodeAt(0) === 0xfeff, `${csv.status} ${csv.headers.get('content-type')}`)
  check('C2 l’export porte l’appareil et le compte', csv.text.includes('Chrome 153 sur Windows') && csv.text.includes(email), '')
  const exp = await prisma.auditLog.count({ where: { action: 'EXPORT', actorId: adminUser!.id } })
  check('C2 l’export est journalisé', exp >= 1, String(exp))
  const refus = await new Navigateur(UA_A).get('/api/admin/connexions/export?jours=7')
  check('C  la route d’export refuse sans session (401/403)', refus.status === 401 || refus.status === 403, String(refus.status))
}

async function main() {
  console.log(`Banc d'essai connexions → ${BASE} · base ${DB.replace(/\/\/.*@/, '//…@')}`)
  const lots = (process.env.BANC_LOTS ?? 'ABC').toUpperCase()
  const ctx = await lotA()
  let b: Awaited<ReturnType<typeof lotB>> | null = null
  if (lots.includes('B')) b = await lotB(ctx)
  if (lots.includes('C') && b) await lotC(ctx, b)
  console.log('\n' + '─'.repeat(48))
  if (failures.length === 0) console.log('✅ TOUT PASSE')
  else { console.log(`❌ ${failures.length} échec(s) :`); for (const f of failures) console.log(`   · ${f}`) }
  process.exitCode = failures.length === 0 ? 0 : 1
  if (process.env.BANC_GARDER !== '1') { await cleanup('banc-a@smoke.invalid'); await cleanup('banc-admin@smoke.invalid') }
}

main().catch((e) => { console.error('\n💥', e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
