/**
 * Fiche de la commune (section « Notaires (N) », ligne du TPI) et liste par juridiction —
 * lectures de la base (Prisma simulé) PUIS rendu serveur, comme en production.
 *
 * Ce qui est protégé, et qu'un coup d'œil ne verrait pas :
 *  - une commune sans notaire le DIT (la section n'est jamais vide) ;
 *  - la provenance est une phrase en clair : ni URL brute, ni nom de fichier, ni empreinte
 *    (décision de la cliente du 9 oct. 2026) ;
 *  - tant que la table n'existe pas en production, la fiche reste servie, sans section ;
 *  - le TPI d'un notaire se DÉDUIT de sa commune.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const prisma = {
  judicialCommune: { findUnique: vi.fn(), findMany: vi.fn() },
  courtCommuneJurisdiction: { findMany: vi.fn() },
  notary: { findMany: vi.fn(), groupBy: vi.fn(), findFirst: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma }))

const { getCommuneRecord, getNotaryDirectory } = await import('@/lib/jurisdictions/data')
const { JudicialResults } = await import('./JudicialResults')
const { NotaryDirectoryView } = await import('./NotaryDirectoryView')
const { getDictionary } = await import('@/lib/i18n/dictionaries')

const t = getDictionary('fr')
const SOURCE = JSON.stringify({
  url: 'https://www.mjsp.gouv.ht/page/notaires',
  consultations: [
    { date: '2026-09-08', file: 'notaires-mjsp.pdf', sha256: '4d77f08495b117acef80dd947b3cd7a93037971770e0c754035373e0dd0ce716' },
    { date: '2026-10-09', file: 'notaires-mjsp-2.pdf', sha256: 'cf0b0f15d2b78d30fab3ca28ae629167ffaaaedab5a0035885bdd444e9dc226e' },
  ],
})
const TPI = 'court-tpi-tpi-de-port-au-prince'
const court = (id: string, type: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, type, name, normalizedName: name.toLowerCase(), scope: 'TERRITORIAL', department: 'Ouest', arrondissement: null,
  commune: 'Port-au-Prince', city: 'Port-au-Prince', address: null, postalCode: null, plusCode: null, latitude: null,
  longitude: null, locationPrecision: 'UNKNOWN', operationalStatus: null, verificationStatus: 'CONFIRMED_OFFICIAL',
  observation: null, sourceJson: '[]', active: true, verifiedAt: null, ...extra,
})
const COMMUNE = {
  id: 'commune-ouest-cite-soleil', key: 'Ouest|Cité Soleil', slug: 'commune-ouest-cite-soleil', name: 'Cité Soleil',
  city: 'Cité Soleil', departmentId: 'd', arrondissementId: 'a', geometryKey: 'HT0113', centroidLat: 18.58,
  centroidLng: -72.33, aliasesJson: '[]', observation: null, sourceJson: '{}',
  department: { name: 'Ouest' }, arrondissement: { name: 'Port-au-Prince' }, postalCodes: [],
  jurisdictions: [
    { relationship: 'TPI_COMPETENT', court: court(TPI, 'PREMIERE_INSTANCE', 'TPI de Port-au-Prince') },
  ],
}

beforeEach(() => {
  vi.resetAllMocks()
  prisma.judicialCommune.findUnique.mockResolvedValue(COMMUNE)
  prisma.judicialCommune.findMany.mockResolvedValue([])
  prisma.notary.findMany.mockResolvedValue([
    { ordinal: 32, fullName: 'Jean EXEMPLE', mention: null },
    { ordinal: 33, fullName: 'Marie TEST', mention: 'PDD' },
    { ordinal: 35, fullName: 'Paul ESSAI', mention: null },
  ])
  prisma.courtCommuneJurisdiction.findMany.mockResolvedValue([
    { commune: { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince' } },
    { commune: { id: 'commune-ouest-cite-soleil', name: 'Cité Soleil' } },
    { commune: { id: 'commune-ouest-ile-a-vache', name: 'Commune Sans Notaire' } },
  ])
  prisma.notary.groupBy.mockResolvedValue([
    { communeId: 'commune-ouest-port-au-prince', _count: { _all: 21 } },
    { communeId: 'commune-ouest-cite-soleil', _count: { _all: 3 } },
  ])
  prisma.notary.findFirst.mockResolvedValue({ sourceJson: SOURCE })
})

describe('fiche de la commune — lecture', () => {
  it('notaires ACTIFS de la commune, par numéro ; ressort du TPI déduit des rattachements', async () => {
    const r = (await getCommuneRecord('commune-ouest-cite-soleil'))!
    expect(r.notaires).toHaveLength(3)
    expect(prisma.notary.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { communeId: 'commune-ouest-cite-soleil', active: true }, orderBy: { ordinal: 'asc' },
    }))
    expect(prisma.courtCommuneJurisdiction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { courtId: TPI, relationship: 'TPI_COMPETENT' },
    }))
    expect(r.courts.firstInstance?.notairesDuRessort).toEqual([
      { communeId: 'commune-ouest-cite-soleil', communeName: 'Cité Soleil', count: 3 },
      { communeId: 'commune-ouest-ile-a-vache', communeName: 'Commune Sans Notaire', count: 0 },
      { communeId: 'commune-ouest-port-au-prince', communeName: 'Port-au-Prince', count: 21 },
    ])
    expect(r.notairesSource).toEqual({ consultations: ['2026-09-08', '2026-10-09'] })
  })

  it('table pas encore migrée (P2021) : la fiche est servie, SANS section notaires', async () => {
    prisma.notary.findMany.mockRejectedValue(Object.assign(new Error('table does not exist'), { code: 'P2021' }))
    const r = (await getCommuneRecord('commune-ouest-cite-soleil'))!
    expect(r.commune.name).toBe('Cité Soleil')
    expect(r.notaires).toBeNull()
    expect(r.courts.firstInstance?.notairesDuRessort).toBeNull()
    const html = renderToStaticMarkup(<JudicialResults record={r} locale="fr" t={t} />)
    expect(html).not.toContain('ag-notaires-titre')
    expect(html).not.toContain('dans le ressort')
  })

  it('client Prisma antérieur au modèle (délégué absent) : même repli, pas de 500', async () => {
    prisma.notary.findMany.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'findMany')"))
    expect((await getCommuneRecord('commune-ouest-cite-soleil'))!.notaires).toBeNull()
  })
})

describe('fiche de la commune — rendu', () => {
  it('section « Notaires (3) » : 👤, noms tels qu’imprimés, marqueur, provenance EN CLAIR', async () => {
    const html = renderToStaticMarkup(<JudicialResults record={(await getCommuneRecord('commune-ouest-cite-soleil'))!} locale="fr" t={t} />)
    expect(html).toContain('<span aria-hidden="true" class="mr-1">👤</span>Notaires (3)</h3>')
    expect(html).toContain('Marie TEST<span class="ml-1 font-mono text-[11px] text-ank/80">(PDD)</span>')
    expect(html).toContain('Liste publiée par le ministère de la Justice et de la Sécurité publique (MJSP), consultée le 8 septembre et le 9 octobre 2026.')
    // Rien de brut : ni URL, ni fichier, ni empreinte.
    expect(html).not.toMatch(/mjsp\.gouv|\.pdf|cf0b0f15|4d77f084|sha/i)
    expect(html).toContain(`href="/fr/juridictions/notaires#${TPI}"`)
  })

  it('aucun notaire : la section le dit en toutes lettres', async () => {
    prisma.notary.findMany.mockResolvedValue([])
    const html = renderToStaticMarkup(<JudicialResults record={(await getCommuneRecord('commune-ouest-cite-soleil'))!} locale="fr" t={t} />)
    expect(html).toContain('Notaires (0)</h3>')
    expect(html).toContain('Aucun notaire inscrit dans cette commune sur la liste du MJSP.')
  })

  it('carte du TPI : « 24 notaires dans le ressort », vers la liste ancrée sur ce TPI', async () => {
    const html = renderToStaticMarkup(<JudicialResults record={(await getCommuneRecord('commune-ouest-cite-soleil'))!} locale="fr" t={t} />)
    expect(html).toMatch(new RegExp(`href="/fr/juridictions/notaires#${TPI}"[^>]*><span aria-hidden="true">👤</span>24 notaires dans le ressort</a>`))
  })

  it('trois langues', async () => {
    const r = (await getCommuneRecord('commune-ouest-cite-soleil'))!
    const en = renderToStaticMarkup(<JudicialResults record={r} locale="en" t={getDictionary('en')} />)
    const ht = renderToStaticMarkup(<JudicialResults record={r} locale="ht" t={getDictionary('ht')} />)
    expect(en).toContain('consulted on 8 September and 9 October 2026')
    expect(en).toContain('24 notaries within its jurisdiction')
    expect(ht).toContain('8 septanm ak 9 oktòb 2026')
    expect(ht).toContain('Notè yo')
  })
})

describe('liste par juridiction', () => {
  const NOTAIRES = [
    { ordinal: 21, fullName: 'Gilbert Emile GIORDANI', mention: null, communeId: 'commune-ouest-port-au-prince', sourceDepartment: 'Ouest', sourceCommune: 'PORT-AU-PRINCE', active: true },
    { ordinal: 37, fullName: 'Gilbert Emile GIORDANI', mention: null, communeId: 'commune-ouest-cite-soleil', sourceDepartment: 'Ouest', sourceCommune: 'CITÉ-SOLEIL', active: false },
    { ordinal: 154, fullName: 'Rille MÉSIDOR', mention: null, communeId: null, sourceDepartment: 'Nord', sourceCommune: 'PETIT-BOURG DE PORT MARGOT', active: true },
    { ordinal: 320, fullName: 'Ana GONAIVES', mention: 'PDD', communeId: 'commune-artibonite-les-gonaives', sourceDepartment: 'Nippes', sourceCommune: 'GONAIVES', active: true },
  ]
  const COMMUNES = [
    { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: { name: 'Ouest' }, jurisdictions: [{ court: { id: TPI, name: 'TPI de Port-au-Prince', active: true } }] },
    { id: 'commune-ouest-cite-soleil', name: 'Cité Soleil', department: { name: 'Ouest' }, jurisdictions: [{ court: { id: TPI, name: 'TPI de Port-au-Prince', active: true } }] },
    { id: 'commune-artibonite-les-gonaives', name: 'Les Gonaïves', department: { name: 'Artibonite' }, jurisdictions: [{ court: { id: 'court-tpi-tpi-des-gonaives', name: 'TPI des Gonaïves', active: true } }] },
  ]
  beforeEach(() => {
    prisma.notary.findMany.mockResolvedValue(NOTAIRES)
    prisma.judicialCommune.findMany.mockResolvedValue(COMMUNES)
  })

  it('par TPI (ordre du siège), puis par commune ; communes sans notaire comprises ; inactifs exclus', async () => {
    const d = (await getNotaryDirectory())!
    expect(d.totalEntries).toBe(4)
    expect(d.activeEntries).toBe(3)
    expect(d.tpis.map((x) => [x.name, x.total])).toEqual([['TPI des Gonaïves', 1], ['TPI de Port-au-Prince', 1]])
    const pap = d.tpis[1]
    expect(pap.communes.map((c) => [c.name, c.notaires.length])).toEqual([['Cité Soleil', 0], ['Port-au-Prince', 1]])
    expect(d.unmatched.map((n) => n.ordinal)).toEqual([154])
  })

  it('le désaccord de département est signalé — et seulement lui', async () => {
    const d = (await getNotaryDirectory())!
    expect(d.tpis[0].communes[0].notaires[0].printedDepartment).toBe('Nippes')
    expect(d.tpis[1].communes[1].notaires[0].printedDepartment).toBeNull()
  })

  it('rendu : une ancre par TPI, comptes, « Commune non reconnue », provenance en clair', async () => {
    const html = renderToStaticMarkup(<NotaryDirectoryView dir={await getNotaryDirectory()} locale="fr" t={t} />)
    expect(html).toContain(`id="${TPI}"`)
    expect(html).toContain(`href="#${TPI}"`)
    expect(html).toContain('3 inscriptions affichées sur les 4 de la liste.')
    expect(html).toContain('id="commune-non-reconnue"')
    expect(html).toContain('commune imprimée : PETIT-BOURG DE PORT MARGOT')
    expect(html).toContain('(département imprimé : Nippes)')
    expect(html).toContain('aucun notaire inscrit')
    expect(html).toContain('consultée le 8 septembre et le 9 octobre 2026')
    expect(html).not.toMatch(/mjsp\.gouv|\.pdf|cf0b0f15/i)
  })

  it('table pas encore migrée : la page le dit, sans planter', async () => {
    prisma.notary.findMany.mockRejectedValue(Object.assign(new Error('no table'), { code: 'P2021' }))
    const d = await getNotaryDirectory()
    expect(d).toBeNull()
    expect(renderToStaticMarkup(<NotaryDirectoryView dir={d} locale="fr" t={t} />)).toContain(t.judicial.notariesUnavailable.replace("'", '&#x27;'))
  })
})
