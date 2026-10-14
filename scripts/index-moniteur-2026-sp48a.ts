/**
 * Porte à l'Index du Moniteur l'acte publié dans le Spécial N° 48-A du 30 septembre 2026 :
 * le Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal.
 *
 *   npx tsx scripts/index-moniteur-2026-sp48a.ts            (à blanc)
 *   npx tsx scripts/index-moniteur-2026-sp48a.ts --commit   (écrit)
 *
 * Calque de `index-moniteur-2026-aout.ts`. L'Index et les Éditions sont deux choses : une fiche
 * d'Édition = un FASCICULE ; une entrée d'Index = un ACTE publié dedans, sans PDF propre. Les deux
 * se rejoignent par `number`.
 *
 * ⚠️ UNE SEULE ENTRÉE. Le sommaire du fascicule n'annonce qu'un acte, et c'est lui qui fait foi.
 * L'Index d'origine avait fait TROIS entrées pour le Code de 2022 (`LM2023-SP3` : « Décret portant
 * Code Fiscal », « Code Général des Impôts (CGI) », « Livre des Procédures Fiscales (LPF) ») : ce
 * dédoublement n'est pas reproduit, et ces trois entrées ne sont pas touchées (ajout seul).
 *
 * Le titre est l'intitulé imprimé au sommaire (« DÉCRET REMPLACANT LE DÉCRET DU 19 DÉCEMBRE 2022
 * PORTANT CODE FISCAL »), rétabli en casse ordinaire. Mois en minuscule dans `moniteurRef`, comme
 * toutes les entrées depuis 2020.
 */
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

const ACTE = {
  number: 'LM2026-SP48-A',
  date: '2026-09-30',
  jour: 'Mercredi',
  category: 'DECRET',
  titre: 'Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal',
} as const

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

async function main() {
  const commit = process.argv.includes('--commit')
  const d = new Date(`${ACTE.date}T00:00:00Z`)
  const moniteurRef = `Le Moniteur · ${ACTE.number} · ${ACTE.jour} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`

  // ⚠️ LE FASCICULE DOIT EXISTER EN ÉDITIONS, À LA MÊME DATE.
  const edition = await prisma.document.findFirst({ where: { source: 'MONITEUR_PDF_2026', number: ACTE.number }, select: { publicationDate: true } })
  if (!edition) {
    console.error(`⛔ ARRÊT — ${ACTE.number} n’existe pas en Éditions Le Moniteur.`)
    process.exit(1)
  }
  if (edition.publicationDate!.toISOString().slice(0, 10) !== ACTE.date) {
    console.error(`⛔ ARRÊT — l’Édition ${ACTE.number} est datée du ${edition.publicationDate!.toISOString().slice(0, 10)}, l’acte du ${ACTE.date}.`)
    process.exit(1)
  }

  const avant = await prisma.document.count({ where: { type: 'INDEX' } })
  const deja = await prisma.document.count({ where: { type: 'INDEX', number: ACTE.number } })
  console.log(`Index du Moniteur : ${avant} entrées · ${deja} déjà sous ${ACTE.number}`)
  if (deja) {
    console.log(`   = ${ACTE.number} déjà à l’Index — rien à faire`)
    await prisma.$disconnect()
    return
  }
  console.log(`   + ${ACTE.number}  ${ACTE.category}  SPECIALE  ${moniteurRef}`)
  console.log(`     « ${ACTE.titre} »`)
  if (!commit) {
    console.log('\n(à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }

  const cree = await prisma.document.create({
    data: {
      type: 'INDEX',
      source: 'MONITEUR',
      status: 'PUBLIE',
      sealed: false,
      number: ACTE.number,
      titleFr: ACTE.titre,
      bodyOriginal: ACTE.titre,
      moniteurRef,
      category: ACTE.category,
      editionType: 'SPECIALE',
      publicationDate: d,
      metaJson: JSON.stringify({ category: ACTE.category, reference: ACTE.number, year: d.getUTCFullYear() }),
      searchText: [buildSearchText({ titleFr: ACTE.titre, number: ACTE.number, moniteurRef }), fold(ACTE.titre)].filter(Boolean).join(' '),
    },
  })
  await audit({ action: 'DOC_PUBLISHED', targetType: 'DOCUMENT', targetId: cree.id, meta: { via: 'index-moniteur-2026-sp48a', entrees: 1, refs: [ACTE.number] } })

  // Recompte APRÈS l'écriture (audit() avale ses erreurs) : une entrée de plus, et une seule.
  const apres = await prisma.document.count({ where: { type: 'INDEX' } })
  const sous = await prisma.document.findMany({ where: { type: 'INDEX', number: ACTE.number }, select: { id: true, titleFr: true, moniteurRef: true, editionType: true } })
  const journal = await prisma.auditLog.count({ where: { targetId: cree.id, action: 'DOC_PUBLISHED' } })
  if (apres !== avant + 1 || sous.length !== 1) throw new Error(`recompte : ${avant} → ${apres} entrées, ${sous.length} sous ${ACTE.number}`)
  console.log(`\n✅ entrée ajoutée : ${cree.id} · Index ${avant} → ${apres} · audit ${journal ? 'écrit' : '⚠️ ABSENT'}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
