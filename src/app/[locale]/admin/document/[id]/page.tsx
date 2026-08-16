import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireCapability } from '@/lib/auth/guard'
import { can } from '@/lib/rbac'
import { dictFor } from '@/lib/i18n/server'
import { prisma } from '@/lib/db'
import { getThemeTree } from '@/lib/legislation/themes'
import { resolveCrossRefs } from '@/lib/legislation/refs'
import { listArticles } from '@/lib/legislation/articles'
import { LegislationAdminPanel } from '@/components/LegislationAdminPanel'
import type { DocType } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * OUTILS ÉDITORIAUX D'UN DOCUMENT — thèmes, renvois, et selon la nature du document,
 * amendement d'article ou note d'édition.
 *
 * ⚠️ ILS VIVENT ICI, PAS SUR LA FICHE PUBLIQUE. Un abonné et un éditeur doivent voir la
 * même page de lecture : des champs de saisie glissés sous le texte officiel changent ce
 * qu'on croit lire. La fiche ne porte plus qu'un renvoi vers cet écran.
 */
export default async function AdminDocumentPage({ params }: { params: { locale: string; id: string } }) {
  const { locale } = dictFor(params.locale)
  const user = await requireCapability(locale, 'corpus.manage')

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: {
      id: true, type: true, titleFr: true, number: true, source: true,
      bodyClean: true, bodyOriginal: true,
      noteRedaction: true, noteRedactionBy: true, traitement: true, portee: true,
      traitementNote: true, porteeNote: true,
    },
  })
  if (!doc) notFound()

  const [tree, dThemes, crossRefs] = await Promise.all([
    getThemeTree({ activeOnly: true }),
    prisma.documentTheme.findMany({ where: { documentId: doc.id }, select: { themeId: true, isPrimary: true } }),
    prisma.crossRef.findMany({ where: { fromId: doc.id }, orderBy: { position: 'asc' } }),
  ])
  const resolved = await resolveCrossRefs(crossRefs)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wider text-grafit">{doc.type}</p>
          <h1 className="text-lg font-semibold text-ank">{doc.titleFr}</h1>
          {doc.number && <p className="text-sm text-grafit">n° {doc.number}</p>}
        </div>
        <Link
          href={`/${locale}/doc/${doc.id}`}
 className="inline-flex min-h-[44px] items-center rounded-lg border border-liy px-4 text-sm font-semibold text-ank transition hover:bg-pil"
        >
          Voir la fiche ↗
        </Link>
      </div>

      <LegislationAdminPanel
        documentId={doc.id}
        docType={doc.type as DocType}
        peutCurer={can(user.role, 'corpus.manage')}
        themeTree={tree}
        currentThemeIds={dThemes.map((dt) => dt.themeId)}
        primaryThemeId={dThemes.find((dt) => dt.isPrimary)?.themeId ?? null}
        articles={listArticles(doc.bodyClean ?? doc.bodyOriginal)}
        refs={resolved.map((r) => ({ refId: r.refId, kind: r.kind, label: r.label, toId: r.toId, pending: r.pending, anchor: r.anchor }))}
        noteEdition={{
          noteRedaction: doc.noteRedaction,
          noteRedactionBy: doc.noteRedactionBy,
          traitement: doc.traitement,
          portee: doc.portee,
          traitementNote: doc.traitementNote,
          porteeNote: doc.porteeNote,
        }}
      />
    </div>
  )
}
