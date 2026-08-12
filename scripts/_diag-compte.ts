/**
 * Diagnostic LECTURE SEULE d'un compte qui n'arrive pas à se connecter.
 *
 *   npx tsx scripts/_diag-compte.ts wpetion@cabinetsales.com
 *
 * ⚠️ N'IMPRIME JAMAIS LE SECRET TOTP, ni le hachage du mot de passe. On en donne la
 * PRÉSENCE et la longueur, jamais la valeur : un secret lu une fois est un secret à
 * changer. Le diagnostic doit pouvoir être collé dans un ticket sans conséquence.
 *
 * ⚠️ AUCUNE ÉCRITURE. La base est celle de PRODUCTION et il s'agit du compte d'une
 * personne réelle : on observe, on ne répare pas sans décision explicite.
 */
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    }),
)
for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (env[k]) process.env[k] = env[k]

import { prisma } from '../src/lib/db'

function pas(d: Date = new Date()) {
  return Math.floor(d.getTime() / 1000 / 30)
}

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase()
  if (!email) throw new Error('usage : npx tsx scripts/_diag-compte.ts <courriel>')

  const u = await prisma.user.findUnique({ where: { email } })
  if (!u) {
    // Un courriel voisin explique souvent le « je n'arrive pas à me connecter ».
    const proches = await prisma.user.findMany({
      where: { email: { contains: email.split('@')[1] ?? '' } },
      select: { email: true, status: true, role: true },
      take: 10,
    })
    console.log(`✗ AUCUN COMPTE pour « ${email} »`)
    if (proches.length) {
      console.log('\n  Comptes du même domaine :')
      for (const p of proches) console.log(`    ${p.email}  ${p.status}  ${p.role}`)
    }
    await prisma.$disconnect()
    return
  }

  const maintenant = new Date()
  const verrou = u.lockedUntil && u.lockedUntil > maintenant
  console.log(`Compte  ${u.email}`)
  console.log(`  id ................. ${u.id}`)
  console.log(`  statut ............. ${u.status}${u.status !== 'ACTIVE' ? '   ⚠ NE PEUT PAS SE CONNECTER' : ''}`)
  console.log(`  rôle ............... ${u.role}`)
  console.log(`  créé le ............ ${u.createdAt.toISOString()}`)
  console.log(`  mot de passe ....... ${u.passwordHash ? `présent (${u.passwordHash.length} car.)` : '⚠ ABSENT'}`)
  console.log(`  échecs de connexion  ${u.failedLogins}`)
  console.log(`  verrou ............. ${u.lockedUntil ? `${u.lockedUntil.toISOString()}${verrou ? '   ⚠ VERROUILLÉ MAINTENANT' : ' (expiré)'}` : 'aucun'}`)
  console.log('')
  console.log(`  2FA activé ......... ${u.totpEnabled}`)
  console.log(`  secret TOTP ........ ${u.totpSecret ? `présent (${u.totpSecret.length} car.)` : 'ABSENT'}`)
  if (u.totpEnabled && !u.totpSecret) console.log('    ⚠ INCOHÉRENT : 2FA exigé mais aucun secret — connexion impossible.')
  if (!u.totpEnabled && u.totpSecret) console.log('    · secret présent mais 2FA non activé (enrôlement inachevé).')
  console.log(`  dernier pas TOTP ... ${u.lastTotpStep ?? 'aucun'}`)
  if (u.lastTotpStep != null) {
    const ecart = u.lastTotpStep - pas(maintenant)
    console.log(`    pas courant du serveur : ${pas(maintenant)}  (écart ${ecart >= 0 ? '+' : ''}${ecart})`)
    if (ecart > 2) {
      console.log('    ⚠ LE DERNIER PAS ACCEPTÉ EST DANS LE FUTUR.')
      console.log('      L\'anti-rejeu refuse tout code dont le pas est ≤ au dernier accepté :')
      console.log(`      ce compte restera bloqué encore ~${Math.ceil((ecart * 30) / 60)} min, quoi que fasse l'utilisateur.`)
    }
  }

  const journaux = await prisma.auditLog.findMany({
    where: { OR: [{ actorId: u.id }, { targetId: u.id }] },
    orderBy: { createdAt: 'desc' },
    take: 12,
    select: { action: true, createdAt: true, metaJson: true, ip: true },
  })
  console.log(`\n  12 derniers évènements d'audit :`)
  if (!journaux.length) console.log('    (aucun)')
  for (const j of journaux) {
    const m = typeof j.metaJson === 'string' ? j.metaJson : JSON.stringify(j.metaJson ?? {})
    console.log(`    ${j.createdAt.toISOString()}  ${j.action.padEnd(22)} ${m.slice(0, 90)}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e.message)
  await prisma.$disconnect()
  process.exit(1)
})
