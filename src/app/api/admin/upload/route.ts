import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { can } from '@/lib/rbac'
import { audit } from '@/lib/auth/audit'
import { buildSearchText } from '@/lib/search/normalize'
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
const publicationSchema = z.object({
  titleFr: z.string().min(3),
  type: z.enum(DOC_TYPES),
  bodyOriginal: z.string().optional(), // sinon : texte partagé de l'édition
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
  // Métadonnées d'édition du Moniteur
  editionType: z.enum(['REGULIERE', 'SPECIALE']).optional(),
  moniteurNumber: z.string().max(20).optional(),
  publicationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  moniteurRef: z.string().optional(),
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

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'upload.publish')) return apiError('forbidden', 403)

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 })
  const d = parsed.data

  const { number, label, date } = editionIdentity(d)
  const common = {
    moniteurRef: label,
    number,
    publicationDate: date,
    editionType: d.editionType ?? null,
    source: 'CMS',
    sealed: true, // [Publier] appose le sceau
    publishedById: user.id,
  }

  // ── Mode lot : une édition, N publications ──
  if (d.publications?.length) {
    const created: Document[] = []
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
          status: pub.type === 'LEGISLATION' ? 'EN_VIGUEUR' : 'PUBLIE',
          searchText: buildSearchText({ titleFr: pub.titleFr, number, moniteurRef: label, keywords, bodyOriginal: body }),
        },
      })
      created.push(doc)
    }
    const ids = created.map((doc) => doc.id)
    await audit({
      action: 'DOC_PUBLISHED',
      actorId: user.id,
      targetType: 'DOCUMENT',
      targetId: ids[0],
      meta: { count: ids.length, edition: number, editionType: d.editionType },
    })
    invalidateSearchIndexes()
    await indexInOpenSearch(created)
    return NextResponse.json({ ok: true, ids, count: ids.length, gaps: await gapsForYear(date) })
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
      summaryFr: d.summaryFr,
      keywords,
      // Entrée en vigueur (circulaires BRH) — distincte de la date de signature.
      effectiveDate: d.effectiveDate ? new Date(`${d.effectiveDate}T00:00:00Z`) : null,
      status: d.status ?? (d.type === 'LEGISLATION' ? 'EN_VIGUEUR' : 'PUBLIE'),
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
