/**
 * La page d'un notaire — lecture (Prisma simulé) puis rendu serveur. C'est le SEUL endroit où
 * s'affichent les coordonnées : complètes (n° 9, deux `tel:`), partielles (n° 21, aucune ligne
 * de téléphone), absentes ; et l'entrée retirée n° 37 n'a pas de page.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const prisma = { notary: { findUnique: vi.fn() }, notaryConfirmation: { findMany: vi.fn() } }
vi.mock('@/lib/db', () => ({ prisma }))
const { getNotaryProfile } = await import('@/lib/jurisdictions/data')
const { empreinte, instantane } = await import('@/lib/jurisdictions/notaires-confirmation')
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

beforeEach(() => { vi.resetAllMocks(); prisma.notary.findUnique.mockResolvedValue(ligne({})); prisma.notaryConfirmation.findMany.mockResolvedValue([]) })

describe('page d’un notaire', () => {
  it('n° 9 : « Gemma » affiché, « Gamma » signalé, juridiction SANS « TPI »', async () => {
    const html = await rendu()
    // Titre de la page « Notaire » ; le nom titre la carte.
    expect(html).toMatch(/<h1[^>]*>Notaire<\/h1>/)
    expect(html).toMatch(/<h2 id="ag-notaire-nom"[^>]*><span>Gemma ANGLADE GILLES<\/span>/)
    expect(html).not.toContain('Fiche du notaire')
    expect(html).toContain(`${t.judicial.notaryPrintedName} : « Gamma ANGLADE GILLES »`)
    expect(html).toMatch(/href="\/fr\/juridictions\?vue=notaires&amp;juridiction=court-tpi-tpi-de-port-au-prince#ag-annuaire"[^>]*>Port-au-Prince<\/a>/)
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
    // Boutons d'appel : un par numéro, nommés pour les lecteurs d'écran, rangée alignée.
    expect(html).toContain('aria-label="Appeler le +509 2998-4747"')
    expect(html).toContain('aria-label="Appeler le +509 4643-0503"')
    expect(html).toContain('aria-label="Écrire à etudeanglade@gmail.com"')
    // L'adresse mène à la carte JUDICIAIRE de la plateforme (aucune carte tierce), sur la
    // commune du notaire, couche « notaires » allumée — le nom accessible dit « commune ».
    // L'adresse ouvre l'onglet « Notaires » centré sur la COMMUNE (aucune étude n'est géolocalisée),
    // carte ouverte d'office sur téléphone (17 oct. 2026).
    expect(html).toContain('href="/fr/juridictions?vue=notaires&amp;commune=commune-ouest-port-au-prince&amp;carte=1"')
    expect(html).toContain('aria-label="394, route de Bourdon, Port-au-Prince — Voir sur la carte judiciaire : commune de Port-au-Prince"')
    expect(html).not.toMatch(/google|target="_blank"/)
    expect(html).toContain('sm:grid-cols-[auto_1fr] sm:items-center')
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
  it('plusieurs courriels publiés : un lien par courriel, dans l’ordre communiqué', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({
      contact: { ...ligne({}).contact, email: 'etude@exemple.ht', emailsJson: '["etude@exemple.ht","accueil@exemple.ht"]' },
    }))
    const html = await rendu()
    const liens = [...html.matchAll(/href="mailto:([^"?]+)"/g)].map((m) => m[1])
    expect(liens.slice(0, 2)).toEqual(['etude@exemple.ht', 'accueil@exemple.ht'])
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

describe('page d’un notaire — badge « Confirmé »', () => {
  const N = { fullName: 'Gamma ANGLADE GILLES', displayName: 'Gemma ANGLADE GILLES', communeId: 'commune-ouest-port-au-prince' }
  const C = { address: '394, route de Bourdon, Port-au-Prince', phonesJson: '["+50929984747","+50946430503"]', email: 'etudeanglade@gmail.com', emailsJson: '["etudeanglade@gmail.com"]', active: true }
  const conf = (snapshotHash: string, status = 'ACTIVE') => [{ notaryId: 'mjsp-2026-09-08-9', status, snapshotHash, confirmedOn: new Date('2026-10-18T00:00:00Z') }]

  it('sans confirmation validée : ni coche, ni mention', async () => {
    const html = await rendu()
    expect(html).not.toContain(t.judicial.notaryConfirmedNote)
    expect(html).not.toContain(t.judicial.notaryConfirmedTooltip)
  })

  it('confirmation ACTIVE sur la version publiée : coche à côté du nom (infobulle et nom accessible), mention datée', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({ communeId: 'commune-ouest-port-au-prince' }))
    prisma.notaryConfirmation.findMany.mockResolvedValue(conf(empreinte(instantane(N, C))))
    const html = await rendu()
    expect(html).toMatch(/<span>Gemma ANGLADE GILLES<\/span><span title="Informations confirmées par le notaire\."/)
    expect(html).toContain('<span class="sr-only">Informations confirmées par le notaire.</span>')
    expect(html).toContain(t.judicial.notaryConfirmedNote)
    expect(html).toContain('Confirmé le 18 octobre 2026')
  })

  it('informations modifiées depuis : le badge tombe aussitôt (version différente)', async () => {
    prisma.notary.findUnique.mockResolvedValue(ligne({ communeId: 'commune-ouest-port-au-prince' }))
    prisma.notaryConfirmation.findMany.mockResolvedValue(conf(empreinte(instantane(N, { ...C, address: 'autre adresse' }))))
    expect(await rendu()).not.toContain(t.judicial.notaryConfirmedNote)
  })

  it('crayon discret (formulaire ouvert) : 44 px, nommé, infobulle ; jamais de grand bouton ni de bloc « Votre demande »', async () => {
    const p = (await getNotaryProfile('mjsp-2026-09-08-9'))!
    const html = renderToStaticMarkup(<NotaryProfileView p={p} locale="fr" t={t} demandes />)
    const crayon = /<a [^>]*aria-label="Demander une modification ou une confirmation"[^>]*>/.exec(html)?.[0] ?? ''
    expect(crayon).toContain('href="/fr/juridictions/notaires/demande?notaire=mjsp-2026-09-08-9"')
    expect(crayon).toContain('title="Demander une modification ou une confirmation"')
    expect(crayon).toMatch(/class="[^"]*\bh-11 w-11\b/)
    expect(html).not.toMatch(/Votre demande|En attente de validation|Voir ma demande|données illustratives/)
    expect(html).not.toContain(t.judicial.notaryRequestLinkContact)
  })
})
