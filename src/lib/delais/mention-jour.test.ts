/**
 * LA SEULE MENTION QUE LA SURFACE PUBLIQUE GARDE À CÔTÉ DE LA DATE (20 août 2026).
 *
 * Me Vaval : « Si la date calculée tombe un jour férié, le résultat l'affichera en petits
 * caractères. » Ce fichier vérifie les trois choses qui peuvent mal tourner dans une phrase
 * aussi courte :
 *
 *  1. **le GENRE.** Le calendrier porte quatre sortes de lignes, et les confondre sous « jour
 *     de fête légale » ferait dire à la plateforme ce qu'aucun texte ne dit : les 4 entrées de
 *     la RÉDACTION ne sont instituées par aucun texte du corpus, et les 5 jours À SURVEILLER
 *     sont un chômage ponctuel par arrêté, jamais une fête permanente (§ 4.13) ;
 *  2. **le CUMUL.** Une fête qui tombe un dimanche doit rendre les DEUX mentions : la
 *     Toussaint 2026 est un dimanche, et c'est le cas d'espèce ;
 *  3. **le SILENCE.** Un jour ordinaire ne rend rien du tout — pas une ligne « aucune
 *     mention », qui serait du bruit sous une date que la personne a demandée.
 *
 * ⚠️ Test PUR : ni base, ni navigateur, ni build. Le calendrier est passé explicitement.
 */
import { describe, expect, it } from 'vitest'
import { CALENDRIER_V1 } from './feries'
import type { EntreeDelai } from './calcul'
import { calculer } from './calcul'
import { addDays, dayOfWeek, formatIso, parseIso } from './civil'
import { PROROGATION_FRANC_PUR } from './franc-pur'
import { genreEntree, mentionsJour, reportPublic } from './mention-jour'

const le = (iso: string) => parseIso(iso)!
const mentions = (iso: string, locale: 'fr' | 'en' | 'ht' = 'fr') =>
  mentionsJour(le(iso), CALENDRIER_V1, locale)

describe('le genre d’une ligne du calendrier', () => {
  it('les 21 lignes de la version 1 se répartissent 7 / 5 / 4 / 5', () => {
    const compte = { FETE_LEGALE: 0, FETE_NATIONALE: 0, REDACTION: 0, A_SURVEILLER: 0, DIMANCHE: 0 }
    for (const e of CALENDRIER_V1) compte[genreEntree(e)] += 1
    expect(compte).toEqual({
      FETE_LEGALE: 7,
      FETE_NATIONALE: 5,
      REDACTION: 4,
      A_SURVEILLER: 5,
      DIMANCHE: 0,
    })
  })

  /** `typeEntree` prime : un jour à surveiller n'est jamais rangé avec les fêtes. */
  it('`A_SURVEILLER` l’emporte sur tout le reste', () => {
    for (const e of CALENDRIER_V1) {
      if (e.typeEntree === 'A_SURVEILLER') expect(genreEntree(e), e.cle).toBe('A_SURVEILLER')
    }
  })
})

describe('la date calculée tombe un jour du calendrier', () => {
  it('Noël 2026 — fête légale du décret de 1989, avec son nom', () => {
    expect(mentions('2026-12-25')).toEqual([
      { genre: 'FETE_LEGALE', cle: '25-decembre', nom: 'Jour de Noël' },
    ])
  })

  it('le 1er janvier 2026 — fête NATIONALE, pas « légale »', () => {
    const [m] = mentions('2026-01-01')
    expect(m.genre).toBe('FETE_NATIONALE')
    expect(m.nom).toBe('La Fête de l’Indépendance Nationale')
  })

  it('le 24 octobre 2026 — jour À SURVEILLER, jamais rangé avec les fêtes', () => {
    const [m] = mentions('2026-10-24')
    expect(m.genre).toBe('A_SURVEILLER')
    expect(m.cle).toBe('24-octobre')
  })

  it('la Toussaint 2026 — retenue par la RÉDACTION, et elle tombe un dimanche', () => {
    // Le cumul : le calendrier d'abord, la qualité du jour de semaine ensuite.
    expect(dayOfWeek(le('2026-11-01'))).toBe(0)
    expect(mentions('2026-11-01').map((m) => m.genre)).toEqual(['REDACTION', 'DIMANCHE'])
  })
})

describe('le dimanche — ⚠️ AJOUT À L’INSTRUCTION, pas déduction', () => {
  /**
   * Me Vaval n'a nommé que les jours fériés. Le dimanche est ajouté parce qu'il est aussi
   * impraticable qu'une fête pour signifier ; il lui a été signalé comme un ajout, et il se
   * retire d'une ligne. Ce test est donc le témoin de l'ajout, pas de la demande.
   */
  it('le dimanche 5 juillet 2026 — son cas d’espèce, et rien au calendrier ce jour-là', () => {
    expect(mentions('2026-07-05')).toEqual([{ genre: 'DIMANCHE', cle: 'dimanche', nom: '' }])
  })

  it('un samedi ne dit rien : le samedi n’est pas un jour férié', () => {
    expect(dayOfWeek(le('2026-06-20'))).toBe(6)
    expect(mentions('2026-06-20')).toEqual([])
  })
})

describe('un jour ordinaire ne rend AUCUNE mention', () => {
  it('le lundi 6 juillet 2026', () => {
    expect(mentions('2026-07-06')).toEqual([])
  })

  it('… et sur une année entière, seuls les jours du calendrier et les dimanches parlent', () => {
    let avecMention = 0
    for (let j = 1; j <= 28; j++) {
      for (let m = 1; m <= 12; m++) {
        const iso = `2026-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`
        if (mentions(iso).length > 0) avecMention += 1
      }
    }
    // 48 dimanches sur les 336 quantièmes retenus, plus les entrées du calendrier qui n'y
    // tombent pas. Le nombre exact importe moins que sa BORNE : la mention reste l'exception.
    expect(avecMention).toBeLessThan(70)
    expect(avecMention).toBeGreaterThan(40)
  })
})

describe('§ 8.2 — le nom du jour suit le repli sur le français', () => {
  /**
   * Aucune ligne du calendrier n'a `traductionRelue: true` : `texteLocalise` replie donc sur
   * le français dans les trois langues. Une traduction que personne n'a relue ne doit pas
   * passer pour relue sur un écran de délai de recours — c'est vrai d'une mention comme du
   * reste.
   */
  it('en anglais et en créole, le nom reste celui de la rédaction française', () => {
    expect(mentions('2026-12-25', 'en')[0].nom).toBe('Jour de Noël')
    expect(mentions('2026-12-25', 'ht')[0].nom).toBe('Jour de Noël')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// LE REPORT — la seconde mention, et elle n'existe que si la date A BOUGÉ
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Me Vaval, 20 août 2026, **seconde décision du jour** : « Attention, la date limite est tombée
 * un dimanche, il faut la proroger au prochain jour ouvrable, donc le lundi 6 juillet. »
 *
 * Ce que ce bloc garde :
 *
 *  1. le report est DÉRIVÉ du calcul — les jours franchis sont ceux que le moteur a écartés,
 *     jamais recalculés ici ;
 *  2. il cite **l'article qui proroge**, pas le décret qui institue la fête ;
 *  3. il ne nomme PAS les jours à surveiller parmi les motifs — ils ne prorogent jamais ;
 *  4. il vaut `null` quand rien n'a bougé, et sur un refus.
 */
describe('le REPORT de l’art. 991, en petits caractères', () => {
  const entree: EntreeDelai = {
    slug: 'autre',
    code: 'CIVIL',
    codeLibelle: 'Délai saisi (hors répertoire)',
    article: '',
    objetFr: 'Délai indiqué dans l’acte',
    dureeTexte: '30 jours (saisis)',
    kind: 'JOURS',
    jours: 30,
    nbDistances: 0,
    supplement: null,
    regime: 'FRANC',
    regimeIncertain: false,
    regimeFondement: 'Nombre de jours saisi par l’utilisatrice.',
    ...PROROGATION_FRANC_PUR,
    pointDepartFr: 'Date de réception de l’acte',
    motifRefusFr: null,
    avisDistance: null,
    citationArticle: null,
  }

  const report = (iso: string, jours = 30, locale: 'fr' | 'en' | 'ht' = 'fr') =>
    reportPublic(
      calculer({
        depart: le(iso),
        entree: { ...entree, jours },
        versionCalendrier: 1,
        entreesCalendrier: CALENDRIER_V1,
        locale,
      }),
      CALENDRIER_V1,
      locale,
    )

  it('le cas de la cliente : un jour franchi, le dimanche, arrivée le lundi', () => {
    const r = report('2026-06-03', 31)
    expect(r).not.toBeNull()
    expect(r!.arrivee).toEqual({ y: 2026, m: 7, d: 6 })
    expect(r!.jours.map((j) => j.date)).toEqual([{ y: 2026, m: 7, d: 5 }])
    expect(r!.jours[0].mentions).toEqual([{ genre: 'DIMANCHE', cle: 'dimanche', nom: '' }])
  })

  /**
   * ⚠️ **L'ARTICLE QUI PROROGE, JAMAIS LE TEXTE QUI INSTITUE LA FÊTE.** `MotifProrogation.source`
   * porte, pour Noël, le décret du 23 mai 1989 avec sa référence au Moniteur — deux lignes
   * illisibles sous une date.
   */
  it('il cite l’art. 991 al. 3, pas le décret du 23 mai 1989', () => {
    expect(report('2026-12-09', 15)!.source).toBe('C. pr. civ., art. 991 al. 3')
    expect(report('2026-06-03', 31)!.source).toBe('C. pr. civ., art. 991 al. 3')
    expect(report('2026-12-09', 15)!.source).not.toContain('Moniteur')
  })

  it('la cascade : deux jours franchis, chacun avec ses genres', () => {
    const r = report('2025-10-01')!
    expect(r.arrivee).toEqual({ y: 2025, m: 11, d: 3 })
    expect(r.jours.map((j) => j.date)).toEqual([
      { y: 2025, m: 11, d: 1 },
      { y: 2025, m: 11, d: 2 },
    ])
    // La Toussaint est retenue par la RÉDACTION : la mention le dira mot pour mot.
    expect(r.jours[0].mentions.map((m) => m.genre)).toEqual(['REDACTION'])
    expect(r.jours[1].mentions.map((m) => m.genre)).toEqual(['FETE_LEGALE', 'DIMANCHE'])
  })

  it('rien n’a bougé → `null`, et un samedi n’y change rien', () => {
    expect(report('2026-06-04', 15)).toBeNull() // samedi 20 juin 2026
    expect(report('2026-06-04', 29)).toBeNull() // samedi 4 juillet 2026
    expect(report('2026-01-07')).toBeNull() // samedi 7 février — jour à surveiller
  })

  it('un REFUS n’a pas de report', () => {
    expect(
      reportPublic(
        {
          statut: 'REFUS',
          cle: 'DUREE_ABSENTE',
          motif: 'Aucune durée.',
          regimeAffiche: 'Délai franc',
          entree,
        },
        CALENDRIER_V1,
      ),
    ).toBeNull()
  })

  /**
   * ⚠️ **UN JOUR À SURVEILLER N'EST JAMAIS UN MOTIF DE REPORT.** Le 2 avril 2026 est le Jeudi
   * Saint (à surveiller) ET n'est ni dimanche ni fête permanente : il ne fait pas partie des
   * jours franchis. On vérifie qu'aucun jour franchi, sur cinq ans, ne porte ce genre.
   */
  it('sur cinq ans, aucun jour franchi n’est nommé « jour à surveiller »', () => {
    let depart = le('2025-01-01')
    let vus = 0
    while (formatIso(depart) <= '2029-12-31') {
      const r = report(formatIso(depart))
      if (r) {
        vus += r.jours.length
        for (const j of r.jours) {
          expect(j.mentions.length, formatIso(j.date)).toBeGreaterThan(0)
          for (const m of j.mentions) expect(m.genre, formatIso(j.date)).not.toBe('A_SURVEILLER')
        }
      }
      depart = addDays(depart, 1)
    }
    expect(vus).toBeGreaterThan(250)
  })

  /** § 8.2 — la ligne est rendue dans les trois langues, par les gabarits existants. */
  it('les mentions du report sont localisées comme les autres', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const r = report('2025-10-01', 30, l)!
      expect(r.jours[1].mentions.map((m) => m.genre), l).toEqual(['FETE_LEGALE', 'DIMANCHE'])
      // Le nom du jour suit le repli sur le français, comme partout ailleurs (§ 8.2).
      expect(r.jours[1].mentions[0].nom, l).toBe('Fête des Morts')
    }
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 4.10 — **LA DEMI-JOURNÉE SE DIT** (Me Vaval, 20 août 2026, au vu du décret : « avec la
 * mention en petits caractères que l'après-midi est chômé »).
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Depuis que `entreeProroge` lit `journee`, la date limite s'ARRÊTE sur le Lundi Gras au lieu
 * de le sauter — 40 dates sur 7 304 (`franc-pur.test.ts`, § 0). L'écran écrivait alors « est
 * un jour de fête légale (Lundi Gras) », vrai mais muet sur l'heure et laissant attendre le
 * report que les quatre autres gabarits annoncent. Ce bloc garde les trois choses qui doivent
 * tenir ensemble : le genre dépend de la RÈGLE, la citation du décret de 2024 ne se pose que
 * sur ce que ce décret institue, et le reste du calendrier ne bouge pas.
 */
describe('§ 4.10 — la demi-journée dont la matinée reste ouvrable', () => {
  const LUNDI_GRAS_2026 = '2026-02-16'
  const DEUX_NOVEMBRE_2025 = '2025-11-02'

  it('le genre vient de la RÈGLE, pas de la ligne : v2 le dit, v1 non', async () => {
    const { CALENDRIER_COURANT } = await import('./feries')
    // Règles de la version 2 : la matinée reste ouvrable → la mention parle de midi.
    expect(mentionsJour(le(LUNDI_GRAS_2026), CALENDRIER_COURANT, 'fr', true).map((m) => m.genre)) //
      .toEqual(['DEMI_JOURNEE'])
    // Règles de la version 1 : la demi-journée est comptée pour un jour plein, elle proroge,
    // et le jour est alors une fête légale ordinaire pour la plateforme.
    expect(mentionsJour(le(LUNDI_GRAS_2026), CALENDRIER_COURANT, 'fr', false).map((m) => m.genre)) //
      .toEqual(['FETE_LEGALE'])
  })

  /**
   * ⚠️ **LA CITATION EST DANS LE GABARIT, DONC LE GENRE EST BORNÉ À CE QUE LE DÉCRET DE 2024
   * INSTITUE.** Le calendrier de la version 1 porte lui aussi une demi-journée — le 2 novembre,
   * sur les décrets de 1982 et 1985 —, et un permalien `c=1&rl=2` la rencontre. Lui coller
   * « décret du 11 décembre 2024, art. 2, 1° » ferait dire à un texte ce qu'il ne dit pas.
   */
  it('le 2 novembre de la version 1 n’emprunte PAS la citation de 2024', () => {
    const ms = mentionsJour(le(DEUX_NOVEMBRE_2025), CALENDRIER_V1, 'fr', true)
    expect(CALENDRIER_V1.find((e) => e.cle === '2-novembre')!.journee).toBe(
      'DEMI_JOURNEE_APRES_MIDI',
    )
    expect(ms.map((m) => m.genre)).not.toContain('DEMI_JOURNEE')
    expect(ms.map((m) => m.genre)).toEqual(['FETE_LEGALE', 'DIMANCHE'])
  })

  /**
   * ⚠️ **LE GARDE NE DOIT PAS DÉPENDRE D'UN IDENTIFIANT DE DOCUMENT, ET CE TEST EST LÀ POUR
   * QU'ON N'Y REVIENNE PAS.** Premier essai : `sourceDocId === DOC_DECRET_2024`. Lu sur la base
   * de production le 20 août 2026, la ligne `lundi-gras` de la version 2 y porte
   * `cmt1x4eza0001m0c3gp6996w7` quand la constante du code vaut `cmqcb6mq5007fzywi4vem7v0g` : un
   * script de liaison a remplacé l'identifiant de la graine, et la mention ne se déclenchait
   * donc JAMAIS en production — invisible aux tests, qui passent le calendrier du CODE.
   */
  it('le garde tient même si `sourceDocId` a été relié à un autre document', async () => {
    const { CALENDRIER_COURANT, DEPUIS_2024 } = await import('./feries')
    const relie = CALENDRIER_COURANT.map((e) =>
      e.cle === 'lundi-gras' ? { ...e, sourceDocId: 'un-autre-identifiant-de-document' } : e,
    )
    expect(relie.find((e) => e.cle === 'lundi-gras')!.appliqueDepuis).toBe(DEPUIS_2024)
    expect(mentionsJour(le(LUNDI_GRAS_2026), relie, 'fr', true).map((m) => m.genre)) //
      .toEqual(['DEMI_JOURNEE'])
  })

  it('rien d’autre ne bouge : le calendrier courant n’a qu’UNE demi-journée', async () => {
    const { CALENDRIER_COURANT } = await import('./feries')
    const demies = CALENDRIER_COURANT.filter((e) => e.journee === 'DEMI_JOURNEE_APRES_MIDI')
    expect(demies.map((e) => e.cle)).toEqual(['lundi-gras'])
    // Et un jour ordinaire du même calendrier ne rend toujours rien.
    expect(mentionsJour(le('2026-02-19'), CALENDRIER_COURANT, 'fr', true)).toEqual([])
  })
})
