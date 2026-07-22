/**
 * Migration « Option A » — recherche plein-texte NATIVE PostgreSQL.
 *
 * Ajoute à Document une colonne `searchTsv` (tsvector, config **french**) maintenue par un
 * TRIGGER Postgres — donc toujours synchrone, sans une ligne de code applicatif.
 *
 * Pourquoi un trigger et non une colonne GÉNÉRÉE : le projet déploie le schéma avec
 * `prisma db push`, et Prisma ne sait pas exprimer une colonne générée — il tenterait à
 * chaque push de « DROP DEFAULT » l'expression et de supprimer l'index GIN, cassant la
 * recherche. Avec un trigger, Prisma ne voit qu'une colonne ordinaire : aucune dérive.
 *
 * Pondération par champ (setweight) :
 *   A = titres + numéro          (le plus fort)
 *   B = résumés + mots-clés + réf. Moniteur
 *   C = searchText (corps + annotations, déjà accent-folé par buildSearchText)
 * → `ts_rank_cd` fait naturellement primer une correspondance de TITRE : plus besoin de
 *   bonus ad hoc calculés en mémoire.
 *
 * Accents : les colonnes brutes (titres/résumés) passent par f_unaccent() pour être
 * cherchables sans accent, comme `searchText` qui est déjà folé côté application.
 *
 * Idempotent. Connexion DIRECTE (DDL, pas le pooler). À RELANCER après un `prisma db push`
 * si l'index venait à disparaître (le script le recrée sans rien casser).
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'

for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']\s*$/g, '').trim()
}
// statement_timeout élevé porté par la CHAÎNE de connexion (un `SET` ne survivrait pas au pooler).
const base = process.env.DIRECT_URL || process.env.DATABASE_URL || ''
const url = base + (base.includes('?') ? '&' : '?') + 'options=' + encodeURIComponent('-c statement_timeout=1800000')
const prisma = new PrismaClient({ datasources: { db: { url } } })

/** Expression du vecteur — source UNIQUE, utilisée par le trigger ET par le remplissage. */
const TSV_EXPR = (r: string) => `
  setweight(to_tsvector('french', f_unaccent(
      coalesce(${r}."titleFr",'') || ' ' || coalesce(${r}."titleEn",'') || ' ' ||
      coalesce(${r}."titleHt",'') || ' ' || coalesce(${r}."number",''))), 'A')
  || setweight(to_tsvector('french', f_unaccent(
      coalesce(${r}."summaryFr",'') || ' ' || coalesce(${r}."summaryEn",'') || ' ' ||
      coalesce(${r}."summaryHt",'') || ' ' || coalesce(${r}."keywords",'') || ' ' ||
      coalesce(${r}."moniteurRef",''))), 'B')
  || setweight(to_tsvector('french', coalesce(${r}."searchText",'')), 'C')
`

async function step(label: string, sql: string) {
  const t0 = Date.now()
  process.stdout.write(`  … ${label}`)
  await prisma.$executeRawUnsafe(sql)
  console.log(`\r  ✓ ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
}

async function main() {
  console.log('Migration FTS native PostgreSQL (Option A)\n')

  await step('extension unaccent', `CREATE EXTENSION IF NOT EXISTS unaccent`)
  await step(
    'fonction f_unaccent (IMMUTABLE)',
    `CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
     LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS
     $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$`,
  )

  // Colonne : si une version GÉNÉRÉE existe (1er essai), on la remplace par une colonne simple.
  const col = await prisma.$queryRawUnsafe<{ gen: string }[]>(
    `SELECT is_generated AS gen FROM information_schema.columns WHERE table_name='Document' AND column_name='searchTsv'`,
  )
  if (col.length && col[0].gen === 'ALWAYS') {
    await step('remplacement de la colonne générée par une colonne simple', `ALTER TABLE "Document" DROP COLUMN "searchTsv"`)
  }
  if (!col.length || col[0].gen === 'ALWAYS') {
    await step('colonne Document.searchTsv', `ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "searchTsv" tsvector`)
  } else {
    console.log('  ✓ colonne Document.searchTsv déjà présente (simple)')
  }

  await step(
    'fonction du trigger',
    `CREATE OR REPLACE FUNCTION document_tsv_refresh() RETURNS trigger
     LANGUAGE plpgsql AS $$
     BEGIN
       NEW."searchTsv" := ${TSV_EXPR('NEW')};
       RETURN NEW;
     END $$`,
  )
  await step('trigger BEFORE INSERT/UPDATE', `DROP TRIGGER IF EXISTS document_tsv_trg ON "Document"`)
  await step(
    'trigger document_tsv_trg',
    `CREATE TRIGGER document_tsv_trg BEFORE INSERT OR UPDATE ON "Document"
     FOR EACH ROW EXECUTE FUNCTION document_tsv_refresh()`,
  )

  // Remplissage initial (par lots : pas de verrou long, progression visible).
  const [{ n: todo }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "Document" WHERE "searchTsv" IS NULL`)
  if (Number(todo) > 0) {
    console.log(`  … remplissage initial : ${todo} documents`)
    let done = 0
    for (;;) {
      const t0 = Date.now()
      const n = await prisma.$executeRawUnsafe(
        `UPDATE "Document" d SET "searchTsv" = ${TSV_EXPR('d')}
         WHERE d.id IN (SELECT id FROM "Document" WHERE "searchTsv" IS NULL LIMIT 2000)`,
      )
      if (!n) break
      done += n
      console.log(`     ${done}/${todo} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    }
  } else {
    console.log('  ✓ vecteurs déjà remplis')
  }

  await step('index GIN Document_searchTsv_idx', `CREATE INDEX IF NOT EXISTS "Document_searchTsv_idx" ON "Document" USING GIN ("searchTsv")`)
  await step('ANALYZE Document', `ANALYZE "Document"`)

  // ── Contrôles ──
  const [{ n: total }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "Document"`)
  const [{ n: filled }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "Document" WHERE "searchTsv" IS NOT NULL AND "searchTsv" <> ''::tsvector`)
  const [{ sz }] = await prisma.$queryRawUnsafe<{ sz: string }[]>(`SELECT pg_size_pretty(pg_relation_size('"Document_searchTsv_idx"')) AS sz`)
  console.log(`\n  documents : ${filled}/${total} avec vecteur · index GIN : ${sz}`)
  const [{ n: hits }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "Document" WHERE "searchTsv" @@ to_tsquery('french', 'societe')`,
  )
  console.log(`  contrôle : « societe » → ${hits} documents appariables (sans plafond)`)

  // Contrôle du trigger : une écriture doit rafraîchir le vecteur automatiquement.
  const [probe] = await prisma.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "Document" LIMIT 1`)
  await prisma.$executeRawUnsafe(`UPDATE "Document" SET "updatedAt" = "updatedAt" WHERE id = $1`, probe.id)
  const [{ ok }] = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(
    `SELECT ("searchTsv" IS NOT NULL) AS ok FROM "Document" WHERE id = $1`, probe.id,
  )
  console.log(`  contrôle trigger (écriture → vecteur maintenu) : ${ok ? 'OK ✔' : 'ÉCHEC ✗'}`)

  await prisma.$disconnect()
  console.log('\n✅ Migration terminée.')
}

main().catch(async (e) => {
  console.error('\n❌', e)
  await prisma.$disconnect()
  process.exit(1)
})
