import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { FRISE_IMAGE, pageAvecFrise } from './frise'

/**
 * Frise des monuments au bas des pages (Me Vaval, 9 oct. 2026) : partout, SAUF l'accueil (frise
 * du héros), la connexion et la demande de coordonnées d'un notaire, qui ont la leur — jamais deux
 * frises sur une même page.
 */
let chemin = '/fr/cgu'
vi.mock('next/navigation', () => ({ usePathname: () => chemin }))
const { CadreAvecFrise } = await import('@/components/CadreAvecFrise')

describe('pages qui reçoivent la frise commune', () => {
  it('toutes les pages internes, publiques, connectées ou d’administration', () => {
    for (const c of ['/fr/juridictions', '/en/juridictions/notaires', '/ht/juridictions/notaires/mjsp-2026-09-08-11', '/fr/cgu',
      '/fr/fetes-legales', '/fr/register', '/fr/dashboard', '/fr/search', '/fr/doc/abc', '/fr/admin', '/fr/admin/notaires/demandes']) {
      expect(pageAvecFrise(c), c).toBe(true)
    }
  })
  it('pas l’accueil, ni la connexion, ni la demande de coordonnées (elles ont leur propre frise)', () => {
    for (const c of ['/', '/fr', '/en/', '/ht', '/fr/login', '/en/login/', '/fr/juridictions/notaires/demande', null, undefined, '']) {
      expect(pageAvecFrise(c as string), String(c)).toBe(false)
    }
  })
})

describe('le composant', () => {
  it('ajoute une bande décorative (aria-hidden, sans clic, masquée à l’impression) avec l’image de la frise', () => {
    chemin = '/fr/cgu'
    const html = renderToStaticMarkup(<CadreAvecFrise><div className="min-h-screen">page</div></CadreAvecFrise>)
    expect(html).toContain('<div class="min-h-screen">page</div><div aria-hidden="true"')
    // ⚠️ Ne jamais écrire ici une classe d'image de fond : Tailwind lit aussi les tests et en ferait
    // une vraie règle CSS, dont l'URL invalide casse la compilation.
    expect(html).toContain(FRISE_IMAGE)
    expect(html).toMatch(/pointer-events-none[^"]*print:hidden/)
    // Ligne de sol au bord inférieur : positions calculées sur le dessin (-91 px / -63 px).
    expect(html).toContain('bg-[position:center_bottom_-91px]')
    expect(html).toContain('max-sm:bg-[position:center_bottom_-63px]')
  })
  it('sur l’accueil : la page, telle quelle, sans enveloppe ni frise', () => {
    chemin = '/fr'
    expect(renderToStaticMarkup(<CadreAvecFrise><main>accueil</main></CadreAvecFrise>)).toBe('<main>accueil</main>')
  })
  it('l’image existe dans public/', () => {
    expect(readFileSync(resolve(__dirname, '../..', `public${FRISE_IMAGE}`)).length).toBeGreaterThan(10_000)
  })
})
