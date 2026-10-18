/**
 * Onglet « Notaires » — lecture de la base (Prisma simulé) PUIS rendu serveur, comme en production.
 *
 * Ce qui est protégé, et qu'un coup d'œil ne verrait pas :
 *  - le classement par juridiction, adresse exacte d'abord, puis nom de famille ;
 *  - une adresse imprécise (« Bourdon ») n'est pas affichée comme l'adresse de l'étude ;
 *  - l'adresse mène à la carte de la COMMUNE et le dit (aucune étude n'est géolocalisée) ;
 *  - ni téléphone ni courriel dans l'annuaire, et la requête ne les lit même pas ;
 *  - une PANNE n'est jamais présentée comme une liste vide ;
 *  - les inscriptions multiples légitimes restent distinctes ;
 *  - la fiche garde la trace de l'annuaire d'où l'on vient.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const prisma = {
  judicialCommune: { findMany: vi.fn() },
  notary: { findMany: vi.fn(), findFirst: vi.fn() },
  notaryContact: { findMany: vi.fn() },
  notaryConfirmation: { findMany: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => '/fr/juridictions' }))

const { getNotaryAnnuaire } = await import('@/lib/jurisdictions/data')
const { NotaryAnnuaireView } = await import('./NotaryAnnuaireView')
const { getDictionary } = await import('@/lib/i18n/dictionaries')
const { lireParamsAnnuaire } = await import('@/lib/jurisdictions/annuaire-notaires')
const { empreinte, instantane } = await import('@/lib/jurisdictions/notaires-confirmation')

const t = getDictionary('fr')
const PAP = 'court-tpi-tpi-de-port-au-prince'
const JAC = 'court-tpi-tpi-de-jacmel'
const SOURCE = JSON.stringify({ consultations: [{ date: '2026-09-08' }] })

const commune = (id: string, name: string, dept: string, tpi: string, tpiName: string) => ({
  id, name, department: { name: dept }, jurisdictions: [{ court: { id: tpi, name: tpiName, active: true } }],
})
const notaire = (id: string, fullName: string, communeId: string | null, extra: Record<string, unknown> = {}) => ({
  id, ordinal: Number(id.replace(/\D/g, '')) || 1, edition: '2026-09-08', fullName, displayName: null, mention: null,
  contact: null, communeId, sourceDepartment: 'Ouest', sourceCommune: 'X', active: true, ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  prisma.judicialCommune.findMany.mockResolvedValue([
    commune('commune-ouest-port-au-prince', 'Port-au-Prince', 'Ouest', PAP, 'TPI de Port-au-Prince'),
    commune('commune-ouest-delmas', 'Delmas', 'Ouest', PAP, 'TPI de Port-au-Prince'),
    commune('commune-sud-est-jacmel', 'Jacmel', 'Sud-Est', JAC, 'TPI de Jacmel'),
  ])
  prisma.notary.findMany.mockResolvedValue([
    notaire('n1', 'Patrick VICTOR', 'commune-ouest-port-au-prince'),
    notaire('n2', 'Sabine MORPEAU', 'commune-ouest-port-au-prince', { contact: { active: true } }),
    notaire('n3', 'Jean AVIN', 'commune-ouest-delmas'),
    notaire('n4', 'Jean AVIN', 'commune-ouest-port-au-prince'),
    notaire('n5', 'Zoé ALPHA', 'commune-sud-est-jacmel', { contact: { active: true } }),
    notaire('n6', 'Retiré RETIRÉ', 'commune-ouest-port-au-prince', { active: false }),
  ])
  prisma.notary.findFirst.mockResolvedValue({ sourceJson: SOURCE })
  prisma.notaryContact.findMany.mockResolvedValue([
    { notaryId: 'n2', address: '394, route de Bourdon, Port-au-Prince' },
    { notaryId: 'n5', address: 'Bourdon' },
  ])
  prisma.notaryConfirmation.findMany.mockResolvedValue([])
})

const MAP = { locale: 'fr' as const, selectedCommuneId: null, layers: ['notaires'], attribution: 'OSM', loadingLabel: 'Carte', popupLabels: {}, fallback: null }

async function rendre(sp: Record<string, string> = {}, etatForce?: 'erreur' | 'indisponible', trouves: Set<string> | null = null) {
  const params = lireParamsAnnuaire(sp)
  const annuaire = await getNotaryAnnuaire()
  const etat = etatForce ? { kind: etatForce } as const : { kind: 'ok' as const, annuaire: annuaire!, trouves }
  return renderToStaticMarkup(
    <NotaryAnnuaireView locale="fr" t={t} etat={etat} params={params} layersParam={null} map={{ ...MAP, selectedCommuneId: params.commune }} couches={null} pied={null} carteOuverte={false} />,
  )
}

const ordre = (html: string, noms: string[]) => noms.map((n) => html.indexOf(n))

describe('annuaire des notaires — classement et présentation', () => {
  it('regroupe par juridiction ; dans chacune, adresse exacte d’abord, puis par nom de famille', async () => {
    const html = await rendre()
    expect(html).toContain('Annuaire des notaires')
    const pos = ordre(html, ['>Jacmel<', 'Zoé ALPHA', '>Port-au-Prince<', 'Sabine MORPEAU', 'Jean AVIN', 'Patrick VICTOR'])
    expect(pos.every((p) => p >= 0)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
    expect(html).not.toContain('Retiré RETIRÉ')
  })

  it('adresse exacte affichée et menant à la carte de la COMMUNE ; adresse imprécise tue', async () => {
    const html = await rendre()
    expect(html).toContain('394, route de Bourdon, Port-au-Prince')
    expect(html).toContain('href="/fr/juridictions?vue=notaires&amp;commune=commune-ouest-port-au-prince&amp;carte=1"')
    expect(html).toContain('l’étude n’est pas géolocalisée')
    // « Bourdon » seul n'est pas une adresse exacte : ni affichée, ni comptée comme telle.
    expect(html).not.toMatch(/>Bourdon</)
    expect((html.match(/Adresse de l’étude non renseignée/g) ?? []).length).toBe(4)
    expect(html).not.toMatch(/Adresse vérifiée/i)
  })

  it('aucune donnée privée : ni téléphone ni courriel, et la requête ne lit que l’adresse', async () => {
    const html = await rendre()
    expect(html).not.toMatch(/tel:|mailto:|@/)
    const select = prisma.notaryContact.findMany.mock.calls[0][0].select
    expect(Object.keys(select).sort()).toEqual(['address', 'notaryId'])
  })

  it('inscriptions multiples légitimes : deux « Jean AVIN », deux fiches distinctes', async () => {
    const html = await rendre()
    expect(html).toContain('/fr/juridictions/notaires/n3?retour=')
    expect(html).toContain('/fr/juridictions/notaires/n4?retour=')
  })

  it('la fiche garde l’état de l’annuaire (recherche, filtres)', async () => {
    const html = await rendre({ vue: 'notaires', juridiction: PAP })
    expect(html).toContain(`/fr/juridictions/notaires/n2?retour=${encodeURIComponent(`onglet:vue=notaires&juridiction=${PAP}`)}`)
  })
})

describe('annuaire des notaires — recherche, filtres, commune choisie sur la carte', () => {
  it('recherche : filtre actif annoncé, puce retirable, « Effacer les filtres »', async () => {
    const html = await rendre({ vue: 'notaires', q: 'Victor' }, undefined, new Set(['n1']))
    expect(html).toContain('1 filtre actif')
    expect(html).toContain('Recherche : « Victor »')
    expect(html).toContain('Effacer les filtres')
    expect(html).toContain('Patrick VICTOR')
    expect(html).not.toContain('Sabine MORPEAU')
    expect(html).toMatch(/role="status" aria-live="polite"[^>]*>1 notaire/)
  })

  it('juridiction : seules ses inscriptions', async () => {
    const html = await rendre({ vue: 'notaires', juridiction: JAC })
    expect(html).toContain('Zoé ALPHA')
    expect(html).not.toContain('Patrick VICTOR')
    expect(html).toContain('Juridiction : Jacmel')
  })

  it('commune choisie : filtre visible et « Voir tous les notaires »', async () => {
    const html = await rendre({ vue: 'notaires', commune: 'commune-ouest-delmas' })
    expect(html).toContain('Commune : Delmas')
    expect(html).toContain('Voir tous les notaires')
    expect(html).toContain('Jean AVIN')
    expect(html).not.toContain('Patrick VICTOR')
  })

  it('aucun résultat : proposer de modifier ou d’effacer les filtres', async () => {
    const html = await rendre({ vue: 'notaires', q: 'zzzz' }, undefined, new Set())
    expect(html).toContain('Aucun notaire ne correspond à ces critères.')
    expect(html).toContain('Modifiez la recherche ou effacez les filtres.')
  })
})

describe('annuaire des notaires — états', () => {
  it('panne : alerte et « Réessayer », jamais une liste vide', async () => {
    const html = await rendre({ vue: 'notaires', q: 'Victor' }, 'erreur')
    expect(html).toContain('role="alert"')
    expect(html).toContain('Réessayer')
    expect(html).not.toContain('Aucun notaire ne correspond')
    expect(html).not.toContain('0 notaire')
  })

  it('liste pas encore en base : message dédié', async () => {
    const html = await rendre({ vue: 'notaires' }, 'indisponible')
    expect(html).toContain('pas encore disponible')
    expect(html).not.toContain('role="alert"')
  })

  it('téléphone : la carte attend le bouton « Afficher la carte » (l’annuaire d’abord)', async () => {
    const html = await rendre()
    expect(html).toMatch(/aria-expanded="false"[^>]*>.*Afficher la carte/)
    expect(html.indexOf('Afficher la carte')).toBeLessThan(html.indexOf('Sabine MORPEAU'))
  })
})

describe('annuaire des notaires — badge « Confirmé »', () => {
  it('absent après un simple import ou une simple demande (aucune confirmation validée)', async () => {
    const html = await rendre()
    expect(html).not.toContain('Informations confirmées par le notaire.')
  })

  it('affiché à côté du nom SEULEMENT pour la confirmation active sur la version publiée — sans changer l’ordre', async () => {
    const avant = ordre(await rendre(), ['Sabine MORPEAU', 'Jean AVIN', 'Patrick VICTOR'])
    // La fiche n1 (Patrick VICTOR) n'a pas de coordonnées actives : sa version porte nom et commune.
    const v = empreinte(instantane({ fullName: 'Patrick VICTOR', displayName: null, communeId: 'commune-ouest-port-au-prince' }, null))
    prisma.notaryConfirmation.findMany.mockResolvedValue([{ notaryId: 'n1', status: 'ACTIVE', snapshotHash: v, confirmedOn: new Date('2026-10-18T00:00:00Z') }])
    const html = await rendre()
    expect(html).toMatch(/<span>Patrick VICTOR<\/span><span title="Informations confirmées par le notaire\.[^>]*>/)
    expect((html.match(/Informations confirmées par le notaire\./g) ?? []).length).toBe(2) // infobulle + nom accessible, une seule carte
    expect(ordre(html, ['Sabine MORPEAU', 'Jean AVIN', 'Patrick VICTOR'])).toEqual(avant.map(() => expect.any(Number)))
    const pos = ordre(html, ['Sabine MORPEAU', 'Jean AVIN', 'Patrick VICTOR'])
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  })

  it('« Voir la fiche → » en bouton bleu profond ; la juridiction titre le groupe sans se répéter sur les cartes', async () => {
    const html = await rendre()
    expect(html).toMatch(/class="[^"]*bg-chabon[^"]*text-white[^"]*"[^>]*>Voir la fiche <span aria-hidden="true">→<\/span>/)
    expect((html.match(/>Port-au-Prince</g) ?? []).length).toBe(1)
  })
})
