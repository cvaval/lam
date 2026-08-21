/**
 * LE HÉROS DU CALCULATEUR DE DÉLAIS.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ CE FICHIER A ÉTÉ RETOURNÉ LE 20 AOÛT 2026 — ET VOICI POURQUOI
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Jusqu'à ce jour, il INTERDISAIT toute date dans le héros : « une date juste, sans ses
 * réserves, ses jours écartés et ses lectures concurrentes, est plus dangereuse qu'une absence
 * de calculateur (§ 0). Le héros NAVIGUE, il ne calcule pas. » Le motif était juste tant que
 * la surface publique prorogeait : la date affichée en cachait alors d'autres — la prorogation
 * de l'art. 991, la « lecture la plus large », le dernier jour praticable —, et la montrer
 * seule, sans ce qui la relativise, était un piège.
 *
 * **Ce motif est tombé avec la chose qu'il décrivait.** Depuis `src/lib/delais/franc-pur.ts`,
 * le calcul public est franc PUR — départ + N + 1 : plus aucune prorogation, aucune lecture
 * nommée, aucun jour praticable, aucun avertissement de report. **La date publique n'a plus de
 * réserves à cacher** : elle est exactement le décompte que la personne a demandé.
 *
 * Décision de Me Vaval, 20 août 2026 : « Le portail public doit uniquement afficher la date.
 * Pas besoin de rediriger l'utilisateur vers une autre page, ou de lui expliquer le
 * raisonnement qui a mené au résultat. Si la date calculée tombe un jour férié, le résultat
 * l'affichera en petits caractères. »
 *
 * Ce fichier vérifie donc désormais l'INVERSE de ce qu'il vérifiait, et deux choses de plus :
 *
 *  1. **la date EST là**, dans le héros, sans navigation — et le formulaire reste un `GET`
 *     natif, qui revient sur l'accueil : le héros fonctionne script désactivé ;
 *  2. **rien d'autre n'est là.** Le raisonnement, les jours écartés, les lectures nommées, la
 *     « lecture la plus large », le jour praticable, les avertissements, le permalien,
 *     l'impression et « Copier le raisonnement » ne doivent PAS revenir par cette porte. Le
 *     PORTAIL, lui, les garde tous — voir `DelaiCalculateur.rendu.test.tsx` ;
 *  3. **la seule mention gardée** : si la date calculée tombe un jour du calendrier — ou un
 *     dimanche, ⚠️ **ajout à l'instruction et non déduction** — une ligne en petits caractères
 *     le dit, en nommant le jour.
 *
 * ⚠️ **CE QUI N'A PAS CHANGÉ : pas une miette du répertoire.** Le héros portait un `<select>`
 * de cinq raccourcis — appel art. 354, pourvoi art. 417, opposition art. 295 et 296, référé
 * art. 756 — et un lien « Voir tout le répertoire ». Le répertoire est réservé aux titulaires
 * d'un compte : cinq entrées avec leurs numéros d'article en public, c'étaient cinq de trop.
 * Restent deux champs, la date de réception et le nombre de jours francs.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { calculer, egales, parseIso } from '@/lib/delais'
import { CALENDRIER_COURANT, CALENDRIER_V1, VERSION_CALENDRIER_COURANTE } from '@/lib/delais/feries'
import { autre } from '@/lib/delais/fixtures'
import {
  PROROGATION_FRANC_PUR,
  entreeLectureStricte,
  restreindreAuFrancPur,
} from '@/lib/delais/franc-pur'
import { mentionsJour, reportPublic } from '@/lib/delais/mention-jour'
import type { SaisieHeros } from '@/components/delais/noyau-calculateur'
import { DelaisHeroSlide } from './DelaisHeroSlide'

const t = getDictionary('fr')

/**
 * La saisie telle que la PAGE la calcule et la passe au héros — reconstituée ici avec le
 * moteur et la configuration franc pur, sans base ni navigateur. Le chemin réel
 * (`lireHerosDelais`, Prisma simulé) est éprouvé dans `DelaiCalculateur.rendu.test.tsx`.
 */
function saisie(
  iso: string,
  jours: number,
  // ⚠️ **LE CALENDRIER EST UN PARAMÈTRE DEPUIS LE 20 AOÛT 2026**, et son défaut est le
  // COURANT — la version 2, celle du décret du 11 décembre 2024, que la page rend en
  // production. Il était figé à `CALENDRIER_V1` : le héros aurait continué d'être éprouvé
  // sous un calendrier que plus personne ne sert. Un test le pose encore expressément à la
  // version 1, parce qu'un permalien `c=1` la rend toujours.
  entrees: readonly (typeof CALENDRIER_COURANT)[number][] = CALENDRIER_COURANT,
  version: number = VERSION_CALENDRIER_COURANTE,
): SaisieHeros {
  const entree = { ...autre(jours, 'Délai indiqué dans l’acte', 'oui'), ...PROROGATION_FRANC_PUR }
  const brut = calculer({
    depart: parseIso(iso)!,
    entree,
    versionCalendrier: version,
    entreesCalendrier: entrees,
  })
  const resultat = restreindreAuFrancPur(brut, 'fr')
  return {
    valeurs: { d: iso, n: String(jours) },
    erreur: null,
    resultat,
    mentions:
      resultat.statut === 'CALCUL' ? mentionsJour(resultat.teteAffiche, entrees, 'fr') : [],
    report: reportPublic(resultat, entrees, 'fr'),
    // § 0 — la date de l'AUTRE surface, calculée par le MÊME moteur sous la configuration du
    // portail (`prorogationTeteLarge: false`). C'est ce que `calculPublic()` fait en
    // production ; le reconstituer ici garde l'accueil et `/[locale]/delais` d'accord.
    lectureStricte: (() => {
      if (resultat.statut !== 'CALCUL') return null
      const strict = calculer({
        depart: parseIso(iso)!,
        entree: entreeLectureStricte(entree),
        versionCalendrier: version,
        entreesCalendrier: entrees,
      })
      if (strict.statut !== 'CALCUL') return null
      return egales(strict.teteAffiche, resultat.teteAffiche) ? null : strict.teteAffiche
    })(),
  }
}

const rendu = (s?: SaisieHeros | null) =>
  renderToStaticMarkup(<DelaisHeroSlide locale="fr" t={t} saisie={s} />)

/** Avant toute soumission : le héros est un formulaire, et rien d'autre. */
const vide = rendu()
/** 4 juin 2026 + 15 jours francs → samedi 20 juin 2026. Un jour sans mention. */
const calcule = rendu(saisie('2026-06-04', 15))

// ===========================================================================
// 1. IL CALCULE SUR PLACE — c'est l'inversion
// ===========================================================================

describe('le héros MONTRE la date, dans le héros', () => {
  it('la date en toutes lettres ET en chiffres, avec le jour de la semaine', () => {
    expect(calcule).toContain('samedi 20 juin 2026 — 20/06/2026')
    expect(calcule).toContain('Date limite')
  })

  it('… et rien avant la première soumission : l’accueil n’a pas d’état vide à meubler', () => {
    expect(vide).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(vide).not.toContain('Date limite')
    for (const mot of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
      expect(vide.toLowerCase(), mot).not.toContain(mot)
    }
  })

  it('le champ date est VIDE tant que rien n’a été soumis : aucun « aujourd’hui » proposé', () => {
    expect(vide).toContain('name="d"')
    expect(vide).not.toMatch(/name="d"[^>]*value="[^"]+"/)
  })

  /** Une date affichée au-dessus de deux champs vides serait une date sans sa saisie. */
  it('après la soumission, les deux champs se relisent', () => {
    expect(calcule).toMatch(/name="d"[^>]*value="2026-06-04"/)
    expect(calcule).toMatch(/name="n"[^>]*value="15"/)
  })
})

describe('il ne redirige plus — le GET revient sur l’accueil', () => {
  it('c’est un formulaire GET vers `/fr`, et il marche sans JavaScript', () => {
    expect(vide).toContain('method="get"')
    expect(vide).toContain('action="/fr"')
    expect(vide).toContain('type="submit"')
    // L'ancienne cible. Le héros ne renvoie plus vers la page publique, ni par le formulaire,
    // ni par un lien « voir le détail » : il n'y a plus de détail à voir.
    expect(vide).not.toContain('action="/fr/delais"')
    expect(calcule).not.toContain('/fr/delais')
  })

  it('le bouton Calculer est en Wouj, texte Blan (5,43:1 ; Chabon sur Wouj tombe à 2,76:1)', () => {
    const ligne = vide.slice(vide.indexOf('type="submit"') - 400, vide.indexOf('type="submit"') + 200)
    expect(ligne).toContain('bg-wouj')
    expect(ligne).toContain('text-white')
  })
})

// ===========================================================================
// 2. ET RIEN D'AUTRE — la moitié la plus fragile de cette livraison
// ===========================================================================

describe('⚠️ le héros n’explique RIEN : aucun appareil du portail', () => {
  const interdits = [
    ['le raisonnement pas à pas', t.delais.stepsTitle],
    ['les jours écartés', t.delais.skippedTitle],
    ['les lectures nommées', t.delais.readingsTitle],
    ['la lecture la plus large', t.delais.widestReading],
    ['le dernier jour praticable', t.delais.practicableTitle],
    ['les avertissements', t.delais.warningsTitle],
    ['les textes appliqués', t.delais.textsTitle],
    ['les fenêtres de signification', t.delais.windowsTitle],
    ['le permalien', t.delais.permalinkLabel],
    ['copier le raisonnement', t.delais.copyReasoning],
    ['imprimer', t.delais.print],
    ['le cadre pédagogique', t.delais.emptyTitle],
  ] as const

  for (const [quoi, phrase] of interdits) {
    it(`ni ${quoi}`, () => {
      expect(calcule, phrase).not.toContain(phrase)
      expect(vide, phrase).not.toContain(phrase)
    })
  }

  it('ni la phrase de sécurité, ni le pied technique, ni un code d’avertissement', () => {
    expect(calcule).not.toContain('Agir au plus tard')
    expect(calcule).not.toContain('Calendrier des fêtes : version')
    expect(calcule).not.toContain('Ce calcul ne remplace pas la vérification du texte')
    expect(calcule).not.toMatch(/\bA-?[1-6]\b/)
  })
})

// ===========================================================================
// 3. LA SEULE MENTION CONSERVÉE
// ===========================================================================

describe('la date a été REPORTÉE : une ligne en petits caractères dit pourquoi', () => {
  /**
   * ⚠️ **LE CAS DE ME VAVAL, RETOURNÉ LE JOUR MÊME.** Le 4 juin 2026 + 30 jours francs posait
   * l'échéance au dimanche 5 juillet, et le héros l'affichait telle quelle. Elle a tranché
   * autrement en la voyant : « il faut la proroger au prochain jour ouvrable, donc le lundi
   * 6 juillet ». La date affichée est désormais le lundi — et la ligne fine dit d'où vient le
   * jour supplémentaire, sinon le report est incompréhensible.
   */
  const reporte = rendu(saisie('2026-06-04', 30))

  it('la date affichée est le LUNDI 6 juillet, pas le dimanche 5', () => {
    expect(reporte).toContain('lundi 6 juillet 2026 — 06/07/2026')
    expect(reporte).not.toContain('dimanche 5 juillet 2026 — 05/07/2026')
  })

  it('… et la ligne fine nomme le jour franchi, puis la date d’arrivée et l’article', () => {
    // ⚠️ La date arrive SANS jour de semaine dans ce gabarit-là : « Le dimanche 5 juillet 2026
    // est un dimanche. » redisait le mot que la date portait déjà (voir `publicDaySunday`).
    expect(reporte).toContain('Le 5 juillet 2026 tombe un dimanche.')
    expect(reporte).not.toContain('Le dimanche 5 juillet 2026 est un dimanche.')
    // ⚠️ « droit commun de la computation » : la surface publique ne demande pas la matière et
    // ne peut donc pas affirmer quel article régit LE délai saisi (art. 511 al. 2 C. trav. en
    // matière de travail).
    expect(reporte).toContain(
      'Le délai est prorogé au lundi 6 juillet 2026 — droit commun de la computation, C. pr. civ., art. 991 al. 3.',
    )
    // Un seul jour franchi : c'est la LETTRE de l'article, pas la cascade.
    expect(reporte).not.toContain('la plateforme répète le report')
  })

  /**
   * ⚠️ **L'ACCUEIL ET `/[locale]/delais` RENDENT LE MÊME ÉCRAN** : ce que l'un dit du report,
   * l'autre le dit aussi. Le héros portait `mentions` et `report` mais PAS `lectureStricte` —
   * la réserve du § 0 aurait manqué sur la page la plus vue du site.
   */
  /**
   * ⚠️ **L'ÉCART S'EST RESSERRÉ D'UN JOUR LE 20 AOÛT 2026 AU MATIN, PUIS IL A DISPARU LE SOIR.**
   * Le décret du 11 décembre 2024 a donné un texte à la Toussaint : la tête étroite a prorogé
   * jusqu'au dimanche 2 (matin). Puis Me Vaval a répondu OUI aux fêtes nationales et à la
   * cascade : les deux surfaces appliquent la même version de règles, et sous le calendrier
   * COURANT elles rendent la même date — la réserve n'a plus rien à nommer, et la ligne ne
   * paraît plus du tout. Mesuré : 0 divergence sur 1 826 départs × 4 durées
   * (`franc-pur.test.ts`, § 0). Ce que le héros doit rendre, c'est la date, sans réserve.
   */
  it('la réserve du § 0 ne traverse plus : sous le calendrier courant, il n’y a rien à nommer', () => {
    const html = rendu(saisie('2025-10-01', 30))
    expect(html).not.toContain('Sous la lecture stricte de l’art. 991 al. 3')
    expect(html).not.toContain('le délai expirait le')
    // ... et la date, elle, est bien celle que Me Vaval a validée.
    expect(html).toContain('lundi 3 novembre 2025')
  })

  /** Le même départ sous le calendrier de la VERSION 1 : c'est ce que rend un permalien `c=1`. */
  it('… et sous la version 1, la même réserve nomme encore le samedi 1er novembre', () => {
    const html = rendu(saisie('2025-10-01', 30, CALENDRIER_V1, 1))
    expect(html).toContain('le délai expirait le samedi 1er novembre 2025')
  })

  it('c’est du TEXTE FIN : pas d’encadré, pas de couleur d’alerte, pas de pastille', () => {
    const i = reporte.indexOf('Le délai est prorogé au')
    const ligne = reporte.slice(i - 200, i)
    expect(ligne).toContain('text-xs')
    expect(ligne).toContain('text-grafit')
    expect(ligne).not.toContain('bg-sitwon')
    expect(ligne).not.toContain('role="status"')
    expect(ligne).not.toContain('border-wouj')
  })

  /**
   * ⚠️ **LA CASCADE — LE CAS DE CONTRÔLE DE LA CLIENTE**, et il TIENT après la bascule de
   * calendrier : 1er octobre 2025 + 30 jours francs → lundi 3 novembre 2025. Le samedi
   * 1er novembre est La Toussaint : elle était portée sans texte au calendrier de la
   * version 1, le décret du 11 décembre 2024 l'institue, et la ligne fine la nomme
   * désormais pour ce qu'elle est — une fête légale, sans réserve.
   */
  it('la cascade : deux jours franchis, et chaque jour est nommé pour ce qu’il est', () => {
    const html = rendu(saisie('2025-10-01', 30))
    expect(html).toContain('lundi 3 novembre 2025 — 03/11/2025')
    expect(html).toContain('Le samedi 1er novembre 2025 est un jour de fête légale (La Toussaint).')
    expect(html).not.toContain('sans texte instituant')
    expect(html).toContain('Le dimanche 2 novembre 2025 est un jour de fête légale (Fête des Morts).')
    // ⚠️ **LA SECONDE LIGNE NE DISAIT PLUS RIEN.** Le 2 novembre 2025 est une fête légale ET un
    // dimanche : l'écran écrivait « Le dimanche 2 novembre 2025 est un dimanche. » juste après
    // la ligne qui portait déjà, dans sa date, le mot « dimanche ». Quand un jour porte deux
    // qualités, seule celle qui apprend quelque chose est rendue — décision d'écran :
    // `reportPublic` continue de rendre les deux mentions, et son test les garde.
    expect(html).not.toContain('Le dimanche 2 novembre 2025 est un dimanche.')
    expect(html).not.toContain('2 novembre 2025 tombe un dimanche')
    expect(html).toContain('Le délai est prorogé au lundi 3 novembre 2025')
    // ⚠️ DEUX jours franchis pour un article qui proroge « d'UN jour » : la cascade est une
    // LECTURE, et l'écran doit la dire — sinon il impute à l'art. 991 al. 3 un report qu'il ne
    // donne pas. 39 résultats sur 1 825 franchissent deux jours ou plus.
    expect(html).toContain('L’art. 991 al. 3 proroge d’un jour ; la plateforme répète le report')
  })

  /** ⚠️ LE SAMEDI NE PROROGE PAS — instruction expresse de Me Vaval. */
  it('un samedi ordinaire : la date ne bouge pas, et rien n’est écrit', () => {
    expect(calcule).toContain('samedi 20 juin 2026 — 20/06/2026')
    expect(calcule).not.toContain('est prorogé au')
    expect(calcule).not.toContain('est un jour de fête')
    expect(calcule).not.toContain('est un dimanche')
    expect(calcule).not.toContain('jour à surveiller')
  })

  /**
   * ⚠️ **LES JOURS À SURVEILLER NE PROROGENT PAS**, et ils gardent leur mention (§ 4.13). Le
   * 7 janvier 2026 + 30 jours francs tombe le samedi 7 février, jour à surveiller.
   */
  it('un jour à surveiller garde sa mention SANS déplacer la date', () => {
    const html = rendu(saisie('2026-01-07', 30))
    expect(html).toContain('samedi 7 février 2026 — 07/02/2026')
    expect(html).toContain('est un jour à surveiller')
    expect(html).not.toContain('est prorogé au')
  })
})

// ===========================================================================
// 4. CE QUI N'A PAS CHANGÉ
// ===========================================================================

describe('DEUX CHAMPS, et deux seulement', () => {
  it('la date de RÉCEPTION de l’acte, en champ natif', () => {
    expect(vide).toContain('Date de réception de l’acte')
    expect(vide).toContain('type="date"')
    // « Date de départ » était plus vague que la réalité sur une page qui ne calcule que sur
    // un acte reçu ; ce libellé-là est réservé à l'espace connecté.
    expect(vide).not.toContain('Date de départ')
  })

  it('le nombre de jours FRANCS, saisi à la main', () => {
    expect(vide).toContain('Nombre de jour(s) francs')
    expect(vide).toContain('name="n"')
    expect(vide).not.toContain('Quel délai')
  })

  it('aucun autre champ soumis : ni `e`, ni `f`, ni champ caché', () => {
    for (const html of [vide, calcule]) {
      const noms = [...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1])
      expect([...new Set(noms)].sort()).toEqual(['d', 'n'])
      expect(html).not.toContain('type="hidden"')
    }
  })
})

describe('pas une miette du répertoire', () => {
  it('aucun `<select>`, aucune `<option>`', () => {
    expect(vide).not.toContain('<select')
    expect(vide).not.toContain('<option')
  })

  it('aucun slug d’entrée, aucun numéro d’article des cinq anciens raccourcis', () => {
    for (const article of ['354', '417', '295', '296', '756']) {
      expect(vide, article).not.toContain(article)
    }
    expect(vide).not.toContain('cpc-')
  })

  it('ni « Voir tout le répertoire », ni invitation à se connecter', () => {
    expect(vide).not.toContain('Voir tout le répertoire')
    expect(vide).not.toContain('réservé aux titulaires')
    expect(vide).not.toContain('href="/fr/login"')
  })

  it('rien n’est imbriqué dans une ancre — une ancre dans une ancre est invalide', () => {
    expect(vide).not.toMatch(/<a[^>]*>[\s\S]*<a[^>]*>/)
  })
})

describe('le héros DIT ce qu’il calcule, et ce qui manque', () => {
  it('la règle de droit est écrite ici, dans les mots de Me Vaval', () => {
    expect(vide).toContain(
      'Conformément au Code de procédure civile haïtien et au Code du travail, le délai franc ne compte ni le jour de la réception, ni le jour de l’échéance.',
    )
    expect(vide).not.toContain('ordinaire')
  })

  /** Une même phrase de droit, dite deux fois dans un même héros, est une phrase de trop. */
  it('… et elle n’y figure QU’UNE fois, y compris sous la date', () => {
    for (const html of [vide, calcule]) {
      expect(html.split(t.delais.francRule).length - 1).toBe(1)
    }
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LA RÉSERVE, ET ELLE MANQUAIT ICI SEULEMENT** (20 août 2026).
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * `/{locale}/delais` et `/{locale}/outils/delais` portent `disclaimer` en pied depuis le
   * premier jour. Le héros, lui — la page la plus vue du site, et la seule que TOUT visiteur
   * voie dès la mise en ligne —, affichait la date NUE. Une date de forclusion sans un mot
   * sur ce qu'elle n'est pas.
   */
  it('la réserve est écrite sous la date, ici comme sur les deux autres surfaces', () => {
    for (const html of [vide, calcule]) {
      expect(html).toContain('Information documentaire, non officielle')
      expect(html).toContain('ne remplace ni la lecture du texte ni l’avis d’un praticien')
    }
  })

  it('… c’est la MÊME clé que les deux autres surfaces, et elle ne s’écrit qu’une fois', () => {
    for (const html of [vide, calcule]) {
      expect(html).toContain(t.delais.disclaimer)
      expect(html.split(t.delais.disclaimer).length - 1).toBe(1)
    }
  })

  it('… et dans les trois langues : aucune surface publique ne rend une date sans réserve', async () => {
    const { LOCALES } = await import('@/lib/types')
    for (const l of LOCALES) {
      const tl = getDictionary(l)
      const html = renderToStaticMarkup(<DelaisHeroSlide locale={l} t={tl} saisie={null} />)
      expect(tl.delais.disclaimer.length, l).toBeGreaterThan(60)
      expect(html, l).toContain(tl.delais.disclaimer)
    }
  })

  it('le sous-titre a été RETIRÉ, et la note « avec ses réserves » avec lui', () => {
    expect(vide).not.toContain('le raisonnement qui fonde la date')
    expect(vide).not.toContain('avec ses réserves')
    expect(vide).not.toContain('Le résultat s’affiche')
  })

  it('les deux champs vides, le héros ÉCRIT une consigne — plus un inventaire', () => {
    expect(vide).toContain('Indiquer la date de réception de l’acte')
    expect(vide).not.toContain('Il manque :')
    expect(vide).not.toContain('Date de réception de l’acte ·')
  })

  /** Un refus se lit LÀ OÙ LA SAISIE EST, et il ne s’accompagne d’aucune date. */
  it('une date impossible : le refus est écrit, et rien n’est calculé', () => {
    const html = rendu({
      valeurs: { d: '31/02/2026', n: '15' },
      erreur: 'dateImpossible',
      resultat: null,
      mentions: [],
      report: null,
      lectureStricte: null,
    })
    expect(html).toContain('Cette date n’existe pas')
    expect(html).not.toContain('Date limite')
    expect(html).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('les phrases viennent du catalogue, dans les trois langues — aucune clé inventée', async () => {
    const { LOCALES } = await import('@/lib/types')
    for (const l of LOCALES) {
      const d = getDictionary(l).delais
      for (const cle of [
        'francRule',
        'missingDate',
        'missingDays',
        'publicDayHoliday',
        'publicDayNational',
        'publicDayEditorial',
        'publicDayWatch',
        // § 4.10 — la demi-journée du Lundi Gras (20 août 2026, au vu du décret). Elle est la
        // SEULE mention qui parle d'une heure, et une clé neuve posée en français seulement
        // rendrait, sur /en et /ht, une date limite sans un mot sur la fermeture à midi.
        'publicDayHalfDay',
        'publicDaySunday',
      ] as const) {
        expect(d[cle], `${l}.${cle}`).toBeTruthy()
      }
      // Les cinq gabarits du calendrier portent leurs DEUX substitutions ; le dimanche,
      // qui ne nomme aucune entrée, n'en porte qu'une.
      for (const cle of [
        'publicDayHoliday',
        'publicDayNational',
        'publicDayEditorial',
        'publicDayWatch',
        'publicDayHalfDay',
      ] as const) {
        expect(d[cle], `${l}.${cle}`).toContain('{date}')
        expect(d[cle], `${l}.${cle}`).toContain('{nom}')
      }
      expect(d.publicDaySunday, l).toContain('{date}')
      expect(d.publicDaySunday, l).not.toContain('{nom}')
      // § 4.10 — la mention DIT l'heure : sans le mot, elle ne vaut pas mieux que
      // `publicDayHoliday`, qui laisse attendre un report qui n'a pas eu lieu.
      expect(d.publicDayHalfDay.toLowerCase(), l).toMatch(/midi|noon/)
    }
    // Trois textes DIFFÉRENTS : un repli silencieux sur le français passerait sinon pour une
    // traduction relue.
    expect(new Set(LOCALES.map((l) => getDictionary(l).delais.publicDayHalfDay)).size).toBe(3)
  })
})

/**
 * § 8.2 — **LA LIGNE DU REPORT EXISTE DANS LES TROIS LANGUES.** Une clé neuve posée en
 * français seulement rendrait, sur `/en` et `/ht`, une date déplacée sans un mot d'explication
 * — ou pire, la phrase française sous un écran anglais.
 */
describe('§ 8.2 — le report se dit en français, en anglais et en créole', () => {
  for (const locale of ['fr', 'en', 'ht'] as const) {
    it(`${locale} : la date d’arrivée, le jour franchi et l’article`, () => {
      const dico = getDictionary(locale)
      const s = saisie('2026-06-04', 30)
      const html = renderToStaticMarkup(<DelaisHeroSlide locale={locale} t={dico} saisie={s} />)
      // L'article est une CITATION : il reste en français dans les trois langues (§ 8.2).
      expect(html).toContain('C. pr. civ., art. 991 al. 3')
      // Le gabarit de la langue demandée, et lui seul.
      const attendu = dico.delais.publicDeferred.split('{')[0].trim()
      expect(attendu.length).toBeGreaterThan(5)
      expect(html).toContain(attendu)
      for (const autre of ['fr', 'en', 'ht'] as const) {
        if (autre === locale) continue
        const gabarit = getDictionary(autre).delais.publicDeferred.split('{')[0].trim()
        if (gabarit !== attendu) expect(html, `${locale} contient du ${autre}`).not.toContain(gabarit)
      }
    })
  }
})
