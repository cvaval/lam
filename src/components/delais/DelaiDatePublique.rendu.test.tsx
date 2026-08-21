/**
 * `DelaiDatePublique` — **CE QUI SORT À L'ÉCRAN**, et non ce qui figure dans le fichier.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ POURQUOI CE FICHIER EXISTE : TROIS CAPTEURS RESTAIENT VERTS QUAND L'ÉCRAN CASSAIT
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * La surface publique est celle que l'avocat consulte SANS COMPTE : elle n'affiche que la
 * date, et les quelques lignes en petits caractères qui la qualifient sont tout ce qu'il
 * lira. Elle était pourtant la seule des trois surfaces à n'avoir AUCUN test de rendu — les
 * contrôles qui la visaient lisaient son code source. Relecture par mutation, 20 août 2026 :
 *
 *  1. **la mention de la demi-journée n'était couverte par rien.** Muter
 *     `mention.genre === 'DEMI_JOURNEE'` en `false` dans `phraseMention` laissait
 *     **1 654/1 654 verts** : la page cessait de dire « chômé à partir de midi » sur les
 *     cinq Lundis Gras de la fenêtre, et pas un test ne bronchait ;
 *  2. **un capteur était satisfait par un COMMENTAIRE.** `surfaces-delais.test.ts` faisait
 *     `readFileSync(DelaiDatePublique.tsx).toContain('publicDayHalfDay')` ; la chaîne paraît
 *     DEUX fois dans le fichier — une fois en commentaire d'en-tête, une fois dans le code.
 *     Supprimer l'usage réel et ne garder que le commentaire : **1 654/1 654 verts** encore.
 *     Son intitulé affirmait « l'écran les rend » ; il ne prouvait que la présence d'un mot ;
 *  3. **rien ne distinguait les trois langues sur les gabarits de mention.** Recopier le texte
 *     FRANÇAIS de `publicDayHoliday`, `publicDayWatch` et `publicDayEditorial` dans `en.ts` :
 *     **1 654/1 654 verts**. Le kreyòl et l'anglais pouvaient silencieusement redevenir du
 *     français. (`publicDayHalfDay` et `publicDaySunday` n'échappaient au même sort que par
 *     accident — deux contrôles voisins les couvraient, les quatre autres non.)
 *
 * **Un test qui ne retient rien est pire qu'un test absent : il rassure.** Ce fichier REND le
 * composant (`renderToStaticMarkup`) et vérifie le TEXTE VISIBLE — celui qu'on lirait sur la
 * page, balises retirées.
 *
 * ⚠️ **AUCUN CAS N'EST INVENTÉ.** Chaque écran part d'un départ et d'un nombre de jours réels,
 * passés au CHEMIN DE PRODUCTION — `lireParamsCalcul` puis `calculPublic` —, qui rend la date,
 * ses mentions et son report. Les six genres du calendrier sont atteints par de vraies dates,
 * pas par des `MentionJour` fabriquées : un genre que le calendrier ne produit plus n'a rien à
 * faire dans un test de rendu.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️ **QUATRIÈME DÉFAUT, 20 AOÛT 2026 : LE HARNAIS LUI-MÊME ÉTAIT UNE RECONSTITUTION.**
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * `ecran()` affirmait suivre « le chemin de `lecture-publique.ts`, pas une reconstitution
 * commode » — et il RECALCULAIT `!regles.demiJournee` de son côté avant d'appeler
 * `mentionsJour`/`reportPublic`. La ligne 1073 de `lecture-publique.ts`, celle que cet
 * en-tête citait, n'était donc traversée par AUCUN des 113 fichiers : forcée à `false` **ou**
 * à `true`, la suite entière restait à 1 689/1 689. Le harnais rendait inobservable la ligne
 * même qu'il nommait — et les deux autres angles morts en découlaient (la seule assertion
 * « chômé à partir de midi » hors d'ici porte sur le PORTAIL, qui n'emploie pas
 * `matineeOuvrable` ; et aucune tête d'affiche publique ne tombait un Lundi Gras par
 * `calculPublic`).
 *
 * **Ce qui est simulé est désormais la BASE — jamais le calcul.** `prisma` est mocké, il sert
 * les deux versions du calendrier et les fenêtres ; tout le reste (dérivation des règles de
 * lecture comprise) est le code de production.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/types'
import { addDays, formatIso, jourMobile, parseIso } from '@/lib/delais'
import { CALENDRIERS, VERSION_CALENDRIER_COURANTE } from '@/lib/delais/feries'
import { DelaiDatePublique } from './DelaiDatePublique'

// ═══════════════════════════════════════════════════════════════════════════════
// LA BASE, SIMULÉE — et elle seule
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ **`delaiFerie.findMany` RESPECTE SON `where`.** Un mock qui rendrait toujours le même
 * calendrier ferait passer un permalien `c=1` pour la version courante : le test du § 4.6
 * (« la page NOMME la version 1 ») vérifierait alors un écran que personne ne voit. La base
 * simulée porte les DEUX versions, et c'est la requête qui choisit — comme en production.
 */
const prisma = {
  delaiEntry: { findUnique: vi.fn(), findMany: vi.fn() },
  delaiEntryRevision: { findUnique: vi.fn() },
  delaiFerie: {
    findMany: vi.fn(async ({ where }: { where: { versionCalendrier: number } }) =>
      CALENDRIERS[where.versionCalendrier] ?? [],
    ),
    findFirst: vi.fn(async () => ({ versionCalendrier: VERSION_CALENDRIER_COURANTE })),
  },
  delaiFenetreSignification: {
    findMany: vi.fn(async () => [
      {
        matiere: 'CIVILE',
        heureDebut: 6,
        heureFin: 18,
        source: 'C. pr. civ., art. 991',
        sourceDocId: null,
        nullite: false,
        nulliteTexteFr: null,
      },
    ]),
    findFirst: vi.fn(async () => ({ versionFenetres: 1 })),
  },
}
vi.mock('@/lib/db', () => ({ prisma }))

/**
 * ⚠️ **IMPORT DIFFÉRÉ, comme dans `route.test.ts`** : `lecture-publique.ts` importe `prisma`
 * au chargement, et un import statique le prendrait avant le `vi.mock`.
 */
const { calculPublic, lireParamsCalcul } = await import('@/lib/delais/lecture-publique')

// ═══════════════════════════════════════════════════════════════════════════════
// L'ÉCRAN, RENDU — le MÊME chemin qu'en production
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Le texte que la page DONNE À LIRE : balises retirées, entités décodées, espaces normalisés.
 *
 * ⚠️ **C'est la seule forme sur laquelle ce fichier assied ses contrôles.** Chercher dans le
 * HTML brut ferait passer pour rendu un nom de classe ou un attribut ; et une mention rangée
 * dans un `aria-label` invisible satisferait un `toContain` sans que personne ne la lise.
 */
function texteVisible(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

type Cas = {
  /** Le départ, en ISO — la date de réception de l'acte. */
  iso: string
  /** Le nombre de jours francs saisi. */
  jours: number
  locale?: Locale
  /**
   * La version du calendrier — la coordonnée `c` du permalien. Absente, `calculPublic` lit
   * la version COURANTE en base, comme il le fait sur une visite ordinaire. ⚠️ **Le jeu
   * d'entrées n'est plus un paramètre du cas** : il vient de la base, à la version demandée.
   * Les deux ne peuvent donc plus se désaccorder.
   */
  versionCalendrier?: number
  /** La version des RÈGLES de lecture — `rl=1` rejoue celles d'avant le décret de 2024. */
  versionRegles?: number
  /** L'adresse du second permalien du § 6.3 ; `undefined` sur l'accueil, qui n'en a pas. */
  refaireHref?: string
}

/**
 * Un écran public complet, **de l'ADRESSE au HTML**.
 *
 * ⚠️ **LE CHEMIN EST CELUI DE LA PRODUCTION, ET IL L'EST VRAIMENT DEPUIS LE 20 AOÛT 2026 :**
 * `lireParamsCalcul()` puis `calculPublic(…, 'public')` — les deux appels exacts que font la
 * route `/api/public/delais/calculer` et `lireCalculateur()` (`noyau-calculateur.tsx`), d'où
 * descendent la page `/{locale}/delais` et le héros de l'accueil. **Rien n'est recalculé
 * ici** : ni `matineeOuvrable` (ligne 1073 de `lecture-publique.ts`), ni `mentionsJour`, ni
 * `reportPublic`, ni la lecture stricte du § 0. Les quatre sortent du résultat, tels que les
 * deux surfaces publiques les reçoivent.
 *
 * ⚠️ **`DelaiDatePublique` reçoit ici EXACTEMENT ce que lui passe `DelaiCalculateurPublic`** —
 * `resultat`, `mentionsJour`, `report`, `lectureStricte`, `refaireHref` — et rien d'autre. Le
 * jour où l'enveloppe changerait un de ces cinq branchements, ce fichier ne le verrait pas :
 * c'est `DelaiCalculateur.rendu.test.tsx` qui rend l'enveloppe entière.
 */
async function ecran(cas: Cas) {
  const locale = cas.locale ?? 'fr'
  const sp = new URLSearchParams({
    d: cas.iso,
    n: String(cas.jours),
    locale,
    // § 6.4 — la surface publique. Elle décide de l'adresse du permalien, et de rien d'autre.
    base: '/delais',
  })
  if (cas.versionCalendrier != null) sp.set('c', String(cas.versionCalendrier))
  if (cas.versionRegles != null) sp.set('rl', String(cas.versionRegles))

  const lus = lireParamsCalcul(sp)
  if (!lus.ok) throw new Error(`requête refusée à la lecture : ${lus.code}`)
  const calcul = await calculPublic(lus.valeur, 'public')
  // Un REFUS du moteur (§ 4.3, la borne de 1989) reste un calcul RENDU : `ok` y est vrai, et
  // c'est l'écran qui écrit le refus. Ce qui casse ici est un refus de `calculPublic`.
  if (!calcul.ok) throw new Error(`calcul refusé : ${calcul.code}`)

  const t = getDictionary(locale)
  const html = renderToStaticMarkup(
    <DelaiDatePublique
      locale={locale}
      t={t}
      resultat={calcul.resultat}
      mentions={calcul.mentionsJour}
      report={calcul.report}
      lectureStricte={calcul.lectureStricte}
      refaireHref={cas.refaireHref}
    />,
  )
  return {
    html,
    texte: texteVisible(html),
    resultat: calcul.resultat,
    lectureStricte: calcul.lectureStricte,
  }
}

/** Le raccourci du cas le plus fréquent : on ne regarde que ce qui est écrit. */
const lu = async (cas: Cas) => (await ecran(cas)).texte

const D = (l: Locale) => getDictionary(l).delais

// ═══════════════════════════════════════════════════════════════════════════════
// LES SIX CAS RÉELS — mesurés le 20 août 2026 sur les 1 826 départs de 2025-2029
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ **CHAQUE LIGNE EST UN CALCUL, PAS UNE HYPOTHÈSE.** Les six genres de `mention-jour.ts`
 * sont ici, et l'endroit où chacun paraît n'est pas au choix : depuis que la surface publique
 * proroge en cascade (20 août 2026), la tête d'affiche ne peut plus porter que `A_SURVEILLER`
 * et `DEMI_JOURNEE` — les quatre autres sont exactement les jours dont le report la fait
 * sortir, et ils ne se lisent donc que dans les jours FRANCHIS.
 */
/** § 4.10 — tête d'affiche le lundi 8 février 2027 : un LUNDI GRAS, chômé à partir de midi. */
const LUNDI_GRAS: Cas = { iso: '2027-01-29', jours: 8 }
/** § 4.13 — tête d'affiche le mercredi 18 février 2026 : le Mercredi des Cendres, à surveiller. */
const A_SURVEILLER: Cas = { iso: '2026-02-08', jours: 8 }
/** DEUX jours franchis (14 août, Assomption) : c'est là, et là seulement, que la cascade se dit. */
const CASCADE: Cas = { iso: '2025-07-14', jours: 30 }
/** UN seul jour franchi (le 1er mai, fête nationale) : la lettre de l'art. 991 al. 3, sans cascade. */
const FETE_NATIONALE: Cas = { iso: '2025-04-22', jours: 8 }
/** Le 18 mai 2025 est à la fois fête nationale ET dimanche : une seule ligne doit sortir. */
const DEUX_QUALITES: Cas = { iso: '2025-05-09', jours: 8 }
/** Le cas de la cliente sous un permalien `c=1` : 1er novembre sans texte instituant. */
const CALENDRIER_1: Cas = { iso: '2025-10-01', jours: 30, versionCalendrier: 1 }

// ═══════════════════════════════════════════════════════════════════════════════
// 1. § 4.10 — LA DEMI-JOURNÉE SE DIT, ET ELLE DIT L'HEURE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ **LE DÉFAUT 1 DE LA RELECTURE PAR MUTATION.** Sans ce bloc, `mention.genre ===
 * 'DEMI_JOURNEE'` peut devenir `false` : les cinq Lundis Gras de la fenêtre 2025-2029
 * repassent alors sous `publicDayHoliday` — « est un jour de fête légale » —, ce qui est
 * doublement faux à l'écran : la phrase ne dit pas l'heure, et elle laisse attendre le report
 * que les quatre autres gabarits annoncent et qui n'a PAS eu lieu.
 */
describe('§ 4.10 — le Lundi Gras : la page dit à quelle heure la fenêtre se ferme', async () => {
  const page = await lu(LUNDI_GRAS)

  it('la date limite est bien le lundi 8 février 2027, et elle s’arrête là', () => {
    expect(page).toContain('lundi 8 février 2027 — 08/02/2027')
  })

  it('… et l’écran ÉCRIT que le jour est chômé à partir de midi', () => {
    expect(page).toContain(
      'Le lundi 8 février 2027 est chômé à partir de midi (Lundi Gras — décret du 11 décembre 2024, art. 2, 1°).',
    )
    expect(page).toContain('Un acte à signifier doit l’être avant midi.')
  })

  it('… et il ne le donne PAS pour une fête légale ordinaire', () => {
    // Le gabarit de repli, celui vers lequel toute mutation du genre fait glisser la phrase.
    expect(page).not.toContain('est un jour de fête légale (Lundi Gras)')
    expect(page).not.toContain('est un jour de fête légale')
  })

  it('la mention est du TEXTE FIN, pas une alerte (§ 8.1 : le Sitwon atteste une source)', async () => {
    const { html } = await ecran(LUNDI_GRAS)
    const ligne = html.slice(html.indexOf('chômé à partir de midi'))
    expect(html).toContain('text-xs leading-relaxed text-grafit')
    expect(ligne).not.toContain('bg-sitwon')
    expect(ligne).not.toContain('bg-wouj')
    expect(ligne).not.toContain('role="alert"')
  })

  /**
   * ⚠️ **LA SONDE DU § 4.10 : LE GENRE SUIT LA RÈGLE, JAMAIS LA LIGNE DU CALENDRIER.** Sous
   * les règles de la version 1, que rejoue un permalien `rl=1`, la matinée n'est pas ouvrable :
   * le Lundi Gras proroge, la tête d'affiche n'y tombe plus, et la page ne doit surtout pas
   * continuer d'annoncer une fermeture à midi sur une date qui a bougé.
   */
  it('sous les règles de la version 1, la page ne parle plus de midi', async () => {
    const v1 = await lu({ ...LUNDI_GRAS, versionRegles: 1 })
    expect(v1).not.toContain('chômé à partir de midi')
    expect(v1).not.toContain('avant midi')
  })

  /**
   * ═════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LES CINQ LUNDIS GRAS DE LA FENÊTRE, PAR `calculPublic`.**
   * ═════════════════════════════════════════════════════════════════════════════
   *
   * Le cas `LUNDI_GRAS` ci-dessus n'en couvrait qu'UN, et il y arrivait par un dimanche
   * prorogé. Ici, la tête d'affiche tombe DIRECTEMENT sur le jour — départ = Lundi Gras
   * moins (N + 1), le délai étant franc — et sur les cinq années que le calendrier porte.
   * C'est ce parcours-là qui traverse `!regles.demiJournee` : forcé à `false`, les cinq
   * écrans repassent sous « est un jour de fête légale » et cinq assertions rougissent ;
   * forcé à `true`, c'est le contrôle `rl=1` ci-dessus qui rougit. **Les deux sens sont
   * tenus.**
   *
   * ⚠️ **LES CINQ DATES SONT ÉCRITES ICI, ET RECALCULÉES.** Écrites, ce sont l'oracle — les
   * cinq Lundis Gras de la fenêtre 2025-2029, relus. Recalculées par `jourMobile`, elles
   * disent que le contrôle vise bien le jour du calendrier : si l'un des deux bougeait sans
   * l'autre, la première assertion le dirait avant que les écrans ne soient rendus.
   */
  const LUNDIS_GRAS = ['2025-03-03', '2026-02-16', '2027-02-08', '2028-02-28', '2029-02-12']

  it('les cinq dates visées SONT les Lundis Gras du calendrier', () => {
    expect(LUNDIS_GRAS).toEqual(
      [2025, 2026, 2027, 2028, 2029].map((an) => formatIso(jourMobile('lundi-gras', an))),
    )
  })

  for (const iso of LUNDIS_GRAS) {
    it(`${iso} — la tête d’affiche s’y arrête, et la page dit midi`, async () => {
      const jours = 8
      const lg = parseIso(iso)!
      // Le délai est FRANC : départ + N + 1. On remonte donc de N + 1 jours pour tomber
      // pile sur le Lundi Gras, sans passer par un report.
      const depart = formatIso(addDays(lg, -(jours + 1)))
      const { texte, resultat } = await ecran({ iso: depart, jours })

      expect(resultat.statut, iso).toBe('CALCUL')
      if (resultat.statut !== 'CALCUL') return
      // La date ne bouge PAS : la matinée reste ouvrable, le jour n'est pas un jour de report.
      expect(resultat.teteAffiche, iso).toEqual(lg)
      expect(texte, iso).toContain('est chômé à partir de midi (Lundi Gras')
      expect(texte, iso).toContain('Un acte à signifier doit l’être avant midi.')
      // Le gabarit de repli, celui vers lequel une mutation de la dérivation fait glisser
      // la phrase — et qui annoncerait un report qui n'a pas eu lieu.
      expect(texte, iso).not.toContain('est un jour de fête légale')
      expect(texte, iso).not.toContain('Le délai est prorogé au')
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. LE REPORT ET SA CASCADE — la ligne conditionnelle qu'aucun `toContain` ne voit
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ **`readFileSync(…).toContain('publicDeferredCascade')` NE VOIT PAS LA CONDITION.** La
 * phrase n'est rendue que sur `report.jours.length > 1` : sur un report d'un seul jour, la
 * lettre de l'art. 991 al. 3 suffit et la ligne serait du bruit ; sur deux jours ou plus,
 * l'écran attribuerait sans elle à cet article un report qu'il ne donne pas. Élargir la
 * condition à `> 0`, ou la fermer à `> 2`, laisse le capteur de source vert. Ici, non.
 */
describe('le report se dit, et la cascade ne se dit QUE lorsqu’elle a joué', async () => {
  const deuxJours = await lu(CASCADE)
  const unJour = await lu(FETE_NATIONALE)

  it('DEUX jours franchis : chaque jour est nommé, puis la date d’arrivée', () => {
    expect(deuxJours).toContain(
      'Le jeudi 14 août 2025 est un jour de fête légale (Jour du Bois-Caïman et de l’Union pour la Liberté).',
    )
    expect(deuxJours).toContain(
      'Le vendredi 15 août 2025 est un jour de fête légale (Fête de l’Assomption).',
    )
    expect(deuxJours).toContain(
      'Le délai est prorogé au samedi 16 août 2025 — droit commun de la computation, C. pr. civ., art. 991 al. 3.',
    )
  })

  it('… et la cascade est ÉCRITE, parce qu’elle a bien joué', () => {
    expect(deuxJours).toContain('L’art. 991 al. 3 proroge d’un jour ; la plateforme répète le report')
    expect(deuxJours).toContain('Le samedi n’est pas un jour de report.')
  })

  it('UN seul jour franchi : le report est dit, la cascade se TAIT', () => {
    expect(unJour).toContain(
      'Le jeudi 1er mai 2025 est un jour de fête nationale (La Fête de l’Agriculture et du Travail)',
    )
    expect(unJour).toContain('Le délai est prorogé au vendredi 2 mai 2025')
    // La ligne de la cascade, absente : c'est la lettre de l'article, pas sa répétition.
    expect(unJour).not.toContain('la plateforme répète le report')
  })

  /**
   * ⚠️ **LA LIGNE DU REPORT NE DOIT PAS S'AFFICHER QUAND LA DATE N'A PAS BOUGÉ.** Le cas est
   * le plus fréquent de tous, et une ligne « le délai est prorogé au… » sous une date qui n'a
   * jamais bougé serait un mensonge à l'écran.
   */
  it('aucun jour franchi : ni ligne de report, ni cascade', async () => {
    // 4 juin 2026 + 15 jours francs → samedi 20 juin 2026, qui ne proroge pas.
    const sansReport = await lu({ iso: '2026-06-04', jours: 15 })
    expect(sansReport).toContain('samedi 20 juin 2026 — 20/06/2026')
    expect(sansReport).not.toContain('Le délai est prorogé au')
    expect(sansReport).not.toContain('la plateforme répète le report')
  })

  /**
   * ⚠️ **L'ARTICLE VIENT DU MOTEUR** (`MotifProrogation.source`, via
   * `ARTICLE_PROROGATION_PAR_CODE`) et il est présenté comme le DROIT COMMUN, jamais comme la
   * clause du délai de l'utilisatrice : la surface publique ne demande pas la matière.
   */
  it('l’article est cité comme le droit commun, et il n’est pas écrit dans l’écran', () => {
    expect(deuxJours).toContain('droit commun de la computation, C. pr. civ., art. 991 al. 3.')
    // L'art. 512 C. trav. régit les HEURES de signification : il n'a rien à faire ici.
    expect(deuxJours).not.toContain('512')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. LE DIMANCHE — nommé UNE fois, et effacé quand il ne dit plus rien
// ═══════════════════════════════════════════════════════════════════════════════

describe('le dimanche ne se nomme qu’une fois, et cède la ligne quand le jour a mieux à dire', () => {
  it('le gabarit du dimanche reçoit la date SANS son jour de semaine', async () => {
    // 29 janvier 2027 + 8 jours francs : le délai franchit le dimanche 7 février.
    const page = await lu(LUNDI_GRAS)
    expect(page).toContain('Le 7 février 2027 tombe un dimanche.')
    // La tautologie que `dateSansJourSemaine` existe pour empêcher.
    expect(page).not.toContain('Le dimanche 7 février 2027 tombe un dimanche.')
    // Et le mot ne paraît qu'une fois dans toute la page.
    expect(page.split('dimanche').length - 1).toBe(1)
  })

  it('un jour qui est fête nationale ET dimanche ne rend que la première ligne', async () => {
    // 18 mai 2025 : Fête du Drapeau, et c'est un dimanche.
    const page = await lu(DEUX_QUALITES)
    expect(page).toContain(
      'Le dimanche 18 mai 2025 est un jour de fête nationale (La Fête du Drapeau et de l’Université)',
    )
    // `sansDimancheRedondant` : la date en toutes lettres porte DÉJÀ le nom du jour.
    expect(page).not.toContain('tombe un dimanche')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. § 4.13 / v1 — les deux autres genres, atteints par de vraies dates
// ═══════════════════════════════════════════════════════════════════════════════

describe('les genres restants sont rendus par leur propre gabarit', () => {
  it('A_SURVEILLER : la page dit « souvent chômé par arrêté », et n’annonce aucun report', async () => {
    const page = await lu(A_SURVEILLER)
    expect(page).toContain('mercredi 18 février 2026 — 18/02/2026')
    expect(page).toContain(
      'Le mercredi 18 février 2026 est un jour à surveiller (Mercredi des Cendres) : il est souvent chômé par arrêté.',
    )
    // Il ne proroge JAMAIS (§ 4.13) : la date s'y arrête, et aucune ligne ne dit l'inverse.
    expect(page).not.toContain('Le délai est prorogé au jeudi 19 février 2026')
  })

  it('REDACTION : sous le calendrier de la version 1, la page NOMME la version', async () => {
    const page = await lu(CALENDRIER_1)
    expect(page).toContain(
      'Le samedi 1er novembre 2025 est porté au calendrier comme fête légale (La Toussaint) sans texte instituant : ce calendrier (version 1) est antérieur au décret du 11 décembre 2024.',
    )
    // Elle ne doit surtout pas dire « sur instruction de la rédaction » : c'est la VERSION.
    expect(page).not.toContain('rédaction')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. § 0 et § 4.6 — LES DEUX RÉSERVES : l'autre date, et la règle périmée
// ═══════════════════════════════════════════════════════════════════════════════

describe('§ 0 — la date de l’autre surface est NOMMÉE quand elle diffère', () => {
  it('sous un permalien `c=1`, la page écrit la date du portail', async () => {
    const { texte, lectureStricte } = await ecran(CALENDRIER_1)
    // La mesure : le public dit lundi 3 novembre, le portail samedi 1er novembre.
    expect(lectureStricte).toEqual({ y: 2025, m: 11, d: 1 })
    expect(texte).toContain('lundi 3 novembre 2025 — 03/11/2025')
    expect(texte).toContain(
      'Ce calcul rejoue le calendrier de la version 1, antérieur au décret du 11 décembre 2024',
    )
    expect(texte).toContain('le délai expirait le samedi 1er novembre 2025')
    expect(texte).toContain('la plus prudente des deux')
  })

  /**
   * ⚠️ **ZÉRO DIVERGENCE SOUS LE CALENDRIER COURANT** (mesurée sur 1 826 départs × 4 durées
   * par `franc-pur.test.ts`, § 0). La ligne ne doit donc jamais paraître là : elle opposerait
   * au lecteur une seconde date qui n'existe pas.
   */
  it('… et elle se tait sous le calendrier courant, où les deux surfaces s’accordent', async () => {
    const { texte, lectureStricte } = await ecran({ iso: '2025-10-01', jours: 30 })
    expect(lectureStricte).toBeNull()
    expect(texte).toContain('lundi 3 novembre 2025 — 03/11/2025')
    expect(texte).not.toContain('rejoue le calendrier de la version 1')
  })
})

describe('§ 4.6 — une date rendue sous une règle périmée le DIT, et donne le lien', () => {
  it('sous `rl=1`, la page nomme la version et propose de refaire le calcul', async () => {
    const { texte, html } = await ecran({
      iso: '2029-12-01',
      jours: 30,
      versionRegles: 1,
      refaireHref: '/fr/delais?d=2029-12-01&n=30',
    })
    expect(texte).toContain(
      'Ce calcul est rendu sous les règles de lecture version 1 ; la version en vigueur est la 2',
    )
    expect(texte).toContain('Refaire le calcul avec la règle actuelle')
    expect(html).toContain('href="/fr/delais?d=2029-12-01&amp;n=30"')
  })

  it('… et sous la règle courante elle se tait : un calcul n’a rien à dire de sa règle', async () => {
    const page = await lu({ iso: '2029-12-01', jours: 30, refaireHref: '/fr/delais?d=2029-12-01&n=30' })
    expect(page).not.toContain('règles de lecture version')
    expect(page).not.toContain('Refaire le calcul avec la règle actuelle')
  })

  /** Sur l'accueil, qui ne prend jamais `rl`, la ligne se rend SANS lien plutôt qu'avec un faux. */
  it('sans adresse à donner, la ligne paraît mais aucun lien n’est fabriqué', async () => {
    const { texte, html } = await ecran({ iso: '2029-12-01', jours: 30, versionRegles: 1 })
    expect(texte).toContain('règles de lecture version 1')
    expect(texte).not.toContain('Refaire le calcul avec la règle actuelle')
    expect(html).not.toContain('<a ')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. § 8.2 — LES TROIS LANGUES SE DISTINGUENT **À L'ÉCRAN**
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠️ **LE DÉFAUT 3 DE LA RELECTURE PAR MUTATION.** Les contrôles voisins comparaient des
 * CHAÎNES DU DICTIONNAIRE — quand ils comparaient quelque chose : recopier le texte français
 * de `publicDayHoliday`, `publicDayWatch` et `publicDayEditorial` dans `en.ts` laissait la
 * suite entière verte. Et `expect(…).toMatch(/midi|noon/)` ne discrimine rien : « midi » est
 * dans le français.
 *
 * ⚠️ **UN CONTRÔLE DÉRIVÉ DU DICTIONNAIRE NE PEUT PAS GARDER LE DICTIONNAIRE.** Le premier
 * état de ce bloc tirait les segments distinctifs des gabarits eux-mêmes, en écartant ceux
 * que deux langues partagent. Il a été essayé par mutation, et il est TOMBÉ : recopier
 * `'{date} est un jour de fête légale ({nom})!'` dans `en.ts` rendait le segment français
 * commun aux deux langues — donc non distinctif —, et le contrôle l'ignorait précisément
 * parce qu'il venait de fuiter. Une sonde qui se règle sur ce qu'elle observe ne mesure rien.
 *
 * **Les phrases attendues sont donc ÉCRITES ICI, en toutes lettres, langue par langue.** Elles
 * sont le rendu réel du 20 août 2026, relu ligne à ligne. Un gabarit qui change de rédaction
 * fait rougir ce fichier — c'est voulu : la phrase que l'avocat lit est un livrable, et on la
 * relit avant de la déplacer.
 */
describe('§ 8.2 — l’écran d’une langue ne porte jamais la phrase d’une autre', () => {
  const LOCALES: readonly Locale[] = ['fr', 'en', 'ht']

  /**
   * Les six gabarits de mention, plus les trois lignes de réserve, chacun avec le cas RÉEL
   * qui le fait paraître et LA PHRASE EXACTE que chaque langue doit écrire. Une clé sans cas
   * n'entrerait pas ici : on ne compare que ce qui est effectivement rendu.
   */
  const PHRASES: readonly {
    cle: keyof ReturnType<typeof D>
    cas: Cas
    attendu: Record<Locale, string>
  }[] = [
    {
      cle: 'publicDayHalfDay',
      cas: LUNDI_GRAS,
      attendu: {
        fr: 'Le lundi 8 février 2027 est chômé à partir de midi (Lundi Gras — décret du 11 décembre 2024, art. 2, 1°). Un acte à signifier doit l’être avant midi.',
        en: 'Monday 8 February 2027 is a holiday from noon onwards (Lundi Gras — decree of 11 December 2024, art. 2, 1°). A document to be served must be served before noon.',
        ht: 'lendi 8 fevriye 2027 chome apati midi (Lundi Gras — dekrè 11 desanm 2024, art. 2, 1°). Yon zak pou siyifye dwe siyifye anvan midi.',
      },
    },
    {
      cle: 'publicDaySunday',
      cas: LUNDI_GRAS,
      attendu: {
        fr: 'Le 7 février 2027 tombe un dimanche.',
        en: '7 February 2027 falls on a Sunday.',
        ht: '7 fevriye 2027 tonbe yon dimanch.',
      },
    },
    {
      cle: 'publicDayWatch',
      cas: A_SURVEILLER,
      attendu: {
        fr: 'Le mercredi 18 février 2026 est un jour à surveiller (Mercredi des Cendres) : il est souvent chômé par arrêté.',
        en: 'Wednesday 18 February 2026 is a day to watch (Mercredi des Cendres): it is often declared non-working by executive order.',
        ht: 'mèkredi 18 fevriye 2026 se yon jou pou siveye (Mercredi des Cendres) : yo konn chome l pa arete.',
      },
    },
    {
      cle: 'publicDayHoliday',
      cas: CASCADE,
      attendu: {
        fr: 'Le vendredi 15 août 2025 est un jour de fête légale (Fête de l’Assomption).',
        en: 'Friday 15 August 2025 is a legal holiday (Fête de l’Assomption).',
        ht: 'vandredi 15 out 2025 se yon jou fèt legal (Fête de l’Assomption).',
      },
    },
    {
      cle: 'publicDeferred',
      cas: CASCADE,
      attendu: {
        fr: 'Le délai est prorogé au samedi 16 août 2025 — droit commun de la computation, C. pr. civ., art. 991 al. 3.',
        en: 'The period is extended to Saturday 16 August 2025 — general law of computation, C. pr. civ., art. 991 al. 3.',
        ht: 'Delè a pwolonje jiska samdi 16 out 2025 — dwa komen pou konte delè, C. pr. civ., art. 991 al. 3.',
      },
    },
    {
      cle: 'publicDeferredCascade',
      cas: CASCADE,
      attendu: {
        fr: 'L’art. 991 al. 3 proroge d’un jour ; la plateforme répète le report jusqu’au premier jour qui n’est ni un dimanche ni un jour chômé de son calendrier. Le samedi n’est pas un jour de report.',
        en: 'Art. 991 §3 extends by one day; the platform repeats the extension until the first day that is neither a Sunday nor a non-working day in its calendar. Saturday is not a day of extension.',
        ht: 'Atik 991 al. 3 pwolonje yon sèl jou ; platfòm nan repete ranvwa a jouk premye jou ki pa ni yon dimanch ni yon jou chome nan kalandriye li. Samdi se pa yon jou ranvwa.',
      },
    },
    {
      cle: 'publicDayNational',
      cas: FETE_NATIONALE,
      attendu: {
        fr: 'Le jeudi 1er mai 2025 est un jour de fête nationale (La Fête de l’Agriculture et du Travail), chômé au titre de la Constitution de 1987, art. 275.1 ; l’art. 991 al. 3 C. pr. civ. ne vise, lui, que le dimanche et la fête légale.',
        en: 'Thursday 1 May 2025 is a national holiday (La Fête de l’Agriculture et du Travail), non-working under the 1987 Constitution, art. 275.1; art. 991 §3 C. pr. civ., for its part, covers only Sundays and legal holidays.',
        ht: 'jedi 1er me 2025 se yon jou fèt nasyonal (La Fête de l’Agriculture et du Travail), chome dapre Konstitisyon 1987 la, atik 275.1 ; atik 991 al. 3 C. pr. civ. la, li menm, vize sèlman dimanch ak fèt legal.',
      },
    },
    {
      cle: 'publicDayEditorial',
      cas: CALENDRIER_1,
      attendu: {
        fr: 'Le samedi 1er novembre 2025 est porté au calendrier comme fête légale (La Toussaint) sans texte instituant : ce calendrier (version 1) est antérieur au décret du 11 décembre 2024.',
        en: 'Saturday 1 November 2025 is carried in the calendar as a legal holiday (La Toussaint) with no establishing text: this calendar (version 1) predates the decree of 11 December 2024.',
        ht: 'samdi 1er novanm 2025 pote nan kalandriye a kòm fèt legal (La Toussaint) san okenn tèks ki etabli l : kalandriye sa a (vèsyon 1) anvan dekrè 11 desanm 2024 la.',
      },
    },
    {
      cle: 'publicStrictReading',
      cas: CALENDRIER_1,
      attendu: {
        fr: 'Ce calcul rejoue le calendrier de la version 1, antérieur au décret du 11 décembre 2024 : sans les jours qu’aucun texte n’instituait alors, le délai expirait le samedi 1er novembre 2025. C’est la date que rend le calculateur du portail, et la plus prudente des deux.',
        en: 'This computation replays version 1 of the calendar, which predates the decree of 11 December 2024: without the days no text then instituted, the period expired on Saturday 1 November 2025. That is the date the portal’s calculator returns, and the more cautious of the two.',
        ht: 'Kalkil sa a rejwe kalandriye vèsyon 1 an, ki anvan dekrè 11 desanm 2024 la : san jou ke okenn tèks pa t enstitiye lè sa a, delè a te fini samdi 1er novanm 2025. Se dat sa a kalkilatè pòtay la bay, epi se pi pridan nan de yo.',
      },
    },
    {
      cle: 'publicRulesVersion',
      cas: { iso: '2029-12-01', jours: 30, versionRegles: 1, refaireHref: '/x?d=1&n=2' },
      attendu: {
        fr: 'Ce calcul est rendu sous les règles de lecture version 1 ; la version en vigueur est la 2, et elle peut donner une autre date.',
        en: 'This computation is returned under reading rules version 1; the version in force is 2, and it may give a different date.',
        ht: 'Kalkil sa a bay anba règ lekti vèsyon 1 ; vèsyon ki anvigè a se 2, epi li ka bay yon lòt dat.',
      },
    },
    {
      cle: 'publicRulesVersionLink',
      cas: { iso: '2029-12-01', jours: 30, versionRegles: 1, refaireHref: '/x?d=1&n=2' },
      attendu: {
        fr: 'Refaire le calcul avec la règle actuelle',
        en: 'Recompute under the current rule',
        ht: 'Refè kalkil la ak règ aktyèl la',
      },
    },
  ]

  for (const { cle, cas, attendu } of PHRASES) {
    it(`${String(cle)} : chaque langue rend SA phrase, et pas celle des autres`, async () => {
      // Le repli silencieux, dit sur les gabarits eux-mêmes avant même le rendu : trois
      // textes identiques sont un défaut, pas une traduction.
      expect(
        new Set(LOCALES.map((l) => String(D(l)[cle]))).size,
        `${String(cle)} : trois textes distincts`,
      ).toBe(3)

      for (const l of LOCALES) {
        const page = await lu({ ...cas, locale: l })
        // ⚠️ **L'ASSERTION PORTEUSE.** Elle ne dérive de rien : la phrase est écrite ici. Que
        // `en.ts` reprenne le français, en entier ou à moitié, et cette ligne rougit.
        expect(page, `${String(cle)} ${l}`).toContain(attendu[l])
        // Et l'écran d'une langue ne porte pas la phrase d'une autre.
        for (const m of LOCALES.filter((x) => x !== l)) {
          expect(page, `${String(cle)} ${l} porte la phrase ${m}`).not.toContain(attendu[m])
        }
      }
    })
  }

  /**
   * ⚠️ **LE FILET, POUR CE QUE LES PHRASES ATTENDUES NE VOIENT PAS.** Une phrase attendue
   * garde la ligne qu'elle décrit ; elle ne dit rien d'un fragment français AJOUTÉ à côté.
   * Essayé par mutation le 20 août 2026 : préfixer le kreyòl de `publicDeferredCascade` par
   * une demi-phrase française laissait tout vert, la ligne kreyòl restant présente.
   *
   * Cette liste est FERMÉE et ÉCRITE ICI — jamais dérivée du dictionnaire, sans quoi elle
   * s'effacerait avec la fuite qu'elle traque. Chacun de ses membres est du français que ni
   * l'anglais ni le kreyòl correctement traduits ne portent : le kreyòl écrit « se yon jou »
   * là où le français écrit « est un jour de ».
   *
   * ⚠️ **NE PAS Y METTRE CE QUI RESTE EN FRANÇAIS DANS LES TROIS LANGUES** (§ 8.2) : les
   * libellés du calendrier (« Fête de l'Assomption », « La Toussaint ») et les citations
   * d'articles (« C. pr. civ., art. 991 al. 3 ») ne sont PAS des textes d'interface.
   */
  const FRANCAIS_SEULEMENT: readonly string[] = [
    'est un jour de',
    'est un jour à surveiller',
    'Le délai est prorogé',
    'droit commun de la computation',
    'la plateforme répète',
    'chômé à partir de midi',
    'tombe un dimanche',
    'sans texte instituant',
    'chômé au titre de la Constitution',
    'Ce calcul rejoue le calendrier',
    'les règles de lecture version',
    'Refaire le calcul',
  ]

  it('aucune bribe de français ne se glisse dans l’écran anglais ou créole', async () => {
    const cas: readonly Cas[] = [
      LUNDI_GRAS,
      A_SURVEILLER,
      CASCADE,
      FETE_NATIONALE,
      DEUX_QUALITES,
      CALENDRIER_1,
      { iso: '2029-12-01', jours: 30, versionRegles: 1, refaireHref: '/x?d=1&n=2' },
    ]
    for (const c of cas) {
      // La sonde : le français, lui, DOIT porter ces formules — sans quoi la liste ne
      // traquerait plus rien et ce contrôle serait vide.
      const fr = await lu({ ...c, locale: 'fr' })
      expect(
        FRANCAIS_SEULEMENT.some((f) => fr.includes(f)),
        `${c.iso}/${c.jours} : la sonde française`,
      ).toBe(true)
      for (const l of ['en', 'ht'] as const) {
        const page = await lu({ ...c, locale: l })
        for (const f of FRANCAIS_SEULEMENT) {
          expect(page, `${c.iso}/${c.jours} ${l} porte « ${f} »`).not.toContain(f)
        }
      }
    }
  })

  /**
   * ⚠️ **LA DATE AUSSI EST TRADUITE.** `format.ts` porte les noms de mois et de jours dans les
   * trois langues, et le créole n'est PAS l'anglais : un repli de `nomMois` sur le français
   * rendrait « 8 février 2027 » sur `/en`, sous une phrase anglaise.
   */
  it('la date elle-même sort dans la langue de l’écran', async () => {
    expect(await lu({ ...LUNDI_GRAS, locale: 'fr' })).toContain('lundi 8 février 2027')
    expect(await lu({ ...LUNDI_GRAS, locale: 'en' })).toContain('Monday 8 February 2027')
    expect(await lu({ ...LUNDI_GRAS, locale: 'ht' })).toContain('lendi 8 fevriye 2027')
  })

  /**
   * ⚠️ **LES CITATIONS, ELLES, RESTENT EN FRANÇAIS DANS LES TROIS LANGUES** (§ 8.2) : le
   * nom d'un article du Code de procédure civile n'est pas un texte d'interface, et le
   * traduire ferait citer un article qui n'existe pas.
   */
  it('… mais l’article cité ne se traduit pas', async () => {
    for (const l of LOCALES) {
      expect(await lu({ ...CASCADE, locale: l }), l).toContain('C. pr. civ., art. 991 al. 3')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. CE QUE CET ÉCRAN NE REND PAS — et qui ne doit pas revenir par cette porte
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * § 6.1 — « Le portail public doit uniquement afficher la date. Pas besoin de […] lui
 * expliquer le raisonnement qui a mené au résultat » (Me Vaval, 20 août 2026). Le PORTAIL
 * garde tout cela ; c'est `DelaiResult` qui le rend, et `DelaiCalculateur.rendu.test.tsx` qui
 * le vérifie.
 */
describe('§ 6.1 — la date, ses lignes fines, et rien d’autre', async () => {
  const page = await lu(CASCADE)

  it('ni raisonnement, ni lectures nommées, ni permalien, ni pied technique', () => {
    for (const absent of [
      'Copier le raisonnement',
      'Lecture la plus large',
      'dernier jour praticable',
      'Permalien',
      'Imprimer',
    ]) {
      expect(page, absent).not.toContain(absent)
    }
  })

  /**
   * ⚠️ **UNE PAGE QUI SE TAIRAIT LAISSERAIT CROIRE À UNE PANNE.** C'est la seule phrase que
   * cet écran rende À LA PLACE de la date, et elle doit porter le motif, pas seulement le
   * titre : un refus sans son pourquoi est un écran vide.
   */
  it('un REFUS écrit son titre ET son motif, et surtout pas une date', async () => {
    // § 4.3 — la borne historique : tout dossier antérieur au 22 juin 1989 est refusé.
    const { texte, resultat } = await ecran({ iso: '1988-01-04', jours: 30 })
    expect(resultat.statut).toBe('REFUS')
    expect(texte).toContain('Cet article ne permet pas de calculer une date')
    expect(texte).toContain(
      'La liste des fêtes légales applicable avant le 22 juin 1989 n’est pas établie dans ce corpus',
    )
    expect(texte).not.toMatch(/\d{2}\/\d{2}\/\d{4}/)
    // Ni « Date limite », ni la moindre mention : il n'y a pas de date à qualifier.
    expect(texte).not.toContain('Date limite')
  })
})
