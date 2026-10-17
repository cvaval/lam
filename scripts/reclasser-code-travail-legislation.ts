/**
 * LE CODE DU TRAVAIL PASSE DU TYPE DOCTRINE AU TYPE LEGISLATION — décision de Me Vaval du
 * 17 oct. 2026 : « le code du travail doit etre dans legislation annotee. Declassez le et rangez
 * le dans legislation annotee. »
 *
 *     npx tsx scripts/reclasser-code-travail-legislation.ts            # à blanc
 *     npx tsx scripts/reclasser-code-travail-legislation.ts --commit   # écrit, sauvegarde l'état antérieur
 *
 * La rubrique « Législation annotée » liste les types LEGISLATION et DOCTRINE (`DOC_TYPE_META`) :
 * le Code du travail y figurait déjà, mais seul de son espèce sous le type DOCTRINE, à côté du
 * Code civil, du Code de commerce, du Code de procédure civile… tous LEGISLATION. Conséquences du
 * type DOCTRINE : un renvoi vers lui n'est cliquable que pour un compte qui a le service Doctrine,
 * le bouton « Version Word » lui est refusé, les renvois du corpus le visent tantôt en DOCTRINE,
 * tantôt en LEGISLATION.
 *
 * Ce qui change : `Document.type` (même id — favoris, notes, liens, thèmes, versions d'articles
 * restent attachés), le `toType` des renvois qui le visent, sa réindexation. Le texte, l'appareil,
 * les thèmes, le statut, les dates : rien. La copie DOCTRINE du Code des douanes n'est pas visée.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const COMMIT = process.argv.includes('--commit')
const SOURCE = 'CODE_TRAVAIL_ANNOTE'

const stop = (m: string): never => {
  throw new Error(`⛔ ${m} — rien n'est écrit`)
}

async function main() {
  const fiches = await prisma.document.findMany({ where: { source: SOURCE }, select: { id: true, type: true, titleFr: true, number: true, status: true } })
  if (fiches.length !== 1) stop(`${fiches.length} fiche(s) de source ${SOURCE} au lieu d'une`)
  const ct = fiches[0]
  const renvois = await prisma.crossRef.findMany({ where: { toId: ct.id }, select: { id: true, fromId: true, toType: true, kind: true } })
  // `toType` ne sert qu'à la résolution PAR DÉSIGNATION (toType + toNumber) ; un renvoi résolu par
  // `toId` sans `toType` (null) n'affirme rien et reste tel quel. Seul DOCTRINE devient faux.
  const aCorriger = renvois.filter((r) => r.toType === 'DOCTRINE')
  const themes = await prisma.documentTheme.count({ where: { documentId: ct.id } })

  console.log(`Code du travail ${ct.id} « ${ct.titleFr} » (${ct.number}) : type ${ct.type} → LEGISLATION`)
  console.log(`renvois qui le visent : ${renvois.length} (dont ${aCorriger.length} en toType DOCTRINE → LEGISLATION)`)
  for (const r of renvois) console.log(`   ${aCorriger.includes(r) ? '→' : '='} ${r.id} depuis ${r.fromId} ${r.kind} toType ${r.toType}`)
  console.log(`thèmes rattachés : ${themes} (inchangés)`)
  if (ct.type === 'LEGISLATION' && !aCorriger.length) {
    console.log('\n= déjà reclassé, rien à faire')
    return
  }
  if (ct.type !== 'DOCTRINE' && ct.type !== 'LEGISLATION') stop(`type inattendu ${ct.type}`)
  if (!COMMIT) {
    console.log('\n(à blanc — --commit pour écrire)')
    return
  }

  const journal = join(process.cwd(), `docs/livraison-code-fiscal-2026/etat-anterieur-reclassement-code-travail-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(journal, JSON.stringify({ document: ct, renvois }, null, 1))
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: ct.id }, data: { type: 'LEGISLATION' } })
    await tx.crossRef.updateMany({ where: { id: { in: aCorriger.map((r) => r.id) } }, data: { toType: 'LEGISLATION' } })
    // Délai large : toute écriture sur la ligne fait recalculer au déclencheur le tsvector d'un
    // corps de 468 000 caractères (10 s mesurées, au-delà des 5 s par défaut).
  }, { timeout: 120_000 })
  await reindexDocument(ct.id)
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: ct.id, meta: { via: 'reclasser-code-travail-legislation', correction: 'type DOCTRINE → LEGISLATION', renvois: aCorriger.length, decision: 'déclassez-le et rangez-le dans législation annotée (17 oct. 2026)' } })

  const relu = await prisma.document.findUnique({ where: { id: ct.id }, select: { type: true } })
  const reste = await prisma.crossRef.count({ where: { toId: ct.id, toType: 'DOCTRINE' } })
  const themesApres = await prisma.documentTheme.count({ where: { documentId: ct.id } })
  if (relu?.type !== 'LEGISLATION' || reste || themesApres !== themes) stop(`recompte : type ${relu?.type}, ${reste} renvoi(s) non corrigé(s), thèmes ${themesApres}/${themes}`)
  console.log(`\n✅ écrit et recompté — type LEGISLATION, ${aCorriger.length} renvoi(s) corrigé(s), ${themes} thèmes intacts — état antérieur : ${journal}`)
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
