/**
 * L'ACCUEIL PUBLIC — **et le fait qu'il soit SYNCHRONE.**
 *
 * ⚠️ Pourquoi ce contrôle existe. `Landing` avait gagné un `async` pendant que la bande des
 * délais lisait encore la base pour peupler un menu du répertoire. Ce menu a disparu — la
 * bande n'offre plus que la date de réception et le nombre de jours francs —, le commentaire
 * du fichier l'écrit noir sur blanc (« elle est redevenue un composant SYNCHRONE »), mais
 * l'`async` était resté : une fonction sans le moindre `await`, qui faisait quand même de
 * l'accueil une frontière asynchrone. Rien ne le signalait — `@types/react` 18.3.31 accepte un
 * composant asynchrone en JSX, donc le typecheck restait vert —, et cela contredisait la
 * convention que la refonte documente deux fois par ailleurs.
 *
 * `renderToStaticMarkup` est le juge naturel : il rend un composant, pas une promesse. Si
 * `Landing` redevenait `async`, ce fichier échouerait.
 *
 * `LocaleSwitcher` appelle `usePathname`/`useRouter` : hors d'un routeur Next, ces crochets
 * lèvent. On les simule — c'est le seul décor nécessaire, et il ne touche pas au sujet.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'

vi.mock('next/navigation', () => ({
  usePathname: () => '/fr',
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}))

const { Landing } = await import('./Landing')

describe('l’accueil se rend sans être attendu', () => {
  const html = renderToStaticMarkup(<Landing locale="fr" t={getDictionary('fr')} />)

  it('le rendu est une CHAÎNE, pas une promesse : la fonction est synchrone', () => {
    expect(typeof html).toBe('string')
    expect(html).not.toContain('[object Promise]')
    expect(html.length).toBeGreaterThan(1000)
  })

  it('presents the judicial map without exposing document search or deadline forms', () => {
    expect(html).toContain('href="/fr/juridictions"')
    expect(html).toContain('La justice en Haïti,')
    expect(html).not.toContain('<form')
    expect(html).not.toContain('/fr/search')
    expect(html).not.toContain('/fr/editionsmoniteur')
    expect(html).not.toContain('name="q"')
    expect(html).not.toContain('name="d"')
  })

  it('provides a secure entry through sign-in', () => {
    expect(html).toContain('href="/fr/login"')
    expect(html).toContain('Accès sécurisé')
  })
})
