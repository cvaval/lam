/**
 * Réinjecte l'index thématique (scripts/data/code-civil/parsed/structure.json) dans le
 * document Code civil EN PLACE — sans purge ni ré-import (l'id du doc ne change pas).
 * À lancer après avoir complété l'index : npx tsx scripts/_cc_index.ts (incrémental).
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'

async function main() {
  const struct = JSON.parse(readFileSync('scripts/data/code-civil/parsed/structure.json', 'utf8'))
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' }, select: { id: true, annotationsJson: true } })
  if (!doc) throw new Error('Code civil introuvable — lancer scripts/_import-code-civil.ts d’abord.')
  const cur = JSON.parse(doc.annotationsJson ?? '{}')
  console.log(`Index actuel : ${(cur.indexEntries ?? []).length} sujets → nouveau : ${struct.indexEntries.length} sujets`)
  cur.indexEntries = struct.indexEntries
  await prisma.document.update({ where: { id: doc.id }, data: { annotationsJson: JSON.stringify(cur) } })
  console.log(`✅ Index réinjecté dans ${doc.id} (aucun autre champ touché).`)
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
