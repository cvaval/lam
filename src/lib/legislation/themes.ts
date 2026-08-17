/**
 * Taxonomie de thèmes de la Législation annotée (corpus). Liste d'adjacence ;
 * les sous-arbres sont calculés EN MÉMOIRE (une taxonomie ne fait que quelques
 * dizaines/centaines de nœuds — pas de CTE récursive nécessaire).
 *
 * Invariants garantis ici (Prisma ne génère pas d'index partiel) :
 *  - un seul thème principal (isPrimary) par document — voir setDocumentThemes ;
 *  - pas de cycle dans l'arbre — voir assertNoCycle.
 *
 * Cf. docs/architecture-legislation-themes.md.
 */
import type { Theme } from '@prisma/client'
import { prisma } from '../db'
import { accessibleTypes } from '../access'
import { DOC_TYPE_META } from '../brand'
import type { DocType, Role } from '../types'

export interface ThemeNode extends Theme {
  children: ThemeNode[]
}

/** Charge tous les thèmes (option : actifs seulement) triés par position. */
export async function listThemes(opts: { activeOnly?: boolean } = {}): Promise<Theme[]> {
  return prisma.theme.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: [{ position: 'asc' }, { labelFr: 'asc' }],
  })
}

/** Construit l'arbre (nœuds racines + enfants imbriqués) à partir de la liste plate. */
export function buildTree(themes: Theme[]): ThemeNode[] {
  const byId = new Map<string, ThemeNode>()
  for (const t of themes) byId.set(t.id, { ...t, children: [] })
  const roots: ThemeNode[] = []
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node)
    else roots.push(node)
  }
  const sortRec = (nodes: ThemeNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.labelFr.localeCompare(b.labelFr))
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/** Arbre complet (pour la navigation / l'admin). */
export async function getThemeTree(opts: { activeOnly?: boolean } = {}): Promise<ThemeNode[]> {
  return buildTree(await listThemes(opts))
}

/** Ids d'un thème ET de tous ses descendants (depuis une liste plate déjà chargée). */
export function descendantIds(themeId: string, themes: Theme[]): string[] {
  const childrenOf = new Map<string, string[]>()
  for (const t of themes) {
    if (!t.parentId) continue
    if (!childrenOf.has(t.parentId)) childrenOf.set(t.parentId, [])
    childrenOf.get(t.parentId)!.push(t.id)
  }
  const out: string[] = []
  const stack = [themeId]
  while (stack.length) {
    const id = stack.pop()!
    out.push(id)
    for (const c of childrenOf.get(id) ?? []) stack.push(c)
  }
  return out
}

/**
 * Documents rattachés à un thème (sous-arbre compris), FILTRÉS par accès §03.
 * L'Index est toujours visible ; le staff voit tout (cf. accessibleTypes).
 *
 * ⚠️ DEUX BARRIÈRES, et il en faut DEUX. L'accès (§03) protège l'abonnement ; le CORPUS
 * protège la cohérence de la rubrique. Un thème n'appartient à aucune section — c'est
 * l'APPELANT qui sait pour quelle rubrique il interroge, d'où `opts.corpus`.
 *
 * Défaut du 17 août 2026, et sa rechute le même jour : la première correction avait aligné
 * les compteurs et les vues à plat de la Législation annotée sur le corpus, mais PAS cette
 * fonction — qui est pourtant le chemin du CLIC, celui par lequel le défaut avait été
 * signalé. Les arrêts continuaient donc de s'afficher, et le badge annonçait désormais moins
 * que la liste : la divergence compte↔liste s'était simplement inversée. Mesuré alors :
 * 222 des 475 rattachements, soit 47 %, sortaient du corpus déclaré.
 *
 * Leçon inscrite ici pour la prochaine fois : corriger une vue ne corrige pas une SECTION.
 * Recenser tous les chemins qui listent, puis les traiter ensemble.
 */
export async function documentsInTheme(
  themeId: string,
  user: { role: Role; services: DocType[] },
  opts: { skip?: number; take?: number; corpus?: readonly DocType[] } = {},
) {
  // ⚠️ MÊME PÉRIMÈTRE QUE LES COMPTEURS. Sans `activeOnly`, `descendantIds` traversait les
  // thèmes ARCHIVÉS : archiver une rubrique la retirait de l'arbre et de son compteur, mais
  // ses documents restaient listés au clic sur le parent. Le badge annonçait alors moins que
  // la liste qu'il surmonte — la divergence du 17 août, une troisième fois, par une autre
  // porte. Aucun thème n'est archivé aujourd'hui : le défaut était à un clic de back-office.
  const themes = await listThemes({ activeOnly: true })
  const ids = descendantIds(themeId, themes)
  if (ids.length === 0) return []
  const docs = await prisma.document.findMany({
    where: {
      // SÉCURITÉ-CRITIQUE (§03) : l'accès reste la barrière entre l'API publique theme-docs
      // et les titres de docs non accordés. Ne JAMAIS le retirer ni l'élargir. Le corpus,
      // lui, ne fait que RESTREINDRE davantage — il ne peut jamais ouvrir.
      type: {
        in: opts.corpus
          ? accessibleTypes(user).filter((t) => (opts.corpus as readonly DocType[]).includes(t))
          : accessibleTypes(user),
      },
      // `ids` ne contient déjà que des thèmes actifs ; on l'exige aussi ici pour que le
      // rattachement lui-même soit lu au même périmètre que `allThemedDocuments`.
      themes: { some: { themeId: { in: ids }, theme: { active: true } } },
    },
    select: { id: true, type: true, titleFr: true, titleEn: true, titleHt: true, number: true, status: true, publicationDate: true },
    orderBy: [{ publicationDate: 'desc' }, { titleFr: 'asc' }],
    skip: opts.skip,
    take: opts.take,
  })
  // Deep-link : si le doc est rattaché DIRECTEMENT au thème interrogé avec une ancre (ex. un
  // chapitre / une loi connexe d'un document unique → sa section interne), on la renvoie pour
  // ouvrir /doc/[id]#sec-N. Un thème parent (rattachement sans ancre) ouvre le doc en tête.
  const direct = await prisma.documentTheme.findMany({
    where: { themeId, documentId: { in: docs.map((d) => d.id) }, anchor: { not: null } },
    select: { documentId: true, anchor: true },
  })
  const anchorBy = new Map(direct.map((dt) => [dt.documentId, dt.anchor]))
  return docs.map((d) => ({ ...d, anchor: anchorBy.get(d.id) ?? null }))
}

/**
 * TOUS les documents accessibles rattachés à AU MOINS un thème ACTIF — pour les
 * vues À PLAT de la Législation annotée (A→Z, par type, récents). Filtré par accès
 * §03 (même barrière que documentsInTheme) ET borné aux thèmes actifs (même
 * périmètre que l'arbre getThemeTree({activeOnly:true}), sinon un doc rattaché à
 * un seul thème archivé apparaîtrait à plat mais pas dans l'arbre). Un document
 * rattaché à plusieurs thèmes n'apparaît qu'une fois. Borné par `take` : l'appelant
 * détecte l'atteinte de la borne (docs.length === take) pour signaler la troncature.
 */
/**
 * Types listés par la section « Législation annotée ».
 *
 * ⚠️ La liste ne vit plus ici : elle est déclarée avec la section, dans `DOC_TYPE_META`
 * (src/lib/brand.ts), à côté de son nom, de son slug et de son code. Une seule définition,
 * au même endroit que tout ce qui identifie la rubrique — c'est ce qui manquait le jour où
 * des arrêts se sont affichés parmi les codes.
 *
 * Repli volontairement ÉTROIT : une section sans corpus déclaré ne liste que son propre
 * type. On n'affiche jamais par mégarde ce qui relève d'une autre rubrique.
 */
export const TYPES_LEGISLATION_ANNOTEE: readonly DocType[] =
  DOC_TYPE_META.DOCTRINE.corpus ?? ['DOCTRINE']

/**
 * Intersection de ce que l'utilisateur PEUT lire (§03) et de ce que la section DOIT montrer.
 *
 * Les deux sont nécessaires et aucun ne remplace l'autre : l'accès protège l'abonnement,
 * le corpus protège la cohérence de la rubrique. Le défaut du 17 août venait d'avoir cru
 * que le premier suffisait — un membre du personnel, qui a droit à tout, voyait tout.
 */
export function typesDeLaSection(
  user: { role: Role; services: DocType[] },
  corpus: readonly DocType[] = TYPES_LEGISLATION_ANNOTEE,
): DocType[] {
  const permis = new Set<string>(accessibleTypes(user))
  return corpus.filter((t) => permis.has(t))
}

export async function allThemedDocuments(
  user: { role: Role; services: DocType[] },
  opts: { take?: number; corpus?: readonly DocType[] } = {},
) {
  return prisma.document.findMany({
    where: {
      // §03 (accès) ET périmètre de la section — ne jamais retirer/élargir l'un ni l'autre.
      type: { in: typesDeLaSection(user, opts.corpus) },
      themes: { some: { theme: { active: true } } },
    },
    select: {
      id: true, type: true, titleFr: true, titleEn: true, titleHt: true,
      number: true, status: true, publicationDate: true, updatedAt: true,
    },
    orderBy: [{ titleFr: 'asc' }],
    take: opts.take ?? 3000,
  })
}

/** Sous-arbres enracinés aux slugs donnés, cherchés à N'IMPORTE QUELLE profondeur. */
export function sousArbres(tree: ThemeNode[], slugs: readonly string[]): ThemeNode[] {
  const voulu = new Map(slugs.map((s, i) => [s, i]))
  const trouves: ThemeNode[] = []
  const walk = (n: ThemeNode) => {
    if (voulu.has(n.slug)) trouves.push(n)
    n.children.forEach(walk)
  }
  tree.forEach(walk)
  // L'ordre de DÉCLARATION fait foi : « par matière » avant « par assujetti » est un choix
  // éditorial, que ni la position en base ni l'ordre de parcours ne doivent pouvoir défaire.
  return trouves.sort((a, b) => voulu.get(a.slug)! - voulu.get(b.slug)!)
}

/** Élague les nœuds dont le sous-arbre entier est vide POUR CE CORPUS. */
function elaguer(nodes: ThemeNode[], sousTotal: Map<string, number>): ThemeNode[] {
  return nodes
    .filter((n) => (sousTotal.get(n.id) ?? 0) > 0)
    .map((n) => ({ ...n, children: elaguer(n.children, sousTotal) }))
}

export interface NavigationThemes {
  tree: ThemeNode[]
  /** Documents rattachés DIRECTEMENT à un thème (hors descendants). */
  counts: Record<string, number>
  /** Documents DISTINCTS du sous-arbre — voir le commentaire de `navigationThemes`. */
  subtotals: Record<string, number>
  recentThemeIds: string[]
}

/**
 * Tout ce qu'une rubrique doit savoir de sa taxonomie, calculé UNE FOIS, sur UN périmètre.
 *
 * ⚠️ POURQUOI UNE SEULE FONCTION. Une rubrique liste par trois chemins — le compteur, les
 * vues à plat, et le clic sur un thème. Le 17 août 2026, trois requêtes séparées portaient
 * trois périmètres : la correction en a aligné deux et oublié le troisième, celui du clic,
 * et la divergence compte↔liste s'est simplement inversée. Rassembler les calculs ne rend
 * pas l'erreur impossible, mais elle devient visible : il n'y a plus qu'un endroit où le
 * corpus s'applique. (Le clic passe par l'API, qui lit le corpus de la MÊME déclaration.)
 *
 * ⚠️ LES SOUS-TOTAUX COMPTENT DES DOCUMENTS, PAS DES RATTACHEMENTS. Sommer les compteurs
 * des enfants — ce que faisait l'affichage — compte deux fois un document classé sous deux
 * sous-thèmes. Sur l'axe « par matière » de la BRH, cela annonçait 143 circulaires pour 142
 * réelles, une seule étant classée sous deux matières. Un chiffre faux d'une unité reste un
 * chiffre faux : sur un fonds juridique, il se cite.
 *
 * Les nœuds vides POUR CE CORPUS sont élagués. Grisés, ils affichaient « Aucun texte pour le
 * moment » sous des rubriques qui en portaient 285 — l'écran démentait la base.
 */
export async function navigationThemes(
  user: { role: Role; services: DocType[] },
  opts: { corpus?: readonly DocType[]; racines?: readonly string[]; recentDays?: number } = {},
): Promise<NavigationThemes> {
  const types = typesDeLaSection(user, opts.corpus)
  const cutoff = new Date(Date.now() - (opts.recentDays ?? 14) * 86400_000)
  const themes = await listThemes({ activeOnly: true })

  // Un seul balayage des rattachements du corpus : il fournit à la fois les compteurs, les
  // sous-totaux distincts et la fraîcheur. Le volume est celui de la taxonomie (quelques
  // centaines à quelques milliers de liens), pas celui du fonds.
  const liens = types.length
    ? await prisma.documentTheme.findMany({
        where: { document: { type: { in: types } }, theme: { active: true } },
        select: { themeId: true, documentId: true, document: { select: { updatedAt: true } } },
      })
    : []

  const counts: Record<string, number> = {}
  const recents = new Set<string>()
  const docsParTheme = new Map<string, Set<string>>()
  for (const l of liens) {
    counts[l.themeId] = (counts[l.themeId] ?? 0) + 1
    if (l.document.updatedAt >= cutoff) recents.add(l.themeId)
    let s = docsParTheme.get(l.themeId)
    if (!s) docsParTheme.set(l.themeId, (s = new Set()))
    s.add(l.documentId)
  }

  // Remontée en documents DISTINCTS : on fusionne les ensembles, on ne somme pas les tailles.
  const subtotals: Record<string, number> = {}
  const arbreComplet = buildTree(themes)
  const remonte = (n: ThemeNode): Set<string> => {
    const s = new Set(docsParTheme.get(n.id) ?? [])
    for (const c of n.children) for (const id of remonte(c)) s.add(id)
    subtotals[n.id] = s.size
    return s
  }
  arbreComplet.forEach(remonte)

  const depart = opts.racines?.length ? sousArbres(arbreComplet, opts.racines) : arbreComplet
  const parId = new Map(Object.entries(subtotals))
  return {
    tree: elaguer(depart, parId),
    counts,
    subtotals,
    recentThemeIds: [...recents],
  }
}

// ─────────────────────────── Gestion (back-office) ───────────────────────────

export class ThemeError extends Error {
  constructor(public code: 'slugExists' | 'cycle' | 'hasChildren' | 'notFound') {
    super(code)
  }
}

/** Vrai si rendre `themeId` enfant de `newParentId` créerait un cycle. */
export async function wouldCreateCycle(themeId: string, newParentId: string): Promise<boolean> {
  let cur: string | null = newParentId
  while (cur) {
    if (cur === themeId) return true
    cur = (await prisma.theme.findUnique({ where: { id: cur }, select: { parentId: true } }))?.parentId ?? null
  }
  return false
}

export async function createTheme(input: {
  slug: string
  labelFr: string
  labelEn?: string | null
  labelHt?: string | null
  parentId?: string | null
  color?: string | null
  icon?: string | null
}): Promise<Theme> {
  if (await prisma.theme.findUnique({ where: { slug: input.slug } })) throw new ThemeError('slugExists')
  const position =
    ((
      await prisma.theme.aggregate({
        where: { parentId: input.parentId ?? null },
        _max: { position: true },
      })
    )._max.position ?? -1) + 1
  return prisma.theme.create({
    data: {
      slug: input.slug,
      labelFr: input.labelFr,
      labelEn: input.labelEn ?? null,
      labelHt: input.labelHt ?? null,
      parentId: input.parentId ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      position,
    },
  })
}

/** Renommer / recolorer / déplacer / (dés)archiver. Le slug n'est PAS modifiable. */
export async function updateTheme(
  id: string,
  patch: {
    labelFr?: string
    labelEn?: string | null
    labelHt?: string | null
    color?: string | null
    icon?: string | null
    parentId?: string | null
    active?: boolean
  },
): Promise<Theme> {
  if (!(await prisma.theme.findUnique({ where: { id } }))) throw new ThemeError('notFound')
  if (patch.parentId !== undefined && patch.parentId !== null) {
    if (patch.parentId === id || (await wouldCreateCycle(id, patch.parentId))) throw new ThemeError('cycle')
  }
  return prisma.theme.update({ where: { id }, data: patch })
}

/**
 * Retirer un thème. Par défaut ARCHIVE (active=false, réversible). Avec `hardDelete`,
 * suppression définitive — interdite s'il a des enfants ; ses rattachements sont
 * réaffectés au parent (`reassignTo`) ou détachés. Les documents ne sont jamais touchés.
 */
export async function removeTheme(
  id: string,
  opts: { hardDelete?: boolean; reassignTo?: string | null } = {},
): Promise<void> {
  const theme = await prisma.theme.findUnique({ where: { id } })
  if (!theme) throw new ThemeError('notFound')
  if (!opts.hardDelete) {
    await prisma.theme.update({ where: { id }, data: { active: false } })
    return
  }
  if ((await prisma.theme.count({ where: { parentId: id } })) > 0) throw new ThemeError('hasChildren')
  await prisma.$transaction(async (tx) => {
    if (opts.reassignTo) {
      const links = await tx.documentTheme.findMany({ where: { themeId: id } })
      for (const l of links) {
        // Réaffecte au parent SANS promouvoir en principal (préserve l'invariant).
        await tx.documentTheme.upsert({
          where: { documentId_themeId: { documentId: l.documentId, themeId: opts.reassignTo! } },
          create: { documentId: l.documentId, themeId: opts.reassignTo!, isPrimary: false, assignedBy: l.assignedBy },
          update: {},
        })
      }
    }
    await tx.documentTheme.deleteMany({ where: { themeId: id } })
    await tx.theme.delete({ where: { id } })
  })
}

/** Réordonne des thèmes frères : liste ordonnée d'ids → position 0..n. */
export async function reorderThemes(orderedIds: string[]): Promise<void> {
  await prisma.$transaction(orderedIds.map((id, i) => prisma.theme.update({ where: { id }, data: { position: i } })))
}

/**
 * Définit les thèmes d'un document (remplace l'ensemble) et garantit AU PLUS UN
 * principal, dans une transaction. `primaryThemeId` doit figurer dans `themeIds`.
 */
export async function setDocumentThemes(
  documentId: string,
  themeIds: string[],
  primaryThemeId: string | null,
  assignedBy = 'ADMIN',
): Promise<void> {
  const unique = [...new Set(themeIds)]
  const primary = primaryThemeId && unique.includes(primaryThemeId) ? primaryThemeId : unique[0] ?? null
  await prisma.$transaction(async (tx) => {
    await tx.documentTheme.deleteMany({ where: { documentId } })
    if (unique.length === 0) return
    await tx.documentTheme.createMany({
      data: unique.map((themeId) => ({ documentId, themeId, isPrimary: themeId === primary, assignedBy })),
    })
  })
}
