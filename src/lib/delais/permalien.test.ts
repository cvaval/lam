/**
 * § 6.3 — LE PERMALIEN. Bloc 12 des tests : un permalien rechargé doit rendre un résultat
 * « identique au caractère près ». Le permalien fait partie de ce que le résultat affiche :
 * son ORDRE et sa FORME sont donc, eux aussi, des invariants.
 */
import { describe, expect, it } from 'vitest'
import { PARAMS_PERMALIEN, construirePermalien, lireKm, queryPermalien } from './permalien'
import { VERSION_REGLES_COURANTE } from './regles-lecture'

describe('la forme du permalien', () => {
  it('rend le gabarit du § 6.3, au caractère près', () => {
    expect(
      construirePermalien('fr', {
        d: '2026-06-04',
        e: 'cpc-354-appel-parties-demeurant-haiti',
        r: 1,
        c: 1,
        w: 1,
        rl: 2,
        km: [0],
      }),
    ).toBe('/fr/delais?d=2026-06-04&e=cpc-354-appel-parties-demeurant-haiti&r=1&c=1&w=1&rl=2&km=0')
  })

  it('l’ordre des paramètres est FIGÉ, quel que soit l’ordre de construction', () => {
    const a = queryPermalien({ d: '2026-06-04', e: 'x', r: 2, c: 1, w: 1, rl: 2, sup: 'antilles', km: [10, 20] })
    expect(a).toBe('d=2026-06-04&e=x&r=2&c=1&w=1&rl=2&km=10%2C20&sup=antilles')
    // Les clés sortent dans l'ordre canonique déclaré, pas dans celui de l'objet.
    const positions = PARAMS_PERMALIEN.filter((k) => a.includes(`${k}=`)).map((k) => a.indexOf(`${k}=`))
    expect([...positions].sort((x, y) => x - y)).toEqual(positions)
  })

  it('un paramètre absent est OMIS, jamais rendu vide', () => {
    expect(queryPermalien({ d: '2026-06-04', e: 'x', c: 1, w: 1, rl: 2 })).toBe(
      'd=2026-06-04&e=x&c=1&w=1&rl=2',
    )
  })

  it('le genre « Autre » porte ses trois paramètres, et jamais `sup`', () => {
    const q = queryPermalien({ d: '2026-03-02', e: 'autre', c: 1, w: 1, rl: 2, n: 15, f: 'oui', src: 'Avis de la DGI' })
    expect(q).toContain('n=15')
    expect(q).toContain('f=oui')
    expect(q).toContain('src=Avis+de+la+DGI')
    expect(q).not.toContain('sup=')
  })

  it('deux kilométrages voyagent dans UN paramètre, dans l’ordre — art. 517 et 586', () => {
    expect(queryPermalien({ d: '2026-06-04', e: 'x', c: 1, w: 1, rl: 2, km: [120, 40] })).toContain(
      'km=120%2C40',
    )
  })
})

describe('§ 4.6 — la version des règles de lecture voyage avec le permalien', () => {
  /**
   * ⚠️ **CE TEST EXISTE PARCE QUE LE PARAMÈTRE A ÉTÉ AJOUTÉ LE 20 AOÛT 2026 (SOIR), AVANT LA
   * MISE EN LIGNE.** La règle de tête a changé deux fois en vingt-quatre heures : elle est donc
   * une VARIABLE du calcul, et le § 6.3 exige qu'un permalien porte tout ce dont le calcul
   * dépend. Émise TOUJOURS, comme `c` et `w` — un lien copié aujourd'hui doit rendre la date
   * d'aujourd'hui le jour où la version courante aura changé.
   */
  it('`rl` est TOUJOURS émise, même quand elle vaut la version courante', () => {
    const q = queryPermalien({ d: '2026-06-04', e: 'autre', c: 2, w: 1, rl: VERSION_REGLES_COURANTE, n: 30, f: 'oui' })
    expect(q).toContain(`rl=${VERSION_REGLES_COURANTE}`)
  })

  it('elle se range entre la version des fenêtres et les kilométrages', () => {
    const q = queryPermalien({ d: '2026-06-04', e: 'x', c: 1, w: 1, rl: 1, km: [40] })
    expect(q).toBe('d=2026-06-04&e=x&c=1&w=1&rl=1&km=40')
    expect(PARAMS_PERMALIEN.indexOf('rl')).toBe(PARAMS_PERMALIEN.indexOf('w') + 1)
  })
})

describe('la relecture des kilométrages', () => {
  it('lit une liste d’entiers', () => {
    expect(lireKm('267')).toEqual([267])
    expect(lireKm('120,40')).toEqual([120, 40])
    expect(lireKm('')).toEqual([])
    expect(lireKm(null)).toEqual([])
  })

  it('REFUSE tout ce qui n’est pas un entier positif — la distance ne s’arrondit jamais', () => {
    expect(lireKm('26.7')).toBeNull()
    expect(lireKm('-5')).toBeNull()
    expect(lireKm('abc')).toBeNull()
    expect(lireKm('30 000')).toBeNull()
    expect(lireKm('1,2,3')).toBeNull() // plus de deux distances : aucun article n'en mesure trois
  })
})
