/**
 * Lot A du 24 oct. 2026 (docs/recommandations-recherche-html-pdf.md) — du résultat au passage :
 * actions « Lire le texte » et « PDF » (mêmes droits que la fiche), lien vers l'ARTICLE, replis
 * ouverts et surlignés quand ils contiennent le terme. Valeurs FICTIVES.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ResultCard } from './ResultCard'
import { Jurisprudence } from './Jurisprudence'
import { OldVersion } from './OldVersion'
import { RelatedLaw } from './RelatedLaw'
import { CodeRefText } from './CodeRefText'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { SearchHit } from '@/lib/search/types'

const t = getDictionary('fr')
const HIT: SearchHit = {
  kind: 'document', id: 'doc-1', type: 'LEGISLATION', title: 'Code exemple', score: 1,
  snippet: '<strong class="font-semibold text-ank">Article 1382</strong> — la <mark class="hl">faute</mark>', anchor: 'art-1382',
}
const carte = (o: Partial<Parameters<typeof ResultCard>[0]> = {}) =>
  renderToStaticMarkup(<ResultCard hit={HIT} locale="fr" t={t} q="faute" {...o} />)

describe('résultat de recherche : le texte et l’original', () => {
  it('le clic mène AU PASSAGE : la requête et l’article (`?q=…#art-1382`) ; l’extrait dit où', () => {
    const html = carte({ pdf: true })
    expect(html).toContain('href="/fr/doc/doc-1?q=faute#art-1382"')
    expect(html).toContain('<strong class="font-semibold text-ank">Article 1382</strong>')
  })
  it('« Lire le texte » et « PDF ↗ » (route authentifiée, nouvel onglet, nommé) — aucun lien imbriqué', () => {
    const html = carte({ pdf: true })
    expect(html).toMatch(/>Lire le texte <span aria-hidden="true">→<\/span><\/a>/)
    expect(html).toContain('href="/api/doc/doc-1/pdf" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le PDF original (nouvel onglet) — Code exemple"')
    // La carte reste cliquable partout (lien du titre étendu) ; aucun <a> à l'intérieur d'un autre.
    expect(html).toContain('after:absolute after:inset-0')
    let profondeur = 0
    for (const balise of html.match(/<\/?a\b/g) ?? []) {
      profondeur += balise === '<a' ? 1 : -1
      expect(profondeur).toBeLessThanOrEqual(1)
    }
  })
  it('sans droit au PDF ou sans PDF servable : pas de bouton PDF (rien de nouveau n’est ouvert)', () => {
    expect(carte({ pdf: false })).not.toContain('/api/doc/doc-1/pdf')
  })
  it('PDF SEULEMENT (fascicule non transcrit) : le PDF devient l’action principale, pas de « Lire le texte »', () => {
    const html = carte({ texte: false, pdf: true })
    expect(html).not.toContain('Lire le texte')
    expect(html).toMatch(/class="[^"]*bg-chabon[^"]*text-white[^"]*">PDF <span aria-hidden="true">↗<\/span>/)
  })
  it('ni texte ni PDF permis : le titre seul, sans rangée d’actions', () => {
    const html = carte({ texte: false, pdf: false })
    expect(html).not.toMatch(/Lire le texte|\/pdf/)
    expect(html).toContain('href="/fr/doc/doc-1?q=faute#art-1382"')
  })
  it('sans article localisé : le lien porte la requête seule', () => {
    expect(renderToStaticMarkup(<ResultCard hit={{ ...HIT, anchor: null }} locale="fr" t={t} q="faute" />)).toContain('href="/fr/doc/doc-1?q=faute"')
  })
})

describe('replis : ouverts et surlignés quand ils contiennent le terme', () => {
  const cas = [{ ref: 'Arrêt du 5 avril 1966, X c. Y', excerpt: 'Attendu que la faute du gardien…' }]
  it('jurisprudence : ouverte d’office, terme marqué ; sans le terme, fermée comme avant', () => {
    const ouvert = renderToStaticMarkup(<Jurisprudence cases={cas} locale="fr" terms={['faute']} />)
    expect(ouvert).toContain('aria-expanded="true"')
    expect(ouvert).toContain('<mark class="hl">faute</mark>')
    const ferme = renderToStaticMarkup(<Jurisprudence cases={cas} locale="fr" terms={['cautionnement']} />)
    expect(ferme).toContain('aria-expanded="false"')
    expect(ferme).not.toContain('Attendu que')
    expect(renderToStaticMarkup(<Jurisprudence cases={cas} locale="fr" />)).toContain('aria-expanded="false"')
  })
  it('ancienne rédaction et textes connexes : idem', () => {
    expect(renderToStaticMarkup(<OldVersion text="Ancienne rédaction : la faute lourde." locale="fr" terms={['faute']} />)).toContain('<mark class="hl">faute</mark>')
    const connexe = renderToStaticMarkup(<RelatedLaw old="Version de 1825." blocks={[{ label: 'Loi du 1er mars 2010', text: 'La faute inexcusable…' } as never]} locale="fr" terms={['faute']} />)
    expect(connexe).toContain('<mark class="hl">faute</mark>')
    // Seul le repli qui contient le terme s'ouvre.
    expect((connexe.match(/aria-expanded="true"/g) ?? []).length).toBe(1)
  })
  it('renvois aux codes : le lien reste, le terme est marqué, y compris dans le libellé', () => {
    const html = renderToStaticMarkup(<CodeRefText text="Voir C. p. c. 949 sur la faute." codeHrefs={{ cpc: '/fr/doc/cpc' }} terms={['faute']} />)
    expect(html).toContain('href="/fr/doc/cpc#art-949"')
    expect(html).toContain('<mark class="hl">faute</mark>')
    expect(renderToStaticMarkup(<CodeRefText text="la faute" />)).toBe('la faute')
  })
})

describe('versions disponibles (une requête pour la page affichée)', () => {
  it('texte et PDF par document ; une panne ne fait pas tomber la recherche', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'doc-1', texte: true, pdf: true }, { id: 'doc-2', texte: false, pdf: true }])
    vi.doMock('../lib/db', () => ({ prisma: { $queryRaw: queryRaw } }))
    vi.resetModules()
    const { versionsDisponibles } = await import('@/lib/search/versions')
    const m = await versionsDisponibles(['doc-1', 'doc-2'])
    expect(m.get('doc-2')).toEqual({ texte: false, pdf: true })
    expect((await versionsDisponibles([])).size).toBe(0)
    queryRaw.mockRejectedValueOnce(new Error('panne'))
    expect((await versionsDisponibles(['doc-1'])).size).toBe(0)
  })
})
