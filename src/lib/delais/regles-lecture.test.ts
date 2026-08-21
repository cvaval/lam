/**
 * § 4.6 — **LE REGISTRE DES RÈGLES DE LECTURE, MESURÉ AU LIEU D'ÊTRE SUPPOSÉ.**
 *
 * ⚠️ **CE FICHIER N'EXISTAIT PAS, ET `regles-lecture.ts` LE CITAIT** — défaut 11 de la
 * troisième recette. L'argument (d) de son en-tête justifie la coordonnée `rl` en écrivant :
 * « Ce n'est pas un paramètre mort […] le mécanisme est donc exercé, et `regles-lecture.test.ts`
 * le mesure au lieu de le supposer. » Le fichier nommé n'était nulle part (`ls src/lib/delais |
 * grep regle` ne rendait que `regles-lecture.ts`), `VERSIONS_REGLES` — exporté « pour l'écran
 * d'administration et les tests » — n'avait aucun consommateur, et le seul contrôle réel du
 * mécanisme était indirect : `permalien.test.ts` vérifie que la chaîne `rl` figure dans l'URL,
 * ce qui ne dit rien de son EFFET. La décision était argumentée ; sa preuve était absente.
 *
 * Ce qui est vérifié ici, et pourquoi chaque point est un capteur :
 *
 *  1. **le registre est append-only** — les lignes 1 et 2 ne bougent pas. Une ligne éditée
 *     rendrait une AUTRE date sous une adresse déjà citée dans une assignation ;
 *  2. **une version inconnue rend `null`**, jamais les règles du jour — c'est ce que le 404 du
 *     § 7.3 lit, et ce que le moteur refuse (voir `calcul.test.ts`, défaut 12) ;
 *  3. **la version courante est au registre** — sans quoi tout calcul refuserait ;
 *  4. **et surtout : les deux versions rendent DEUX DATES DIFFÉRENTES** sur un cas nommé. C'est
 *     le seul point qui prouve que `rl` n'est pas décoratif, et il vaut deux jours.
 *
 * ⚠️ Test PUR : ni base, ni navigateur, ni build.
 */
import { describe, expect, it } from 'vitest'
import {
  REGLES_LECTURE,
  VERSIONS_REGLES,
  VERSION_REGLES_COURANTE,
  reglesLecture,
} from './regles-lecture'
import { calculer } from './calcul'
import { formatIso, parseIso } from './civil'
import { CPC_354 } from './fixtures'

describe('§ 4.6 — le registre des règles de lecture', () => {
  /**
   * ⚠️ **LES DEUX LIGNES, ÉCRITES EN TOUTES LETTRES.** Ce n'est pas une paraphrase du fichier :
   * c'est l'ORACLE de son append-only. Éditer une ligne existante rendrait une autre date sous
   * un permalien déjà émis — exactement ce que la version existe pour empêcher.
   */
  it('le registre est APPEND-ONLY : les lignes 1 et 2 sont celles-ci, et rien d’autre', () => {
    expect(REGLES_LECTURE[1]).toEqual({ feteNationale: false, cascade: false, demiJournee: true })
    expect(REGLES_LECTURE[2]).toEqual({ feteNationale: true, cascade: true, demiJournee: false })
    expect(VERSIONS_REGLES).toEqual([1, 2])
  })

  /**
   * ⚠️ **UNE VERSION INCONNUE REND `null`, PAS LES RÈGLES DU JOUR.** « Un permalien qui en
   * nomme une est un 404 franc, JAMAIS un calcul rendu sous les règles du jour : ce serait
   * rendre une date sous une adresse qui en promet une autre. »
   */
  it('une version absente du registre rend null — 0, 3, -1 et les valeurs qui n’en sont pas', () => {
    for (const v of [0, 3, 7, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(reglesLecture(v), String(v)).toBeNull()
    }
    for (const v of VERSIONS_REGLES) expect(reglesLecture(v), String(v)).not.toBeNull()
  })

  it('la version courante est AU registre, et c’est la plus haute', () => {
    expect(VERSIONS_REGLES).toContain(VERSION_REGLES_COURANTE)
    expect(reglesLecture(VERSION_REGLES_COURANTE)).toBe(REGLES_LECTURE[VERSION_REGLES_COURANTE])
    expect(Math.max(...VERSIONS_REGLES)).toBe(VERSION_REGLES_COURANTE)
    // `VERSIONS_REGLES` est trié : l'écran d'administration s'en sert pour une liste.
    expect([...VERSIONS_REGLES].sort((a, b) => a - b)).toEqual([...VERSIONS_REGLES])
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LA PREUVE QUE `rl` N'EST PAS UN PARAMÈTRE MORT : DEUX JOURS D'ÉCART.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * 1er décembre 2029 + 30 jours francs, art. 354 C. pr. civ. → échéance le mardi 1er janvier
   * 2030, Fête de l'Indépendance Nationale, suivie du mercredi 2 janvier, Jour des Aïeux —
   * deux fêtes NATIONALES de l'article 275.1 de la Constitution.
   *
   *   - **version 1** — les fêtes nationales ne prorogent pas et le report ne se répète pas :
   *     la date limite est le **mardi 1er janvier 2030** ;
   *   - **version 2** — elles prorogent, en cascade : **jeudi 3 janvier 2030**.
   *
   * Deux jours. C'est ce que porte `rl` dans un permalien, et c'est pourquoi une version
   * inconnue est un 404 plutôt qu'un repli.
   */
  it('les deux versions rendent DEUX dates différentes : 2030-01-01 en v1, 2030-01-03 en v2', () => {
    const depart = parseIso('2029-12-01')!
    const sous = (versionRegles: number): string => {
      const r = calculer({ depart, entree: CPC_354, versionRegles, locale: 'fr' })
      if (r.statut !== 'CALCUL') throw new Error(`attendu CALCUL, reçu ${r.statut}`)
      // Le résultat PORTE sa version : c'est elle que le pied de page nomme et que la route
      // sérialise (défaut 9).
      expect(r.versionRegles).toBe(versionRegles)
      return formatIso(r.teteAffiche)
    }
    expect(sous(1)).toBe('2030-01-01')
    expect(sous(2)).toBe('2030-01-03')
    expect(sous(VERSION_REGLES_COURANTE)).toBe('2030-01-03')
  })

  /**
   * ⚠️ Le troisième drapeau, celui du 20 août 2026 au soir : la demi-journée. 16 janvier 2026
   * + 30 jours francs → échéance le lundi 16 février 2026, **Lundi Gras, chômé « à partir de
   * midi » (décret du 11 décembre 2024, art. 2, 1°)**. La matinée reste ouvrable : sous la
   * version 2, la date limite EST ce lundi ; sous la version 1, elle était repoussée.
   */
  it('le drapeau `demiJournee` a un effet mesurable : le Lundi Gras 16 février 2026', () => {
    const depart = parseIso('2026-01-16')!
    const sous = (versionRegles: number) => {
      const r = calculer({ depart, entree: CPC_354, versionRegles, locale: 'fr' })
      if (r.statut !== 'CALCUL') throw new Error(`attendu CALCUL, reçu ${r.statut}`)
      return {
        tete: formatIso(r.teteAffiche),
        lectures: r.lectures.map((l) => l.cle),
      }
    }
    // Version 1 : la demi-journée proroge, mais d'UN jour (pas de cascade) → mardi 17.
    expect(sous(1)).toEqual({ tete: '2026-02-17', lectures: [] })
    // Version 2 : elle ne proroge plus, la tête reste au lundi 16, et la date tardive est
    // NOMMÉE — le mercredi 18, le Mardi Gras étant chômé en journée entière (art. 2, 2°).
    expect(sous(2)).toEqual({ tete: '2026-02-16', lectures: ['DEMI_JOURNEE'] })
    const r = calculer({ depart, entree: CPC_354, versionRegles: 2, locale: 'fr' })
    if (r.statut !== 'CALCUL') throw new Error(r.statut)
    expect(formatIso(r.lectures[0].date)).toBe('2026-02-18')
  })
})
