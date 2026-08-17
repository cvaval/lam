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

/**
 * Plafond d'un envoi bulk. OpenSearch refuse au-delà de `http.max_content_length` (100 Mo
 * par défaut) et répond **413 sans le moindre message** — corps vide, aucune ligne d'erreur
 * exploitable.
 *
 * ⚠️ L'ENVOI ÉTAIT MONOLITHIQUE : tout un index en UNE requête. Cela a tenu tant que les
 * fascicules du Moniteur ne portaient qu'une étiquette de 160 caractères ; le jour où leur
 * transcription (47 Mo pour 1 095 fiches) est entrée dans `bodyOriginal`, la réindexation
 * de la législation est morte d'un coup. On découpe donc sur la TAILLE, pas sur le nombre :
 * un fascicule de 110 000 caractères et une marque de 300 ne se comptent pas pareil.
 */
const TAILLE_LOT = 5 * 1024 * 1024
const DOCS_PAR_LOT = 500
/** Documents lus par requête — borne la mémoire ET le délai côté Postgres. */
const PAGE_LECTURE = 200

/** Envoie un bulk par lots bornés en taille, et FAIT ÉCHOUER le script au premier refus. */
async function indexerParLots(client: any, index: string, lignes: unknown[]): Promise<void> {
  let lot: unknown[] = []
  let poids = 0
  const vider = async () => {
    if (!lot.length) return
    const r = await client.bulk({ refresh: true, body: lot })
    // ⚠️ UN BULK PEUT ÉCHOUER EN RÉPONDANT 200. Les rejets par document vivent dans
    // `errors`/`items` : sans ce contrôle, la réindexation s'annonçait « terminée » en
    // ayant laissé des documents de côté.
    if (r.body?.errors) {
      const premier = (r.body.items ?? []).find((it: any) => it.index?.error)?.index?.error
      throw new Error(`bulk ${index} : ${JSON.stringify(premier ?? 'erreur inconnue').slice(0, 300)}`)
    }
    lot = []
    poids = 0
  }
  for (let i = 0; i < lignes.length; i += 2) {
    const entete = lignes[i]
    const corps = lignes[i + 1]
    const taille = JSON.stringify(corps).length
    // Un document seul plus lourd que le lot part quand même : le couper serait le perdre.
    if (lot.length && (poids + taille > TAILLE_LOT || lot.length / 2 >= DOCS_PAR_LOT)) await vider()
    lot.push(entete, corps)
    poids += taille
  }
  await vider()
}

async function main() {
  const client = await createOpenSearchClient()

  // Index par type
  for (const type of DOC_TYPES as readonly DocType[]) {
    const index = indexNameForType(type)
    await client.indices.delete({ index, ignore_unavailable: true }).catch(() => {})
    await client.indices.create({ index, body: { ...indexSettings(), mappings: documentMapping() } })
    // ⚠️ ON LIT PAR PAGES, PAS D'UN BLOC. Tout charger d'un coup a fonctionné tant que le
    // corpus tenait en quelques mégaoctets ; depuis que les 1 095 fascicules du Moniteur
    // portent leur transcription, le SELECT de la législation dépasse le délai de Supabase
    // (« canceling statement due to statement timeout ») et la réindexation ne démarre même
    // pas. Le curseur porte sur l'id, seul ordre garanti stable pendant la lecture.
    let curseur: string | undefined
    let lus = 0
    for (;;) {
      // La composition d'une décision voyage avec elle (cf. serializeDoc) : sans la
      // relation, la réindexation effacerait les champs de magistrats.
      const page = await prisma.document.findMany({
        where: { type },
        include: { judges: { include: { judge: true }, orderBy: { position: 'asc' } }, themes: { select: { themeId: true } } },
        orderBy: { id: 'asc' },
        take: PAGE_LECTURE,
        ...(curseur ? { skip: 1, cursor: { id: curseur } } : {}),
      })
      if (!page.length) break
      await indexerParLots(client, index, page.flatMap((d) => [{ index: { _index: index, _id: d.id } }, serializeDoc(d)]))
      lus += page.length
      curseur = page[page.length - 1].id
      if (page.length < PAGE_LECTURE) break
    }
    console.log(`   ✔ ${index} (${lus})`)
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
    await indexerParLots(client, COMPANIES_INDEX, body)
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
