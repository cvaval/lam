/**
 * La page d'un notaire — lecture (Prisma simulé) puis rendu serveur. C'est le SEUL endroit où
 * s'affichent les coordonnées : complètes (n° 9, deux `tel:`), partielles (n° 21, aucune ligne
 * de téléphone), absentes ; et l'entrée retirée n° 37 n'a pas de page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const prisma = { notary: { findUnique: vi.fn() } }
vi.mock('@/lib/db', () => ({ prisma }))
const { getNotaryProfile } = await import('@/lib/jurisdictions/data')
const { NotaryProfileView } = await import('./NotaryProfileView')
const { getDictionary } = await import('@/lib/i18n/dictionaries')
const t = getDictionary('fr')

const SOURCE = JSON.stringify({ consultations: [{ date: '2026-09-08' }, { date: '2026-10-09' }] })
const COMMUNE = {
  id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: { name: 'Ouest' },
  jurisdictions: [{ court: { id: 'court-tpi-tpi-de-port-au-prince', name: 'TPI de Port-au-Prince', active: true } }],
}
const ligne = (o: Record<string, unknown>) => ({
  id: 'mjsp-2026-09-08-9', ordinal: 9, fullName: 'Gamma ANGLADE GILLES', displayName: 'Gemma ANGLADE GILLES',
  mention: null, active: true, sourceCommune: 'PORT-AU-PRINCE', sourceJson: SOURCE, commune: COMMUNE,
  contact: {
    address: '394, route de Bourdon, Port-au-Prince', phonesJson: '["+50929984747","+50946430503"]',
    email: 'etudeanglade@gmail.com', upToDateOn: new Date('2026-10-09T00:00:00Z'), active: true,
  },
  ...o,
})
const rendu = async (id = 'mjsp-2026-09-08-9', locale: 'fr' | 'en' | 'ht' = 'fr') =>
  renderToStaticMarkup(<NotaryProfileView p={(await getNotaryProfile(id))!} locale={locale} t={getDictionary(locale)} />)

beforeEach(() => { vi.resetAllMocks(); prisma.notary.findUnique.mockResolvedValue(ligne({})) })

describe('page d’un notaire', () => {
  it('n° 9 : « Gemma » affiché, « Gamma » signalé, juridiction SANS « TPI »', async () => {
    const html = await rendu()
    expect(html).toContain('👤</span>Gemma ANGLADE GILLES')
    expect(html).toContain(`${t.judicial.notaryPrintedName} : « Gamma ANGLADE GILLES »`)
    expect(html).toMatch(/href="\/fr\/juridictions\/notaires#court-tpi-tpi-de-port-au-prince"[^>]*>Port-au-Prince<\/a>/)
    expect(html).not.toMatch(/\bTPI\b(?! de Port)|première instance/)
  })
  it('coordonnées complètes : adresse, deux téléphones cliquables, courriel, « à jour au »', async () => {
    const html = await rendu()
    expect(html).toContain('394, route de Bourdon, Port-au-Prince')
    expect(html).toContain('href="tel:+50929984747"')
    expect(html).toContain('>+509 2998-4747</a>')
    expect(html).toContain('href="tel:+50946430503"')
    expect(html).toContain('href="mailto:etudeanglade@gmail.com"')
    expect(html).toContain('Coordonnées communiquées à la rédaction d’Agora, à jour au 9 octobre 2026.')
    expect(html).toContain('href="mailto:erreur@agora.ht?subject=')
  })
  it('coordonnées partielles (n° 21) : aucune ligne de téléphone, rien d’inventé', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({
      id: 'mjsp-2026-09-08-21', ordinal: 21, fullName: 'Gilbert Emile GIORDANI', displayName: null,
      contact: { address: '#3, rue Théodule, Bourdon, Port-au-Prince', phonesJson: '[]', email: 'Contact@etudegilbertgiordani.net', upToDateOn: new Date('2026-10-09T00:00:00Z'), active: true },
    }))
    const html = await rendu('mjsp-2026-09-08-21')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain(t.judicial.notaryPhone)
    expect(html).not.toContain('non communiqué')
    expect(html).toContain('href="mailto:Contact@etudegilbertgiordani.net"')
    expect(html).not.toContain(t.judicial.notaryPrintedName)
  })
  it('sans fiche : une phrase, le reste de la page inchangé', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({ contact: null }))
    const html = await rendu()
    expect(html).toContain(t.judicial.notaryNoContacts)
    expect(html).not.toContain('tel:')
  })
  it('une fiche DÉSACTIVÉE ne s’affiche pas', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({ contact: { ...ligne({}).contact, active: false } }))
    expect(await rendu()).toContain(t.judicial.notaryNoContacts)
  })
  it('entrée retirée (n° 37), inconnue ou mal formée : pas de page', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({ id: 'mjsp-2026-09-08-37', active: false }))
    expect(await getNotaryProfile('mjsp-2026-09-08-37')).toBeNull()
    prisma.notary.findUnique.mockResolvedValue(null)
    expect(await getNotaryProfile('mjsp-2026-09-08-999')).toBeNull()
    expect(await getNotaryProfile('../etc')).toBeNull()
  })
  it('colonne pas encore migrée (P2022) : pas de 500, pas de page', async () => {
    prisma.notary.findUnique.mockRejectedValue(Object.assign(new Error('column does not exist'), { code: 'P2022' }))
    expect(await getNotaryProfile('mjsp-2026-09-08-9')).toBeNull()
  })
  it('trois langues', async () => {
    expect(await rendu('mjsp-2026-09-08-9', 'en')).toContain('up to date as of 9 October 2026')
    expect(await rendu('mjsp-2026-09-08-9', 'ht')).toContain('ajou 9 oktòb 2026')
  })
})
