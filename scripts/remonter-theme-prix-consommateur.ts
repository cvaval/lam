/**
 * REMONTER « Prix, concurrence et protection du consommateur » D'UN CRAN DANS L'ARBRE.
 *
 *     npx tsx scripts/remonter-theme-prix-consommateur.ts            # simulation
 *     npx tsx scripts/remonter-theme-prix-consommateur.ts --apply    # Me Vaval, elle seule
 *
 * POURQUOI. Le menu de domaine de la recherche n'aplatit que DEUX niveaux :
 * `src/app/[locale]/(app)/search/page.tsx` l. 220-231 — `aplatir(null, 0)` puis
 * `if (profondeur >= NIVEAUX) return` avec `NIVEAUX = 2`. Les racines (profondeur 0) et leurs
 * enfants (profondeur 1) entrent au menu ; les PETITS-ENFANTS (profondeur 2) n'y entrent pas.
 *
 * Or « Prix, concurrence et protection du consommateur » est aujourd'hui petit-enfant :
 * Droit économique & des affaires → Droit commercial → ce thème. Ses SIX documents — dont le
 * Décret du 11 mars 2020 sur la protection du consommateur — sont donc absents du filtre de
 * domaine. Décision de Me Vaval le 29 août 2026 : « faire remonter la branche ».
 *
 * CE QUE LE SCRIPT FAIT, ET RIEN D'AUTRE : il change le `parentId` du thème pour celui de
 * « Droit économique & des affaires » et lui donne la position suivante parmi ses enfants.
 *   · les rattachements `DocumentTheme` ne sont PAS touchés — les six documents restent où ils
 *     sont, avec leur thème primaire inchangé ;
 *   · le thème n'a AUCUN enfant : rien ne descend avec lui ;
 *   · « Droit commercial » garde ses 101 documents et se retrouve sans enfant.
 *
 * ⚠️ `scripts/importer-prix-consommateur.ts` l. 42 crée ce thème sous `droit-commercial`. Ce
 * script-là est en cours de modification par une AUTRE session : il n'est pas touché ici. Le
 * rejouer un jour recréerait la branche au mauvais endroit — l'y corriger quand il sera libre.
 */
import { prisma } from '../src/lib/db'
import { audit } from '../src/lib/auth/audit'

const APPLY = process.argv.includes('--apply')
const SLUG = 'prix-concurrence-consommateur'
const NOUVEAU_PARENT = 'economique'
const ANCIEN_PARENT = 'droit-commercial'

/** Reproduit EXACTEMENT l'aplatissement du menu de domaine (page.tsx l. 224-231). */
function auMenu(arbre: { id: string; slug: string; parentId: string | null }[], slug: string): number | null {
  const enfantsDe = new Map<string | null, typeof arbre>()
  for (const t of arbre) { const k = t.parentId; if (!enfantsDe.has(k)) enfantsDe.set(k, []); enfantsDe.get(k)!.push(t) }
  const NIVEAUX = 2
  let trouve: number | null = null
  const aplatir = (parent: string | null, profondeur: number) => {
    if (profondeur >= NIVEAUX) return
    for (const t of enfantsDe.get(parent) ?? []) { if (t.slug === slug) trouve = profondeur; aplatir(t.id, profondeur + 1) }
  }
  aplatir(null, 0)
  return trouve
}

async function main() {
  const th = await prisma.theme.findFirst({
    where: { slug: SLUG },
    select: { id: true, labelFr: true, position: true, parentId: true,
      parent: { select: { slug: true, labelFr: true } },
      _count: { select: { documents: true, children: true } } },
  })
  if (!th) throw new Error(`thème « ${SLUG} » introuvable. STOP`)

  // ⚠️ L'IDEMPOTENCE SE TESTE EN PREMIER : placée après le contrôle du parent attendu, elle
  // serait inatteignable et la seconde exécution accuserait à tort (leçon BEL 1984).
  if (th.parent?.slug === NOUVEAU_PARENT) {
    console.log(`« ${th.labelFr} » est déjà enfant direct de « ${th.parent.labelFr} » — rien à faire.`)
    await prisma.$disconnect(); return
  }
  if (th.parent?.slug !== ANCIEN_PARENT)
    throw new Error(`parent inattendu : « ${th.parent?.slug ?? 'aucun'} », « ${ANCIEN_PARENT} » attendu. STOP`)
  if (th._count.children) throw new Error(`le thème a ${th._count.children} enfant(s) : ils descendraient d'un cran. STOP`)

  const eco = await prisma.theme.findFirst({ where: { slug: NOUVEAU_PARENT }, select: { id: true, labelFr: true } })
  if (!eco) throw new Error(`thème « ${NOUVEAU_PARENT} » introuvable. STOP`)
  const max = await prisma.theme.aggregate({ where: { parentId: eco.id }, _max: { position: true } })
  const position = (max._max.position ?? -1) + 1

  const arbre = await prisma.theme.findMany({ where: { active: true }, select: { id: true, slug: true, parentId: true } })
  const avant = auMenu(arbre, SLUG)
  const apres = auMenu(arbre.map((t) => (t.slug === SLUG ? { ...t, parentId: eco.id } : t)), SLUG)

  console.log(`« ${th.labelFr} » [${SLUG}]`)
  console.log(`   parent  : « ${th.parent?.labelFr} » → « ${eco.labelFr} »`)
  console.log(`   position: ${th.position} → ${position}`)
  console.log(`   ${th._count.documents} document(s) rattachés — AUCUN n'est touché`)
  console.log(`   menu de domaine de la recherche : ${avant === null ? 'ABSENT' : `profondeur ${avant}`} → ${apres === null ? 'ABSENT' : `profondeur ${apres}`}`)
  if (apres === null) throw new Error('la remontée ne le ferait PAS entrer au menu : ne rien écrire. STOP')

  if (!APPLY) { console.log('\nSIMULATION — rien n’a été écrit.'); await prisma.$disconnect(); return }

  await prisma.$transaction(async (tx) => {
    await tx.theme.update({ where: { id: th.id }, data: { parentId: eco.id, position } })
    await audit({
      action: 'THEME_CREATED', targetType: 'Theme', targetId: th.id,
      meta: { motif:
        `Thème « ${th.labelFr} » remonté d'un cran : de « ${th.parent?.labelFr} » à « ${eco.labelFr} », ` +
        `position ${position}. Le menu de domaine de la recherche n'aplatit que deux niveaux ` +
        `(search/page.tsx, NIVEAUX = 2) : petit-enfant, ce thème et ses ${th._count.documents} documents ` +
        `étaient absents du filtre. Décision de Me Vaval du 29 août 2026. Aucun rattachement de document ` +
        `n'a été modifié ; « Droit commercial » se retrouve sans enfant.`,
        ancienParent: ANCIEN_PARENT, nouveauParent: NOUVEAU_PARENT, anciennePosition: th.position, position },
    }, tx)
  }, { timeout: 60_000 })

  // On RELIT la base : audit() avale ses erreurs dans un catch vide.
  const ctrl = await prisma.theme.findFirst({ where: { slug: SLUG }, select: { position: true, parent: { select: { slug: true, labelFr: true } }, _count: { select: { documents: true } } } })
  const arbre2 = await prisma.theme.findMany({ where: { active: true }, select: { id: true, slug: true, parentId: true } })
  const dc = await prisma.theme.findFirst({ where: { slug: ANCIEN_PARENT }, select: { _count: { select: { documents: true, children: true } } } })
  console.log(`\n✓ sous « ${ctrl?.parent?.labelFr} », position ${ctrl?.position}, ${ctrl?._count.documents} document(s)`)
  console.log(`  menu de domaine : profondeur ${auMenu(arbre2, SLUG)}`)
  console.log(`  « Droit commercial » : ${dc?._count.documents} document(s), ${dc?._count.children} enfant(s)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  const m = e instanceof Error ? e.message : String(e)
  console.error('ÉCHEC :', m.trim() ? m : e)
  await prisma.$disconnect(); process.exit(1)
})
