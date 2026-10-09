import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { DEFAULT_LAYERS } from '@/lib/jurisdictions/layers'
import { AVEC_HUISSIERS } from '@/lib/jurisdictions/layers.fixture'
import { JudicialFilters } from './JudicialFilters'
import { MapLegend } from './MapLegend'

/**
 * Boutons et légende LISENT le registre : ce que ces tests prouvent, c'est (1) qu'avec le
 * registre de la plateforme les quatre boutons de juridictions gardent les liens d'avant le
 * registre — la couche « notaires » s'ajoute dans un second groupe, sans rien déplacer — et
 * (2) qu'une couche fictive déclarée dans un registre de test y apparaît sans une ligne de
 * plus dans les composants.
 *
 * ⚠️ Ces attentes ont changé UNE fois, au chantier B : livré seul, le chantier A n'avait
 * qu'un groupe et quatre boutons (commit 234f6af) ; l'entrée « notaires » du registre en
 * ajoute un cinquième et fait apparaître les intitulés de groupe. Les quatre liens des
 * juridictions, eux, n'ont pas bougé d'un octet.
 */
const t = getDictionary('fr')
const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const pressed = (html: string) => [...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1])

describe('boutons de couches — registre de la plateforme', () => {
  it('par défaut : les quatre liens des juridictions d’avant le registre, puis « Notaires » éteint', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...DEFAULT_LAYERS]} commune={null} />)
    expect(hrefs(html)).toEqual([
      '/fr/juridictions?layers=tpi%2Cappel%2Ccassation',
      '/fr/juridictions?layers=paix%2Cappel%2Ccassation',
      '/fr/juridictions?layers=paix%2Ctpi%2Ccassation',
      '/fr/juridictions?layers=paix%2Ctpi%2Cappel',
      '/fr/juridictions?layers=paix%2Ctpi%2Cappel%2Ccassation%2Cnotaires',
      '/fr/juridictions',
    ])
    expect(pressed(html)).toEqual(['true', 'true', 'true', 'true', 'false'])
    // Deux groupes, chacun son intitulé visible, plus le groupe d'ensemble.
    expect(html.match(/role="group"/g)).toHaveLength(3)
    expect(html).toContain(`>${t.judicial.layerGroupJuridictions}</span>`)
    expect(html).toContain(`>${t.judicial.layerGroupProfessions}</span>`)
    expect(html).toContain(`>${t.judicial.filtersLabel}</span>`)
  })

  it('« Notaires » : l’emoji sur sa pastille blanche, puis le libellé en clair', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...DEFAULT_LAYERS]} commune={null} />)
    expect(html).toMatch(/rounded-full bg-white"><span aria-hidden="true"[^>]*>👤<\/span><\/span> Notaires<\/a>/)
  })

  it('?layers=paix,tpi : rallumer une couche revient au défaut (paramètre omis)', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={['paix', 'tpi']} commune={null} />)
    expect(hrefs(html)).toEqual([
      '/fr/juridictions?layers=tpi',
      '/fr/juridictions?layers=paix',
      '/fr/juridictions?layers=paix%2Ctpi%2Cappel',
      '/fr/juridictions?layers=paix%2Ctpi%2Ccassation',
      '/fr/juridictions?layers=paix%2Ctpi%2Cnotaires',
      '/fr/juridictions',
    ])
    expect(pressed(html)).toEqual(['true', 'true', 'false', 'false', 'false'])
  })

  it('décocher la dernière couche donne une carte VIDE (`layers=`), plus « toutes »', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={['paix']} commune="commune-ouest-port-au-prince" />)
    expect(hrefs(html)[0]).toBe('/fr/juridictions?commune=commune-ouest-port-au-prince&layers=')
  })

  it('chaque bouton reste un lien (sans JavaScript), cible ≥ 44 px, marqueur sur pastille blanche', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...DEFAULT_LAYERS]} commune={null} />)
    const liens = html.match(/<a [^>]*aria-pressed[^>]*>/g) ?? []
    expect(liens).toHaveLength(5)
    for (const a of liens) expect(a).toContain('min-h-[44px]')
    expect(html.match(/rounded-full bg-white"><svg/g)).toHaveLength(4)
    expect(html.match(/rounded-full bg-white"><span aria-hidden="true"/g)).toHaveLength(1)
  })
})

describe('couche fictive — boutons et légende sans autre code', () => {
  const r = AVEC_HUISSIERS
  it('un bouton de plus, non pressé, dans un SECOND groupe à l’intitulé visible', () => {
    const html = renderToStaticMarkup(<JudicialFilters locale="fr" t={t} active={[...r.defaults]} commune={null} registry={r} />)
    expect(pressed(html)).toEqual(['true', 'true', 'true', 'true', 'false', 'false'])
    expect(hrefs(html)[5]).toBe('/fr/juridictions?layers=paix%2Ctpi%2Cappel%2Ccassation%2Chuissiers')
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
  it('les notaires n’y figurent que s’ils sont affichés', () => {
    expect(renderToStaticMarkup(<MapLegend t={t} active={[...DEFAULT_LAYERS]} />)).not.toContain('👤')
    const avec = renderToStaticMarkup(<MapLegend t={t} active={[...DEFAULT_LAYERS, 'notaires']} />)
    expect(avec).toContain('👤')
    expect(avec).toContain(t.judicial.legendNotaires)
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
