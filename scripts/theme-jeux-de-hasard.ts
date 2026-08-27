/**
 * Ouvre dans le Droit économique & des affaires la branche des JEUX DE HASARD ET D'ARGENT.
 *
 *   npx tsx scripts/theme-jeux-de-hasard.ts            (à blanc)
 *   npx tsx scripts/theme-jeux-de-hasard.ts --commit   (écrit)
 *
 * La matière n'avait aucune porte : ni « jeux », ni « hasard », ni « loterie » n'existaient
 * dans la taxonomie, alors que trois décrets du 11 août 2026 la refondent entièrement et que
 * deux textes fondateurs — la Loi organique du 21 mars 1958 sur la Loterie de l'État et le
 * Décret du 20 octobre 1960 sur les casinos — restent à verser.
 *
 * ⚠️ QUATRE SOUS-THÈMES, ET C'EST LA MATIÈRE QUI LES DICTE, NON LE GOÛT DE LA PROFONDEUR.
 * L'arbre reste plat là où le volume ne justifie rien — Assurances (2 textes), Tourisme (1),
 * Droit minier (1) sont des feuilles. Il ne se creuse que là où la matière se divise
 * réellement : les circulaires de la BRH le font sur deux axes parce qu'elles sont 142. Ici,
 * les trois décrets de 2026 SONT trois matières distinctes — qui régule, ce qui est permis,
 * ce qui est dû —, et les textes de 1958 et 1960 forment un quatrième massif, antérieur.
 *
 * ⚠️ « FISCALITÉ DES JEUX » N'EST PAS UN DOUBLON DE « FISCALITÉ ». Le thème général
 * (29 textes) reste au même niveau, sous Droit économique ; celui-ci est la fiscalité PROPRE
 * à la matière. Un texte peut porter les deux — le rattachement est M:N.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const PARENT = 'economique'

const BRANCHE = {
  slug: 'jeux-hasard-argent',
  labelFr: 'Jeux de hasard et d’argent',
  labelEn: 'Gambling & betting',
  labelHt: 'Jwèt aza & lajan',
}

const ENFANTS = [
  {
    slug: 'jeux-anjha',
    labelFr: 'Autorité de régulation (ANJHA)',
    labelEn: 'Regulatory authority (ANJHA)',
    labelHt: 'Otorite regilasyon (ANJHA)',
  },
  {
    slug: 'jeux-reglementation',
    labelFr: 'Réglementation, licences & exploitation',
    labelEn: 'Regulation, licensing & operation',
    labelHt: 'Reglemantasyon, lisans & eksplwatasyon',
  },
  {
    slug: 'jeux-fiscalite',
    labelFr: 'Fiscalité des jeux',
    labelEn: 'Gambling taxation',
    labelHt: 'Taks sou jwèt aza',
  },
  {
    slug: 'jeux-loterie-casinos',
    labelFr: 'Loterie de l’État & casinos',
    labelEn: 'State lottery & casinos',
    labelHt: 'Lotri Leta & kazino',
  },
]

async function main() {
  const commit = process.argv.includes('--commit')

  const parent = await prisma.theme.findUnique({ where: { slug: PARENT }, select: { id: true, labelFr: true } })
  if (!parent) {
    console.error(`⛔ ARRÊT — la racine « ${PARENT} » est introuvable.`)
    process.exit(1)
  }

  // La branche se place APRÈS les existantes : l'ordre de l'arbre est éditorial, on ne
  // renumérote pas les quinze autres pour insérer la seizième.
  const fratrie = await prisma.theme.findMany({
    where: { parentId: parent.id },
    select: { slug: true, position: true },
    orderBy: { position: 'desc' },
  })
  const position = (fratrie[0]?.position ?? -1) + 1

  const deja = await prisma.theme.findMany({
    where: { slug: { in: [BRANCHE.slug, ...ENFANTS.map((x) => x.slug)] } },
    select: { slug: true },
  })
  const connus = new Set(deja.map((x) => x.slug))

  console.log(`  ${parent.labelFr} — ${fratrie.length} branches, la nouvelle prendra la position ${position}\n`)
  console.log(`  ${connus.has(BRANCHE.slug) ? '=' : '+'} ${BRANCHE.labelFr}`)
  for (const e of ENFANTS) console.log(`      ${connus.has(e.slug) ? '=' : '+'} ${e.labelFr}`)
  const aCreer = [BRANCHE, ...ENFANTS].filter((x) => !connus.has(x.slug)).length
  console.log(`\n  ${aCreer} thème(s) à créer · ${connus.size} déjà présent(s)`)

  if (!aCreer) {
    console.log('  Rien à faire.')
    await prisma.$disconnect()
    return
  }
  if (!commit) {
    console.log('\n(à blanc — ajouter --commit pour écrire)')
    await prisma.$disconnect()
    return
  }

  const b = await prisma.theme.upsert({
    where: { slug: BRANCHE.slug },
    update: {},
    create: { ...BRANCHE, parentId: parent.id, position },
    select: { id: true },
  })
  for (const [i, e] of ENFANTS.entries()) {
    await prisma.theme.upsert({
      where: { slug: e.slug },
      update: {},
      create: { ...e, parentId: b.id, position: i },
    })
  }
  console.log(`\n✅ Branche ouverte : ${BRANCHE.labelFr} + ${ENFANTS.length} sous-thèmes.`)
  console.log('   ⚠️ AUCUN document n’y est rattaché : les trois décrets de 2026 ne sont pas')
  console.log('      encore versés en Législation annotée (voir docs/prompt-jeux-de-hasard-2026.md).')
  await prisma.$disconnect()
}

main()
