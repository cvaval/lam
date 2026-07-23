/**
 * Migration « Option A » — recherche plein-texte NATIVE PostgreSQL.
 *
 * Ajoute à Document une colonne `searchTsv` (tsvector) maintenue par un TRIGGER Postgres —
 * donc toujours synchrone, sans une ligne de code applicatif.
 *
 * ⚠️ Configuration **`simple`** (aucune racinisation), et NON `french` : le racinisateur
 * français confond des termes juridiques distincts — `loyer` y devient `loi`, si bien qu'une
 * recherche « loyer » rapportait 1 575 documents dont 1 548 (98 %) sans le mot, toutes les
 * LOIS du fonds. La morphologie est rendue côté requête par PRÉFIXE (`mot:*`), qui trouve
 * « societes » depuis « societe » sans jamais confondre deux mots distincts (cf. tsquery.ts).
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
  setweight(to_tsvector('simple', f_unaccent(
      coalesce(${r}."titleFr",'') || ' ' || coalesce(${r}."titleEn",'') || ' ' ||
      coalesce(${r}."titleHt",'') || ' ' || coalesce(${r}."number",''))), 'A')
  || setweight(to_tsvector('simple', f_unaccent(
      coalesce(${r}."summaryFr",'') || ' ' || coalesce(${r}."summaryEn",'') || ' ' ||
      coalesce(${r}."summaryHt",'') || ' ' || coalesce(${r}."keywords",'') || ' ' ||
      coalesce(${r}."moniteurRef",''))), 'B')
  || setweight(to_tsvector('simple', coalesce(${r}."searchText",'')), 'C')
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

  // Colonnes SOURCES du vecteur : toute écriture qui n'en touche AUCUNE ne doit PAS
  // recalculer le vecteur ni churner l'index GIN. Sans cette garde, un simple
  // `UPDATE … SET imageUrl=…` (marques), l'écriture du cache OCR de sommaire, ou un
  // `touch` de updatedAt recomputait un tsvector de plusieurs centaines de Ko et
  // réinsérait la ligne dans le GIN → fragmentation et écritures inutilement lentes.
  const SRC_COLS = [
    'titleFr', 'titleEn', 'titleHt', 'number', 'summaryFr', 'summaryEn', 'summaryHt',
    'keywords', 'moniteurRef', 'searchText',
  ]
  const changedPredicate = SRC_COLS.map((c) => `NEW."${c}" IS DISTINCT FROM OLD."${c}"`).join(' OR ')

  // La configuration plein-texte (l'EXPRESSION du vecteur) a-t-elle changé depuis la dernière
  // exécution ? On cherche la signature de l'expression dans le corps de la fonction installée
  // — insensible à la garde ci-dessus, sensible à un changement réel (french→simple, nouveau
  // champ pondéré…). Si elle a changé, tous les vecteurs sont périmés → reconstruction totale.
  const TRIGGER_BODY = `
     BEGIN
       IF (TG_OP = 'INSERT') OR (${changedPredicate}) THEN
         NEW."searchTsv" := ${TSV_EXPR('NEW')};
       END IF;
       RETURN NEW;
     END `
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  const exprSig = norm(TSV_EXPR('NEW'))
  const prev = await prisma.$queryRawUnsafe<{ src: string }[]>(
    `SELECT prosrc AS src FROM pg_proc WHERE proname = 'document_tsv_refresh'`,
  )
  const configChanged = prev.length > 0 && !norm(prev[0].src).includes(exprSig)
  if (configChanged) console.log('  ⚠️ configuration plein-texte MODIFIÉE → reconstruction complète des vecteurs')

  await step(
    'fonction du trigger',
    `CREATE OR REPLACE FUNCTION document_tsv_refresh() RETURNS trigger
     LANGUAGE plpgsql AS $$${TRIGGER_BODY}$$`,
  )
  await step('trigger BEFORE INSERT/UPDATE', `DROP TRIGGER IF EXISTS document_tsv_trg ON "Document"`)
  await step(
    'trigger document_tsv_trg',
    `CREATE TRIGGER document_tsv_trg BEFORE INSERT OR UPDATE ON "Document"
     FOR EACH ROW EXECUTE FUNCTION document_tsv_refresh()`,
  )

  // Remplissage (par lots : pas de verrou long, progression visible).
  // Reconstruction complète après changement de configuration ; sinon on ne comble que les
  // vecteurs manquants. Le parcours par curseur sur `id` évite de dépendre d'un prédicat
  // « à refaire » qui n'existe pas lors d'une reconstruction.
  const [{ n: todo }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    configChanged
      ? `SELECT count(*) AS n FROM "Document"`
      : `SELECT count(*) AS n FROM "Document" WHERE "searchTsv" IS NULL`,
  )
  if (Number(todo) > 0) {
    console.log(`  … ${configChanged ? 'reconstruction' : 'remplissage'} : ${todo} documents`)
    let done = 0
    let cursor = ''
    for (;;) {
      const t0 = Date.now()
      const n = configChanged
        ? await prisma.$executeRawUnsafe(
            `UPDATE "Document" d SET "searchTsv" = ${TSV_EXPR('d')}
             WHERE d.id IN (SELECT id FROM "Document" WHERE id > $1 ORDER BY id LIMIT 2000)`,
            cursor,
          )
        : await prisma.$executeRawUnsafe(
            `UPDATE "Document" d SET "searchTsv" = ${TSV_EXPR('d')}
             WHERE d.id IN (SELECT id FROM "Document" WHERE "searchTsv" IS NULL LIMIT 2000)`,
          )
      if (!n) break
      done += n
      if (configChanged) {
        const [last] = await prisma.$queryRawUnsafe<{ id: string }[]>(
          `SELECT id FROM "Document" WHERE id > $1 ORDER BY id LIMIT 1 OFFSET $2`, cursor, n - 1,
        )
        if (!last) break
        cursor = last.id
      }
      console.log(`     ${done}/${todo} (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    }
  } else {
    console.log('  ✓ vecteurs déjà remplis')
  }

  // ── Index GIN : DEUX index PARTIELS complémentaires (une partition du pauvre) ──
  //
  // 25 % du corpus (7 264 lignes) sont des avis-sociétés groupés (category='SOCIETE'),
  // TOUJOURS masqués par défaut (représentés par les fiches Société). Avec un index unique,
  // « societe » appariait 7 676 lignes puis en JETAIT 7 139 après lecture du tas (mesuré :
  // 4 212 blocs de tas lus pour n'en garder que 537) → jusqu'à 2,6 s à froid.
  //
  //   • Document_searchTsv_visible_idx  WHERE (category IS NULL OR category <> 'SOCIETE')
  //       → sert TOUTE recherche par défaut et tout filtre de catégorie ≠ SOCIETE.
  //   • Document_searchTsv_societe_idx  WHERE category = 'SOCIETE'
  //       → sert le seul filtre explicite « Société » (chip de l'Index).
  // Union = tout le corpus ; chaque requête n'utilise QUE sa partition. Résultat : « societe »
  // ~11 ms à chaud, ~8× moins de blocs de tas à froid.
  //
  // ⚠️ Prisma ne sait PAS représenter un index PARTIEL (pas de clause WHERE dans le schéma) :
  // `prisma migrate diff` les IGNORE (« empty migration » vérifié) — ils survivent donc à
  // `prisma db push` sans dérive. L'ancien index plein n'est plus déclaré dans le schéma.
  //
  // fastupdate=off : corpus lu en permanence, écrit rarement (admin). La « pending list » du
  // GIN (source de la fragmentation : 15 Mo au lieu de 9,9) ne s'accumule plus jamais ; chaque
  // écriture, rare, paie son insertion GIN en ligne. Fini les REINDEX périodiques.
  const gin = (name: string, where: string) =>
    `CREATE INDEX IF NOT EXISTS "${name}" ON "Document" USING GIN ("searchTsv") WITH (fastupdate = off) WHERE ${where}`
  await step('index partiel « visible »', gin('Document_searchTsv_visible_idx', `("category" IS NULL OR "category" <> 'SOCIETE')`))
  await step('index partiel « société »', gin('Document_searchTsv_societe_idx', `("category" = 'SOCIETE')`))
  // Garantit fastupdate=off même si l'index préexistait sans (ex. créé par une version antérieure).
  await step('fastupdate=off (visible)', `ALTER INDEX "Document_searchTsv_visible_idx" SET (fastupdate = off)`)
  await step('fastupdate=off (société)', `ALTER INDEX "Document_searchTsv_societe_idx" SET (fastupdate = off)`)
  // Abandon de l'index plein unique (remplacé par les deux partiels). CONCURRENTLY : sans verrou.
  await step('abandon de l\'ancien index plein', `DROP INDEX CONCURRENTLY IF EXISTS "Document_searchTsv_idx"`)
  // Après une reconstruction en masse, défragmenter les partiels (pending list résiduelle).
  if (configChanged) {
    await step('REINDEX visible', `REINDEX INDEX CONCURRENTLY "Document_searchTsv_visible_idx"`)
    await step('REINDEX société', `REINDEX INDEX CONCURRENTLY "Document_searchTsv_societe_idx"`)
  }
  // VACUUM (ANALYZE) : rafraîchit les statistiques ET la visibility map (lectures plus rapides).
  await step('VACUUM ANALYZE Document', `VACUUM (ANALYZE) "Document"`)

  // ── Contrôles ──
  const [{ n: total }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "Document"`)
  const [{ n: filled }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "Document" WHERE "searchTsv" IS NOT NULL AND "searchTsv" <> ''::tsvector`)
  const sizes = await prisma.$queryRawUnsafe<{ relname: string; sz: string }[]>(
    `SELECT relname, pg_size_pretty(pg_relation_size(oid)) AS sz FROM pg_class
     WHERE relname IN ('Document_searchTsv_visible_idx','Document_searchTsv_societe_idx') ORDER BY relname`,
  )
  console.log(`\n  documents : ${filled}/${total} avec vecteur`)
  for (const s of sizes) console.log(`  index GIN ${s.relname} : ${s.sz}`)
  const [{ n: hits }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "Document" WHERE "searchTsv" @@ to_tsquery('simple', 'societe:*')`,
  )
  console.log(`  contrôle : « societe » → ${hits} documents appariables (sans plafond)`)

  // Contrôle de PRÉCISION : c'est la régression qui a motivé l'abandon de la configuration
  // `french` (« loyer » y remontait 1 548 lois sans rapport). Doit rester à 0.
  const [{ n: faux }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM "Document"
     WHERE "searchTsv" @@ to_tsquery('simple', 'loyer:*') AND position('loyer' in "searchText") = 0`,
  )
  console.log(`  contrôle de précision : « loyer » → ${faux} faux positifs ${Number(faux) === 0 ? '✔' : '✗'}`)

  // Contrôle du trigger — DEUX propriétés : (a) une écriture SANS champ source ne recalcule
  // pas (la garde) ; (b) une écriture d'un champ source met bien le vecteur à jour.
  const [probe] = await prisma.$queryRawUnsafe<{ id: string; kw: string | null }[]>(
    `SELECT id, "keywords" AS kw FROM "Document" WHERE "searchTsv" IS NOT NULL LIMIT 1`,
  )
  // (a) touch de updatedAt : le vecteur doit rester présent (garde : pas de recalcul).
  await prisma.$executeRawUnsafe(`UPDATE "Document" SET "updatedAt" = now() WHERE id = $1`, probe.id)
  const [{ ok: kept }] = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(
    `SELECT ("searchTsv" IS NOT NULL) AS ok FROM "Document" WHERE id = $1`, probe.id,
  )
  // (b) écriture d'un champ source (remise à sa valeur d'origine) : le vecteur doit être recalculé
  // (non nul). On restaure keywords à l'identique — aucune donnée modifiée.
  await prisma.$executeRawUnsafe(`UPDATE "Document" SET "keywords" = $2 WHERE id = $1`, probe.id, probe.kw)
  const [{ ok: refreshed }] = await prisma.$queryRawUnsafe<{ ok: boolean }[]>(
    `SELECT ("searchTsv" IS NOT NULL) AS ok FROM "Document" WHERE id = $1`, probe.id,
  )
  console.log(`  contrôle trigger (garde + recalcul) : ${kept && refreshed ? 'OK ✔' : 'ÉCHEC ✗'}`)

  await prisma.$disconnect()
  console.log('\n✅ Migration terminée.')
}

main().catch(async (e) => {
  console.error('\n❌', e)
  await prisma.$disconnect()
  process.exit(1)
})
