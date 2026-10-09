import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi, requireCapabilityApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import { normaliserSaisieContact, saisieContactSchema } from '@/lib/jurisdictions/notaires-demandes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ID_RE = /^[a-z0-9][a-z0-9-]{2,119}$/
const CHAMPS = ['address', 'phonesJson', 'email', 'searchAliasesJson', 'observation', 'sourceJson', 'upToDateOn', 'active'] as const

/** État comparable d'une fiche, pour l'audit avant/après. */
const etat = (c: Record<string, unknown> | null) =>
  c ? Object.fromEntries(CHAMPS.map((k) => [k, c[k] instanceof Date ? (c[k] as Date).toISOString().slice(0, 10) : c[k] ?? null])) : null

/**
 * Coordonnées d'un notaire — SAISIE par la rédaction (chantier C).
 *
 *  PUT    → crée ou remplace la fiche `contact-<notaryId>` (`corpus.manage`) ; mêmes règles que
 *           l'import (numéros en E.164, rien d'inventé). Avec `requestId`, la demande d'un tiers
 *           est ACCEPTÉE (et rattachée à ce notaire) dans la même transaction — réservé au
 *           master admin, seul à voir la file.
 *  DELETE → supprime la fiche (master admin). Pour la retirer sans la perdre : `active: false`.
 *
 * Chaque écriture laisse un audit NOTARY_CONTACT_UPDATED avec l'état avant/après.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCapabilityApi('corpus.manage')
  if (!user) return apiError('forbidden', 403)
  if (!ID_RE.test(params.id)) return apiError('notFound', 404)

  let body: unknown
  try { body = await req.json() } catch { return apiError('invalid_json', 400) }
  const parsed = saisieContactSchema.safeParse(body)
  if (!parsed.success) return apiError('invalidFields', 400)
  const norm = normaliserSaisieContact(parsed.data)
  if (!norm.ok) return NextResponse.json({ ok: false, error: 'invalidFields', fields: norm.erreurs }, { status: 400 })

  const requestId = parsed.data.requestId ?? null
  if (requestId && user.role !== 'MASTER_ADMIN') return apiError('forbidden', 403)

  try {
    const notaire = await prisma.notary.findUnique({ where: { id: params.id }, select: { id: true, active: true, contact: true } })
    // Une entrée RETIRÉE (n° 37) n'est jamais publiée : on ne lui donne pas de coordonnées.
    if (!notaire || !notaire.active) return apiError('notFound', 404)

    if (requestId) {
      // Une demande « coordonnées » sans entrée choisie (nom saisi) se RATTACHE ici au notaire.
      const demande = await prisma.notaryRequest.findUnique({ where: { id: requestId }, select: { status: true, kind: true, notaryId: true } })
      if (!demande || demande.kind !== 'CONTACT' || (demande.notaryId && demande.notaryId !== notaire.id)) return apiError('request_mismatch', 409)
      if (demande.status === 'ACCEPTEE' || demande.status === 'REFUSEE') return apiError('request_closed', 409)
    }

    const data = norm.valeur
    const apres = await prisma.$transaction(async (tx) => {
      const fiche = await tx.notaryContact.upsert({
        where: { notaryId: notaire.id },
        create: { id: `contact-${notaire.id}`, notaryId: notaire.id, ...data },
        update: data,
      })
      if (requestId) {
        await tx.notaryRequest.update({
          where: { id: requestId },
          data: { status: 'ACCEPTEE', notaryId: notaire.id, decidedById: user.id, decidedAt: new Date(), decisionNote: 'Coordonnées enregistrées.' },
        })
      }
      return fiche
    })

    const { ip, userAgent } = getClientCtx(req)
    await audit({
      action: 'NOTARY_CONTACT_UPDATED', actorId: user.id, targetType: 'NotaryContact', targetId: apres.id, ip, userAgent,
      meta: { notaryId: notaire.id, avant: etat(notaire.contact as Record<string, unknown> | null), apres: etat(apres as unknown as Record<string, unknown>), ...(requestId ? { requestId } : {}) },
    })
    if (requestId) {
      await audit({ action: 'NOTARY_REQUEST_DECIDED', actorId: user.id, targetType: 'NotaryRequest', targetId: requestId, ip, userAgent, meta: { decision: 'ACCEPTEE', via: 'coordonnees' } })
    }
    return NextResponse.json({ ok: true, id: apres.id })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('unavailable', 503)
    throw e
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdminApi()
  if (!user) return apiError('forbidden', 403)
  if (!ID_RE.test(params.id)) return apiError('notFound', 404)
  try {
    const avant = await prisma.notaryContact.findUnique({ where: { notaryId: params.id } })
    if (!avant) return apiError('notFound', 404)
    await prisma.notaryContact.delete({ where: { notaryId: params.id } })
    const { ip, userAgent } = getClientCtx(req)
    await audit({
      action: 'NOTARY_CONTACT_UPDATED', actorId: user.id, targetType: 'NotaryContact', targetId: avant.id, ip, userAgent,
      meta: { notaryId: params.id, avant: etat(avant as unknown as Record<string, unknown>), apres: null, supprimee: true },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('unavailable', 503)
    throw e
  }
}
