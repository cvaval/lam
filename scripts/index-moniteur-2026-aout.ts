/**
 * Porte à l'Index du Moniteur les quatre textes d'août 2026 versés en Éditions.
 *
 *   npx tsx scripts/index-moniteur-2026-aout.ts            (à blanc)
 *   npx tsx scripts/index-moniteur-2026-aout.ts --commit   (écrit)
 *
 * L'INDEX ET LES ÉDITIONS SONT DEUX CHOSES. Une fiche d'Édition = un FASCICULE (son
 * fac-similé, sa transcription) ; une entrée d'Index = un ACTE publié dedans, sans PDF
 * propre. Les deux se rejoignent par `number` : plusieurs entrées d'Index partagent la
 * référence du fascicule qui les porte.
 *
 * ⚠️ LES TITRES SONT TRANSCRITS À LA MAIN, PAS RECOPIÉS DE L'OCR. Le scanner de ces quatre
 * fascicules (Hewlett-Packard) rend « D£CRET £TABLISSANT LE REGIME D'IMPOSITION » : recopié
 * tel quel, le titre serait illisible ET introuvable. Ils sont donc relus sur le sommaire
 * et rétablis en toutes lettres — c'est la seule intervention manuelle du versement.
 *
 * ⚠️ MOIS EN MINUSCULE. Le corpus historique écrit « Jeudi 15 Octobre 1981 » (22 372
 * entrées), mais toutes les entrées depuis 2020 écrivent « Vendredi 16 juin 2023 » —
 * 272 sur 272 en 2020, 76 sur 76 en 2023. On continue la pratique récente.
 */
import { PrismaClient } from '@prisma/client'
import { buildSearchText, fold } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()

/** Les quatre actes, un par fascicule — chaque sommaire n'en annonce qu'UN. */
const ACTES = [
  {
    number: 'LM2026-SP39',
    date: '2026-08-13',
    jour: 'Jeudi',
    category: 'ARRETE',
    titre:
      'Arrêté nommant un conseil d’administration ad interim à la Banque de la République d’Haïti (BRH)',
  },
  {
    number: 'LM2026-SP43',
    date: '2026-08-21',
    jour: 'Vendredi',
    category: 'DECRET',
    titre:
      'Décret portant création, organisation et fonctionnement de l’Autorité nationale des jeux de hasard et d’argent',
  },
  {
    number: 'LM2026-SP43-A',
    date: '2026-08-21',
    jour: 'Vendredi',
    category: 'DECRET',
    titre: 'Décret portant réglementation des jeux de hasard et d’argent',
  },
  {
    number: 'LM2026-SP43-B',
    date: '2026-08-21',
    jour: 'Vendredi',
    category: 'DECRET',
    titre: 'Décret établissant le régime d’imposition applicable aux jeux de hasard et d’argent',
  },
] as const

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

async function main() {
  const commit = process.argv.includes('--commit')

  for (const a of ACTES) {
    // ⚠️ LE FASCICULE DOIT EXISTER EN ÉDITIONS. Une entrée d'Index qui renvoie à un numéro
    // absent est une référence morte : le lecteur clique et ne trouve rien.
    const edition = await prisma.document.findFirst({
      where: { source: 'MONITEUR_PDF_2026', number: a.number },
      select: { publicationDate: true },
    })
    if (!edition) {
      console.error(`⛔ ARRÊT — ${a.number} n’existe pas en Éditions Le Moniteur.`)
      process.exit(1)
    }
    const attendue = edition.publicationDate!.toISOString().slice(0, 10)
    if (attendue !== a.date) {
      console.error(`⛔ ARRÊT — ${a.number} : l’Édition est datée du ${attendue}, l’acte du ${a.date}.`)
      process.exit(1)
    }
  }

  const aCreer: typeof ACTES[number][] = []
  for (const a of ACTES) {
    const deja = await prisma.document.count({ where: { type: 'INDEX', number: a.number, titleFr: a.titre } })
    if (deja) {
      console.log(`   = ${a.number.padEnd(15)} déjà à l’Index — sauté`)
      continue
    }
    aCreer.push(a)
  }

  console.log(`\n${ACTES.length} actes · ${aCreer.length} à créer\n`)
  for (const a of aCreer) {
    const d = new Date(`${a.date}T00:00:00Z`)
    const ref = `Le Moniteur · ${a.number} · ${a.jour} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    console.log(`   + ${a.number.padEnd(15)} ${a.category.padEnd(7)} ${ref}`)
    console.log(`     « ${a.titre} »`)
  }

  if (!commit) {
    console.log('\n(à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }

  for (const a of aCreer) {
    const d = new Date(`${a.date}T00:00:00Z`)
    const moniteurRef = `Le Moniteur · ${a.number} · ${a.jour} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    await prisma.document.create({
      data: {
        type: 'INDEX',
        source: 'MONITEUR',
        status: 'PUBLIE',
        sealed: false,
        number: a.number,
        titleFr: a.titre,
        bodyOriginal: a.titre,
        moniteurRef,
        category: a.category,
        publicationDate: d,
        metaJson: JSON.stringify({ category: a.category, reference: a.number, year: d.getUTCFullYear() }),
        searchText: [buildSearchText({ titleFr: a.titre, number: a.number, moniteurRef }), fold(a.titre)]
          .filter(Boolean)
          .join(' '),
      },
    })
  }
  await audit({
    action: 'DOC_PUBLISHED',
    targetType: 'DOCUMENT',
    meta: { via: 'index-moniteur-2026-aout', entrees: aCreer.length, refs: aCreer.map((x) => x.number) },
  })
  console.log(`\n✅ ${aCreer.length} entrées ajoutées à l’Index du Moniteur (audit écrit).`)
  console.log('   Penser à réindexer (npx tsx scripts/reindex.ts).')
  await prisma.$disconnect()
}

main()
