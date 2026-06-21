import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { audit } from '@/lib/auth/audit'
import { buildSearchText, fold } from '@/lib/search/normalize'
import { invalidateSearchIndexes } from '@/lib/search'
import { createOpenSearchClient } from '@/lib/search/client'
import { indexNameForType } from '@/lib/search/mappings'
import { serializeDoc } from '@/lib/search/serialize'
import { loadGaps } from '@/lib/moniteur/gaps'
import { loadBrhGaps, formatCirculaireRef } from '@/lib/brh/gaps'
import { joinKeywords, heuristicKeywords } from '@/lib/ai/keywords'
import { DOC_TYPES, type DocType } from '@/lib/types'
import type { Document } from '@prisma/client'

export const runtime = 'nodejs'

// Publication CMS (§08) : [Publier] = apposition du sceau. Le « Type de document
// (1–6) » est obligatoire à l'indexation. Deux modes :
//  - simple : un document (titleFr + bodyOriginal) ;
//  - lot : une édition du Moniteur (type régulière/spéciale + numéro + date) et
//    ses publications extraites — un document créé par titre sélectionné.
// Données structurées de société (AVIS commerciaux) — méthodologie Le Moniteur.
// Présentes pour créer/lier une fiche société à l'index lors de la publication.
const societeSchema = z.object({
  denomination: z.string().min(2).max(200),
  formeJuridique: z.string().max(120).nullable().optional(),
  siegeSocial: z.string().max(200).nullable().optional(),
  nif: z.string().max(60).nullable().optional(),
  patente: z.string().max(60).nullable().optional(),
  capital: z.number().nullable().optional(),
  devise: z.string().max(10).nullable().optional(),
  typeOperation: z.enum(['constitution', 'modification', 'dissolution']).nullable().optional(),
  notaire: z.string().max(160).nullable().optional(),
  dateActe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

const publicationSchema = z.object({
  titleFr: z.string().min(3),
  type: z.enum(DOC_TYPES),
  bodyOriginal: z.string().optional(), // sinon : texte partagé de l'édition
  // Nature de l'acte (sommaire) — pilote le rattachement société/marque.
  category: z.enum(['LOI', 'DECRET', 'ARRETE', 'AVIS', 'SOCIETE', 'MARQUE', 'CIRCULAIRE', 'AUTRE']).optional(),
  societe: societeSchema.nullable().optional(),
})

const schema = z.object({
  // Mode simple
  type: z.enum(DOC_TYPES).optional(),
  titleFr: z.string().min(3).optional(),
  titleEn: z.string().optional(),
  summaryFr: z.string().optional(),
  number: z.string().optional(),
  status: z.enum(['EN_VIGUEUR', 'ABROGE', 'MODIFIE', 'PUBLIE']).optional(),
  fiscalYear: z.number().int().optional(),
  juridiction: z.string().optional(),
  matiere: z.string().optional(),
  // Mots-clés thématiques (indexation par thèmes) — pré-remplis par l'analyse IA,
  // corrigeables dans l'UploadStudio avant publication.
  keywords: z.array(z.string().max(80)).max(15).optional(),
  // Texte de l'édition / du document
  bodyOriginal: z.string().min(1),
  // Version HTML (depuis Word) + PDF original (depuis le Blob) — studio §08.
  bodyClean: z.string().optional(),
  richBlocksJson: z.string().optional(),
  sourcePdfUrl: z.string().url().optional(),
  // Métadonnées d'édition du Moniteur
  editionType: z.enum(['REGULIERE', 'SPECIALE']).optional(),
  moniteurNumber: z.string().max(20).optional(),
  publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  moniteurRef: z.string().optional(),
  // En-tête du fascicule (méthodologie Le Moniteur — table « numero »)
  anneeParution: z.number().int().positive().max(999).nullable().optional(),
  directeurGeneral: z.string().max(160).nullable().optional(),
  issn: z.string().max(20).nullable().optional(),
  ville: z.string().max(120).nullable().optional(),
  // Métadonnées de circulaire BRH (mode « Circulaire BRH » de l'UploadStudio)
  circulaireNumber: z.number().int().positive().optional(),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // entrée en vigueur
  // Mode lot
  publications: z.array(publicationSchema).max(100).optional(),
})

/** Référence et libellé d'édition cohérents avec l'Index (LM2018-35 / LM2023-SP17). */
function editionIdentity(d: z.infer<typeof schema>) {
  const date = d.publicationDate ? new Date(`${d.publicationDate}T00:00:00Z`) : null
  // Circulaire BRH : référence canonique « Circulaire n° {N} » (forme requise par
  // la détection des numéros manquants — src/lib/brh/gaps.ts), classée par date.
  if (d.circulaireNumber) {
    return { number: formatCirculaireRef(d.circulaireNumber), label: null, date }
  }
  const year = date?.getUTCFullYear()
  // « 125-a » ou « 125 A » saisis par l'admin → « 125a » (forme canonique de l'Index,
  // requise par la détection des numéros manquants).
  const num = d.moniteurNumber?.trim().replace(/^(\d+)[\s-]*([A-Za-z])$/, '$1$2')
  const special = d.editionType === 'SPECIALE'
  const number = num && year ? `LM${year}-${special ? 'SP' : ''}${num}` : d.number ?? null
  const label = num
    ? special
      ? `Le Moniteur — Édition spéciale n° ${num}${d.publicationDate ? ` du ${d.publicationDate}` : ''}`
      : `Le Moniteur n° ${num}${d.publicationDate ? ` du ${d.publicationDate}` : ''}`
    : d.moniteurRef ?? null
  return { number, label, date }
}

/**
 * Après publication d'une édition : détecte les numéros manquants de l'année
 * (numéros sautés et lettres sautées) pour alerter immédiatement l'admin.
 */
async function gapsForYear(date: Date | null): Promise<{ year: number; missing: string[] } | null> {
  if (!date) return null
  const year = date.getUTCFullYear()
  const gaps = await loadGaps(year)
  const found = gaps.find((g) => g.year === year)
  return found ? { year, missing: found.missing.map((m) => m.ref) } : null
}

/**
 * Pendant BRH : après publication d'une circulaire, détecte les numéros manquants
 * sur la séquence entière (trous internes) pour alerter immédiatement l'admin.
 */
async function brhGapsAfterPublish(): Promise<{ missing: string[] } | null> {
  const { missing } = await loadBrhGaps()
  return missing.length ? { missing: missing.map((m) => m.ref) } : null
}

/**
 * Indexation incrémentale OpenSearch à la publication : sans elle, le document
 * créé en base n'apparaîtrait dans la recherche qu'au prochain
 * `npm run search:reindex`. Best-effort volontaire : si OpenSearch est éteint,
 * on avertit sans bloquer la publication — le document reste en base et sera
 * repris au prochain reindex complet. (Le moteur intégré FTS lit la base
 * directement : invalidateSearchIndexes() lui suffit.)
 */
async function indexInOpenSearch(docs: Document[]) {
  if (process.env.SEARCH_PROVIDER !== 'opensearch' || !docs.length) return
  try {
    const client = await createOpenSearchClient()
    const body = docs.flatMap((d) => [
      { index: { _index: indexNameForType(d.type as DocType), _id: d.id } },
      serializeDoc(d),
    ])
    await client.bulk({ refresh: true, body })
  } catch (e) {
    console.warn('Indexation OpenSearch échouée (reprise au prochain reindex) :', e)
  }
}

type Societe = z.infer<typeof societeSchema>

/** Opération sociale → type de lien CompanyPublication. */
function operationToKind(op: Societe['typeOperation'], category?: string): string {
  if (category === 'MARQUE') return 'MARQUE'
  switch (op) {
    case 'constitution':
      return 'STATUTS'
    case 'modification':
      return 'MODIF_CAPITAL'
    case 'dissolution':
      return 'DISSOLUTION'
    default:
      return 'AUTRE'
  }
}

/**
 * Crée ou retrouve une fiche société (dédup par NIF, sinon par nom accent-folé) et
 * la relie au document publié — c'est le pivot de Lam : recoupement d'une même
 * société à travers tous les numéros du Moniteur. Best-effort : une erreur ici ne
 * doit pas faire échouer la publication de l'acte.
 */
async function linkSociete(s: Societe, doc: Document, label: string | null, category?: string): Promise<boolean> {
  try {
    const searchName = fold(s.denomination).replace(/\s+/g, ' ').trim()
    const nif = s.nif?.trim() || null
    let company =
      (nif ? await prisma.company.findFirst({ where: { nif } }) : null) ??
      (await prisma.company.findFirst({ where: { searchName } }))

    const capital = s.capital != null ? `${s.capital.toLocaleString('fr-FR')} ${s.devise ?? 'HTG'}`.trim() : null
    if (!company) {
      company = await prisma.company.create({
        data: { name: s.denomination.trim(), searchName, nif, capital, address: s.siegeSocial?.trim() || null },
      })
    } else {
      // Enrichit les champs vides d'une fiche déjà connue (sans écraser l'existant).
      await prisma.company.update({
        where: { id: company.id },
        data: {
          nif: company.nif ?? nif,
          capital: company.capital ?? capital,
          address: company.address ?? (s.siegeSocial?.trim() || null),
        },
      })
    }

    await prisma.companyPublication.create({
      data: {
        companyId: company.id,
        documentId: doc.id,
        kind: operationToKind(s.typeOperation, category),
        label: doc.titleFr.slice(0, 200),
        date: s.dateActe ? new Date(`${s.dateActe}T00:00:00Z`) : doc.publicationDate,
        moniteurRef: label,
      },
    })
    return true
  } catch (e) {
    console.warn('Rattachement société échoué (acte publié quand même) :', e)
    return false
  }
}

/** Sérialise l'en-tête du numéro pour Document.metaJson (null si rien à stocker). */
function editionMetaJson(d: z.infer<typeof schema>): string | null {
  const meta = {
    anneeParution: d.anneeParution ?? null,
    directeurGeneral: d.directeurGeneral ?? null,
    issn: d.issn ?? null,
    ville: d.ville ?? null,
  }
  return Object.values(meta).some((v) => v != null) ? JSON.stringify({ edition: meta }) : null
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'upload.publish')) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const { number, label, date } = editionIdentity(d)
  const metaJson = editionMetaJson(d)
  const common = {
    moniteurRef: label,
    number,
    publicationDate: date,
    editionType: d.editionType ?? null,
    source: 'CMS',
    sealed: true, // [Publier] appose le sceau
    publishedById: user.id,
    metaJson,
  }

  // ── Mode lot : une édition, N publications ──
  if (d.publications?.length) {
    const created: Document[] = []
    let societes = 0
    for (const pub of d.publications) {
      const body = pub.bodyOriginal?.trim() || d.bodyOriginal
      // Mots-clés PAR publication : le lexique sur le titre (les mots-clés de
      // l'édition entière décriraient mal chaque acte individuel).
      const keywords = joinKeywords(heuristicKeywords({ titleFr: pub.titleFr }))
      const doc = await prisma.document.create({
        data: {
          ...common,
          type: pub.type,
          titleFr: pub.titleFr,
          bodyOriginal: body,
          keywords,
          status: pub.type === 'LEGISLATION' || pub.type === 'CIRCULAIRE_BRH' ? 'EN_VIGUEUR' : 'PUBLIE',
          searchText: buildSearchText({ titleFr: pub.titleFr, number, moniteurRef: label, keywords, bodyOriginal: body }),
        },
      })
      created.push(doc)
      // Acte de société → fiche société liée (méthodologie Le Moniteur).
      if (pub.societe) {
        if (await linkSociete(pub.societe, doc, label, pub.category)) societes++
      }
    }
    const ids = created.map((doc) => doc.id)
    await audit({
      action: 'DOC_PUBLISHED',
      actorId: user.id,
      targetType: 'DOCUMENT',
      targetId: ids[0],
      meta: { count: ids.length, edition: number, editionType: d.editionType, societes },
    })
    invalidateSearchIndexes()
    await indexInOpenSearch(created)
    return NextResponse.json({ ok: true, ids, count: ids.length, societes, gaps: await gapsForYear(date) })
  }

  // ── Mode simple ──
  if (!d.type || !d.titleFr) return apiError('missingFields', 400)
  // Mots-clés : ceux validés par l'admin (pré-remplis par l'analyse), sinon lexique.
  const keywords = joinKeywords(
    d.keywords?.length ? d.keywords : heuristicKeywords({ titleFr: d.titleFr, matiere: d.matiere, body: d.bodyOriginal }),
  )
  const doc = await prisma.document.create({
    data: {
      ...common,
      type: d.type,
      titleFr: d.titleFr,
      titleEn: d.titleEn,
      bodyOriginal: d.bodyOriginal,
      // Version HTML (Word) : texte propre + tableaux ; PDF original (Blob privé).
      bodyClean: d.bodyClean ?? null,
      richBlocksJson: d.richBlocksJson ?? null,
      sourcePdfUrl: d.sourcePdfUrl ?? null,
      summaryFr: d.summaryFr,
      keywords,
      // Entrée en vigueur (circulaires BRH) — distincte de la date de signature.
      effectiveDate: d.effectiveDate ? new Date(`${d.effectiveDate}T00:00:00Z`) : null,
      status: d.status ?? (d.type === 'LEGISLATION' || d.type === 'CIRCULAIRE_BRH' ? 'EN_VIGUEUR' : 'PUBLIE'),
      fiscalYear: d.fiscalYear,
      juridiction: d.juridiction,
      matiere: d.matiere,
      searchText: buildSearchText({
        titleFr: d.titleFr,
        titleEn: d.titleEn,
        number,
        moniteurRef: label,
        keywords,
        matiere: d.matiere,
        summaryFr: d.summaryFr,
        bodyOriginal: d.bodyOriginal,
      }),
    },
  })

  await audit({ action: 'DOC_PUBLISHED', actorId: user.id, targetType: 'DOCUMENT', targetId: doc.id, meta: { type: d.type } })
  invalidateSearchIndexes()
  await indexInOpenSearch([doc])
  // Alerte « numéros manquants » adaptée à la nature du document publié.
  if (d.circulaireNumber) {
    return NextResponse.json({ ok: true, id: doc.id, brhGaps: await brhGapsAfterPublish() })
  }
  return NextResponse.json({ ok: true, id: doc.id, gaps: await gapsForYear(date) })
}
