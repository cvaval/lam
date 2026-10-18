/**
 * Code civil — une abrogation SANS ACTE dit « Abrogé », rien de plus (Me Vaval, 18 oct. 2026 : « juste indiquer
 * abrogé. ne pas spécifier "[Abrogé — acte non précisé par l'éditeur (texte imprimé en italique à l'édition
 * Zémès 2011)]" »).
 *
 * Le lecteur compose « [Abrogé — <amendedByNumber>] » (src/lib/legislation/segment.ts) : un `amendedByNumber`
 * NUL donne « [Abrogé] ». Trois retouches :
 *   - versions ABROGE / EN_VIGUEUR portant la mention « acte non précisé… » → `amendedByNumber` nul ;
 *   - art. 18 (1° par le décret du 30 août 1988, 3° sans acte) → la seule désignation du décret, « (1°) » ;
 *   - commentaires des mots abrogés sans acte (« Imprimé en italique (abrogé)… ») → « Abrogé : « … ». ».
 *
 *     npx tsx scripts/simplifier-abroge-sans-acte-code-civil.ts            # à blanc
 *     npx tsx scripts/simplifier-abroge-sans-acte-code-civil.ts --commit   # écrit
 */
import { PrismaClient } from '@prisma/client'
import { reindexDocument } from '../src/lib/search/reindex'
import { audit } from '../src/lib/auth/audit'

const ID = 'cmr4b6f3v0000iz56asjmwrlg'
const COMMIT = process.argv.includes('--commit')
const prisma = new PrismaClient()

const NP = "acte non précisé par l'éditeur (texte imprimé en italique à l'édition Zémès 2011)"
const ART18_AVANT =
  "Décret du 30 août 1988 abolissant la mort civile, abrogeant les articles 19 et 20 du Code civil et modifiant l'article 212 dudit Code (1°) ; acte non précisé par l'éditeur (3°)"
const ART18_APRES =
  "Décret du 30 août 1988 abolissant la mort civile, abrogeant les articles 19 et 20 du Code civil et modifiant l'article 212 dudit Code (1°)"
const COMMENTAIRE = /^Imprimés? en italique \(abrogés?\) à l'édition Zémès 2011, acte non précisé : (.+)$/

async function main() {
  const versions = await prisma.articleVersion.findMany({
    where: { documentId: ID, amendedByNumber: { in: [NP, ART18_AVANT] } },
    select: { id: true, anchor: true, status: true, amendedByNumber: true },
  })
  const vides = versions.filter((v) => v.amendedByNumber === NP)
  const art18 = versions.filter((v) => v.amendedByNumber === ART18_AVANT)
  if (art18.length !== 1 || art18[0].anchor !== 'art-18') throw new Error(`⛔ art. 18 : ${art18.length} version(s) attendue(s) 1`)

  const doc = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { annotationsJson: true } })
  const brut = JSON.parse(doc.annotationsJson!) as Record<string, any>
  const retouches: { cle: string; avant: string; apres: string }[] = []
  for (const [cle, arr] of Object.entries((brut.commentaires ?? {}) as Record<string, string[]>)) {
    arr.forEach((t, i) => {
      const m = COMMENTAIRE.exec(t)
      if (!m) return
      const pluriel = /^Imprimés/.test(t)
      const apres = `${pluriel ? 'Abrogés' : 'Abrogé'} : ${m[1]}`
      retouches.push({ cle, avant: t, apres })
      arr[i] = apres
    })
  }

  console.log(`versions sans acte → « [Abrogé] » : ${vides.length} (${vides.map((v) => `${v.anchor}/${v.status}`).join(', ')})`)
  console.log(`art. 18 : « … (1°) ; acte non précisé… (3°) » → « … (1°) »`)
  console.log(`commentaires simplifiés : ${retouches.length}`)
  for (const r of retouches) console.log(`  ${r.cle} : ${r.apres}`)
  if (!COMMIT) return console.log('(à blanc — --commit pour écrire)')

  await prisma.$transaction(async (tx) => {
    await tx.articleVersion.updateMany({ where: { id: { in: vides.map((v) => v.id) } }, data: { amendedByNumber: null } })
    await tx.articleVersion.update({ where: { id: art18[0].id }, data: { amendedByNumber: ART18_APRES } })
    await tx.document.update({ where: { id: ID }, data: { annotationsJson: JSON.stringify(brut) } })
  }, { timeout: 180_000, maxWait: 30_000 }) // 1,3 Mo d'annotations : les 5 s par défaut ne suffisent pas (P2028)
  await reindexDocument(ID)
  await audit({
    action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: ID,
    meta: { via: 'simplifier-abroge-sans-acte-code-civil', versions: vides.length + 1, commentaires: retouches.length, decision: 'abrogé sans acte : « Abrogé », rien de plus — Me Vaval, 18 oct. 2026' },
  })
  // ⚠️ `audit()` avale ses erreurs : on recompte après la transaction.
  const restantes = await prisma.articleVersion.count({ where: { documentId: ID, amendedByNumber: { contains: 'acte non précisé' } } })
  const apres = await prisma.document.findUniqueOrThrow({ where: { id: ID }, select: { annotationsJson: true } })
  console.log(`✅ écrit — versions encore « acte non précisé » : ${restantes} ; commentaires : ${(apres.annotationsJson!.match(/acte non précisé/g) ?? []).length}`)
}

main().finally(() => prisma.$disconnect())
