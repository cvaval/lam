/**
 * Affiche l'arbre des thèmes de la Législation annotée tel qu'il est EN BASE
 * (lecture seule) + quelques compteurs de contrôle.  npm run themes:tree
 */
import { getThemeTree, type ThemeNode } from '../src/lib/legislation/themes'
import { prisma } from '../src/lib/db'

function printNode(n: ThemeNode, depth: number) {
  const bullet = depth === 0 ? '■ ' : '  '.repeat(depth) + '› '
  const childCount = n.children.length ? `  (${n.children.length})` : ''
  console.log(`${bullet}${n.labelFr}${n.active ? '' : ' [archivé]'}${childCount}   ⟨${n.slug}⟩`)
  for (const c of n.children) printNode(c, depth + 1)
}

async function main() {
  const [docs, users, themes, links, refs, versions] = await Promise.all([
    prisma.document.count(),
    prisma.user.count(),
    prisma.theme.count(),
    prisma.documentTheme.count(),
    prisma.crossRef.count(),
    prisma.articleVersion.count(),
  ])
  console.log('— Contrôle (données existantes intactes ; nouvelles tables) —')
  console.log(`Documents : ${docs}   Utilisateurs : ${users}`)
  console.log(`Thèmes : ${themes}   Rattachements : ${links}   Renvois : ${refs}   Versions d'article : ${versions}`)
  console.log('\n— Taxonomie en base —')
  const tree = await getThemeTree()
  for (const root of tree) printNode(root, 0)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
