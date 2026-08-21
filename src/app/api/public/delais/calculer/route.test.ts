/**
 * LA ROUTE PUBLIQUE DE CALCUL — comportementale, Prisma simulé, route réellement exécutée.
 *
 * ⚠️ **SON PÉRIMÈTRE A CHANGÉ.** Publiquement, on ne calcule plus QUE sur un nombre de jours
 * francs saisi — le genre « Autre » du § 4.12. Un slug d'entrée y rendait le libellé de
 * l'entrée, sa durée, son régime, son fondement, son point de départ et le texte de son
 * article : c'était le répertoire servi une ligne à la fois, à qui itère les slugs, pendant
 * qu'on fermait la route qui le sert en bloc. Le répertoire complet reste ENTIER dans
 * l'espace connecté, dont la page appelle `calculPublic(params, 'connecte')` directement.
 *
 * Ce que cette route doit tenir, et que ces tests vérifient :
 *  1. **elle n'écrit rien** — pas de journal, pas de statistique, pas de quota (§ 4) ;
 *  2. **un slug est refusé, jamais servi** : 401, et le corps ne dit rien de l'entrée ;
 *  3. **elle ne calcule que du FRANC** : `f=non` fabriqué à la main est refusé, jamais
 *     silencieusement écrasé ;
 *  4. **un permalien rechargé rend le même octet** (bloc 12) ;
 *  5. une version inconnue reste un 404 franc, jamais un repli sur la version courante.
 */
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CALENDRIER_COURANT, CALENDRIER_V1, VERSION_CALENDRIER_COURANTE } from '@/lib/delais/feries'
import { versCreateInput } from '@/lib/delais/graine'
import { REPERTOIRE, construireEntrees } from '@/lib/delais/repertoire'
import { VERSION_REGLES_COURANTE } from '@/lib/delais/regles-lecture'

const prisma = {
  delaiEntry: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  delaiEntryRevision: { findUnique: vi.fn(), create: vi.fn() },
  delaiFerie: { findMany: vi.fn(), findFirst: vi.fn() },
  delaiFenetreSignification: { findMany: vi.fn(), findFirst: vi.fn() },
  auditLog: { create: vi.fn(), count: vi.fn() },
}
const audit = vi.fn()

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/auth/audit', () => ({ audit }))

const { GET } = await import('./route')

const SLUG = 'cpc-354-appel-parties-demeurant-haiti'
const ENTREE = construireEntrees(REPERTOIRE).find((e) => e.slug === SLUG)!
const LIGNE = {
  ...(versCreateInput(ENTREE) as unknown as Record<string, unknown>),
  id: 'e-354',
  statut: 'visible',
  revision: 1,
  masqueMotif: null,
  masqueAt: null,
  updatedAt: new Date('2026-08-01T00:00:00Z'),
}

const FENETRES = [
  { matiere: 'CIVILE', heureDebut: 6, heureFin: 18, source: 'C. pr. civ., art. 991', sourceDocId: null, nullite: false, nulliteTexteFr: null },
  { matiere: 'TRAVAIL', heureDebut: 8, heureFin: 17, source: 'C. trav., art. 512', sourceDocId: null, nullite: true, nulliteTexteFr: 'nulle.' },
]

/** Chaque test emploie SA propre adresse : le frein de débit est par IP, et il est en mémoire. */
let compteurIp = 0
function req(query: string, ip = `10.0.0.${++compteurIp}`) {
  return new NextRequest(`http://localhost/api/public/delais/calculer?${query}`, {
    headers: { 'x-real-ip': ip },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prisma.delaiEntry.findUnique.mockResolvedValue(LIGNE)
  prisma.delaiEntryRevision.findUnique.mockResolvedValue({
    payloadJson: JSON.stringify(versCreateInput(ENTREE)),
    createdAt: new Date('2026-09-12T00:00:00Z'),
  })
  prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_V1)
  prisma.delaiFerie.findFirst.mockResolvedValue({ versionCalendrier: 1 })
  prisma.delaiFenetreSignification.findMany.mockResolvedValue(FENETRES)
  prisma.delaiFenetreSignification.findFirst.mockResolvedValue({ versionFenetres: 1 })
})

// ===========================================================================
// LE PÉRIMÈTRE PUBLIC : LE RÉPERTOIRE NE SORT PAS
// ===========================================================================

describe('un slug d’entrée est REFUSÉ, jamais servi', () => {
  it('401 `repertoireReserve` — l’entrée existe, elle demande un compte', async () => {
    const res = await GET(req(`d=2026-06-04&e=${SLUG}&r=1&c=1&w=1&km=0`))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('repertoireReserve')
  })

  it('le refus ne fuit RIEN de l’entrée : ni libellé, ni durée, ni fondement, ni date', async () => {
    const texte = await (await GET(req(`d=2026-06-04&e=${SLUG}&r=1&c=1&w=1`))).text()
    expect(texte).not.toContain('Appel')
    expect(texte).not.toContain('987')
    expect(texte).not.toContain('teteAffiche')
  })

  it('la base n’est même pas interrogée pour l’entrée', async () => {
    await GET(req(`d=2026-06-04&e=${SLUG}&r=1&c=1&w=1`))
    expect(prisma.delaiEntry.findUnique).not.toHaveBeenCalled()
    expect(prisma.delaiEntryRevision.findUnique).not.toHaveBeenCalled()
  })

  /**
   * ⚠️ `base` vient de la « query » : n'importe qui peut l'écrire. L'accès, lui, est un
   * ARGUMENT posé par la route. Si les deux se confondaient, la fermeture ne fermerait rien.
   */
  it('`base=/outils/delais` ne fait pas passer pour un connecté', async () => {
    const res = await GET(req(`d=2026-06-04&e=${SLUG}&r=1&c=1&w=1&base=%2Foutils%2Fdelais`))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('repertoireReserve')
  })

  it('une entrée RETIRÉE n’est pas davantage servie — même refus, même absence de motif', async () => {
    prisma.delaiEntry.findUnique.mockResolvedValue({ ...LIGNE, statut: 'masque', masqueMotif: 'Doublon.' })
    const res = await GET(req(`d=2026-06-04&e=${SLUG}&r=1&c=1&w=1`))
    expect(res.status).toBe(401)
    expect(await res.text()).not.toContain('Doublon')
  })

  it('le refus précède la lecture de la date : il ne dépend pas d’une saisie valide', async () => {
    const res = await GET(req(`d=2026-02-31&e=${SLUG}`))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('repertoireReserve')
  })
})

describe('publiquement, on ne calcule que du FRANC', () => {
  it('`f=non` — un délai ORDINAIRE — est refusé, jamais écrasé en silence', async () => {
    const res = await GET(req('d=2026-06-04&n=15&f=non&c=1&w=1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('francSeulement')
  })

  it('`f=ne-sais-pas` l’est aussi : la page ne pose pas la question', async () => {
    expect((await GET(req('d=2026-06-04&n=15&f=ne-sais-pas&c=1&w=1'))).status).toBe(400)
  })

  it('`f=oui` explicite passe — c’est ce que le permalien émis porte', async () => {
    expect((await GET(req('d=2026-06-04&n=15&f=oui&c=1&w=1'))).status).toBe(200)
  })

  /**
   * `src` — la « nature du délai » du § 4.12 — est un texte libre REPRODUIT dans le résultat
   * et à l'impression. La page publique ne le demande pas ; le laisser passer offrirait à qui
   * fabrique une adresse une phrase de son choix, affichée sur une page de Lam comme si
   * l'outil l'avait qualifiée.
   */
  it('une « nature du délai » fabriquée dans l’URL est refusée, pas reproduite', async () => {
    const res = await GET(req('d=2026-06-04&n=15&c=1&w=1&src=Votre%20compte%20est%20suspendu'))
    expect(res.status).toBe(400)
    expect(await res.text()).not.toContain('suspendu')
  })
})

// ===========================================================================
// LE CALCUL PUBLIC : DEUX PARAMÈTRES
// ===========================================================================

describe('le calcul public — la date de réception et le nombre de jours francs', () => {
  /**
   * ═════════════════════════════════════════════════════════════════════════════
   * LE CALCUL PUBLIC EST FRANC **ET PROROGÉ** (Me Vaval, 20 août 2026)
   * ═════════════════════════════════════════════════════════════════════════════
   *
   * ⚠️ **DEUX DÉCISIONS LE MÊME JOUR, ET C'EST LA SECONDE QUI VAUT.** Le matin : « Les délais
   * pouvant être prorogés n'ont aucune incidence sur le calculateur public » — départ + N + 1,
   * rien d'autre. L'après-midi, **après avoir vu la date tomber un dimanche** : « Attention, la
   * date limite est tombée un dimanche, il faut la proroger au prochain jour ouvrable, donc le
   * lundi 6 juillet. » C. pr. civ., art. 991 al. 3 lui donne raison.
   *
   * Le cas d'espèce qu'elle a essayé : 4 juin 2026 + 30 jours francs → échéance dimanche
   * 5 juillet 2026, **reportée au lundi 6 juillet**. Ce que la réponse ne porte plus, en
   * revanche : la lecture nommée « PROROGATION_991 » et sa « lecture la plus large », le bloc
   * « dernier jour praticable », et tout avertissement autre que A3.
   */
  it('§ art. 991 — 4 juin 2026 + 30 jours francs : le report rend le lundi 6 juillet', async () => {
    const r = (await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()).resultat
    expect(r.statut).toBe('CALCUL')
    // Départ + N + 1 pose l'échéance au dimanche 5 juillet…
    expect(r.dernierJourCompte).toEqual({ y: 2026, m: 7, d: 4 })
    expect(r.echeance).toEqual({ y: 2026, m: 7, d: 5 })
    // … et l'art. 991 la proroge au lundi 6.
    expect(r.teteAffiche).toEqual({ y: 2026, m: 7, d: 6 })
  })

  /**
   * ⚠️ **LA LIGNE QUI DIT POURQUOI LA DATE A BOUGÉ**, sérialisée par la route comme la page
   * l'écrit : sans elle, l'API rendrait une date reportée sans un mot, et la page non.
   */
  it('le REPORT est dans la réponse : le jour franchi, son motif, la date d’arrivée', async () => {
    const corps = await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()
    expect(corps.report.arrivee).toEqual({ y: 2026, m: 7, d: 6 })
    expect(corps.report.source).toContain('art. 991')
    expect(corps.report.jours).toHaveLength(1)
    expect(corps.report.jours[0].date).toEqual({ y: 2026, m: 7, d: 5 })
    expect(corps.report.jours[0].mentions.map((m: { genre: string }) => m.genre)).toEqual([
      'DIMANCHE',
    ])
  })

  it('… et il vaut `null` quand la date n’a pas bougé', async () => {
    const corps = await (await GET(req('d=2026-06-04&n=15&c=1&w=1'))).json()
    expect(corps.resultat.teteAffiche).toEqual({ y: 2026, m: 6, d: 20 }) // samedi, intact
    expect(corps.report).toBeNull()
  })

  it('LA CASCADE : 1er octobre 2025 + 30 jours francs → lundi 3 novembre 2025', async () => {
    const corps = await (await GET(req('d=2025-10-01&n=30&c=1&w=1'))).json()
    expect(corps.resultat.echeance).toEqual({ y: 2025, m: 11, d: 1 }) // samedi — La Toussaint
    expect(corps.resultat.teteAffiche).toEqual({ y: 2025, m: 11, d: 3 })
    expect(corps.report.jours.map((j: { date: unknown }) => j.date)).toEqual([
      { y: 2025, m: 11, d: 1 },
      { y: 2025, m: 11, d: 2 },
    ])
    // ⚠️ La Toussaint est au calendrier sur instruction de la RÉDACTION : la mention le dit,
    // et c'est la contrepartie du report accordé sur un fondement non textuel.
    expect(corps.report.jours[0].mentions.map((m: { genre: string }) => m.genre)).toEqual([
      'REDACTION',
    ])
  })

  it('AUCUNE lecture nommée, aucune réserve, aucune « lecture la plus large »', async () => {
    const r = (await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()).resultat
    expect(r.lectures).toEqual([])
    expect(r.lectureLaPlusLarge).toEqual(r.teteAffiche)
    // La prorogation n'est pas « incertaine » : elle est ACQUISE sur l'entrée publique, et la
    // tête d'affiche proroge largement et en cascade.
    expect(r.entree.prorogation991).toBe('OUI')
    expect(r.entree.prorogationTeteLarge).toBe(true)
    // Le jour franchi, lui, est bien là : c'est de lui que la ligne du report est tirée.
    expect(r.joursEcartes).toHaveLength(1)
  })

  it('AUCUN bloc « jour praticable » : pas de seconde date, plus précoce', async () => {
    const r = (await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()).resultat
    expect(r.praticable.necessaire).toBe(false)
    expect(r.praticable.joursEmpeches).toEqual([])
    expect(r.praticable.texte).toBe('')
    expect(r.praticable.dernierJourPraticable).toEqual(r.teteAffiche)
    expect(r.praticable.dernierJourPraticableCertain).toEqual(r.teteAffiche)
  })

  /** A1 annonce une prorogation par arrêté ; A6 nomme une date de report. Ni l'un ni l'autre. */
  it('A3 SEUL : aucun avertissement n’annonce un report que ce calcul ne fait pas', async () => {
    const r = (await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()).resultat
    expect(r.avertissements.map((a: { cle: string }) => a.cle)).toEqual(['A3'])
  })

  /**
   * Le 7 janvier 2026 + 30 jours francs tombe le samedi 7 février — un jour À SURVEILLER, qui
   * ne proroge PAS (§ 4.13) et déclenche A6 avec sa date conditionnelle. Le contrôle porte sur
   * un cas où le moteur produit bien A6, et vérifie du même coup que la date ne bouge pas.
   */
  it('… même quand la tête d’affiche tombe un jour à surveiller : pas de A6', async () => {
    const corps = await (await GET(req('d=2026-01-07&n=30&c=1&w=1'))).json()
    const r = corps.resultat
    expect(r.statut).toBe('CALCUL')
    // Un jour à surveiller ne déplace RIEN : la date reste le samedi 7 février.
    expect(r.teteAffiche).toEqual({ y: 2026, m: 2, d: 7 })
    expect(corps.report).toBeNull()
    expect(r.avertissements.map((a: { cle: string }) => a.cle)).toEqual(['A3'])
    expect(JSON.stringify(r)).not.toContain('jour à surveiller')
    // Il garde en revanche sa MENTION en petits caractères (§ 4.13, point 4).
    expect(corps.mentionsJour.map((m: { genre: string }) => m.genre)).toEqual(['A_SURVEILLER'])
  })

  /**
   * ═════════════════════════════════════════════════════════════════════════════
   * § 4.10 — ⚠️ **LE LUNDI GRAS, PAR LA ROUTE.**
   * ═════════════════════════════════════════════════════════════════════════════
   *
   * Relecture par mutation du 20 août 2026 : `matineeOuvrable` (`lecture-publique.ts`, la
   * dérivation `!regles.demiJournee`) forcée à `false` **ou** à `true` laissait la suite
   * entière verte — aucun des 113 fichiers ne traversait la ligne. L'écran est désormais
   * gardé par `DelaiDatePublique.rendu.test.tsx` ; **la ROUTE l'est ici** : c'est elle qui
   * sert le genre au format JSON, et un client tiers n'a que ce champ pour savoir que la
   * fenêtre se ferme à midi.
   *
   * ⚠️ Ce cas exige le calendrier COURANT : la mention cite le décret du 11 décembre 2024, et
   * `estDemiJourneeOuvrable` ne l'ouvre que sur les entrées qu'il institue.
   */
  it('§ 4.10 — la tête d’affiche tombe un Lundi Gras : le genre servi est DEMI_JOURNEE', async () => {
    prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_COURANT)
    prisma.delaiFerie.findFirst.mockResolvedValue({
      versionCalendrier: VERSION_CALENDRIER_COURANTE,
    })
    // 30 janvier 2027 + 8 jours francs = lundi 8 février 2027, Lundi Gras.
    const corps = await (
      await GET(req(`d=2027-01-30&n=8&c=${VERSION_CALENDRIER_COURANTE}&w=1`))
    ).json()
    expect(corps.resultat.statut).toBe('CALCUL')
    // La matinée reste ouvrable : la date s'ARRÊTE sur le jour, elle n'est pas prorogée.
    expect(corps.resultat.teteAffiche).toEqual({ y: 2027, m: 2, d: 8 })
    expect(corps.report).toBeNull()
    expect(corps.mentionsJour.map((m: { genre: string }) => m.genre)).toEqual(['DEMI_JOURNEE'])
    expect(corps.mentionsJour[0].nom).toBe('Lundi Gras')
  })

  /**
   * L'autre sens de la même dérivation : sous `rl=1`, la demi-journée compte pour un jour
   * plein — elle proroge, la tête d'affiche quitte le Lundi Gras, et le genre servi est
   * celui d'une fête légale ordinaire, dans les jours FRANCHIS.
   */
  it('… et sous `rl=1`, le même jour proroge et redevient une fête légale', async () => {
    prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_COURANT)
    prisma.delaiFerie.findFirst.mockResolvedValue({
      versionCalendrier: VERSION_CALENDRIER_COURANTE,
    })
    const corps = await (
      await GET(req(`d=2027-01-30&n=8&c=${VERSION_CALENDRIER_COURANTE}&w=1&rl=1`))
    ).json()
    expect(corps.resultat.statut).toBe('CALCUL')
    expect(corps.resultat.teteAffiche).not.toEqual({ y: 2027, m: 2, d: 8 })
    expect(corps.mentionsJour.map((m: { genre: string }) => m.genre)).not.toContain('DEMI_JOURNEE')
    const franchis = (corps.report.jours as { mentions: { genre: string }[] }[]).flatMap((j) =>
      j.mentions.map((m) => m.genre),
    )
    expect(franchis).toContain('FETE_LEGALE')
    expect(franchis).not.toContain('DEMI_JOURNEE')
  })

  /** La phrase de sécurité renvoyait à « l’une des lectures ci-dessous » : il n’y en a plus. */
  it('la phrase de sécurité ne renvoie plus à des lectures qui n’existent pas', async () => {
    const r = (await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()).resultat
    expect(r.phraseSecurite).toContain('Le délai franc que vous avez indiqué expire le')
    expect(r.phraseSecurite).not.toContain('lectures ci-dessous')
  })

  /**
   * ⚠️ **LE RAISONNEMENT RESTE DÛ.** « Elle obtient la date, ET le raisonnement qui la
   * fonde » : la tête d'affiche tombe un dimanche, et la réponse doit dire pourquoi la date
   * ne bouge pas — sans nommer aucune autre date.
   */
  it('… mais le raisonnement, lui, est entier, du dimanche jusqu’au lundi', async () => {
    const r = (await (await GET(req('d=2026-06-04&n=30&c=1&w=1'))).json()).resultat
    const textes = (r.etapes as { texte: string }[]).map((e) => e.texte).join(' ')
    expect(textes).toContain('dimanche 5 juillet 2026')
    expect(textes).toContain('art. 991')
    expect(textes).toContain('lundi 6 juillet 2026')
    expect(textes).not.toContain('lecture nommée')
    // ⚠️ La phrase du matin (« sans y appliquer aucun report ») serait une seconde vérité
    // sous une date reportée : `affichage.ts` recopie ces étapes au presse-papiers.
    expect(textes).not.toContain('aucun report')
    const finale = r.etapes[r.etapes.length - 1].texte as string
    expect(finale).toContain('aucune autre prorogation')
  })

  it('4 juin 2026, 15 jours francs → samedi 20 juin 2026, sans qu’aucun `e` soit émis', async () => {
    const res = await GET(req('d=2026-06-04&n=15&c=1&w=1'))
    expect(res.status).toBe(200)
    const corps = await res.json()
    expect(corps.resultat.statut).toBe('CALCUL')
    // Franc : départ + 15 + 1 = 20 juin 2026 (samedi), qui n'est pas prorogé.
    expect(corps.resultat.teteAffiche).toEqual({ y: 2026, m: 6, d: 20 })
    expect(prisma.delaiEntry.findUnique).not.toHaveBeenCalled()
  })

  it('la NATURE du délai n’est pas demandée : deux champs, pas trois', async () => {
    const corps = await (await GET(req('d=2026-06-04&n=15&c=1&w=1'))).json()
    expect(corps.entree.objetFr).toBe('Délai indiqué dans l’acte')
    // Et le point de départ suit la surface : on calcule sur un acte REÇU.
    expect(corps.entree.pointDepartFr).toBe('Date de réception de l’acte')
    // Le fondement ne cite pas une caractérisation que personne n’a donnée.
    expect(corps.resultat.statut).toBe('CALCUL')
  })

  it('sans nombre de jours, le calcul est refusé et le dit', async () => {
    const res = await GET(req('d=2026-06-04&c=1&w=1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('autreIncomplet')
  })

  /**
   * ⚠️ **`rl` MANQUAIT À CETTE ATTENTE, ET ELLE PASSAIT QUAND MÊME** (défaut 7 de la troisième
   * recette) : `toContain` ne contrôle qu'un fragment, et la version des règles de lecture se
   * range entre `w` et `n`. Un test qui ignore une coordonnée du permalien ne garde pas le
   * § 6.3 — « il porte TOUT ce dont le calcul dépend ». La chaîne est donc vérifiée ENTIÈRE,
   * signature comprise.
   */
  it('rend un permalien SIGNÉ, dans l’ordre canonique, sans `src`', async () => {
    const permalien = (await (await GET(req('d=2026-06-04&n=15&c=1&w=1'))).json()).permalien as string
    expect(permalien).toContain(
      `/fr/delais?d=2026-06-04&e=autre&c=1&w=1&rl=${VERSION_REGLES_COURANTE}&n=15&f=oui`,
    )
    expect(permalien).not.toContain('src=')
    expect(permalien).toMatch(
      new RegExp(`^/fr/delais\\?d=2026-06-04&e=autre&c=1&w=1&rl=${VERSION_REGLES_COURANTE}&n=15&f=oui&sig=[A-Za-z0-9_-]{16}$`),
    )
  })

  /**
   * ⚠️ **LES TROIS VERSIONS SONT DANS LA RÉPONSE — défaut 9 de la troisième recette.** La route
   * sérialisait `versionCalendrier` et `versionFenetres`, et PAS `versionRegles` : le champ
   * valait `undefined` dans le corps JSON. C'était la « seconde vérité » que l'en-tête de cette
   * route s'interdit, et cela vidait `rl` de son sens — « un calcul cité doit dire sous quelle
   * règle il a été fait ». Un intégrateur ne pouvait pas savoir sous quelle lecture la date lui
   * était rendue ; il pouvait seulement la lire dans le permalien, s'il le relisait.
   */
  it('§ 4.6 — les TROIS versions sont sérialisées, pas deux', async () => {
    const corps = await (await GET(req('d=2026-06-04&n=15&c=1&w=1'))).json()
    expect(corps.versionCalendrier).toBe(1)
    expect(corps.versionFenetres).toBe(1)
    expect(corps.versionRegles).toBe(VERSION_REGLES_COURANTE)
    expect(Object.keys(corps)).toContain('versionRegles')
    // ⚠️ Et elle suit la coordonnée demandée, elle n'est pas une constante recopiée : sous
    // `rl=1`, la réponse le DIT, et la date change (2030-01-01 au lieu de 2030-01-03).
    const v1 = await (await GET(req('d=2029-12-01&n=30&c=1&w=1&rl=1'))).json()
    expect(v1.versionRegles).toBe(1)
    expect(v1.resultat.teteAffiche).toEqual({ y: 2030, m: 1, d: 1 })
    const v2 = await (await GET(req('d=2029-12-01&n=30&c=1&w=1&rl=2'))).json()
    expect(v2.versionRegles).toBe(2)
    expect(v2.resultat.teteAffiche).toEqual({ y: 2030, m: 1, d: 3 })
  })

  it('bloc 12 — rechargé, le permalien rend un corps IDENTIQUE', async () => {
    const q = 'd=2026-06-04&e=autre&c=1&w=1&n=15&f=oui'
    const un = await (await GET(req(q))).text()
    const deux = await (await GET(req(q))).text()
    expect(deux).toBe(un)
  })

  /**
   * ⚠️ **LA « SECONDE VÉRITÉ » QUE CE DÉCOUPAGE EXISTE POUR EMPÊCHER.** `calculPublic()`
   * calcule bien l'avertissement du § 6.2 (« date de départ à plus de dix ans »), et la page
   * `/fr/delais` l'affiche — mais la route le CALCULAIT PUIS LE JETAIT : le champ ne figurait
   * pas au corps JSON. `?d=2050-01-01&n=15` avertissait à l'écran et n'avertissait pas par
   * l'API. Le motif invoqué — « il dépend du jour où l'on regarde » — est faux depuis que
   * `ANNEE_DE_REFERENCE` est une constante GELÉE, précisément pour que le permalien rende un
   * résultat identique au caractère près.
   */
  it('§ 6.2 — l’avertissement « à plus de dix ans » est DANS la réponse', async () => {
    const corps = await (await GET(req('d=2050-01-01&n=15&c=1&w=1'))).json()
    expect(corps.resultat.statut).toBe('CALCUL')
    expect(corps.avertissementsSaisie).toContain('farFuture')
  })

  it('à dix ans ou moins, la liste est vide — jamais absente', async () => {
    const corps = await (await GET(req('d=2030-06-04&n=15&c=1&w=1'))).json()
    expect(corps.avertissementsSaisie).toEqual([])
  })

  /**
   * ⚠️ **LA NATURE DU DÉLAI N'EST PAS UN ARTICLE.** `entreeAutre()` posait `article: nature` :
   * publiquement, où le champ « nature » n'existe plus, `article` valait donc la PHRASE
   * « Délai indiqué dans l'acte », et tout gabarit « art. {numéro} » la recopiait entière —
   * en-tête du résultat, raisonnement, requête corpus. Le genre « Autre » N'A PAS d'article.
   */
  it('§ 4.12 — l’entrée « Autre » n’a AUCUN article, et n’emprunte pas la nature', async () => {
    const corps = await (await GET(req('d=2026-06-04&n=15&c=1&w=1'))).json()
    expect(corps.entree.article).toBe('')
    expect(corps.entree.objetFr).toBe('Délai indiqué dans l’acte')
    const texte = JSON.stringify(corps)
    expect(texte).not.toContain('art. Délai indiqué')
    expect(texte).not.toContain('article Délai indiqué')
  })

  it('n’écrit RIEN : ni journal, ni ligne, ni mise à jour', async () => {
    await GET(req('d=2026-06-04&n=15&c=1&w=1'))
    expect(audit).not.toHaveBeenCalled()
    expect(prisma.delaiEntry.create).not.toHaveBeenCalled()
    expect(prisma.delaiEntry.update).not.toHaveBeenCalled()
    expect(prisma.auditLog.create).not.toHaveBeenCalled()
  })
})

describe('la validation des paramètres', () => {
  it('une date impossible est refusée, jamais rattrapée au 1er mars', async () => {
    const res = await GET(req('d=2026-02-31&n=15'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('dateImpossible')
  })

  it('une date hors format, un slug hors forme : 400', async () => {
    expect((await GET(req('d=04/06/2026&n=15'))).status).toBe(400)
    expect((await GET(req('d=2026-06-04&e=Cpc_354'))).status).toBe(400)
  })

  it('un kilométrage non entier est refusé — la distance ne s’arrondit jamais', async () => {
    const res = await GET(req('d=2026-06-04&n=15&km=26.7'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('kilometrageInvalide')
  })

  /**
   * Un kilométrage SURNUMÉRAIRE est refusé, jamais abandonné en silence : sur un permalien
   * recopié ou tronqué, une distance disparaîtrait sans que rien ne le dise.
   */
  it('plus de kilométrages que le délai n’en mesure : REFUS', async () => {
    const res = await GET(req('d=2026-06-04&n=15&km=12,5&c=1&w=1'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('kilometrageInvalide')
  })
})

describe('les versions inconnues', () => {
  it('version de calendrier inconnue : 404, pas le calendrier courant', async () => {
    prisma.delaiFerie.findMany.mockResolvedValue([])
    const res = await GET(req('d=2026-06-04&n=15&c=99&w=1'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('versionCalendrierInconnue')
  })

  it('version de fenêtres inconnue : 404', async () => {
    prisma.delaiFenetreSignification.findMany.mockResolvedValue([])
    const res = await GET(req('d=2026-06-04&n=15&c=1&w=99'))
    expect(res.status).toBe(404)
    expect((await res.json()).error).toBe('versionFenetresInconnue')
  })

  it('base non initialisée : 503 explicite, jamais un 500 muet', async () => {
    prisma.delaiFerie.findFirst.mockResolvedValue(null)
    prisma.delaiFenetreSignification.findFirst.mockResolvedValue(null)
    const res = await GET(req('d=2026-06-04&n=15'))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('delaisNonInitialises')
  })

  it('tables non migrées : 503 `delaisSchemaAbsent`', async () => {
    prisma.delaiFerie.findMany.mockRejectedValue(Object.assign(new Error('no table'), { code: 'P2021' }))
    const res = await GET(req('d=2026-06-04&n=15&c=1&w=1'))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe('delaisSchemaAbsent')
  })
})

describe('le frein de débit', () => {
  it('borne l’extraction massive, par adresse, sans authentification', async () => {
    const ip = '203.0.113.7'
    let dernier = 200
    for (let i = 0; i < 95; i++) {
      dernier = (await GET(req('d=2026-06-04&n=15&c=1&w=1', ip))).status
    }
    expect(dernier).toBe(429)
  })
})

// ===========================================================================
// AUCUNE AUTRE ROUTE PUBLIQUE NE LAISSE FUIR LE RÉPERTOIRE
// ===========================================================================

/**
 * Fermer une porte pendant qu'une autre reste ouverte ne ferme rien. Ce test lit l'ARBRE des
 * routes publiques plutôt que d'énumérer à la main celles qu'on connaît : une route ajoutée
 * demain sous `api/public/` et qui toucherait au répertoire fera échouer ce fichier.
 */
describe('l’arborescence `api/public` ne touche plus au répertoire', () => {
  it('aucune route publique ne lit `delaiEntry` ni ne charge le répertoire', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const fichiers: string[] = []
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, e.name)
        if (e.isDirectory()) parcourir(chemin)
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) fichiers.push(chemin)
      }
    }
    parcourir('src/app/api/public')
    expect(fichiers.length).toBeGreaterThan(0)
    for (const f of fichiers) {
      const source = readFileSync(f, 'utf8')
      expect(source, f).not.toContain('chargerRepertoirePublic')
      expect(source, f).not.toContain('delaiEntry')
    }
  })

  /**
   * ⚠️ **LE RÉPERTOIRE N'A PLUS DE ROUTE DU TOUT.** Fermée puis déplacée sous
   * `/api/delais/repertoire`, elle n'avait AUCUN consommateur : `grep -rn "delais/repertoire"
   * src` ne rendait que la route, son test et des commentaires — les deux écrans appellent
   * `chargerRepertoirePublic()` en processus. Restait donc en ligne un point d'entrée
   * authentifié qui déversait les 393 entrées avec leurs fondements en un appel, à 30 appels
   * par minute et par compte (11 790 entrées la minute), et que rien n'exerçait en production.
   * Une surface que rien n'exerce est une surface dont la régression passe inaperçue.
   *
   * Ce test lit l'ARBRE : une route ajoutée demain n'importe où sous `src/app/api` et qui
   * chargerait le répertoire en bloc fera échouer ce fichier.
   */
  it('AUCUNE route, publique ou non, ne sert le répertoire en bloc', async () => {
    const { readdirSync, readFileSync, existsSync } = await import('node:fs')
    const { join } = await import('node:path')
    expect(existsSync('src/app/api/public/delais/repertoire')).toBe(false)
    expect(existsSync('src/app/api/delais/repertoire')).toBe(false)

    const fichiers: string[] = []
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, e.name)
        if (e.isDirectory()) parcourir(chemin)
        else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) fichiers.push(chemin)
      }
    }
    parcourir('src/app/api')
    expect(fichiers.length).toBeGreaterThan(0)
    for (const f of fichiers) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('chargerRepertoirePublic')
    }
  })
})
