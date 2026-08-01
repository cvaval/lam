/**
 * Revérifie la borne d'articles du Code de procédure civile.
 *
 * `src/lib/doc/coderefs.ts` n'émet un lien que vers un article RÉEL du Code (1..997) :
 * un renvoi hors borne — le recueil du Code civil en porte quinze, séquelles d'OCR
 * (« C. p. c. 4745 ») — reste du texte plutôt que de devenir un lien mort. Cette borne
 * est une CONSTANTE, donc elle peut se périmer si le Code est réimporté. Ce script la
 * confronte à la base ; il ne modifie rien.
 *
 *     npx tsx scripts/verify-cpc-articles.ts
 *
 * Sort en code 1 si la constante ne correspond plus.
 */
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { CPC_LAST_ARTICLE } from '../src/lib/doc/coderefs'

const prisma = new PrismaClient()

async function main() {
  const doc = await prisma.document.findFirst({
    where: { source: 'CODE_PROCEDURE_CIVILE' },
    select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true },
  })
  if (!doc) throw new Error('Aucun document de source CODE_PROCEDURE_CIVILE en base.')

  // Mêmes ancres que le lecteur : c'est ce que la cible d'un lien doit trouver.
  const ancres = new Set<string>()
  for (const ligne of (doc.bodyClean ?? doc.bodyOriginal).split('\n')) {
    const a = articleAnchorFromHeading(ligne)
    if (a) ancres.add(a)
  }
  const entiers = [...ancres]
    .map((a) => Number(/^art-(\d+)$/.exec(a)?.[1]))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)

  const manquants: number[] = []
  for (let n = 1; n <= CPC_LAST_ARTICLE; n++) if (!ancres.has(`art-${n}`)) manquants.push(n)
  const dernier = entiers[entiers.length - 1]

  console.log(`${doc.titleFr} (${doc.id})`)
  console.log(`  ancres d'article : ${ancres.size} (dont ${entiers.length} numéros entiers)`)
  console.log(`  intervalle réel  : ${entiers[0]} … ${dernier}`)
  console.log(`  constante        : CPC_LAST_ARTICLE = ${CPC_LAST_ARTICLE}`)

  const ok = manquants.length === 0 && dernier === CPC_LAST_ARTICLE
  if (manquants.length) {
    console.error(`  ✗ ${manquants.length} article(s) annoncé(s) par la constante sont ABSENTS : ${manquants.slice(0, 20).join(', ')}${manquants.length > 20 ? '…' : ''}`)
    console.error('    → des renvois du Code civil pointeraient dans le vide.')
  }
  if (dernier !== CPC_LAST_ARTICLE) {
    console.error(`  ✗ le Code va jusqu'à ${dernier} : ${dernier > CPC_LAST_ARTICLE ? 'des renvois légitimes sont refusés' : 'la constante promet des articles inexistants'}.`)
    console.error(`    → ajuster CPC_LAST_ARTICLE à ${dernier} dans src/lib/doc/coderefs.ts.`)
  }
  console.log(ok ? '  ✓ la constante correspond au Code en base.' : '')
  await prisma.$disconnect()
  if (!ok) process.exit(1)
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
