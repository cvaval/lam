/**
 * Fiche d'un notaire : liste blanche publique, URL de la fiche ouverte, lien des courriels, action
 * cartographique — et le chargement (réponses concurrentes, panne ≠ absence, piège du clavier).
 * Valeurs FICTIVES (dépôt public).
 */
import { describe, expect, it, vi } from 'vitest'
import type { NotaryProfile } from './data'
import {
  lienCarteFiche, lienDemande, lienFicheNotaire, lireIdFiche, urlAvecFiche, urlSansFiche, versFichePublique,
} from './fiche-notaire'
import { creerControleurFiche, indexFocusSuivant, type EtatFiche, type ReponseFiche } from './fiche-controleur'

const PROFIL: NotaryProfile = {
  id: 'mjsp-2026-09-08-11', ordinal: 11, name: 'Jean EXEMPLE', printedName: 'Jean EXEMPLLE', mention: null,
  commune: { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: 'Ouest' },
  sourceCommune: 'PORT-AU-PRINCE',
  jurisdiction: { id: 'court-tpi-tpi-de-port-au-prince', label: 'Port-au-Prince' },
  contact: { address: '10, Rue Exemple, Port-au-Prince', phones: ['+50920000001', '+50930000002'], emails: ['etude@exemple.ht', 'accueil@exemple.ht'], upToDateOn: '2026-10-18', viaRequest: true },
  provenance: null, addedByEditors: null, confirmedOn: '2026-10-18', version: 'a'.repeat(64),
}

describe('fiche publique — LISTE BLANCHE (API, fenêtre modale)', () => {
  it('seulement les informations professionnelles publiables et la date de confirmation', () => {
    const f = versFichePublique(PROFIL)
    expect(Object.keys(f).sort()).toEqual(['commune', 'confirmedOn', 'contact', 'id', 'jurisdiction', 'mention', 'name', 'printedName', 'sourceCommune'])
    expect(Object.keys(f.contact!).sort()).toEqual(['address', 'emails', 'phones', 'upToDateOn'])
    // Ni l'empreinte de version, ni la provenance détaillée, ni l'origine d'une demande.
    expect(JSON.stringify(f)).not.toMatch(/version|provenance|viaRequest|aaaaaaaa/)
    expect(f.contact!.phones).toEqual(['+50920000001', '+50930000002'])
    expect(f.contact!.emails).toEqual(['etude@exemple.ht', 'accueil@exemple.ht'])
  })
  it('aucune coordonnée publiée : `contact` null (une seule phrase à l’écran)', () => {
    expect(versFichePublique({ ...PROFIL, contact: null }).contact).toBeNull()
    expect(versFichePublique({ ...PROFIL, contact: { address: null, phones: [], emails: [], upToDateOn: null, viaRequest: false } }).contact).toBeNull()
  })
})

describe('URL de la fiche ouverte (`?notaire=`)', () => {
  it('ajoutée puis retirée SANS toucher à la recherche, aux filtres, à la page ni aux couches', () => {
    const avant = '/fr/juridictions?vue=notaires&q=port&juridiction=court-x&commune=commune-y&page=3&layers=notaires#ag-annuaire'
    const ouverte = urlAvecFiche(avant, 'mjsp-2026-09-08-11')
    expect(ouverte).toBe('/fr/juridictions?vue=notaires&q=port&juridiction=court-x&commune=commune-y&page=3&layers=notaires&notaire=mjsp-2026-09-08-11#ag-annuaire')
    expect(urlSansFiche(ouverte)).toBe(avant)
    // Une seule fiche à la fois : en ouvrir une autre remplace la première.
    expect(urlAvecFiche(ouverte, 'mjsp-2026-09-08-12')).toContain('notaire=mjsp-2026-09-08-12')
    expect(urlAvecFiche(ouverte, 'mjsp-2026-09-08-12')).not.toContain('-11')
  })
  it('identifiant lu de l’URL : jamais deviné, rien d’injectable', () => {
    expect(lireIdFiche('mjsp-2026-09-08-11')).toBe('mjsp-2026-09-08-11')
    expect(lireIdFiche(['tiers-20261018-1', 'x'])).toBe('tiers-20261018-1')
    for (const v of [undefined, null, '', 'A', '../admin', 'mjsp 1', '<script>', 'x'.repeat(200)]) expect(lireIdFiche(v as never)).toBeNull()
  })
  it('formulaire de demande : le notaire désigné', () => {
    expect(lienDemande('fr', { notaire: 'mjsp-2026-09-08-11' })).toBe('/fr/juridictions/notaires/demande?notaire=mjsp-2026-09-08-11')
  })
})

describe('lien personnalisé des courriels (`{{lien_fiche_notaire}}`)', () => {
  it('l’annuaire, la fiche du DESTINATAIRE ouverte — construit de l’identifiant en base, HTTPS, sans donnée privée', () => {
    expect(lienFicheNotaire('mjsp-2026-09-08-11')).toBe('https://agora.ht/fr/juridictions?vue=notaires&notaire=mjsp-2026-09-08-11')
    expect(lienFicheNotaire('mjsp-2026-09-08-11', { origine: 'https://agora.ht/', locale: 'ht' })).toBe('https://agora.ht/ht/juridictions?vue=notaires&notaire=mjsp-2026-09-08-11')
    // Jamais un annuaire générique : sans identifiant valable, pas de lien.
    expect(() => lienFicheNotaire('')).toThrow(/invalide/)
    expect(() => lienFicheNotaire('Jean EXEMPLE')).toThrow(/invalide/)
    expect(() => lienFicheNotaire('mjsp-2026-09-08-11', { origine: 'http://agora.ht' })).toThrow(/HTTPS/)
  })
})

describe('« Voir la commune sur la carte → »', () => {
  const fiche = { commune: { id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince', department: 'Ouest' }, jurisdiction: { id: 'court-tpi-pap', label: 'Port-au-Prince' } }
  it('onglet « Notaires » : la fiche se ferme, la commune est choisie, recherche et couches gardées', () => {
    const href = lienCarteFiche('onglet', '/fr/juridictions?vue=notaires&q=port&juridiction=court-tpi-pap&page=4&layers=notaires&notaire=mjsp-2026-09-08-11', 'fr', fiche)!
    const u = new URL(href, 'https://agora.ht')
    expect(Object.fromEntries(u.searchParams)).toEqual({ vue: 'notaires', q: 'port', juridiction: 'court-tpi-pap', commune: 'commune-ouest-port-au-prince', layers: 'notaires', carte: '1' })
    expect(u.searchParams.has('notaire')).toBe(false)
  })
  it('une juridiction qui n’est pas celle du notaire est abandonnée (l’intersection serait vide)', () => {
    const href = lienCarteFiche('page', '/fr/juridictions/notaires?juridiction=court-autre&q=x', 'fr', fiche)!
    expect(new URL(href, 'https://agora.ht').searchParams.has('juridiction')).toBe(false)
    expect(href.startsWith('/fr/juridictions?vue=notaires')).toBe(true)
  })
  it('onglet « Juridictions » : la commune sur la carte des tribunaux', () => {
    expect(lienCarteFiche('juridictions', '/fr/juridictions?commune=commune-ouest-delmas&layers=tribunaux&notaire=x-1', 'fr', fiche)).toBe('/fr/juridictions?commune=commune-ouest-port-au-prince&layers=tribunaux#ag-judicial-map')
  })
  it('commune non reconnue : aucune action (jamais un faux emplacement)', () => {
    expect(lienCarteFiche('onglet', '/fr/juridictions?vue=notaires', 'fr', { commune: null, jurisdiction: null })).toBeNull()
  })
})

// ── Chargement ───────────────────────────────────────────────────────────────

function differe() {
  let resoudre!: (r: ReponseFiche) => void
  let rejeter!: (e: unknown) => void
  const promesse = new Promise<ReponseFiche>((ok, ko) => { resoudre = ok; rejeter = ko })
  return { promesse, resoudre, rejeter }
}
const fiche = (id: string) => ({ ...versFichePublique(PROFIL), id, name: `Notaire ${id}` })
const vide = () => new Promise((r) => setTimeout(r, 0))

describe('chargement de la fiche — toujours LA BONNE', () => {
  it('RÉPONSES CONCURRENTES : A lent, B rapide → B affichée ; la réponse tardive de A est ignorée et A annulée', async () => {
    const attentes = new Map<string, ReturnType<typeof differe>>()
    const signaux = new Map<string, AbortSignal>()
    const etats: EtatFiche[] = []
    const c = creerControleurFiche((id, signal) => { signaux.set(id, signal); const d = differe(); attentes.set(id, d); return d.promesse }, (e) => etats.push(e))
    c.ouvrir('notaire-a')
    c.ouvrir('notaire-b')
    expect(signaux.get('notaire-a')!.aborted).toBe(true)
    attentes.get('notaire-b')!.resoudre({ kind: 'ok', fiche: fiche('notaire-b') })
    await vide()
    attentes.get('notaire-a')!.resoudre({ kind: 'ok', fiche: fiche('notaire-a') })
    await vide()
    expect(c.etat()).toMatchObject({ statut: 'ok', id: 'notaire-b', fiche: { name: 'Notaire notaire-b' } })
    expect(etats.some((e) => e.statut === 'ok' && e.id === 'notaire-a')).toBe(false)
  })
  it('fermée pendant le chargement : la réponse arrivée ensuite n’ouvre rien', async () => {
    const d = differe()
    const c = creerControleurFiche(() => d.promesse, () => {})
    c.ouvrir('notaire-a')
    c.fermer()
    d.resoudre({ kind: 'ok', fiche: fiche('notaire-a') })
    await vide()
    expect(c.etat()).toEqual({ statut: 'fermee' })
  })
  it('une réponse qui ne porte pas l’identifiant demandé n’est JAMAIS affichée', async () => {
    const c = creerControleurFiche(async () => ({ kind: 'ok', fiche: fiche('autre') }), () => {})
    c.ouvrir('notaire-a')
    await vide()
    expect(c.etat()).toEqual({ statut: 'erreur', id: 'notaire-a' })
  })
  it('INTROUVABLE et PANNE restent distincts ; « Réessayer » relance la même fiche', async () => {
    const charger = vi.fn<(id: string, s: AbortSignal) => Promise<ReponseFiche>>()
      .mockResolvedValueOnce({ kind: 'introuvable' })
      .mockRejectedValueOnce(new Error('HTTP 503'))
      .mockResolvedValueOnce({ kind: 'ok', fiche: fiche('notaire-b') })
    const c = creerControleurFiche(charger, () => {})
    c.ouvrir('notaire-a')
    await vide()
    expect(c.etat()).toEqual({ statut: 'introuvable', id: 'notaire-a' })
    c.ouvrir('notaire-b')
    await vide()
    expect(c.etat()).toEqual({ statut: 'erreur', id: 'notaire-b' })
    c.reessayer()
    await vide()
    expect(c.etat()).toMatchObject({ statut: 'ok', id: 'notaire-b' })
    expect(charger).toHaveBeenCalledTimes(3)
  })
  it('lien direct : la fiche rendue par le serveur n’est pas rechargée', () => {
    const charger = vi.fn()
    const c = creerControleurFiche(charger, () => {}, { statut: 'ok', id: 'notaire-a', fiche: fiche('notaire-a') })
    c.ouvrir('notaire-a')
    expect(charger).not.toHaveBeenCalled()
  })
})

describe('piège du clavier (Tab) dans la fenêtre modale', () => {
  it('après le dernier, le premier ; avant le premier, le dernier ; ailleurs, le navigateur', () => {
    expect(indexFocusSuivant(5, 4, false)).toBe(0)
    expect(indexFocusSuivant(5, 0, true)).toBe(4)
    expect(indexFocusSuivant(5, 2, false)).toBe(-1)
    // Focus sur le dialogue lui-même (ouverture) : premier ou dernier élément.
    expect(indexFocusSuivant(5, -1, false)).toBe(0)
    expect(indexFocusSuivant(5, -1, true)).toBe(4)
    expect(indexFocusSuivant(0, -1, false)).toBe(-1)
  })
})
