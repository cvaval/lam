/**
 * Rend CHERCHABLE le texte des ANNOTATIONS (jurisprudence, commentaires, législation connexe,
 * anciennes versions, sujets d'index) des textes annotés — jusqu'ici hors de bodyOriginal, donc
 * introuvable par un mot d'un arrêt (constat cliente : « la recherche ne trouve pas dans les
 * jurisprudences/annotations du Code du travail ou du Code civil »).
 *
 * 1) Ajoute le champ `annotationsText` (analyseur FR) au mapping des index OpenSearch de type
 *    document — ADDITIF, sans recréation ni interruption de service.
 * 2) Réindexe chaque document porteur d'un annotationsJson : reindexDocument recalcule searchText
 *    (moteur intégré) ET pousse le nouveau champ vers OpenSearch (serializeDoc).
 *
 * Idempotent. À relancer après tout enrichissement d'annotations.
 *   npx tsx scripts/_index-annotations-search.ts
 */
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { createOpenSearchClient } from '../src/lib/search/client'
import { indexNameForType } from '../src/lib/search/mappings'
import { DOC_TYPES, type DocType } from '../src/lib/types'

const ANNOTATIONS_FIELD = { type: 'text', analyzer: 'lv_fr', search_analyzer: 'lv_fr_search' } as const

async function main() {
  // 1) Mapping additif sur les index de type document (best-effort : un index inexistant est ignoré).
  if (process.env.SEARCH_PROVIDER === 'opensearch') {
    const client = await createOpenSearchClient()
    for (const t of DOC_TYPES as readonly DocType[]) {
      const index = indexNameForType(t)
      try {
        await client.indices.putMapping({ index, body: { properties: { annotationsText: ANNOTATIONS_FIELD } } })
        console.log(`  mapping annotationsText ajouté à ${index}`)
      } catch (e: any) {
        console.warn(`  (ignoré) ${index} : ${e?.meta?.body?.error?.type ?? e?.message ?? e}`)
      }
    }
  } else {
    console.log('SEARCH_PROVIDER ≠ opensearch : étape mapping ignorée (moteur intégré).')
  }

  // 2) Réindexation des documents annotés (annotationsJson non nul).
  const docs = await prisma.document.findMany({
    where: { annotationsJson: { not: null } },
    select: { id: true, titleFr: true, source: true },
  })
  console.log(`\n${docs.length} document(s) annoté(s) à réindexer :`)
  for (const d of docs) {
    await reindexDocument(d.id)
    console.log(`  ✅ ${d.source ?? '—'} · ${d.titleFr.slice(0, 60)}`)
  }
  await prisma.$disconnect()
  console.log('\nFait. Les mots des annotations/jurisprudences sont désormais indexés.')
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
