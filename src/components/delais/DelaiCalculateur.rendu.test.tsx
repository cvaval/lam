/**
 * LA PAGE, DE BOUT EN BOUT — Prisma simulé, composant serveur réellement exécuté, HTML lu.
 *
 * ⚠️ **LES DEUX SURFACES N'OFFRENT PLUS LA MÊME CHOSE**, et c'est le premier objet de ce
 * fichier. Publiquement : la date de réception de l'acte et le nombre de jours francs, deux
 * champs, et **pas une ligne du répertoire dans le HTML**. Dans l'espace connecté : les 393
 * entrées, leur régime, leurs fondements — inchangés.
 *
 * Ce que les tests de la route ne peuvent pas prouver et que celui-ci prouve : que le gabarit
 * vérifié du § 6.3 **arrive à l'écran**, que le formulaire s'y trouve à côté, et que les états
 * d'échec — base pas encore migrée, permalien fabriqué, slug demandé sans session — se lisent
 * en français plutôt qu'en trace technique.
 *
 * ⚠️ **DEUX ENVELOPPES, PAS UN DRAPEAU.** `DelaiCalculateur` prenait un `connecte: boolean` et
 * rendait l'un ou l'autre formulaire — donc il IMPORTAIT les deux, et Next plaçait les deux
 * dans le graphe client de CHAQUE route. Chaque surface a désormais la sienne, et le noyau
 * (frein, lecture, calcul, cadre) reste partagé : deux chemins de calcul seraient deux vérités.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { CALENDRIER_COURANT, CALENDRIER_V1, VERSION_CALENDRIER_COURANTE } from '@/lib/delais/feries'
import { versCreateInput } from '@/lib/delais/graine'
import { REPERTOIRE, construireEntrees } from '@/lib/delais/repertoire'
import { JOURS } from '@/lib/delais/format'
import { VERSION_REGLES_COURANTE } from '@/lib/delais/regles-lecture'

/**
 * Les LIGNES FINES du bloc de résultat — les `<p class="text-xs …">` que la surface publique
 * rend sous la date. Le contrôle générique des noms de jour lit celles-ci, et rien d'autre :
 * la date en gros caractères a le droit, elle, de porter son jour de semaine (§ 6.3 a).
 */
function lignesFines(html: string): string[] {
  return [...html.matchAll(/<p class="text-xs[^"]*">([^<]*)<\/p>/g)].map((m) => m[1])
}

const prisma = {
  delaiEntry: { findMany: vi.fn(), findUnique: vi.fn() },
  delaiEntryRevision: { findUnique: vi.fn() },
  delaiFerie: { findMany: vi.fn(), findFirst: vi.fn() },
  delaiFenetreSignification: { findMany: vi.fn(), findFirst: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma }))

/**
 * `headers()` de Next lève hors d'une portée de requête : la page tourne ici dans vitest, pas
 * dans un serveur. On simule l'en-tête d'adresse, exactement ce que Vercel envoie.
 */
const enTetes = new Map([['x-forwarded-for', '203.0.113.7']])
vi.mock('next/headers', () => ({ headers: () => enTetes }))

/**
 * § 09 — LE FREIN DE DÉBIT. La page est en `force-dynamic` et n'appelait AUCUN `guard()`,
 * alors que les routes publiques le font. On l'espionne ici plutôt que de le neutraliser,
 * pour que ce test échoue si le frein disparaît.
 */
const guard = vi.fn(async () => true)
vi.mock('@/lib/security/ratelimit', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/security/ratelimit')>()),
  guard,
}))

const { DelaiCalculateurPublic } = await import('./DelaiCalculateurPublic')
const { DelaiCalculateurConnecte } = await import('./DelaiCalculateurConnecte')

const t = getDictionary('fr')
const SLUG = 'cpc-354-appel-parties-demeurant-haiti'
const ENTREES = construireEntrees(REPERTOIRE)
const LIGNES = ENTREES.map((e, i) => ({
  ...(versCreateInput(e) as unknown as Record<string, unknown>),
  id: `e-${i}`,
  statut: 'visible',
  revision: 1,
  masqueMotif: null,
  masqueAt: null,
  updatedAt: new Date('2026-08-01T00:00:00Z'),
}))
const LIGNE_354 = LIGNES.find((l) => (l as { slug?: string }).slug === SLUG)!

const FENETRES = [
  { matiere: 'CIVILE', heureDebut: 6, heureFin: 18, source: 'C. pr. civ., art. 991', sourceDocId: null, nullite: false, nulliteTexteFr: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  guard.mockResolvedValue(true)
  prisma.delaiEntry.findMany.mockResolvedValue(LIGNES)
  prisma.delaiEntry.findUnique.mockResolvedValue(LIGNE_354)
  prisma.delaiEntryRevision.findUnique.mockResolvedValue({
    payloadJson: JSON.stringify(versCreateInput(ENTREES.find((e) => e.slug === SLUG)!)),
    createdAt: new Date('2026-09-12T00:00:00Z'),
  })
  prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_V1)
  prisma.delaiFerie.findFirst.mockResolvedValue({ versionCalendrier: 1 })
  prisma.delaiFenetreSignification.findMany.mockResolvedValue(FENETRES)
  prisma.delaiFenetreSignification.findFirst.mockResolvedValue({ versionFenetres: 1 })
})

/** La surface PUBLIQUE : deux champs, pas de répertoire. */
async function page(recherche: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(
    await DelaiCalculateurPublic({ locale: 'fr', t, recherche, action: '/fr/delais' }),
  )
}

/** La surface CONNECTÉE : le répertoire entier. */
async function pageConnectee(recherche: Record<string, string | string[] | undefined>) {
  return renderToStaticMarkup(
    await DelaiCalculateurConnecte({ locale: 'fr', t, recherche, action: '/fr/outils/delais' }),
  )
}

// ===========================================================================
// LE PÉRIMÈTRE PUBLIC
// ===========================================================================

describe('la page publique n’offre que DEUX champs', () => {
  it('la date de réception de l’acte et le nombre de jours francs, rien d’autre', async () => {
    const html = await page({})
    expect(html).toContain('Date de réception de l’acte')
    expect(html).toContain('Nombre de jour(s) francs')
    expect(html).toContain('type="date"')
    const noms = [...new Set([...html.matchAll(/name="([^"]+)"/g)].map((m) => m[1]))].sort()
    expect(noms).toEqual(['d', 'n'])
  })

  it('aucun menu du répertoire, aucun sélecteur de code, aucun filtre', async () => {
    const html = await page({})
    expect(html).not.toContain('<select')
    expect(html).not.toContain('Entrée du répertoire')
    expect(html).not.toContain('Filtrer la liste')
    expect(html).not.toContain(`value="${SLUG}"`)
  })

  /**
   * ⚠️ Le trou n'était pas seulement dans la route : la PAGE, en `force-dynamic`, relisait les
   * 393 lignes à chaque requête pour peupler un `<select>` servi en clair dans le HTML.
   */
  it('la page publique ne LIT PAS le répertoire — ni pour l’afficher, ni pour le jeter', async () => {
    await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(prisma.delaiEntry.findMany).not.toHaveBeenCalled()
  })

  // ⚠️ RETIRÉ SUR DEMANDE DE ME VAVAL (20 août 2026). La phrase « Le répertoire des délais des
  // trois codes est réservé aux titulaires d'un compte. Se connecter. » remplaçait le lien
  // « Voir tout le répertoire ». Elle a été jugée inutile sur une surface publique : le
  // calculateur de jours francs se suffit à lui-même, il n'a pas à annoncer ce qu'il ne montre
  // pas. Ce test garde la porte fermée dans les deux sens — ni le lien d'origine, ni son
  // remplacement.
  it('ni « Voir tout le répertoire », ni invitation à se connecter', async () => {
    const html = await page({})
    expect(html).not.toContain('Voir tout le répertoire')
    expect(html).not.toContain('réservé aux titulaires')
    expect(html).not.toContain('href="/fr/login"')
  })

  it('la règle de droit est ÉCRITE, dans les mots de Me Vaval', async () => {
    const html = await page({})
    expect(html).toContain(
      'Conformément au Code de procédure civile haïtien et au Code du travail, le délai franc ne compte ni le jour de la réception, ni le jour de l’échéance.',
    )
    expect(html).not.toContain('ordinaire')
  })

  it('le bouton dit QUOI FAIRE, il n’inventorie plus', async () => {
    const html = await page({})
    expect(html).toContain('Indiquer la date de réception de l’acte')
    expect(html).not.toContain('Il manque :')
  })
})

describe('un slug demandé sans session est REFUSÉ, pas servi', () => {
  it('la phrase du refus, et aucune donnée de l’entrée', async () => {
    const html = await page({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1' })
    expect(html).toContain('réservé aux titulaires d’un compte')
    expect(html).not.toContain('Appel (parties demeurant en Haïti)')
    expect(html).not.toContain('Date limite')
    expect(prisma.delaiEntry.findUnique).not.toHaveBeenCalled()
  })

  it('… y compris sans date : le refus ne retombe pas en silence sur l’état vide', async () => {
    const html = await page({ e: SLUG })
    expect(html).toContain('réservé aux titulaires d’un compte')
  })
})

describe('le calcul public — quatre juin, quinze jours francs', () => {
  it('rend le samedi 20 juin 2026 — la date, en toutes lettres ET en chiffres', async () => {
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(html).toContain('samedi 20 juin 2026 — 20/06/2026')
    expect(html).toContain('Date limite')
  })

  /**
   * ⚠️ **ET RIEN D'AUTRE** (Me Vaval, 20 août 2026 : « Le portail public doit uniquement
   * afficher la date. Pas besoin de […] lui expliquer le raisonnement qui a mené au
   * résultat. »). Tout ce qui suit était rendu ici la veille encore, et le PORTAIL le rend
   * toujours — voir le bloc « le PORTAIL garde tout ». C'est la moitié fragile de ce
   * changement : dépouiller le public sans mutiler le portail.
   */
  it('… et RIEN d’autre : ni raisonnement, ni jours écartés, ni lectures, ni praticable', async () => {
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    for (const bloc of [
      t.delais.stepsTitle,
      t.delais.skippedTitle,
      t.delais.readingsTitle,
      t.delais.widestReading,
      t.delais.practicableTitle,
      t.delais.warningsTitle,
      t.delais.textsTitle,
      t.delais.windowsTitle,
    ]) {
      expect(html, bloc).not.toContain(bloc)
    }
  })

  it('ni permalien, ni impression, ni « Copier le raisonnement », ni pied technique', async () => {
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(html).not.toContain(t.delais.permalinkLabel)
    expect(html).not.toContain(t.delais.copyReasoning)
    expect(html).not.toContain(t.delais.print)
    expect(html).not.toContain('Calendrier des fêtes : version')
    // Le permalien lui-même : ni écrit en toutes lettres, ni posé en lien.
    expect(html).not.toContain('e=autre&amp;c=1')
    expect(html).not.toContain('sig=')
  })

  /**
   * ⚠️ **L'EN-TÊTE DE L'ENTRÉE PART AVEC LE RESTE.** Il portait « Délai saisi (hors
   * répertoire) », la nature du délai, la durée telle qu'écrite et son fondement : c'est de
   * l'appareil, pas la date. Le défaut historique qu'il traînait — « · art. Délai indiqué dans
   * l'acte », la NATURE recopiée en numéro d'article dans 100 % des résultats publics — ne peut
   * donc plus apparaître ici ; il reste surveillé côté PORTAIL, où l'en-tête est rendu.
   */
  it('§ 4.12 — plus d’en-tête d’entrée : ni codeLibelle, ni nature, ni durée', async () => {
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(html).not.toContain('Délai saisi (hors répertoire)')
    expect(html).not.toContain('Délai indiqué dans l’acte')
    expect(html).not.toContain('art. Délai indiqué')
    expect(html).not.toContain(t.delais.entryDurationLabel)
  })

  it('… dans les trois langues, la date et elle seule', async () => {
    for (const l of ['fr', 'en', 'ht'] as const) {
      const html = renderToStaticMarkup(
        await DelaiCalculateurPublic({
          locale: l,
          t: getDictionary(l),
          recherche: { d: '2026-06-04', n: '15', c: '1', w: '1' },
          action: `/${l}/delais`,
        }),
      )
      expect(html, l).toContain('20/06/2026')
      expect(html, l).not.toContain(getDictionary(l).delais.stepsTitle)
      // Aucun renvoi au corpus : il n'y a plus de texte appliqué à ouvrir.
      expect(html, l).not.toMatch(/q=[^"]*article(&|")/)
      expect(html, l).not.toContain('/search?q=')
    }
  })

  it('rechargé, le rendu est identique au caractère près (bloc 12)', async () => {
    const q = { d: '2026-06-04', e: 'autre', c: '1', w: '1', n: '15', f: 'oui' }
    expect(await page(q)).toBe(await page(q))
  })

  it('une date impossible n’est pas rattrapée au 1er mars', async () => {
    const html = await page({ d: '31/02/2026', n: '15' })
    expect(html).toContain('Cette date n’existe pas')
    expect(html).not.toContain('Date limite')
  })

  it('`f=non` fabriqué à la main : refus écrit, jamais un délai ordinaire calculé en douce', async () => {
    const html = await page({ d: '2026-06-04', n: '15', f: 'non', c: '1', w: '1' })
    expect(html).toContain('le délai franc ne compte ni le jour de la réception')
    expect(html).not.toContain('Date limite')
  })
})

/**
 * § 6.2, point 4 — **LES PETITS CARACTÈRES SOUS LA DATE : DEUX BLOCS, DEUX RÔLES.**
 *
 * Me Vaval, 20 août 2026, le matin : « Si la date calculée tombe un jour férié, le résultat
 * l'affichera en petits caractères. » — la MENTION, qui qualifie la date sans la déplacer.
 *
 * Me Vaval, l'après-midi, après avoir vu la date tomber un dimanche : « il faut la proroger au
 * prochain jour ouvrable, donc le lundi 6 juillet » — le REPORT, qui déplace la date et doit
 * dire pourquoi, sinon la personne qui compte sur ses doigts trouve un jour de moins que
 * l'écran.
 *
 * Depuis le report, la MENTION ne peut plus porter qu'un jour À SURVEILLER : le dimanche et
 * les 16 entrées PERMANENT sont exactement les jours dont le report fait sortir la date.
 */
describe('les petits caractères sous la date', () => {
  it('9 décembre 2026 + 15 jours francs → Noël est FRANCHI, et la ligne le dit', async () => {
    const html = await page({ d: '2026-12-09', n: '15', c: '1', w: '1' })
    // La date affichée est le samedi 26 : Noël proroge, le samedi non — la cascade s'arrête.
    expect(html).toContain('samedi 26 décembre 2026 — 26/12/2026')
    expect(html).toContain('Le vendredi 25 décembre 2026 est un jour de fête légale (Jour de Noël).')
    /**
     * ⚠️ **« DROIT COMMUN DE LA COMPUTATION », ET NON « L'ARTICLE DE VOTRE DÉLAI ».** L'entrée
     * synthétique publique est `code: 'CIVIL'`, donc la table renvoie l'art. 991 al. 3 ; une
     * personne qui saisit à la main un délai de procédure du Code du TRAVAIL (art. 511 al. 2
     * C. trav.) lisait une référence au Code de procédure civile. La surface publique ne demande
     * pas la matière — elle ne PEUT pas savoir —, elle ne doit donc pas affirmer un article
     * applicable. La date, elle, reste juste : les deux clauses ont le même contenu utile.
     */
    expect(html).toContain(
      'Le délai est prorogé au samedi 26 décembre 2026 — droit commun de la computation, C. pr. civ., art. 991 al. 3.',
    )
    // ⚠️ Ce qu'on cite est l'article QUI PROROGE, jamais le décret qui institue la fête : la
    // source du motif porte deux lignes de référence au Moniteur, illisibles sous une date.
    expect(html).not.toContain('Le Moniteur n° 47-A')
    // ⚠️ UN SEUL jour franchi = la LETTRE de l'art. 991 al. 3, pas la cascade : la ligne qui
    // explique la répétition serait du bruit ici.
    expect(html).not.toContain('la plateforme répète le report')
  })

  /**
   * ⚠️ **LA LIGNE DU DIMANCHE SE RÉPÉTAIT — dans les trois langues.** Elle recevait la date en
   * toutes lettres, qui porte DÉJÀ le nom du jour : « Le dimanche 5 juillet 2026 est un
   * dimanche. » Sur une page dont la cliente a exigé qu'elle n'affiche que la date, une ligne
   * tautologique se lit comme un bogue. La date arrive désormais sans jour de semaine, et le
   * verbe est « tombe un ».
   */
  it('la ligne du dimanche ne redit pas le jour que la date porte déjà', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).toContain('Le 5 juillet 2026 tombe un dimanche.')
    expect(html).not.toContain('Le dimanche 5 juillet 2026 est un dimanche.')
  })

  /**
   * ⚠️ **AUCUNE LIGNE FINE NE NOMME DEUX FOIS LE MÊME JOUR DE SEMAINE DANS SA PROPOSITION
   * PRINCIPALE.** Le contrôle générique qui aurait attrapé le défaut : on relit chaque
   * `<p class="text-xs …">` du bloc de résultat, on garde ce qui précède la première virgule,
   * le premier point-virgule, la première parenthèse ou le premier tiret — c'est là que vit la
   * tautologie —, et on refuse qu'un nom de jour y apparaisse deux fois. Il vaut pour les sept
   * jours, pas seulement pour le gabarit du dimanche.
   *
   * ⚠️ **La proposition principale, et pas la ligne entière** : une RÉSERVE a le droit de
   * renommer un jour de semaine comme CATÉGORIE de droit. « Le dimanche 1er janvier 2034 est un
   * jour de fête nationale (…), chômé au titre de la Constitution de 1987, art. 275.1 ; l'art.
   * 991 al. 3 C. pr. civ. ne vise, lui, que le dimanche et la fête légale. » nomme deux fois
   * « dimanche » — la première fois la DATE, la seconde le texte. Ce n'est pas la répétition
   * qu'on traque : celle-là disait deux fois la même chose.
   */
  it('… et le contrôle vaut pour les sept jours de la semaine', async () => {
    const cas = ['2026-06-04', '2025-10-01', '2026-12-09', '2033-12-01', '2026-05-16']
    for (const d of cas) {
      const html = await page({ d, n: '30', c: '1', w: '1' })
      for (const ligne of lignesFines(html)) {
        const principale = ligne.split(/[,;(—]/)[0]
        for (const jour of JOURS.fr) {
          const n = principale.split(jour).length - 1
          expect(n, `${d} → « ${principale} » nomme « ${jour} » ${n} fois`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  /**
   * ⚠️ **UN JOUR QUI PORTE DEUX QUALITÉS NE RENDAIT PAS UNE LIGNE UTILE DE PLUS.** Le
   * 1er janvier 2034 est une fête nationale ET un dimanche : l'écran écrivait les deux, et la
   * seconde ne disait rien que la première ne dise déjà. `mentionsJour` et `reportPublic`
   * rendent toujours les DEUX mentions — c'est la donnée, et elle est juste ; c'est l'ÉCRAN qui
   * ne rend que celle qui apporte quelque chose.
   */
  it('fête nationale un dimanche : une seule ligne, celle qui apprend quelque chose', async () => {
    const html = await page({ d: '2033-12-01', n: '30', c: '1', w: '1' })
    expect(html).toContain('est un jour de fête nationale (La Fête de l’Indépendance Nationale)')
    expect(html).not.toContain('tombe un dimanche')
    expect(html).not.toContain('1er janvier 2034 est un dimanche')
  })

  /**
   * ⚠️ **LES CINQ FÊTES NATIONALES NE SONT PAS DES FÊTES LÉGALES**, et la ligne fine ne le
   * disait pas : elle nommait le jour et se taisait sur le fondement, pendant que la ligne du
   * report imputait le décalage au seul art. 991 al. 3 — lequel ne vise que « un dimanche ou un
   * jour de fête légale ». Const. 1987, art. 275.1 (les cinq fêtes NATIONALES) et art. 275.2
   * (« Les Fêtes Légales sont déterminées par la Loi ») distinguent les deux, et le décret du
   * 23 mai 1989 s'intitule « déterminant, EN DEHORS DES FÊTES NATIONALES, les Fêtes Légales ».
   * 25 des 56 divergences mesurées le MATIN du 20 août 2026 venaient de ces cinq jours-là ;
   * elles n'en expliquent plus AUCUNE depuis que Me Vaval a répondu OUI le soir et que les
   * deux surfaces prorogent dessus (`franc-pur.test.ts`, § 0). La ligne fine, elle, reste :
   * nommer le fondement du chômage n'est pas la même chose que le mesurer.
   */
  it('une fête NATIONALE qui proroge porte SA réserve, comme un jour de la rédaction', async () => {
    const html = await page({ d: '2026-05-16', n: '1', c: '1', w: '1' })
    expect(html).toContain('mardi 19 mai 2026 — 19/05/2026')
    expect(html).toContain('est un jour de fête nationale (La Fête du Drapeau et de l’Université)')
    // La réserve, mot pour mot : le fondement du chômage, et ce que l'art. 991 al. 3 vise.
    expect(html).toContain('Constitution de 1987, art. 275.1')
    expect(html).toContain('ne vise, lui, que le dimanche et la fête légale')
  })

  it('⚠️ un DIMANCHE proroge aussi, et la date affichée est le lundi', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).toContain('lundi 6 juillet 2026 — 06/07/2026')
    expect(html).toContain('Le 5 juillet 2026 tombe un dimanche.')
    expect(html).toContain(
      'Le délai est prorogé au lundi 6 juillet 2026 — droit commun de la computation, C. pr. civ., art. 991 al. 3.',
    )
  })

  /** ⚠️ LE SAMEDI N'EST PAS UN JOUR DE REPORT — instruction expresse de Me Vaval. */
  it('un samedi ordinaire n’est pas prorogé, et rien n’est écrit', async () => {
    const html = await page({ d: '2026-06-04', n: '29', c: '1', w: '1' })
    expect(html).toContain('samedi 4 juillet 2026 — 04/07/2026')
    expect(html).not.toContain('est prorogé au')
  })

  /** ⚠️ LES JOURS À SURVEILLER NE PROROGENT PAS, et gardent leur mention (§ 4.13). */
  it('un jour à surveiller garde sa mention SANS déplacer la date', async () => {
    const html = await page({ d: '2026-01-07', n: '30', c: '1', w: '1' })
    expect(html).toContain('samedi 7 février 2026 — 07/02/2026')
    expect(html).toContain('est un jour à surveiller')
    expect(html).not.toContain('est prorogé au')
  })

  it('un jour ordinaire ne dit rien : la date, seule', async () => {
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(html).not.toContain('est un jour de fête')
    expect(html).not.toContain('est un dimanche')
  })

  /**
   * ⚠️ **UN FÉRIÉ TRAVERSÉ NE DIT RIEN.** Départ le 20 décembre 2026 + 2 jours francs → le
   * mercredi 23 : Noël est DANS le délai, mais la date calculée n'y tombe pas. La surface
   * publique n'écarte aucun jour et ne proroge rien — l'annoncer serait du bruit.
   */
  it('un férié À L’INTÉRIEUR du délai reste muet', async () => {
    const html = await page({ d: '2026-12-20', n: '2', c: '1', w: '1' })
    expect(html).toContain('mercredi 23 décembre 2026')
    expect(html).not.toContain('Noël')
    expect(html).not.toContain('fête légale')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LE CALCUL PUBLIC EST UN CALCUL FRANC PUR — ET IL NE MONTRE QUE SA DATE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Deux décisions de Me Vaval, prises le même jour, et qui se suivent :
 *
 *  1. **le calcul** — « Les délais pouvant être prorogés n'ont aucune incidence sur le
 *     calculateur public, car l'utilisateur indique uniquement la quantité de jours francs
 *     qu'il souhaiterait calculer. » Départ + N + 1, et rien d'autre (`franc-pur.ts`) ;
 *  2. **l'affichage** — « Le portail public doit uniquement afficher la date. Pas besoin […]
 *     de lui expliquer le raisonnement qui a mené au résultat. »
 *
 * ⚠️ **LE RAISONNEMENT A DONC QUITTÉ L'ÉCRAN PUBLIC, MAIS PAS LE MOTEUR.** Les étapes, la
 * phrase de sécurité et l'avertissement A3 sont toujours produits par `calculer()` et
 * `restreindreAuFrancPur()` — `franc-pur.test.ts` et `route.test.ts` les vérifient là où ils
 * vivent. Ce fichier-ci vérifie ce qui ARRIVE À L'ÉCRAN, et l'écran ne les rend plus.
 *
 * Le 4 juin 2026 + 30 jours francs tombe le DIMANCHE 5 juillet 2026 : c'est le cas d'espèce
 * qu'elle a essayé, et celui qui rendait autrefois DEUX autres dates — le lundi 6 (lecture
 * nommée « PROROGATION_991 », reprise en « lecture la plus large ») et le samedi 4 (« jour
 * praticable »). Aucune des deux ne doit apparaître, sous aucune forme.
 */
describe('la surface publique — 4 juin 2026 + 30 jours francs, à l’écran', () => {
  it('la date rendue est le lundi 6 juillet 2026 ; le dimanche 5 n’est nommé qu’en fin', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).toContain('lundi 6 juillet 2026')
    /**
     * ⚠️ **LA SECONDE DATE EST DÉSORMAIS AUTORISÉE — et une seule.** La règle du matin
     * (« une seconde date est une date de trop ») valait quand la seconde date était une
     * LECTURE CONCURRENTE : deux dates possibles, dont on ne savait laquelle. Le dimanche
     * 5 juillet n'est pas une date concurrente — c'est le jour franchi, et le nommer est la
     * seule chose qui rende le lundi compréhensible. Le samedi 4 (« dernier jour praticable »,
     * « dernier jour compté ») reste, lui, hors de l'écran.
     */
    expect(html).not.toContain('samedi 4 juillet 2026')
    expect([...html.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => m[0])).toEqual(['06/07/2026'])
    // Le dimanche 5 n'apparaît QU'EN TEXTE FIN, jamais en gros caractères.
    const gros = html.slice(html.indexOf('text-display-3'), html.indexOf('</h2>'))
    expect(gros).toContain('lundi 6 juillet 2026')
    expect(gros).not.toContain('dimanche 5 juillet 2026')
  })

  it('aucune lecture nommée — pas même pour dire qu’il n’y en a pas', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).not.toContain('Aucune lecture concurrente ne donne une date différente.')
    expect(html).not.toContain('Lecture la plus large')
    expect(html).not.toContain('Si l’article 991 C. pr. civ. s’applique')
  })

  it('aucun bloc « jour praticable » : pas de seconde date, plus précoce', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).not.toContain(t.delais.practicableTitle)
    expect(html).not.toContain('Aucune signification ni exécution ne peut être faite')
  })

  it('aucun avertissement — A3 non plus, que la page porte déjà en pied', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).not.toContain('Ce calcul ne remplace pas la vérification du texte')
    expect(html).not.toContain('arrêté du Président de la République')
    expect(html).not.toContain('jour à surveiller')
  })

  it('aucune phrase de sécurité : elle commentait la date, elle ne l’est pas', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).not.toContain('Le délai franc que vous avez indiqué expire le')
    expect(html).not.toContain('l’une des lectures ci-dessous')
  })

  it('et pas une étape du raisonnement, pas un fondement', async () => {
    const html = await page({ d: '2026-06-04', n: '30', c: '1', w: '1' })
    expect(html).not.toContain('Le raisonnement, pas à pas')
    expect(html).not.toContain('Dernier jour compté')
    expect(html).not.toContain('la prorogation n’est pas acquise pour ce délai')
    expect(html).not.toContain('sans y appliquer aucun report')
    // La ligne du report N'EST PAS une étape : elle ne cite ni le régime, ni le point de
    // départ, ni le décompte — elle dit un jour, un motif, une date.
    expect(html).not.toContain('Point de départ')
  })

  /**
   * ⚠️ **LE MOTEUR, LUI, N'A PAS BOUGÉ.** Rien n'a été retiré du calcul : c'est l'écran qui
   * ne le montre plus. On le vérifie ici même, par la voie que la route emprunte — sinon la
   * disparition à l'écran pourrait masquer une amputation du moteur, et le portail la
   * paierait.
   */
  it('⚠️ le résultat CALCULÉ garde ses étapes, sa phrase de sécurité et A3', async () => {
    const { calculPublic, lireParamsCalcul } = await import('@/lib/delais/lecture-publique')
    const lus = lireParamsCalcul(
      new URLSearchParams({ d: '2026-06-04', n: '30', e: 'autre', f: 'oui', c: '1', w: '1', locale: 'fr', base: '/delais' }),
    )
    expect(lus.ok).toBe(true)
    const out = await calculPublic((lus as { ok: true; valeur: Parameters<typeof calculPublic>[0] }).valeur, 'public')
    expect(out.ok).toBe(true)
    if (!out.ok) return
    if (out.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    expect(out.resultat.teteAffiche).toEqual({ y: 2026, m: 7, d: 6 })
    expect(out.resultat.etapes.length).toBeGreaterThan(2)
    expect(out.resultat.phraseSecurite).toContain('lundi 6 juillet 2026')
    expect(out.resultat.avertissements.map((a) => a.cle)).toEqual(['A3'])
    // La date d'arrivée ne porte plus aucune mention : le report l'a fait sortir du dimanche.
    expect(out.mentionsJour).toEqual([])
    // Et le report, lui, est là — c'est ce que l'écran ajoute à la date.
    expect(out.report?.arrivee).toEqual({ y: 2026, m: 7, d: 6 })
    expect(out.report?.jours.map((j) => j.date)).toEqual([{ y: 2026, m: 7, d: 5 }])
    expect(out.report?.source).toBe('C. pr. civ., art. 991 al. 3')
  })

  /**
   * § 0 — ⚠️ **LA DATE DE L'AUTRE SURFACE, PAR LA VOIE QUE LA ROUTE EMPRUNTE.** `calculPublic`
   * doit porter la date étroite CHAQUE FOIS qu'elle diffère, et `null` sinon. C'est ce champ
   * que la page et l'API lisent : le taire d'un côté rouvrirait l'écart en silence.
   *
   * ⚠️ **CE QUI LA FAIT DIVERGER A CHANGÉ LE 20 AOÛT 2026 AU SOIR.** Elle divergeait sur trois
   * causes — les fêtes nationales, la cascade, les jours sans texte. Me Vaval a tranché les
   * deux premières : elles valent maintenant pour les DEUX surfaces, et il ne reste que la
   * troisième — donc rien du tout hors d'un permalien `c=1`. Mesuré : 0 divergence sous le
   * calendrier courant, 16 sur 1 826 sous celui de la version 1 (`franc-pur.test.ts`, § 0).
   */
  it('§ 0 — `calculPublic` porte la date de la lecture STRICTE quand elle diffère', async () => {
    const { calculPublic, lireParamsCalcul } = await import('@/lib/delais/lecture-publique')
    const appel = async (d: string, n: string, acces: 'public' | 'connecte') => {
      // ⚠️ Le portail EXIGE la nature du délai (§ 4.12) ; la surface publique la REFUSE. Deux
      // requêtes différentes pour le même calcul : c'est ce que les deux écrans envoient.
      const q: Record<string, string> = { d, n, e: 'autre', f: 'oui', c: '1', w: '1', locale: 'fr', base: '/delais' }
      if (acces === 'connecte') q.src = 'Délai lu dans une circulaire'
      const lus = lireParamsCalcul(new URLSearchParams(q))
      if (!lus.ok) throw new Error(lus.code)
      const out = await calculPublic(lus.valeur, acces)
      if (!out.ok) throw new Error(out.code)
      return out
    }
    // Le cas de contrôle de la cliente : portail samedi 1er, public lundi 3.
    const cascade = await appel('2025-10-01', '30', 'public')
    expect(cascade.resultat.statut === 'CALCUL' && cascade.resultat.teteAffiche).toEqual({ y: 2025, m: 11, d: 3 })
    expect(cascade.lectureStricte).toEqual({ y: 2025, m: 11, d: 1 })
    // ⚠️ Une fête NATIONALE ne fait PLUS diverger les deux surfaces : le 18 mai 2026 (Fête du
    // Drapeau) proroge des deux côtés depuis que Me Vaval a répondu OUI. Le test attendait ici
    // `{ 2026, 5, 18 }` ; il attend maintenant le silence, et c'est le progrès.
    expect((await appel('2026-05-16', '1', 'public')).lectureStricte).toBeNull()
    // Et quand les deux lectures s'accordent — la quasi-totalité des départs —, rien à nommer.
    expect((await appel('2026-06-04', '15', 'public')).lectureStricte).toBeNull()
    // ⚠️ Le PORTAIL n'a rien à comparer : il rend DÉJÀ la lecture étroite en tête d'affiche.
    expect((await appel('2025-10-01', '30', 'connecte')).lectureStricte).toBeNull()
  })

  /**
   * ═══════════════════════════════════════════════════════════════════════════════
   * ⚠️ **LE ZÉRO DE LA V2, À LA SURFACE — L'INVARIANT DE TOUTE LA FONCTIONNALITÉ.**
   * ═══════════════════════════════════════════════════════════════════════════════
   *
   * `franc-pur.test.ts` (§ 0) mesure déjà ce zéro **sur le moteur** : deux configurations de
   * `calculer()`, comparées sur 7 304 paires. C'est nécessaire, et ce n'est pas suffisant — la
   * cliente ne lit pas `calculer()`, elle lit une page. Entre les deux il y a la chaîne
   * `lireParamsCalcul` → `calculPublic` → `entreeAutre(…, francPur)` → `restreindreAuFrancPur`,
   * et c'est **là, et nulle part ailleurs, que `lectureStricte` est calculée** : le champ que la
   * page affiche en toutes lettres sous la date (« le portail donnerait telle date ») et que
   * l'API sérialise. Une divergence introduite dans cette chaîne — une entrée publique
   * configurée autrement, une version de règles qui retombe ailleurs, une restriction qui
   * finirait par retoucher la date — laisserait le § 0 parfaitement vert.
   *
   * Quatre départs choisis à la main le vérifiaient (le test ci-dessus). Quatre départs ne
   * mesurent rien : les 16 divergences de la version 1 se cachent sur 1 826 jours, et aucun des
   * quatre n'en croise une. Ce test balaie donc **la même population que le § 0**, par la voie
   * réelle, et il tient les deux moitiés de l'invariant :
   *
   *   - sous le calendrier COURANT, `lectureStricte` est `null` **7 304 fois sur 7 304** : la
   *     page publique n'a jamais de seconde date à nommer, parce qu'il n'y en a pas ;
   *   - sous `c=1`, elle ne l'est PAS — 16 fois par durée. C'est ce qui prouve que le zéro est
   *     une mesure et non un champ mort : un `lectureStricte` câblé à `null` rendrait le premier
   *     compte identique, et celui-ci rouge.
   *
   * ⚠️ Le balayage coûte ~0,6 s. C'est le prix d'un chiffre qui, s'il passe de 0 à 1, veut dire
   * qu'un avocat peut lire deux dates de forclusion sur deux écrans de la même maison.
   */
  it('LE ZÉRO DE LA V2, À LA SURFACE — 7 304 calculs publics, pas une seule seconde date', async () => {
    const { calculPublic, lireParamsCalcul } = await import('@/lib/delais/lecture-publique')
    const { addDays, formatIso, parseIso } = await import('@/lib/delais/civil')

    /** Les 1 826 départs du § 0 — la même population, pour que les deux zéros soient comparables. */
    const departs: string[] = []
    for (let jour = parseIso('2025-01-01')!; formatIso(jour) <= '2029-12-31'; jour = addDays(jour, 1)) {
      departs.push(formatIso(jour))
    }
    expect(departs).toHaveLength(1826)

    /** La date de l'AUTRE surface, telle que la page la reçoit. `null` = les deux s'accordent. */
    const secondeDate = async (depart: string, n: string, versionCalendrier: string) => {
      const lus = lireParamsCalcul(
        new URLSearchParams({ d: depart, n, e: 'autre', f: 'oui', c: versionCalendrier, w: '1', locale: 'fr', base: '/delais' }),
      )
      if (!lus.ok) throw new Error(`${depart} : ${lus.code}`)
      const out = await calculPublic(lus.valeur, 'public')
      if (!out.ok) throw new Error(`${depart} : ${out.code}`)
      return out.lectureStricte
    }

    // ── 1. Le calendrier COURANT, celui que la plateforme sert : aucune seconde date.
    prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_COURANT)
    prisma.delaiFerie.findFirst.mockResolvedValue({ versionCalendrier: VERSION_CALENDRIER_COURANTE })
    let calculs = 0
    const divergents: string[] = []
    for (const n of ['8', '15', '30', '31']) {
      for (const depart of departs) {
        calculs += 1
        if ((await secondeDate(depart, n, String(VERSION_CALENDRIER_COURANTE))) !== null) {
          divergents.push(`${depart} + ${n} j`)
        }
      }
    }
    expect(calculs).toBe(7304)
    // ⚠️ On rend la LISTE, pas un compte : le jour où ce test rougira, il dira quels départs.
    expect(divergents).toEqual([])

    // ── 2. La sonde MORD : sous `c=1`, les quatre jours sans texte instituant reparaissent.
    prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_V1)
    prisma.delaiFerie.findFirst.mockResolvedValue({ versionCalendrier: 1 })
    const parDuree: Record<string, number> = {}
    for (const n of ['8', '15', '30', '31']) {
      let k = 0
      for (const depart of departs) if ((await secondeDate(depart, n, '1')) !== null) k += 1
      parDuree[n] = k
    }
    // Le même compte que celui du moteur (`franc-pur.test.ts`, § 0) : la chaîne ne perd rien.
    expect(parDuree).toEqual({ '8': 16, '15': 16, '30': 16, '31': 16 })
  })
})

/**
 * § 4.6 — ⚠️ **UN PERMALIEN RENDU SOUS UNE RÈGLE PÉRIMÉE LE DIT MAINTENANT** (défaut 10 de la
 * troisième recette).
 *
 * L'argument (c) de `regles-lecture.ts` justifie la coordonnée `rl` en toutes lettres : « Le
 * pied de page nomme donc la version des règles […] une date rendue sous une règle périmée le
 * dit. » Or `footerRules` n'est rendu que par `DelaiResult`, que la surface publique n'utilise
 * pas : `DelaiCalculateurPublic` rend `DelaiDatePublique`, qui n'avait ni pied, ni permalien,
 * ni mention de version. Vérifié en direct avant le correctif :
 * `/fr/delais?d=2029-12-01&n=30&c=2&w=1&rl=1` affichait « mardi 1er janvier 2030 » là où la
 * règle courante donne « jeudi 3 janvier 2030 » — **deux jours d'écart, aucun mot à l'écran**.
 * Le jour où une version 3 sera publiée, tous les permaliens émis aujourd'hui (`rl=2`)
 * deviendraient des liens périmés muets.
 *
 * `lectureStricte` ne rattrapait rien : elle compare les deux surfaces SOUS LA MÊME version de
 * règles. La voie (1) a été retenue — dire, et offrir de refaire — parce qu'elle préserve le
 * § 6.3 : un permalien se rejoue à l'identique. La voie (2), refuser `rl` en 400 sur la surface
 * publique, ne le préserverait pas.
 */
describe('§ 4.6 — la surface publique DIT sous quelle règle la date a été rendue', () => {
  it('un permalien `rl=1` porte sa ligne de version, et le lien qui refait le calcul', async () => {
    const html = await page({ d: '2029-12-01', n: '30', c: '2', w: '1', rl: '1' })
    // La date de la règle 1 : mardi 1er janvier 2030 — DEUX jours avant celle du jour.
    expect(html).toContain('mardi 1er janvier 2030')
    expect(html).toContain('règles de lecture version 1')
    expect(html).toContain('la version en vigueur est la 2')
    expect(html).toContain('Refaire le calcul avec la règle actuelle')
    // ⚠️ Le second permalien du § 6.3 : la MÊME saisie, sans coordonnée de version.
    expect(html).toContain('/fr/delais?d=2029-12-01&amp;n=30')
  })

  it('… et sous la règle COURANTE, l’écran ne dit rien : un calcul du jour n’a pas à se dater', async () => {
    const html = await page({ d: '2029-12-01', n: '30', c: '2', w: '1', rl: '2' })
    expect(html).toContain('jeudi 3 janvier 2030')
    expect(html).not.toContain('règles de lecture version')
    expect(html).not.toContain('Refaire le calcul avec la règle actuelle')
    // Sans `rl` du tout, c'est la version courante : même écran, même silence.
    const sans = await page({ d: '2029-12-01', n: '30', c: '2', w: '1' })
    expect(sans).toContain('jeudi 3 janvier 2030')
    expect(sans).not.toContain('règles de lecture version')
  })

  /** § 7.3 — une version qui n'est pas au registre est un 404 franc, jamais un repli. */
  it('une version de règles inconnue est refusée, elle ne retombe pas sur celles du jour', async () => {
    const html = await page({ d: '2029-12-01', n: '30', c: '2', w: '1', rl: '3' })
    expect(html).not.toContain('janvier 2030')
  })
})

/**
 * ⚠️ **LE PORTAIL N'A RIEN PERDU.** C'est la moitié la plus importante de ce changement : la
 * surface connectée calcule sur une entrée du répertoire — un article, une matière, un régime,
 * un fondement — et la prorogation y a un fondement textuel. Le même 4 juin 2026, sur
 * l'art. 354, doit rendre le lundi 6 juillet, ses réserves, son jour praticable et ses
 * avertissements, exactement comme avant.
 */
describe('le PORTAIL garde tout — prorogation, réserves, praticable, avertissements', () => {
  it('art. 354 : la prorogation joue toujours, et la date est le lundi 6 juillet 2026', async () => {
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    expect(html).toContain('lundi 6 juillet 2026')
    expect(html).toContain('Agir au plus tard le lundi 6 juillet 2026 est sûr')
    // Le dimanche 5 est ÉCARTÉ, avec son motif : c'est la table des jours écartés.
    expect(html).toContain('dimanche 5 juillet 2026')
  })

  /**
   * Départ au 16 janvier 2026 : la tête d'affiche tombe le LUNDI GRAS (16 février 2026).
   *
   * ⚠️ **CE FICHIER SERT LE CALENDRIER DE LA VERSION 1** (`prisma.delaiFerie` simulé, `c=1`),
   * et le permalien la nomme : c'est donc exactement ce qu'un lien émis avant le 20 août 2026
   * rend encore. Sous ce calendrier-là, le Lundi Gras est porté sans texte instituant, il ne
   * proroge pas la tête d'affiche, et la « lecture la plus large » le nomme.
   *
   * ⚠️ **LA RÉSERVE « R6 » A ÉTÉ RETIRÉE LE 20 AOÛT 2026** : le Décret du 11 décembre 2024
   * institue les onze fêtes légales, Lundi Gras compris, et la version 2 du calendrier les
   * porte `autorite: 'TEXTE'`. Le portail en tire encore tout ce que la surface publique a
   * perdu — la lecture la plus large, le jour praticable et les avertissements.
   */
  it('les réserves, le jour praticable et les avertissements y sont, entiers', async () => {
    const html = await pageConnectee({ d: '2026-01-16', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    expect(html).toContain('lundi 16 février 2026')
    expect(html).toContain('Lectures concurrentes du texte')
    // La lecture nommée « Calendrier de la rédaction » (R6) n'existe plus nulle part.
    expect(html).not.toContain('Calendrier de la rédaction')
    expect(html).toContain('Lecture la plus large')
    expect(html).toContain('mercredi 18 février 2026')
    /**
     * ⚠️ **LE BLOC « JOUR PRATICABLE » NE RECULE PLUS D'UN JOUR ICI, ET C'EST JUSTE** (défauts
     * 2, 4 et 13 de la troisième recette). La tête d'affiche tombe le LUNDI GRAS, que le décret
     * du 11 décembre 2024 ne chôme qu'« à partir de midi » : la matinée reste ouvrable,
     * l'huissier peut instrumenter, et écrire « Aucune signification ni exécution ne peut être
     * faite le lundi 16 février » serait faux. Le bloc disait auparavant « au plus tard le
     * samedi 14 février » — deux jours plus tôt que le dernier jour réellement utile.
     *
     * Plus généralement : sur une entrée `prorogation991: 'OUI'` (les 279 lignes CPC et
     * TRAVAIL), la cascade fait de la tête un point fixe et le § 4.8 est INATTEIGNABLE. Il vit
     * sur les 114 entrées du Code civil — et sur le genre « Autre » du portail, que le test
     * suivant vérifie. `calcul.test.ts` MESURE cette atteignabilité.
     *
     * ═══════════════════════════════════════════════════════════════════════════════
     * ⚠️ **ORACLE DÉPLACÉ LE 20 AOÛT 2026, AU VU DU DÉCRET : LE BLOC REPARAÎT — POUR DIRE
     * L'HEURE, ET RIEN D'AUTRE** (Me Vaval : « le bloc dernier jour praticable doit en tenir
     * compte »).
     * ═══════════════════════════════════════════════════════════════════════════════
     *
     * Le test exigeait l'ABSENCE du bloc, et il avait raison contre ce que le bloc disait
     * alors : une seconde date, plus précoce, sur un jour que rien ne ferme. Mais le taire
     * revenait à promettre une journée entière sur le seul jour du calendrier qui n'en est pas
     * une — la fenêtre s'y ferme à midi (art. 991 al. 2 : « avant six heures du matin » ;
     * art. 512 C. trav. : « avant huit heures du matin », à peine de nullité).
     *
     * Ce qui est donc vérifié ici, et c'est plus étroit que l'ancienne absence : le bloc
     * paraît, il dit MIDI, et il ne recule TOUJOURS aucune date — ni la phrase « Aucune
     * signification ni exécution ne peut être faite le lundi 16 février », ni le samedi
     * 14 février.
     */
    expect(html).toContain(t.delais.practicableTitle)
    expect(html).toContain('est chômé à partir de midi')
    expect(html).toContain('de six heures du matin à midi')
    expect(html).not.toContain('Aucune signification ni exécution ne peut être faite le lundi 16 février 2026')
    expect(html).not.toContain('samedi 14 février 2026')
    // h) les avertissements, dans l'ordre imposé : A6, A4, A1, A3.
    expect(html).toContain('est un jour à surveiller')
    // A4 nomme désormais la VERSION du calendrier et le décret qui l'a périmée, au lieu de
    // la formule « sur instruction de la rédaction », retirée de toutes les PHRASES de la
    // plateforme le 20 août 2026.
    expect(html).toContain('VERSION 1')
    expect(html).toContain('11 décembre 2024')
    const a4 = html.slice(html.indexOf('>A4<'), html.indexOf('>A1<'))
    expect(a4).not.toContain('sur instruction de la rédaction')
    /**
     * ⚠️ **LA FORMULE « SUR INSTRUCTION DE LA RÉDACTION » NE PARAÎT PLUS À L'ÉCRAN ICI, ET LA
     * DONNÉE LA PORTE TOUJOURS.** Les deux moitiés comptent, et il ne faut confondre ni l'une
     * ni l'autre :
     *
     *  - **la DONNÉE** — `source` est la colonne que la rédaction a écrite le 19 août 2026 ;
     *    elle est en base, elle est GELÉE (§ 4.3), et la réécrire changerait la source d'un
     *    calcul déjà rendu et déjà cité. Elle reste donc, mot pour mot, dans la version 1 ;
     *  - **l'ÉCRAN** — l'écran la recopiait par la table des JOURS ÉCARTÉS. Depuis que la tête
     *    d'affiche du portail ne fuit plus le Lundi Gras (défaut 2), aucun jour n'est écarté
     *    sur ce calcul-ci : la table est vide, et la formule ne paraît plus. Ce qui la dit
     *    encore, c'est l'avertissement A4 — vérifié deux lignes plus haut : « VERSION 1 » et
     *    « 11 décembre 2024 ».
     */
    expect(html).not.toContain('sur instruction de la rédaction')
    expect(CALENDRIER_V1.some((e) => e.source.includes('sur instruction de la rédaction'))).toBe(true)
    expect(CALENDRIER_COURANT.some((e) => e.source.includes('instruction de la rédaction'))).toBe(false)
    expect(html).toContain('arrêté du Président de la République')
    expect(html).toContain('Ce calcul ne remplace pas la vérification du texte')
  })

  /**
   * ⚠️ **LA CASCADE N'EST PLUS UNE RÉSERVE, C'EST LA RÈGLE** (Me Vaval, 20 août 2026 au soir).
   * Ce test s'intitulait « la réserve R3 sort toujours » et attendait le libellé « Prorogation
   * en cascade » dans le bloc des lectures concurrentes : R3 a été retirée du moteur le soir
   * même, et le report se fait désormais EN TÊTE D'AFFICHE. Ce qu'il faut vérifier a donc
   * changé de place — la date n'est plus nommée à côté, elle est la date.
   */
  it('la cascade est APPLIQUÉE en tête : 15 juillet 2026 → lundi 17 août, deux jours franchis', async () => {
    const html = await pageConnectee({ d: '2026-07-15', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    // Le samedi 15 août (l'Assomption) et le dimanche 16 sont FRANCHIS, l'un après l'autre.
    expect(html).toContain('samedi 15 août 2026')
    expect(html).toContain('dimanche 16 août 2026')
    // ... et la tête d'affiche est le lundi 17 : c'est elle qui est en gros caractères.
    expect(html).toContain('lundi 17 août 2026 — 17/08/2026')
    expect(html).toContain('Agir au plus tard le lundi 17 août 2026 est sûr')
    // Les jours écartés restent une table renseignée, pas un « aucun jour écarté ».
    expect(html).not.toContain('Aucun jour écarté.')
    // ⚠️ Et la réserve retirée ne survit nulle part dans le rendu.
    expect(html).not.toContain('Prorogation en cascade')
  })

  it('… et le calcul « Autre » du portail garde SA lecture nommée sur la prorogation', async () => {
    const html = await pageConnectee({
      d: '2026-06-04',
      e: 'autre',
      n: '30',
      f: 'oui',
      src: 'Circulaire DGI',
      c: '1',
      w: '1',
    })
    expect(html).toContain('Si l’article 991 C. pr. civ. s’applique à ce délai')
    expect(html).toContain('lundi 6 juillet 2026')
    expect(html).toContain(t.delais.practicableTitle)
  })
})

// ===========================================================================
// § 2 — LE COMMUTATEUR : JOURS FRANCS OU JOURS CALENDAIRES
// ===========================================================================

/**
 * Me Vaval, 20 août 2026 : « Il doit y avoir une sorte de switch on/off pour que l'utilisateur
 * choisisse s'il souhaite calculer le délai en jour franc ou en jour calendaire quand il va
 * indiquer à la main le nombre de jours. »
 *
 * Le moteur savait déjà compter les deux (`franc: true | false`, § 4.7) : **rien n'y a été
 * réimplémenté**, et `calcul.ts` n'a pas été touché. Ce que ce bloc prouve, c'est que le
 * commutateur atteint bien le moteur, qu'il voyage dans le permalien, que l'écran DIT laquelle
 * des deux règles a joué — et qu'il ne peut pas s'appliquer à une entrée du répertoire.
 *
 * Le cas d'espèce est celui de Me Vaval : jeudi 4 juin 2026, 30 jours. **Un jour d'écart entre
 * les deux positions**, et c'est tout l'enjeu :
 *   - jours FRANCS      → départ + 30 + 1 = dimanche 5 juillet 2026 ;
 *   - jours CALENDAIRES → départ + 30     = samedi 4 juillet 2026.
 */
describe('§ 2 — le commutateur de décompte, du formulaire au permalien', () => {
  const COMMUN = { d: '2026-06-04', e: 'autre', n: '30', src: 'Circulaire DGI', c: '1', w: '1' }

  it('jours CALENDAIRES : le jour de l’échéance compte → samedi 4 juillet 2026', async () => {
    const html = await pageConnectee({ ...COMMUN, f: 'non' })
    expect(html).toContain('samedi 4 juillet 2026')
    // La position « jours francs » aurait rendu le lendemain : c'est le jour d'écart.
    expect(html).not.toContain('Date limite</p><h2 id="delai-resultat-titre" tabindex="-1" class="mt-1 font-sans text-display-3 text-ank">dimanche 5 juillet 2026')
  })

  it('jours FRANCS : le jour de l’échéance ne compte pas → dimanche 5 juillet 2026', async () => {
    const html = await pageConnectee({ ...COMMUN, f: 'oui' })
    expect(html).toContain('dimanche 5 juillet 2026')
  })

  /**
   * ⚠️ **LE RAISONNEMENT NOMME LA RÈGLE APPLIQUÉE, DANS LES MOTS DU COMMUTATEUR.** « Régime :
   * ordinaire » ne rappelle pas à qui rouvre la fiche six mois plus tard quelle position il
   * avait poussée : le fondement de l'entrée synthétique porte donc la phrase, et le moteur la
   * reprend telle quelle dans l'étape « Délai : … ».
   */
  it('l’écran écrit LAQUELLE des deux règles a été appliquée', async () => {
    const calendaires = await pageConnectee({ ...COMMUN, f: 'non' })
    // La position retenue, nommée dans les mots du commutateur, avec son calcul…
    expect(calendaires).toContain('Décompte demandé : jours CALENDAIRES (départ + nombre de jours)')
    // … et la conséquence, à l'étape qui la produit.
    expect(calendaires).toContain('Le jour de l’échéance compte (délai ordinaire)')
    expect(calendaires).not.toContain('jours FRANCS')

    const francs = await pageConnectee({ ...COMMUN, f: 'oui' })
    expect(francs).toContain('Décompte demandé : jours FRANCS (départ + nombre de jours + 1)')
    expect(francs).toContain('Le jour de l’échéance ne se compte pas')
    expect(francs).not.toContain('jours CALENDAIRES')
  })

  /** § 6.3 — le choix VOYAGE dans le permalien, et s'y rejoue à l'identique. */
  it('le permalien porte la position retenue', async () => {
    const html = await pageConnectee({ ...COMMUN, f: 'non' })
    expect(html).toContain('n=30&amp;f=non')
    const francs = await pageConnectee({ ...COMMUN, f: 'oui' })
    expect(francs).toContain('n=30&amp;f=oui')
  })

  /**
   * ⚠️ **« Rends-le impossible, pas seulement caché. »** Sur une entrée du répertoire, le
   * régime vient du TEXTE. `?e=cpc-354-…&f=non` était accepté et le paramètre abandonné en
   * silence : l'adresse portait un mode de décompte que le calcul n'avait pas appliqué.
   */
  it('⚠️ un `f` sur une entrée du répertoire est REFUSÉ, jamais ignoré', async () => {
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', km: '0', f: 'non' })
    expect(html).toContain('Le mode de décompte ne se choisit pas sur une entrée du répertoire')
    // Aucun résultat n'est rendu : le refus remplace la date, il ne l'accompagne pas.
    expect(html).not.toContain('Date limite')
  })

  it('… et la même entrée SANS `f` calcule comme avant', async () => {
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    expect(html).toContain('Date limite')
    expect(html).not.toContain('Le mode de décompte ne se choisit pas')
  })

  /**
   * § 6.3 — UN PERMALIEN SE REJOUE À L'IDENTIQUE. Ceux émis avant le commutateur portent
   * `f=ne-sais-pas` : la valeur reste VALIDE côté serveur — la retirer du schéma ferait
   * échouer en 400 un lien copié de bonne foi —, elle n'est simplement plus proposée.
   */
  it('§ 6.3 — un permalien `f=ne-sais-pas` se rejoue encore, avec ses DEUX lectures', async () => {
    const html = await pageConnectee({ ...COMMUN, f: 'ne-sais-pas' })
    // La tête d'affiche reste la plus précoce (décompte calendaire)…
    expect(html).toContain('samedi 4 juillet 2026')
    // … et le décompte franc reste NOMMÉ à côté, avec sa date.
    expect(html).toContain(t.delais.readingsTitle)
    expect(html).toContain('dimanche 5 juillet 2026')
    expect(html).toContain('Décompte non tranché (ancienne réponse « je ne sais pas »)')
  })
})

// ===========================================================================
// § 09 — LE FREIN DE DÉBIT
// ===========================================================================

describe('§ 09 — le frein de débit', () => {
  it('la PAGE passe par le seau, comme les routes', async () => {
    await page({ d: '2026-06-04', n: '15' })
    expect(guard).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delais-page', subject: '203.0.113.7' }),
      expect.anything(),
    )
  })

  it('au-delà du seuil, la page refuse AVANT de lire la base', async () => {
    guard.mockResolvedValue(false)
    const html = await page({ d: '2026-06-04', n: '15' })
    expect(html).toContain('Trop de calculs en peu de temps')
    expect(prisma.delaiFerie.findFirst).not.toHaveBeenCalled()
    expect(prisma.delaiEntry.findMany).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// L'ÉTAT VIDE ET LES ÉCHECS
// ===========================================================================

describe('l’état vide', () => {
  /**
   * ⚠️ **LE CADRE PÉDAGOGIQUE A QUITTÉ LA SURFACE PUBLIQUE le 20 août 2026.** Il citait
   * l'article 987 intégralement et déroulait l'exemple travaillé de l'arrêt Germeil : c'est
   * exactement « expliquer le raisonnement », que Me Vaval a retiré du public. L'état vide de
   * cette page, c'est désormais la page elle-même — son titre et ses deux champs. Le PORTAIL,
   * lui, le garde (test suivant).
   */
  it('la page publique n’a plus d’état vide à meubler : deux champs, et c’est tout', async () => {
    const html = await page({})
    expect(html).not.toContain('Tous les délais prévus au Code de procédure civile sont francs.')
    expect(html).not.toContain('Germeil')
    expect(html).not.toContain('Exemple historique')
    expect(html).not.toContain(t.delais.emptyTitle)
    expect(html).not.toContain('Date limite')
    // Ce qui reste : les deux champs et la règle de droit.
    expect(html).toContain('Date de réception de l’acte')
    expect(html).toContain(t.delais.francRule)
  })

  it('… mais le PORTAIL montre toujours l’article 987 et l’exemple Germeil', async () => {
    const html = await pageConnectee({})
    expect(html).toContain('Tous les délais prévus au Code de procédure civile sont francs.')
    expect(html).toContain('Germeil')
    expect(html).toContain('samedi 23 juin 1962')
    expect(html).toContain('Exemple historique')
  })

  it('dans l’espace connecté, il montre AUSSI les 393 entrées et le régime de chacune', async () => {
    const html = await pageConnectee({})
    expect(html).toContain(`value="${SLUG}"`)
    expect(html).toContain('Délai franc')
    expect(html).toContain('Ne produit pas de date')
  })
})

describe('les échecs se lisent en français', () => {
  it('base non migrée côté PUBLIC : la phrase du § 5.1, jamais « Internal Server Error »', async () => {
    prisma.delaiFerie.findFirst.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'findFirst')"),
    )
    const html = await page({})
    expect(html).toContain('Échec —')
    expect(html).toContain('n’est pas encore ouvert')
    // Et surtout : pas de formulaire qui accepterait la saisie avant de casser.
    expect(html).not.toContain('method="get"')
  })

  it('tables absentes en base (P2021), côté connecté : la même phrase', async () => {
    prisma.delaiEntry.findMany.mockRejectedValue(Object.assign(new Error('no table'), { code: 'P2021' }))
    expect(await pageConnectee({})).toContain('n’est pas encore ouvert')
  })

  it('une entrée inconnue, dans l’espace connecté : la phrase, jamais un code', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue(null)
    const html = await pageConnectee({ d: '2026-06-04', e: 'cpc-inexistant' })
    expect(html).toContain('Cette entrée du répertoire n’existe pas.')
    expect(html).not.toContain('entreeInconnue')
  })
})

// ===========================================================================
// L'ESPACE CONNECTÉ : LE RÉPERTOIRE, INCHANGÉ
// ===========================================================================

describe('le gabarit vérifié du § 6.3, rendu par la page CONNECTÉE', () => {
  it('4 juin 2026, art. 354 → lundi 6 juillet 2026, avec son raisonnement', async () => {
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    expect(html).toContain('lundi 6 juillet 2026 — 06/07/2026')
    expect(html).toContain('Agir au plus tard le lundi 6 juillet 2026 est sûr')
    expect(html).toContain('Le raisonnement, pas à pas')
    // ⚠️ **`rl` ET `sig` FONT PARTIE DU PERMALIEN** (défaut 7 de la troisième recette) : ce
    // test les ignorait tous les deux et passait, parce qu'il ne contrôlait qu'un PRÉFIXE de la
    // chaîne. Un permalien sans `rl` rendrait, le jour où une question de droit est tranchée,
    // une autre date sous la même adresse ; sans `sig`, il ne rouvrirait pas une entrée retirée.
    expect(html).toContain(
      `/fr/outils/delais?d=2026-06-04&amp;e=${SLUG}&amp;r=1&amp;c=1&amp;w=1&amp;rl=${VERSION_REGLES_COURANTE}&amp;km=0`,
    )
    expect(html).toMatch(/&amp;rl=2&amp;km=0&amp;sig=[A-Za-z0-9_-]+/)
  })

  it('la date saisie en JJ/MM/AAAA donne le MÊME résultat que l’ISO du permalien', async () => {
    const fr = await pageConnectee({ d: '04/06/2026', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    const iso = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', km: '0' })
    expect(fr).toBe(iso)
  })

  it('rechargé, le rendu est identique au caractère près (bloc 12)', async () => {
    const q = { d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', km: '0' }
    expect(await pageConnectee(q)).toBe(await pageConnectee(q))
  })

  it('le point de départ y reste « Point de départ », jamais « réception »', async () => {
    const html = await pageConnectee({})
    expect(html).toContain('Point de départ du délai')
    expect(html).not.toContain('Date de réception de l’acte')
  })
})

describe('§ 7.3 — un permalien rouvert sur une entrée retirée (espace connecté)', () => {
  /** La signature telle que l'utilisatrice l'a copiée, quand l'entrée était encore au menu. */
  async function sigDe(recherche: Record<string, string>): Promise<string> {
    const html = await pageConnectee(recherche)
    return /&amp;sig=([A-Za-z0-9_-]+)/.exec(html)?.[1] ?? ''
  }

  it('le permalien SIGNÉ reste lisible, avec son bandeau et sans recalcul', async () => {
    const sig = await sigDe({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1' })
    expect(sig).not.toBe('')
    prisma.delaiEntry.findUnique.mockResolvedValue({
      ...LIGNE_354,
      statut: 'masque',
      masqueMotif: 'Doublon de l’article 356.',
      masqueAt: new Date('2026-09-01T00:00:00Z'),
    })
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1', sig })
    expect(html).toContain('lundi 6 juillet 2026')
    expect(html).toContain('Doublon de l’article 356.')
    expect(html).not.toContain('Refaire le calcul')
    expect(html).toContain('Ce calcul est conservé tel qu’il a été rendu')
  })

  it('sans révision, un calcul NEUF est refusé et le dit', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE_354, statut: 'supprime', masqueMotif: 'Retirée.' })
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, c: '1', w: '1' })
    expect(html).toContain('retirée du répertoire')
    expect(html).not.toContain('lundi 6 juillet 2026')
  })

  it('avec `r` deviné mais SANS signature, il l’est aussi', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE_354, statut: 'supprime', masqueMotif: 'Retirée.' })
    const html = await pageConnectee({ d: '2030-03-15', e: SLUG, r: '1', c: '1', w: '1' })
    expect(html).toContain('retirée du répertoire')
  })
})

describe('la surface connectée', () => {
  /**
   * ⚠️ La publique ne « prévient » plus : elle ne renvoie NULLE PART. Les textes appliqués
   * ayant quitté l'écran public, il n'y a plus ni lien profond, ni mur de connexion annoncé —
   * et donc plus rien à prévenir. Le PORTAIL, lui, garde ses ancres `#art-N`.
   */
  it('active les liens profonds vers le corpus ; la publique ne renvoie nulle part', async () => {
    const connecte = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1' })
    const publique = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(connecte).toContain('#art-987')
    expect(publique).not.toContain('/fr/doc/')
    expect(publique).not.toContain('connexion requise')
    expect(publique).not.toContain('<a ')
  })
})

/**
 * § 6.2 — LA BORNE HAUTE. La borne BASSE (22 juin 1989) est traitée par un refus motivé ;
 * rien ne disait l'autre côté. `?d=2050-01-01` rendait « Date limite mardi 1er février 2050 »
 * avec la même assurance qu'un calcul juste.
 *
 * ⚠️ **L'AVERTISSEMENT DE SAISIE A QUITTÉ LA SURFACE PUBLIQUE le 20 août 2026** : « la seule
 * mention conservée » y est celle du jour où la date calculée tombe, et rien d'autre. Il reste
 * produit par `calculPublic()` (`avertissementsSaisie`), servi par l'API et affiché par le
 * PORTAIL : c'est l'écran public qui se tait, pas le moteur.
 */
describe('§ 6.2 — une date de départ lointaine', () => {
  it('publiquement : le calcul se fait, et l’écran ne montre QUE la date', async () => {
    const html = await page({ d: '2050-01-01', n: '15', c: '1', w: '1' })
    expect(html).toContain('Date limite')
    expect(html).toContain('17/01/2050')
    expect(html).not.toContain('plus de dix ans')
  })

  it('… mais le moteur, lui, le signale toujours — et le PORTAIL l’affiche', async () => {
    const html = await pageConnectee({
      d: '2050-01-01', e: 'autre', n: '15', f: 'oui', src: 'Circulaire DGI', c: '1', w: '1',
    })
    expect(html).toContain('plus de dix ans')
    expect(html).toContain('Date limite')
  })

  it('à dix ans ou moins, aucun avertissement parasite', async () => {
    const html = await page({ d: '2030-06-04', n: '15', c: '1', w: '1' })
    expect(html).not.toContain('plus de dix ans')
  })
})

/**
 * § 8.3 — LE TITRE DE L'ÉTAT VIDE N'EST ANNONCÉ QU'UNE FOIS. La section portait
 * `aria-labelledby="delai-resultat-titre"` et rendait un `<h2 sr-only>` du même texte que le
 * `<h2>` VISIBLE de `DelaiPedagogie`, juste après. **L'état vide n'existe plus en public** —
 * le contrôle porte donc sur le PORTAIL, seule surface qui le rende encore.
 */
describe('§ 8.3 — un seul titre pour l’état vide (portail)', () => {
  it('le texte du titre n’apparaît qu’UNE fois', async () => {
    const html = await pageConnectee({})
    expect(html.split(t.delais.emptyTitle).length - 1).toBe(1)
  })

  it('la région est nommée par le titre VISIBLE', async () => {
    const html = await pageConnectee({})
    expect(html).toContain('aria-labelledby="delai-pedagogie"')
    expect(html).not.toContain('id="delai-resultat-titre" tabindex="-1" class="sr-only"')
  })
})

/**
 * § 6.4 — LE PERMALIEN RESTE SUR SA SURFACE. `construirePermalien` codait `/${locale}/delais`
 * en dur : depuis `/fr/outils/delais`, le pied technique, « Copier le raisonnement » et
 * « Refaire le calcul avec la règle actuelle » renvoyaient tous à la page PUBLIQUE.
 */
describe('§ 6.4 — le permalien de la surface connectée y reste', () => {
  it('le pied technique porte `/fr/outils/delais`, pas `/fr/delais`', async () => {
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, c: '1', w: '1' })
    expect(html).toContain('/fr/outils/delais?d=2026-06-04')
    expect(html).not.toMatch(/<code[^>]*>\/fr\/delais\?/)
  })

  it('« Refaire le calcul » y reste aussi', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE_354, revision: 5 })
    const html = await pageConnectee({ d: '2026-06-04', e: SLUG, r: '1', c: '1', w: '1' })
    expect(html).toContain('Refaire le calcul')
    expect(html).toMatch(/href="\/fr\/outils\/delais\?[^"]*r=5/)
  })

  /**
   * ⚠️ La page publique n'ÉMET plus de permalien du tout : il faisait partie de l'appareil
   * retiré le 20 août 2026. Ce qui doit rester vrai, c'est qu'aucune adresse du portail n'y
   * fuit — et l'`action` du formulaire reste celle de la surface.
   */
  it('la page publique n’émet plus de permalien, et ne renvoie pas au portail', async () => {
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    expect(html).toContain('action="/fr/delais"')
    expect(html).not.toContain('/fr/delais?d=2026-06-04')
    expect(html).not.toContain('/fr/outils/delais')
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * § 09 — **DEUX REQUÊTES SUR SIX ÉTAIENT DE PURS DOUBLONS.** (20 août 2026.)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * La page lit d'abord l'état du calculateur — `etatPublicDelais()` en public,
 * `chargerRepertoirePublic()` dans l'espace connecté : elle doit savoir si la base est prête
 * avant d'afficher un formulaire. Les deux rendent déjà le calendrier courant et les fenêtres
 * courantes. `calculPublic()` les relisait ensuite À L'IDENTIQUE, sur la même requête HTTP.
 *
 * Mesuré sur la base de PRODUCTION le 20 août 2026 (journal SQL de Prisma) :
 *
 *   · surface publique, un calcul   : **6 requêtes → 4**
 *   · portail, un calcul sur entrée : **9 requêtes → 7**
 *
 * ⚠️ **Le frein de débit en mémoire est INOPÉRANT en serverless** (`ratelimit.ts` le dit, et
 * `noyau-calculateur.tsx` le répète) : sur Vercel, chaque invocation part avec sa propre `Map`.
 * Le coût par requête anonyme est donc le seul frein réel qui reste — d'où ce test, qui le
 * FIXE. Le réparer vraiment demande un magasin partagé ; c'est un autre chantier.
 */
describe('§ 09 — le nombre d’allers-retours à la base, par requête publique', () => {
  const compte = () =>
    prisma.delaiEntry.findMany.mock.calls.length +
    prisma.delaiEntry.findUnique.mock.calls.length +
    prisma.delaiEntryRevision.findUnique.mock.calls.length +
    prisma.delaiFerie.findMany.mock.calls.length +
    prisma.delaiFerie.findFirst.mock.calls.length +
    prisma.delaiFenetreSignification.findMany.mock.calls.length +
    prisma.delaiFenetreSignification.findFirst.mock.calls.length

  it('la surface publique : QUATRE requêtes pour un calcul, et pas six', async () => {
    await page({ d: '2026-06-04', n: '15' })
    expect(compte()).toBe(4)
    // La version courante est lue UNE fois, pas deux : c'est là qu'étaient les doublons.
    expect(prisma.delaiFerie.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.delaiFenetreSignification.findFirst).toHaveBeenCalledTimes(1)
  })

  it('le portail : SEPT requêtes pour un calcul sur une entrée, et pas neuf', async () => {
    await pageConnectee({ d: '2026-06-04', e: SLUG })
    expect(compte()).toBe(7)
    expect(prisma.delaiFerie.findFirst).toHaveBeenCalledTimes(1)
    expect(prisma.delaiFenetreSignification.findFirst).toHaveBeenCalledTimes(1)
  })

  /** Sans calcul, la page ne lit que de quoi savoir si la base est prête. */
  it('la page publique sans saisie : DEUX requêtes, et aucun calendrier chargé', async () => {
    await page({})
    expect(compte()).toBe(2)
    expect(prisma.delaiFerie.findMany).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ **CE N'EST PAS UN CACHE.** Un permalien qui NOMME une version continue de faire foi :
   * `q.c` / `q.w` passent avant tout, et le nombre de requêtes tombe même à trois — la version
   * courante n'a plus à être lue du tout pour le calcul.
   */
  it('un permalien qui nomme sa version n’est jamais écrasé par la version courante', async () => {
    prisma.delaiFerie.findFirst.mockResolvedValue({ versionCalendrier: 2 })
    const html = await page({ d: '2026-06-04', n: '15', c: '1', w: '1' })
    // Le calendrier demandé est bien le 1, pas le 2 que porte « la version courante ».
    expect(prisma.delaiFerie.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { versionCalendrier: 1 } }),
    )
    expect(html).toContain('Date limite')
  })
})
