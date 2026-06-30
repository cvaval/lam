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
 */
export async function documentsInTheme(
  themeId: string,
  user: { role: Role; services: DocType[] },
  opts: { skip?: number; take?: number } = {},
) {
  const themes = await listThemes()
  const ids = descendantIds(themeId, themes)
  if (ids.length === 0) return []
  return prisma.document.findMany({
    where: {
      type: { in: accessibleTypes(user) },
      themes: { some: { themeId: { in: ids } } },
    },
    select: { id: true, type: true, titleFr: true, titleEn: true, titleHt: true, number: true, status: true, publicationDate: true },
    orderBy: [{ publicationDate: 'desc' }, { titleFr: 'asc' }],
    skip: opts.skip,
    take: opts.take,
  })
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
