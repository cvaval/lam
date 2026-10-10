import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { JOURS_NOUVEAUTE, debutNouveautes, estNouveau } from './nouveautes'

const JOUR = 86400_000
const MAINTENANT = Date.UTC(2026, 9, 9, 12)
const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('nouveauté = document AJOUTÉ récemment (Me Vaval, 9 oct. 2026)', () => {
  it('fenêtre de 15 jours, commune au tableau de bord et aux rubriques', () => {
    expect(JOURS_NOUVEAUTE).toBe(15)
    expect(debutNouveautes(MAINTENANT).getTime()).toBe(MAINTENANT - 15 * JOUR)
  })

  it('un document ajouté il y a 14 jours est nouveau ; à 16 jours, il ne l’est plus', () => {
    expect(estNouveau({ createdAt: new Date(MAINTENANT - 14 * JOUR) }, MAINTENANT)).toBe(true)
    expect(estNouveau({ createdAt: new Date(MAINTENANT - 16 * JOUR) }, MAINTENANT)).toBe(false)
  })

  it('un texte ancien MODIFIÉ hier n’est pas nouveau : seule la date d’ajout compte', () => {
    const circulaireRetouchee = { createdAt: new Date(MAINTENANT - 400 * JOUR), updatedAt: new Date(MAINTENANT - JOUR) }
    expect(estNouveau(circulaireRetouchee, MAINTENANT)).toBe(false)
  })

  it('la pastille « Nouveau » des rubriques lit createdAt, jamais updatedAt', () => {
    const themes = src('src/lib/legislation/themes.ts')
    const corps = themes.slice(themes.indexOf('export async function navigationThemes'), themes.indexOf('// ─────────────────────────── Gestion'))
    expect(corps).toContain('debutNouveautes()')
    expect(corps).toContain('document: { select: { createdAt: true } }')
    expect(corps).toContain('l.document.createdAt >= cutoff')
    expect(corps).not.toMatch(/updatedAt\s*>=\s*cutoff/)
  })

  it('le tableau de bord prend la même fenêtre', () => {
    expect(src('src/app/[locale]/(app)/dashboard/page.tsx')).toContain('debutNouveautes()')
  })
})
