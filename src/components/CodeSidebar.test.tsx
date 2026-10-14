import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CodeSidebar } from './CodeSidebar'
import type { NavGroup } from '@/lib/legislation/annotated'

/**
 * Plages d'articles du sommaire (Code fiscal 2026) : un champ FACULTATIF. Une fiche qui ne le
 * porte pas — toutes les autres — doit être rendue à l'identique.
 */
const sansPlage: NavGroup[] = [
  { label: 'Code civil d’Haïti', anchor: 'sec-1', children: [{ label: 'LOI Nº 1 — De la promulgation', anchor: 'sec-1', children: [] }] },
]
const avecPlage: NavGroup[] = [
  {
    label: 'LIVRE I : CODE GÉNÉRAL DES IMPÔTS',
    anchor: 'sec-2',
    articles: 'art. 1 à 297',
    articlesAnchor: 'art-1',
    children: [{ label: 'PREMIÈRE PARTIE : PRÉALABLES', anchor: 'sec-3', articles: 'art. 1 à 44', articlesAnchor: 'art-1', children: [] }],
  },
]
const rendu = (groups: NavGroup[]) => renderToStaticMarkup(<CodeSidebar docId="d" groups={groups} indexEntries={[]} locale="fr" />)

describe('CodeSidebar — plages d’articles du sommaire', () => {
  it('sans le champ : le balisage historique, aucune plage', () => {
    const html = rendu(sansPlage)
    expect(html).toContain(
      '<a href="#sec-1" class="block px-1.5 py-1 text-xs font-bold uppercase tracking-wide text-grafit hover:text-chabon">Code civil d’Haïti</a>',
    )
    expect(html).toContain(
      '<a href="#sec-1" class="block flex-1 py-0.5 text-[13px] leading-snug text-grafit hover:text-chabon hover:underline">LOI Nº 1 — De la promulgation</a>',
    )
    expect(html).not.toContain('art. ')
  })
  it('avec le champ : la plage suit le libellé et mène au premier article', () => {
    const html = rendu(avecPlage)
    expect(html).toContain('href="#sec-2"')
    expect(html).toMatch(/<a href="#art-1"[^>]*>art\. 1 à 297<\/a>/)
    expect(html).toMatch(/<a href="#sec-3"[^>]*>PREMIÈRE PARTIE : PRÉALABLES<\/a><a href="#art-1"[^>]*>art\. 1 à 44<\/a>/)
    expect(html).not.toMatch(/p\.\s*\d/) // aucun numéro de page
  })
})
