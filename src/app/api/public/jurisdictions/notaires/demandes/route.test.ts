/**
 * Le formulaire des TIERS (chantier D) — route exécutée pour de vrai, Prisma, freins, journal et
 * courriel simulés. Ce qui est protégé :
 *  1. fermé par défaut : 404, rien n'est lu ;
 *  2. le piège répond « envoyée » SANS rien enregistrer ni écrire à personne ;
 *  3. la demande est ENREGISTRÉE avant le courriel ; un courriel en échec n'empêche rien ;
 *  4. le courriel part vers l'adresse FIXE de la rédaction, jamais vers le demandeur ;
 *  5. au-delà de 30 demandes par jour, plus qu'UN courriel de volume ;
 *  6. l'audit ne contient pas le contenu de la demande.
 */
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = {
  judicialCommune: { findMany: vi.fn() },
  notary: { findFirst: vi.fn() },
  notaryRequest: { create: vi.fn(), count: vi.fn(), update: vi.fn() },
}
const audit = vi.fn()
const guard = vi.fn()
const guardPersistent = vi.fn()
const sendMail = vi.fn()

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/auth/audit', () => ({ audit }))
vi.mock('@/lib/security/ratelimit', () => ({ guard, guardPersistent }))
vi.mock('@/lib/mail', async (orig) => ({ ...(await orig<typeof import('@/lib/mail')>()), sendMail }))

const { POST } = await import('./route')

const champs = (o: Record<string, string> = {}) => ({
  locale: 'fr', t: String(Date.now() - 60_000), site: '', type: 'coordonnees', notaire: 'mjsp-2026-09-08-9',
  nom: 'Gemma Anglade Gilles', qualite: 'NOTAIRE', telephones: '+509 2998-47-47', courrielContact: 'demandeur@exemple.ht',
  consentement: 'oui', ...o,
})
const envoyer = (c: Record<string, string>, accept?: string) =>
  POST(new NextRequest('https://agora.ht/api/public/jurisdictions/notaires/demandes', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-forwarded-for': '203.0.113.7', ...(accept ? { accept } : {}) },
    body: new URLSearchParams(c).toString(),
  }))

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NOTARY_REQUESTS_ENABLED', 'true')
  vi.stubEnv('NOTARY_REQUEST_ALERT_TO', '')
  prisma.judicialCommune.findMany.mockResolvedValue([{ id: 'commune-ouest-port-au-prince', name: 'Port-au-Prince' }])
  prisma.notary.findFirst.mockResolvedValue({ id: 'mjsp-2026-09-08-9', fullName: 'Gamma ANGLADE GILLES', displayName: 'Gemma ANGLADE GILLES' })
  prisma.notaryRequest.create.mockResolvedValue({ id: 'clx0demande0000001', createdAt: new Date('2026-10-09T15:00:00Z') })
  prisma.notaryRequest.count.mockResolvedValue(1)
  guard.mockResolvedValue(true)
  guardPersistent.mockResolvedValue({ ok: true })
  sendMail.mockResolvedValue(true)
})
afterEach(() => { vi.unstubAllEnvs() })

describe('formulaire des tiers', () => {
  it('FERMÉ par défaut : 404 sans rien lire', async () => {
    vi.stubEnv('NOTARY_REQUESTS_ENABLED', '')
    const res = await envoyer(champs())
    expect(res.status).toBe(404)
    expect(prisma.judicialCommune.findMany).not.toHaveBeenCalled()
  })

  it('demande valide : enregistrée, auditée SANS contenu, courriel à legal@agora.ht seulement, 303 « envoyée »', async () => {
    const res = await envoyer(champs())
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://agora.ht/fr/juridictions/notaires/demande?envoyee=1')

    const data = prisma.notaryRequest.create.mock.calls[0][0].data
    expect(data).toMatchObject({ kind: 'CONTACT', notaryId: 'mjsp-2026-09-08-9', requesterEmail: 'demandeur@exemple.ht', locale: 'fr' })
    expect(JSON.parse(data.payloadJson).phones).toEqual(['+50929984747'])

    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'NOTARY_REQUEST_CREATED', targetId: 'clx0demande0000001', meta: { kind: 'CONTACT' } }))
    expect(JSON.stringify(audit.mock.calls)).not.toContain('demandeur@exemple.ht')

    expect(sendMail).toHaveBeenCalledTimes(1)
    const mail = sendMail.mock.calls[0][0]
    expect(mail.to).toBe('legal@agora.ht')
    expect(JSON.stringify(mail)).not.toContain('demandeur@exemple.ht')
    expect(mail.text).toContain('/fr/admin/notaires/demandes/clx0demande0000001')
    expect(prisma.notaryRequest.update).toHaveBeenCalledWith({ where: { id: 'clx0demande0000001' }, data: { notifiedAt: expect.any(Date) } })
  })

  it('le piège : même réponse, RIEN d’enregistré, aucun courriel', async () => {
    const res = await envoyer(champs({ site: 'http://spam.example' }))
    expect(res.headers.get('location')).toMatch(/envoyee=1$/)
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('saisie invalide : retour au formulaire avec les champs à reprendre, le notaire gardé', async () => {
    const res = await envoyer(champs({ telephones: '12', consentement: '' }))
    expect(res.headers.get('location')).toBe('https://agora.ht/fr/juridictions/notaires/demande?erreur=telephones,consentement&notaire=mjsp-2026-09-08-9')
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
  })

  it('frein persistant par IP : rien d’enregistré, alerte de scraping', async () => {
    guardPersistent.mockResolvedValue({ ok: false })
    const res = await envoyer(champs())
    expect(res.headers.get('location')).toContain('erreur=frein')
    expect(prisma.notaryRequest.create).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ action: 'SCRAPING_ALERT' }))
  })

  it('courriel en échec : la demande reste enregistrée, `notifiedAt` vide, même confirmation', async () => {
    sendMail.mockResolvedValue(false)
    const res = await envoyer(champs())
    expect(res.headers.get('location')).toMatch(/envoyee=1$/)
    expect(prisma.notaryRequest.create).toHaveBeenCalled()
    expect(prisma.notaryRequest.update).not.toHaveBeenCalled()
  })

  it('au-delà de 30 par jour : la 31ᵉ déclenche UN courriel de volume, la 32ᵉ plus rien — toutes enregistrées', async () => {
    prisma.notaryRequest.count.mockResolvedValue(31)
    await envoyer(champs())
    expect(sendMail).toHaveBeenCalledTimes(1)
    expect(sendMail.mock.calls[0][0].subject).toMatch(/volume|31/i)
    sendMail.mockClear()
    prisma.notaryRequest.count.mockResolvedValue(32)
    await envoyer(champs())
    expect(sendMail).not.toHaveBeenCalled()
    expect(prisma.notaryRequest.create).toHaveBeenCalledTimes(2)
  })

  it('notaire inconnu ou retiré : la demande garde le seul nom saisi', async () => {
    prisma.notary.findFirst.mockResolvedValue(null)
    await envoyer(champs({ nomNotaire: 'Gemma Anglade' }))
    expect(prisma.notaryRequest.create.mock.calls[0][0].data.notaryId).toBeNull()
  })

  it('avec JavaScript (Accept JSON) : erreurs en JSON, saisie gardée à l’écran ; succès et piège répondent pareil', async () => {
    const invalide = await envoyer(champs({ telephones: '12' }), 'application/json')
    expect(invalide.status).toBe(422)
    expect(await invalide.json()).toEqual({ ok: false, erreurs: ['telephones'] })
    const ok = await envoyer(champs(), 'application/json')
    expect(await ok.json()).toEqual({ ok: true })
    const piege = await envoyer(champs({ site: 'x' }), 'application/json')
    expect(await piege.json()).toEqual({ ok: true })
    expect(prisma.notaryRequest.create).toHaveBeenCalledTimes(1)
  })

  it('table absente (code déployé avant la migration) : retour « indisponible », pas de 500', async () => {
    prisma.notaryRequest.create.mockRejectedValue(Object.assign(new Error('missing'), { code: 'P2021' }))
    const res = await envoyer(champs())
    expect(res.headers.get('location')).toContain('erreur=indisponible')
  })
})
