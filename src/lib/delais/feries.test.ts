/**
 * § 4.3, § 4.13, § 5.4 et § 5.4 bis — le calendrier, ses TROIS catégories, et le repli
 * linguistique de l'avertissement A6 (correctif du défaut 3).
 */
import { describe, expect, it } from 'vitest'
import { formatIso, parseIso } from './civil'
import type { EntreeCalendrier } from './feries'
import {
  CALENDRIER_COURANT,
  CALENDRIER_V1,
  CALENDRIER_V2,
  DOC_CONSTITUTION,
  DOC_DECRET_1989,
  DOC_DECRET_2024,
  OBSERVATIONS_BORNE_FR,
  VERSION_CALENDRIER_COURANTE,
  calendrier,
  dateEntree,
  entreesDuJour,
  libelle,
  observationsBorne,
  observationsTexte,
  texteLocalise,
} from './feries'
import { DECALAGES_PAQUES } from './paques'
import { entreeProroge } from './lectures'
import { TEXTES } from './textes'

const d = (iso: string) => {
  const v = parseIso(iso)
  if (!v) throw new Error(iso)
  return v
}

describe('§ 5.4 — la composition du calendrier v1', () => {
  it('compte 16 PERMANENT + 5 A_SURVEILLER = 21 lignes', () => {
    const permanents = CALENDRIER_V1.filter((e) => e.typeEntree === 'PERMANENT')
    const surveiller = CALENDRIER_V1.filter((e) => e.typeEntree === 'A_SURVEILLER')
    expect(permanents).toHaveLength(16)
    expect(surveiller).toHaveLength(5)
    expect(CALENDRIER_V1).toHaveLength(21)
  })

  it('se ventile en 7 fêtes légales de texte, 5 fêtes nationales, 4 de la rédaction', () => {
    const compte = (f: (e: EntreeCalendrier) => boolean) => CALENDRIER_V1.filter(f).length
    expect(
      compte((e) => e.categorie === 'FETE_LEGALE' && e.autorite === 'TEXTE'),
    ).toBe(7)
    expect(compte((e) => e.categorie === 'FETE_NATIONALE')).toBe(5)
    expect(compte((e) => e.autorite === 'REDACTION')).toBe(4)
    expect(compte((e) => e.categorie === 'CHOMAGE_PAR_ARRETE')).toBe(5)
  })

  it('n’a AUCUNE entrée sans source, et aucune clé en double', () => {
    for (const e of CALENDRIER_V1) {
      expect(e.source.trim().length, `source vide : ${e.cle}`).toBeGreaterThan(30)
      expect(e.appliqueDepuis).toBe('1989-06-22')
    }
    const cles = CALENDRIER_V1.map((e) => e.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it('dit, pour les quatre entrées de la rédaction, ce que le corpus porte VRAIMENT', () => {
    // § 2.10 : « aucun texte du corpus ne l'institue comme fête légale permanente » — jamais
    // « aucun texte n'en parle ». Le corpus n'est muet que sur le 14 août.
    const par = (cle: string) => CALENDRIER_V1.find((e) => e.cle === cle)!
    for (const cle of ['lundi-gras', '14-aout', '20-septembre', '1er-novembre']) {
      expect(par(cle).source).toContain('comme fête légale permanente')
    }
    expect(par('lundi-gras').source).toContain('13 arrêtés')
    expect(par('20-septembre').source).toContain('LM2020-151')
    expect(par('1er-novembre').source).toContain('15 arrêtés')
    expect(par('14-aout').source).toContain('aucun arrêté de chômage')
  })

  it('porte les décalages de Pâques admis, et eux seuls', () => {
    const admis = Object.values(DECALAGES_PAQUES)
    for (const e of CALENDRIER_V1) {
      if (!e.mobile) continue
      expect(admis).toContain(e.offsetPaques)
    }
  })

  it('refuse une version de calendrier inconnue plutôt que de replier en silence', () => {
    expect(() => calendrier(999)).toThrow()
    expect(calendrier(1)).toBe(CALENDRIER_V1)
    expect(calendrier(2)).toBe(CALENDRIER_V2)
  })
})

// ===========================================================================
// § 5.4 — LA VERSION 2 : LE DÉCRET DU 11 DÉCEMBRE 2024
// ===========================================================================

/**
 * *Décret du 11 décembre 2024 déterminant les Fêtes Légales* — Le Moniteur, Journal officiel
 * de la République d'Haïti, 179ᵉ année, **Spécial n° 66-A**, mercredi 11 décembre 2024.
 * Article 2 : onze fêtes légales, dans cet ordre. La liste ci-dessous est l'ORACLE : elle est
 * recopiée du fascicule, et c'est elle qui juge le calendrier, jamais l'inverse.
 */
const DECRET_2024: readonly { rang: number; cle: string; midi: boolean; de1989: boolean }[] = [
  { rang: 1, cle: 'lundi-gras', midi: true, de1989: false },
  { rang: 2, cle: 'mardi-gras', midi: false, de1989: true },
  { rang: 3, cle: 'vendredi-saint', midi: false, de1989: true },
  { rang: 4, cle: 'fete-dieu', midi: false, de1989: true },
  { rang: 5, cle: '14-aout', midi: false, de1989: false },
  { rang: 6, cle: 'assomption', midi: false, de1989: true },
  { rang: 7, cle: '20-septembre', midi: false, de1989: false },
  { rang: 8, cle: '17-octobre', midi: false, de1989: true },
  { rang: 9, cle: '1er-novembre', midi: false, de1989: false },
  { rang: 10, cle: '2-novembre', midi: false, de1989: true },
  { rang: 11, cle: '25-decembre', midi: false, de1989: true },
]

describe('§ 5.4 — la composition du calendrier v2 (décret du 11 décembre 2024)', () => {
  const legales = CALENDRIER_V2.filter(
    (e) => e.typeEntree === 'PERMANENT' && e.categorie === 'FETE_LEGALE',
  )
  const par = (cle: string) => CALENDRIER_V2.find((e) => e.cle === cle)!

  it('compte 16 PERMANENT + 5 A_SURVEILLER = 21 lignes, comme la v1', () => {
    expect(CALENDRIER_V2.filter((e) => e.typeEntree === 'PERMANENT')).toHaveLength(16)
    expect(CALENDRIER_V2.filter((e) => e.typeEntree === 'A_SURVEILLER')).toHaveLength(5)
    expect(CALENDRIER_V2).toHaveLength(21)
    const cles = CALENDRIER_V2.map((e) => e.cle)
    expect(new Set(cles).size).toBe(cles.length)
  })

  it('porte les ONZE fêtes légales de l’article 2, dans l’ordre du décret', () => {
    expect(legales.map((e) => e.cle)).toEqual(DECRET_2024.map((x) => x.cle))
    expect(legales).toHaveLength(11)
  })

  /** ⚠️ **LE CRITÈRE DE LA COMMANDE** : plus une seule entrée sans texte instituant. */
  it('n’a AUCUNE entrée `autorite: REDACTION`', () => {
    expect(CALENDRIER_V2.filter((e) => e.autorite === 'REDACTION')).toHaveLength(0)
    // … là où la version 1 en portait quatre, et les garde.
    expect(CALENDRIER_V1.filter((e) => e.autorite === 'REDACTION')).toHaveLength(4)
  })

  it('les onze portent LA MÊME source — le décret, avec sa référence au Moniteur', () => {
    for (const e of legales) {
      expect(e.autorite, e.cle).toBe('TEXTE')
      expect(e.source, e.cle).toContain('Décret du 11 décembre 2024 déterminant les Fêtes Légales')
      expect(e.source, e.cle).toContain('Spécial n° 66-A')
      expect(e.source, e.cle).toContain('mercredi 11 décembre 2024')
      expect(e.source, e.cle).toContain('179ᵉ année')
      // ⚠️ Le fac-similé EST au corpus depuis le 13 juin 2026 : le lien profond existe.
      expect(e.sourceDocId, e.cle).toBe(DOC_DECRET_2024)
      // … et chacune nomme SON rang à l'article 2.
      const rang = DECRET_2024.find((x) => x.cle === e.cle)!.rang
      expect(e.source, e.cle).toContain(`Énuméré à l’art. 2, ${rang}°)`)
    }
  })

  it('les 5 fêtes NATIONALES gardent la Constitution, art. 275.1', () => {
    const nationales = CALENDRIER_V2.filter((e) => e.categorie === 'FETE_NATIONALE')
    expect(nationales).toHaveLength(5)
    for (const e of nationales) {
      expect(e.source, e.cle).toContain('art. 275.1')
      expect(e.autorite, e.cle).toBe('TEXTE')
      expect(e.appliqueDepuis, e.cle).toBe('1989-06-22')
    }
    // L'article 3 du décret de 2024 les chôme au même titre — c'est dit dans la source des
    // onze fêtes légales, où la phrase est citée.
    expect(par('mardi-gras').source).toContain(
      'chômeront à l’occasion des Fêtes Nationales et Légales',
    )
  })

  /**
   * ⚠️ **CE QUE 1989 APPORTAIT N'EST PAS PERDU, ET ON LE VÉRIFIE ENTRÉE PAR ENTRÉE.** Les sept
   * fêtes du décret du 23 mai 1989 sont TOUTES à la liste de 2024 ; aucune n'a disparu.
   */
  it('les 7 fêtes légales de 1989 sont toutes reconduites en 2024, et aucune n’est perdue', () => {
    const de1989 = CALENDRIER_V1.filter(
      (e) => e.categorie === 'FETE_LEGALE' && e.autorite === 'TEXTE',
    ).map((e) => e.cle)
    expect(de1989).toHaveLength(7)
    for (const cle of de1989) {
      expect(legales.map((e) => e.cle), `1989 → 2024 : ${cle}`).toContain(cle)
      expect(par(cle).source, cle).toContain('figurait déjà à la liste du Décret du 23 mai 1989')
      // Reconduite sans interruption : la borne reste au 22 juin 1989, sinon un délai de
      // 2015 recalculé sous la v2 perdrait le Mardi Gras.
      expect(par(cle).appliqueDepuis, cle).toBe('1989-06-22')
    }
    // … et rien de la liste de 1989 ne manque à celle de 2024.
    expect(de1989.filter((c) => !legales.some((e) => e.cle === c))).toEqual([])
  })

  it('les 4 AJOUTS de 2024 ne s’appliquent qu’à compter du 11 décembre 2024', () => {
    const ajouts = DECRET_2024.filter((x) => !x.de1989).map((x) => x.cle)
    expect(ajouts).toEqual(['lundi-gras', '14-aout', '20-septembre', '1er-novembre'])
    for (const cle of ajouts) {
      expect(par(cle).appliqueDepuis, cle).toBe('2024-12-11')
      expect(par(cle).source, cle).toContain('Le Décret du 23 mai 1989 ne le mentionnait pas')
    }
    // Conséquence mesurée : le 1er novembre 2024 n'est PAS au calendrier, le 1er novembre
    // 2025 l'est. Le décret ne rétroagit pas.
    expect(entreesDuJour(d('2024-11-01'), CALENDRIER_V2).map((e) => e.cle)).toEqual([])
    expect(entreesDuJour(d('2025-11-01'), CALENDRIER_V2).map((e) => e.cle)).toEqual(['1er-novembre'])
    // … tandis que le Mardi Gras 2015 y est bien, sur la reconduction de 1989.
    expect(entreesDuJour(d('2015-02-17'), CALENDRIER_V2).map((e) => e.cle)).toEqual(['mardi-gras'])
  })

  /** § 4.10 — « 1°) le Lundi Gras, À PARTIR DE MIDI ». Une seule demi-journée dans la liste. */
  it('le Lundi Gras est la SEULE demi-journée, et le 2 novembre redevient entier', () => {
    const demies = CALENDRIER_V2.filter((e) => e.journee === 'DEMI_JOURNEE_APRES_MIDI')
    expect(demies.map((e) => e.cle)).toEqual(['lundi-gras'])
    expect(par('lundi-gras').noteJourneeFr).toContain('à partir de midi')
    expect(par('lundi-gras').source).toContain('« le Lundi Gras, à partir de midi »')
    // ⚠️ Le 2 novembre portait la demi-journée en v1 (décrets de 1982 et 1985) ; le décret de
    // 2024 ne reprend pas la mention.
    expect(CALENDRIER_V1.find((e) => e.cle === '2-novembre')!.journee).toBe(
      'DEMI_JOURNEE_APRES_MIDI',
    )
    expect(par('2-novembre').journee).toBe('JOURNEE_ENTIERE')
    expect(par('2-novembre').noteJourneeFr ?? null).toBeNull()
    expect(par('2-novembre').source).toContain('ne reprend PAS la mention « à partir de midi »')
  })

  /**
   * ⚠️ **LES CINQ JOURS À SURVEILLER SONT RECONDUITS *TELS QUELS*.** Ils ne partagent pas
   * leurs objets avec la version 1 — une édition de la v2 pourrait alors réécrire la v1 —,
   * donc on le vérifie CHAMP PAR CHAMP.
   */
  it('les 5 jours à surveiller sont identiques à ceux de la version 1, champ par champ', () => {
    const v1 = CALENDRIER_V1.filter((e) => e.typeEntree === 'A_SURVEILLER')
    const v2 = CALENDRIER_V2.filter((e) => e.typeEntree === 'A_SURVEILLER')
    expect(v2.map((e) => e.cle)).toEqual(v1.map((e) => e.cle))
    for (let i = 0; i < v1.length; i++) {
      expect(v2[i], v1[i].cle).toEqual(v1[i])
      // … et ce sont bien DEUX objets : la v2 ne peut pas réécrire la v1 par référence.
      expect(v2[i], v1[i].cle).not.toBe(v1[i])
    }
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **DÉFAUTS 1 ET 7 — LA BASCULE NE DOIT EMPORTER AUCUN RENVOI AU CORPUS.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * La v2 portait `sourceDocId: null` sur ses onze fêtes légales, sur la foi d'un commentaire
   * qui affirmait que le fac-similé « n'est pas versé au corpus ». La base le démentait : le
   * fascicule y est depuis le 13 juin 2026. Double perte, et la seconde était silencieuse —
   * les SEPT fêtes reconduites de 1989 perdaient le `DOC_DECRET_1989` qu'elles portaient en
   * v1. Ce test compare les DEUX versions ligne à ligne : aucune entrée permanente ne peut
   * perdre son renvoi en changeant de version.
   */
  it('DÉFAUT 1/7 — aucune entrée permanente ne perd le renvoi au corpus qu’elle avait en v1', () => {
    for (const e of CALENDRIER_V2) {
      if (e.typeEntree !== 'PERMANENT') continue
      expect(e.sourceDocId, `${e.cle} : entrée permanente sans renvoi au corpus`).toBeTruthy()
      const v1 = CALENDRIER_V1.find((x) => x.cle === e.cle)
      if (v1?.sourceDocId) {
        expect(
          e.sourceDocId,
          `${e.cle} : la v1 renvoyait à un document, la v2 n’en renvoie plus`,
        ).toBeTruthy()
      }
    }
    // Les onze fêtes légales pointent le fascicule du décret de 2024 ; les cinq nationales,
    // la Constitution. Et les identifiants sont TROIS constantes distinctes.
    expect(
      CALENDRIER_V2.filter((e) => e.categorie === 'FETE_LEGALE' && e.sourceDocId === DOC_DECRET_2024),
    ).toHaveLength(11)
    expect(
      CALENDRIER_V2.filter((e) => e.categorie === 'FETE_NATIONALE' && e.sourceDocId === DOC_CONSTITUTION),
    ).toHaveLength(5)
    expect(new Set([DOC_DECRET_1989, DOC_DECRET_2024, DOC_CONSTITUTION]).size).toBe(3)
    // … et la v1 garde les siens, intacts : elle est gelée.
    expect(
      CALENDRIER_V1.filter((e) => e.categorie === 'FETE_LEGALE' && e.autorite === 'TEXTE'),
    ).toHaveLength(7)
    for (const e of CALENDRIER_V1.filter((x) => x.categorie === 'FETE_LEGALE' && x.autorite === 'TEXTE')) {
      expect(e.sourceDocId, e.cle).toBe(DOC_DECRET_1989)
    }
  })

  /**
   * ⚠️ **DÉFAUT 2 — LE DÉCRET DE 1989 NOMME L'ASSOMPTION ; IL NE LA DATE PAS.** La source
   * affichée disait « celui de 1989 ne la nommait pas » : démenti par le dépôt lui-même, où
   * les deux transcriptions gelées la portent. Le champ `source` est RENDU à l'utilisatrice
   * (`DelaiResult.tsx`, `{m.source}`, sous la pastille « Source vérifiée ») ; une lectrice
   * qui recoupe avec l'art. 110 du Code du travail — que la plateforme sert — en conclurait
   * que le calculateur se trompe sur le décret de 1989.
   */
  it('DÉFAUT 2 — la source de l’Assomption ne dit pas que 1989 ne la « nommait » pas', () => {
    const src = par('assomption').source
    expect(src).toContain('ne la datait pas')
    expect(src).not.toContain('ne la nommait pas')
    // Les deux transcriptions gelées la NOMMENT — c'est ce qui rendait l'ancienne phrase fausse.
    expect(TEXTES['ctrav-110'].texte).toContain('Assomption')
    expect(TEXTES['decret-1989-art-1'].texte).toContain('Assomption')
    // … et aucune des deux ne la DATE : « 15 Août » n'y figure pas.
    expect(TEXTES['ctrav-110'].texte).not.toContain('15 Août')
    expect(TEXTES['decret-1989-art-1'].texte).not.toContain('15 Août')
    // Le décret de 2024, lui, la date — et c'est ce que la source dit.
    expect(src).toContain('« le 15 Août, Fête de l’Assomption »')
  })

  /**
   * ⚠️ **DÉFAUT 3 — L'ARGUMENT LE PLUS FORT DU DÉCRET NE DOIT PAS MANQUER À SA TRANSCRIPTION.**
   * La v2 institue quatre fêtes légales sur le fondement d'un DÉCRET, quand l'art. 275.2 de la
   * Constitution les réserve à la LOI — réserve que la v1 opposait expressément au
   * 20 septembre. Le décret y répond par son dernier considérant ; il manquait au tronc, et
   * `275.2` n'apparaissait nulle part en v2.
   */
  it('DÉFAUT 3 — les onze citent le considérant sur le Pouvoir Législatif, et l’art. 275.2', () => {
    const CONSIDERANT =
      'Considérant que le Pouvoir Législatif est, pour le moment, inopérant et qu’il y a alors ' +
      'lieu pour le Pouvoir Exécutif de légiférer par Décret sur les objets d’intérêt public'
    for (const e of legales) {
      expect(e.source, e.cle).toContain(CONSIDERANT)
      expect(e.source, e.cle).toContain('art. 275.2')
    }
    // La réserve que le considérant lève est celle que la v1 opposait au 20 septembre…
    expect(CALENDRIER_V1.find((e) => e.cle === '20-septembre')!.source).toContain(
      'l’art. 275.2 de la Constitution réserve les fêtes légales à la loi',
    )
    // … et le texte gelé de l'article dit bien ce que la source lui fait dire.
    expect(TEXTES['const-275-2'].texte).toContain('Les Fêtes Légales sont déterminées par la Loi')
    expect(par('20-septembre').source).toContain('Les Fêtes Légales sont déterminées par la Loi')
  })

  /**
   * ⚠️ **DÉFAUT 4 — UNE DÉCISION DE LA RÉDACTION NE SE LIT PAS SOUS LA RÉFÉRENCE DU TEXTE.**
   * La note affichée du Lundi Gras cite le décret, puis enchaînait sur le décompte de la
   * demi-journée — qui était un choix de la rédaction, le décret ne disant rien du point. Les
   * deux phrases se suivaient sous le même « (art. 2, 1°) » : défaut d'attribution.
   *
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **ORACLE DÉPLACÉ LE 20 AOÛT 2026, AU VU DU DÉCRET — ET LA RÈGLE, ELLE, N'A PAS BOUGÉ.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * Le test exigeait la mention « Choix de la rédaction » dans la note. Il la gardait bien :
   * la note ANNONÇAIT un report (« la demi-journée est comptée comme un jour entier pour la
   * prorogation ») que le décret n'accorde pas, et il fallait dire d'où venait la décision.
   *
   * Me Vaval a tranché l'inverse le jour même : **la demi-journée ne proroge plus**. Il n'y a
   * donc plus de décision à attribuer — le calendrier suit le décret, mot pour mot — et exiger
   * une attribution imposerait d'en inventer une. Ce qui est vérifié à sa place, c'est que la
   * note ne PROMET plus le report qu'elle promettait : une note affichée à côté d'une date est
   * une affirmation, et celle-là aurait démenti le moteur du même écran.
   *
   * ⚠️ **LA BOUCLE CI-DESSOUS EST LA RÈGLE, ET ELLE EST GARDÉE INTACTE** : toute note qui
   * NOMME la prorogation doit continuer de dire de qui vient la décision. Elle ne trouve plus
   * de note à éprouver — c'est justement l'état recherché —, mais elle rougira à la première
   * qu'on écrira.
   */
  it('DÉFAUT 4 — la note du Lundi Gras cite le décret, et ne lui fait plus dire un report', () => {
    const note = par('lundi-gras').noteJourneeFr!
    expect(note).toContain('« à partir de midi » (art. 2, 1°)')
    // Ce que la note NE dit plus : le report que le décret n'accorde pas.
    expect(note).not.toContain('comptée comme un jour entier pour la prorogation')
    // Ce qu'elle dit à la place, et qui est la règle en vigueur.
    expect(note).toContain('La matinée reste ouvrable')
    // La règle vaut pour TOUTE note affichée : si elle nomme la prorogation, elle dit de qui
    // vient la décision — le décret ne parle pas du décompte des délais.
    for (const e of CALENDRIER_V2) {
      const n = e.noteJourneeFr
      if (!n || !n.includes('prorogation')) continue
      expect(n, `${e.cle} : note qui prolonge une citation sans attribuer la décision`).toContain(
        'Choix de la rédaction',
      )
    }
  })

  it('la version COURANTE est la 2, et `CALENDRIER_COURANT` la sert', () => {
    expect(VERSION_CALENDRIER_COURANTE).toBe(2)
    expect(CALENDRIER_COURANT).toBe(CALENDRIER_V2)
  })

  it('aucune source n’emploie plus la formule « instruction de la rédaction »', () => {
    for (const e of CALENDRIER_V2) {
      expect(e.source, e.cle).not.toContain('instruction de la rédaction')
    }
    // … alors que la version 1, gelée, la porte toujours sur ses quatre entrées sans texte.
    expect(
      CALENDRIER_V1.filter((e) => e.source.includes('instruction de la rédaction')),
    ).toHaveLength(4)
  })

  it('porte les décalages de Pâques admis, et eux seuls', () => {
    const admis = Object.values(DECALAGES_PAQUES)
    for (const e of CALENDRIER_V2) {
      if (!e.mobile) continue
      expect(admis, e.cle).toContain(e.offsetPaques)
    }
  })
})

describe('§ 5.4 bis — les jours à surveiller', () => {
  const surveiller = CALENDRIER_V1.filter((e) => e.typeEntree === 'A_SURVEILLER')

  it('porte les cinq clés attendues avec leurs effectifs recomptés', () => {
    const attendus: Record<string, number> = {
      'mercredi-des-cendres': 14,
      ascension: 5,
      'jeudi-saint': 5,
      '24-octobre': 16,
      '7-fevrier': 5,
    }
    expect(surveiller.map((e) => e.cle).sort()).toEqual(Object.keys(attendus).sort())
    for (const e of surveiller) expect(e.observationsN).toBe(attendus[e.cle])
  })

  it('porte la borne de l’Index, identique pour les cinq, et une requête de recherche', () => {
    for (const e of surveiller) {
      expect(e.observationsBorneFr).toBe(OBSERVATIONS_BORNE_FR)
      expect(e.observationsBorneFr).toContain('20 juin 2023')
      expect(e.rechercheCorpusQ?.length).toBeGreaterThan(0)
      expect(e.observationsTexteFr!.length).toBeGreaterThan(60)
    }
  })

  it('n’est JAMAIS en demi-journée et n’a JAMAIS de sourceDocId', () => {
    for (const e of surveiller) {
      expect(e.journee).toBe('JOURNEE_ENTIERE')
      expect(e.sourceDocId).toBeNull()
      expect(e.autorite).toBe('OBSERVATION')
    }
  })

  it('ne proroge sous AUCUNE lecture — pas même la plus large', () => {
    const laPlusLarge = {
      franc: true,
      prorogation: true,
      feteNationale: true,
      redaction: true,
      cascade: true,
      demiJournee: true,
    }
    for (const e of surveiller) expect(entreeProroge(e, laPlusLarge)).toBe(false)
  })

  it('ne dit jamais « 27 arrêtés Carnaval » ni « souvent à partir de midi » pour le Jeudi Saint', () => {
    const cendres = surveiller.find((e) => e.cle === 'mercredi-des-cendres')!
    expect(cendres.observationsTexteFr).not.toContain('27 arrêtés')
    expect(cendres.observationsTexteFr).toContain('14 arrêtés')
    const jeudi = surveiller.find((e) => e.cle === 'jeudi-saint')!
    expect(jeudi.observationsTexteFr).toContain('Un seul')
    expect(jeudi.observationsTexteFr).not.toMatch(/souvent.*midi/)
  })
})

describe('§ 4.10 — les demi-journées, et la version de règles qui décide de leur sort', () => {
  it('marque le 2 novembre et le Lundi Gras, avec leur note', () => {
    const demies = CALENDRIER_V1.filter((e) => e.journee === 'DEMI_JOURNEE_APRES_MIDI')
    expect(demies.map((e) => e.cle).sort()).toEqual(['2-novembre', 'lundi-gras'])
    for (const e of demies) {
      expect(e.noteJourneeFr).toContain('à partir de midi')
      expect(e.noteJourneeFr).toContain('jour entier')
    }
  })

  /**
   * ⚠️ **LE CHAMP `journee` N'EST PLUS UNE DONNÉE MORTE** (20 août 2026, soir — défaut 2 de la
   * troisième recette). Il était renseigné et jamais lu : la plateforme comptait la matinée
   * ouvrable du Lundi Gras pour un jour plein et RETARDAIT 40 dates limites sur 7 304 calculs,
   * toujours dans le sens du risque de forclusion. `entreeProroge` le lit désormais, sous le
   * drapeau `demiJournee` de la version de règles.
   */
  it('la demi-journée proroge sous les règles v1, et plus sous les règles v2', () => {
    const nov2 = CALENDRIER_V1.find((e) => e.cle === '2-novembre')!
    const base = { franc: true, prorogation: true, feteNationale: false, redaction: false, cascade: false }
    expect(entreeProroge(nov2, { ...base, demiJournee: true })).toBe(true)
    expect(entreeProroge(nov2, { ...base, demiJournee: false })).toBe(false)
    // Et la journée ENTIÈRE, elle, proroge sous les deux : le drapeau ne l'atteint pas.
    const toussaint = CALENDRIER_V1.find((e) => e.cle === '1er-novembre')!
    expect(toussaint.journee).toBe('JOURNEE_ENTIERE')
    expect(entreeProroge(toussaint, { ...base, demiJournee: false, redaction: true })).toBe(true)
  })
})

describe('Les dates du calendrier, année par année', () => {
  it('place les entrées fixes et mobiles de 2026 et 2027', () => {
    const par = (cle: string) => CALENDRIER_V1.find((e) => e.cle === cle)!
    expect(formatIso(dateEntree(par('mardi-gras'), 2027))).toBe('2027-02-09')
    expect(formatIso(dateEntree(par('mercredi-des-cendres'), 2027))).toBe('2027-02-10')
    expect(formatIso(dateEntree(par('fete-dieu'), 2026))).toBe('2026-06-04')
    expect(formatIso(dateEntree(par('25-decembre'), 2027))).toBe('2027-12-25')
    expect(formatIso(dateEntree(par('18-novembre'), 2027))).toBe('2027-11-18')
  })

  it('trouve les entrées d’un jour donné, et n’en invente pas', () => {
    expect(entreesDuJour(d('2027-02-10'), CALENDRIER_V1).map((e) => e.cle)).toEqual([
      'mercredi-des-cendres',
    ])
    expect(entreesDuJour(d('2026-03-11'), CALENDRIER_V1)).toHaveLength(0)
  })

  it('n’applique aucune entrée avant le 22 juin 1989', () => {
    // La borne est portée par la donnée (`appliqueDepuis`), pas seulement par le moteur.
    expect(entreesDuJour(d('1963-11-02'), CALENDRIER_V1)).toHaveLength(0)
    expect(entreesDuJour(d('1989-12-25'), CALENDRIER_V1).map((e) => e.cle)).toEqual(['25-decembre'])
  })
})

describe('CORRECTIF défaut 3 — A6 n’avait de texte qu’en français', () => {
  it('replie sur le français tant que la traduction n’est pas relue', () => {
    const cendres = CALENDRIER_V1.find((e) => e.cle === 'mercredi-des-cendres')!
    expect(cendres.traductionRelue).toBe(false)
    for (const locale of ['fr', 'en', 'ht'] as const) {
      expect(libelle(cendres, locale)).toBe('Mercredi des Cendres')
      expect(observationsBorne(cendres, locale)).toBe(OBSERVATIONS_BORNE_FR)
      expect(observationsTexte(cendres, locale)).toContain('14 arrêtés')
    }
  })

  it('emploie la traduction dès qu’elle est RELUE, et retombe si elle manque', () => {
    const relue = {
      fr: 'Mercredi des Cendres',
      en: 'Ash Wednesday',
      ht: null as string | null,
    }
    expect(texteLocalise(relue, 'en', true)).toBe('Ash Wednesday')
    expect(texteLocalise(relue, 'ht', true)).toBe('Mercredi des Cendres') // repli
    expect(texteLocalise(relue, 'en', false)).toBe('Mercredi des Cendres') // non relue
    expect(texteLocalise({ fr: null }, 'fr', true)).toBe('')
  })

  it('porte les champs En/Ht sur TOUTES les entrées, comme DelaiEntry', () => {
    for (const e of CALENDRIER_V1) {
      expect(typeof e.libelleEn).toBe('string')
      expect(typeof e.libelleHt).toBe('string')
      expect(e.libelleEn.length).toBeGreaterThan(0)
      expect(e.libelleHt.length).toBeGreaterThan(0)
      expect('traductionRelue' in e).toBe(true)
    }
  })
})
