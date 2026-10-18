import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { prisma } from '@/lib/db'
import { requireAdminApi } from '@/lib/auth/guard'
import { audit } from '@/lib/auth/audit'
import { getClientCtx } from '@/lib/auth/request'
import { estSchemaAbsent } from '@/lib/delais/service-base'
import {
  EDITION_TIERS, decisionDemandeSchema, decisionPermise, prochainIdTiers,
} from '@/lib/jurisdictions/notaires-demandes'
import { empreinte, instantane } from '@/lib/jurisdictions/notaires-confirmation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REQ_ID_RE = /^[a-z0-9]{10,40}$/

/**
 * Décision du MASTER ADMIN sur la demande d'un tiers (chantier D).
 *
 *  EN_COURS → prise en charge (NOUVELLE seulement) ;
 *  REFUSER  → refus motivé (note interne, jamais envoyée au demandeur) ;
 *  INSCRIRE → crée l'entrée `tiers-AAAAMMJJ-n` (édition `tiers`), hors de la liste du MJSP, avec
 *             la vérification consignée dans `sourceJson` ; la demande passe ACCEPTÉE ;
 *  VALIDER_CONFIRMATION → badge « Confirmé » : la provenance a été établie (méthode, référence
 *             privée des justificatifs, note). Refusé si les informations publiées ne sont plus
 *             la VERSION confirmée par le notaire (409 `version_changed`). Une confirmation
 *             ACTIVE antérieure passe REMPLACÉE ; la demande passe ACCEPTÉE. Décision distincte de
 *             l'acceptation d'une correction (qui ne donne aucun badge).
 *
 * MASTER ADMIN SEUL, vérifié ici, à chaque appel (`requireAdminApi`) — masquer les boutons ne
 * suffirait pas.
 *
 * Les coordonnées d'un notaire listé s'acceptent depuis sa fiche (PUT …/coordonnees + requestId).
 * Audit NOTARY_REQUEST_DECIDED à chaque décision.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAdminApi()
  if (!user) return apiError('forbidden', 403)
  if (!REQ_ID_RE.test(params.id)) return apiError('notFound', 404)

  let body: unknown
  try { body = await req.json() } catch { return apiError('invalid_json', 400) }
  const parsed = decisionDemandeSchema.safeParse(body)
  if (!parsed.success) return apiError('invalidFields', 400)
  const d = parsed.data
  const { ip, userAgent } = getClientCtx(req)

  try {
    const demande = await prisma.notaryRequest.findUnique({ where: { id: params.id }, select: { id: true, status: true, kind: true } })
    if (!demande) return apiError('notFound', 404)
    if (!decisionPermise(demande.status, demande.kind, d.action)) return apiError('transition_refused', 409)

    if (d.action === 'EN_COURS') {
      await prisma.notaryRequest.update({ where: { id: demande.id }, data: { status: 'EN_COURS' } })
      await audit({ action: 'NOTARY_REQUEST_DECIDED', actorId: user.id, targetType: 'NotaryRequest', targetId: demande.id, ip, userAgent, meta: { decision: 'EN_COURS' } })
      return NextResponse.json({ ok: true })
    }

    if (d.action === 'REFUSER') {
      await prisma.notaryRequest.update({
        where: { id: demande.id },
        data: { status: 'REFUSEE', decidedById: user.id, decidedAt: new Date(), decisionNote: d.note },
      })
      await audit({ action: 'NOTARY_REQUEST_DECIDED', actorId: user.id, targetType: 'NotaryRequest', targetId: demande.id, ip, userAgent, meta: { decision: 'REFUSEE' } })
      return NextResponse.json({ ok: true })
    }

    if (d.action === 'VALIDER_CONFIRMATION') {
      const r = await prisma.notaryRequest.findUnique({ where: { id: demande.id }, select: { notaryId: true, payloadJson: true, createdAt: true } })
      if (!r?.notaryId) return apiError('request_mismatch', 409)
      const n = await prisma.notary.findUnique({
        where: { id: r.notaryId },
        select: { id: true, active: true, fullName: true, displayName: true, communeId: true, contact: { select: { address: true, phonesJson: true, email: true, active: true } } },
      })
      if (!n || !n.active) return apiError('notFound', 404)
      const payload = ((): { version?: unknown } => { try { return JSON.parse(r.payloadJson) as { version?: unknown } } catch { return {} } })()
      const actuel = instantane(n, n.contact)
      const version = empreinte(actuel)
      // La confirmation porte sur la version VUE par le notaire : si la fiche a changé depuis, on ne
      // valide pas une confirmation d'informations qui ne sont plus celles publiées.
      if (typeof payload.version !== 'string' || payload.version !== version) return apiError('version_changed', 409)
      const confirmedOn = new Date(`${d.confirmedOn}T00:00:00.000Z`)
      if (confirmedOn.getTime() > Date.now()) return apiError('invalidFields', 400)
      const maintenant = new Date()
      const conf = await prisma.$transaction(async (tx) => {
        const anciennes = await tx.notaryConfirmation.findMany({ where: { notaryId: n.id, status: 'ACTIVE' }, select: { id: true } })
        for (const a of anciennes) {
          await tx.notaryConfirmation.update({ where: { id: a.id }, data: { status: 'REMPLACEE', endedAt: maintenant, endedById: user.id, endReason: 'Remplacée par une nouvelle confirmation validée.' } })
        }
        const c = await tx.notaryConfirmation.create({
          data: {
            notaryId: n.id, status: 'ACTIVE', snapshotJson: JSON.stringify(actuel), snapshotHash: version,
            confirmedOn, validatedAt: maintenant, validatedById: user.id, method: d.method, evidenceRef: d.evidenceRef,
            note: d.note, requestId: demande.id,
          },
          select: { id: true },
        })
        await tx.notaryRequest.update({
          where: { id: demande.id },
          data: { status: 'ACCEPTEE', decidedById: user.id, decidedAt: maintenant, decisionNote: d.note },
        })
        return c
      })
      await audit({
        action: 'NOTARY_CONFIRMATION_VALIDATED', actorId: user.id, targetType: 'NotaryConfirmation', targetId: conf.id, ip, userAgent,
        meta: { notaryId: n.id, requestId: demande.id, method: d.method, confirmedOn: d.confirmedOn },
      })
      await audit({ action: 'NOTARY_REQUEST_DECIDED', actorId: user.id, targetType: 'NotaryRequest', targetId: demande.id, ip, userAgent, meta: { decision: 'ACCEPTEE', via: 'confirmation' } })
      return NextResponse.json({ ok: true, confirmationId: conf.id })
    }

    // INSCRIRE
    const commune = await prisma.judicialCommune.findUnique({ where: { id: d.communeId }, select: { id: true, name: true, department: { select: { name: true } } } })
    if (!commune) return apiError('commune_not_found', 400)
    const maintenant = new Date()
    const notaire = await prisma.$transaction(async (tx) => {
      const [ids, max] = await Promise.all([
        tx.notary.findMany({ where: { edition: EDITION_TIERS }, select: { id: true } }),
        tx.notary.aggregate({ where: { edition: EDITION_TIERS }, _max: { ordinal: true } }),
      ])
      const cree = await tx.notary.create({
        data: {
          id: prochainIdTiers(maintenant, ids.map((x) => x.id)),
          edition: EDITION_TIERS,
          ordinal: (max._max.ordinal ?? 0) + 1,
          fullName: d.fullName,
          communeId: commune.id,
          sourceDepartment: commune.department.name,
          sourceCommune: commune.name,
          sourceJson: JSON.stringify({ requestId: demande.id, verifiedBy: user.email, verifiedOn: d.verifiedOn, how: d.note }),
          active: true,
        },
        select: { id: true },
      })
      await tx.notaryRequest.update({
        where: { id: demande.id },
        data: { status: 'ACCEPTEE', notaryId: cree.id, decidedById: user.id, decidedAt: maintenant, decisionNote: d.note },
      })
      return cree
    })
    await audit({
      action: 'NOTARY_REQUEST_DECIDED', actorId: user.id, targetType: 'NotaryRequest', targetId: demande.id, ip, userAgent,
      meta: { decision: 'ACCEPTEE', via: 'inscription', notaryId: notaire.id, communeId: commune.id },
    })
    return NextResponse.json({ ok: true, notaryId: notaire.id })
  } catch (e) {
    if (estSchemaAbsent(e)) return apiError('unavailable', 503)
    throw e
  }
}
