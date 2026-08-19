import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { normalizeEmail } from '@/lib/auth/email'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { guard, guardPersistent, REGISTER_LIMITS } from '@/lib/security/ratelimit'
import { sendMail, accountRequestEmail } from '@/lib/mail'

export const runtime = 'nodejs'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(120).optional(),
  org: z.string().min(1).max(160).optional(),
})

/**
 * Demande d'accès → compte PENDING (en attente d'activation par le master admin, §03/§05).
 *
 * ⚠️ FREIN — audit du 16 août 2026 : c'était la SEULE route publique sans aucune limite.
 * Un anonyme pouvait y créer des comptes en boucle, et surtout faire calculer un bcrypt(11)
 * à chaque appel : le hachage est délibérément coûteux, ce qui en fait une arme quand on
 * l'offre. Deux freins, dans cet ordre :
 *
 *   1. mémoire (immédiat, gratuit) — arrête la rafale sur une instance chaude ;
 *   2. PERSISTANT (AuditLog) — le seul qui vaille sur Vercel, où chaque invocation peut
 *      atterrir sur une instance neuve dont la Map est vide.
 *
 * Le frein persistant compte les comptes RÉELLEMENT CRÉÉS depuis cette adresse, non les
 * tentatives : marteler une adresse déjà inscrite ne crée rien et ne coûte pas de bcrypt,
 * donc ce n'est pas ce qu'il faut rationner.
 *
 * ⚠️ NE PAS DÉPLACER LE HACHAGE AVANT LES FREINS. Tout l'objet de la mesure est de refuser
 * la requête AVANT de payer le bcrypt.
 */
export async function POST(req: NextRequest) {
  const ctx = getClientCtx(req)

  // Frein mémoire : première ligne, sans coût de base de données.
  if (!(await guard({ action: 'register', subject: ctx.ip ?? 'sans-ip', limit: 10, windowMs: 600_000 }, { ip: ctx.ip }))) {
    return apiError('rate', 429)
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError('invalidFields', 400)

  for (const [fenetre, regle] of Object.entries(REGISTER_LIMITS)) {
    const r = await guardPersistent({ action: 'ACCOUNT_REQUESTED', ip: ctx.ip, ...regle })
    if (!r.ok) {
      // Journalisé pour que l'abus soit visible dans le back-office, et non seulement refusé.
      await audit({
        action: 'SCRAPING_ALERT',
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        meta: { rule: 'register', fenetre, limit: regle.limit },
      })
      return NextResponse.json({ error: 'rate' }, { status: 429, headers: { 'Retry-After': String(r.retryAfterS) } })
    }
  }

  const email = normalizeEmail(parsed.data.email)
  const existing = await prisma.user.findUnique({ where: { email } })
  // Réponse identique pour ne pas révéler l'existence d'un compte.
  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(parsed.data.password),
        name: parsed.data.name ?? null,
        org: parsed.data.org ?? null,
        role: 'SITWAYEN',
        status: 'PENDING',
      },
    })
    await audit({ action: 'ACCOUNT_REQUESTED', actorId: user.id, targetType: 'USER', targetId: user.id, ip: ctx.ip, userAgent: ctx.userAgent })
    await prevenirAdministration(user)
  }
  return NextResponse.json({ ok: true })
}

/**
 * Prévient le master admin qu'une demande attend. Best-effort, en dehors du chemin de
 * réponse : un e-mail qui ne part pas ne doit JAMAIS faire échouer une inscription — la
 * personne aurait un compte à moitié créé et un message d'erreur incompréhensible.
 *
 * Destinataires : les master admins actifs, ou `ADMIN_ALERT_TO` (liste séparée par des
 * virgules) quand on veut router les alertes ailleurs sans toucher aux comptes.
 */
async function prevenirAdministration(user: { id: string; email: string; name: string | null; org: string | null }) {
  try {
    const surcharge = (process.env.ADMIN_ALERT_TO ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    const destinataires = surcharge.length
      ? surcharge
      : (await prisma.user.findMany({ where: { role: 'MASTER_ADMIN', status: 'ACTIVE' }, select: { email: true } })).map((x) => x.email)
    if (!destinataires.length) return
    const enAttente = await prisma.user.count({ where: { status: 'PENDING' } })
    for (const to of destinataires) await sendMail(accountRequestEmail(to, user, enAttente))
  } catch {
    // Silencieux à dessein : l'inscription a réussi, et c'est elle qui compte.
  }
}
