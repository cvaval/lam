/**
 * Fabrique du client OpenSearch — source unique (provider + scripts/reindex.ts).
 * Import dynamique : l'application démarre même sans le paquet (mode FTS par défaut).
 */
export async function createOpenSearchClient() {
  const { Client } = await import('@opensearch-project/opensearch')
  return new Client({
    node: process.env.OPENSEARCH_NODE ?? 'https://localhost:9200',
    auth: {
      username: process.env.OPENSEARCH_USERNAME ?? 'admin',
      password: process.env.OPENSEARCH_PASSWORD ?? 'admin',
    },
    ssl: process.env.OPENSEARCH_INSECURE === 'true' ? { rejectUnauthorized: false } : undefined,
  })
}
