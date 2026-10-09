import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_LAYERS } from '@/lib/jurisdictions/layers'
import { AVEC_HUISSIERS } from '@/lib/jurisdictions/layers.fixture'
import { JudicialFilters } from './JudicialFilters'
import { MapLegend } from './MapLegend'

/**
 * Boutons et légende LISENT le registre : ce que ces tests prouvent, c'est (1) qu'avec le
 * registre de la plateforme le rendu des boutons est celui d'avant le registre — mêmes
 * quatre boutons, mêmes liens — et (2) qu'une couche fictive déclarée dans un registre de
 * test y apparaît sans une ligne de plus dans les composants.
 */
const t = getDictionary('fr')
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const pressed = (html: string) => [...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1])

describe('boutons de couches — registre de la plateforme', () => {
  it('par défaut : les quatre boutons et leurs liens, à l’octet près d’avant le registre', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...DEFAULT_LAYERS]} commune={null} />)
    expect(hrefs(html)).toEqual([
      '/fr/juridictions?layers=tpi%2Cappel%2Ccassation',
      '/fr/juridictions?layers=paix%2Cappel%2Ccassation',
      '/fr/juridictions?layers=paix%2Ctpi%2Ccassation',
      '/fr/juridictions?layers=paix%2Ctpi%2Cappel',
      '/fr/juridictions',
    ])
    expect(pressed(html)).toEqual(['true', 'true', 'true', 'true'])
    // Un seul groupe pourvu : pas de sous-titre de groupe redondant.
    expect(html).not.toContain('ag-layer-group-')
    expect(html.match(/role="group"/g)).toHaveLength(1)
  })

  it('?layers=paix,tpi : rallumer une couche revient au défaut (paramètre omis)', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={['paix', 'tpi']} commune={null} />)
    expect(hrefs(html)).toEqual([
      '/fr/juridictions?layers=tpi',
      '/fr/juridictions?layers=paix',
      '/fr/juridictions?layers=paix%2Ctpi%2Cappel',
      '/fr/juridictions?layers=paix%2Ctpi%2Ccassation',
      '/fr/juridictions',
    ])
    expect(pressed(html)).toEqual(['true', 'true', 'false', 'false'])
  })

  it('décocher la dernière couche donne une carte VIDE (`layers=`), plus « toutes »', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={['paix']} commune="commune-ouest-port-au-prince" />)
    expect(hrefs(html)[0]).toBe('/fr/juridictions?commune=commune-ouest-port-au-prince&layers=')
  })

  it('chaque bouton reste un lien (sans JavaScript), cible ≥ 44 px, marqueur sur pastille blanche', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...DEFAULT_LAYERS]} commune={null} />)
    const liens = html.match(/<a [^>]*aria-pressed[^>]*>/g) ?? []
    expect(liens).toHaveLength(4)
    for (const a of liens) expect(a).toContain('min-h-[44px]')
    expect(html.match(/rounded-full bg-white"><svg/g)).toHaveLength(4)
  })
})

describe('couche fictive — boutons et légende sans autre code', () => {
  const r = AVEC_HUISSIERS
  it('un bouton de plus, non pressé, dans un SECOND groupe à l’intitulé visible', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...r.defaults]} commune={null} registry={r} />)
    expect(pressed(html)).toEqual(['true', 'true', 'true', 'true', 'false'])
    expect(hrefs(html)[4]).toBe('/fr/juridictions?layers=paix%2Ctpi%2Cappel%2Ccassation%2Chuissiers')
    // Un role="group" par groupe, relié à son intitulé visible.
    expect(html).toContain('role="group" aria-labelledby="ag-layer-group-juridictions"')
    expect(html).toContain('id="ag-layer-group-juridictions"')
    expect(html).toContain('role="group" aria-labelledby="ag-layer-group-professions"')
    expect(html).toContain(`>${t.judicial.layerGroupProfessions}</span>`)
    // Le marqueur emoji est le caractère lui-même, caché aux lecteurs d'écran, sur sa pastille.
    expect(html).toMatch(/rounded-full bg-white"><span aria-hidden="true"[^>]*>⚖️<\/span>/)
  })

  it('légende : la couche fictive n’y figure que si elle est affichée', () => {
    const sans = renderToStaticMarkup(<MapLegend t={t} active={[...r.defaults]} registry={r} />)
    const avec = renderToStaticMarkup(<MapLegend t={t} active={[...r.defaults, 'huissiers']} registry={r} />)
    expect(sans).not.toContain('⚖️')
    expect(avec).toContain('⚖️')
  })
})

describe('légende — registre de la plateforme', () => {
  it('par défaut : les quatre juridictions puis la commune, comme avant', () => {
    const html = renderToStaticMarkup(<MapLegend t={t} active={[...DEFAULT_LAYERS]} />)
    const textes = [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").trim())
    expect(textes).toEqual([
      t.judicial.peace, t.judicial.firstInstance, t.judicial.appeal, t.judicial.cassation, t.judicial.commune,
    ])
  })
  it('elle montre les couches AFFICHÉES : ?layers=paix,tpi n’en garde que deux', () => {
    const html = renderToStaticMarkup(<MapLegend t={t} active={['paix', 'tpi']} />)
    expect(html).toContain(t.judicial.peace)
    expect(html).not.toContain(t.judicial.appeal)
  })
  it('aucune couche : la commune seule', () => {
    const html = renderToStaticMarkup(<MapLegend t={t} active={[]} />)
    expect(html.match(/<li/g)).toHaveLength(1)
  })
})
