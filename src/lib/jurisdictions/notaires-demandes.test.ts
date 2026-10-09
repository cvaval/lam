import { describe, expect, it } from 'vitest'
import {
  DELAI_MINIMAL_MS, decisionDemandeSchema, decisionPermise, demandesOuvertes, destinatairesAlerte, idTiers,
  lireDemande, lireTelephones, normaliserSaisieContact, prochainIdTiers, saisieContactSchema, seuilPurgeDemandes,
} from './notaires-demandes'

/**
 * Coordonnées des notaires : la saisie de la rédaction (C) et les demandes des tiers (D).
 * Ce qui est protégé : le formulaire FERMÉ par défaut ; la notification qui ne part JAMAIS vers
 * une adresse saisie par le public ; le piège qui n'enregistre rien ; un numéro illisible
 * REFUSÉ plutôt que deviné ; une inscription hors liste sans vérification consignée impossible.
 */
const NOW = Date.parse('2026-10-09T15:00:00Z')
const COMMUNES = new Set(['commune-ouest-port-au-prince', 'commune-nord-port-margot'])
const opts = { maintenant: NOW, communesValides: COMMUNES }

const coordonnees = (o: Record<string, string | undefined> = {}) => ({
  t: String(NOW - 60_000), site: '', type: 'coordonnees', notaire: 'mjsp-2026-09-08-9',
  nom: 'Gemma Anglade Gilles', qualite: 'NOTAIRE', adresse: '394, route de Bourdon, Port-au-Prince',
  telephones: '+509 2998-47-47; 4643-0503', courriel: 'etudeanglade@gmail.com',
  courrielContact: 'etudeanglade@gmail.com', consentement: 'oui', ...o,
})
const inscription = (o: Record<string, string | undefined> = {}) => ({
  t: String(NOW - 60_000), site: '', type: 'inscription', nomNotaire: 'Me Jean Exemple', commune: 'commune-nord-port-margot',
  nom: 'Étude Exemple', qualite: 'ETUDE', courrielContact: 'contact@exemple.ht', consentement: 'oui', ...o,
})

describe('interrupteur et destinataires', () => {
  it('le formulaire est FERMÉ tant que la variable ne dit pas exactement « true » ET que les clés Turnstile manquent', () => {
    const cles = { TURNSTILE_SITE_KEY: '0x4AAAAAAAvraiecle', TURNSTILE_SECRET_KEY: '0x4AAAAAAAvraisecret' }
    expect(demandesOuvertes({})).toBe(false)
    expect(demandesOuvertes({ ...cles, NOTARY_REQUESTS_ENABLED: '1' })).toBe(false)
    expect(demandesOuvertes({ ...cles, NOTARY_REQUESTS_ENABLED: 'TRUE' })).toBe(false)
    expect(demandesOuvertes({ ...cles, NOTARY_REQUESTS_ENABLED: 'true' })).toBe(true)
    // Ouvert SANS protection : refusé.
    expect(demandesOuvertes({ NOTARY_REQUESTS_ENABLED: 'true' })).toBe(false)
    // En production Vercel, des clés de test ne protègent rien : fermé.
    expect(demandesOuvertes({
      NOTARY_REQUESTS_ENABLED: 'true', VERCEL_ENV: 'production',
      TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA',
    })).toBe(false)
  })
  it('legal@agora.ht par défaut ; la variable peut en nommer plusieurs ; une adresse illisible est écartée', () => {
    expect(destinatairesAlerte({})).toEqual(['legal@agora.ht'])
    expect(destinatairesAlerte({ NOTARY_REQUEST_ALERT_TO: ' a@agora.ht, b@agora.ht ' })).toEqual(['a@agora.ht', 'b@agora.ht'])
    expect(destinatairesAlerte({ NOTARY_REQUEST_ALERT_TO: 'pas une adresse' })).toEqual([])
  })
})

describe('téléphones saisis par un tiers', () => {
  it('séparateurs « ; » « , » « / », doublons fusionnés, 4 au plus', () => {
    expect(lireTelephones('+509 2942-3848 / 29423848')).toEqual(['+50929423848'])
    expect(lireTelephones('2998-47-47; +509 4643-05-03')).toEqual(['+50929984747', '+50946430503'])
    expect(lireTelephones('29000001;29000002;29000003;29000004;29000005')).toHaveLength(4)
    expect(lireTelephones(null)).toEqual([])
  })
  it('UN numéro illisible invalide la saisie : rien n’est deviné', () => {
    expect(lireTelephones('2942-3848 ; 12')).toBeNull()
  })
})

describe('lireDemande — protections invisibles', () => {
  it('champ piège rempli → « piège » (la route répond « envoyée » et n’enregistre rien)', () => {
    expect(lireDemande(coordonnees({ site: 'http://spam' }), opts)).toEqual({ kind: 'piege' })
  })
  it(`envoyé en moins de ${DELAI_MINIMAL_MS / 1000} s, sans heure, ou daté du futur → « piège »`, () => {
    expect(lireDemande(coordonnees({ t: String(NOW - 1000) }), opts).kind).toBe('piege')
    expect(lireDemande(coordonnees({ t: undefined }), opts).kind).toBe('piege')
    expect(lireDemande(coordonnees({ t: 'abc' }), opts).kind).toBe('piege')
    expect(lireDemande(coordonnees({ t: String(NOW + 5 * 60_000) }), opts).kind).toBe('piege')
  })
})

describe('lireDemande — coordonnées', () => {
  it('demande complète : normalisée, téléphones en E.164', () => {
    const r = lireDemande(coordonnees(), opts)
    expect(r.kind).toBe('valide')
    if (r.kind !== 'valide') return
    expect(r.valeur).toMatchObject({
      kind: 'CONTACT', notaryId: 'mjsp-2026-09-08-9', requesterRole: 'NOTAIRE', requesterRoleOther: null,
      phones: ['+50929984747', '+50946430503'], email: 'etudeanglade@gmail.com', communeId: null,
    })
  })
  it('sans aucune coordonnée → erreur « coordonnees »', () => {
    const r = lireDemande(coordonnees({ adresse: '', telephones: '', courriel: '' }), opts)
    expect(r).toEqual({ kind: 'invalide', erreurs: ['coordonnees'] })
  })
  it('sans notaire choisi, le nom saisi suffit ; sans l’un ni l’autre → « nomNotaire »', () => {
    expect(lireDemande(coordonnees({ notaire: '', nomNotaire: 'Ceant' }), opts).kind).toBe('valide')
    expect(lireDemande(coordonnees({ notaire: '' }), opts)).toEqual({ kind: 'invalide', erreurs: ['nomNotaire'] })
  })
  it('identifiant de notaire mal formé → « notaire »', () => {
    expect(lireDemande(coordonnees({ notaire: '../admin' }), opts)).toEqual({ kind: 'invalide', erreurs: ['notaire'] })
  })
  it('les retours à la ligne et caractères de contrôle d’une ligne sont neutralisés (pas d’en-tête injecté)', () => {
    const r = lireDemande(coordonnees({ nom: 'Jean\r\nBcc: x@y.z', adresse: 'rue\u0000A' }), opts)
    expect(r.kind).toBe('valide')
    if (r.kind !== 'valide') return
    expect(r.valeur.requesterName).toBe('Jean Bcc: x@y.z')
    expect(r.valeur.address).toBe('rue A')
  })
})

describe('lireDemande — inscription d’un notaire absent de la liste', () => {
  it('nom et commune du référentiel exigés', () => {
    expect(lireDemande(inscription(), opts).kind).toBe('valide')
    expect(lireDemande(inscription({ nomNotaire: '' }), opts)).toEqual({ kind: 'invalide', erreurs: ['nomNotaire'] })
    expect(lireDemande(inscription({ commune: 'commune-inventee' }), opts)).toEqual({ kind: 'invalide', erreurs: ['commune'] })
  })
  it('les coordonnées y sont facultatives', () => {
    const r = lireDemande(inscription(), opts)
    expect(r.kind === 'valide' && r.valeur.phones).toEqual([])
  })
})

describe('lireDemande — le demandeur', () => {
  it('qualité « autre » : à préciser', () => {
    expect(lireDemande(coordonnees({ qualite: 'AUTRE' }), opts)).toEqual({ kind: 'invalide', erreurs: ['qualiteAutre'] })
    const r = lireDemande(coordonnees({ qualite: 'AUTRE', qualiteAutre: 'clerc' }), opts)
    expect(r.kind === 'valide' && r.valeur.requesterRoleOther).toBe('clerc')
  })
  it('qualité inconnue, courriel de réponse illisible, pas d’accord → toutes les erreurs à la fois', () => {
    const r = lireDemande(coordonnees({ qualite: 'ROI', courrielContact: 'x', consentement: '' }), opts)
    expect(r).toEqual({ kind: 'invalide', erreurs: ['qualite', 'courrielContact', 'consentement'] })
  })
  it('objet inconnu → « type »', () => {
    expect(lireDemande(coordonnees({ type: 'autre' }), opts)).toMatchObject({ kind: 'invalide', erreurs: expect.arrayContaining(['type']) })
  })
})

describe('entrées ajoutées par la rédaction', () => {
  it('identifiant tiers-AAAAMMJJ-n, premier rang libre du jour', () => {
    const jour = new Date('2026-10-09T12:00:00Z')
    expect(idTiers(jour, 1)).toBe('tiers-20261009-1')
    expect(prochainIdTiers(jour, [])).toBe('tiers-20261009-1')
    expect(prochainIdTiers(jour, ['tiers-20261009-1', 'tiers-20261009-3', 'tiers-20261008-7'])).toBe('tiers-20261009-4')
  })
  it('purge : 12 mois après la décision', () => {
    expect(seuilPurgeDemandes(new Date('2026-10-09T04:00:00Z')).toISOString()).toBe('2025-10-09T04:00:00.000Z')
  })
})

describe('décision du master admin', () => {
  it('INSCRIRE exige une vérification consignée (10 caractères) et une vraie date', () => {
    const base = { action: 'INSCRIRE', fullName: 'Me Jean Exemple', communeId: 'commune-nord-port-margot', verifiedOn: '2026-10-09', note: 'Appel à la Chambre des notaires.' }
    expect(decisionDemandeSchema.safeParse(base).success).toBe(true)
    expect(decisionDemandeSchema.safeParse({ ...base, note: 'ok' }).success).toBe(false)
    expect(decisionDemandeSchema.safeParse({ ...base, verifiedOn: '2026-02-31' }).success).toBe(false)
    expect(decisionDemandeSchema.safeParse({ action: 'REFUSER', note: '' }).success).toBe(false)
  })
  it('une demande décidée ne se rouvre pas ; INSCRIRE ne vaut que pour une inscription', () => {
    expect(decisionPermise('NOUVELLE', 'CONTACT', 'EN_COURS')).toBe(true)
    expect(decisionPermise('EN_COURS', 'CONTACT', 'EN_COURS')).toBe(false)
    expect(decisionPermise('EN_COURS', 'LISTING', 'INSCRIRE')).toBe(true)
    expect(decisionPermise('NOUVELLE', 'CONTACT', 'INSCRIRE')).toBe(false)
    expect(decisionPermise('ACCEPTEE', 'LISTING', 'REFUSER')).toBe(false)
    expect(decisionPermise('REFUSEE', 'CONTACT', 'REFUSER')).toBe(false)
  })
})

describe('saisie de la rédaction', () => {
  const saisie = (o: Record<string, unknown> = {}) => saisieContactSchema.parse({
    address: '14 rue Marcadieux, Bourdon, Port-au-Prince', phones: ['+509 2942-3848'], email: 'patrickvictor@etudevictor.com',
    searchAliases: [], observation: null, upToDateOn: '2026-10-09', providedBy: 'Me Patrick Victor', channel: 'courriel à la rédaction',
    active: true, ...o,
  })
  it('mêmes règles que l’import : E.164, provenance consignée', () => {
    const r = normaliserSaisieContact(saisie())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.valeur.phonesJson).toBe('["+50929423848"]')
    expect(JSON.parse(r.valeur.sourceJson)).toEqual({ providedBy: 'Me Patrick Victor', providedOn: '2026-10-09', channel: 'courriel à la rédaction', evidence: null })
    expect(r.valeur.upToDateOn.toISOString()).toBe('2026-10-09T00:00:00.000Z')
  })
  it('un numéro illisible est NOMMÉ dans l’erreur', () => {
    expect(normaliserSaisieContact(saisie({ phones: ['2942-3848', '12'] }))).toEqual({ ok: false, erreurs: ['telephone:12'] })
  })
  it('fiche vide refusée ; la demande d’origine est consignée dans la source', () => {
    expect(normaliserSaisieContact(saisie({ address: null, phones: [], email: null }))).toEqual({ ok: false, erreurs: ['coordonnees'] })
    const r = normaliserSaisieContact(saisie({ requestId: 'clx0demande0001' }))
    expect(r.ok && JSON.parse(r.valeur.sourceJson).requestId).toBe('clx0demande0001')
  })
  it('source et canal obligatoires', () => {
    expect(saisieContactSchema.safeParse({ ...saisie(), providedBy: '' }).success).toBe(false)
    expect(saisieContactSchema.safeParse({ ...saisie(), channel: '' }).success).toBe(false)
  })
})
