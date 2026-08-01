/**
 * Revérifie les bornes d'articles des codes CITÉS par le Code civil.
 *
 * `src/lib/doc/coderefs.ts` n'émet un lien que vers un article RÉEL du Code (1..997) :
 * un renvoi hors borne — le recueil du Code civil en porte quinze, séquelles d'OCR
 * (« C. p. c. 4745 ») — reste du texte plutôt que de devenir un lien mort. Cette borne
 * est une CONSTANTE, donc elle peut se périmer si le Code est réimporté. Ce script la
 * confronte à la base ; il ne modifie rien.
 *
 *     npx tsx scripts/verify-code-articles.ts
 *
 * Sort en code 1 si la constante ne correspond plus.
 */
import { PrismaClient } from '@prisma/client'
import { articleAnchorFromHeading } from '../src/lib/doc/anchors'
import { CPC_LAST_ARTICLE, CP_LAST_ARTICLE, CP_MISSING_ARTICLES } from '../src/lib/doc/coderefs'

const prisma = new PrismaClient()

/** Ancres d'article telles que le lecteur les produit — c'est ce qu'un lien doit trouver. */
async function ancresDe(source: string): Promise<{ id: string; titre: string; set: Set<string> }> {
  const doc = await prisma.document.findFirst({
    where: { source },
    select: { id: true, titleFr: true, bodyOriginal: true, bodyClean: true },
  })
  if (!doc) throw new Error(`Aucun document de source ${source} en base.`)
  const set = new Set<string>()
  for (const ligne of (doc.bodyClean ?? doc.bodyOriginal).split('\n')) {
    const a = articleAnchorFromHeading(ligne)
    if (a) set.add(a)
  }
  return { id: doc.id, titre: doc.titleFr, set }
}

async function main() {
  let ok = true

  // ── Code pénal : liste explicite des numéros absents (il n'est PAS continu) ────
  const cp = await ancresDe('CODE_PENAL_ANNOTE')
  const cpEntiers = [...cp.set].map((a) => Number(/^art-(\d+)$/.exec(a)?.[1])).filter(Number.isFinite).sort((a, b) => a - b)
  const cpDernier = cpEntiers[cpEntiers.length - 1]
  const cpAbsents: number[] = []
  for (let n = 1; n <= CP_LAST_ARTICLE; n++) if (!cp.set.has(`art-${n}`)) cpAbsents.push(n)
  const attendus = [...CP_MISSING_ARTICLES].sort((a, b) => a - b).join(',')
  console.log(`${cp.titre} (${cp.id})`)
  console.log(`  ancres : ${cp.set.size} · intervalle ${cpEntiers[0]} … ${cpDernier}`)
  console.log(`  constantes : CP_LAST_ARTICLE = ${CP_LAST_ARTICLE} · absents = [${attendus}]`)
  if (cpAbsents.join(',') !== attendus) {
    ok = false
    console.error(`  ✗ les numéros sans article sont [${cpAbsents.join(',')}] — mettre à jour CP_MISSING_ARTICLES.`)
  }
  if (cpDernier !== CP_LAST_ARTICLE) {
    ok = false
    console.error(`  ✗ le Code va jusqu'à ${cpDernier} : ajuster CP_LAST_ARTICLE.`)
  }
  if (ok) console.log('  ✓ la liste correspond au Code en base.')
  console.log()

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

  ok = ok && manquants.length === 0 && dernier === CPC_LAST_ARTICLE
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
