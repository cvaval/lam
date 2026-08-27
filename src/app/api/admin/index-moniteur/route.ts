import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { apiError } from '@/lib/api'
import { can } from '@/lib/rbac'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth/session'
import { audit } from '@/lib/auth/audit'
import { reindexDocument } from '@/lib/search/reindex'
import type { DocType } from '@/lib/types'
import { createOpenSearchClient } from '@/lib/search/client'
import { indexNameForType } from '@/lib/search/mappings'

export const runtime = 'nodejs'

/**
 * Éditeur de l'Index du Moniteur (Master Admin §08) : saisie / correction MANUELLE d'une
 * édition (type régulière/spéciale + numéro + année) et de ses publications (une entrée
 * d'index = un Document type INDEX par titre). Détection de doublon : le GET renvoie les
 * entrées déjà saisies pour une référence, que le formulaire pré-remplit pour édition.
 *
 * Réf. d'édition « LM{année}-{SP?}{numéro} » — MÊME format que scripts/import-moniteur-pdf.ts
 * (le moteur de recherche et le regroupement par édition en dépendent).
 */
function editionNumber(annee: number, numero: string, special: boolean): string {
  const brut = numero.trim().replace(/^SP/i, '').replace(/\s+/g, '')
  // ⚠️ LE SUFFIXE SE NORMALISE, IL NE SE RECOPIE PAS. La saisie décidait de la ponctuation :
  // « 43-A » donnait LM2026-SP43-A, « 43A » donnait LM2026-SP43A — deux graphies du MÊME
  // fascicule. C'est cette cohabitation qui a fait recréer 73 éditions spéciales en double
  // le 17 août, et qui a demandé de renuméroter 130 références à la main. Un opérateur
  // pressé ne doit pas pouvoir la rouvrir : « 43a », « 43 A », « 43-a » donnent tous 43-A.
  const m = /^(\d+)-?([A-Za-z])?$/.exec(brut)
  const n = m ? `${m[1]}${m[2] ? `-${m[2].toUpperCase()}` : ''}` : brut
  return special ? `LM${annee}-SP${n}` : `LM${annee}-${n}`
}
function frDateLabel(d: Date): string {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d)
  return s.replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + (c as string).toUpperCase())
}

async function deindex(id: string, type: string) {
  if (process.env.SEARCH_PROVIDER !== 'opensearch') return
  try {
    const client = await createOpenSearchClient()
    await client.delete({ index: indexNameForType(type as DocType), id }).catch(() => {})
  } catch {
    /* best-effort */
  }
}

const CATEGORIES = ['SOCIETE', 'LOI', 'DECRET', 'ARRETE', 'AVIS', 'MARQUE', 'AUTRE'] as const

const bodySchema = z.object({
  editionType: z.enum(['REGULIERE', 'SPECIALE']),
  numero: z.string().trim().min(1).max(20),
  annee: z.number().int().min(1800).max(2200),
  // ⚠️ DATE OBLIGATOIRE. Elle était facultative, et son absence était comblée par le
  // 1ER JANVIER de l'année : une édition se retrouvait datée d'un jour où rien n'avait
  // paru, sans que rien ne le signale. Une entrée d'index sans sa date de publication
  // n'est pas une entrée incomplète, c'est une entrée FAUSSE.
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Titres des publications : pas de limite de caractères. `id` présent = mise à jour d'une
  // entrée existante ; absent = création.
  titles: z.array(z.object({ id: z.string().optional(), text: z.string(), category: z.enum(CATEGORIES).optional() })).max(1000),
  deletedIds: z.array(z.string()).max(1000).optional(),
})

/** GET ?number=LM2001-51 → entrées d'index existantes de cette édition (détection doublon). */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'corpus.manage')) return apiError('unauthorized', 401)
  const number = (req.nextUrl.searchParams.get('number') ?? '').trim()
  if (!number) return apiError('invalidFields', 400)
  const entries = await prisma.document.findMany({
    where: { type: 'INDEX', number },
    select: { id: true, titleFr: true, category: true, editionType: true, publicationDate: true, moniteurRef: true },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ ok: true, number, exists: entries.length > 0, count: entries.length, entries })
}

/** POST : crée/met à jour/supprime les entrées d'une édition. Idempotent par (number, titre). */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !can(user.role, 'corpus.manage')) return apiError('unauthorized', 401)
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return apiError('invalidFields', 400)
  const { editionType, numero, annee, dateISO, titles, deletedIds } = parsed.data

  const special = editionType === 'SPECIALE'
  const number = editionNumber(annee, numero, special)
  const date = new Date(dateISO + 'T00:00:00Z')
  // ⚠️ On NE REFUSE PAS une date dont l'année diffère de la référence : une édition
  // tardive peut paraître l'année suivante, et bloquer la saisie coûterait plus cher que
  // le risque de coquille. L'écart est signalé à l'opérateur DANS le formulaire, et
  // journalisé ici pour qu'il reste traçable après coup.
  const ref = `Le Moniteur · ${number} · ${frDateLabel(date)}`

  let created = 0
  let updated = 0
  let deleted = 0

  // ⚠️ LA SUPPRESSION RESTE AU MASTER ADMIN, même sur un écran ouvert à la curation.
  // Le corpus est la valeur de la plateforme et une suppression ne se rattrape pas depuis
  // l'écran qui l'a causée. On refuse la requête entière plutôt que d'en ignorer une
  // partie en silence : un enregistrement à moitié appliqué est indétectable à l'écran.
  if ((deletedIds ?? []).length && user.role !== 'MASTER_ADMIN') return apiError('forbidden', 403)

  // ── Suppressions (journal DOC_DELETED — obligatoire) ──
  for (const id of deletedIds ?? []) {
    const doc = await prisma.document.findUnique({ where: { id }, select: { id: true, type: true, titleFr: true, number: true } })
    if (!doc || doc.type !== 'INDEX') continue
    await prisma.document.delete({ where: { id } })
    await deindex(id, 'INDEX')
    await audit({ action: 'DOC_DELETED', actorId: user.id, targetType: 'Document', targetId: id, meta: { number: doc.number, titleFr: doc.titleFr, via: 'index-moniteur-admin' } })
    deleted++
  }

  // ── Créations / mises à jour (une entrée par titre non vide) ──
  for (const t of titles) {
    const text = t.text.replace(/\s+$/g, '').replace(/^\s+/g, '')
    if (!text) continue
    if (t.id) {
      // GARDE-FOU (intégrité §02) : ne JAMAIS écrire via cette route sur autre chose qu'une
      // entrée d'index — un id périmé/erroné pointant vers un article de code écraserait son
      // texte officiel. Symétrique du garde de la boucle de suppression ci-dessus.
      const existing = await prisma.document.findUnique({ where: { id: t.id }, select: { type: true } })
      if (!existing || existing.type !== 'INDEX') continue
      await prisma.document.update({
        where: { id: t.id },
        data: { titleFr: text, bodyOriginal: text, editionType, number, moniteurRef: ref, publicationDate: date, category: t.category ?? undefined },
      })
      await reindexDocument(t.id)
      updated++
    } else {
      // Dédup (number, titre) : réenregistrer une édition (rows sans id) ou un rejeu réseau ne
      // doit pas créer de doublon — si l'entrée existe déjà, on la met à jour.
      const dup = await prisma.document.findFirst({ where: { type: 'INDEX', number, titleFr: text }, select: { id: true } })
      if (dup) {
        await prisma.document.update({ where: { id: dup.id }, data: { bodyOriginal: text, editionType, moniteurRef: ref, publicationDate: date, category: t.category ?? undefined } })
        await reindexDocument(dup.id)
        updated++
        continue
      }
      const doc = await prisma.document.create({
        data: {
          type: 'INDEX',
          status: 'PUBLIE',
          source: 'MONITEUR',
          category: t.category ?? 'AUTRE',
          titleFr: text,
          bodyOriginal: text, // une entrée d'index = référence seule ; le titre EST le contenu
          originalLang: 'fr',
          editionType,
          number,
          moniteurRef: ref,
          publicationDate: date,
          publishedById: user.id,
        },
      })
      await reindexDocument(doc.id)
      created++
    }
  }

  await audit({ action: 'DOC_PUBLISHED', actorId: user.id, targetType: 'Document', targetId: number, meta: { number, editionType, dateISO, created, updated, deleted, yearMismatch: date.getUTCFullYear() !== annee || undefined, via: 'index-moniteur-admin' } })
  return NextResponse.json({ ok: true, number, moniteurRef: ref, created, updated, deleted })
}
