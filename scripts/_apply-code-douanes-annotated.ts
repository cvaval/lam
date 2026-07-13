/**
 * Code des Douanes → lecteur ANNOTÉ (comme le Code civil) dans « Législation annotée ».
 *
 * Pose l'annotationsJson (scripts/data/code-douanes/parse_cd.py : toc/navToc à partir des
 * en-têtes RÉELS du corps, 345 articles, index thématique = inversion du themeIndexJson) sur
 * la COPIE Doctrine (thème « code-douanier » / « Droit fiscal & douanier ») et lui donne une
 * source dédiée CODE_DOUANES_ANNOTE pour activer, côté lecteur, le menu latéral (Sommaire +
 * Index) et les renvois inline « article N » (comme CODE_CIVIL/PENAL_ANNOTE).
 *
 * bodyOriginal INCHANGÉ (§02). Idempotent. À relancer après enrichissement IA de l'index.
 *   npx tsx scripts/_apply-code-douanes-annotated.ts
 */
import { readFileSync } from 'node:fs'
import { prisma } from '../src/lib/db'
import { reindexDocument } from '../src/lib/search/reindex'
import { segmentAnnotated } from '../src/lib/legislation/annotated'

const SOURCE = 'CODE_DOUANES_ANNOTE'

async function main() {
  const struct = JSON.parse(readFileSync('scripts/data/code-douanes/annotations.json', 'utf8'))
  // Corps affiché de la copie annotée = corps SANS les deux tables terminales redondantes
  // (déplacées vers le menu latéral). L'original LÉGISLATION garde son corps intégral (§02).
  const bodyTrimmed = readFileSync('scripts/data/code-douanes/body_trimmed.txt', 'utf8')

  // Les DEUX exemplaires du Code des Douanes : « Législation annotée » (DOCTRINE) ET
  // « Éditions Le Moniteur » (LEGISLATION) — l'utilisatrice veut le même lecteur annoté sur les deux.
  const docs = await prisma.document.findMany({
    where: { type: { in: ['DOCTRINE', 'LEGISLATION'] }, number: 'LM2023-SP11', matiere: 'Droit douanier' },
    select: { id: true, type: true, bodyOriginal: true, source: true },
  })
  if (!docs.length) throw new Error('Code des Douanes introuvable (LM2023-SP11)')

  // Vérif de cohérence AVANT écriture : sur le corps AFFICHÉ (rogné), chaque libellé du toc
  // doit s'apparier et AUCUNE fausse tête d'article ne doit subsister (tables retirées).
  const blocks = segmentAnnotated(bodyTrimmed, struct.toc)
  const secMatched = blocks.filter((b) => b.kind === 'section').length
  if (secMatched !== struct.toc.length) {
    throw new Error(`segmentation incohérente : ${secMatched}/${struct.toc.length} en-têtes appariés — annulé`)
  }
  const anchored = new Set(blocks.filter((b) => b.kind === 'body' && b.anchor).map((b) => b.anchor))
  console.log(`Vérif segmentation : ${secMatched}/${struct.toc.length} en-têtes · ${anchored.size} ancres distinctes · index ${struct.indexEntries.length} sujets.`)

  for (const doc of docs) {
    await prisma.document.update({ where: { id: doc.id }, data: { bodyOriginal: bodyTrimmed, annotationsJson: JSON.stringify(struct), source: SOURCE } })
    await reindexDocument(doc.id)
    console.log(`  ✅ ${doc.type} ${doc.id} (source ${doc.source ?? '—'} → ${SOURCE}) : lecteur annoté (Sommaire + Index + renvois inline).`)
  }
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
