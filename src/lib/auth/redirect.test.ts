import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hardRedirect } from './redirect'
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

/**
 * Comportement de `hardRedirect` lui-même. `window` n'existe pas dans l'environnement de
 * test : on le pose, on observe ce que la fonction en fait.
 */
describe('hardRedirect', () => {
  const assign = vi.fn()
  const replace = vi.fn()
  const store = new Map<string, string>()
  const session = new Map<string, string>()

  /**
   * ⚠️ Une fausse mémoire DOIT porter `length` et `key(i)`. L'ancienne n'avait que
   * `removeItem`/`setItem` : elle suffisait à une purge qui énumérait des noms en dur, et
   * elle aurait laissé passer sans un mot une purge par préfixe qui ne retire rien du tout.
   * Un doublon de l'interface réelle, si approximatif, ne prouve que ce qu'il imite.
   */
  const faux = (m: Map<string, string>) => ({
    get length() {
      return m.size
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => m.delete(k),
    setItem: (k: string, v: string) => m.set(k, v),
  })

  beforeEach(() => {
    assign.mockClear()
    replace.mockClear()
    store.clear()
    session.clear()
    ;(globalThis as Record<string, unknown>).window = { location: { assign, replace } }
    ;(globalThis as Record<string, unknown>).localStorage = faux(store)
    ;(globalThis as Record<string, unknown>).sessionStorage = faux(session)
  })

  it('entrée : empile ; sortie : remplace l’entrée d’historique', () => {
    hardRedirect('/fr/dashboard')
    expect(assign).toHaveBeenCalledWith('/fr/dashboard')
    expect(replace).not.toHaveBeenCalled()

    hardRedirect('/fr/login', { sortie: true })
    expect(replace).toHaveBeenCalledWith('/fr/login')
  })

  it('purge le contenu du compte, épargne les deux signaux', () => {
    // ⚠️ LES CLÉS DU CODE D'AUJOURD'HUI, pas celles d'hier. Ce test posait lui-même
    // « lv:doctrineMode » et « lv:doctrineTree » — deux noms que plus aucune ligne de
    // l'application n'écrivait depuis que le navigateur de thèmes préfixe ses clés par la
    // rubrique. Il restait donc vert en vérifiant l'effacement de clés fantômes, pendant que
    // l'état réel des deux rubriques survivait au changement de compte.
    for (const k of ['lv:searchHistory', 'lv:legislationannotee:mode', 'lv:logged-out', 'lv:last-activity'])
      store.set(k, 'x')
    // L'arbre déplié et le thème ouvert vivent dans sessionStorage, qui n'était pas purgé.
    for (const k of ['lv:legislationannotee:tree', 'lv:circulaires:tree']) session.set(k, 'x')
    hardRedirect('/fr/login', { sortie: true })
    expect([...store.keys()].sort()).toEqual(['lv:last-activity', 'lv:logged-out'])
    expect([...session.keys()]).toEqual([])
  })

  it('purge par PRÉFIXE : une clé de rubrique inventée demain est déjà couverte', () => {
    // C'est tout l'objet du changement. Une liste littérale ne connaît que les rubriques
    // écrites le jour où on l'a rédigée.
    store.set('lv:rubrique-qui-nexiste-pas-encore:mode', 'x')
    session.set('lv:rubrique-qui-nexiste-pas-encore:tree', 'x')
    hardRedirect('/fr/login', { sortie: true })
    expect([...store.keys()]).toEqual([])
    expect([...session.keys()]).toEqual([])
  })

  it('n’efface RIEN qui ne soit pas à nous', () => {
    // Purger par préfixe ne doit pas devenir purger tout : d'autres outils écrivent dans le
    // même stockage, et effacer leurs clés serait un dommage silencieux.
    store.set('consentement-cookies', 'x')
    session.set('next-router-state', 'x')
    hardRedirect('/fr/login', { sortie: true })
    expect([...store.keys()]).toEqual(['consentement-cookies'])
    expect([...session.keys()]).toEqual(['next-router-state'])
  })

  it('refuse de quitter le site', () => {
    for (const hostile of ['//exemple.tld/vol', 'https://exemple.tld', 'javascript:alert(1)', ''])
      hardRedirect(hostile)
    expect(assign.mock.calls.flat()).toEqual(['/', '/', '/', '/'])
  })

  it('un stockage indisponible n’empêche pas la redirection', () => {
    ;(globalThis as Record<string, unknown>).localStorage = {
      removeItem: () => {
        throw new Error('quota')
      },
    }
    expect(() => hardRedirect('/fr/login', { sortie: true })).not.toThrow()
    expect(replace).toHaveBeenCalledWith('/fr/login')
  })
})

