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
  const docs = await prisma.document.findMany({
    where: {
      // SÉCURITÉ-CRITIQUE (§03) : ce filtre est la seule barrière entre l'API publique
      // theme-docs et les titres de docs non accordés. Ne JAMAIS le retirer/élargir sans
      // garder les appelants clients filtrés.
      type: { in: accessibleTypes(user) },
      themes: { some: { themeId: { in: ids } } },
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
 * CORPUS DE LA SECTION « LÉGISLATION ANNOTÉE ».
 *
 * ⚠️ Défaut signalé par la rédaction le 17 août 2026 : des ARRÊTS s'affichaient dans la
 * navigation par thèmes de la Législation annotée — « Agricultural Entreprises S.A. c. dame
 * Nadim Al-Khal » entre le Code civil et le Code de procédure civile. Le filtre ne portait
 * que sur l'ACCÈS de l'utilisateur (§03) : un membre du personnel, qui a droit à tout, voyait
 * donc tout. Or l'accès dit ce qu'on a le droit de lire, jamais ce qu'une section doit montrer.
 *
 * La jurisprudence a sa propre rubrique, `/jurisprudence`, avec ses filtres par juridiction et
 * ses sommaires d'arrêts : l'afficher ici la présentait comme un texte de loi parmi d'autres.
 *
 * Mesuré au moment de la correction : 407 textes de LÉGISLATION et 20 de DOCTRINE relèvent de
 * cette section ; 86 décisions et 295 circulaires ont la leur.
 *
 * ⚠️ Les circulaires de la BRH sont VOLONTAIREMENT conservées ici : leur classement sur deux
 * axes a été fait pour qu'on puisse les parcourir par matière, et rien ne les rend étrangères
 * à la législation annotée. Si la rédaction veut les en retirer aussi, il suffit de les ôter
 * de cette liste — mais c'est une décision éditoriale, pas un effet de bord.
 */
export const TYPES_LEGISLATION_ANNOTEE = ['LEGISLATION', 'DOCTRINE', 'CIRCULAIRE_BRH'] as const

/** Intersection de ce que l'utilisateur PEUT lire et de ce que la section DOIT montrer. */
export function typesDeLaSection(user: { role: Role; services: DocType[] }): DocType[] {
  const permis = new Set<string>(accessibleTypes(user))
  return TYPES_LEGISLATION_ANNOTEE.filter((t) => permis.has(t)) as unknown as DocType[]
}

export async function allThemedDocuments(
  user: { role: Role; services: DocType[] },
  opts: { take?: number } = {},
) {
  return prisma.document.findMany({
    where: {
      // §03 (accès) ET périmètre de la section — ne jamais retirer/élargir l'un ni l'autre.
      type: { in: typesDeLaSection(user) },
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
