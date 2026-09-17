/**
 * Sentinelles de SOURCE du journal des connexions — elles lisent le code, pas la base.
 *
 * Une session ne se supprime plus : elle se ferme, par une seule porte. Le jour où quelqu'un
 * remet un `session.delete` « pour faire simple », l'histoire d'une connexion disparaît à
 * nouveau et le journal ment par omission. Même logique que `redirect.test.ts` : la règle est
 * dans un test, pas seulement dans un commentaire.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function fichiersSource(dir: string, out: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom)
    if (statSync(chemin).isDirectory()) fichiersSource(chemin, out)
    else if (/\.(ts|tsx)$/.test(nom) && !/\.test\.tsx?$/.test(nom)) out.push(chemin)
  }
  return out
}

/** Le seul endroit qui a le droit de SUPPRIMER une session : la purge à 12 mois. */
const PURGE = 'src/app/api/cron/sessions/route.ts'

describe('une session se FERME, elle ne se supprime pas', () => {
  const sources = fichiersSource('src')
  it('aucun `session.delete` / `session.deleteMany` hors de la purge', () => {
    const fautifs = sources.filter((f) => f !== PURGE && /\bsession\.delete(Many)?\(/.test(readFileSync(f, 'utf8')))
    expect(fautifs).toEqual([])
  })
  it('les six chemins de fin passent par closeSession / closeAllSessions / closeSessionByToken', () => {
    const lire = (f: string) => readFileSync(f, 'utf8')
    expect(lire('src/app/api/auth/logout/route.ts')).toMatch(/closeSessionByToken\(token, 'LOGOUT'\)/)
    expect(lire('src/lib/auth/session.ts')).toMatch(/closeSession\(session\.id, 'EXPIRED'/)
    expect(lire('src/lib/auth/session.ts')).toMatch(/closeSession\(session\.id, 'IDLE'/)
    expect(lire('src/app/api/admin/users/route.ts')).toMatch(/closeAllSessions\(userId, 'SUSPENDED'\)/)
    expect(lire('src/app/api/admin/users/route.ts')).toMatch(/closeAllSessions\(userId, 'TWOFA_RESET'\)/)
    expect(lire('src/app/api/auth/reset/route.ts')).toMatch(/closeAllSessions\(user\.id, 'PASSWORD_RESET'\)/)
  })
  it('une ligne fermée n’authentifie plus jamais — loadSession la refuse avant toute autre règle', () => {
    const src = readFileSync('src/lib/auth/session.ts', 'utf8')
    const refus = src.indexOf('if (session.endedAt) return null')
    const expiration = src.indexOf("closeSession(session.id, 'EXPIRED'")
    expect(refus).toBeGreaterThan(-1)
    expect(refus).toBeLessThan(expiration)
  })
  it('la première fin fait foi : closeSession n’écrit que sur une ligne encore ouverte', () => {
    const src = readFileSync('src/lib/auth/session.ts', 'utf8')
    expect(src).toMatch(/where: \{ id, endedAt: null \}/)
  })
  it('l’appareil se décrit à la création, jamais ailleurs', () => {
    const src = readFileSync('src/lib/auth/session.ts', 'utf8')
    expect(src).toMatch(/deviceLabel: appareil\.reconnu \? appareil\.libelle : null/)
    // On cherche une ÉCRITURE (`data: { … deviceLabel: … }`), pas une sélection ni un type.
    const ailleurs = sources.filter((f) => f !== 'src/lib/auth/session.ts' && /data:\s*\{[^}]*\bdeviceLabel:/s.test(readFileSync(f, 'utf8')))
    expect(ailleurs).toEqual([])
  })
})

describe('une seule connexion par compte — les DEUX chemins de vérification, et eux seuls', () => {
  const service = readFileSync('src/lib/auth/service.ts', 'utf8')
  it('la connexion par appareil de confiance impose la session unique', () => {
    const i = service.indexOf('twoFactorVerified: true })')
    const j = service.indexOf('apresVerification(user, session.id, ctx)')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
  })
  it('la validation du code TOTP impose la session unique', () => {
    expect(service).toMatch(/markTwoFactorVerified\(sessionId\)[\s\S]*apresVerification\(compte, sessionId, ctx\)/)
  })
  it('une session en attente de 2FA n’évince rien : pas d’appel sur le chemin « pending2fa »', () => {
    const pending = service.indexOf("meta: { pending2fa: true }")
    const suite = service.slice(pending, pending + 200)
    expect(suite).not.toMatch(/apresVerification/)
  })
  it('l’éviction est sérialisée par un verrou consultatif de transaction, par compte', () => {
    const session = readFileSync('src/lib/auth/session.ts', 'utf8')
    expect(session).toMatch(/\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\(\$\{userId\}\)\)`/)
  })
  it('l’e-mail au titulaire ne part que si une session VIVANTE a été coupée', () => {
    expect(service).toMatch(/fermetures\.some\(\(f\) => f\.reason === 'EVICTED' && f\.vivante\)/)
  })
})

describe('le navigateur évincé apprend pourquoi — et rien de plus', () => {
  it('la page de connexion lit la LIGNE, et ne prend de l’URL que « inactivite »', () => {
    const page = readFileSync('src/app/[locale]/(auth)/login/page.tsx', 'utf8')
    expect(page).toMatch(/lireFinDeSession\(\)/)
    const avis = readFileSync('src/components/AvisSession.tsx', 'utf8')
    const lecturesUrl = [...avis.matchAll(/motifUrl === '([^']+)'/g)].map((m) => m[1])
    expect(lecturesUrl).toEqual(['inactivite'])
  })
  it('l’avis « nouvelle connexion » nomme l’appareil, jamais l’adresse IP', () => {
    const avis = readFileSync('src/components/AvisSession.tsx', 'utf8')
    expect(avis).toMatch(/deviceLabel/)
    expect(avis).not.toMatch(/\.ip\b/)
  })
  it('le heartbeat répond le motif, et IdleTimer le lit (401 → départ)', () => {
    expect(readFileSync('src/app/api/auth/heartbeat/route.ts', 'utf8')).toMatch(/motif: fin\?\.reason \?\? 'session'/)
    const idle = readFileSync('src/components/IdleTimer.tsx', 'utf8')
    expect(idle).toMatch(/res\.status === 401\) evince\(\)/)
    expect(idle).not.toMatch(/timeout=1/)
  })
})

describe('le journal du master admin — deux gardes par écran, heures de Port-au-Prince', () => {
  it('la page /admin/connexions est gardée par requireAdmin, ses routes par requireAdminApi', () => {
    expect(readFileSync('src/app/[locale]/admin/connexions/page.tsx', 'utf8')).toMatch(/await requireAdmin\(locale\)/)
    for (const r of ['close', 'export']) {
      const src = readFileSync(`src/app/api/admin/connexions/${r}/route.ts`, 'utf8')
      expect(src, r).toMatch(/await requireAdminApi\(\)/)
      expect(src, r).toMatch(/if \(!admin\) return apiError\('forbidden', 403\)/)
    }
  })
  it('les écrans d’instants n’emploient jamais formatDate (UTC)', () => {
    for (const f of ['src/app/[locale]/admin/connexions/page.tsx', 'src/app/[locale]/admin/logs/page.tsx', 'src/lib/admin/connexions.ts', 'src/components/AvisSession.tsx']) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).toMatch(/formatInstant/)
      expect(src, f).not.toMatch(/\bformatDate\(/)
    }
  })
  it('la fermeture par l’admin se signe : SESSION_CLOSED_BY_ADMIN avec l’admin en acteur', () => {
    const src = readFileSync('src/app/api/admin/connexions/close/route.ts', 'utf8')
    expect(src).toMatch(/closeSession\(cible\.id, 'ADMIN'\)/)
    expect(src).toMatch(/action: 'SESSION_CLOSED_BY_ADMIN', actorId: admin\.id, targetType: 'SESSION', targetId: cible\.id/)
  })
  it('l’export est borné et journalisé', () => {
    const src = readFileSync('src/app/api/admin/connexions/export/route.ts', 'utf8')
    expect(src).toMatch(/lignes\.length < PAGE_MAX \* PAR_PAGE/)
    expect(src).toMatch(/action: 'EXPORT'/)
    expect(src).toMatch(/guard\(/)
  })
})
