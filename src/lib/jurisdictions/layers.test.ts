import { describe, it, expect } from 'vitest'
import {
  ALL_LAYERS, DEFAULT_LAYERS, LAYER_REGISTRY, MAP_LAYERS, MAX_LAYERS_PARAM,
  createLayerRegistry, emojiImageExpression, parseLayers, serializeLayers, type MapLayerDef,
} from './layers'
import { AVEC_HUISSIERS, HUISSIERS } from './layers.fixture'

/**
 * LE CONTRAT D'URL — des liens vers la carte circulent déjà (partages, historique, fiche du
 * héros de l'accueil) : chacun doit garder EXACTEMENT son sens. Une ligne = une URL du tableau
 * de la spécification (`docs/prompt-notaires-et-couches-carte-judiciaire.md`).
 */
const JURIDICTIONS = ['paix', 'tpi', 'appel', 'cassation']

describe('contrat d’URL — `parseLayers` sur toute la table', () => {
  const table: Array<[string, string | undefined, string[]]> = [
    ['paramètre absent ⇒ le DÉFAUT (et non plus « toutes »)', undefined, [...DEFAULT_LAYERS]],
    ['?layers=paix,tpi ⇒ paix + tpi, SANS notaires, comme avant', 'paix,tpi', ['paix', 'tpi']],
    ['?layers=notaires ⇒ notaires seuls', 'notaires', ['notaires']],
    ['?layers=tpi,tpi ⇒ dédoublonné', 'tpi,tpi', ['tpi']],
    ['?layers=paix,xyz ⇒ le slug inconnu est ignoré', 'paix,xyz', ['paix']],
    ['?layers=xyz ⇒ rien de valide ⇒ le défaut', 'xyz', [...DEFAULT_LAYERS]],
    ['?layers= (vide) ⇒ AUCUNE couche', '', []],
    [`plus de ${MAX_LAYERS_PARAM} caractères ⇒ le défaut`, `paix,${'x'.repeat(MAX_LAYERS_PARAM)}`, [...DEFAULT_LAYERS]],
    ['ordre canonique : tpi,paix ≡ paix,tpi', 'tpi,paix', ['paix', 'tpi']],
    ['majuscules : slug inconnu (les slugs sont stables et en minuscules)', 'PAIX', [...DEFAULT_LAYERS]],
  ]
  for (const [nom, raw, attendu] of table) {
    it(nom, () => expect(parseLayers(raw)).toEqual(attendu))
  }

  it('null se lit comme l’absence', () => expect(parseLayers(null)).toEqual([...DEFAULT_LAYERS]))
  it('exactement la longueur maximale est encore lue', () => {
    const raw = `paix${','.repeat(MAX_LAYERS_PARAM - 4)}`
    expect(raw).toHaveLength(MAX_LAYERS_PARAM)
    expect(parseLayers(raw)).toEqual(['paix'])
  })
})

describe('contrat d’URL — `serializeLayers`', () => {
  it('omet le paramètre (null) quand la sélection est le défaut, dans n’importe quel ordre', () => {
    expect(serializeLayers(DEFAULT_LAYERS)).toBeNull()
    expect(serializeLayers([...DEFAULT_LAYERS].reverse())).toBeNull()
  })
  it('ordre canonique — celui du registre — quel que soit l’ordre reçu', () => {
    expect(serializeLayers(['tpi', 'paix'])).toBe('paix,tpi')
    expect(serializeLayers(['paix', 'tpi'])).toBe('paix,tpi')
  })
  it('aucune couche ⇒ paramètre PRÉSENT et vide (une carte vide est un état partageable)', () => {
    expect(serializeLayers([])).toBe('')
  })
  it('les slugs inconnus ne s’écrivent jamais', () => {
    expect(serializeLayers(['paix', 'xyz'])).toBe('paix')
  })
  it('aller-retour : parse(serialize(x)) = x, pour toute sous-sélection', () => {
    const n = ALL_LAYERS.length
    for (let mask = 0; mask < 1 << n; mask++) {
      const sel = ALL_LAYERS.filter((_, i) => mask & (1 << i))
      const s = serializeLayers(sel)
      expect(parseLayers(s === null ? undefined : s), sel.join(',')).toEqual(sel)
    }
  })
})

describe('registre de la plateforme', () => {
  it('les quatre juridictions, dans l’ordre des boutons d’avant le registre', () => {
    expect(ALL_LAYERS.slice(0, 4)).toEqual(JURIDICTIONS)
    expect(MAP_LAYERS.slice(0, 4).every((l) => l.group === 'juridictions')).toBe(true)
  })
  it('les quatre juridictions restent le défaut ; les notaires sont masqués (question 3)', () => {
    expect(DEFAULT_LAYERS).toEqual(JURIDICTIONS)
    expect(ALL_LAYERS).toEqual([...JURIDICTIONS, 'notaires'])
  })
  it('notaires : groupe « professions », 👤, trois tailles, décalé pour ne masquer aucun tribunal', () => {
    const n = LAYER_REGISTRY.bySlug('notaires')!
    expect(n.group).toBe('professions')
    expect(n.marker).toMatchObject({ kind: 'emoji', glyph: '👤', imagePrefix: 'notaire' })
    expect(emojiImageExpression(n.marker as Extract<MapLayerDef['marker'], { kind: 'emoji' }>)).toEqual(
      ['step', ['get', 'count'], 'notaire-s', 3, 'notaire-m', 7, 'notaire-l'],
    )
    expect(n.iconOffset).toEqual([14, -14])
    expect(n.source.url).toBe('/api/public/jurisdictions/notaires/map-points')
  })
  it('notaires : peints SOUS les tribunaux (ne masquent jamais un tribunal), boutons dans l’ordre du registre', () => {
    expect(LAYER_REGISTRY.stackOrder).toEqual(['notaires', ...JURIDICTIONS])
    expect(ALL_LAYERS.at(-1)).toBe('notaires')
  })
  it('notaires : chargés seulement à la première activation', () => {
    expect(LAYER_REGISTRY.toLoad(DEFAULT_LAYERS)).toEqual(JURIDICTIONS)
    expect(LAYER_REGISTRY.toLoad(['notaires'])).toEqual([...JURIDICTIONS, 'notaires'])
  })
  it('les tribunaux de paix gouvernent DEUX couches MapLibre (agrégat + points)', () => {
    const v = LAYER_REGISTRY.visibility(['paix']).filter((x) => x.slug === 'paix')
    expect(v.map((x) => x.mapLayerId)).toEqual(['paix-clusters', 'paix-points'])
    expect(v.every((x) => x.visible)).toBe(true)
  })
  it('identifiants MapLibre inchangés (les captures d’avant le registre les supposent)', () => {
    expect(LAYER_REGISTRY.pointLayerIds.slice(0, 4)).toEqual(['paix-points', 'courts-PREMIERE_INSTANCE', 'courts-APPEL', 'courts-CASSATION'])
    expect(LAYER_REGISTRY.clusterLayerIds).toEqual(['paix-clusters'])
  })
  it('les juridictions partagent UNE réponse (map-points, inchangée), filtrée par type', () => {
    const urls = new Set(MAP_LAYERS.slice(0, 4).map((l) => l.source.url))
    expect([...urls]).toEqual(['/api/public/jurisdictions/map-points'])
  })
  it('bascule : décocher la dernière couche donne une carte VIDE, plus « toutes »', () => {
    expect(LAYER_REGISTRY.toggle(['paix'], 'paix')).toEqual([])
    expect(serializeLayers(LAYER_REGISTRY.toggle(['paix'], 'paix'))).toBe('')
  })
  it('bascule : un slug inconnu ne s’ajoute pas', () => {
    expect(LAYER_REGISTRY.toggle(['paix'], 'xyz')).toEqual(['paix'])
  })
})

describe('le registre refuse une déclaration incohérente', () => {
  const base = MAP_LAYERS[1] as unknown as MapLayerDef
  it('slug dupliqué', () => {
    expect(() => createLayerRegistry([base, base])).toThrow(/dupliqué/)
  })
  it('identifiant MapLibre partagé', () => {
    expect(() => createLayerRegistry([base, { ...base, slug: 'autre' }])).toThrow(/partagé/)
  })
  it('slug mal formé (il vit dans les URL)', () => {
    expect(() => createLayerRegistry([{ ...base, slug: 'Avec Espace' }])).toThrow(/invalide/)
  })
  it('groupe inconnu', () => {
    expect(() => createLayerRegistry([{ ...base, group: 'nimporte' as never }])).toThrow(/groupe/)
  })
})

describe('couche fictive — prise en charge de bout en bout sans autre code', () => {
  const r = AVEC_HUISSIERS
  it('URL : masquée par défaut, absente du paramètre par défaut', () => {
    expect(r.defaults).toEqual(JURIDICTIONS)
    expect(r.parse(undefined)).toEqual(JURIDICTIONS)
    expect(r.serialize(JURIDICTIONS)).toBeNull()
  })
  it('URL : ?layers=huissiers ⇒ huissiers seuls', () => {
    expect(r.parse('huissiers')).toEqual(['huissiers'])
  })
  it('URL : ?layers=paix,tpi ⇒ paix + tpi, SANS la nouvelle couche (ancien lien intact)', () => {
    expect(r.parse('paix,tpi')).toEqual(['paix', 'tpi'])
  })
  it('URL : l’activer depuis le défaut écrit les cinq, en ordre canonique', () => {
    expect(r.serialize(r.toggle(r.defaults, 'huissiers'))).toBe('paix,tpi,appel,cassation,huissiers')
  })
  it('visibilité : ses couches MapLibre suivent la sélection', () => {
    const off = r.visibility(JURIDICTIONS).find((v) => v.slug === 'huissiers')
    const on = r.visibility(['huissiers']).find((v) => v.slug === 'huissiers')
    expect(off).toEqual({ slug: 'huissiers', mapLayerId: 'huissiers-points', visible: false })
    expect(on?.visible).toBe(true)
  })
  it('chargement paresseux : ses points ne sont demandés qu’une fois activée', () => {
    expect(r.toLoad(JURIDICTIONS)).not.toContain('huissiers')
    expect(r.toLoad(['huissiers'])).toEqual([...JURIDICTIONS, 'huissiers'])
  })
  it('clic : ses points sélectionnent la commune comme ceux des tribunaux', () => {
    expect(r.pointLayerIds).toContain('huissiers-points')
  })
  it('groupes : un second groupe apparaît, dans l’ordre de LAYER_GROUPS', () => {
    expect(r.sections().map((s) => [s.group.id, s.layers.map((l) => l.slug)])).toEqual([
      ['juridictions', JURIDICTIONS],
      ['professions', ['notaires', 'huissiers']],
    ])
  })
  it('marqueur : trois images nettes selon le nombre, jamais une image étirée', () => {
    expect(emojiImageExpression(HUISSIERS.marker as Extract<MapLayerDef['marker'], { kind: 'emoji' }>)).toEqual(
      ['step', ['get', 'count'], 'huissier-s', 3, 'huissier-m', 7, 'huissier-l'],
    )
  })
})

describe('bulle au clic (couche des notaires)', () => {
  it('le 👤 ouvre « N notaires » en lien vers la liste, ancrée sur la commune ; libellés présents en fr/en/ht', async () => {
    const { getDictionary } = await import('@/lib/i18n/dictionaries')
    const notaires = MAP_LAYERS.find((l) => l.slug === 'notaires')!
    expect(notaires.popup).toEqual({ listPath: '/juridictions/notaires', countOneKey: 'notaryCountOne', countManyKey: 'notaryCountMany' })
    for (const loc of ['fr', 'en', 'ht'] as const) {
      const j = getDictionary(loc).judicial
      expect(j[notaires.popup.countOneKey]).toContain('{n}')
      expect(j[notaires.popup.countManyKey]).toContain('{n}')
      expect(j.notaryPopupSeeList).toContain(j.notariesByJurisdiction)
    }
  })
  it('les couches de juridictions n’ont pas de bulle (leur clic ouvre la fiche de la commune)', () => {
    expect(MAP_LAYERS.filter((l) => 'popup' in l && l.popup).map((l) => l.slug)).toEqual(['notaires'])
  })
})

