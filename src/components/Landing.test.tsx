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

  /**
   * ⚠️ **L'ACTION DU FORMULAIRE A CHANGÉ LE 20 AOÛT 2026.** La bande calcule désormais sur
   * place et affiche la date (Me Vaval : « le portail public doit uniquement afficher la
   * date […] pas besoin de rediriger l'utilisateur vers une autre page ») : son `GET` revient
   * sur l'ACCUEIL avec `?d=…&n=…`, il ne part plus vers `/fr/delais`. Le calcul, lui, est fait
   * par la page — c'est ce qui permet à `Landing` de rester SYNCHRONE, objet de ce fichier.
   */
  it('la bande des délais y est, avec ses deux champs et son bouton', () => {
    expect(html).toContain('action="/fr"')
    expect(html).not.toContain('action="/fr/delais"')
    expect(html).toContain('name="d"')
    expect(html).toContain('name="n"')
  })

  /** Sans `delais`, la bande n'affiche AUCUNE date : l'accueil n'a pas d'état vide à meubler. */
  it('… et aucune date tant que rien n’a été soumis', () => {
    expect(html).not.toContain('Date limite')
    expect(html).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('et elle ne lit toujours pas la base : aucune entrée du répertoire dans l’accueil', () => {
    expect(html).not.toContain('Entrée du répertoire')
    expect(html).not.toContain('Voir tout le répertoire')
    expect(html).not.toContain('<select')
  })
})
