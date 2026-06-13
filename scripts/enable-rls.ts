/**
 * Sécurité Supabase — active Row Level Security (RLS) sur TOUTES les tables du
 * schéma `public`. Sans RLS, l'API REST publique de Supabase (PostgREST + clé
 * anon) exposerait les tables (User, Session, Document…). Avec RLS activé et
 * AUCUNE politique, l'API publique renvoie « refusé » par défaut ; l'application
 * (Prisma via le rôle postgres, qui contourne le RLS) garde un accès complet.
 *
 * Idempotent. À RELANCER APRÈS TOUT `prisma db push` / `migrate` qui crée des
 * tables (les nouvelles tables naissent sans RLS).
 *
 *   npm run db:rls         (charger .env au préalable : set -a; . ./.env; set +a)
 */
import { PrismaClient } from '@prisma/client'

// Connexion DIRECTE (DDL) si dispo, sinon connexion par défaut.
const prisma = new PrismaClient(
  process.env.DIRECT_URL ? { datasources: { db: { url: process.env.DIRECT_URL } } } : undefined,
)

async function main() {
  const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  )
  let enabled = 0
  for (const { tablename } of tables) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "public"."${tablename}" ENABLE ROW LEVEL SECURITY;`)
    enabled++
  }
  const on: { n: number }[] = await prisma.$queryRawUnsafe(
    "select count(*)::int n from pg_tables where schemaname = 'public' and rowsecurity",
  )
  console.log(`✅  RLS actif sur ${on[0].n}/${tables.length} tables du schéma public.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
