/**
 * Réindexation OpenSearch/Elasticsearch (§09). Crée les index par type (1–6) + un
 * index transversal sociétés, avec l'analyseur FR et la synonymie EN→FR, puis charge
 * le corpus depuis la base. À lancer quand SEARCH_PROVIDER=opensearch.
 *
 *   1) docker compose up -d opensearch
 *   2) SEARCH_PROVIDER=opensearch npm run search:reindex
 */
import { PrismaClient } from '@prisma/client'
import { DOC_TYPES, type DocType } from '../src/lib/types'
import { serializeDoc } from '../src/lib/search/serialize'
import { createOpenSearchClient } from '../src/lib/search/client'
import { indexNameForType, COMPANIES_INDEX, indexSettings, documentMapping, companyMapping } from '../src/lib/search/mappings'

const prisma = new PrismaClient()

async function main() {
  const client = await createOpenSearchClient()

  // Index par type
  for (const type of DOC_TYPES as readonly DocType[]) {
    const index = indexNameForType(type)
    await client.indices.delete({ index, ignore_unavailable: true }).catch(() => {})
    await client.indices.create({ index, body: { ...indexSettings(), mappings: documentMapping() } })
    const docs = await prisma.document.findMany({ where: { type } })
    if (docs.length) {
      const body = docs.flatMap((d) => [{ index: { _index: index, _id: d.id } }, serializeDoc(d)])
      await client.bulk({ refresh: true, body })
    }
    console.log(`   ✔ ${index} (${docs.length})`)
  }

  // Index transversal sociétés
  await client.indices.delete({ index: COMPANIES_INDEX, ignore_unavailable: true }).catch(() => {})
  await client.indices.create({ index: COMPANIES_INDEX, body: { ...indexSettings(), mappings: companyMapping() } })
  const companies = await prisma.company.findMany({ include: { _count: { select: { publications: true } } } })
  if (companies.length) {
    const body = companies.flatMap((c) => [
      { index: { _index: COMPANIES_INDEX, _id: c.id } },
      { name: c.name, nif: c.nif, rcNumber: c.rcNumber, capital: c.capital, address: c.address, refCount: c._count.publications },
    ])
    await client.bulk({ refresh: true, body })
  }
  console.log(`   ✔ ${COMPANIES_INDEX} (${companies.length})`)
  console.log('✅  Réindexation terminée.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
