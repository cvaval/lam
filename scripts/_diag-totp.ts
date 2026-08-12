/**
 * Vérifie que le cycle TOTP du SERVEUR est sain pour un compte donné, sans jamais
 * divulguer le secret : on génère un code à partir du secret stocké et on le
 * revalide par le même chemin que la connexion. Si ce test passe, le serveur est
 * hors de cause et l'écart vient de l'application du téléphone.
 */
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'
import { currentTotp, verifyTotpStep, totpDelta } from '../src/lib/auth/totp'
import { authenticator } from 'otplib'

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase()
  const u = await prisma.user.findUnique({ where: { email } })
  if (!u?.totpSecret) { console.log('pas de secret'); return }

  const s = u.totpSecret
  console.log('── Cycle TOTP serveur ──')
  console.log(`  secret : ${s.length} caractères, alphabet base32 : ${/^[A-Z2-7]+$/.test(s) ? 'conforme' : '⚠ NON CONFORME'}`)
  const code = currentTotp(s)
  console.log(`  code généré maintenant : ${code.replace(/\d/g, '•')} (${code.length} chiffres)`)
  const step = verifyTotpStep(code, s)
  console.log(`  revalidé par le chemin de connexion : ${step !== null ? `✓ pas ${step}` : '✗ ÉCHEC'}`)
  console.log(`  delta : ${totpDelta(code, s)}`)
  console.log(`  horloge serveur : ${new Date().toISOString()}`)
  console.log(`  otplib options : window=${JSON.stringify(authenticator.options.window)} step=${authenticator.options.step ?? 30}`)
  console.log(`  anti-rejeu : lastTotpStep=${u.lastTotpStep ?? 'aucun'} · pas courant=${Math.floor(Date.now()/1000/30)}`)

  console.log('\n── Historique complet du compte ──')
  const j = await prisma.auditLog.findMany({
    where: { OR: [{ actorId: u.id }, { targetId: u.id }] },
    orderBy: { createdAt: 'asc' },
    select: { action: true, createdAt: true, metaJson: true, ip: true, userAgent: true },
  })
  for (const e of j) {
    const m = typeof e.metaJson === 'string' ? e.metaJson : JSON.stringify(e.metaJson ?? {})
    const ua = (e.userAgent ?? '').slice(0, 40)
    console.log(`  ${e.createdAt.toISOString()}  ${e.action.padEnd(20)} ${m.slice(0, 60).padEnd(60)} ${e.ip ?? ''} ${ua}`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
