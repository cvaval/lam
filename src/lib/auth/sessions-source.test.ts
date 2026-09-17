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
    const ailleurs = sources.filter((f) => f !== 'src/lib/auth/session.ts' && /deviceLabel:\s/.test(readFileSync(f, 'utf8')))
    expect(ailleurs).toEqual([])
  })
})
