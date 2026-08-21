/**
 * LE CALCUL DE LA SURFACE PUBLIQUE — les DEUX mécaniques, et la frontière entre elles.
 *
 * ⚠️ **CE FICHIER A ÉTÉ RETOURNÉ LE JOUR MÊME OÙ IL A ÉTÉ ÉCRIT.**
 *
 * Me Vaval, 20 août 2026, le matin : « Les délais pouvant être prorogés n'ont aucune
 * incidence sur le calculateur public. » — la surface publique ne prorogeait pas.
 *
 * Me Vaval, le même jour, **après avoir vu une date limite tomber un dimanche** : « Attention,
 * la date limite est tombée un dimanche, il faut la proroger au prochain jour ouvrable, donc
 * le lundi 6 juillet. S'assurer que c'est conforme. » Le texte lui donne raison — C. pr. civ.,
 * art. 991 al. 3, relu en base : « Les délais légaux seront prorogés d'un jour, si le dernier
 * est un dimanche ou un jour de fête légale. »
 *
 * Ce fichier vérifie séparément :
 *
 *  1. **le PARAMÈTRE** — `prorogation991: 'OUI'` + `prorogationTeteLarge: true` sur l'entrée
 *     suffisent à ce que le moteur, seul, proroge en cascade sur les 16 entrées PERMANENT et
 *     n'ouvre plus qu'UNE lecture nommée — `DEMI_JOURNEE`, celle du Lundi Gras (§ 4.10), sur
 *     40 des 7 304 calculs du balayage — et ne déclenche plus A4. Rien n'est fait puis défait,
 *     et la date n'est jamais retouchée après coup.
 *     ⚠️ **CETTE LIGNE DISAIT « n'ouvre plus AUCUNE lecture nommée » JUSQU'AU 20 AOÛT 2026 AU
 *     SOIR**, et c'était vrai tant que la demi-journée du Lundi Gras comptait pour un jour
 *     plein : plus rien ne pouvait alors ajouter un jour à une tête déjà prorogée « au
 *     maximum ». Le correctif du défaut 2 a rouvert exactement une lecture, et plusieurs
 *     raisonnements de ce dépôt reposaient encore sur l'ancienne phrase (voir § 4) ;
 *  2. **la CONFORMITÉ** — les cas de contrôle de la cliente, le samedi qui ne bouge pas, la
 *     cascade, et les deux jours du calendrier qui font le tour du problème ;
 *  3. **la LISTE FERMÉE** — ce que le moteur rend sans condition (A1, A6, le bloc praticable,
 *     la phrase de sécurité, et le renvoi terminal « — voir les avertissements ci-dessous. »)
 *     et que la surface publique retire, sans jamais toucher à la date ;
 *  4. **le RENVOI ORPHELIN**, jour de calendrier par jour de calendrier.
 *
 * ⚠️ Test PUR : ni base, ni navigateur, ni build. Le calendrier est passé explicitement.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CALENDRIER_COURANT,
  CALENDRIER_V1,
  VERSION_CALENDRIER_COURANTE,
  entreesDuJour,
} from './feries'
import type { EntreeDelai, Resultat, ResultatCalcul } from './calcul'
import { calculer } from './calcul'
import { addDays, comparer, dayOfWeek, diffDays, formatIso, parseIso } from './civil'
import {
  AVERTISSEMENTS_FRANC_PUR,
  PROROGATION_FRANC_PUR,
  entreeLectureStricte,
  prorogationFrancPur,
  restreindreAuFrancPur,
} from './franc-pur'
import { phrases } from './phrases'
import { VERSION_REGLES_COURANTE, reglesLecture } from './regles-lecture'
import type { Configuration } from './lectures'
import { entreeProroge } from './lectures'
import { mentionsJour } from './mention-jour'
import { getDictionary } from '@/lib/i18n/dictionaries'

/**
 * Les deux configurations que la plateforme pose sur l'entrée synthétique du § 4.12 :
 *
 *   - `'PUBLIC'` — ce que `entreeAutre(…, francPur: true)` fabrique : la vraie valeur, prise
 *     de `franc-pur.ts` et non recopiée, pour qu'un changement de décision fasse bouger les
 *     tests avec le code ;
 *   - `'CONNECTE'` — le portail, où le régime n'est pas acquis : `INCERTAIN`, tête d'affiche
 *     étroite, prorogation en lecture nommée. C'est la SONDE de chaque paire.
 */
type Mode = 'PUBLIC' | 'CONNECTE'

function entreeAutre(mode: Mode, jours = 30): EntreeDelai {
  return {
    slug: 'autre',
    code: 'CIVIL',
    codeLibelle: 'Délai saisi (hors répertoire)',
    article: '',
    objetFr: 'Délai indiqué dans l’acte',
    dureeTexte: `${jours} jours (saisis)`,
    kind: 'JOURS',
    jours,
    nbDistances: 0,
    supplement: null,
    regime: 'FRANC',
    regimeIncertain: false,
    regimeFondement: 'Nombre de jours saisi par l’utilisatrice.',
    ...(mode === 'PUBLIC'
      ? prorogationFrancPur('fr')
      : { prorogation991: 'INCERTAIN' as const, prorogationFondement: 'Fondement de test.' }),
    pointDepartFr: 'Date de réception de l’acte',
    motifRefusFr: null,
    avisDistance: null,
    citationArticle: null,
  }
}

function calcul(iso: string, mode: Mode, jours = 30, locale: 'fr' | 'en' | 'ht' = 'fr'): ResultatCalcul {
  const r = calculer({
    depart: parseIso(iso)!,
    entree: entreeAutre(mode, jours),
    versionCalendrier: 1,
    entreesCalendrier: CALENDRIER_V1,
    locale,
  })
  if (r.statut !== 'CALCUL') throw new Error(`attendu CALCUL, reçu ${r.statut}`)
  return r
}

/** La date rendue par la surface publique, en ISO — restriction comprise. */
function datePublique(iso: string, jours = 30): string {
  const r = restreindreAuFrancPur(calcul(iso, 'PUBLIC', jours), 'fr') as ResultatCalcul
  return formatIso(r.teteAffiche)
}

// ===========================================================================
// 1. LE PARAMÈTRE — ce que le moteur fait, et cesse de faire, de lui-même
// ===========================================================================

describe('la configuration publique suffit — rien n’est défait après coup', () => {
  it('elle déclare « OUI » et la lecture large : ni « NON », ni « INCERTAIN »', () => {
    expect(PROROGATION_FRANC_PUR.prorogation991).toBe('OUI')
    // ⚠️ Le second drapeau est INDISSOCIABLE du premier : sans lui, seules les 7 fêtes légales
    // du décret du 23 mai 1989 reporteraient, d'UN jour, et le cas du 1er novembre 2025
    // rendrait « samedi 1er novembre » au lieu de « lundi 3 novembre ».
    expect(PROROGATION_FRANC_PUR.prorogationTeteLarge).toBe(true)
    // Le fondement est REPRODUIT dans le résultat : il doit citer l'article, dire la cascade
    // et dire que le samedi n'en est pas.
    expect(PROROGATION_FRANC_PUR.prorogationFondement).toContain('991')
    expect(PROROGATION_FRANC_PUR.prorogationFondement).toContain('samedi')
  })

  it('le fondement est TRADUIT dans les trois langues, et chacune cite l’article', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(prorogationFrancPur(l).prorogationFondement, l).toContain('991')
      expect(prorogationFrancPur(l).prorogation991, l).toBe('OUI')
      expect(prorogationFrancPur(l).prorogationTeteLarge, l).toBe(true)
    }
    // Trois textes DIFFÉRENTS : un repli silencieux sur le français passerait sinon inaperçu.
    const textes = (['fr', 'en', 'ht'] as const).map((l) => prorogationFrancPur(l).prorogationFondement)
    expect(new Set(textes).size).toBe(3)
  })

  /**
   * Le cas d'espèce de Me Vaval, dans les termes du portail : le 4 juin 2026 + 30 jours francs
   * pose l'échéance au dimanche 5 juillet. Le portail (`INCERTAIN`) garde la tête d'affiche au
   * dimanche et NOMME la prorogation au lundi ; la surface publique proroge en tête.
   */
  it('la DATE change, et c’est tout le propos', () => {
    const portail = calcul('2026-06-04', 'CONNECTE')
    const publique = calcul('2026-06-04', 'PUBLIC')
    // Les deux comptent les mêmes jours : seule la fin diffère.
    expect(publique.dernierJourCompte).toEqual(portail.dernierJourCompte)
    expect(publique.echeance).toEqual(portail.echeance)
    expect(portail.teteAffiche).toEqual({ y: 2026, m: 7, d: 5 }) // dimanche, non prorogé en tête
    expect(publique.teteAffiche).toEqual({ y: 2026, m: 7, d: 6 }) // lundi — le report a joué
  })

  it('aucune lecture nommée ne s’ouvre : elles rendent toutes la date de la tête', () => {
    expect(calcul('2026-06-04', 'CONNECTE').lectures.map((l) => l.cle)).toContain('PROROGATION_991')
    expect(calcul('2026-06-04', 'PUBLIC').lectures).toEqual([])
  })

  /**
   * ⚠️ **UNE SEULE LECTURE PEUT ENCORE S'OUVRIR SOUS LA CONFIGURATION PUBLIQUE, ET C'EST
   * `DEMI_JOURNEE`** (20 août 2026, soir — défaut 2 de la troisième recette). La tête publique
   * prorogeait « au maximum » tant que la demi-journée du Lundi Gras y comptait pour un jour
   * plein : plus rien ne pouvait donc ajouter un jour, et ce test attendait `[]` partout. La
   * matinée du Lundi Gras étant redevenue ouvrable, c'est la lecture nommée qui porte la date
   * tardive — et la tête, la date sûre. Les 12 × 28 départs balayés ici en rencontrent quatre.
   */
  it('la seule lecture qui s’ouvre encore est DEMI_JOURNEE ; la plus large est la sienne', () => {
    let avecDemiJournee = 0
    for (let jour = 1; jour <= 28; jour++) {
      for (let mois = 1; mois <= 12; mois++) {
        const iso = `2026-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`
        const r = calcul(iso, 'PUBLIC')
        const cles = r.lectures.map((l) => l.cle)
        // ⚠️ Ni R1, ni R3, ni CUMUL, ni REGIME_FRANC, ni PROROGATION_991 : la liste est FERMÉE.
        expect(cles.filter((c) => c !== 'DEMI_JOURNEE'), iso).toEqual([])
        if (cles.length === 0) {
          expect(r.lectureLaPlusLarge, iso).toEqual(r.teteAffiche)
        } else {
          avecDemiJournee += 1
          // L'invariant « une lecture n'est jamais antérieure à la tête » est vérifié par
          // `calculer()` lui-même, qui lève sinon ; ici on vérifie qu'elle la DÉPASSE.
          expect(comparer(r.lectureLaPlusLarge, r.teteAffiche), iso).toBeGreaterThan(0)
          expect(r.lectureLaPlusLarge, iso).toEqual(r.lectures[0].date)
        }
      }
    }
    expect(avecDemiJournee).toBe(4)
  })

  /**
   * A4 ne naît que des jours SANS TEXTE ayant RÉELLEMENT joué dans la lecture cumulée. Sous la
   * configuration publique cette lecture n'est pas ouverte : il s'éteint tout seul — sans
   * liste, sans filtre.
   *
   * ⚠️ **CE FICHIER MESURE LA VERSION 1 DU CALENDRIER**, à dessein (`calcul()` la passe
   * explicitement) : c'est elle qui portait les quatre jours sans texte, donc elle seule qui
   * permet d'éprouver le chemin. Sous la version 2 — le décret du 11 décembre 2024 —, A4 n'a
   * plus d'objet nulle part : le bloc « §  2 bis » ci-dessous le mesure.
   */
  it('A4 s’éteint par construction, pas par filtrage', () => {
    // Départ au 16 janvier 2026 : l'échéance tombe le Lundi Gras, jour de la rédaction.
    expect(calcul('2026-01-16', 'CONNECTE').avertissements.map((a) => a.cle)).toContain('A4')
    expect(calcul('2026-01-16', 'PUBLIC').avertissements.map((a) => a.cle)).not.toContain('A4')
  })
})

// ===========================================================================
// 2. LA CONFORMITÉ À L'ARTICLE 991 — « s'assurer que c'est conforme »
// ===========================================================================

/**
 * C. pr. civ., art. 991, alinéas 3 et 4, relus en base (`Document`, source
 * `CODE_PROCEDURE_CIVILE`) :
 *
 *   « Les délais légaux seront prorogés d'un jour, si le dernier est un dimanche ou un jour
 *   de fête légale. Il en est de même lorsque, au dernier jour, le chômage est prescrit par
 *   arrêté du Président de la République. »
 *
 * ⚠️ **LE SAMEDI N'Y EST PAS**, et il n'est pas davantage à l'art. 511 al. 2 C. trav. — la
 * clause de prorogation du Code du travail (« Les délais légaux sont prorogés d'un jour si le
 * dernier jour est un dimanche ou un jour férié légal ou prescrit par Arrêté Présidentiel »).
 * ⚠️ Ce commentaire citait l'art. 512, qui régit les HEURES et JOURS de signification et est le
 * pendant de l'art. 991 al. 2, pas de l'al. 3 — la même mis-citation que portait l'en-tête de
 * `franc-pur.ts`. Deux derniers
 * jours utiles fixés par la Cour de cassation tombent un samedi sans le moindre report
 * (samedi 23 juin 1962, Germeil ; samedi 2 novembre 1963, Brown and Root) : ce sont deux des
 * six arrêts-oracle, et `calcul.test.ts` les garde. Ici on garde la règle côté public.
 */
describe('§ art. 991 — la conformité, éprouvée et non supposée', () => {
  it('LE CAS DE LA CLIENTE : 3 juin 2026 + 31 jours francs → lundi 6 juillet 2026', () => {
    const r = calcul('2026-06-03', 'PUBLIC', 31)
    // Le dernier jour COMPTÉ est le samedi 4 juillet…
    expect(formatIso(r.dernierJourCompte)).toBe('2026-07-04')
    expect(dayOfWeek(r.dernierJourCompte)).toBe(6)
    // … le délai est franc, l'échéance tombe donc le dimanche 5 juillet…
    expect(formatIso(r.echeance)).toBe('2026-07-05')
    expect(dayOfWeek(r.echeance)).toBe(0)
    // … et l'art. 991 la proroge au lundi 6 juillet 2026.
    expect(formatIso(r.teteAffiche)).toBe('2026-07-06')
    expect(dayOfWeek(r.teteAffiche)).toBe(1)
    // UN seul jour écarté, et son motif est le dimanche, sur l'art. 991.
    expect(r.joursEcartes).toHaveLength(1)
    expect(formatIso(r.joursEcartes[0].date)).toBe('2026-07-05')
    expect(r.joursEcartes[0].motifs.map((m) => m.cle)).toEqual(['DIMANCHE'])
    expect(r.joursEcartes[0].motifs[0].source).toContain('art. 991')
  })

  /**
   * ⚠️ **LA CASCADE EST UNE LECTURE, ET ELLE EST ASSUMÉE.** La lettre de l'art. 991 proroge
   * « d'UN jour ». Répéter le report jusqu'au point fixe est la lecture que le portail nomme
   * « R3 · Prorogation en cascade » et qu'il tient hors de sa tête d'affiche. Elle est
   * appliquée publiquement parce que la cliente l'a demandée expressément — « au prochain
   * jour ouvrable ».
   *
   * ⚠️ Ce cas engage AUSSI la seconde lecture assumée : le samedi 1er novembre est La
   * Toussaint, `autorite: 'REDACTION'` — aucun texte du corpus ne l'institue. Sans elle, la
   * date resterait au samedi 1er novembre. La mention en petits caractères le dit.
   */
  it('LE CAS DE LA CASCADE : 1er octobre 2025 + 30 jours francs → lundi 3 novembre 2025', () => {
    const r = calcul('2025-10-01', 'PUBLIC')
    expect(formatIso(r.dernierJourCompte)).toBe('2025-10-31') // vendredi
    expect(formatIso(r.echeance)).toBe('2025-11-01') // samedi — mais c'est La Toussaint
    expect(dayOfWeek(r.echeance)).toBe(6)
    expect(formatIso(r.teteAffiche)).toBe('2025-11-03') // lundi
    // DEUX jours franchis, dans l'ordre, avec leurs motifs.
    expect(r.joursEcartes.map((j) => formatIso(j.date))).toEqual(['2025-11-01', '2025-11-02'])
    expect(r.joursEcartes[0].motifs.map((m) => m.cle)).toEqual(['1er-novembre'])
    expect(r.joursEcartes[0].motifs[0].autorite).toBe('REDACTION')
    // Le 2 novembre est un dimanche ET la Fête des Morts : les deux motifs sont nommés.
    expect(r.joursEcartes[1].motifs.map((m) => m.cle)).toEqual(['DIMANCHE', '2-novembre'])
  })

  /**
   * ⚠️ **LE SAMEDI N'EST PAS PROROGÉ — INSTRUCTION EXPRESSE DE LA CLIENTE.** Départ jeudi
   * 4 juin 2026 + 29 jours francs : le dernier jour compté est le vendredi 3 juillet,
   * l'échéance le samedi 4 juillet. Elle ne bouge pas d'un jour.
   */
  it('un délai qui expire un samedi ORDINAIRE n’est pas prorogé', () => {
    const r = calcul('2026-06-04', 'PUBLIC', 29)
    expect(formatIso(r.echeance)).toBe('2026-07-04')
    expect(dayOfWeek(r.teteAffiche)).toBe(6)
    expect(formatIso(r.teteAffiche)).toBe('2026-07-04')
    expect(r.joursEcartes).toEqual([])
  })

  /**
   * Le balayage qui interdit la régression : sur trois ans de départs, une échéance qui tombe
   * un samedi **et ne porte aucune entrée PERMANENT** n'est jamais déplacée.
   *
   * ⚠️ **L'INVERSE N'EST PAS VRAI, ET C'EST NORMAL.** Une date d'ARRIVÉE peut être un samedi
   * atteint PAR un report — le vendredi 18 avril 2025 est le Vendredi Saint, il proroge, et la
   * cascade s'arrête au samedi 19 parce que le samedi, précisément, ne proroge pas. Le samedi
   * n'est pas un jour qu'on saute ; c'est un jour où l'on s'arrête.
   */
  it('sur trois ans de départs : un samedi ordinaire n’est jamais déplacé', () => {
    let depart = parseIso('2025-01-01')!
    let samedis = 0
    while (formatIso(depart) <= '2027-12-31') {
      const r = calcul(formatIso(depart), 'PUBLIC')
      const e = r.echeance
      const permanentSurEcheance = CALENDRIER_V1.some(
        (x) => x.typeEntree === 'PERMANENT' && x.mois === e.m && x.jour === e.d,
      )
      if (dayOfWeek(e) === 6 && !permanentSurEcheance) {
        samedis++
        // Aucun report : l'échéance EST la date rendue.
        expect(formatIso(r.teteAffiche), formatIso(depart)).toBe(formatIso(e))
        expect(r.joursEcartes, formatIso(depart)).toEqual([])
      }
      depart = addDays(depart, 1)
    }
    expect(samedis).toBeGreaterThan(100) // le balayage doit réellement exercer des samedis
  })

  /**
   * Les deux jours qui font le tour du problème, et qui sont dans la consigne :
   *
   *   - **le 25 décembre 2027 tombe un SAMEDI.** Il est fête légale de TEXTE (décret du
   *     23 mai 1989) : il proroge — non parce qu'il est samedi, mais parce qu'il est Noël. Le
   *     dimanche 26 suit, et la date arrive au lundi 27 ;
   *   - **le 1er janvier 2028 tombe un SAMEDI**, et le 1er janvier 2033 un vendredi… on prend
   *     donc l'année où il tombe un DIMANCHE : 2034. Fête NATIONALE (Constitution, art. 275.1)
   *     et dimanche à la fois, suivie du 2 janvier (Jour des Aïeux) : trois jours franchis.
   */
  it('25 décembre 2027, un samedi : c’est Noël qui proroge, pas le samedi', () => {
    // 24 novembre 2027 + 30 jours francs → dernier jour compté vendredi 24 déc., échéance
    // samedi 25 décembre.
    const r = calcul('2027-11-24', 'PUBLIC')
    expect(formatIso(r.echeance)).toBe('2027-12-25')
    expect(dayOfWeek(r.echeance)).toBe(6) // samedi
    expect(r.joursEcartes.map((j) => formatIso(j.date))).toEqual(['2027-12-25', '2027-12-26'])
    expect(r.joursEcartes[0].motifs.map((m) => m.cle)).toEqual(['25-decembre'])
    expect(formatIso(r.teteAffiche)).toBe('2027-12-27') // lundi
  })

  it('1er janvier 2034, un dimanche : trois jours franchis, arrivée le mardi 3', () => {
    // 1er décembre 2033 + 30 jours francs → dernier jour compté 31 déc., échéance 1er janvier.
    const r = calcul('2033-12-01', 'PUBLIC')
    expect(formatIso(r.echeance)).toBe('2034-01-01')
    expect(dayOfWeek(r.echeance)).toBe(0) // dimanche
    expect(r.joursEcartes[0].motifs.map((m) => m.cle)).toEqual(['DIMANCHE', '1er-janvier'])
    expect(r.joursEcartes.map((j) => formatIso(j.date))).toEqual(['2034-01-01', '2034-01-02'])
    expect(formatIso(r.teteAffiche)).toBe('2034-01-03')
  })

  /**
   * ⚠️ **LES JOURS À SURVEILLER NE PROROGENT PAS** (§ 4.13, point 4 de la consigne) : aucun
   * texte permanent ne les institue pour l'année considérée. Ils gardent leur mention en
   * petits caractères — que `mention-jour.test.ts` vérifie — sans déplacer la date.
   */
  it('un jour À SURVEILLER reste la date : il ne proroge rien', () => {
    // 7 janvier 2026 + 30 jours francs → échéance samedi 7 février, jour à surveiller.
    const r = calcul('2026-01-07', 'PUBLIC')
    expect(formatIso(r.teteAffiche)).toBe('2026-02-07')
    expect(r.joursEcartes).toEqual([])
    // Le moteur le SIGNALE (A6) — c'est la liste fermée, plus bas, qui le retire de l'écran.
    expect(r.avertissements.map((a) => a.cle)).toContain('A6')
  })

  /**
   * L'invariant du report, énoncé une fois pour toutes : sur cinq ans de départs, la date
   * publique n'est **jamais** un dimanche, n'est jamais antérieure à l'échéance ni postérieure
   * de plus de trois jours, et ne porte **aucune entrée PERMANENT chômée toute la journée**.
   *
   * ⚠️ **L'EXCEPTION EST NOMMÉE, PAS TOLÉRÉE** (20 août 2026, soir — défaut 2). La date
   * d'arrivée PEUT désormais tomber sur une entrée `DEMI_JOURNEE_APRES_MIDI` : la matinée y
   * reste ouvrable, l'acte peut y être fait, et c'est exactement pour cela que la tête d'affiche
   * ne la fuit plus. Le test l'admet pour ces entrées-là **et pour elles seules** : une entrée
   * chômée en journée entière sur la date d'arrivée resterait un défaut.
   */
  it('cinq ans de départs : la date d’arrivée est toujours un jour qui porte', () => {
    let depart = parseIso('2025-01-01')!
    let reportes = 0
    let surDemiJournee = 0
    while (formatIso(depart) <= '2029-12-31') {
      const r = calcul(formatIso(depart), 'PUBLIC')
      const iso = formatIso(depart)
      expect(dayOfWeek(r.teteAffiche), iso).not.toBe(0)
      // Aucun jour PERMANENT chômé en ENTIER sur la date d'arrivée : le report l'en fait sortir
      // par définition. Les jours À SURVEILLER, eux, sont autorisés — ils ne prorogent pas ; et
      // les demi-journées, depuis le 20 août 2026 au soir, non plus.
      const surLArrivee = CALENDRIER_V1.filter(
        (e) => e.typeEntree === 'PERMANENT' && e.mois === r.teteAffiche.m && e.jour === r.teteAffiche.d,
      )
      expect(
        surLArrivee.filter((e) => e.journee !== 'DEMI_JOURNEE_APRES_MIDI').map((e) => e.cle),
        iso,
      ).toEqual([])
      if (surLArrivee.length > 0) surDemiJournee += 1
      expect(formatIso(r.teteAffiche) >= formatIso(r.echeance), iso).toBe(true)
      if (r.joursEcartes.length > 0) reportes++
      expect(r.joursEcartes.length, iso).toBeLessThanOrEqual(3)
      depart = addDays(depart, 1)
    }
    expect(reportes).toBeGreaterThan(250) // le balayage doit réellement exercer des reports
    expect(surDemiJournee).toBe(9) // les seules exceptions, comptées et non tolérées en bloc
  })
})

// ===========================================================================
// 3. LA LISTE FERMÉE — ce que le moteur rend sans condition
// ===========================================================================

describe('la restriction retire A1, A6, le bloc praticable et le renvoi aux lectures', () => {
  const brut = calcul('2026-06-04', 'PUBLIC')
  const restreint = restreindreAuFrancPur(brut) as ResultatCalcul

  it('la sonde tient : le moteur pousse toujours A1 sans qu’on le lui demande', () => {
    expect(brut.avertissements.map((a) => a.cle)).toEqual(['A1', 'A3'])
  })

  /**
   * ⚠️ **LE BLOC PRATICABLE EST DEVENU INERTE PUBLIQUEMENT, ET LA NEUTRALISATION RESTE.**
   * `construirePraticable` recule tant que le jour est un dimanche ou une entrée PERMANENT —
   * c'est-à-dire exactement les jours dont le report fait désormais sortir la date. Le bloc
   * n'est donc plus « nécessaire » sur aucun calcul public. On le CONSTATE ici, on ne le
   * suppose pas ; et la neutralisation de `restreindreAuFrancPur` est gardée en ceinture et
   * bretelles : elle redeviendrait agissante le jour où la rédaction resserrerait le report.
   *
   * La sonde du portail prouve que la neutralisation n'est pas vide de sens : sous
   * `INCERTAIN`, la tête d'affiche reste au dimanche et le bloc, lui, est bien nécessaire.
   */
  it('le bloc praticable : nécessaire au PORTAIL, déjà inerte en public', () => {
    const portail = calcul('2026-06-04', 'CONNECTE')
    expect(portail.praticable.necessaire).toBe(true)
    expect(portail.praticable.dernierJourPraticable).toEqual({ y: 2026, m: 7, d: 4 })
    expect(brut.praticable.necessaire).toBe(false)
  })

  it('A3 seul survit — la liste est FERMÉE, on énumère ce qu’on garde', () => {
    expect(AVERTISSEMENTS_FRANC_PUR).toEqual(['A3'])
    expect(restreint.avertissements.map((a) => a.cle)).toEqual(['A3'])
  })

  it('A6 aussi tombe : il NOMME une date de report que la plateforme ne fait pas', () => {
    const surveille = calcul('2026-01-07', 'PUBLIC')
    expect(surveille.avertissements.map((a) => a.cle)).toContain('A6')
    const apres = restreindreAuFrancPur(surveille) as ResultatCalcul
    expect(apres.avertissements.map((a) => a.cle)).toEqual(['A3'])
    expect(JSON.stringify(apres)).not.toContain('jour à surveiller')
  })

  it('le bloc praticable est neutralisé, et ses deux dates redeviennent la tête d’affiche', () => {
    expect(restreint.praticable.necessaire).toBe(false)
    expect(restreint.praticable.texte).toBe('')
    expect(restreint.praticable.joursEmpeches).toEqual([])
    expect(restreint.praticable.dernierJourPraticable).toEqual(restreint.teteAffiche)
    expect(restreint.praticable.dernierJourPraticableCertain).toEqual(restreint.teteAffiche)
  })

  it('la phrase de sécurité ne renvoie plus à des lectures qui n’existent pas', () => {
    expect(brut.phraseSecurite).toContain('lectures ci-dessous')
    expect(restreint.phraseSecurite).toBe(
      phrases('fr').phraseSecuriteFrancPur('lundi 6 juillet 2026'),
    )
    expect(restreint.phraseSecurite).not.toContain('lectures ci-dessous')
  })

  /**
   * ⚠️ **ELLE DISAIT « ET NE LUI APPLIQUE AUCUN REPORT ».** C'est devenu faux le jour même.
   * Les trois langues doivent dire le report ET l'article ; aucune ne doit renvoyer à des
   * lectures.
   */
  it('elle existe dans les TROIS langues, dit le report, et ne renvoie à rien', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const p = phrases(l).phraseSecuriteFrancPur('X')
      expect(p, l).toContain('X')
      expect(p, l).toContain('991')
      expect(p.toLowerCase(), l).not.toMatch(/ci-dessous|below|anba yo/)
      expect(p.toLowerCase(), l).not.toMatch(/aucun report|no extension|okenn ranvwa/)
    }
  })

  /**
   * ⚠️ **ELLE SOUS-DÉCRIVAIT LE CALCUL, ET C'EST UNE AUTRE FAUTE QUE LA PREMIÈRE.** « Ce calcul
   * compte les jours et proroge LE dernier s'il tombe un dimanche ou un jour de FÊTE LÉGALE
   * (art. 991) » disait trois choses fausses d'un calcul qui reporte EN CASCADE, sur seize
   * entrées dont cinq fêtes NATIONALES et quatre jours de la seule rédaction, et dont le
   * fondement se lit aussi à l'art. 511 al. 2 C. trav.
   *
   * ⚠️ **Elle n'est rendue par AUCUNE surface publique** — elle voyage dans
   * `resultat.phraseSecurite` (API, presse-papiers, aperçus d'admin). C'est une mise en
   * cohérence d'un champ sérialisé, pas un livrable visible : le contrôle le dit pour que le
   * compte rendu suivant ne la reclasse pas en « corrigé à l'écran ».
   */
  it('elle décrit ce que le moteur FAIT : la cascade, le calendrier, les deux articles', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const p = phrases(l).phraseSecuriteFrancPur('X')
      // La cascade, et non « le dernier jour ».
      expect(p.toLowerCase(), l).toMatch(/de proche en proche|step by step|youn apre lòt/)
      // Le calendrier entier, et non « une fête légale ».
      expect(p.toLowerCase(), l).toMatch(/seize|sixteen|sèz/)
      // Les DEUX clauses de prorogation : la procédure civile et le travail.
      expect(p, l).toContain('991')
      expect(p, l).toContain('511')
      // Et le samedi, qui n'est pas un jour de report.
      expect(p.toLowerCase(), l).toMatch(/samedi|saturday|samdi/)
    }
  })

  /** La SONDE de la remarque ci-dessus : aucun écran public ne lit ce champ. */
  it('… et aucune surface publique ne l’affiche — c’est un champ, pas une ligne', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/delais/DelaiDatePublique.tsx'),
      'utf8',
    )
    expect(source).not.toContain('phraseSecurite')
  })

  /**
   * ⚠️ **CE QUI NE DOIT PAS BOUGER.** La restriction porte sur les productions
   * inconditionnelles du moteur — jamais sur la date, le raisonnement, les lectures ou les
   * jours écartés, qui viennent de la CONFIGURATION. Une édition qui se mettrait à
   * « nettoyer » les étapes ici réintroduirait le filtrage après coup que ce découpage existe
   * pour empêcher — et **`joursEcartes` est désormais porteur** : c'est de lui que la ligne du
   * report est tirée.
   */
  it('la date, les étapes, les lectures et les jours écartés traversent INTACTS', () => {
    expect(restreint.teteAffiche).toEqual(brut.teteAffiche)
    expect(restreint.etapes.slice(0, -1)).toEqual(brut.etapes.slice(0, -1))
    expect(restreint.etapes).toHaveLength(brut.etapes.length)
    expect(restreint.etapes.map((e) => e.cle)).toEqual(brut.etapes.map((e) => e.cle))
    expect(restreint.etapes.map((e) => e.date)).toEqual(brut.etapes.map((e) => e.date))
    expect(restreint.lectures).toEqual(brut.lectures)
    expect(restreint.lectureLaPlusLarge).toEqual(brut.lectureLaPlusLarge)
    expect(restreint.joursEcartes).toEqual(brut.joursEcartes)
    expect(restreint.joursEcartes).toHaveLength(1)
    expect(restreint.entree).toEqual(brut.entree)
    expect(restreint.versionCalendrier).toBe(brut.versionCalendrier)
  })

  it('un REFUS et une saisie INCOMPLÈTE traversent inchangés', () => {
    const refus: Resultat = {
      statut: 'REFUS',
      cle: 'DUREE_ABSENTE',
      motif: 'Aucune durée.',
      regimeAffiche: 'Délai franc',
      entree: entreeAutre('PUBLIC'),
    }
    expect(restreindreAuFrancPur(refus)).toBe(refus)
    const incomplet: Resultat = {
      statut: 'INCOMPLET',
      manque: ['le kilométrage'],
      regimeAffiche: 'Délai franc',
      entree: entreeAutre('PUBLIC'),
    }
    expect(restreindreAuFrancPur(incomplet)).toBe(incomplet)
  })

  /**
   * ⚠️ **LE RAISONNEMENT DIT CE QUI A ÉTÉ FAIT.** La surface publique ne l'affiche pas — mais
   * l'API le sérialise, et `affichage.ts` le recopie dans le presse-papiers et à l'impression.
   * Une étape qui dirait « sans y appliquer aucun report » sous une date reportée serait la
   * seconde vérité que tout ce découpage existe pour empêcher.
   */
  it('le raisonnement nomme le jour franchi, l’article, et la date d’arrivée', () => {
    const textes = restreint.etapes.map((e) => e.texte).join(' ')
    expect(textes).toContain('dimanche 5 juillet 2026')
    expect(textes).toContain('art. 991')
    expect(textes).toContain('lundi 6 juillet 2026')
    expect(textes).not.toContain('aucun report')
    // La dernière étape constate que l'arrivée ne proroge plus.
    const derniere = restreint.etapes[restreint.etapes.length - 1]
    expect(derniere.cle).toBe('finale')
    expect(derniere.texte).toContain('aucune autre prorogation')
  })
})

// ===========================================================================
// 4. LE RENVOI ORPHELIN — l'étape ne doit jamais envoyer vers un bloc vidé
// ===========================================================================

/**
 * ⚠️ **LE TROU QUE LE § 4.13 AVAIT FERMÉ D'UN CÔTÉ ET QUE LA LISTE FERMÉE ROUVRAIT DE
 * L'AUTRE.** `calcul.ts` refuse d'écrire « voir les lectures nommées » quand il n'y en a
 * aucune ; il écrit alors « — voir les avertissements ci-dessous. ». Or la restriction
 * ci-dessus retire A1 et A6 — les DEUX seuls avertissements qui parlaient du jour en cause. Le
 * lecteur était envoyé vers un bloc où ne restait que A3, qui ne dit pas un mot de la date. Et
 * ce texte-là n'est pas décoratif : `affichage.ts` le recopie tel quel dans le presse-papiers
 * et à l'impression.
 *
 * ⚠️ **LE REPORT A RÉTRÉCI LE TROU, IL NE L'A PAS BOUCHÉ.** Avant le report, la tête d'affiche
 * publique pouvait tomber sur 12 des 21 jours du calendrier. Elle ne peut plus tomber que sur
 * un jour **À SURVEILLER** — les 16 entrées PERMANENT prorogent désormais — ou, depuis le
 * correctif du défaut 2, sur un Lundi Gras. Il en reste donc, et le balayage les énumère : un
 * futur calendrier qui en ajouterait doit faire échouer ce test, pas passer inaperçu.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **LE BALAYAGE NE CHERCHAIT QU'UN DES DEUX RENVOIS, ET IL A CESSÉ DE LES VOIR TOUS.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * `calcul.ts` écrit DEUX renvois terminaux, et il choisit selon qu'une lecture nommée est
 * ouverte ou non : `voirAvertissements` (« — voir les avertissements ci-dessous. ») et
 * `voirLecturesEtAvertissements` (« — voir les lectures nommées et les avertissements
 * ci-dessous. »). `balayer` ne cherchait que le premier, et c'était SUFFISANT tant que la
 * configuration publique n'ouvrait aucune lecture : le second était alors inatteignable.
 *
 * **Il ne l'est plus.** Depuis que la matinée du Lundi Gras est redevenue ouvrable, la lecture
 * `DEMI_JOURNEE` s'ouvre en public, et `calcul.ts` écrit donc le second renvoi. Or
 * `restreindreAuFrancPur` n'appelle `sansRenvoiOrphelin` qu'avec le PREMIER : le second
 * traverse intact. Le balayage restait vert, non parce que le renvoi avait disparu, mais parce
 * qu'il ne le cherchait pas — exactement le « nombre écrit à la main » que ce dépôt s'interdit,
 * transposé à un motif de recherche.
 *
 * ⚠️ **CE QUI SUIT MESURE L'ÉTAT, IL NE LE TRANCHE PAS.** Le second renvoi n'est pas orphelin
 * de la même façon que le premier : sa moitié « lectures nommées » pointe vers un bloc qui
 * EXISTE dans la charge utile publique (`restreindreAuFrancPur` laisse `lectures` intact, et
 * `DEMI_JOURNEE` y est), tandis que sa moitié « avertissements » pointe, elle, vers le bloc
 * réduit à A3 — le défaut d'origine, sur une phrase de plus. **Question ouverte à la
 * rédaction**, portée au compte rendu : couper la seule moitié fausse demanderait un troisième
 * gabarit de renvoi, et aucune donnée ni aucun comportement n'a été touché ici.
 */
describe('aucune étape publique ne renvoie à un bloc que la restriction a vidé', () => {
  /** Les 21 jours de `CALENDRIER_V1` — la sonde du balayage : s'il en manque, il ne mesure rien. */
  it('le calendrier de production porte bien 21 jours, dont 16 PERMANENT', () => {
    expect(CALENDRIER_V1).toHaveLength(21)
    expect(CALENDRIER_V1.filter((e) => e.typeEntree === 'PERMANENT')).toHaveLength(16)
    expect(CALENDRIER_V1.filter((e) => e.typeEntree === 'A_SURVEILLER')).toHaveLength(5)
  })

  /**
   * Un an et deux mois de départs : la tête d'affiche (départ + 30 + 1, report compris) couvre
   * alors tous les jours atteignables de 2026.
   */
  function balayer(
    locale: 'fr' | 'en' | 'ht',
    restreindre: boolean,
    /**
     * ⚠️ **LEQUEL DES DEUX RENVOIS** — voir l'en-tête du bloc. Le défaut est le renvoi
     * historique, celui que la restriction coupe ; `'lectures'` cherche celui que le moteur
     * écrit quand une lecture nommée est ouverte, et que la restriction laisse passer.
     */
    lequel: 'avertissements' | 'lectures' = 'avertissements',
  ): string[] {
    const renvoi =
      lequel === 'avertissements'
        ? phrases(locale).voirAvertissements
        : phrases(locale).voirLecturesEtAvertissements
    const vus: string[] = []
    let depart = parseIso('2025-11-01')!
    while (formatIso(depart) <= '2026-12-31') {
      const r = calcul(formatIso(depart), 'PUBLIC', 30, locale)
      const vu = restreindre ? (restreindreAuFrancPur(r, locale) as ResultatCalcul) : r
      if (vu.teteAffiche.y === 2026) {
        // On regarde TOUTES les étapes, pas seulement la dernière : le jour où le moteur
        // déplacerait le renvoi, le balayage doit encore le voir.
        if (vu.etapes.some((e) => e.texte.includes(renvoi))) vus.push(formatIso(vu.teteAffiche))
      }
      depart = addDays(depart, 1)
    }
    // ⚠️ **DÉDOUBLONNÉ, ET LE DOUBLON EST UN FAIT DU REPORT** : depuis la cascade, plusieurs
    // départs arrivent sur la MÊME date (le mercredi 18 février 2026 est atteint depuis quatre
    // départs, les 16 et 17 étant Lundi et Mardi Gras). On énumère des JOURS DE CALENDRIER,
    // pas des départs.
    return [...new Set(vus)].sort()
  }

  /** LA SONDE : sans la restriction, le renvoi orphelin est là, et sur ces jours-là. */
  it('la sonde tient : le moteur écrit encore le renvoi sur les jours À SURVEILLER', () => {
    expect(balayer('fr', false)).toEqual([
      '2026-02-07', // samedi — 7 février
      '2026-02-18', // Mercredi des Cendres
      '2026-04-02', // Jeudi Saint
      '2026-05-14', // Ascension
      '2026-10-24', // samedi — Jour des Nations Unies
    ])
  })

  it('après restriction, PLUS AUCUN — dans les trois langues', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(balayer(l, false).length, `sonde ${l}`).toBe(5)
      expect(balayer(l, true), l).toEqual([])
    }
  })

  /**
   * ⚠️ **LE SECOND RENVOI — CELUI QUE LE BALAYAGE NE CHERCHAIT PAS.** Voir l'en-tête du bloc.
   * Deux jours de la fenêtre l'atteignent, et ce sont les deux demi-journées du calendrier de
   * la version 1 :
   *
   *   - **lundi 16 février 2026** — le Lundi Gras, `DEMI_JOURNEE_APRES_MIDI` depuis le décret
   *     du 11 décembre 2024. La lecture `DEMI_JOURNEE` s'ouvre, le moteur écrit donc le renvoi
   *     aux lectures, et la restriction le laisse passer ;
   *   - **lundi 2 novembre 2026** — la Fête des Morts, que la version 1 du calendrier chôme
   *     « à partir de midi » sur les décrets de 1982 et 1985 (le calendrier COURANT, lui, la
   *     porte en journée entière : ce jour-là disparaît sous la version 2).
   *
   * ⚠️ **CE TEST FIXE UN ÉTAT CONSTATÉ, PAS UN ÉTAT VOULU.** Il est ici pour que la question
   * ne se reperde pas : si la rédaction décide de couper aussi ce renvoi, c'est LUI qui
   * rougira, et la liste attendue deviendra vide comme celle du test précédent.
   */
  it('… mais le renvoi aux LECTURES, lui, traverse : deux jours, et le balayage les nomme', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      // La sonde : le moteur l'écrit bien, sur ces deux jours-là et pas d'autres.
      expect(balayer(l, false, 'lectures'), `sonde ${l}`).toEqual(['2026-02-16', '2026-11-02'])
      // Et la restriction ne le coupe pas — elle ne connaît que l'autre gabarit.
      expect(balayer(l, true, 'lectures'), l).toEqual(['2026-02-16', '2026-11-02'])
    }
    // ⚠️ Les deux gabarits sont bien DISTINCTS, et aucun n'est un préfixe de l'autre : sans
    // cela, les deux balayages compteraient les mêmes phrases et l'un des deux mentirait.
    for (const l of ['fr', 'en', 'ht'] as const) {
      const p = phrases(l)
      expect(p.voirLecturesEtAvertissements, l).not.toBe(p.voirAvertissements)
      expect(p.voirLecturesEtAvertissements.includes(p.voirAvertissements), l).toBe(false)
      expect(p.voirAvertissements.includes(p.voirLecturesEtAvertissements), l).toBe(false)
    }
  })

  /**
   * Ce qui reste de la phrase doit être une phrase : `finaleCalendrier` s'arrête sur une
   * parenthèse et `finaleSamediPorteSansProroger` sur un mot — sans le point final, l'étape
   * se terminerait en l'air dans le presse-papiers et à l'impression.
   */
  it('la phrase reste entière, ponctuée, et nomme toujours le jour', () => {
    // 2 mars 2026 + 30 jours francs → échéance jeudi 2 avril 2026, le Jeudi Saint.
    const brut = calcul('2026-03-02', 'PUBLIC')
    const derniereBrute = brut.etapes[brut.etapes.length - 1]
    expect(formatIso(brut.teteAffiche)).toBe('2026-04-02')
    expect(derniereBrute.texte).toContain('Jeudi Saint')
    expect(derniereBrute.texte).toContain('voir les avertissements ci-dessous')

    const apres = restreindreAuFrancPur(brut, 'fr') as ResultatCalcul
    const derniere = apres.etapes[apres.etapes.length - 1]
    expect(derniere.cle).toBe(derniereBrute.cle)
    expect(derniere.date).toEqual(derniereBrute.date)
    expect(derniere.texte).toContain('Jeudi Saint')
    expect(derniere.texte).not.toContain('voir les avertissements')
    expect(derniere.texte.endsWith('.')).toBe(true)
  })

  /**
   * ⚠️ La restriction ne touche QUE le suffixe. Une étape qui ne se termine pas par le renvoi
   * — l'immense majorité — traverse au caractère près, point final compris.
   */
  it('une étape finale SANS renvoi n’est pas touchée', () => {
    const brut = calcul('2026-06-04', 'PUBLIC')
    const apres = restreindreAuFrancPur(brut, 'fr') as ResultatCalcul
    expect(apres.etapes).toEqual(brut.etapes)
  })

  /** La date publique, bout en bout : c'est elle que l'écran affiche. */
  it('la date publique du cas de la cliente est bien le 6 juillet 2026', () => {
    expect(datePublique('2026-06-03', 31)).toBe('2026-07-06')
    expect(datePublique('2025-10-01', 30)).toBe('2025-11-03')
    expect(datePublique('2026-06-04', 29)).toBe('2026-07-04') // samedi, intact
  })
})

// ===========================================================================
// 5. LES DEUX SURFACES — **elles doivent rendre la même date, ou la NOMMER**
// ===========================================================================

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **LE DÉFAUT BLOQUANT : DEUX ÉCRANS DE LA MÊME MAISON, DEUX DATES.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * À durée et régime IDENTIQUES, la surface publique (tête large, cascade) et le portail (tête
 * étroite, un jour) rendaient deux dates différentes — et le public était TOUJOURS le plus
 * tardif. Sur un délai de forclusion, l'avocat qui lit la page publique dépose trop tard, et la
 * surface professionnelle de la même plateforme dit que le délai était clos.
 *
 * Aucun test ne le voyait : `surfaces-delais.test.ts` contrôle l'étanchéité des graphes d'import
 * et les libellés, **jamais une date**. Ce bloc-ci balaie les 1 826 départs de 2025 à 2029 et
 * compare les deux têtes d'affiche.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **TOUS LES CHIFFRES DE CE BLOC ONT ÉTÉ REMESURÉS LE 20 AOÛT 2026 (SOIR).**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Ils portaient encore la mesure du matin (56 divergences, 89 jours cumulés, 18 resserrés,
 * 25/29/2) et rendaient tout autre chose : les deux décisions du soir — les fêtes NATIONALES et
 * la CASCADE passées de la réserve à la RÈGLE — ont déplacé les deux têtes d'affiche en même
 * temps, et le correctif du Lundi Gras (défaut 2 de la troisième recette) a retiré du portail
 * les 40 dates que la demi-journée retardait. **Un oracle rouge ne garde plus rien** : la
 * prochaine dérive serait passée dans un fichier déjà en échec. Les valeurs ci-dessous sont
 * celles que le moteur rend AUJOURD'HUI ; chacune porte, en commentaire, ce qui l'a bougée.
 *
 * ⚠️ **LA MESURE QUI COMPTE EST LE ZÉRO** : sous le calendrier COURANT et les règles COURANTES,
 * les deux surfaces rendent la même date sur les 1 826 départs, pour 8, 15, 30 et 31 jours.
 * C'est ce zéro qui protège la cliente, et c'est le seul chiffre de ce fichier dont une hausse
 * signifierait qu'un avocat peut lire deux dates différentes sur deux écrans de la même maison.
 * `LE_ZERO_DE_LA_V2` le fixe, et il est vérifié SÉPARÉMENT des comptes de la version 1.
 *
 * ⚠️ C'est un ORACLE, pas une tolérance : ces nombres ne doivent pas bouger sans décision.
 */
describe('§ 0 — les deux surfaces, la même date ou la réserve', () => {
  /** La tête d'affiche sous la configuration demandée, en ISO. */
  const tete = (iso: string, large: boolean, jours: number): string => {
    const base = entreeAutre('PUBLIC', jours)
    const r = calculer({
      depart: parseIso(iso)!,
      entree: large ? base : entreeLectureStricte(base),
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
      locale: 'fr',
    })
    if (r.statut !== 'CALCUL') throw new Error(`attendu CALCUL, reçu ${r.statut}`)
    return formatIso(r.teteAffiche)
  }

  /** Les 1 826 départs du 1er janvier 2025 au 31 décembre 2029. */
  const departs = (): string[] => {
    const xs: string[] = []
    let d = parseIso('2025-01-01')!
    while (formatIso(d) <= '2029-12-31') {
      xs.push(formatIso(d))
      d = addDays(d, 1)
    }
    return xs
  }

  /**
   * La même mesure, sous n'importe quel calendrier ET n'importe quelle version de RÈGLES.
   *
   * ⚠️ `versionRegles` est entré dans cette sonde le 20 août 2026 (soir) : sans lui, le bloc
   * mesurait deux calendriers sous une seule lecture et ne pouvait pas dire laquelle des deux
   * décisions du soir avait déplacé quoi.
   */
  const teteSous = (
    iso: string,
    large: boolean,
    jours: number,
    entrees: readonly (typeof CALENDRIER_V1)[number][],
    version: number,
    versionRegles = VERSION_REGLES_COURANTE,
  ): string => {
    const base = entreeAutre('PUBLIC', jours)
    const r = calculer({
      depart: parseIso(iso)!,
      entree: large ? base : entreeLectureStricte(base),
      versionCalendrier: version,
      entreesCalendrier: entrees,
      versionRegles,
      locale: 'fr',
    })
    if (r.statut !== 'CALCUL') throw new Error(`attendu CALCUL, reçu ${r.statut}`)
    return formatIso(r.teteAffiche)
  }

  const mesurer = (
    entrees: readonly (typeof CALENDRIER_V1)[number][],
    version: number,
    jours: number,
    versionRegles = VERSION_REGLES_COURANTE,
  ) => {
    const ecarts: Record<number, number> = {}
    let n = 0
    let joursCumules = 0
    for (const iso of departs()) {
      const large = teteSous(iso, true, jours, entrees, version, versionRegles)
      const etroite = teteSous(iso, false, jours, entrees, version, versionRegles)
      if (large === etroite) continue
      n += 1
      const d = diffDays(parseIso(large)!, parseIso(etroite)!)
      joursCumules += d
      ecarts[d] = (ecarts[d] ?? 0) + 1
    }
    return { n, joursCumules, ecarts, deuxPlus: (ecarts[2] ?? 0) + (ecarts[3] ?? 0) }
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LE ZÉRO DE LA VERSION 2 — LE SEUL CHIFFRE QUI PROTÈGE LA CLIENTE.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Sous le calendrier COURANT et les règles COURANTES, la surface publique et le portail
   * rendent la MÊME date sur les 1 826 départs de 2025 à 2029, pour chacune des quatre durées
   * éprouvées. Aucune divergence, aucun jour d'écart, aucune réserve à nommer.
   *
   * ⚠️ **CE TEST DOIT ÊTRE LE PREMIER À ROUGIR.** Tout ce que ce fichier mesure par ailleurs
   * décrit un état HISTORIQUE (calendrier de la version 1, règles de la version 1) que seuls
   * les permaliens rejouent. Celui-ci décrit ce que la plateforme sert aujourd'hui : s'il
   * passe de 0 à 1, un avocat peut lire deux dates différentes sur deux écrans de la même
   * maison — c'est le défaut bloquant qui a ouvert ce bloc, et il serait revenu.
   *
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **UN ZÉRO QUI NE PEUT PAS ROUGIR NE GARDE RIEN — ET CELUI-CI LE POUVAIT À PEINE.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le compte se fait en reposant l'entrée avec `prorogationTeteLarge: false`. Or ce drapeau n'a
   * plus qu'UN effet : les lignes `autorite: 'REDACTION'`, et **le calendrier de la version 2
   * n'en porte aucune**. Sous ce calendrier, les deux configurations sont donc identiques par
   * CONSTRUCTION : le zéro tombait tout seul, et il serait resté à zéro même si
   * `entreeLectureStricte` avait cessé de poser le drapeau, même si `entreeProroge` avait cessé
   * de le lire, même si le report tout entier avait disparu du moteur.
   *
   * Trois vérifications sont donc ajoutées AU MÊME test, parce qu'elles ne valent qu'ensemble :
   *
   *   1. **la sonde MORD** — la même mesure, sur le calendrier de la version 1, ne rend PAS
   *      zéro. C'est ce qui distingue « les deux surfaces s'accordent » de « la mesure ne
   *      mesure plus rien » ;
   *   2. **le zéro est STRUCTUREL, et on dit pourquoi** — aucune ligne `REDACTION` au
   *      calendrier de la version 2. Le jour où une main en réintroduira une (ou fera porter au
   *      drapeau un second effet), ce test dira laquelle des deux causes a bougé au lieu de
   *      montrer un 1 sans explication ;
   *   3. **le report existe toujours** — la tête d'affiche du cas de contrôle de la cliente est
   *      bien déplacée par le calcul. Un moteur qui aurait perdu la prorogation rendrait, lui
   *      aussi, zéro divergence : deux surfaces également fausses s'accordent parfaitement.
   */
  it('LE ZÉRO DE LA V2 — sous le calendrier et les règles COURANTS, aucune divergence', () => {
    expect(departs()).toHaveLength(1826)
    for (const jours of [8, 15, 30, 31]) {
      const m = mesurer(CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE, jours)
      expect(m.n, `${jours} jours : divergences`).toBe(0)
      expect(m.joursCumules, `${jours} jours : jours cumulés`).toBe(0)
      expect(m.ecarts, `${jours} jours : distribution`).toEqual({})
    }

    // 1. La sonde mord : le même balayage, le même comparateur, un autre calendrier.
    for (const jours of [8, 15, 30, 31]) {
      expect(
        mesurer(CALENDRIER_V1, 1, jours).n,
        `${jours} jours : la sonde doit MORDRE sur le calendrier v1`,
      ).toBeGreaterThan(0)
    }

    // 2. Le zéro est structurel, et sa cause est nommée : plus une seule ligne de la RÉDACTION.
    expect(CALENDRIER_COURANT.filter((e) => e.autorite === 'REDACTION').map((e) => e.cle)).toEqual([])
    expect(CALENDRIER_V1.filter((e) => e.autorite === 'REDACTION').map((e) => e.cle).sort()).toEqual([
      '14-aout',
      '1er-novembre',
      '20-septembre',
      'lundi-gras',
    ])

    // 3. Le report n'a pas disparu — sans quoi les deux surfaces s'accorderaient sur une date
    // fausse. Le cas de contrôle de la cliente, sous le calendrier courant : le samedi
    // 1er novembre 2025 (La Toussaint) est franchi, le dimanche 2 aussi, et la tête arrive au
    // LUNDI 3 — la date que Me Vaval a validée, des deux côtés.
    for (const large of [true, false]) {
      expect(
        teteSous('2025-10-01', large, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
        large ? 'tête large' : 'tête étroite',
      ).toBe('2025-11-03')
    }
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LE MÊME ZÉRO, MAIS SUR LA DATE QUE L'ÉCRAN AFFICHE VRAIMENT.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le test ci-dessus compare deux sorties du MOTEUR. Ce n'est pas tout à fait ce que la
   * cliente lit : la surface publique ne rend pas `calculer()`, elle rend
   * `restreindreAuFrancPur(calculer())` — et cette fonction réécrit la phrase de sécurité,
   * vide le bloc praticable, filtre les avertissements et coupe un renvoi terminal. Son
   * en-tête promet que la tête d'affiche « n'est jamais retouchée ici », mais **une promesse
   * écrite dans un commentaire n'est pas un capteur** : le jour où la restriction reculerait
   * la date d'un jour — pour « éviter d'afficher un jour à demi chômé », par exemple —, le
   * zéro du test précédent resterait vert et les deux écrans rendraient à nouveau deux dates.
   *
   * On refait donc le balayage complet en comparant **la date rendue** à la tête étroite du
   * portail, et on mesure au passage que la restriction ne déplace RIEN.
   *
   *   |                                  |  v1  |  v2 (courant) |
   *   | date rendue ≠ tête du portail    |  16  |       0       |
   *   | départs que la restriction bouge |   0  |       0       |
   *
   * ⚠️ Les 16 de la version 1 sont la SONDE : sans eux, ce test serait vert sur un moteur qui
   * aurait perdu la restriction, perdu le report, ou rendu la même date fausse des deux côtés.
   */
  it('LE ZÉRO, BOUT EN BOUT — la date RENDUE au public est celle du portail, et la restriction ne la bouge pas', () => {
    const mesurerRendu = (
      entrees: readonly (typeof CALENDRIER_V1)[number][],
      version: number,
      jours: number,
    ) => {
      let ecart = 0
      let deplacee = 0
      for (const iso of departs()) {
        const base = entreeAutre('PUBLIC', jours)
        const commun = { depart: parseIso(iso)!, versionCalendrier: version, entreesCalendrier: entrees, locale: 'fr' as const }
        const pub = calculer({ ...commun, entree: base })
        const por = calculer({ ...commun, entree: entreeLectureStricte(base) })
        if (pub.statut !== 'CALCUL' || por.statut !== 'CALCUL') throw new Error(`${iso} : ${pub.statut}/${por.statut}`)
        const rendu = restreindreAuFrancPur(pub, 'fr') as ResultatCalcul
        if (formatIso(rendu.teteAffiche) !== formatIso(pub.teteAffiche)) deplacee += 1
        if (formatIso(rendu.teteAffiche) !== formatIso(por.teteAffiche)) ecart += 1
      }
      return { ecart, deplacee }
    }

    for (const jours of [8, 15, 30, 31]) {
      const v2 = mesurerRendu(CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE, jours)
      expect(v2.ecart, `${jours} jours : la date RENDUE diffère de celle du portail`).toBe(0)
      expect(v2.deplacee, `${jours} jours : la restriction a déplacé la date`).toBe(0)

      // La sonde mord : sur le calendrier de la version 1, l'écart existe — et il vaut
      // exactement celui que le test précédent mesure sur les têtes du moteur.
      const v1 = mesurerRendu(CALENDRIER_V1, 1, jours)
      expect(v1.ecart, `${jours} jours : la sonde doit MORDRE sur le calendrier v1`).toBe(16)
      expect(v1.deplacee, `${jours} jours : la restriction a déplacé la date (v1)`).toBe(0)
    }
  })

  /**
   * ⚠️ **LES DEUX MESURES DE LA VERSION 1 DU CALENDRIER, SOUS LES DEUX VERSIONS DE RÈGLES.**
   * C'est le seul endroit du dépôt où la version de règles a un effet MESURÉ plutôt que
   * supposé, et c'est ce qui fait de `rl` autre chose qu'un paramètre décoratif :
   *
   *   | calendrier v1        | règles v1        | règles v2 (courantes) |
   *   | départs divergents   |       18         |          16           |
   *   | jours d'écart cumulés|       18         |          25           |
   *   | distribution         |     {1:18}       |    {1:8, 2:7, 3:1}    |
   *
   * Les 18 de la version 1 sont les quatre jours sans texte instituant, prorogés d'UN jour par
   * la surface publique et refusés par le portail. Sous les règles de la version 2, la cascade
   * les prolonge quand le lendemain est lui-même chômé : moins de départs divergent (16), mais
   * ils divergent PLUS (25 jours cumulés au lieu de 18).
   */
  it('v1 — le compte des divergences est CELUI-CI, et il ne bouge pas sans décision', () => {
    expect(departs()).toHaveLength(1826)
    for (const jours of [8, 15, 30, 31]) {
      const r1 = mesurer(CALENDRIER_V1, 1, jours, 1)
      expect(r1.n, `${jours} jours, règles v1`).toBe(18)
      expect(r1.joursCumules, `${jours} jours, règles v1`).toBe(18)
      expect(r1.ecarts, `${jours} jours, règles v1`).toEqual({ 1: 18 })

      const r2 = mesurer(CALENDRIER_V1, 1, jours, VERSION_REGLES_COURANTE)
      expect(r2.n, `${jours} jours, règles courantes`).toBe(16)
      expect(r2.joursCumules, `${jours} jours, règles courantes`).toBe(25)
      expect(r2.ecarts, `${jours} jours, règles courantes`).toEqual({ 1: 8, 2: 7, 3: 1 })
    }
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **L'ÉCART, MESURÉ AVANT ET APRÈS LA BASCULE DE CALENDRIER** (20 août 2026).
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le *Décret du 11 décembre 2024 déterminant les Fêtes Légales* donne un texte aux quatre
   * jours que la version 1 portait sans fondement. Ils prorogent donc maintenant des DEUX
   * côtés — et l'écart ne se resserre pas, **il disparaît** :
   *
   *   |                                       |  v1  |  v2  |
   *   | départs divergents                    |  16  |   0  |
   *   | jours d'écart CUMULÉS                 |  25  |   0  |
   *   | départs à 2 jours d'écart ou plus     |   8  |   0  |
   *
   * ⚠️ **CE TABLEAU DISAIT 56 → 53 JUSQU'AU 20 AOÛT 2026 AU SOIR**, et le commentaire
   * expliquait doctement que « le nombre de départs divergents ne tombe que de 3 ; c'est
   * l'AMPLITUDE qui s'effondre ». C'était vrai tant que le portail gardait une tête ÉTROITE.
   * Me Vaval ayant répondu OUI aux fêtes nationales et à la cascade, les deux surfaces
   * appliquent la même version de règles, et **le seul écart qui subsiste est celui des quatre
   * jours sans texte de la version 1 du calendrier** — donc rien du tout sous la version 2, qui
   * n'en porte aucun. Le mécanisme reste mesuré parce que les permaliens `c=1` le rejouent.
   */
  it('v2 — l’écart ne se resserre pas, il DISPARAÎT : 16 → 0 départs, 25 → 0 jours cumulés', () => {
    for (const jours of [8, 15, 30, 31]) {
      const v1 = mesurer(CALENDRIER_V1, 1, jours)
      const v2 = mesurer(CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE, jours)
      expect(v1.n, `v1 ${jours} j`).toBe(16)
      expect(v2.n, `v2 ${jours} j`).toBe(0)
      expect(v1.joursCumules, `v1 ${jours} j`).toBe(25)
      expect(v2.joursCumules, `v2 ${jours} j`).toBe(0)
      expect(v1.deuxPlus, `v1 ${jours} j`).toBe(8)
      expect(v2.deuxPlus, `v2 ${jours} j`).toBe(0)
      expect(v1.ecarts, `v1 ${jours} j`).toEqual({ 1: 8, 2: 7, 3: 1 })
      expect(v2.ecarts, `v2 ${jours} j`).toEqual({})
    }
  })

  /**
   * ⚠️ **AUCUN DÉPART NE S'ÉLARGIT.** Une bascule de calendrier qui creuserait l'écart sur ne
   * serait-ce qu'un départ serait une régression, et elle passerait inaperçue derrière un
   * total qui, lui, baisse. On compare donc départ par départ.
   */
  it('… départ par départ : 16 resserrés, 1 810 inchangés, AUCUN élargi', () => {
    let resserres = 0
    let inchanges = 0
    let elargis = 0
    for (const iso of departs()) {
      const g1 = diffDays(
        parseIso(teteSous(iso, true, 30, CALENDRIER_V1, 1))!,
        parseIso(teteSous(iso, false, 30, CALENDRIER_V1, 1))!,
      )
      const g2 = diffDays(
        parseIso(teteSous(iso, true, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE))!,
        parseIso(teteSous(iso, false, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE))!,
      )
      if (g2 < g1) resserres += 1
      else if (g2 === g1) inchanges += 1
      else elargis += 1
    }
    // ⚠️ Le zéro est le seul des trois qui soit un INTERDIT : creuser l'écart sur ne serait-ce
    // qu'un départ serait une régression, et elle passerait inaperçue derrière un total qui
    // baisse. Les deux autres nombres sont des oracles — remesurés le 20 août 2026 au soir
    // (ils disaient 18 / 1 808 sous une tête de portail encore étroite).
    expect(elargis).toBe(0)
    expect(resserres).toBe(16)
    expect(inchanges).toBe(1810)
    expect(resserres + inchanges + elargis).toBe(1826)
  })

  /** Les départs d'une fenêtre quelconque — le balayage ci-dessus est figé sur 2025-2029. */
  const departsEntre = (a: string, b: string): string[] => {
    const xs: string[] = []
    let d = parseIso(a)!
    while (formatIso(d) <= b) {
      xs.push(formatIso(d))
      d = addDays(d, 1)
    }
    return xs
  }

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **DÉFAUT 6 — CE QUE LA FENÊTRE 2025-2029 NE MONTRE PAS.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le bloc ci-dessus ne mesure QUE des départs postérieurs au décret, et le script de bascule
   * en concluait « 1 808 ne bougent pas · AUCUNE ne s'éloigne ». Un opérateur y lit
   * raisonnablement « et rien d'autre ne bouge ». C'est inexact AVANT le 11 décembre 2024 :
   * les quatre ajouts y perdent leur effet (`appliqueDepuis: '2024-12-11'`, qui est le bon
   * choix juridique), et c'est la tête PUBLIQUE — qui les prorogeait déjà sous la v1 — qui
   * devient plus PRÉCOCE. Le sens est le bon (plus précoce est plus prudent), mais un dossier
   * de 2019 recalculé sur la page publique ne rend plus la date qu'il rendait la veille.
   *
   * ⚠️ C'est un ORACLE, comme le bloc 2025-2029 : ces chiffres ne doivent pas bouger sans
   * décision. Le bloc 4 de `scripts/migrer-calendrier-v2.ts` les porte à la rédaction.
   */
  it('DÉFAUT 6 — avant le 11 déc. 2024, la date PUBLIQUE devient plus précoce : 19 puis 21 départs', () => {
    const fenetres: readonly [string, string, number, number][] = [
      // début ── fin ── total de départs ── divergences attendues
      ['2015-01-01', '2019-12-31', 1826, 19],
      ['2020-01-01', '2024-11-30', 1796, 21],
    ]
    for (const [a, b, total, attendues] of fenetres) {
      const isos = departsEntre(a, b)
      expect(isos, `${a} → ${b}`).toHaveLength(total)
      let publicDivergents = 0
      let plusTardives = 0
      let portailDivergents = 0
      const clesTardives = new Set<string>()
      for (const iso of isos) {
        const pub1 = teteSous(iso, true, 30, CALENDRIER_V1, 1)
        const pub2 = teteSous(iso, true, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE)
        if (pub1 !== pub2) {
          publicDivergents += 1
          if (pub2 > pub1) {
            plusTardives += 1
            let d = parseIso(pub1)!
            while (formatIso(d) <= pub2) {
              for (const e of entreesDuJour(d, CALENDRIER_COURANT)) clesTardives.add(e.cle)
              d = addDays(d, 1)
            }
          }
        }
        const por1 = teteSous(iso, false, 30, CALENDRIER_V1, 1)
        const por2 = teteSous(iso, false, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE)
        if (por1 !== por2) portailDivergents += 1
      }
      expect(publicDivergents, `${a} → ${b} : public`).toBe(attendues)
      /**
       * ⚠️ **SIX DÉPARTS PAR FENÊTRE VONT DANS L'AUTRE SENS, ET CE N'EST PAS UN DÉFAUT DU
       * MOTEUR : C'EST UN DÉSACCORD DES DEUX CALENDRIERS SUR LE 2 NOVEMBRE.**
       *
       * `CALENDRIER_V1` porte le 2 novembre `DEMI_JOURNEE_APRES_MIDI` depuis 1989 (« les
       * décrets de 1982 et 1985 le chôment à partir de midi ») ; `CALENDRIER_V2` le porte
       * `JOURNEE_ENTIERE`, **lui aussi depuis 1989**, parce que le décret du 11 décembre 2024
       * ne lui met aucune restriction d'horaire. Tant que la demi-journée comptait pour un jour
       * plein, les deux se comportaient pareil et le désaccord était invisible. Depuis que la
       * demi-journée ne proroge plus (défaut 2), il a un effet : sur ces six départs, la
       * version 1 rend une date PLUS PRÉCOCE que la version 2.
       *
       * ⚠️ **QUESTION OUVERTE À LA RÉDACTION** : la version 2 affirme, par son
       * `appliqueDepuis: DEPUIS_1989`, que le 2 novembre était chômé toute la journée entre
       * 1989 et 2024 — ce que la note de la version 1 contredit. Le test MESURE le désaccord
       * au lieu de le taire ; il ne le tranche pas, et aucune donnée de calendrier n'a été
       * touchée.
       */
      expect(plusTardives, `${a} → ${b} : plus tardives`).toBe(6)
      expect([...clesTardives].sort(), `${a} → ${b} : imputation`).toEqual(['2-novembre'])
      // Le portail bouge d'autant, et pour la même raison : sous les règles courantes il ne
      // proroge plus sur la demi-journée du 2 novembre de la version 1.
      expect(portailDivergents, `${a} → ${b} : portail`).toBe(6)
    }
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **DÉFAUT 5 — LE LUNDI GRAS : UNE DÉCISION QUI ACQUIERT UN EFFET, VERS LE PLUS TARD.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le décret ne chôme le Lundi Gras qu'« à partir de midi » (art. 2, 1°) — la seule
   * restriction d'horaire de la liste, portée fidèlement par `journee`. La rédaction comptait
   * la demi-journée pour un JOUR PLEIN. Cette décision avait été prise sous la v1, où
   * `lundi-gras` était `autorite: 'REDACTION'` et se trouvait donc écarté de la tête d'affiche
   * du portail : elle ne déplaçait RIEN. En v2 la ligne devient `TEXTE`, elle prorogeait en
   * tête, et un jour entier était ajouté à raison d'une matinée qui reste ouvrable.
   *
   * ⚠️ **CORRIGÉ LE 20 AOÛT 2026 (SOIR) — défaut 2 de la troisième recette.** `entreeProroge`
   * lit désormais `journee` sous le drapeau `demiJournee` de la version de règles : sous les
   * règles courantes, le Lundi Gras ne proroge plus la tête d'affiche, et la date tardive est
   * NOMMÉE par la lecture `DEMI_JOURNEE` au lieu d'être imposée. Ce test le prouve par la
   * DISPARITION de la clé `lundi-gras` de la table d'imputation : elle y pesait 5 des 18
   * déplacements sous les règles de la version 1, elle en pèse 0 sous les règles courantes.
   */
  it('DÉFAUT 5 — le Lundi Gras ne déplace PLUS la tête du portail ; il la nommait 5 fois sur 18', () => {
    const AJOUTS_2024 = ['lundi-gras', '14-aout', '20-septembre', '1er-novembre']
    const imputer = (versionRegles: number) => {
      const impute: Record<string, number> = {}
      let deplacements = 0
      for (const iso of departs()) {
        const v1 = teteSous(iso, false, 30, CALENDRIER_V1, 1, versionRegles)
        const v2 = teteSous(
          iso,
          false,
          30,
          CALENDRIER_COURANT,
          VERSION_CALENDRIER_COURANTE,
          versionRegles,
        )
        if (v1 === v2) continue
        deplacements += 1
        // ⚠️ TOUJOURS vers le PLUS TARD : la prorogation ajoute des jours, elle n'en retire pas.
        expect(v2 > v1, `${iso} : ${v1} → ${v2}`).toBe(true)
        const cles = new Set<string>()
        let d = parseIso(v1)!
        while (formatIso(d) <= v2) {
          for (const e of entreesDuJour(d, CALENDRIER_COURANT)) {
            if (AJOUTS_2024.includes(e.cle)) cles.add(e.cle)
          }
          d = addDays(d, 1)
        }
        for (const c of cles) impute[c] = (impute[c] ?? 0) + 1
      }
      return { deplacements, impute }
    }

    // Ce que la demi-journée coûtait, sous les règles de la version 1 : cinq déplacements.
    const avant = imputer(1)
    expect(avant.deplacements).toBe(18)
    expect(avant.impute).toEqual({
      'lundi-gras': 5,
      '14-aout': 5,
      '20-septembre': 4,
      '1er-novembre': 4,
    })

    // Et ce qu'elle coûte sous les règles courantes : RIEN. La clé a disparu de la table.
    const apres = imputer(VERSION_REGLES_COURANTE)
    expect(apres.deplacements).toBe(21)
    expect(apres.impute).toEqual({ '14-aout': 6, '20-septembre': 5, '1er-novembre': 5 })
    expect(Object.keys(apres.impute)).not.toContain('lundi-gras')
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **DÉFAUT 2 DE LA TROISIÈME RECETTE — LES 40 DATES QUE LA DEMI-JOURNÉE RETARDAIT.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le champ `journee` était renseigné (`feries.ts:717`) et n'était lu par personne :
   * `entreeProroge` comptait la matinée ouvrable du Lundi Gras pour un jour plein. Mesuré sur
   * les 7 304 calculs de ce balayage (1 826 départs × 8/15/30/31 jours) : **40 dates limites
   * retardées de DEUX jours** — le Mardi Gras, chômé en journée ENTIÈRE, suit toujours le Lundi
   * Gras, et la cascade sautait les deux. Toujours dans le sens du report, c'est-à-dire du
   * risque de forclusion : 20 quand l'échéance tombe le Lundi Gras lui-même, 20 de plus quand
   * elle tombe le dimanche qui le précède et que la cascade y atterrit.
   *
   * Ce test est le CAPTEUR de la règle 4 du § 0 : la date tardive n'a pas disparu, elle a
   * changé de statut — elle est passée de la tête d'affiche à une lecture NOMMÉE.
   */
  it('DÉFAUT 2 — les 40 dates du Lundi Gras sont NOMMÉES, plus jamais imposées', () => {
    let nommees = 0
    let imposeesSousV1 = 0
    const ecarts: Record<number, number> = {}
    for (const jours of [8, 15, 30, 31]) {
      for (const iso of departs()) {
        const base = entreeAutre('PUBLIC', jours)
        const r = calculer({ depart: parseIso(iso)!, entree: base, locale: 'fr' })
        if (r.statut !== 'CALCUL') throw new Error(r.statut)
        const dj = r.lectures.find((l) => l.cle === 'DEMI_JOURNEE')
        if (dj) {
          nommees += 1
          // La lecture nommée est TOUJOURS plus tardive que la tête : c'est l'invariant du
          // bloc 10, et c'est ce qui rend le choix sûr. L'écart vaut UN jour, ou DEUX quand le
          // Mardi Gras suit immédiatement le Lundi Gras — ce qui est le cas ordinaire.
          expect(comparer(dj.date, r.teteAffiche), iso).toBeGreaterThan(0)
          ecarts[diffDays(dj.date, r.teteAffiche)] =
            (ecarts[diffDays(dj.date, r.teteAffiche)] ?? 0) + 1
        }
        // ⚠️ **CE QUE LA TÊTE D'AFFICHE FAIT MAINTENANT** : elle s'ARRÊTE sur le Lundi Gras,
        // au lieu de le sauter. C'est la mesure du correctif, et elle ne dépend d'aucune autre
        // règle (comparer avec `versionRegles: 1` mêlerait la cascade à la demi-journée).
        if (dj) {
          imposeesSousV1 += 1
          const surLaTete = entreesDuJour(r.teteAffiche, CALENDRIER_COURANT).map((e) => e.cle)
          expect(surLaTete, iso).toContain('lundi-gras')
        }
      }
    }
    expect(nommees).toBe(40)
    expect(imposeesSousV1).toBe(40)
    // ⚠️ L'écart est de DEUX jours partout : le Lundi Gras est toujours suivi du Mardi Gras,
    // que le décret chôme en journée ENTIÈRE (art. 2, 2°). Compter la matinée du lundi pour
    // un jour plein coûtait donc deux jours, pas un.
    expect(ecarts).toEqual({ 2: 40 })
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LA RÈGLE DU LUNDI GRAS, EN ENTIER ET EN UN SEUL ENDROIT.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Décret du 11 décembre 2024, art. 2, 1° : le Lundi Gras est chômé **« à partir de midi »**.
   * C'est la seule restriction d'horaire de la liste, et elle se décompose en TROIS
   * obligations, qui étaient jusqu'ici éprouvées dans trois fichiers différents — donc jamais
   * ensemble, et l'une d'elles pas du tout :
   *
   *   1. **IL NE PROROGE PAS.** `entreeProroge` lit `journee` sous le drapeau `demiJournee`
   *      des règles de lecture. Une échéance qui tombe le Lundi Gras y RESTE : la matinée est
   *      ouvrable, l'acte peut y être signifié, et lui accorder un jour entier retarderait la
   *      date limite de deux jours (le Mardi Gras suit).
   *   2. **IL ARRÊTE LA CASCADE.** ⚠️ **C'EST LA MESURE QUI MANQUAIT, ET C'EST LA PLUS
   *      DANGEREUSE DES TROIS.** Un jour qui ne proroge pas ne doit pas non plus être
   *      FRANCHI : si la cascade, partie d'un dimanche, le sautait pour aller chercher le
   *      mercredi, la date limite serait retardée de deux jours sans qu'aucune lecture nommée
   *      ne le dise et sans que le compte des lectures (`DEMI_JOURNEE`, 40) bouge d'une unité.
   *      Le défaut 2 mesure la tête d'affiche ; il ne regardait pas `joursEcartes`.
   *   3. **IL SE DIT.** Sans mention, l'écran affiche une date limite qui tombe un jour à demi
   *      chômé sans dire que la fenêtre s'y ferme à midi — et le gabarit ordinaire
   *      (`publicDayHoliday`) serait doublement faux : muet sur l'heure, et laissant attendre
   *      un report qui n'a pas eu lieu.
   *
   * ⚠️ **CHAQUE MESURE PORTE SA SONDE** : la version 1 des règles rend l'inverse sur les trois
   * points. Sans elle, ce test resterait vert sur un moteur qui aurait cessé de connaître le
   * Lundi Gras — un calendrier vidé de sa ligne rendrait, lui aussi, 0 jour franchi.
   */
  it('LE LUNDI GRAS — il ne proroge pas, il ARRÊTE la cascade, et il se dit', () => {
    const lundiGras = CALENDRIER_COURANT.find((e) => e.cle === 'lundi-gras')
    expect(lundiGras, 'la ligne `lundi-gras` a disparu du calendrier courant').toBeTruthy()
    expect(lundiGras!.journee).toBe('DEMI_JOURNEE_APRES_MIDI')
    // Le Mardi Gras qui le suit est chômé en journée ENTIÈRE (art. 2, 2°) : c'est lui qui fait
    // que la demi-journée coûtait DEUX jours et non un.
    expect(CALENDRIER_COURANT.find((e) => e.cle === 'mardi-gras')!.journee).toBe('JOURNEE_ENTIERE')

    // ── 1. IL NE PROROGE PAS ────────────────────────────────────────────────────────────
    // La configuration de la TÊTE D'AFFICHE publique, reconstituée comme `calcul.ts` la pose
    // (bloc 7, `cfgTete`) : le seul champ qui varie ici est celui de la version de règles.
    const cfgTete = (versionRegles: number): Configuration => {
      const regles = reglesLecture(versionRegles)
      expect(regles, `version de règles ${versionRegles} inconnue`).not.toBeNull()
      return {
        franc: true,
        prorogation: true,
        feteNationale: regles!.feteNationale,
        redaction: true,
        cascade: regles!.cascade,
        demiJournee: regles!.demiJournee,
      }
    }
    // ⚠️ Le drapeau vient de la VERSION DE RÈGLES, pas de la ligne du calendrier : c'est ce
    // qui permet à un permalien `rl=1` de rejouer l'ancienne lecture sans toucher aux données.
    expect(reglesLecture(VERSION_REGLES_COURANTE)!.demiJournee).toBe(false)
    expect(reglesLecture(1)!.demiJournee).toBe(true)
    expect(entreeProroge(lundiGras!, cfgTete(VERSION_REGLES_COURANTE))).toBe(false)
    expect(entreeProroge(lundiGras!, cfgTete(1)), 'sonde : sous les règles v1 il prorogeait').toBe(true)
    // Et le Mardi Gras, lui, proroge sous les DEUX : la journée entière n'a jamais été en cause.
    const mardiGras = CALENDRIER_COURANT.find((e) => e.cle === 'mardi-gras')!
    expect(entreeProroge(mardiGras, cfgTete(VERSION_REGLES_COURANTE))).toBe(true)
    expect(entreeProroge(mardiGras, cfgTete(1))).toBe(true)
    // 16 janvier 2026 + 30 jours francs → échéance le lundi 16 février 2026, Lundi Gras. La
    // tête y RESTE, des deux côtés (c'est un des quatre cas de contrôle du décret de 2024).
    for (const large of [true, false]) {
      expect(
        teteSous('2026-01-16', large, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
        large ? 'tête large' : 'tête étroite',
      ).toBe('2026-02-16')
    }

    // ── 2. IL ARRÊTE LA CASCADE ─────────────────────────────────────────────────────────
    // Sur les 7 304 calculs du balayage (1 826 départs × 8/15/30/31 jours), le Lundi Gras
    // n'est JAMAIS parmi les jours écartés sous les règles courantes ; il l'était 20 fois
    // sous celles de la version 1, que rejoue un permalien `rl=1`.
    const franchi = (versionRegles: number): number => {
      let n = 0
      for (const jours of [8, 15, 30, 31]) {
        for (const iso of departs()) {
          const r = calculer({
            depart: parseIso(iso)!,
            entree: entreeAutre('PUBLIC', jours),
            versionCalendrier: VERSION_CALENDRIER_COURANTE,
            entreesCalendrier: CALENDRIER_COURANT,
            versionRegles,
            locale: 'fr',
          })
          if (r.statut !== 'CALCUL') throw new Error(`${iso} : ${r.statut}`)
          if (
            r.joursEcartes.some((j) =>
              entreesDuJour(j.date, CALENDRIER_COURANT).some((e) => e.cle === 'lundi-gras'),
            )
          ) {
            n += 1
          }
        }
      }
      return n
    }
    expect(franchi(VERSION_REGLES_COURANTE), 'la cascade a sauté le Lundi Gras').toBe(0)
    expect(franchi(1), 'sonde : sous les règles v1 la cascade le franchissait').toBe(20)

    // ── 3. IL SE DIT ────────────────────────────────────────────────────────────────────
    // Les cinq Lundis Gras de la fenêtre 2025-2029 — un par an, mobile parce qu'adossé à
    // Pâques. Ce sont EXACTEMENT les cinq dates sur lesquelles une tête d'affiche s'arrête.
    const LUNDIS_GRAS = ['2025-03-03', '2026-02-16', '2027-02-08', '2028-02-28', '2029-02-12']
    const teteSurUnLundiGras = new Set<string>()
    for (const jours of [8, 15, 30, 31]) {
      for (const iso of departs()) {
        const r = calculer({ depart: parseIso(iso)!, entree: entreeAutre('PUBLIC', jours), locale: 'fr' })
        if (r.statut !== 'CALCUL') throw new Error(`${iso} : ${r.statut}`)
        if (entreesDuJour(r.teteAffiche, CALENDRIER_COURANT).some((e) => e.cle === 'lundi-gras')) {
          teteSurUnLundiGras.add(formatIso(r.teteAffiche))
        }
      }
    }
    expect([...teteSurUnLundiGras].sort()).toEqual(LUNDIS_GRAS)

    for (const iso of LUNDIS_GRAS) {
      for (const l of ['fr', 'en', 'ht'] as const) {
        // La mention EXISTE, elle est du genre `DEMI_JOURNEE`, et il n'y en a qu'une : le
        // gabarit ordinaire de la fête légale ne doit pas s'y ajouter ni s'y substituer.
        const ms = mentionsJour(parseIso(iso)!, CALENDRIER_COURANT, l, true)
        expect(ms.map((m) => m.genre), `${iso} ${l}`).toEqual(['DEMI_JOURNEE'])
        expect(ms[0].cle, `${iso} ${l}`).toBe('lundi-gras')
        expect(ms[0].nom, `${iso} ${l}`).toBe('Lundi Gras')
        // Et le gabarit que l'écran posera dessus DIT l'heure — sans quoi la mention ne vaut
        // pas mieux que celle d'une fête légale ordinaire.
        const gabarit = getDictionary(l).delais.publicDayHalfDay
        expect(gabarit.toLowerCase(), `${iso} ${l}`).toMatch(/midi|noon/)
        expect(gabarit, `${iso} ${l}`).toContain('{date}')
        expect(gabarit, `${iso} ${l}`).toContain('{nom}')
      }
      // ⚠️ La SONDE de la mention : sous les règles de la version 1 la matinée n'est pas
      // ouvrable, le jour est pleinement chômé pour la plateforme, et la mention redevient
      // celle d'une fête légale. Le genre suit la RÈGLE, jamais la ligne du calendrier.
      expect(
        mentionsJour(parseIso(iso)!, CALENDRIER_COURANT, 'fr', false).map((m) => m.genre),
        `${iso} : sonde règles v1`,
      ).toEqual(['FETE_LEGALE'])
    }
  })

  /**
   * ⚠️ **COMBIEN DE RÉSULTATS VOIENT LA LIGNE DE LA CASCADE.** `DelaiDatePublique` ne rend
   * `publicDeferredCascade` que sur `report.jours.length > 1` — c'est-à-dire quand le report a
   * franchi DEUX jours ou plus, là où l'art. 991 al. 3 n'en proroge qu'un. Le compte vivait
   * jusqu'ici dans la prose de `surfaces-delais.test.ts`, qui annonçait « 39 résultats sur
   * 1 825 » : deux nombres écrits à la main, tous deux faux — il y a 1 826 départs dans la
   * fenêtre, et la mesure d'aujourd'hui en donne 29. C'est exactement le défaut 14, et le
   * remède est celui que ce dépôt s'impose partout : mettre le nombre dans un test.
   */
  it('la ligne de la cascade paraît sur 29 des 1 826 départs, pour chacune des quatre durées', () => {
    expect(departs()).toHaveLength(1826)
    for (const jours of [8, 15, 30, 31]) {
      let deuxJoursOuPlus = 0
      for (const iso of departs()) {
        const r = calculer({
          depart: parseIso(iso)!,
          entree: entreeAutre('PUBLIC', jours),
          versionCalendrier: VERSION_CALENDRIER_COURANTE,
          entreesCalendrier: CALENDRIER_COURANT,
          locale: 'fr',
        })
        if (r.statut !== 'CALCUL') throw new Error(`${iso} : ${r.statut}`)
        if (r.joursEcartes.length > 1) deuxJoursOuPlus += 1
      }
      expect(deuxJoursOuPlus, `${jours} jours`).toBe(29)
    }
  })

  /**
   * ⚠️ **LES QUATRE CAS DE CONTRÔLE DE LA COMMANDE DU 20 AOÛT 2026**, des deux côtés et sous
   * les deux calendriers. Ce sont les quatre jours que le décret du 11 décembre 2024 ajoute.
   */
  it('les quatre jours ajoutés par le décret de 2024, cas par cas', () => {
    const cas: readonly [string, string, string, string][] = [
      // départ (30 j francs) ── v1 portail ── v2 portail ── public v2 (= v2 portail)
      //
      // ⚠️ **REMESURÉ LE 20 AOÛT 2026 AU SOIR.** La colonne « v2 portail » disait 11-02 /
      // 02-17 / 08-15 / 09-21 : c'était la tête ÉTROITE, prorogée d'UN jour. Sous les règles
      // courantes, la cascade la mène au même jour que la surface publique — c'est le zéro du
      // premier test de ce bloc. Le Lundi Gras, lui, ne bouge PLUS du tout (défaut 2) :
      // 2026-02-16 est un Lundi Gras chômé « à partir de midi », la matinée reste ouvrable, et
      // la lecture `DEMI_JOURNEE` nomme le 18 février au lieu de l'imposer.
      ['2025-10-01', '2025-11-01', '2025-11-03', '2025-11-03'], // la Toussaint, un samedi
      ['2026-01-16', '2026-02-16', '2026-02-16', '2026-02-16'], // Lundi Gras, un lundi
      ['2025-07-14', '2025-08-14', '2025-08-16', '2025-08-16'], // 14 août, un jeudi
      ['2025-08-20', '2025-09-20', '2025-09-22', '2025-09-22'], // 20 septembre, un samedi
    ]
    for (const [depart, v1, v2, publique] of cas) {
      expect(teteSous(depart, false, 30, CALENDRIER_V1, 1), `${depart} v1`).toBe(v1)
      expect(
        teteSous(depart, false, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
        `${depart} v2`,
      ).toBe(v2)
      // Sous le calendrier COURANT, les deux surfaces rendent la même date : c'est le zéro.
      expect(
        teteSous(depart, true, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
        `${depart} public v2`,
      ).toBe(publique)
    }
    // Et le cas où la bascule fait TOMBER l'écart à zéro : un 20 septembre en semaine.
    expect(teteSous('2027-08-20', false, 30, CALENDRIER_V1, 1)).toBe('2027-09-20')
    expect(
      teteSous('2027-08-20', false, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
    ).toBe('2027-09-21')
    expect(
      teteSous('2027-08-20', true, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
    ).toBe('2027-09-21')
  })

  /**
   * ⚠️ **LE SENS DE L'ÉCART EST CE QUI REND LE DÉFAUT DANGEREUX.** La tête large ne peut
   * qu'AJOUTER des jours (c'est l'invariant du § 4.6 : chaque configuration plus permissive est
   * monotone). Si un jour la publique devenait la plus PRÉCOCE, ce serait un défaut du moteur —
   * et le portail, lui, cesserait d'être la date sûre.
   */
  it('la date publique n’est JAMAIS plus précoce que celle du portail', () => {
    for (const iso of departs()) {
      const large = tete(iso, true, 30)
      const etroite = tete(iso, false, 30)
      expect(comparer(parseIso(large)!, parseIso(etroite)!), iso).toBeGreaterThanOrEqual(0)
    }
  })

  /**
   * ⚠️ **CE QUI RESTE DE L'ÉCART VIENT ENTIÈREMENT DES JOURS SANS TEXTE INSTITUANT.**
   *
   * Le décompte se fait en retirant une catégorie du calendrier à la fois. Sous les règles
   * courantes, les fêtes NATIONALES prorogent des deux côtés et la cascade joue des deux côtés :
   * les retirer ne change RIEN à l'écart. Les quatre lignes `autorite: 'REDACTION'` de la
   * version 1, elles, l'expliquent en totalité — le retrait de la catégorie fait tomber les 16
   * divergences à zéro.
   *
   * ⚠️ **CE TEST DISAIT 30 / 31 / 5 JUSQU'AU 20 AOÛT 2026 AU SOIR**, et concluait que « 25 des
   * 56 divergences » venaient des fêtes nationales. C'était la mesure d'un portail à tête
   * étroite ; Me Vaval l'a élargi, et cette part est tombée à zéro le soir même.
   */
  it('… et l’écart restant vient ENTIÈREMENT des jours sans texte instituant', () => {
    const compte = (entrees: readonly (typeof CALENDRIER_V1)[number][]): number => {
      let n = 0
      for (const iso of departs()) {
        const base = entreeAutre('PUBLIC', 30)
        const large = calculer({ depart: parseIso(iso)!, entree: base, versionCalendrier: 1, entreesCalendrier: entrees, locale: 'fr' })
        const etroite = calculer({ depart: parseIso(iso)!, entree: entreeLectureStricte(base), versionCalendrier: 1, entreesCalendrier: entrees, locale: 'fr' })
        if (large.statut !== 'CALCUL' || etroite.statut !== 'CALCUL') continue
        if (formatIso(large.teteAffiche) !== formatIso(etroite.teteAffiche)) n += 1
      }
      return n
    }
    const sansRedaction = CALENDRIER_V1.filter((e) => e.autorite !== 'REDACTION')
    const sansNationales = CALENDRIER_V1.filter((e) => e.categorie !== 'FETE_NATIONALE')
    const sansLesDeux = sansRedaction.filter((e) => e.categorie !== 'FETE_NATIONALE')
    expect(compte(CALENDRIER_V1)).toBe(16) // la mesure de référence, calendrier v1 entier
    expect(compte(sansRedaction)).toBe(0) // les 16 sont imputables aux 4 jours sans texte
    expect(compte(sansNationales)).toBe(16) // les fêtes nationales n'en expliquent AUCUNE
    expect(compte(sansLesDeux)).toBe(0) // et la cascade seule, aucune non plus
  })

  /**
   * ⚠️ **LE CAS DE CONTRÔLE, DES DEUX CÔTÉS.** 30 jours francs, acte reçu le 1er octobre 2025 :
   * le portail dit samedi 1er novembre, la page publique lundi 3 novembre. Les deux dates sont
   * vraies sous leur lecture ; ce qui ne l'était pas, c'est que chacune se taise sur l'autre.
   */
  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **DÉFAUTS 6 ET 14 — LES CHIFFRES ÉCRITS À LA MAIN DANS LA PROSE DU DÉPÔT.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Sur ce dossier, le commentaire fait office de spécification : c'est là que la rédaction
   * relit ce que la plateforme fait, et c'est de là que se recopiera la prochaine décision. Six
   * fichiers affirmaient donc, comme des faits mesurés, des nombres périmés d'une demi-journée :
   * « le public était le plus tardif dans 56 cas sur 56 », « 53 divergences […] tombent donc à
   * ZÉRO », « `null` dans 96,9 % des cas », « 5 des 18 déplacements de la tête du portail ».
   *
   * ⚠️ **UN NOMBRE ÉCRIT À LA MAIN DANS UNE PROSE DE SOIXANTE LIGNES NE PEUT PAS DEVENIR ROUGE
   * QUAND IL CESSE D'ÊTRE VRAI.** Ce test est le garde-fou : il interdit que ces formules
   * reparaissent SANS être datées comme historiques. Les mesures, elles, sont dans ce fichier —
   * un seul endroit, rejouable, qui rougit tout seul.
   */
  it('DÉFAUTS 6 et 14 — aucun chiffre périmé ne reparaît sans être daté comme historique', () => {
    const fichiers = [
      'src/lib/delais/franc-pur.ts',
      'src/lib/delais/lecture-publique.ts',
      'src/lib/delais/feries.ts',
      'src/components/delais/DelaiDatePublique.tsx',
      'src/components/delais/noyau-calculateur.tsx',
      'src/app/api/public/delais/calculer/route.ts',
      'src/app/[locale]/delais/page.tsx',
      'src/lib/i18n/locales/fr.ts',
      'src/lib/i18n/locales/en.ts',
      'src/lib/i18n/locales/ht.ts',
      // ⚠️ Le moteur lui-même entre dans la liste : c'est lui qui porte le tableau du § 4.8.
      'src/lib/delais/calcul.ts',
      'src/lib/delais/lectures.ts',
      'src/lib/delais/regles-lecture.ts',
    ]
    /**
     * Les formules qui affirmaient un état périmé. Une occurrence n'est tolérée que dans la
     * même PHRASE qu'un marqueur d'historicité — « MATIN », « HISTORIQUE », « valait ».
     *
     * ⚠️ **DEUX FORMULES ONT ÉTÉ AJOUTÉES LE 20 AOÛT 2026 (SOIR), APRÈS COUP** : « 3,1 % » et
     * « 71 jours cumulés ». Elles vivaient dans le même paragraphe de `franc-pur.ts` que
     * « 56 cas sur 56 », et la dernière était devenue franchement fausse — elle attribuait
     * 53 divergences et 71 jours d'écart au calendrier de la version 2, qui n'en porte AUCUN.
     */
    const perimees = [
      /56 cas sur 56/g,
      /56 fois sur 56/g,
      /96,9\s?%/g,
      /53 divergences/g,
      /71 jours cumulés/g,
      /\(3,1\s?%/g,
    ]
    const marqueurs = /MATIN|HISTORIQUE|Chiffre[s]? HISTORIQUE|historique|valait|a porté trois faux/
    for (const f of fichiers) {
      const brut = readFileSync(join(process.cwd(), f), 'utf8')
      /**
       * ⚠️ **LE GARDE-FOU CHERCHAIT SUR LA SOURCE BRUTE, ET UNE FORMULE COUPÉE PAR UN RETOUR À
       * LA LIGNE LUI ÉCHAPPAIT.** C'est précisément ce qui s'est produit : `franc-pur.ts`
       * portait « le public était le plus tardif dans 56 cas sur\n * 56 », l'habillage du
       * commentaire tombant entre les deux moitiés du nombre. Le motif ne mordait pas, le test
       * restait vert, et l'affirmation périmée est restée dans le fichier une journée entière —
       * dans le paragraphe même où ce dépôt explique qu'un chiffre écrit à la main ne peut pas
       * rougir. On aplatit donc la source : les continuations de commentaire (`\n *`) et les
       * suites d'espaces deviennent une espace simple avant toute recherche.
       */
      const src = brut.replace(/\n[ \t]*\*?[ \t]?/g, ' ').replace(/[ \t]+/g, ' ')
      for (const motif of perimees) {
        for (const m of src.matchAll(motif)) {
          const contexte = src.slice(Math.max(0, m.index! - 400), m.index! + 400)
          expect(marqueurs.test(contexte), `${f} : « ${m[0]} » sans marqueur d’historicité`).toBe(
            true,
          )
        }
      }
    }

    // ⚠️ Et la page publique ne doit PLUS annoncer la décision du matin comme la règle : elle
    // écrivait « LE CALCUL Y EST FRANC PUR — départ + N + 1, et rien d'autre […] Ni prorogation ».
    const page = readFileSync(join(process.cwd(), 'src/app/[locale]/delais/page.tsx'), 'utf8')
    // ⚠️ La formule ne survit que CITÉE, dans l'avertissement qui la donne pour périmée ; ce
    // qui est interdit, c'est de la réaffirmer comme le titre de ce que la page fait.
    expect(page).not.toContain('⚠️ **ET LE CALCUL Y EST FRANC PUR**')
    expect(page).toContain('FRANC, PUIS REPORT EN CASCADE')
    expect(page).toContain('défaut 14')
  })

  /**
   * ⚠️ **DÉFAUT 15 — `LECTURES_NOMMEES` ÉTAIT UNE SECONDE VÉRITÉ, EN FRANÇAIS SEUL.** La table
   * dupliquait `phrases(locale).lectures` sans aucun consommateur : la prochaine main qui
   * corrigerait un libellé pouvait le corriger là, sans effet à l'écran. C'est le défaut 16 c
   * que ce dépôt s'interdit ailleurs. Elle a été supprimée, et son export avec elle ; ce test
   * garde la porte fermée.
   */
  it('DÉFAUT 15 — les libellés des lectures ne sont déclarés QU’UNE fois, dans `phrases.ts`', () => {
    const lectures = readFileSync(join(process.cwd(), 'src/lib/delais/lectures.ts'), 'utf8')
    expect(lectures).not.toContain('libelleFr:')
    expect(lectures).not.toContain('fondementFr:')
    const index = readFileSync(join(process.cwd(), 'src/lib/delais/index.ts'), 'utf8')
    expect(index).not.toContain('LECTURES_NOMMEES')
    // Le seul porteur des libellés, dans les trois langues, reste `phrases.ts`.
    //
    // ⚠️ **`REGIME_FRANC` A QUITTÉ LA TABLE FIXE LE 20 AOÛT 2026, ET CE N'EST PAS UNE SECONDE
    // VÉRITÉ DE PLUS** : son fondement dépend du CODE de la fiche (elle citait « C. trav.,
    // art. 511 » sur un délai du Code civil). Il est rendu par `lectureRegimeFranc(code)`, qui
    // vit dans le MÊME fichier et lit `FONDEMENT_REGIME_PAR_CODE` — la table qui existait déjà.
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(Object.keys(phrases(l).lectures).sort()).toEqual([
        'CUMUL',
        'DEMI_JOURNEE',
        'PROROGATION_991',
      ])
      expect(typeof phrases(l).lectureRegimeFranc).toBe('function')
    }
  })

  it('le cas de la cliente : samedi 1er au portail, lundi 3 en public — sous le calendrier v1', () => {
    // ⚠️ Le contraste ne vit plus que sous le calendrier de la VERSION 1, que rejouent les
    // permaliens `c=1` : c'est là que la Toussaint est portée sans texte instituant. Sous le
    // calendrier courant, les deux surfaces disent lundi 3 novembre — la date que Me Vaval a
    // validée, rendue par les DEUX écrans.
    expect(tete('2025-10-01', false, 30)).toBe('2025-11-01')
    expect(tete('2025-10-01', true, 30)).toBe('2025-11-03')
    expect(
      teteSous('2025-10-01', false, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
    ).toBe('2025-11-03')
    expect(
      teteSous('2025-10-01', true, 30, CALENDRIER_COURANT, VERSION_CALENDRIER_COURANTE),
    ).toBe('2025-11-03')
  })
})

// ===========================================================================
// 6. LE RAISONNEMENT SÉRIALISÉ — **il NOMME chaque jour pour ce qu'il est**
// ===========================================================================

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **RÉGRESSION INTRODUITE PAR `prorogationTeteLarge: true`, LE JOUR MÊME.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * `etapeProrogation` recevait les libellés JOINTS de toutes les entrées du jour et leur collait
 * un gabarit unique : « un jour de fête légale (…) ». Sous l'ancienne tête ÉTROITE
 * (`feteNationale: false`, `redaction: false`), seuls le dimanche et les 7 fêtes légales du
 * décret du 23 mai 1989 entraient dans `sauts` : la phrase était toujours vraie. Depuis la
 * lecture large, elle ne l'est plus, et le raisonnement écrivait :
 *
 *   - « Le lundi 18 mai 2026 EST UN JOUR DE FÊTE LÉGALE (La Fête du Drapeau et de
 *     l'Université) » — c'est une fête NATIONALE (Const. 1987, art. 275.1) ;
 *   - « Le samedi 1er novembre 2025 EST UN JOUR DE FÊTE LÉGALE (La Toussaint) » — alors que la
 *     ligne fine du MÊME calcul dit « aucun texte du corpus ne l'institue » ;
 *   - « Le dimanche 2 novembre 2025 est un jour de fête légale (**Dimanche** et Fête des
 *     Morts) » — le dimanche NOMMÉ DANS la parenthèse des fêtes légales.
 *
 * Deux affirmations contradictoires dans une seule réponse. Chaque motif porte désormais son
 * GENRE, et la phrase est composée entrée par entrée.
 */
describe('§ 4.9 — chaque jour franchi est nommé pour ce qu’il est', () => {
  const etapeDuSaut = (iso: string, jours: number, cle: string): string => {
    const r = calcul(iso, 'PUBLIC', jours)
    const e = r.etapes.find((x) => x.cle === `prorogation-${cle}`)
    if (!e) throw new Error(`étape prorogation-${cle} absente : ${r.etapes.map((x) => x.cle).join(', ')}`)
    return e.texte
  }

  it('une FÊTE NATIONALE n’est pas appelée « fête légale »', () => {
    const t = etapeDuSaut('2026-05-16', 1, '18-mai')
    expect(t).toContain('est un jour de fête nationale (La Fête du Drapeau et de l’Université)')
    expect(t).not.toContain('fête légale')
  })

  it('un jour SANS TEXTE de la version 1 le dit, et nomme la version', () => {
    const t = etapeDuSaut('2025-10-01', 30, '1er-novembre')
    expect(t).toContain('sans texte instituant')
    expect(t).toContain('version 1')
    expect(t).toContain('11 décembre 2024')
    // ⚠️ La formule « sur instruction de la rédaction » a été retirée de toutes les surfaces
    // le 20 août 2026, avec la réserve R6 : le décret retrouvé la prive d'objet.
    expect(t).not.toContain('sur instruction de la rédaction')
    // Il reste « comme fête légale » — c'est ce que le calendrier en fait —, jamais « EST un
    // jour de fête légale », qui l'attribuerait au décret du 23 mai 1989.
    expect(t).not.toContain('est un jour de fête légale')
  })

  it('le DIMANCHE sort de la parenthèse des fêtes légales', () => {
    const t = etapeDuSaut('2025-10-01', 30, 'DIMANCHE')
    expect(t).toContain('est un dimanche et un jour de fête légale (Fête des Morts)')
    expect(t).not.toContain('(Dimanche et')
  })

  /**
   * ⚠️ **LE CONTRÔLE GÉNÉRIQUE**, celui qui aurait attrapé le défaut sans qu'on ait pensé aux
   * trois cas : sur cinq ans, aucune étape de prorogation ne doit ranger sous « fête légale »
   * le libellé d'une entrée qui n'en est pas une.
   */
  it('sur cinq ans, aucun libellé n’est rangé sous le mauvais genre', () => {
    const nationales = CALENDRIER_V1.filter((e) => e.categorie === 'FETE_NATIONALE').map((e) => e.libelleFr)
    const redaction = CALENDRIER_V1.filter((e) => e.autorite === 'REDACTION').map((e) => e.libelleFr)
    let d = parseIso('2025-01-01')!
    while (formatIso(d) <= '2029-12-31') {
      for (const e of calcul(formatIso(d), 'PUBLIC', 30).etapes) {
        if (!e.cle.startsWith('prorogation-')) continue
        for (const nom of nationales) {
          if (e.texte.includes(nom)) {
            expect(e.texte, `${formatIso(d)} · ${nom}`).toContain('fête nationale')
            expect(e.texte, `${formatIso(d)} · ${nom}`).not.toContain('est un jour de fête légale')
          }
        }
        for (const nom of redaction) {
          if (e.texte.includes(nom)) {
            expect(e.texte, `${formatIso(d)} · ${nom}`).toContain('sans texte instituant')
            expect(e.texte, `${formatIso(d)} · ${nom}`).not.toContain(
              'sur instruction de la rédaction',
            )
          }
        }
        // Le dimanche n'entre jamais dans une parenthèse de fête.
        expect(e.texte, formatIso(d)).not.toContain('(Dimanche')
      }
      d = addDays(d, 1)
    }
  })

  /** § 8.2 — la conjonction elle-même était EN DUR en français dans le moteur. */
  it('la conjonction qui joint deux motifs est TRADUITE', () => {
    expect(phrases('fr').jointureMotifs).toBe(' et ')
    expect(phrases('en').jointureMotifs).toBe(' and ')
    expect(phrases('ht').jointureMotifs).toBe(' ak ')
    expect(calcul('2025-10-01', 'PUBLIC', 30, 'en').etapes.map((e) => e.texte).join(' ')).toContain(
      'is a Sunday and a legal holiday',
    )
  })
})
