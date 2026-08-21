/**
 * LES DEUX SURFACES DU CALCULATEUR — **ce que chacune EMBARQUE, et ce que ses en-têtes
 * affirment.**
 *
 * Deux défauts que ni le typecheck ni un test de rendu ne voient, et que ce fichier attrape :
 *
 *  1. **la page publique téléchargeait le code du menu connecté.** `DelaiCalculateur` importait
 *     statiquement `DelaiForm` ET `DelaiFormPublic` alors qu'il n'en rendait qu'un : Next place
 *     tout composant client atteint depuis une route dans le graphe client de CETTE route, que
 *     le JSX le rende ou non. Le chunk du formulaire connecté (≈ 31 ko — filtre du répertoire,
 *     kilométrages, question de suite) partait donc vers la page d'entrée publique. Ce n'était
 *     pas une fuite de DONNÉES — les 393 entrées ne sont ni lues ni servies là — mais la
 *     mécanique complète d'un menu réservé livrée à qui n'y a pas droit ;
 *  2. **des en-têtes qui disent l'inverse du code livré.** Dans un dépôt où les commentaires
 *     tiennent lieu de spécification et sont relus avant chaque édition, une consigne périmée
 *     se rejoue : `DelaiCalculateur` affirmait encore « le champ de saisie est en JJ/MM/AAAA
 *     (§ 8.3 : `<input type="date">` est proscrit) » alors que le champ EST natif depuis que la
 *     cliente l'a demandé. La prochaine session lirait « proscrit » et déferait le champ.
 *
 * ⚠️ Ce fichier lit les SOURCES : il n'a besoin ni de base, ni de build, ni de navigateur.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { dirname, join, resolve } from 'node:path'
import { jourMobile } from '@/lib/delais/paques'
import { CALENDRIER_COURANT } from '@/lib/delais/feries'
import { PROROGATION_FRANC_PUR } from '@/lib/delais/franc-pur'
import { mentionsJour } from '@/lib/delais/mention-jour'
import { ARTICLE_PROROGATION_PAR_CODE } from '@/lib/delais/regimes'
import { phraseMention } from './DelaiDatePublique'

const RACINE = process.cwd()
const SRC = join(RACINE, 'src')

/** Résout un spécificateur d'import vers un fichier du dépôt, ou `null` si c'est un paquet. */
function resoudre(depuis: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(depuis), spec)
  else return null // `react`, `next/link`, … : hors du dépôt.
  for (const candidat of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidat) && !existsSync(join(candidat, '.'))) return candidat
    if (existsSync(candidat) && /\.tsx?$/.test(candidat)) return candidat
  }
  return null
}

const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^\n]*?from\s+['"]([^'"]+)['"]/g

/**
 * ⚠️ **UN IMPORT SUR PLUSIEURS LIGNES EST UN IMPORT.** `IMPORT` ne franchit pas les sauts de
 * ligne — un `import {\n  a,\n  b,\n} from '…'` lui échappait entièrement, et le graphe
 * s'arrêtait donc AVANT plusieurs fichiers réellement embarqués. Le contrôle ne rendait pas
 * de faux positifs (ce qu'il voyait, il le voyait juste), mais il pouvait déclarer une
 * surface propre parce qu'il n'était pas allé regarder. On replie donc les listes entre
 * accolades sur une ligne avant de chercher : une liste de spécificateurs ne contient jamais
 * d'accolade imbriquée, et les `import` étant tous au premier niveau, aucun saut de ligne qui
 * PRÉCÈDE un `import` ne se trouve dans une accolade.
 */
const surUneLigne = (source: string) =>
  source.replace(/\{[^{}]*\}/g, (bloc) => bloc.replace(/\n/g, ' '))

/** Tous les fichiers du dépôt atteignables depuis `entree`, en suivant les `import`. */
function grapheDepuis(entree: string): Set<string> {
  const vus = new Set<string>()
  const pile = [resolve(RACINE, entree)]
  while (pile.length) {
    const f = pile.pop()!
    if (vus.has(f) || !existsSync(f)) continue
    vus.add(f)
    const source = surUneLigne(readFileSync(f, 'utf8'))
    for (const m of source.matchAll(IMPORT)) {
      // Un import de TYPE ne survit pas à la compilation : il n'emporte aucun code.
      if (/\bimport\s+type\b/.test(m[0])) continue
      const cible = resoudre(f, m[1])
      if (cible) pile.push(cible)
    }
  }
  return vus
}

const PAGE_PUBLIQUE = 'src/app/[locale]/delais/page.tsx'
const PAGE_CONNECTEE = 'src/app/[locale]/(app)/outils/delais/page.tsx'
/** L'ACCUEIL est la troisième surface : depuis le 20 août 2026, son héros calcule sur place. */
const PAGE_ACCUEIL = 'src/app/[locale]/page.tsx'
const FORM_CONNECTE = join(SRC, 'components/delais/DelaiForm.tsx')
const FORM_PUBLIC = join(SRC, 'components/delais/DelaiFormPublic.tsx')
const composant = (nom: string) => join(SRC, 'components/delais', nom)

describe('le graphe d’une surface ne contient QUE son formulaire', () => {
  const publique = grapheDepuis(PAGE_PUBLIQUE)
  const connectee = grapheDepuis(PAGE_CONNECTEE)

  it('la sonde tient : les deux pages atteignent bien leur propre formulaire', () => {
    expect(publique.has(FORM_PUBLIC)).toBe(true)
    expect(connectee.has(FORM_CONNECTE)).toBe(true)
  })

  it('la page PUBLIQUE n’atteint pas le formulaire du répertoire', () => {
    expect(publique.has(FORM_CONNECTE)).toBe(false)
  })

  it('la page CONNECTÉE n’emporte pas non plus le formulaire public', () => {
    expect(connectee.has(FORM_PUBLIC)).toBe(false)
  })

  /**
   * Le noyau reste PARTAGÉ : frein de débit, normalisation de la requête, lecture de base,
   * calcul. Deux chemins de calcul seraient deux vérités — c'est l'inverse exact de ce que
   * cette scission cherche, et le contrôle le dit pour qu'on ne le défasse pas en croyant
   * bien faire.
   *
   * ⚠️ **`DelaiCalculateur.tsx` A QUITTÉ CETTE LISTE le 20 août 2026, et ce n'est pas un
   * relâchement.** Le noyau vivait dans ce fichier, à côté du cadre à deux colonnes du
   * portail — qui rend `DelaiResult` et `DelaiPedagogie`, donc `DelaiActions`. Il a été
   * extrait dans `noyau-calculateur.tsx` : c'est LUI qui est désormais commun, et le cadre
   * du portail ne l'est plus. Voir le bloc suivant, qui dit pourquoi.
   */
  it('… mais le NOYAU, lui, est bien le même des deux côtés', () => {
    for (const commun of ['noyau-calculateur.tsx', 'messages.ts', 'DelaiDateField.tsx']) {
      expect(publique.has(composant(commun)), commun).toBe(true)
      expect(connectee.has(composant(commun)), commun).toBe(true)
    }
    // Et le moteur lui-même, une seule fois pour les deux : `calculPublic` est le seul point
    // par lequel une date publique est produite.
    const lecture = join(SRC, 'lib/delais/lecture-publique.ts')
    expect(publique.has(lecture)).toBe(true)
    expect(connectee.has(lecture)).toBe(true)
  })

  /**
   * ⚠️ Le contrôle par le NOM du fichier ne suffirait pas : c'est le CODE du menu réservé qui
   * ne doit pas partir. On vérifie donc qu'aucun libellé propre au formulaire connecté n'est
   * atteignable depuis la page publique — ce sont exactement les marqueurs relevés dans le
   * chunk fautif du build de production.
   */
  it('aucun libellé du menu réservé n’est atteignable depuis la surface publique', () => {
    const MARQUEURS = ['entryGroupTableau', 'kmLabelFirst', 'supplementLegend', 'otherSourceLabel']
    // Un commentaire ne part pas au navigateur : on ne traque que du CODE. (Les en-têtes de
    // ce dépôt nomment volontiers ce qu'ils excluent — ce test ne doit pas les punir.)
    const sansCommentaires = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, '')
    for (const f of publique) {
      // Les catalogues de traduction portent TOUTES les clés : ils ne sont pas le sujet, et
      // la page publique en a besoin. Ce qu'on traque est le composant qui les CONSOMME.
      if (f.includes(join('lib', 'i18n'))) continue
      const source = sansCommentaires(readFileSync(f, 'utf8'))
      for (const marqueur of MARQUEURS) {
        expect(source.includes(marqueur), `${f} → ${marqueur}`).toBe(false)
      }
    }
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 6.1 / § 6.2 (Me Vaval, 20 août 2026) — **L'APPAREIL DU RAISONNEMENT RESTE AU PORTAIL**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * « Le portail public doit uniquement afficher la date. Pas besoin de rediriger l'utilisateur
 * vers une autre page, ou de lui expliquer le raisonnement qui a mené au résultat. »
 *
 * Les deux surfaces publiques — l'accueil et `/{locale}/delais` — n'affichent plus que la
 * date et, le cas échéant, la mention du jour. Le risque de cette livraison n'est PAS qu'elles
 * en montrent trop : c'est qu'en les dépouillant on MUTILE le portail, ou qu'on leur laisse
 * dans le graphe client l'appareil qu'elles ne rendent plus. Ce bloc surveille les deux sens.
 *
 * ⚠️ Le contrôle par le NOM du fichier ne suffirait pas — un fichier peut être atteint sans
 * être rendu. C'est précisément le point : Next place tout composant client atteint depuis une
 * route dans le graphe client de CETTE route, que le JSX le rende ou non. Un import suffit.
 */
describe('§ 6.1 — la surface publique n’atteint plus l’appareil du raisonnement', () => {
  const publique = grapheDepuis(PAGE_PUBLIQUE)
  const accueil = grapheDepuis(PAGE_ACCUEIL)
  const connectee = grapheDepuis(PAGE_CONNECTEE)

  /** `DelaiActions` porte « Copier le raisonnement » et « Imprimer » ; il est client. */
  const APPAREIL = [
    'DelaiCalculateur.tsx',
    'DelaiResult.tsx',
    'DelaiPedagogie.tsx',
    'DelaiActions.tsx',
  ]

  it('la sonde tient : le PORTAIL, lui, atteint bien les quatre', () => {
    for (const f of APPAREIL) expect(connectee.has(composant(f)), f).toBe(true)
  })

  it('la page `/[locale]/delais` n’en atteint aucun', () => {
    for (const f of APPAREIL) expect(publique.has(composant(f)), f).toBe(false)
  })

  it('l’ACCUEIL non plus — son héros calcule, il n’explique pas', () => {
    for (const f of APPAREIL) expect(accueil.has(composant(f)), f).toBe(false)
  })

  /** Les deux surfaces publiques rendent le MÊME écran de résultat : une date, une mention. */
  it('… et toutes deux passent par le même `DelaiDatePublique`', () => {
    expect(publique.has(composant('DelaiDatePublique.tsx'))).toBe(true)
    expect(accueil.has(composant('DelaiDatePublique.tsx'))).toBe(true)
    // Le portail, lui, ne le rend pas : il a `DelaiResult`, qui dit tout.
    expect(connectee.has(composant('DelaiDatePublique.tsx'))).toBe(false)
  })

  /**
   * ⚠️ Le CODE, pas seulement le fichier. Ces marqueurs sont les libellés que seul l'appareil
   * du portail consomme : s'ils redevenaient atteignables depuis une surface publique, c'est
   * qu'un écran du portail y serait revenu par une porte dérobée.
   */
  it('aucun libellé de l’appareil n’est atteignable depuis une surface publique', () => {
    const MARQUEURS = ['stepsTitle', 'skippedTitle', 'readingsTitle', 'practicableTitle', 'warningsTitle', 'copyReasoning', 'permalinkLabel']
    const sansCommentaires = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, '')
    for (const graphe of [publique, accueil]) {
      for (const f of graphe) {
        // Les catalogues de traduction portent TOUTES les clés : ils ne sont pas le sujet.
        if (f.includes(join('lib', 'i18n'))) continue
        const source = sansCommentaires(readFileSync(f, 'utf8'))
        for (const marqueur of MARQUEURS) {
          expect(source.includes(marqueur), `${f} → ${marqueur}`).toBe(false)
        }
      }
    }
  })
})

/**
 * ⚠️ **`publicIntro` A ÉTÉ RETIRÉ DES TROIS CATALOGUES**, avec le raisonnement lui-même : « la
 * plateforme rend la date, et le raisonnement qui la fonde » promettait ce que la page ne fait
 * plus. Une clé morte laissée en place se recopie, et la phrase reviendrait avec elle.
 */
describe('§ 1 — aucune surface publique ne promet un raisonnement', () => {
  it('la clé `publicIntro` n’existe plus, dans aucune des trois langues', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(getDictionary(l).delais, l).not.toHaveProperty('publicIntro')
    }
  })

  it('… et la note publique ne le promet plus non plus', () => {
    expect(getDictionary('fr').delais.metaDescriptionPublique).not.toContain('raisonnement')
    expect(getDictionary('en').delais.metaDescriptionPublique).not.toContain('reasoning')
    expect(getDictionary('ht').delais.metaDescriptionPublique).not.toContain('rezònman')
  })

  /** Le PORTAIL, lui, garde sa tuile et sa note : elles décrivent ce qu'il fait vraiment. */
  it('le portail garde la phrase, là où elle est vraie', () => {
    expect(getDictionary('fr').delais.toolsSubtitle).toContain('le raisonnement qui fonde la date')
  })
})

/**
 * § 8.3 — LES EN-TÊTES DISENT CE QUE LE CODE FAIT.
 *
 * Le champ de date est un `<input type="date">` NATIF depuis que la cliente a jugé le bouton
 * « Ouvrir le calendrier » trop encombrant. Deux en-têtes le contredisaient encore —
 * `DelaiCalculateur.tsx` (« le champ de saisie est en JJ/MM/AAAA ; `<input type="date">` est
 * proscrit ») et `civil.ts` (`parseFrSaisie` justifiée par le même § 8.3).
 */
describe('§ 8.3 — aucun en-tête ne proscrit le champ que la cliente a demandé', () => {
  const FICHIERS = [
    'src/components/delais/DelaiDateField.tsx',
    'src/components/delais/DelaiCalculateur.tsx',
    'src/components/delais/DelaiFormPublic.tsx',
    'src/components/home/DelaisHeroChamps.tsx',
    'src/lib/delais/civil.ts',
  ].map((p) => ({ p, s: readFileSync(join(RACINE, p), 'utf8') }))

  it('la sonde tient : le champ EST natif', () => {
    const champ = FICHIERS.find((f) => f.p.endsWith('DelaiDateField.tsx'))!.s
    expect(champ).toContain('type="date"')
  })

  it('aucun ne déclare le champ natif « proscrit »', () => {
    for (const { p, s } of FICHIERS) {
      expect(s, p).not.toMatch(/type="date"[^\n]*proscrit|proscrit[^\n]*type="date"/)
    }
  })

  it('aucun n’affirme que le CHAMP DE SAISIE est en JJ/MM/AAAA', () => {
    for (const { p, s } of FICHIERS) {
      expect(s, p).not.toMatch(/champ de saisie est en JJ\/MM\/AAAA/)
    }
  })

  /**
   * ⚠️ **DEUXIÈME EN-TÊTE PÉRIMÉ PAR LA MÊME RÉÉCRITURE.** `startFormatHint` a été raccourci
   * en « Indiquer la date ; l'ordre affiché est celui de votre navigateur. » : l'énumération
   * jour/mois/année a été COUPÉE, et `fr.ts` explique pourquoi (« les NOMMER ne servait qu'à
   * les ordonner »). L'en-tête de `DelaiDateField.tsx` continuait pourtant d'affirmer
   * l'inverse — « elle NOMME les trois composantes sans en fixer l'ordre » —, si bien que deux
   * commentaires du même dépôt se contredisaient sur la même ligne de texte. Ce bloc existe
   * précisément parce qu'un en-tête de ce fichier avait DÉJÀ survécu à un changement de champ.
   */
  it('aucun n’affirme que l’indication de format NOMME les trois composantes', () => {
    for (const { p, s } of FICHIERS) {
      expect(s, p).not.toMatch(/NOMME les trois composantes/)
    }
  })

  /** LA SONDE de la sonde : l'indication existe toujours, et elle ne les nomme pas. */
  it('la sonde tient : l’indication est là, et elle n’énumère rien', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const hint = getDictionary(l).delais.startFormatHint
      expect(hint.length, l).toBeGreaterThan(0)
      expect(hint, l).not.toMatch(/JJ\/MM\/AAAA|jour.*mois.*année|day.*month.*year/i)
    }
  })
})

/**
 * § 1 (Me Vaval, 20 août 2026) — **LA NOTE DE CHAQUE SURFACE DÉCRIT CE QUE CETTE SURFACE FAIT.**
 *
 * « Corrige la note pour qu'elle dise ce que fait réellement l'outil : la date de tête ne
 * proroge pas, la prorogation est montrée à côté. »
 *
 * `metaDescription` était PARTAGÉE par les deux pages, et promettait la prorogation. Réécrite
 * pour le portail — où la prorogation existe bel et bien, mais **à côté** de la date, en lecture
 * nommée —, elle serait devenue fausse en public : `/[locale]/delais` ne rend ni lecture nommée,
 * ni « lecture la plus large », ni jour praticable. D'où deux notes, et ce contrôle, qui les
 * empêche de se recroiser.
 *
 * ⚠️ **CET EN-TÊTE DISAIT « NI PROROGATION » JUSQU'AU 20 AOÛT 2026 AU SOIR, ET C'ÉTAIT L'INVERSE
 * DU CODE LIVRÉ.** Depuis la seconde décision du jour, `/[locale]/delais` PROROGE : art. 991
 * al. 3, en cascade, sur le dimanche et les 16 entrées PERMANENT du calendrier. C'est
 * exactement la classe de défaut que ce fichier s'est donné pour mission d'attraper — voir son
 * en-tête, point 2 —, et il la portait lui-même. Le bloc « § 8.3 bis » ci-dessous la garde
 * désormais sur les quatre en-têtes concernés, celui-ci compris.
 */
describe('§ 1 — la note ne promet pas ce que la surface ne fait pas', () => {
  const source = (p: string) => readFileSync(join(RACINE, p), 'utf8')
  const sansCommentaires = (t: string) =>
    t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/[^\n]*/gm, '')

  it('la page PUBLIQUE prend `metaDescriptionPublique`, jamais celle du portail', () => {
    const s = sansCommentaires(source(PAGE_PUBLIQUE))
    expect(s).toContain('t.delais.metaDescriptionPublique')
    expect(s).not.toMatch(/t\.delais\.metaDescription\b/)
  })

  it('… et le PORTAIL garde `metaDescription`', () => {
    const s = sansCommentaires(source(PAGE_CONNECTEE))
    expect(s).toMatch(/t\.delais\.metaDescription\b/)
    expect(s).not.toContain('metaDescriptionPublique')
  })

  /**
   * ⚠️ **CE QUE CETTE RÈGLE DIT, ET CE QU'ELLE NE DIT PAS.** Elle dit : *la note publique ne
   * PROMET aucun report*. Elle ne dit PAS : « la surface publique ne nomme jamais l'art. 991 ».
   *
   * La nuance n'est pas de forme. Chaque calcul public dont la tête d'affiche tombe sur un
   * jour du calendrier écrit, à l'étape finale : « … n'est pas un dimanche, et C. pr. civ.,
   * art. 991 al. 3 ne le proroge pas dans la lecture retenue… ». C'est légitime, et même
   * nécessaire : le § 0 exige qu'aucune date ne soit rendue sans son raisonnement, et un
   * raisonnement qui tairait le texte qu'il vient d'écarter serait plus pauvre, pas plus
   * prudent. Mesuré : cela arrive douze fois par an (voir `franc-pur.test.ts`, § 3).
   *
   * Formulée « la surface publique ne nomme pas 991 », la règle conduirait la prochaine
   * édition à purger l'étape finale de sa référence au texte — en croyant obéir à ce test.
   * Ce qui est interdit, c'est la PROMESSE : annoncer un report dans une note que personne ne
   * peut vérifier. C'est exactement la phrase retirée de `publicFrancOnlyNote` le 20 août
   * 2026, et une note de page se recopie vite d'une locale à l'autre.
   */
  it('la note publique ne PROMET aucun report, dans aucune des trois langues', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(getDictionary(l).delais.metaDescriptionPublique, l).not.toContain('991')
    }
  })

  /** Et celle du portail, elle, DOIT dire où se lit la prorogation : à côté de la date. */
  it('la note du portail nomme la prorogation ET la place à côté de la date', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      expect(getDictionary(l).delais.metaDescription, l).toContain('991')
    }
    expect(getDictionary('fr').delais.metaDescription).toContain('sont montrées à côté')
    expect(getDictionary('fr').delais.intro).toContain('sont nommées à côté')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 8.3 bis — **LES QUATRE EN-TÊTES QUI DISAIENT « LE PUBLIC NE PROROGE PAS ».**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * C'est LA classe de défaut que ce fichier s'est donné pour mission d'attraper (voir son
 * en-tête, point 2), et il la portait lui-même. Me Vaval a tranché deux fois le 20 août 2026 :
 * le matin, la surface publique ne prorogeait pas ; l'après-midi, après avoir vu une date limite
 * tomber un dimanche, « il faut la proroger au prochain jour ouvrable ». Les en-têtes de
 * `franc-pur.ts` et de `mention-jour.ts` ont suivi ; **quatre autres sont restés au matin** :
 *
 *   1. `lecture-publique.ts`, sur le type `AccesDelais` — celui-là même qui DÉCIDE de la
 *      surface : il y annonçait un calcul franc et NU — départ + N + 1, et rien d'autre, sans
 *      report d'aucune sorte ;
 *   2. `fr.ts`, au-dessus de `metaDescriptionPublique` ;
 *   3. `en.ts`, au même endroit ;
 *   4. `ht.ts`, au même endroit.
 *
 * La gravité n'est pas rédactionnelle : une session qui ouvrirait `lecture-publique.ts` pour
 * toucher au périmètre public y lirait que le public ne proroge pas, et « rétablirait » le franc
 * pur — c'est-à-dire retirerait la prorogation que la cliente a demandée, en croyant obéir à la
 * spécification.
 *
 * ⚠️ **Ce bloc lit les COMMENTAIRES**, contrairement aux autres, qui les épargnent : ici, le
 * commentaire EST le sujet.
 */
describe('§ 8.3 bis — aucun en-tête ne dit que la surface publique ne proroge pas', () => {
  const EN_TETES = [
    'src/lib/delais/lecture-publique.ts',
    'src/lib/delais/franc-pur.ts',
    'src/lib/delais/mention-jour.ts',
    'src/lib/i18n/locales/fr.ts',
    'src/lib/i18n/locales/en.ts',
    'src/lib/i18n/locales/ht.ts',
    'src/components/delais/surfaces-delais.test.ts',
    'src/components/delais/DelaiDatePublique.tsx',
  ].map((p) => ({ p, s: readFileSync(join(RACINE, p), 'utf8') }))

  /**
   * ⚠️ **CE QUI EST INTERDIT, ET CE QUI NE L'EST PAS.** Ces fichiers ont le droit — et le
   * devoir — de RACONTER la décision du matin et son revirement : c'est ce que fait l'en-tête de
   * `franc-pur.ts`, et c'est ce qui empêche de la refaire. Ce qui est proscrit, c'est de
   * l'affirmer au PRÉSENT, comme une règle en vigueur. On traque donc la formule au présent,
   * pas le mot « prorogation ».
   */
  const FORMULES = [
    /ne rend ni prorogation/,
    /sans prorogation/,
    /ni prorogation,/,
    /calcule FRANC PUR/,
    /neither extension nor/,
  ]

  /**
   * ⚠️ **CE FICHIER SE LIT LUI-MÊME, ET IL ÉNONCE LES FORMULES QU'IL PROSCRIT.** Sans cette
   * ligne, le contrôle se déclenche sur sa propre liste : on retire donc la déclaration de
   * `FORMULES` avant de chercher. C'est la seule exception, et elle est bornée à une constante.
   */
  const sansLaListe = (t: string) => t.replace(/const FORMULES = \[[\s\S]*?\n *\]/, '')

  it('aucune des huit sources ne l’affirme au présent', () => {
    for (const { p, s } of EN_TETES) {
      for (const formule of FORMULES) {
        expect(formule.test(sansLaListe(s)), `${p} → ${formule}`).toBe(false)
      }
    }
  })

  /**
   * LA SONDE : l'en-tête d'`AccesDelais` doit dire le REPORT, faute de quoi le contrôle
   * ci-dessus serait satisfait par un en-tête qui ne dirait plus rien du tout.
   */
  it('la sonde tient : `AccesDelais` DIT le report, la cascade et le calendrier', () => {
    const s = readFileSync(join(RACINE, 'src/lib/delais/lecture-publique.ts'), 'utf8')
    const bloc = s.slice(0, s.indexOf('export type AccesDelais'))
    expect(bloc).toContain('991')
    expect(bloc).toMatch(/CASCADE|cascade/)
    expect(bloc).toContain('16 entrées PERMANENT')
  })

  /**
   * ⚠️ **MIS-CITATION : la clause de prorogation du Code du travail est l'art. 511 AL. 2.**
   * L'en-tête de `franc-pur.ts` écrivait « Ni l'art. 991 ni l'art. 512 C. trav. ne l'excluent ».
   * L'art. 512 régit les HEURES et JOURS de signification — c'est le pendant de l'art. 991
   * al. 2, pas de l'al. 3. Le reste du dépôt cite juste
   * (`ARTICLE_PROROGATION_PAR_CODE.TRAVAIL === 'C. trav., art. 511 al. 2'`).
   */
  it('aucune source de `delais` ne présente l’art. 512 C. trav. comme la clause de prorogation', () => {
    /**
     * ⚠️ **L'ART. 512 EST LÉGITIME PARTOUT AILLEURS**, et le contrôle ne doit pas le chasser :
     * il fonde les HEURES et JOURS de signification, donc le bloc « jour praticable », les
     * fenêtres de signification et la nullité en matière de travail. Ce qu'on traque est son
     * emploi dans un contexte de PROROGATION — la place de l'art. 511 al. 2. On regarde donc
     * une fenêtre de 160 caractères autour de chaque occurrence.
     */
    const PROROGE = /proroge|prorogé|prorogation|report|pwolonje|extend/i
    /**
     * ⚠️ **LE MOTIF NE VOYAIT QU'UN SEUL ORDRE DES MOTS**, et c'est le mauvais qui manquait :
     * il exigeait « art. 512 … C. trav. », si bien que la forme employée par le dépôt lui-même
     * — `'C. trav., art. 512'`, celle de `ARTICLE_PROROGATION_PAR_CODE` — lui échappait
     * entièrement. Mesuré par mutation le 20 août 2026 : remplacer la valeur de la table par
     * `'C. trav., art. 512'` ne faisait pas broncher ce contrôle, qui existe pour cela. Les
     * deux ordres sont désormais traqués.
     */
    const MOTIF_512 = /(art\.?\s*512\s*C\.?\s*trav|C\.?\s*trav\.?,?\s*art\.?\s*512)/gi
    const fichiers = readdirSync(join(SRC, 'lib/delais')).filter((f) => f.endsWith('.ts'))
    for (const f of fichiers) {
      const s = readFileSync(join(SRC, 'lib/delais', f), 'utf8')
      for (const m of s.matchAll(MOTIF_512)) {
        const i = m.index ?? 0
        const fenetre = s.slice(Math.max(0, i - 160), i + 160)
        expect(PROROGE.test(fenetre), `${f} → « …${fenetre.replace(/\s+/g, ' ')}… »`).toBe(false)
      }
    }
    /**
     * La sonde — ⚠️ **ELLE LISAIT LE FICHIER, ET UN COMMENTAIRE LA SATISFAISAIT.** Elle faisait
     * `readFileSync(regimes.ts).toContain('C. trav., art. 511 al. 2')` : la chaîne y paraît
     * DEUX fois, dont une dans la citation en prose de l'article, et la table pouvait donc
     * changer de valeur sans qu'elle bronche. On interroge maintenant la VALEUR exportée,
     * celle que le moteur porte sur le motif de prorogation et que l'écran écrit.
     */
    expect(ARTICLE_PROROGATION_PAR_CODE.TRAVAIL).toBe('C. trav., art. 511 al. 2')
    expect(ARTICLE_PROROGATION_PAR_CODE.CPC).toBe('C. pr. civ., art. 991 al. 3')
    expect(ARTICLE_PROROGATION_PAR_CODE.CIVIL).toBe('C. pr. civ., art. 991 al. 3')
  })

  /**
   * ⚠️ **UN COMMENTAIRE QUI DÉCRIT UNE CONFIGURATION QUE LE CODE N'A PLUS.** `DelaiResult.tsx`
   * expliquait le rendu conditionnel du bloc des lectures par
   * « `PROROGATION_FRANC_PUR` pose `prorogation991: 'NON'` » — c'est `'OUI'` depuis la seconde
   * décision du 20 août —, et l'illustrait d'un exemple faux (« la tête tombe le DIMANCHE
   * 5 juillet 2026 » : elle tombe le lundi 6, puisque le public proroge).
   */
  it('aucun écran ne décrit `PROROGATION_FRANC_PUR` avec une valeur qu’il n’a pas', () => {
    for (const p of [
      'src/components/delais/DelaiResult.tsx',
      'src/components/delais/DelaiDatePublique.tsx',
      'src/components/delais/noyau-calculateur.tsx',
    ]) {
      const s = readFileSync(join(RACINE, p), 'utf8')
      expect(s, p).not.toMatch(/prorogation991:\s*'NON'/)
    }
    expect(PROROGATION_FRANC_PUR.prorogation991).toBe('OUI')
    expect(PROROGATION_FRANC_PUR.prorogationTeteLarge).toBe(true)
  })

  /**
   * ⚠️ **UN COMMENTAIRE QUI DÉCRIT UN CHEMIN DE RENDU QUI N'EXISTE PAS.**
   * `FONDEMENT_PROROGATION_PUBLIQUE` était présenté comme « reproduit dans le résultat […] et
   * dans le raisonnement quand la tête d'affiche ne proroge pas » : ce second chemin
   * (`consequencePasAcquise`) n'est atteint que si `prorogation991 !== 'OUI'`, donc jamais
   * publiquement. Et le champ n'est PAS dans le `entree` de premier niveau de l'API, que
   * `entreeAutrePublique()` compose clé par clé. C'est ce commentaire qui a fait croire que la
   * lecture était documentée pour le lecteur — elle ne l'était nulle part.
   */
  it('le fondement public n’est pas donné pour rendu quelque part', () => {
    const s = readFileSync(join(RACINE, 'src/lib/delais/franc-pur.ts'), 'utf8')
    expect(s).not.toMatch(/dans le raisonnement quand la tête d’affiche ne proroge pas/)
    // Il doit au contraire NOMMER les clés i18n qui, elles, sont rendues.
    expect(s).toContain('publicDeferredCascade')
    expect(s).toContain('publicStrictReading')
  })

  it('… et `entreeAutrePublique` ne le porte effectivement pas', () => {
    const s = readFileSync(join(RACINE, 'src/lib/delais/lecture-publique.ts'), 'utf8')
    const i = s.indexOf('function entreeAutrePublique')
    const bloc = s.slice(i, s.indexOf('\n}', i))
    expect(i).toBeGreaterThan(0)
    expect(bloc).not.toContain('prorogationFondement')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 0 — **LES TROIS LECTURES SONT DITES SUR L'ÉCRAN, DANS LES TROIS LANGUES.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * « Une date juste, sans ses réserves, est plus dangereuse qu'une absence de calculateur. » La
 * surface publique applique trois lectures que la lettre de l'art. 991 al. 3 ne porte pas — la
 * cascade, les 4 jours de la rédaction, les 5 fêtes nationales — et n'en disait qu'une (celle de
 * la rédaction). Ce bloc garde les gabarits qui portent les deux autres.
 */
describe('§ 0 — les réserves de la surface publique, dans les trois langues', () => {
  const D = (l: 'fr' | 'en' | 'ht') => getDictionary(l).delais

  /**
   * ⚠️ **LA CASCADE ÉTAIT PRÉSENTÉE COMME LA LETTRE.** `publicDeferred` impute le report à
   * l'art. 991 al. 3, qui proroge « d'UN jour » ; sur un report de deux jours ou plus, la page
   * lui attribuait donc un report qu'il ne donne pas.
   *
   * ⚠️ **CETTE NOTE PORTAIT « 39 résultats sur 1 825 », ET LES DEUX NOMBRES ÉTAIENT FAUX.** La
   * fenêtre 2025-2029 compte 1 826 départs, et la mesure du 20 août 2026 au soir en donne 29
   * par durée. Le compte n'est plus écrit ici : ce fichier ne calcule rien — il lit les sources
   * et les dictionnaires —, et un nombre porté dans sa prose ne pouvait pas rougir en cessant
   * d'être vrai. Il est désormais MESURÉ par `franc-pur.test.ts`, § 0 (« la ligne de la cascade
   * paraît sur 29 des 1 826 départs »), qui a le balayage sous la main.
   */
  it('la cascade a sa clé, et elle dit que l’article ne proroge que d’un jour', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const c = D(l).publicDeferredCascade
      expect(c.length, l).toBeGreaterThan(40)
      expect(c, l).toContain('991')
      expect(c.toLowerCase(), l).toMatch(/un jour|one day|yon sèl jou/)
      expect(c.toLowerCase(), l).toMatch(/répète|repeats|repete/)
    }
    // Trois textes DIFFÉRENTS : un repli silencieux sur le français passerait sinon inaperçu.
    expect(new Set(['fr', 'en', 'ht'].map((l) => D(l as 'fr').publicDeferredCascade)).size).toBe(3)
  })

  /**
   * ⚠️ **LES CINQ FÊTES NATIONALES PROROGENT SANS QUE L'ART. 991 AL. 3 LES VISE.** Const. 1987,
   * art. 275.1 les énumère ; l'art. 275.2 renvoie les fêtes LÉGALES à la loi ; le décret du
   * 23 mai 1989 s'intitule « déterminant, en dehors des Fêtes Nationales, les Fêtes Légales ».
   * La mention ne portait AUCUNE réserve — elle nommait le jour et se taisait sur le fondement,
   * pendant que la ligne du report citait l'art. 991 al. 3 seul. C'était la moitié la plus
   * lourde de l'écart avec le portail : 25 divergences sur 56 au MATIN du 20 août 2026.
   *
   * ⚠️ **CHIFFRE HISTORIQUE, et il vaut ZÉRO depuis le soir même** : Me Vaval ayant répondu OUI,
   * les fêtes nationales prorogent des DEUX côtés et n'expliquent plus aucune divergence. La
   * mesure vivante est dans `franc-pur.test.ts`, § 0 ; la mention, elle, reste — nommer le
   * fondement du chômage n'est pas la même chose que le mesurer.
   */
  it('la fête NATIONALE porte sa réserve, comme le jour de la rédaction porte la sienne', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const n = D(l).publicDayNational
      expect(n, l).toContain('{date}')
      expect(n, l).toContain('{nom}')
      // Le fondement du chômage : la Constitution, pas l'art. 991.
      expect(n, l).toMatch(/275/)
      // Et ce que l'art. 991 al. 3 vise vraiment.
      expect(n, l).toContain('991')
      // Aussi longue que la réserve du jour de la rédaction : c'est le modèle exact demandé.
      expect(n.length, l).toBeGreaterThan(D(l).publicDayHoliday.length + 40)
    }
  })

  /**
   * ⚠️ **LE GABARIT DU DIMANCHE SE RÉPÉTAIT** : il recevait la date en toutes lettres, qui porte
   * déjà le nom du jour. Il ne doit plus NOMMER le dimanche deux fois — une fois dans la date,
   * une fois dans le prédicat.
   */
  it('le gabarit du dimanche ne nomme le jour qu’une fois', () => {
    const mot = { fr: 'dimanche', en: 'Sunday', ht: 'dimanch' } as const
    for (const l of ['fr', 'en', 'ht'] as const) {
      const s = D(l).publicDaySunday
      expect(s.split(mot[l]).length - 1, l).toBe(1)
      expect(s, l).toContain('{date}')
    }
  })

  /**
   * ⚠️ **LA LIGNE DU REPORT AFFIRMAIT UN ARTICLE APPLICABLE.** L'entrée synthétique publique est
   * `code: 'CIVIL'` ; un délai de procédure du Code du TRAVAIL saisi à la main (art. 511 al. 2
   * C. trav.) se voyait donc citer le Code de procédure civile. La surface publique ne demande
   * pas la matière — elle ne PEUT pas savoir —, et le reste du dépôt s'interdit d'affirmer ce
   * qu'il n'a pas vérifié. ⚠️ Ne pas « réparer » en ajoutant un champ « matière » : la cliente
   * l'a explicitement retiré.
   */
  it('la ligne du report présente l’article comme le DROIT COMMUN, pas comme le vôtre', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const d = D(l).publicDeferred
      expect(d, l).toContain('{date}')
      expect(d, l).toContain('{source}')
      expect(d.toLowerCase(), l).toMatch(/droit commun|general law|dwa komen/)
    }
  })

  /**
   * ⚠️ **LA RÉSERVE DU § 0 : LA DATE DE L'AUTRE SURFACE — ET ELLE A CHANGÉ D'OBJET.**
   *
   * Elle opposait deux LECTURES de l'art. 991 al. 3 (« sous la lecture stricte — un seul jour
   * de report »), et le test l'exigeait : la clé devait contenir « 991 » et le mot « stricte ».
   * Me Vaval ayant élargi le portail le 20 août 2026 au soir, les deux surfaces lisent l'article
   * de la même façon : ce que la ligne oppose désormais, c'est un CALENDRIER — celui de la
   * version 1, antérieur au décret du 11 décembre 2024, que rejoue un permalien `c=1`. Le test
   * suit la phrase : il vérifie le décret et la version, plus l'article.
   */
  it('la date de la lecture stricte a sa clé, et elle nomme le calendrier qu’elle rejoue', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const s = D(l).publicStrictReading
      expect(s, l).toContain('{date}')
      expect(s, l).toContain('2024')
      expect(s.toLowerCase(), l).toMatch(/version 1|vèsyon 1/)
      // ⚠️ Elle ne doit PLUS parler de « lecture stricte de l'art. 991 » : les deux surfaces
      // lisent l'article de la même façon depuis le 20 août 2026 au soir.
      expect(s, l).not.toContain('991')
    }
    expect(new Set(['fr', 'en', 'ht'].map((l) => D(l as 'fr').publicStrictReading)).size).toBe(3)
  })

  /**
   * § 4.6 — ⚠️ **LA VERSION DES RÈGLES DE LECTURE, SUR LA SURFACE PUBLIQUE** (défaut 10 de la
   * troisième recette). `regles-lecture.ts` justifie la coordonnée `rl` par le pied de page —
   * « une date rendue sous une règle périmée le dit » —, mais ce pied n'est rendu que par
   * `DelaiResult`, que la surface publique n'utilise pas : un permalien `rl=1` affichait deux
   * jours d'écart sans un mot. La clé existe désormais dans les TROIS langues.
   *
   * ⚠️ **CE CONTRÔLE NE PORTE PLUS QUE SUR LE CATALOGUE.** Il se terminait par
   * `readFileSync(DelaiDatePublique.tsx).toContain('publicRulesVersion')`, et ces deux lignes
   * ne prouvaient rien du rendu : un identifiant présent dans le fichier peut l'être dans un
   * commentaire, dans une branche morte, ou sous une condition inversée. Que l'ÉCRAN la rende
   * — et qu'il ne la rende que sur une version périmée, avec son lien — est désormais éprouvé
   * par `DelaiDatePublique.rendu.test.tsx` (§ 4.6), qui rend le composant.
   */
  it('la version des règles de lecture a sa clé, dans les trois langues', () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const s = D(l).publicRulesVersion
      expect(s, l).toContain('{version}')
      expect(s, l).toContain('{courante}')
      expect(D(l).publicRulesVersionLink.length, l).toBeGreaterThan(10)
    }
    expect(new Set(['fr', 'en', 'ht'].map((l) => D(l as 'fr').publicRulesVersion)).size).toBe(3)
  })

  /**
   * ═════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LE CAPTEUR QUI VIVAIT ICI ÉTAIT SATISFAIT PAR UN COMMENTAIRE.**
   * ═════════════════════════════════════════════════════════════════════════════
   *
   * Il s'intitulait « … et l'écran public les rend toutes » et faisait, pour quatre clés,
   * `readFileSync(DelaiDatePublique.tsx).toContain(cle)`. Or `publicDayHalfDay` paraît DEUX
   * fois dans ce fichier : une fois dans le commentaire d'en-tête, une fois dans le code.
   * Relecture par mutation du 20 août 2026 : supprimer l'usage réel et ne garder que le
   * commentaire laissait **1 654/1 654 verts**. Le titre affirmait « l'écran les rend » ; le
   * corps ne prouvait que la présence d'un mot dans un fichier.
   *
   * Deux choses lui échappaient par construction, et elles sont l'essentiel :
   *
   *  - **la CONDITION.** `publicDeferredCascade` n'est rendue que sur
   *    `report.jours.length > 1` ; ouvrir la condition à `> 0` ne change pas un caractère du
   *    fichier au regard d'un `toContain` ;
   *  - **le GENRE.** Muter `mention.genre === 'DEMI_JOURNEE'` en `false` laisse la chaîne
   *    `publicDayHalfDay` dans le fichier, et la page cesse de dire « chômé à partir de
   *    midi » sur les cinq Lundis Gras de la fenêtre.
   *
   * **Il a été remplacé, non supprimé** : `DelaiDatePublique.rendu.test.tsx` REND le composant
   * sur des calculs réels et lit le texte visible. Ce fichier-ci lit les sources — c'est son
   * objet, et c'est aussi sa limite : il ne doit pas prétendre juger un rendu.
   *
   * ═════════════════════════════════════════════════════════════════════════════
   * ⚠️ **ET SON REMPLAÇANT GARDAIT ENCORE UN FICHIER, PAS UN COMPORTEMENT** (20 août 2026,
   * quatrième relecture).
   * ═════════════════════════════════════════════════════════════════════════════
   *
   * Il se terminait par `existsSync('DelaiDatePublique.rendu.test.tsx')`, au motif que « s'il
   * disparaît, plus rien ne garde ces quatre lignes à l'écran ». Or **un fichier vidé de ses
   * `it` existe encore** : la sonde restait verte pendant que la garde s'évaporait, et sa
   * seule conséquence pratique était d'interdire de RENOMMER le fichier. Un capteur qui ne
   * peut pas échouer vaut moins que rien : il occupe la place.
   *
   * On garde donc le COMPORTEMENT, avec ce que ce fichier peut tenir sans base et sans
   * rendu : la dérivation genre → gabarit, sur un vrai Lundi Gras du calendrier. `mentionsJour`
   * et `phraseMention` sont deux fonctions PURES, et c'est exactement le chemin que la
   * mutation du § 4.10 casse — `mention.genre === 'DEMI_JOURNEE'` mis à `false` fait
   * basculer la phrase sur `publicDayHoliday`, et les deux assertions rougissent.
   */
  it('la sonde : les quatre clés existent dans les trois langues', () => {
    for (const cle of [
      'publicDeferredCascade',
      'publicStrictReading',
      'publicDaySunday',
      'publicDayHalfDay',
    ] as const) {
      for (const l of ['fr', 'en', 'ht'] as const) {
        expect(D(l)[cle], `${l}.${cle}`).toBeTruthy()
      }
    }
  })

  it('le Lundi Gras prend le gabarit de la DEMI-JOURNÉE, et la fête légale celui d’à côté', () => {
    // Le Lundi Gras du calendrier, pas une date recopiée (§ 4.2 : le décalage pascal).
    const lundiGras = jourMobile('lundi-gras', 2027)

    for (const l of ['fr', 'en', 'ht'] as const) {
      const t = getDictionary(l)
      // Matinée ouvrable — les règles de la version 2, celles du jour.
      const [ouvrable] = mentionsJour(lundiGras, CALENDRIER_COURANT, l, true)
      expect(ouvrable?.genre, l).toBe('DEMI_JOURNEE')
      const phrase = phraseMention(t, ouvrable, lundiGras, l)
      // La phrase rendue est bien CELLE du gabarit de la demi-journée, remplie : on compare
      // au gabarit privé de ses champs, pour ne pas recopier ici une traduction.
      expect(phrase, l).toContain(t.delais.publicDayHalfDay.split('{date}')[1].split('{nom}')[0])
      expect(phrase, l).toContain('Lundi Gras')

      // Matinée NON ouvrable — un permalien `rl=1` : le jour est plein, il proroge, et la
      // phrase doit redevenir celle d'une fête légale ordinaire.
      const [pleine] = mentionsJour(lundiGras, CALENDRIER_COURANT, l, false)
      expect(pleine?.genre, l).toBe('FETE_LEGALE')
      expect(phraseMention(t, pleine, lundiGras, l), l).not.toBe(phrase)
    }
  })
})
