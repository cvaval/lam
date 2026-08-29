/**
 * § 8.1 — Création du thème « Marchés publics » sous « Droit public & administratif ».
 *
 * SIMULATION PAR DÉFAUT. `--apply` est lancé par Me Vaval, et par elle seule.
 *   npx tsx scripts/prepare-theme-marches-publics.ts            → mesure et rapport
 *   npx tsx scripts/prepare-theme-marches-publics.ts --apply    → écrit (Me Vaval)
 *
 * ⚠️ VERROU EN PLACE : les libellés En/Ht sont une QUESTION OUVERTE (§ 13.8). Le slug
 * étant IMMUABLE une fois créé, `--apply` refuse tant que LIBELLES_VALIDES est false.
 * Me Vaval tranche les deux libellés, on passe le drapeau à true, puis on applique.
 *
 * Patron : scripts/_import-decret-minier.ts l. 42-55 ; lib canonique
 * src/lib/legislation/themes.ts l. 305 (`createTheme` : calcule la position = max+1
 * chez les frères et REFUSE un slug existant → ThemeError('slugExists')).
 *
 * Pièges mesurés (§ 8.1) :
 *  1. `DocumentTheme_one_primary` est un index UNIQUE PARTIEL
 *     (prisma/sql/legislation-themes-indexes.sql l. 7-8) : UN SEUL isPrimary par
 *     document — toute copie secondaire en isPrimary:false.
 *  2. « du spécifique au général » vise l'ordre des thèmes SUR un document, pas la
 *     position dans l'arbre.
 *  3. Un thème VIDE est ÉLAGUÉ de la navigation (themes.ts `elaguer`, l. 203) : il
 *     reste invisible tant qu'aucun document LEGISLATION/DOCTRINE n'y est rattaché.
 *     Ce n'est pas un défaut — mais ne crée pas le thème dans une livraison qui ne
 *     rattache rien.
 *  4. AUCUNE modification de DOC_TYPE_META : les textes sont de type LEGISLATION →
 *     rubrique « Législation annotée » (src/lib/brand.ts l. 60-67). Une rubrique
 *     n'est pas un type.
 *
 * État MESURÉ en lecture seule le 27 août 2026 sur la base de production :
 *   droit-public = cmr04tema0019vi81oqqvntub, 6 enfants aux positions 0-5 →
 *   position 6 ; slug `marches-publics` libre ; 96 thèmes au total ; seul autre
 *   thème contenant « march » : brh-marche-financier ; 0 document `source`
 *   commençant par MARCHES.
 */
import { prisma } from '../src/lib/db'
import { createTheme } from '../src/lib/legislation/themes'

const APPLY = process.argv.includes('--apply')

const PARENT_SLUG = 'droit-public'
const SLUG = 'marches-publics' // ⚠️ IMMUABLE après création
const LABEL_FR = 'Marchés publics'

/** ⚠️ § 13.8 — PROPOSITIONS, non validées. Ne pas appliquer sans le mot de Me Vaval. */
const LABEL_EN_PROPOSE = 'Public procurement'
const LABEL_HT_PROPOSE = 'Mache piblik' // tranché 28 août : sans accent
const LIBELLES_VALIDES = false // ← Me Vaval passe ce drapeau à true après arbitrage

async function main() {
  const parent = await prisma.theme.findFirst({ where: { slug: PARENT_SLUG } })
  if (!parent) throw new Error(`thème parent « ${PARENT_SLUG} » introuvable — annulé`)

  const freres = await prisma.theme.findMany({
    where: { parentId: parent.id },
    orderBy: { position: 'asc' },
    select: { slug: true, labelFr: true, labelEn: true, labelHt: true, position: true },
  })
  const max = await prisma.theme.aggregate({ where: { parentId: parent.id }, _max: { position: true } })
  const positionCalculee = (max._max.position ?? -1) + 1

  console.log(`parent : ${parent.labelFr} (${parent.slug}, id ${parent.id})`)
  console.log(`frères : ${freres.length}`)
  for (const f of freres) console.log(`   pos ${f.position}  ${f.slug.padEnd(30)} ${f.labelFr}`)
  console.log(`position calculée pour « ${LABEL_FR} » : ${positionCalculee}`)

  const existant = await prisma.theme.findUnique({ where: { slug: SLUG } })
  if (existant) {
    // idempotence (§ 9.7) : on ne recrée pas, on ne réécrit pas
    console.log(`✓ thème DÉJÀ EXISTANT : ${existant.labelFr} (${existant.slug}, id ${existant.id}, ` +
      `parentId ${existant.parentId}, position ${existant.position}) — rien à faire`)
    if (existant.parentId !== parent.id) console.log(`   ⚠️ son parent n'est PAS ${PARENT_SLUG} — à investiguer`)
    return
  }

  console.log('\n— ce qui SERAIT créé —')
  console.log(JSON.stringify({
    slug: SLUG, parentId: parent.id, position: positionCalculee,
    labelFr: LABEL_FR, labelEn: LABEL_EN_PROPOSE, labelHt: LABEL_HT_PROPOSE,
  }, null, 2))
  console.log(`\nlibellés En/Ht : ${LIBELLES_VALIDES ? 'VALIDÉS' : '⚠️ PROPOSÉS, NON VALIDÉS (§ 13.8)'}`)
  console.log('rappel : le thème restera INVISIBLE en navigation tant qu’aucun document ' +
    'LEGISLATION/DOCTRINE n’y sera rattaché (élagage, themes.ts l. 203) — ce n’est pas un défaut.')

  if (!APPLY) {
    console.log('\nSIMULATION — aucune écriture. Ajouter --apply pour écrire (Me Vaval seule).')
    return
  }
  if (!LIBELLES_VALIDES) {
    throw new Error(
      'libellés En/Ht non validés (§ 13.8) et le slug est IMMUABLE : ' +
      'TRANCHÉ le 28 août : « Public procurement » / « Mache piblik » (sans accent), ' +
      'passer LIBELLES_VALIDES à true, puis relancer — annulé')
  }

  const theme = await createTheme({
    slug: SLUG, parentId: parent.id,
    labelFr: LABEL_FR, labelEn: LABEL_EN_PROPOSE, labelHt: LABEL_HT_PROPOSE,
  })
  console.log(`✓ thème créé : ${parent.labelFr} → ${theme.labelFr} (${theme.slug}, id ${theme.id}, position ${theme.position})`)

  // contrôle § 8.1 : existe, position 6, parent correct, pas de doublon
  const relu = await prisma.theme.findUnique({ where: { slug: SLUG } })
  if (!relu) throw new Error('relecture : thème introuvable après création — annulé')
  if (relu.parentId !== parent.id) throw new Error('relecture : parent incorrect — annulé')
  if (relu.position !== positionCalculee) throw new Error(`relecture : position ${relu.position} ≠ ${positionCalculee} — annulé`)
  const homonymes = await prisma.theme.count({ where: { parentId: parent.id, labelFr: LABEL_FR } })
  if (homonymes !== 1) throw new Error(`relecture : ${homonymes} frères nommés « ${LABEL_FR} » — annulé`)
  console.log('✓ contrôles : thème unique, parent et position conformes')
}

main()
  .catch((e) => { console.error('✗', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
