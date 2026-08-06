import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Garde-fou de source : après un changement d'identité, on ne navigue jamais en douceur.
 *
 * Le cache de routeur de Next conserve côté client la charge déjà rendue des segments
 * visités. Une navigation douce (`router.push`) la ressert sans repasser par le serveur :
 * qui se déconnecte puis se reconnecte avec un autre compte revoit le tableau de bord du
 * compte précédent. Le défaut s'est produit deux fois — d'abord sur la déconnexion par
 * inactivité, corrigée seule ; puis sur le bouton de déconnexion et sur la connexion.
 *
 * Ce test lit le SOURCE des composants d'authentification : il échoue si l'un d'eux
 * revient à `router.push` / `router.replace`. Un test de rendu ne verrait rien — le défaut
 * n'est pas dans ce que le composant affiche, mais dans la façon dont il quitte la page.
 */
const RACINE = join(__dirname, '..', '..', 'components')

/** Composants qui font basculer l'identité ou les droits. */
const BASCULES = ['TopBar', 'LoginForm', 'VerifyForm', 'ResetForm', 'IdleTimer'] as const

const source = (nom: string) => readFileSync(join(RACINE, `${nom}.tsx`), 'utf8')

describe('bascule d’identité — navigation dure obligatoire', () => {
  it.each(BASCULES)('%s ne navigue pas en douceur', (nom) => {
    const s = source(nom)
    const doux = [...s.matchAll(/router\.(push|replace)\s*\(([^)]*)\)/g)].map((m) => m[0])
    expect(doux, `${nom} : navigation douce après un changement d’identité — utiliser hardRedirect`).toEqual([])
  })

  it.each(BASCULES)('%s passe par hardRedirect', (nom) => {
    expect(source(nom)).toMatch(/hardRedirect\s*\(/)
  })

  it('hardRedirect est la seule porte, et elle recharge vraiment la page', () => {
    const s = readFileSync(join(__dirname, 'redirect.ts'), 'utf8')
    expect(s).toMatch(/window\.location\.assign/)
    // Ni router, ni History API : ces deux-là laisseraient le cache de routeur en place.
    expect(s).not.toMatch(/history\.(pushState|replaceState)|useRouter/)
  })

  it('aucun composant de bascule n’appelle window.location directement', () => {
    // La règle doit avoir une seule maison : c'est ce qui a manqué la première fois.
    for (const nom of BASCULES) {
      const direct = [...source(nom).matchAll(/window\.location\.(assign|replace|href)/g)].map((m) => m[0])
      expect(direct, `${nom} : passer par hardRedirect plutôt que window.location`).toEqual([])
    }
  })
})
