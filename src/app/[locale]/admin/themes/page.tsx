import { dictFor } from '@/lib/i18n/server'
import { requireAdmin } from '@/lib/auth/guard'
import { getThemeTree } from '@/lib/legislation/themes'
import { prisma } from '@/lib/db'
import { ThemeManager } from '@/components/ThemeManager'

export const dynamic = 'force-dynamic'

// Master Admin — gestion de la taxonomie de la Législation annotée (thèmes).
// Ajouter / renommer / déplacer / réordonner / archiver / supprimer des thèmes.
export default async function AdminThemesPage({ params }: { params: { locale: string } }) {
  const { locale } = dictFor(params.locale)
  await requireAdmin(locale)

  const tree = await getThemeTree()
  // Nombre de documents rattachés par thème (pour informer l'admin avant suppression).
  const counts = await prisma.documentTheme.groupBy({ by: ['themeId'], _count: { themeId: true } })
  const docCounts: Record<string, number> = {}
  for (const c of counts) docCounts[c.themeId] = c._count.themeId

  return <ThemeManager locale={locale} initialTree={tree} docCounts={docCounts} />
}
