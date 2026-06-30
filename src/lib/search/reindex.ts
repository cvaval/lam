import { prisma } from '../db'
import type { DocType } from '../types'
import { buildSearchText } from './normalize'
import { invalidateSearchIndexes } from '@/lib/search'
import { createOpenSearchClient } from './client'
import { indexNameForType } from './mappings'
import { serializeDoc } from './serialize'

/**
 * Recalcule les données de recherche d'UN document : `themeLabels` (cache dénormalisé des
 * libellés FR/EN/HT des thèmes rattachés) + `searchText`, puis ré-indexe — invalidation du
 * cache FTS intégré ; ré-indexation OpenSearch best-effort (le mapping dynamique crée le
 * champ `themeLabels` au besoin). À appeler après toute écriture de DocumentTheme
 * (cf. /api/admin/legislation, action setThemes).
 */
export async function reindexDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } })
  if (!doc) return

  const links = await prisma.documentTheme.findMany({
    where: { documentId },
    select: { theme: { select: { labelFr: true, labelEn: true, labelHt: true } } },
  })
  const themeLabels =
    [...new Set(links.flatMap((l) => [l.theme.labelFr, l.theme.labelEn, l.theme.labelHt]).filter(Boolean))].join(' ') || null

  const searchText = buildSearchText({ ...doc, themeLabels })
  const updated = await prisma.document.update({ where: { id: documentId }, data: { themeLabels, searchText } })

  invalidateSearchIndexes()
  if (process.env.SEARCH_PROVIDER === 'opensearch') {
    try {
      const client = await createOpenSearchClient()
      await client.bulk({
        refresh: true,
        body: [{ index: { _index: indexNameForType(updated.type as DocType), _id: updated.id } }, serializeDoc(updated)],
      })
    } catch (e) {
      console.warn('reindexDocument OpenSearch (best-effort) :', e)
    }
  }
}
