import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'
import { guard } from '@/lib/security/ratelimit'
import { canReadService } from '@/lib/access'
import { peutEtreAnonyme, peutModerer, LONGUEUR_MAX_NOTE } from '@/lib/notes/rules'
import type { DocType } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * NOTES DE LECTEURS sur un document — décisions judiciaires en premier lieu.
 *
 *   POST   un lecteur dépose une note : elle naît EN_ATTENTE, invisible aux autres.
 *   GET    la file de modération (rédaction seulement).
 *   PATCH  un éditeur ou le master admin publie ou refuse.
 *
 * ⚠️ AUCUNE NOTE N'EST PUBLIÉE PAR SON AUTEUR. C'est la garantie demandée : « ces notes
 * devront être validées par un des éditeurs ou le master admin avant d'être affichées ».
 */

const postSchema = z.object({
  documentId: z.string().min(1),
  body: z.string().trim().min(3).max(LONGUEUR_MAX_NOTE),
  anonymous: z.boolean().optional(),
})

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['PUBLIEE', 'REFUSEE', 'EN_ATTENTE']),
  moderationNote: z.string().trim().max(1000).nullable().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError('unauthorized', 401)

  const parsed = postSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { documentId, body, anonymous } = parsed.data

  // Anti-inondation : une file de modération noyée n'est plus modérée.
  if (!(await guard({ action: 'note', subject: user.id, limit: 10, windowMs: 60 * 60_000 }, { actorId: user.id }))) {
    return apiError('rateLimited', 429)
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, type: true } })
  if (!doc) return apiError('notFound', 404)
  // On ne commente pas ce qu'on n'a pas le droit de lire (§03).
  if (!canReadService(user, doc.type as DocType)) return apiError('forbidden', 403)

  // ⚠️ L'ANONYMAT SE REFUSE ICI, PAS DANS LE FORMULAIRE. Masquer la case côté navigateur
  // n'empêcherait personne d'envoyer `anonymous: true` à la main.
  const anonyme = !!anonymous && peutEtreAnonyme(user.role)

  const note = await prisma.documentNote.create({
    data: { documentId, authorId: user.id, body, anonymous: anonyme, status: 'EN_ATTENTE' },
    select: { id: true, createdAt: true },
  })
  await audit({
    action: 'DOC_PUBLISHED',
    actorId: user.id,
    targetType: 'DocumentNote',
    targetId: note.id,
    meta: { via: 'note-lecteur', documentId, anonyme, longueur: body.length },
  })
  // On renvoie l'état réel : si l'anonymat a été refusé, l'auteur doit le savoir avant de
  // découvrir son nom sous sa note.
  return NextResponse.json({ ok: true, id: note.id, status: 'EN_ATTENTE', anonymous: anonyme })
}

/** GET — file de modération. `?status=` filtre ; par défaut, celles qui attendent. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !peutModerer(user.role)) return apiError('unauthorized', 401)

  const status = req.nextUrl.searchParams.get('status') ?? 'EN_ATTENTE'
  const notes = await prisma.documentNote.findMany({
    where: status === 'TOUTES' ? {} : { status },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true, body: true, anonymous: true, status: true, createdAt: true,
      moderationNote: true, moderatedAt: true,
      // La rédaction voit TOUJOURS l'auteur, anonymat compris : elle répond de ce qu'elle
      // publie. L'anonymat protège le lecteur du public, pas du modérateur.
      author: { select: { name: true, email: true, role: true } },
      moderatedBy: { select: { name: true, email: true } },
      document: { select: { id: true, titleFr: true, number: true, type: true } },
    },
  })
  const enAttente = await prisma.documentNote.count({ where: { status: 'EN_ATTENTE' } })
  return NextResponse.json({ ok: true, notes, enAttente })
}

/** PATCH — publier ou refuser une note. */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !peutModerer(user.role)) return apiError('unauthorized', 401)

  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { id, status, moderationNote } = parsed.data

  const existe = await prisma.documentNote.findUnique({ where: { id }, select: { id: true, documentId: true } })
  if (!existe) return apiError('notFound', 404)

  await prisma.documentNote.update({
    where: { id },
    data: {
      status,
      moderationNote: moderationNote ?? null,
      // Qui a décidé, et quand : une décision de modération sans auteur ne se conteste pas.
      moderatedById: user.id,
      moderatedAt: new Date(),
    },
  })
  await audit({
    action: status === 'PUBLIEE' ? 'DOC_PUBLISHED' : 'DOC_DELETED',
    actorId: user.id,
    targetType: 'DocumentNote',
    targetId: id,
    meta: { via: 'note-moderation', status, documentId: existe.documentId },
  })
  return NextResponse.json({ ok: true, status })
}
