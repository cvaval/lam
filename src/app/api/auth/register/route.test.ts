/**
 * Inscription — l'ORDRE des opérations.
 *
 * Ce contrôle est STRUCTUREL, non comportemental : il lit le fichier source. C'est assumé,
 * parce que l'invariant à protéger est un ordre d'exécution, et qu'un test de comportement
 * exigerait de simuler Prisma et bcrypt — au risque de vérifier la simulation plutôt que la
 * route. Ce qu'il empêche : qu'on remette un jour le hachage avant le frein.
 *
 * Motif — audit du 16 août 2026 : cette route était la seule route publique sans limite.
 * bcrypt(11) est délibérément coûteux ; l'offrir à l'anonyme en fait une arme.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REGISTER_LIMITS } from '@/lib/security/ratelimit'

const SRC = readFileSync('src/app/api/auth/register/route.ts', 'utf8')

describe('inscription : le frein précède le coût', () => {
  it('les deux freins sont posés', () => {
    expect(SRC).toContain('guard(')
    expect(SRC).toContain('guardPersistent(')
  })

  it('le hachage vient APRÈS les deux freins', () => {
    const memoire = SRC.indexOf('guard({')
    const persistant = SRC.indexOf('guardPersistent(')
    const hachage = SRC.indexOf('hashPassword(')
    expect(memoire).toBeGreaterThan(-1)
    expect(persistant).toBeGreaterThan(-1)
    expect(hachage).toBeGreaterThan(persistant)
    expect(persistant).toBeGreaterThan(memoire)
  })

  it('le refus est un 429 porteur de Retry-After', () => {
    expect(SRC).toContain('429')
    expect(SRC).toContain('Retry-After')
  })

  it('la réponse ne révèle toujours pas l’existence d’un compte', () => {
    // Même corps rendu que l'adresse existe ou non : la garde ne doit pas avoir
    // introduit un canal d'énumération.
    expect(SRC).toContain('Réponse identique')
    expect(SRC.match(/NextResponse\.json\(\{ ok: true \}\)/g)?.length).toBe(1)
  })
})

describe('seuils d’inscription', () => {
  it('sont plus larges que l’usage humain et plus serrés qu’un script', () => {
    // Pic historique mesuré en production le 17 août 2026 : 1 par heure et par adresse.
    expect(REGISTER_LIMITS.heure.limit).toBeGreaterThanOrEqual(3)
    expect(REGISTER_LIMITS.heure.limit).toBeLessThanOrEqual(10)
    expect(REGISTER_LIMITS.jour.limit).toBeGreaterThan(REGISTER_LIMITS.heure.limit)
    expect(REGISTER_LIMITS.heure.windowMs).toBe(3_600_000)
    expect(REGISTER_LIMITS.jour.windowMs).toBe(86_400_000)
  })
})
