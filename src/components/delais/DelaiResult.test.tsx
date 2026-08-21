/**
 * LE RÉSULTAT, RENDU. Ces contrôles portent sur ce que l'écran DIT, pas sur ce qu'il calcule
 * — le moteur a ses 217 tests. Ce qui se casse ici est d'une autre nature, et ne se voit
 * dans aucun test de calcul :
 *
 *  1. **le gabarit vérifié du § 6.3 doit sortir jusqu'au HTML** : une date juste, produite
 *     par un moteur juste, peut n'être jamais affichée ;
 *  2. **rien n'est repliable.** La cliente l'a demandé expressément ; un `<details>` glissé
 *     dans le raisonnement le rendrait absent pour qui ne clique pas, et c'est le § 0 ;
 *  3. **aucun état ne repose sur la couleur.** « Sans source textuelle » doit être un MOT
 *     dans le HTML, pas une classe ;
 *  4. **le Sitwon n'atteste jamais la date.** Il badge la source d'une fête, et rien d'autre.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { CALENDRIER_V1 } from '@/lib/delais/feries'
import { REPERTOIRE, construireEntrees } from '@/lib/delais/repertoire'
import { calculer } from '@/lib/delais'
import { restreindreAuFrancPur } from '@/lib/delais/franc-pur'
import type { EntreePublique, FenetrePublique } from '@/lib/delais/lecture-publique'
import { DelaiResult } from './DelaiResult'

const t = getDictionary('fr')
const ENTREES = construireEntrees(REPERTOIRE)
const ART_354 = ENTREES.find((e) => e.slug === 'cpc-354-appel-parties-demeurant-haiti')!

const FENETRES: FenetrePublique[] = [
  { matiere: 'CIVILE', heureDebut: 6, heureFin: 18, source: 'C. pr. civ., art. 991', sourceDocId: null, nullite: false, nulliteTexteFr: null },
  { matiere: 'TRAVAIL', heureDebut: 8, heureFin: 17, source: 'C. trav., art. 512', sourceDocId: null, nullite: true, nulliteTexteFr: 'Nulle.' },
]

function entreePublique(): EntreePublique {
  return {
    slug: ART_354.slug,
    code: ART_354.code,
    codeLibelle: ART_354.codeLibelle,
    article: ART_354.article,
    articleContexte: null,
    tableau: 1,
    tableauTitreFr: null,
    objetFr: ART_354.objetFr,
    objetEn: null,
    objetHt: null,
    traductionRelue: false,
    dureeTexte: ART_354.dureeTexte,
    citationArticle: null,
    dureeFondementFr: ART_354.dureeFondementFr ?? null,
    pointDepartFr: ART_354.pointDepartFr,
    pointDepartEn: null,
    pointDepartHt: null,
    sanctionFr: null,
    sanctionEn: null,
    sanctionHt: null,
    distanceAideFr: null,
    distanceDoubleFr: null,
    statut: 'visible',
    revision: 1,
    revisionCourante: 1,
  }
}

function rendu(depart: { y: number; m: number; d: number }, connecte = false): string {
  const resultat = calculer({
    depart,
    entree: ART_354,
    km: [],
    versionCalendrier: 1,
    entreesCalendrier: CALENDRIER_V1,
  })
  return renderToStaticMarkup(
    <DelaiResult
      locale="fr"
      t={t}
      resultat={resultat}
      entree={entreePublique()}
      permalien={`/fr/delais?d=2026-06-04&e=${ART_354.slug}&r=1&c=1&w=1`}
      versionCalendrier={1}
      versionFenetres={1}
      fenetres={FENETRES}
      bandeau={null}
      connecte={connecte}
    />,
  )
}

describe('le gabarit vérifié du § 6.3, jusqu’au HTML', () => {
  const html = rendu({ y: 2026, m: 6, d: 4 })

  it('affiche la date en toutes lettres ET en chiffres, avec le jour de la semaine', () => {
    // C'est le jour de la semaine qui rend visible qu'un samedi n'a pas été prorogé.
    expect(html).toContain('lundi 6 juillet 2026 — 06/07/2026')
  })

  it('affiche la phrase de sécurité, et elle nomme la date', () => {
    expect(html).toContain('Agir au plus tard le lundi 6 juillet 2026 est sûr')
  })

  it('déroule le raisonnement en huit étapes, chacune une phrase complète', () => {
    const items = html.split('<li>').length - 1
    expect(items).toBeGreaterThanOrEqual(8)
    expect(html).toContain('Le jour du départ ne se compte pas')
    expect(html).toContain('samedi 4 juillet 2026') // dernier jour compté
    expect(html).toContain('dimanche 5 juillet 2026') // échéance, prorogée
    expect(html).toContain('art. 991')
  })

  it('nomme le pied technique : les trois versions et le permalien écrit en toutes lettres', () => {
    expect(html).toContain('Calendrier des fêtes : version 1')
    expect(html).toContain('Fenêtres de signification : version 1')
    expect(html).toContain('révision 1')
    expect(html).toContain(`/fr/delais?d=2026-06-04&amp;e=${ART_354.slug}&amp;r=1&amp;c=1&amp;w=1`)
  })

  it('n’écrit AUCUN horodatage : le bloc 12 exige un rendu identique au caractère près', () => {
    expect(html).not.toMatch(/Calcul[ée] le/i)
    expect(html).not.toMatch(/Port-au-Prince/)
    // Deux rendus successifs du même calcul donnent le même octet.
    expect(rendu({ y: 2026, m: 6, d: 4 })).toBe(html)
  })

  it('cite les textes appliqués INTÉGRALEMENT, art. 987 et art. 991', () => {
    expect(html).toContain('C. pr. civ., art. 987')
    expect(html).toContain('Tous les délais prévus au Code de procédure civile sont francs.')
    expect(html).toContain('Les délais légaux seront prorogés d’un jour')
  })

  it('porte les avertissements permanents A1 et A3, sans possibilité de les masquer', () => {
    expect(html).toContain('A1')
    expect(html).toContain('A3')
    expect(html).toContain('La plateforme ne connaît pas ces arrêtés')
  })
})

describe('les règles de rendu que rien d’autre ne surveille', () => {
  const html = rendu({ y: 2026, m: 6, d: 4 })
  /**
   * ⚠️ **LE BLOC « JOURS ÉCARTÉS » EST RÉSERVÉ À L'ESPACE CONNECTÉ** depuis le 20 août 2026 :
   * la surface publique n'écarte plus aucun jour (`franc-pur.ts`), et le rayon n'y affichait
   * que son titre et « Aucun jour écarté. ». Les quatre contrôles de la pastille Sitwon
   * portent sur la colonne SOURCE de ce tableau : ils doivent donc le rendre CONNECTÉ, sinon
   * ils passent en ne regardant rien — ce qui est arrivé à trois d'entre eux.
   */
  const htmlConnecte = rendu({ y: 2026, m: 6, d: 4 }, true)

  it('ne replie RIEN : pas un seul <details> dans le résultat', () => {
    expect(html).not.toContain('<details')
    expect(html).not.toContain('<summary')
  })

  it('n’attribue jamais le Sitwon à la date calculée', () => {
    // La marque Sitwon n'existe que dans la colonne SOURCE du tableau des jours écartés.
    expect(htmlConnecte).toContain('Jours écartés')
    const avantEcartes = htmlConnecte.slice(0, htmlConnecte.indexOf('Jours écartés'))
    expect(avantEcartes).not.toContain('bg-sitwon')
  })

  it('un jour écarté porte sa source, en toutes lettres', () => {
    // Le 5 juillet 2026 est un dimanche : la prorogation vient de l'art. 991 lui-même.
    const apresEcartes = htmlConnecte.slice(htmlConnecte.indexOf('Jours écartés'))
    expect(apresEcartes).toContain('dimanche 5 juillet 2026')
    expect(apresEcartes).toContain('C. pr. civ., art. 991 al. 3')
  })

  /**
   * § 8.1 — **LE SITWON ATTESTE LA SOURCE D'UNE FÊTE, ET RIEN D'AUTRE.** Le seul jour écarté
   * de ce gabarit est un DIMANCHE : il n'a aucune source à vérifier, il est dans l'article.
   * La pastille tombait pourtant dessus (la condition était `autorite !== 'REDACTION'`, et le
   * motif `DIMANCHE`, fabriqué par le moteur, ne porte pas d'`autorite`) — deux occurrences
   * de `bg-sitwon`, une par variante. Le rationnement de l'accent est un critère explicite de
   * la charte : la pastille perd son sens en devenant l'ordinaire.
   */
  it('le dimanche ne porte PAS la pastille « Source vérifiée »', () => {
    expect(htmlConnecte).not.toContain('bg-sitwon')
    expect(htmlConnecte).not.toContain('Source vérifiée')
  })

  it('une fête du calendrier, elle, la porte', () => {
    // Départ le 24 novembre 2027 : 30 jours francs → échéance le samedi 25 décembre, Noël.
    // Le samedi ne proroge pas, mais Noël si — et Noël, lui, a une source à attester.
    const noel = rendu({ y: 2027, m: 11, d: 24 }, true)
    expect(noel).toContain('Source vérifiée')
    expect(noel).toContain('bg-sitwon')
  })

  it('le visiteur anonyme est PRÉVENU avant le mur de connexion, jamais envoyé sans le savoir', () => {
    expect(html).toContain('connexion requise')
    expect(html).not.toContain('/fr/doc/')
  })

  it('l’utilisateur connecté reçoit le lien profond, ancré sur l’article', () => {
    const connecte = rendu({ y: 2026, m: 6, d: 4 }, true)
    expect(connecte).toContain('#art-987')
    expect(connecte).toContain('#art-991')
    expect(connecte).not.toContain('connexion requise')
  })
})

describe('le samedi, qui n’est jamais prorogé (§ 6.3, variante)', () => {
  /**
   * ⚠️ **CE RENDU EST CELUI DU CALENDRIER DE LA VERSION 1** (`entreesCalendrier: CALENDRIER_V1`
   * dans `rendu()`), et c'est ce qu'un permalien `c=1` montre encore. Sous la version 1, la
   * Toussaint était portée sans texte instituant : elle ne prorogeait pas la tête d'affiche,
   * et la réserve « R6 » la nommait à part. **R6 a été retirée le 20 août 2026** — le décret
   * du 11 décembre 2024 institue les onze fêtes légales —, mais ce que la lecture large
   * ajoutait est toujours NOMMÉ, sous « Lecture la plus large » : la date écartée ne se cache
   * pas derrière la tête d'affiche.
   */
  it('v1 : 1er octobre 2025 → samedi 1er novembre 2025 en tête d’affiche, et l’écran le montre', () => {
    const html = rendu({ y: 2025, m: 10, d: 1 })
    expect(html).toContain('samedi 1er novembre 2025 — 01/11/2025')
    expect(html).toContain('Lecture la plus large')
    expect(html).not.toContain('Calendrier de la rédaction')
  })
})

describe('§ 7.3 — les bandeaux d’un permalien rouvert', () => {
  function avecBandeau(bandeau: Parameters<typeof DelaiResult>[0]['bandeau']): string {
    const resultat = calculer({
      depart: { y: 2026, m: 6, d: 4 },
      entree: ART_354,
      km: [],
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
    })
    return renderToStaticMarkup(
      <DelaiResult
        locale="fr"
        t={t}
        resultat={resultat}
        entree={entreePublique()}
        permalien="/fr/delais?d=2026-06-04"
        versionCalendrier={1}
        versionFenetres={1}
        fenetres={FENETRES}
        bandeau={bandeau}
        connecte={false}
      />,
    )
  }

  it('entrée retirée : le motif est dit, et AUCUN recalcul n’est proposé', () => {
    const html = avecBandeau({
      type: 'ENTREE_RETIREE',
      statutEntree: 'masque',
      motif: 'Doublon de l’article 356.',
      retireeLe: '2026-09-01',
    })
    expect(html).toContain('2026-09-01')
    expect(html).toContain('Doublon de l’article 356.')
    expect(html).not.toContain('Refaire le calcul')
    // Le résultat reste lisible : le bandeau ne le remplace jamais.
    expect(html).toContain('lundi 6 juillet 2026')
  })

  it('règle changée : un SECOND permalien, à côté, jamais à la place', () => {
    const html = avecBandeau({
      type: 'REGLE_CHANGEE',
      revisionDemandee: 3,
      revisionCourante: 5,
      changeeLe: '2026-09-12',
      hrefActuelle: '/fr/delais?d=2026-06-04&e=x&r=5&c=1&w=1',
    })
    expect(html).toContain('Refaire le calcul avec la règle actuelle')
    expect(html).toContain('r=5')
    expect(html).toContain('lundi 6 juillet 2026')
  })
})

// ===========================================================================
// § 6.3 / § 6.5 — L'ORDRE DES BLOCS, LA BARRE COLLANTE, LE FOCUS, LE LIEN A6
// ===========================================================================

describe('§ 6.3 — l’ordre a-b-c-d-e-f-g-h-i, « dans cet ordre »', () => {
  const html = rendu({ y: 2026, m: 6, d: 4 })
  it('g) les textes appliqués viennent AVANT h) les avertissements', () => {
    expect(html.indexOf('Textes appliqués')).toBeLessThan(html.indexOf('Avertissements'))
  })
})

describe('§ 6.5 — la barre d’actions ne sort pas de vue', () => {
  const html = rendu({ y: 2026, m: 6, d: 4 })
  it('une barre COLLANTE sous 1024 px, masquée à l’impression', () => {
    // Sur un résultat long — raisonnement, jours écartés, réserves, sept avertissements,
    // textes intégraux — les deux boutons du haut sont hors de vue dès qu'on lit.
    expect(html).toContain('sticky bottom-0')
    expect(html).toMatch(/no-print sticky bottom-0[^"]*lg:hidden/)
  })

  it('… et une seule des deux est visible à la fois', () => {
    // Celle du bloc de tête ne s'affiche qu'à partir de `lg`, la collante s'arrête avant.
    expect(html).toContain('no-print mt-5 hidden lg:block')
    expect((html.match(/Copier le raisonnement/g) ?? []).length).toBe(2)
  })
})

describe('§ 6.5 / § 8.3 — le focus va au résultat', () => {
  const html = rendu({ y: 2026, m: 6, d: 4 })
  it('le titre reste focalisable, et un composant client l’y amène', () => {
    // Le formulaire navigue en `GET` sans fragment : le navigateur repart en haut du
    // document, et sous 1024 px la saisie passe AVANT le résultat.
    expect(html).toContain('id="delai-resultat-titre"')
    expect(html).toContain('tabindex="-1"')
  })
})

describe('§ 4.13, exigence 4 — A6 renvoie au corpus par un LIEN', () => {
  // Départ samedi 9 janvier 2027 → tête d'affiche au mercredi 10 février, Mercredi des
  // Cendres : un jour À SURVEILLER, donc un A6 porteur de `rechercheCorpusQ`.
  const anonyme = rendu({ y: 2027, m: 1, d: 9 })
  const connecte = rendu({ y: 2027, m: 1, d: 9 }, true)

  it('plus de crochets typographiques inertes dans la phrase', () => {
    expect(anonyme).not.toContain('[Rechercher')
  })

  it('un vrai lien vers la recherche pour l’utilisateur connecté', () => {
    expect(connecte).toMatch(/href="\/fr\/search\?q=[^"]*carnaval/)
  })

  it('… et l’avertissement « connexion requise » pour le visiteur anonyme', () => {
    expect(anonyme).toMatch(/href="\/fr\/login\?next=[^"]*carnaval/)
    expect(anonyme).toContain('connexion requise')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * CE QUE LA SURFACE PUBLIQUE NE DOIT PAS AFFIRMER (20 août 2026)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ **RIEN NE POLIÇAIT LE RÉSULTAT PUBLIC.** `DelaiFormPublic.test.tsx` interdit « 991 » et
 * « prorogé » sur le FORMULAIRE ; le RÉSULTAT, lui, n'était surveillé par rien — et c'est par
 * là que trois blocs sont passés :
 *
 *  1. **« Aucune lecture concurrente ne donne une date différente. »** — affirmation, pas
 *     constat : sous `prorogation991: 'NON'` le moteur n'en OUVRE aucune. Sur un départ au
 *     4 juin 2026 la tête tombe le DIMANCHE 5 juillet et la lecture de l'art. 991 donnerait
 *     le lundi 6 ; la page l'affirmait sous cette date même ;
 *  2. **« Jours écartés — Aucun jour écarté. »** — le titre nomme une mécanique que le calcul
 *     public n'exécute plus ;
 *  3. **« Fenêtres de signification … C. pr. civ., art. 991 »** — un bloc qui suppose que
 *     l'acte est une SIGNIFICATION, c'est-à-dire la qualification même pour laquelle le bloc
 *     « jour praticable » a été retiré, et qui nommait l'article que la page s'interdit de
 *     promettre.
 *
 * Aujourd'hui `DelaiResult` n'est plus atteint que depuis le portail (`CadreCalculateur`, où
 * `connecte` vaut `true`) : ces gardes sont la SECONDE serrure. La première est
 * `calculPublic(..., 'public')`, qui ne rend plus les fenêtres du tout. On garde les deux —
 * c'est précisément un écran réutilisé sans sa condition d'accès qui a produit ces trois
 * défauts.
 */
describe('le résultat rendu SANS session ne promet ni ne constate rien', () => {
  /**
   * Une entrée dont la prorogation est hors-jeu — le cas le plus défavorable pour ces gardes :
   * la tête d'affiche tombe alors un DIMANCHE, et c'est là qu'un écran mal placé affirmerait
   * qu'« aucune lecture ne donne une date différente ».
   *
   * ⚠️ **Ce n'est plus la configuration de la surface publique** : depuis la seconde décision
   * du 20 août 2026, celle-ci proroge (`prorogation991: 'OUI'` + `prorogationTeteLarge`). On
   * garde `'NON'` ici parce que ce fichier éprouve `DelaiResult` — un écran réservé au portail
   * —, et qu'une tête d'affiche au dimanche est ce qui met ses gardes à l'épreuve.
   */
  const ENTREE_FRANC_PUR = { ...ART_354, prorogation991: 'NON' as const }

  function renduPublic(locale: 'fr' | 'en' | 'ht', connecte = false): string {
    const brut = calculer({
      depart: { y: 2026, m: 6, d: 4 },
      entree: ENTREE_FRANC_PUR,
      km: [],
      versionCalendrier: 1,
      entreesCalendrier: CALENDRIER_V1,
      locale,
    })
    return renderToStaticMarkup(
      <DelaiResult
        locale={locale}
        t={getDictionary(locale)}
        resultat={restreindreAuFrancPur(brut, locale)}
        entree={entreePublique()}
        permalien="/fr/delais?d=2026-06-04&n=30&c=1&w=1"
        versionCalendrier={1}
        versionFenetres={1}
        // Ce que la route rend désormais publiquement : rien. La garde de l'écran est
        // vérifiée séparément ci-dessous, en lui passant quand même les fenêtres.
        fenetres={FENETRES}
        bandeau={null}
        connecte={connecte}
      />,
    )
  }

  for (const locale of ['fr', 'en', 'ht'] as const) {
    const d = getDictionary(locale).delais

    it(`${locale} : LA SONDE — la date est bien rendue, et c’est un dimanche`, () => {
      // Sans cela, les trois contrôles suivants passeraient sur un écran vide.
      expect(renduPublic(locale)).toContain(d.resultTitle)
    })

    it(`${locale} : n’affirme pas qu’aucune lecture ne donne une date différente`, () => {
      expect(renduPublic(locale)).not.toContain(d.readingsNone)
      expect(renduPublic(locale)).not.toContain(d.readingsTitle)
    })

    it(`${locale} : ne nomme pas une mécanique d’écartement qu’il n’exécute pas`, () => {
      expect(renduPublic(locale)).not.toContain(d.skippedTitle)
      expect(renduPublic(locale)).not.toContain(d.skippedNone)
    })

    it(`${locale} : n’affiche aucune fenêtre de signification`, () => {
      const html = renduPublic(locale)
      // ⚠️ On discrimine sur « Matière civile » et sur la plage horaire, PAS sur le titre :
      // `footerWindows` reprend les mêmes mots dans le pied technique (« Fenêtres de
      // signification : version 1 »), et ce pied-là est légitime — c'est le numéro de version
      // que le permalien rejoue. Le confondre avec le bloc ferait échouer ce test pour la
      // mauvaise raison, ou pire, ferait supprimer le pied.
      expect(html).not.toContain(d.windowsCivil)
      expect(html).not.toContain(`>${d.windowsTitle}</h3>`)
      // … et le pied technique, lui, garde SON numéro de version : c'est lui que le
      // permalien rejoue.
      expect(html).toContain(d.footerWindows.split('{')[0])
    })
  }

  /** ⚠️ **LE PORTAIL N'A RIEN PERDU** : les trois blocs reviennent dès qu'il y a une session. */
  it('… mais le portail les garde tous les trois', () => {
    const html = renduPublic('fr', true)
    const d = getDictionary('fr').delais
    expect(html).toContain(d.readingsTitle)
    expect(html).toContain(d.skippedTitle)
    expect(html).toContain(d.windowsTitle)
  })
})
