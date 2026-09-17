/**
 * Le journal des connexions — la mise en forme partagée par l'écran et le CSV, sans base.
 */
import { describe, it, expect } from 'vitest'
import { csvConnexions, duree, lireFiltre, motifDe, verificationDe, appareilDe, PAGE_MAX, type LigneSession } from './connexions'

const ligne = (patch: Partial<LigneSession> = {}): LigneSession => ({
  id: 's1', userId: 'u1', createdAt: new Date('2026-09-16T19:49:00Z'), endedAt: new Date('2026-09-16T21:54:00Z'), endReason: 'LOGOUT', evictedById: null,
  lastSeenAt: new Date('2026-09-16T21:50:00Z'), expiresAt: new Date('2026-09-23T19:49:00Z'), ip: '190.115.0.1',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
  deviceLabel: 'Chrome 153 sur Windows', verifiedVia: 'TOTP', twoFactorVerified: true,
  user: { email: 'avocat@cabinet.ht', name: 'Me Test', role: 'PWOFESYONEL' },
  ...patch,
})

describe('lireFiltre — borné, jamais « tout »', () => {
  it('défauts : 30 jours, page 1, tous comptes, tous motifs', () => {
    expect(lireFiltre(undefined)).toEqual({ compte: null, jours: 30, motif: null, page: 1 })
  })
  it('une période inconnue retombe sur 30 ; une page hors borne est ramenée à PAGE_MAX', () => {
    expect(lireFiltre({ jours: '12' }).jours).toBe(30)
    expect(lireFiltre({ page: '99999' }).page).toBe(PAGE_MAX)
    expect(lireFiltre({ page: '-3' }).page).toBe(1)
    expect(lireFiltre({ page: 'abc' }).page).toBe(1)
  })
  it('un motif inconnu est ignoré ; EN_COURS et les huit motifs passent', () => {
    expect(lireFiltre({ motif: 'PIRATE' }).motif).toBeNull()
    expect(lireFiltre({ motif: 'EN_COURS' }).motif).toBe('EN_COURS')
    expect(lireFiltre({ motif: 'EVICTED' }).motif).toBe('EVICTED')
  })
  it('un tableau de valeurs (paramètre répété) est ignoré', () => {
    expect(lireFiltre({ compte: ['a', 'b'] }).compte).toBeNull()
  })
})

describe('le journal ne dit que ce qu’il sait', () => {
  it('une session ouverte : « en cours », pas de durée', () => {
    const l = ligne({ endedAt: null, endReason: null })
    expect(motifDe(l)).toBe('EN_COURS')
    expect(duree(l)).toBeNull()
  })
  it('une session fermée sans motif (antérieure au journal) : « fin non enregistrée »', () => {
    expect(motifDe(ligne({ endReason: null }))).toBe('INCONNU')
    expect(motifDe(ligne({ endReason: 'N_IMPORTE_QUOI' }))).toBe('INCONNU')
  })
  it('une session vérifiée sans chemin enregistré ne se dit pas « code 2FA »', () => {
    expect(verificationDe({ verifiedVia: null, twoFactorVerified: true })).toBe('INCONNUE')
    expect(verificationDe({ verifiedVia: null, twoFactorVerified: false })).toBe('NONE')
    expect(verificationDe({ verifiedVia: 'TRUSTED_DEVICE', twoFactorVerified: true })).toBe('TRUSTED_DEVICE')
  })
  it('un appareil non reconnu garde son UA brut à portée', () => {
    expect(appareilDe({ deviceLabel: null, userAgent: 'curl/8.7.1' })).toEqual({ libelle: 'Navigateur non reconnu', reconnu: false, ua: 'curl/8.7.1' })
    expect(appareilDe({ deviceLabel: 'Safari 26 sur macOS', userAgent: 'x' }).libelle).toBe('Safari 26 sur macOS')
  })
  it('durée : minutes, heures, jours', () => {
    expect(duree({ createdAt: new Date(0), endedAt: new Date(14 * 60_000) })).toBe('14 min')
    expect(duree({ createdAt: new Date(0), endedAt: new Date(125 * 60_000) })).toBe('2 h 05')
    expect(duree({ createdAt: new Date(0), endedAt: new Date((3 * 24 + 4) * 3600_000) })).toBe('3 j 4 h')
  })
})

describe('csvConnexions — Excel, Port-au-Prince, rien d’inventé', () => {
  const csv = csvConnexions('fr', [ligne(), ligne({ id: 's2', endedAt: null, endReason: null, evictedById: null })], new Map())
  it('commence par le BOM et sépare par « ; » avec CRLF', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toMatch(/\r\n/)
    expect(csv.split('\r\n')[0]).toContain('compte;role;debut (Port-au-Prince)')
  })
  it('les heures sont celles de Port-au-Prince (19:49Z → 15:49 en septembre)', () => {
    expect(csv).toContain('16 septembre 2026 à 15:49')
    expect(csv).toContain('16 septembre 2026 à 17:54')
  })
  it('la ligne ouverte n’a ni fin ni durée, et se dit « en cours »', () => {
    const ouverte = csv.split('\r\n')[2].split(';')
    expect(ouverte[3]).toBe('')
    expect(ouverte[4]).toBe('')
    expect(ouverte[5]).toBe('en cours')
  })
  it('une valeur avec « ; » ou guillemet est encadrée et échappée', () => {
    const c = csvConnexions('fr', [ligne({ deviceLabel: null, userAgent: 'Un "UA"; bizarre' })], new Map())
    expect(c).toContain('"Un ""UA""; bizarre"')
  })
  it('la session remplaçante est nommée avec son appareil et son heure', () => {
    const c = csvConnexions('fr', [ligne({ endReason: 'EVICTED', evictedById: 'nouvelle' })], new Map([['nouvelle', { deviceLabel: 'Safari 26 sur macOS', createdAt: new Date('2026-09-16T21:54:00Z') }]]))
    expect(c).toContain('nouvelle connexion;Safari 26 sur macOS · 16 septembre 2026 à 17:54')
  })
})
