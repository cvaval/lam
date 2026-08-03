/**
 * Code civil — le sommaire et le menu latéral remis d'accord.
 *
 * Deux dissymétries, de sens contraire, entre la TABLE (annotations.toc, qui découpe le
 * corps) et le MENU LATÉRAL (annotations.navToc, qui l'affiche) :
 *
 *  1. « Dispositions communes aux huit sections ci-dessus » (corps, entre les arts 1311 et
 *     1312) figure au MENU sous l'ancre sec-343, mais n'a AUCUNE entrée de table. La ligne
 *     vit donc à la fin du bloc de l'article 1311 — lequel est ABROGÉ par le décret de 2020
 *     sur les régimes matrimoniaux : l'overlay remplace le bloc entier et l'intitulé a déjà
 *     DISPARU du texte affiché. Le menu, lui, y renvoie dans le vide. C'est le quatrième cas
 *     du défaut corrigé par `ajouter-dispositions-generales-toc.ts`, que son critère de
 *     recherche (« Dispositions générales ») ne pouvait pas attraper.
 *  2. Symétrie inverse : les trois « Dispositions générales » inscrites par ce même script
 *     l'ont été dans la table mais PAS dans le menu (sec-356, 357, 358) — elles s'affichent
 *     dans le texte et restent introuvables au sommaire latéral.
 *
 * ⚠ Une entrée de table déplace la SECTION COURANTE des articles qui suivent, donc leur clé
 * d'annotation `sec-K|art-N`. Les clés sont recalculées et MIGRÉES ; le script refuse
 * d'écrire si l'une se perdrait en route.
 *
 *     npx tsx scripts/reparer-sommaire-code-civil.ts
 *     npx tsx scripts/reparer-sommaire-code-civil.ts --apply
 */
import { PrismaClient } from '@prisma/client'
import { parseAnnotations, segmentAnnotated, type NavGroup, type TocEntry } from '../src/lib/legislation/annotated'
import { buildSearchText } from '../src/lib/search/normalize'
import { audit } from '../src/lib/auth/audit'

const prisma = new PrismaClient()
const APPLY = process.argv.includes('--apply')

/** Entrée de table à inscrire : l'ancre est celle que le MENU emploie déjà. */
const A_INSCRIRE = {
  anchor: 'sec-343',
  label: 'Dispositions communes aux huit sections ci-dessus',
  level: 3,
  kind: 'section',
  /** Elle se range juste après cette entrée — l'ordre du tableau gouverne la segmentation. */
  apres: 'sec-342',
}

/** Entrées de table à faire apparaître au menu, chacune après son voisin de table. */
const AU_MENU = ['sec-356', 'sec-357', 'sec-358']

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Insère `noeud` juste après le nœud d'ancre `apres`, où qu'il soit dans l'arbre. */
function insererApres(noeuds: NavGroup[], apres: string, noeud: { label: string; anchor: string }): boolean {
  for (const n of noeuds) {
    const enfants = (n.children ?? []) as unknown as NavGroup[]
    const i = enfants.findIndex((e) => e.anchor === apres)
    if (i >= 0) {
      enfants.splice(i + 1, 0, noeud as unknown as NavGroup)
      return true
    }
    if (enfants.length && insererApres(enfants, apres, noeud)) return true
  }
  const i = noeuds.findIndex((e) => e.anchor === apres)
  if (i >= 0) {
    noeuds.splice(i + 1, 0, noeud as unknown as NavGroup)
    return true
  }
  return false
}

function ancresDuMenu(noeuds: NavGroup[], vues = new Set<string>()): Set<string> {
  for (const n of noeuds) {
    if (n.anchor) vues.add(n.anchor)
    if (n.children?.length) ancresDuMenu(n.children as unknown as NavGroup[], vues)
  }
  return vues
}

async function main() {
  const doc = await prisma.document.findFirst({ where: { source: 'CODE_CIVIL_ANNOTE' } })
  if (!doc) throw new Error('Code civil introuvable.')
  const ann = parseAnnotations(doc.annotationsJson)!
  const brut = JSON.parse(doc.annotationsJson!) as {
    toc: TocEntry[]
    navToc: NavGroup[]
    jurisprudence: Record<string, Array<{ ref?: string; excerpt?: string }>>
  }

  // ── clés AVANT ───────────────────────────────────────────────────────────────
  const avant = new Map<string, string>()
  for (const b of segmentAnnotated(doc.bodyOriginal, ann.toc))
    if (b.kind === 'body' && b.anchor && b.jurisKey) avant.set(b.anchor, b.jurisKey)

  // ── 1. l'entrée de table manquante ───────────────────────────────────────────
  const toc = [...brut.toc]
  let inscrite = false
  if (toc.some((t) => t.anchor === A_INSCRIRE.anchor || norm(t.label) === norm(A_INSCRIRE.label))) {
    console.log(`  « ${A_INSCRIRE.label} » déjà inscrite — rien à faire`)
  } else {
    const i = toc.findIndex((t) => t.anchor === A_INSCRIRE.apres)
    if (i < 0) throw new Error(`entrée de rattachement ${A_INSCRIRE.apres} introuvable`)
    if (!doc.bodyOriginal.split('\n').some((l) => norm(l) === norm(A_INSCRIRE.label)))
      throw new Error('la ligne visée n’existe pas dans le corps — refus')
    const { apres, ...entree } = A_INSCRIRE
    toc.splice(i + 1, 0, entree as TocEntry)
    inscrite = true
    console.log(`  ${entree.anchor} « ${entree.label} » inscrite après ${apres} (niveau ${entree.level})`)
  }

  // ── clés APRÈS, et migration ────────────────────────────────────────────────
  const apresMap = new Map<string, string>()
  for (const b of segmentAnnotated(doc.bodyOriginal, toc))
    if (b.kind === 'body' && b.anchor && b.jurisKey) apresMap.set(b.anchor, b.jurisKey)

  const migrations: Array<[string, string]> = []
  for (const [art, ancienne] of avant) {
    const neuve = apresMap.get(art)
    if (!neuve) throw new Error(`l'article ${art} n'a plus de clé après insertion — arrêt`)
    if (neuve !== ancienne && brut.jurisprudence[ancienne]) migrations.push([ancienne, neuve])
  }
  const deplacees = new Set(migrations.map(([a]) => a))
  const cibles = new Set(apresMap.values())
  const orphelines = Object.keys(brut.jurisprudence).filter((k) => !deplacees.has(k) && !cibles.has(k))

  // ── 2. les entrées absentes du menu ─────────────────────────────────────────
  const navToc: NavGroup[] = JSON.parse(JSON.stringify(brut.navToc))
  const dejaAuMenu = ancresDuMenu(navToc)
  const ajoutsMenu: string[] = []
  for (const ancre of AU_MENU) {
    if (dejaAuMenu.has(ancre)) { console.log(`  ${ancre} déjà au menu`); continue }
    const k = toc.findIndex((t) => t.anchor === ancre)
    if (k <= 0) throw new Error(`${ancre} : introuvable dans la table`)
    const voisin = toc[k - 1].anchor
    if (!insererApres(navToc, voisin, { label: toc[k].label, anchor: ancre }))
      throw new Error(`${ancre} : voisin ${voisin} introuvable dans le menu`)
    ajoutsMenu.push(`${ancre} après ${voisin} :: ${toc[k].label.slice(0, 60)}`)
  }

  // ── contrôle final : les deux listes doivent coïncider ──────────────────────
  const ancresToc = new Set(toc.map((t) => t.anchor))
  const menu = ancresDuMenu(navToc)
  const mortsRestants = [...menu].filter((a) => !ancresToc.has(a))
  const absentsRestants = [...ancresToc].filter((a) => !menu.has(a))

  console.log(`\ntable : ${brut.toc.length} → ${toc.length} entrées`)
  console.log(`menu : ${ancresDuMenu(brut.navToc).size} → ${menu.size} ancres`)
  ajoutsMenu.forEach((l) => console.log(`  + ${l}`))
  console.log(`\nclés d'annotation à migrer : ${migrations.length}`)
  migrations.slice(0, 12).forEach(([a, b]) => console.log(`   ${a} → ${b}`))
  if (migrations.length > 12) console.log(`   … et ${migrations.length - 12} autres`)
  console.log(`clés qui resteraient orphelines : ${orphelines.length}`)
  console.log(`liens morts du menu après correction : ${mortsRestants.length}${mortsRestants.length ? ' — ' + mortsRestants.join(', ') : ''}`)
  console.log(`entrées de table absentes du menu après correction : ${absentsRestants.length}${absentsRestants.length ? ' — ' + absentsRestants.join(', ') : ''}`)
  if (orphelines.length) throw new Error('migration incomplète — aucune écriture')
  if (mortsRestants.length || absentsRestants.length) throw new Error('table et menu toujours désaccordés — aucune écriture')
  if (!inscrite && !ajoutsMenu.length) {
    console.log('\nRien à faire.')
    await prisma.$disconnect()
    return
  }

  if (!APPLY) {
    console.log('\nSIMULATION — rien n’a été écrit. Relancer avec --apply.')
    await prisma.$disconnect()
    return
  }
  const jurisprudence = { ...brut.jurisprudence }
  for (const [ancienne, neuve] of migrations) {
    jurisprudence[neuve] = [...(jurisprudence[neuve] ?? []), ...jurisprudence[ancienne]]
    delete jurisprudence[ancienne]
  }
  const annotationsJson = JSON.stringify({ ...JSON.parse(doc.annotationsJson!), toc, navToc, jurisprudence })
  const searchText = buildSearchText({ ...doc, annotationsJson } as never)
  await prisma.$transaction(async (tx) => {
    await tx.document.update({ where: { id: doc.id }, data: { annotationsJson, searchText } })
    await audit(
      { action: 'ARTICLE_AMENDED', targetType: 'Document', targetId: doc.id,
        meta: { source: 'CODE_CIVIL_ANNOTE', motif: 'sommaire et menu latéral remis d’accord (sec-343 inscrite, sec-356/357/358 au menu)',
                migrations: migrations.length, menu: ajoutsMenu.length } },
      tx,
    )
  }, { timeout: 120_000, maxWait: 30_000 })
  console.log('\n✓ Écrit, index de recherche recalculé, journalisé.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('ÉCHEC :', e instanceof Error ? e.message : e)
  await prisma.$disconnect()
  process.exit(1)
})
