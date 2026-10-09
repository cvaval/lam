/**
 * Vérification humaine (Turnstile). Ce qui est protégé :
 *  - une réponse de Cloudflare se lit STRICTEMENT : action, hôte, âge du jeton ;
 *  - un jeton absent ou trop long ne part même pas chez Cloudflare ;
 *  - Cloudflare injoignable → refus (« indisponible »), une seule nouvelle tentative ;
 *  - en production Vercel, des clés de test valent des clés absentes ;
 *  - la CSP ne s'ouvre à Cloudflare que sur la page du formulaire, et `connect-src` jamais ;
 *  - toute route publique de demande appelle `verifierHumain` (sentinelle : le futur
 *    formulaire des avocats ne pourra pas l'oublier).
 */
import { describe, expect, it, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  HOTES_PRODUCTION, SITEVERIFY_URL, TURNSTILE_ORIGIN, clesTurnstile, estCleDeTest, jetonConsomme, langueTurnstile,
  lireReponseSiteverify, pageAvecVerificationHumaine, verifierHumain,
} from './turnstile'
import { buildCsp } from '../../middleware'

const NOW = Date.parse('2026-10-09T20:00:00Z')
const attendu = { action: 'notary-request', hotes: HOTES_PRODUCTION, maintenant: NOW, controles: true }
const ok = (o: Record<string, unknown> = {}) => ({
  success: true, action: 'notary-request', hostname: 'agora.ht', challenge_ts: new Date(NOW - 20_000).toISOString(), 'error-codes': [], ...o,
})
const PROD_KEYS = { TURNSTILE_SITE_KEY: '0x4AAAAAAAvraiecle', TURNSTILE_SECRET_KEY: '0x4AAAAAAAvraisecret' }
const TEST_KEYS = { TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' }

describe('lecture de la réponse de siteverify', () => {
  it('succès : date du défi conservée', () => {
    const r = lireReponseSiteverify(ok(), attendu)
    expect(r).toEqual({ ok: true, verifieLe: new Date(NOW - 20_000) })
  })
  it('mauvaise action, hôte étranger, jeton trop vieux → refus', () => {
    expect(lireReponseSiteverify(ok({ action: 'contact' }), attendu)).toMatchObject({ ok: false, motif: 'action' })
    expect(lireReponseSiteverify(ok({ hostname: 'agora.ht.evil.example' }), attendu)).toMatchObject({ ok: false, motif: 'hote' })
    expect(lireReponseSiteverify(ok({ challenge_ts: new Date(NOW - 301_000).toISOString() }), attendu)).toMatchObject({ ok: false, motif: 'expire' })
    expect(lireReponseSiteverify(ok({ challenge_ts: 'n’importe quoi' }), attendu)).toMatchObject({ ok: false, motif: 'expire' })
  })
  it('codes d’erreur de Cloudflare rangés en motifs', () => {
    const echec = (c: string) => lireReponseSiteverify({ success: false, 'error-codes': [c] }, attendu)
    expect(echec('timeout-or-duplicate')).toMatchObject({ motif: 'expire', codes: ['timeout-or-duplicate'] })
    expect(echec('internal-error')).toMatchObject({ motif: 'indisponible' })
    expect(echec('invalid-input-secret')).toMatchObject({ motif: 'configuration' })
    expect(echec('missing-input-response')).toMatchObject({ motif: 'absent' })
    expect(echec('invalid-input-response')).toMatchObject({ motif: 'invalide' })
    expect(lireReponseSiteverify(null, attendu)).toMatchObject({ ok: false, motif: 'invalide' })
  })
  it('clé secrète de test : ni action ni hôte contrôlés (réponses factices de Cloudflare)', () => {
    expect(lireReponseSiteverify({ success: true, hostname: 'example.com' }, { ...attendu, controles: false }).ok).toBe(true)
  })
  it('en production, une réponse obtenue avec une clé de TEST est refusée (la clé `1x…AA` accepte n’importe quel jeton)', () => {
    const factice = { success: true, challenge_ts: new Date(NOW).toISOString(), hostname: 'example.com', 'error-codes': [], metadata: { result_with_testing_key: true } }
    expect(lireReponseSiteverify(factice, { ...attendu, controles: false, refuserTest: true })).toMatchObject({ ok: false, motif: 'configuration', codes: ['testing-key'] })
    expect(lireReponseSiteverify(factice, { ...attendu, controles: false }).ok).toBe(true)
  })
})

describe('clés', () => {
  it('reconnaît les clés de test de Cloudflare, pas les vraies', () => {
    expect(estCleDeTest('1x00000000000000000000AA')).toBe(true)
    expect(estCleDeTest('3x00000000000000000000FF')).toBe(true)
    expect(estCleDeTest('2x0000000000000000000000000000000AA')).toBe(true)
    expect(estCleDeTest('0x4AAAAAAAFStXmyx7SPu_0O4')).toBe(false)
  })
  it('une clé manquante → null ; en production Vercel, des clés de test → null ; ailleurs, acceptées', () => {
    expect(clesTurnstile({})).toBeNull()
    expect(clesTurnstile({ TURNSTILE_SITE_KEY: 'x' })).toBeNull()
    expect(clesTurnstile({ ...TEST_KEYS, VERCEL_ENV: 'production' })).toBeNull()
    expect(clesTurnstile({ ...TEST_KEYS })).toEqual({ siteKey: TEST_KEYS.TURNSTILE_SITE_KEY, secretKey: TEST_KEYS.TURNSTILE_SECRET_KEY })
    expect(clesTurnstile({ ...PROD_KEYS, VERCEL_ENV: 'production' })).not.toBeNull()
  })
  it('langue : français sur /ht (le créole n’est pas pris en charge par Turnstile)', () => {
    expect([langueTurnstile('fr'), langueTurnstile('en'), langueTurnstile('ht')]).toEqual(['fr', 'en', 'fr'])
  })
})

describe('appel à Cloudflare', () => {
  const reponse = (json: unknown, status = 200) => ({ status, json: async () => json }) as Response
  const deps = (f: ReturnType<typeof vi.fn>, env: Record<string, string> = PROD_KEYS) => ({ fetch: f as unknown as typeof fetch, env, maintenant: () => NOW })

  it('jeton absent ou trop long : aucun appel', async () => {
    const f = vi.fn()
    expect(await verifierHumain({ jeton: '', ip: '1.2.3.4', action: 'notary-request' }, deps(f))).toMatchObject({ ok: false, motif: 'absent' })
    expect(await verifierHumain({ jeton: 'x'.repeat(2049), ip: null, action: 'notary-request' }, deps(f))).toMatchObject({ ok: false, motif: 'invalide' })
    expect(f).not.toHaveBeenCalled()
  })
  it('clés absentes : refus « configuration », aucun appel', async () => {
    const f = vi.fn()
    expect(await verifierHumain({ jeton: 'abc', ip: null, action: 'notary-request' }, deps(f, {}))).toMatchObject({ ok: false, motif: 'configuration' })
    expect(f).not.toHaveBeenCalled()
  })
  it('POST formulaire vers siteverify : secret, jeton, IP, clé d’idempotence', async () => {
    const f = vi.fn().mockResolvedValue(reponse(ok()))
    const r = await verifierHumain({ jeton: 'jeton-1', ip: '203.0.113.7', action: 'notary-request' }, deps(f))
    expect(r.ok).toBe(true)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe(SITEVERIFY_URL)
    const corps = new URLSearchParams(init.body)
    expect(corps.get('secret')).toBe(PROD_KEYS.TURNSTILE_SECRET_KEY)
    expect(corps.get('response')).toBe('jeton-1')
    expect(corps.get('remoteip')).toBe('203.0.113.7')
    expect(corps.get('idempotency_key')).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('réseau ou internal-error : UNE nouvelle tentative, même clé d’idempotence, puis « indisponible »', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce(reponse({ success: false, 'error-codes': ['internal-error'] }))
    const r = await verifierHumain({ jeton: 'jeton-2', ip: null, action: 'notary-request' }, deps(f))
    expect(r).toMatchObject({ ok: false, motif: 'indisponible' })
    expect(f).toHaveBeenCalledTimes(2)
    const cle = (i: number) => new URLSearchParams(f.mock.calls[i][1].body).get('idempotency_key')
    expect(cle(0)).toBe(cle(1))
  })
  it('un refus net ne se retente pas', async () => {
    const f = vi.fn().mockResolvedValue(reponse({ success: false, 'error-codes': ['invalid-input-response'] }))
    await verifierHumain({ jeton: 'jeton-3', ip: null, action: 'notary-request' }, deps(f))
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('jeton consommé : oui dès qu’il a été présenté', () => {
    expect(jetonConsomme({ ok: false, motif: 'absent', codes: [] })).toBe(false)
    expect(jetonConsomme({ ok: false, motif: 'invalide', codes: [] })).toBe(true)
    expect(jetonConsomme({ ok: true, verifieLe: new Date() })).toBe(true)
  })
})

describe('CSP', () => {
  it('la page du formulaire, et elle seule, reçoit Cloudflare', () => {
    expect(pageAvecVerificationHumaine('/fr/juridictions/notaires/demande')).toBe(true)
    expect(pageAvecVerificationHumaine('/ht/juridictions/notaires/demande/')).toBe(true)
    expect(pageAvecVerificationHumaine('/fr/juridictions/notaires')).toBe(false)
    expect(pageAvecVerificationHumaine('/fr/juridictions/notaires/demande-x')).toBe(false)
    expect(pageAvecVerificationHumaine('/fr/login')).toBe(false)
  })
  it('script-src et frame-src s’ouvrent à challenges.cloudflare.com ; connect-src reste « self »', () => {
    const directive = (csp: string, nom: string) => csp.split('; ').find((d) => d.startsWith(`${nom} `)) ?? ''
    const avec = buildCsp('n0nce', { turnstile: true })
    const sans = buildCsp('n0nce')
    expect(directive(avec, 'script-src')).toContain(TURNSTILE_ORIGIN)
    expect(directive(avec, 'frame-src')).toContain(TURNSTILE_ORIGIN)
    expect(directive(avec, 'connect-src')).toBe("connect-src 'self'")
    expect(sans).not.toContain(TURNSTILE_ORIGIN)
    expect(directive(avec, 'script-src')).toContain("'nonce-n0nce'")
  })
})

describe('sentinelle : toute route publique de demande vérifie que c’est une personne', () => {
  const racine = resolve(__dirname, '../../app/api/public')
  const routes: string[] = []
  const parcourir = (dir: string) => {
    for (const nom of readdirSync(dir)) {
      const p = join(dir, nom)
      if (statSync(p).isDirectory()) parcourir(p)
      else if (nom === 'route.ts' && /\/demandes?[^/]*\//.test(p)) routes.push(p)
    }
  }
  parcourir(racine)
  it('au moins la route des notaires est trouvée', () => {
    expect(routes.some((r) => r.includes('notaires/demandes'))).toBe(true)
  })
  it.each(routes.map((r) => [r.slice(racine.length)]))('%s appelle verifierHumain', (r) => {
    expect(readFileSync(join(racine, r), 'utf8')).toMatch(/verifierHumain\(/)
  })
})
