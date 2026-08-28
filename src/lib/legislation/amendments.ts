/**
 * Amendements au niveau ARTICLE (overlay ; Document.bodyOriginal reste canonique §02).
 *
 * Un article jamais amendé n'a aucune ligne ici (lu depuis bodyOriginal). Au 1ᵉʳ
 * amendement, on snapshote le texte d'origine en MODIFIE puis on ajoute la nouvelle
 * version EN_VIGUEUR. Au plus UNE version EN_VIGUEUR par (documentId, anchor).
 *
 * Cf. docs/architecture-legislation-themes.md §9.
 */
import type { ArticleVersion } from '@prisma/client'
import { prisma } from '../db'

/**
 * Statut d'un article INSÉRÉ par un texte modificatif. `ArticleVersion.status` est une
 * colonne de texte libre, pas une énumération SQL : la valeur s'ajoute sans migration.
 */
export const AJOUTE = 'AJOUTE'

interface AmendInput {
  documentId: string
  anchor: string // "art-95-bis" (src/lib/doc/anchors.ts)
  label?: string | null // "Article 95 bis"
  originalBody?: string | null // texte d'origine — snapshoté au 1ᵉʳ amendement
  newBody: string
  amendedByDocId?: string | null
  amendedByNumber?: string | null
  effectiveDate?: Date | null
  origin?: 'MANUAL' | 'AUTO'
  note?: string | null
}

/** Amende un article : snapshot de l'original (1ᵉʳ amendement), ancienne version → MODIFIE,
 *  nouvelle version → EN_VIGUEUR. Transaction (garantit ≤ 1 EN_VIGUEUR). */
export async function amendArticle(input: AmendInput): Promise<void> {
  const { documentId, anchor } = input
  await prisma.$transaction(async (tx) => {
    const existing = await tx.articleVersion.findMany({ where: { documentId, anchor }, select: { seq: true } })
    let seq = existing.length ? Math.max(...existing.map((v) => v.seq)) : -1
    if (existing.length === 0 && input.originalBody) {
      await tx.articleVersion.create({
        data: { documentId, anchor, label: input.label ?? null, body: input.originalBody, status: 'MODIFIE', seq: ++seq, origin: 'MANUAL' },
      })
    }
    await tx.articleVersion.updateMany({ where: { documentId, anchor, status: 'EN_VIGUEUR' }, data: { status: 'MODIFIE' } })
    await tx.articleVersion.create({
      data: {
        documentId,
        anchor,
        label: input.label ?? null,
        body: input.newBody,
        status: 'EN_VIGUEUR',
        effectiveDate: input.effectiveDate ?? null,
        amendedByDocId: input.amendedByDocId ?? null,
        amendedByNumber: input.amendedByNumber ?? null,
        note: input.note ?? null,
        origin: input.origin ?? 'MANUAL',
        seq: ++seq,
      },
    })
  })
}

/** Abroge un article : la version en vigueur devient ABROGE (plus aucune en vigueur). */
export async function abrogateArticle(input: {
  documentId: string
  anchor: string
  label?: string | null
  originalBody?: string | null
  amendedByDocId?: string | null
  amendedByNumber?: string | null
  effectiveDate?: Date | null
  note?: string | null
}): Promise<void> {
  const { documentId, anchor } = input
  await prisma.$transaction(async (tx) => {
    const existing = await tx.articleVersion.findMany({ where: { documentId, anchor }, select: { seq: true } })
    if (existing.length === 0) {
      await tx.articleVersion.create({
        data: {
          documentId,
          anchor,
          label: input.label ?? null,
          body: input.originalBody ?? '',
          status: 'ABROGE',
          effectiveDate: input.effectiveDate ?? null,
          amendedByDocId: input.amendedByDocId ?? null,
          amendedByNumber: input.amendedByNumber ?? null,
          note: input.note ?? null,
          seq: 0,
        },
      })
      return
    }
    await tx.articleVersion.updateMany({
      where: { documentId, anchor, status: 'EN_VIGUEUR' },
      data: {
        status: 'ABROGE',
        effectiveDate: input.effectiveDate ?? null,
        amendedByDocId: input.amendedByDocId ?? null,
        amendedByNumber: input.amendedByNumber ?? null,
        note: input.note ?? null,
      },
    })
  })
}

/**
 * Enregistre un article INSÉRÉ dans le corps par un texte modificatif — la ligne qui fait
 * naître la pastille « Ajout — … » du lecteur, et qui nomme l'acte d'où l'article vient.
 *
 * ⚠️ CE N'EST PAS UN OVERLAY, ET ÇA NE PEUT PAS L'ÊTRE. `applyAmendments` REMPLACE le
 * segment d'une ancre EXISTANTE ; il n'insère rien. Le texte de l'article ajouté doit donc
 * déjà être entré dans `bodyOriginal`, à son rang. La ligne écrite ici ne fait que DIRE
 * d'où il vient : elle ne le fait pas apparaître. Posée seule, elle laisse une pastille sur
 * un article que personne ne voit.
 *
 * ⚠️ ET LA PROVENANCE NE S'ÉCRIT PAS DANS LE CORPS. Marquer la tête « Article 23.1.- (D. du
 * 6 janvier 2016) … » prêterait au décret une mention qu'il n'imprime pas (§02). Les codes
 * consolidés d'Haïti, eux, IMPRIMENT cette parenthèse — Code pénal, Code d'instruction
 * criminelle, CFPB : celles-là appartiennent au texte officiel et ne se touchent pas.
 */
export async function addArticle(input: {
  documentId: string
  anchor: string
  label?: string | null
  /** Rédaction de l'article ajouté — la MÊME que celle entrée dans `bodyOriginal`. */
  body: string
  amendedByDocId?: string | null
  /** Désignation courte de l'acte, affichée dans la pastille (« Décret du 6 janvier 2016 »). */
  amendedByNumber?: string | null
  effectiveDate?: Date | null
  /** Phrase complète pour l'infobulle — TITRE COMPLET de l'acte modificatif. */
  note?: string | null
}): Promise<boolean> {
  const { documentId, anchor } = input
  const existing = await prisma.articleVersion.findMany({ where: { documentId, anchor }, select: { id: true } })
  if (existing.length) return false
  await prisma.articleVersion.create({
    data: {
      documentId,
      anchor,
      label: input.label ?? null,
      body: input.body,
      status: AJOUTE,
      effectiveDate: input.effectiveDate ?? null,
      amendedByDocId: input.amendedByDocId ?? null,
      amendedByNumber: input.amendedByNumber ?? null,
      note: input.note ?? null,
      origin: 'MANUAL',
      seq: 0,
    },
  })
  return true
}

export interface ArticleOverlay {
  anchor: string
  label: string | null
  /** Version en vigueur (null si l'article est abrogé). */
  inForce: ArticleVersion | null
  /** Versions antérieures (MODIFIE) + éventuelle version abrogée, ordre chronologique. */
  history: ArticleVersion[]
  /** Article INSÉRÉ par un texte modificatif : porte une pastille, n'a AUCUNE ancienne
   *  version à déplier — il n'existait pas avant. */
  added: ArticleVersion | null
  /** Vraiment amendé : réécrit ou abrogé. Un article seulement AJOUTÉ ne l'est pas. */
  amended: boolean
  abrogated: boolean
}

/**
 * Overlay d'amendements d'un document, indexé par ancre — consommé par le lecteur
 * (OfficialText) : version en vigueur par défaut, historique dépliable, vue allégée.
 */
export async function getAmendments(documentId: string): Promise<Map<string, ArticleOverlay>> {
  const rows = await prisma.articleVersion.findMany({
    where: { documentId },
    orderBy: [{ anchor: 'asc' }, { seq: 'asc' }],
  })
  const byAnchor = new Map<string, ArticleVersion[]>()
  for (const r of rows) {
    if (!byAnchor.has(r.anchor)) byAnchor.set(r.anchor, [])
    byAnchor.get(r.anchor)!.push(r)
  }
  const out = new Map<string, ArticleOverlay>()
  for (const [anchor, versions] of byAnchor) {
    const inForce = versions.find((v) => v.status === 'EN_VIGUEUR') ?? null
    const added = versions.find((v) => v.status === AJOUTE) ?? null
    // ⚠️ LA LIGNE D'AJOUT N'EST PAS UNE ANCIENNE VERSION. Laissée dans `history`, elle
    // s'afficherait sous « Voir l'ancienne version » — en donnant pour rédaction abandonnée
    // le texte même que le lecteur a sous les yeux.
    const history = versions.filter((v) => v.status !== 'EN_VIGUEUR' && v.status !== AJOUTE)
    out.set(anchor, {
      anchor,
      label: versions[0]?.label ?? null,
      inForce,
      added,
      history,
      amended: versions.some((v) => v.status !== AJOUTE),
      abrogated: !inForce && versions.some((v) => v.status === 'ABROGE'),
    })
  }
  return out
}
