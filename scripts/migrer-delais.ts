/**
 * Applique `prisma/sql/2026-08-delais.sql` — les quatre tables du calculateur de délais.
 *
 *   npx tsx scripts/migrer-delais.ts            (à blanc : montre ce qui serait fait)
 *   npx tsx scripts/migrer-delais.ts --apply    (écrit)
 *
 * ⚠️ CETTE BASE EST CELLE DE PRODUCTION. Trois précautions sont prises ici :
 *
 *  1. **Le DDL est transactionnel sous PostgreSQL.** Les seize instructions passent dans une
 *     seule transaction : ou bien tout existe, ou bien rien n'a bougé. Pas de demi-migration à
 *     rattraper à la main.
 *  2. **Rien n'est détruit.** Le script REFUSE de s'exécuter si le fichier SQL contient une
 *     instruction destructive — DROP, TRUNCATE, DELETE, ou un ALTER sur une table existante.
 *     Le contrôle est fait ici, pas dans la revue de code : un fichier modifié plus tard ne
 *     passera pas davantage.
 *  3. **Il est idempotent par refus.** Si les tables existent déjà, il s'arrête et le dit,
 *     plutôt que d'échouer à mi-course sur la première collision.
 */
import { prisma } from '../src/lib/db'
import { readFileSync } from 'fs'
import { join } from 'path'

const FICHIER = join(process.cwd(), 'prisma/sql/2026-08-delais.sql')
const ATTENDUES = ['DelaiEntry', 'DelaiEntryRevision', 'DelaiFerie', 'DelaiFenetreSignification']

/** Une instruction qui touche à l'existant : on ne l'exécute pas, on s'arrête. */
const DESTRUCTIVE = /^\s*(DROP|TRUNCATE|DELETE)\b|^\s*ALTER\s+TABLE\s+"(?!Delai)/i

async function main() {
  const apply = process.argv.includes('--apply')

  const brut = readFileSync(FICHIER, 'utf8')
  const instructions = brut
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  const interdites = instructions.filter((s) => DESTRUCTIVE.test(s))
  if (interdites.length) {
    console.error(`⛔ ${interdites.length} instruction(s) destructive(s) dans le fichier SQL — RIEN n'est exécuté :`)
    for (const i of interdites) console.error('   ' + i.slice(0, 120))
    process.exit(1)
  }

  const existantes: { table_name: string }[] = await prisma.$queryRaw`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_name like 'Delai%'`
  if (existantes.length) {
    console.log(`Les tables existent déjà (${existantes.map((t) => t.table_name).join(', ')}).`)
    console.log('Rien à faire. Pour repartir de zéro, il faudrait les supprimer à la main — ce que')
    console.log('ce script ne fait pas.')
    await prisma.$disconnect()
    return
  }

  console.log(`${instructions.length} instructions, toutes additives :`)
  for (const s of instructions) console.log('   ' + s.split('\n')[0].slice(0, 96))

  if (!apply) {
    console.log('\n(exécution à blanc — ajouter --apply pour écrire)')
    await prisma.$disconnect()
    return
  }

  const avant: { table_name: string }[] = await prisma.$queryRaw`
    select table_name from information_schema.tables where table_schema = 'public'`

  // Une seule transaction : tout ou rien.
  await prisma.$transaction(instructions.map((s) => prisma.$executeRawUnsafe(s)))

  const apres: { table_name: string }[] = await prisma.$queryRaw`
    select table_name from information_schema.tables where table_schema = 'public'`
  const creees = apres
    .map((t) => t.table_name)
    .filter((t) => !avant.some((a) => a.table_name === t))
    .sort()

  const index: { indexname: string }[] = await prisma.$queryRaw`
    select indexname from pg_indexes where schemaname = 'public' and tablename like 'Delai%'`

  console.log(`\n✓ ${avant.length} tables avant, ${apres.length} après (+${apres.length - avant.length})`)
  console.log(`✓ créées : ${creees.join(', ')}`)
  console.log(`✓ ${index.length} index posés`)

  const manquantes = ATTENDUES.filter((t) => !creees.includes(t))
  if (manquantes.length) {
    console.error(`⛔ MANQUE : ${manquantes.join(', ')}`)
    process.exit(1)
  }
  console.log('\nLes quatre tables sont en place et vides. La graine est le geste suivant :')
  console.log('   npx tsx scripts/seed-delais.ts --apply')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC — rien n’a été appliqué (transaction annulée) :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
