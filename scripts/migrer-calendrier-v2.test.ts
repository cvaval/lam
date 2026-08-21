/**
 * **CE QUE LE SCRIPT DE BASCULE DOIT DIRE À LA RÉDACTION AVANT `--apply`.**
 *
 * ⚠️ **CE FICHIER LIT LE SOURCE, IL NE L'IMPORTE PAS.** `scripts/migrer-calendrier-v2.ts`
 * appelle `main()` au chargement du module et `.env` pointe la base de PRODUCTION : l'importer
 * ouvrirait une connexion depuis la suite de tests. On contrôle donc son TEXTE, ce qui suffit
 * — ce qu'on vérifie ici est précisément ce qui s'affiche à l'écran de l'opératrice.
 *
 * Trois défauts relevés le 20 août 2026, et le test qui les aurait attrapés :
 *
 *  - **défaut 5** — la décision « une demi-journée compte pour un jour plein » change de portée
 *    en v2 (le Lundi Gras devient `TEXTE` et proroge en tête) : elle reporte 5 dates limites
 *    sur 1 826, toujours vers le plus tard. Rien ne le signalait ;
 *  - **défaut 6** — la fenêtre de mesure s'arrête après le décret et cachait que, pour les
 *    départs ANTÉRIEURS au 11 décembre 2024, la date PUBLIQUE devient plus précoce ;
 *  - **défaut 9** — `VERSION_CIBLE` valait 2 en dur, et l'ordre des opérations n'était écrit
 *    nulle part : une édition au back-office publie d'elle-même une version 2 dérivée de la
 *    v1, qui condamne la bascule.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CALENDRIER_V2, DOC_DECRET_2024 } from '../src/lib/delais/feries'

const SOURCE = readFileSync(join(process.cwd(), 'scripts/migrer-calendrier-v2.ts'), 'utf8')

describe('scripts/migrer-calendrier-v2.ts — ce que la bascule ANNONCE', () => {
  /**
   * ⚠️ **DÉFAUT 9 — L'ORDRE DES OPÉRATIONS, ET LA VERSION QUI N'EST PLUS ÉCRITE EN DUR.** Le
   * back-office publie « version courante + 1 » (`publierVersion`,
   * `src/app/api/admin/delais/calendrier/route.ts`) : une seule ligne éditée à l'écran avant
   * `--apply` fabrique une version 2 dérivée de la v1, que le moteur sert aussitôt, et le
   * script refuse ensuite définitivement. L'échec est propre — mais le décret n'a plus de
   * chemin pour entrer.
   */
  it('DÉFAUT 9 — la version cible est LUE du code, jamais figée à 2', () => {
    expect(SOURCE).not.toMatch(/const VERSION_CIBLE = \d/)
    expect(SOURCE).toContain('const VERSION_CIBLE = VERSION_CALENDRIER_COURANTE')
    expect(SOURCE).toContain('const VERSION_SOURCE = VERSION_CIBLE - 1')
    // La version SOURCE ne peut plus être comparée à `CALENDRIER_V1` nommé en dur : elle se
    // lit de `CALENDRIERS`, sans quoi une bascule en v3 contrôlerait la mauvaise liste.
    expect(SOURCE).not.toContain('CALENDRIER_V1')
    expect(SOURCE).toContain('const CALENDRIER_SOURCE = calendrier(VERSION_SOURCE)')
  })

  it('DÉFAUT 9 — l’en-tête dit de le lancer AVANT toute édition au back-office', () => {
    expect(SOURCE).toContain('À LANCER AVANT TOUTE ÉDITION DU CALENDRIER AU BACK-OFFICE')
    expect(SOURCE).toContain('publierVersion')
    expect(SOURCE).toContain('version courante + 1')
  })

  /**
   * ⚠️ **DÉFAUT 5.** Le compte rendu ne parlait que de la phrase affichée, et le bloc 4 ne
   * disait rien. Or c'était le SEUL effet de la bascule qui poussait une date limite plus tard.
   *
   * ⚠️ **LA QUESTION A ÉTÉ TRANCHÉE LE 20 AOÛT 2026 (SOIR)** — défaut 2 de la troisième
   * recette : `entreeProroge` lit `journee`, la demi-journée ne proroge plus la tête d'affiche
   * sous les règles de la version 2, et la date tardive est NOMMÉE. Le bloc 4 ne pose donc plus
   * la question, il rend compte de la réponse — et il continue de nommer le fichier où la règle
   * vit, pour que la rédaction puisse la relire.
   */
  it('DÉFAUT 5 — le bloc 4 porte le Lundi Gras, son sens et la décision prise', () => {
    expect(SOURCE).toContain('LE LUNDI GRAS — TRANCHÉ LE 20 AOÛT 2026')
    expect(SOURCE).toContain('à partir de midi')
    expect(SOURCE).toContain('40 dates limites sur 7 304 calculs')
    expect(SOURCE).toContain('vers le plus tard')
    // … et la règle retenue est nommée avec son fichier et son drapeau.
    expect(SOURCE).toContain('entreeProroge')
    expect(SOURCE).toContain('src/lib/delais/lectures.ts')
    expect(SOURCE).toContain('demiJournee')
    expect(SOURCE).toContain('DEMI_JOURNEE')
    // ⚠️ La question de FOND reste ouverte : le script ne doit pas la donner pour classée.
    expect(SOURCE).toContain('reste à confirmer par écrit')
  })

  /** ⚠️ **DÉFAUT 6.** Les chiffres sont gelés en oracle dans `franc-pur.test.ts`. */
  it('DÉFAUT 6 — le bloc 4 dit ce qui change AVANT le 11 décembre 2024', () => {
    expect(SOURCE).toContain('ANTÉRIEURS au 11 décembre 2024')
    expect(SOURCE).toContain('PLUS PRÉCOCE')
    expect(SOURCE).toContain('19 départs de 2015-2019')
    expect(SOURCE).toContain('21 de')
    // ⚠️ Et les six qui vont dans l'autre sens sont DITS, avec leur cause : les deux versions
    // du calendrier ne s'accordent pas sur le 2 novembre de la période 1989-2024.
    expect(SOURCE).toContain('6 départs par fenêtre vont dans l’AUTRE sens')
    expect(SOURCE).toContain('2 novembre')
    expect(SOURCE).toContain('Les permaliens `c=1` ne sont pas concernés.')
  })

  /**
   * ⚠️ **DÉFAUT 7 — LA BASCULE NE DOIT EMPORTER AUCUN RENVOI AU CORPUS, ET LE DIRE.** Le bloc 4
   * compte désormais les renvois : le jour où une entrée permanente en perdrait un, la
   * simulation l'écrirait avant qu'on tape `--apply`.
   */
  it('DÉFAUT 7 — le bloc 4 rend compte des renvois au corpus', () => {
    expect(SOURCE).toContain('Renvois au corpus (`sourceDocId`)')
    expect(SOURCE).toContain('entrée(s) permanente(s) SANS renvoi')
    // Et le code du calendrier tient la promesse que ce bloc affiche.
    const permanentes = CALENDRIER_V2.filter((e) => e.typeEntree === 'PERMANENT')
    expect(permanentes.filter((e) => !e.sourceDocId)).toHaveLength(0)
    expect(permanentes.filter((e) => e.sourceDocId === DOC_DECRET_2024)).toHaveLength(11)
  })

  /** La promesse du script reste entière : il n'écrit QUE sous la version cible. */
  it('reste en simulation par défaut, et n’écrit que `DelaiFerie` sous la version cible', () => {
    expect(SOURCE).toContain("const APPLIQUER = process.argv.includes('--apply')")
    // ⚠️ Les alternatives les plus LONGUES d'abord : `create` avalerait `createMany`.
    const ecritures = [...SOURCE.matchAll(/tx\.(\w+)\.(createMany|create|updateMany|update|deleteMany|delete|upsert)/g)]
    expect(ecritures.map((m) => `${m[1]}.${m[2]}`)).toEqual(['delaiFerie.createMany'])
  })
})
