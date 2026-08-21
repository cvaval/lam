/**
 * L'ENTRÉE SYNTHÉTIQUE DU GENRE « AUTRE » — ce que la plateforme écrit quand personne
 * n'a caractérisé le délai.
 *
 * Cette entrée n'a **pas de ligne en base** : ni libellé traduit, ni fondement, ni point de
 * départ ne peuvent venir d'ailleurs que du code. Deux défauts s'y sont logés, et aucun des
 * deux ne se voyait :
 *
 *  1. **UN CORRECTIF INERTE.** `corrigerFondementAutre()` écrivait `libelleFr` et
 *     `fondementFr` sur la lecture nommée `REGIME_FRANC`, alors que `LectureNommee` porte
 *     `libelle` et `fondement`. La substitution n'arrivait jamais : un délai lu dans une
 *     circulaire DGI se voyait opposer « C. trav., art. 511 », que l'art. 511 ne régit pas.
 *     `tsc --noEmit` ne l'a pas attrapé — le contrôle des propriétés excédentaires ne joue
 *     pas sur l'objet littéral d'un `.map` au type inféré ; et les deux champs morts
 *     partaient dans le JSON de la route.
 *
 *  2. **UN RÉSULTAT ANGLAIS AU RAISONNEMENT FRANÇAIS.** `entreeAutre()` était fabriquée sans
 *     locale. Tant que la surface publique calculait aussi le répertoire, cela ne touchait
 *     qu'un cas de bord ; depuis le 20 août 2026 elle ne calcule PLUS QUE cette entrée-ci —
 *     c'était donc la sortie normale de `/en` et de `/ht`.
 *
 * ⚠️ On passe par `calculPublic()`, et non par les fonctions internes : c'est le SEUL point
 * par lequel la route `/api/public/delais/calculer` et la page `/{locale}/delais` obtiennent
 * leur résultat. Le tester ailleurs laisserait passer une divergence entre les deux.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CALENDRIER_V1 } from './feries'

const prisma = {
  delaiEntry: { findMany: vi.fn(), findUnique: vi.fn() },
  delaiEntryRevision: { findUnique: vi.fn() },
  delaiFerie: { findMany: vi.fn(), findFirst: vi.fn() },
  delaiFenetreSignification: { findMany: vi.fn(), findFirst: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma }))

const { calculPublic, lireParamsCalcul } = await import('./lecture-publique')

const FENETRES = [
  { matiere: 'CIVILE', heureDebut: 6, heureFin: 18, source: 'C. pr. civ., art. 991', sourceDocId: null, nullite: false, nulliteTexteFr: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  prisma.delaiFerie.findMany.mockResolvedValue(CALENDRIER_V1)
  prisma.delaiFerie.findFirst.mockResolvedValue({ versionCalendrier: 1 })
  prisma.delaiFenetreSignification.findMany.mockResolvedValue(FENETRES)
  prisma.delaiFenetreSignification.findFirst.mockResolvedValue({ versionFenetres: 1 })
})

async function calcul(query: string, acces: 'public' | 'connecte') {
  const lu = lireParamsCalcul(new URLSearchParams(query))
  if (!lu.ok) throw new Error(`requête refusée : ${lu.code}`)
  const r = await calculPublic(lu.valeur, acces)
  if (!r.ok) throw new Error(`calcul refusé : ${r.code}`)
  return r
}

// ===========================================================================
// 1. LE CORRECTIF DE FONDEMENT — deux mots, et il ne s'appliquait pas
// ===========================================================================

/**
 * `f=ne-sais-pas` n'est plus proposé par aucun formulaire, mais le schéma l'accepte encore et
 * la plateforme s'engage à rejouer un permalien dix ans (§ 6.3). C'est là, et là seulement,
 * que le moteur ouvre la lecture nommée `REGIME_FRANC` — donc là que le fondement se substitue.
 */
describe('§ 4.12 — un délai « Autre » ne se voit pas opposer le Code du travail', () => {
  const REQUETE = 'd=2026-06-04&e=autre&n=30&f=ne-sais-pas&src=Circulaire%20DGI&locale=fr'

  it('LA SONDE : le moteur ouvre bien une lecture « REGIME_FRANC » sur un régime douteux', async () => {
    const r = await calcul(REQUETE, 'connecte')
    if (r.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    expect(r.resultat.lectures.map((l) => l.cle)).toContain('REGIME_FRANC')
  })

  it('le fondement substitué est LU par l’écran — `libelle`/`fondement`, pas `…Fr`', async () => {
    const r = await calcul(REQUETE, 'connecte')
    if (r.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    const lecture = r.resultat.lectures.find((l) => l.cle === 'REGIME_FRANC')!
    // Ce sont ces deux champs-là, et eux seuls, que `DelaiResult.tsx` affiche.
    expect(lecture.libelle).toBe('Si ce délai est un délai franc')
    expect(lecture.fondement).toMatch(/Vérifiez dans votre texte si ce délai est franc/)
  })

  it('… et il ne cite plus l’art. 511 du Code du travail, qui ne régit pas une circulaire DGI', async () => {
    const r = await calcul(REQUETE, 'connecte')
    if (r.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    const lecture = r.resultat.lectures.find((l) => l.cle === 'REGIME_FRANC')!
    expect(lecture.fondement).not.toContain('C. trav., art. 511')
    expect(lecture.libelle).not.toContain('délai de procédure')
  })

  /**
   * ⚠️ Les deux clés mortes partaient dans le JSON de la route. Elles n'y sont plus, et
   * l'annotation `: LectureNommee` du `.map` empêche désormais d'en réintroduire.
   */
  it('aucune clé `libelleFr` / `fondementFr` ne survit dans la réponse', async () => {
    const r = await calcul(REQUETE, 'connecte')
    const json = JSON.stringify(r)
    expect(json).not.toContain('libelleFr')
    expect(json).not.toContain('fondementFr')
  })

  /**
   * La substitution ne vise QUE `REGIME_FRANC` : les autres lectures gardent leur fondement.
   *
   * ⚠️ **CETTE BOUCLE POUVAIT DEVENIR VIDE, ET ELLE SERAIT PASSÉE AU VERT EN LE DEVENANT.**
   * Il n'y a qu'UNE autre lecture sur ce cas (`CUMUL`, mesurée le 20 août 2026) : le jour où
   * elle cesserait d'être ouverte, ce contrôle n'examinerait plus rien et continuerait
   * d'affirmer que « les autres lectures ne sont pas touchées ». Un test qui ne retient rien
   * est pire qu'un test absent. On NOMME donc ce qu'on attend, au lieu de parcourir un
   * ensemble dont la taille n'est garantie par rien.
   */
  it('les autres lectures nommées ne sont pas touchées', async () => {
    const r = await calcul(REQUETE, 'connecte')
    if (r.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    const autres = r.resultat.lectures.filter((l) => l.cle !== 'REGIME_FRANC')
    expect(autres.map((l) => l.cle)).toEqual(['CUMUL'])
    for (const l of autres) {
      expect(l.libelle.length, l.cle).toBeGreaterThan(0)
      expect(l.fondement.length, l.cle).toBeGreaterThan(0)
    }
  })
})

// ===========================================================================
// 2. LES TROIS LANGUES — un résultat anglais ne raisonne pas en français
// ===========================================================================

/**
 * ⚠️ **CE QUI RESTE EN FRANÇAIS DE PLEIN DROIT, ET QUE CE TEST NE DOIT PAS INTERDIRE** : les
 * références d'articles (« C. pr. civ., art. 991 al. 3 »), qui sont des citations, et la
 * « nature du délai » que l'utilisatrice tape elle-même. On ne balaie donc pas « tout mot
 * français » : on énumère les chaînes que la plateforme ÉCRIT, et on vérifie que chacune est
 * celle de la langue demandée.
 */
const EMPREINTES = {
  fr: {
    codeLibelle: 'Délai saisi (hors répertoire)',
    nature: 'Délai indiqué dans l’acte',
    duree: '30 jours (saisis)',
    fondement: 'La plateforme ne qualifie pas ce délai',
    provenance: 'Nombre de jours saisi par l’utilisatrice',
    pointDepart: 'Date de réception de l’acte',
    prorogation: 'Le report est répété jusqu’au premier jour',
  },
  en: {
    codeLibelle: 'Period entered (outside the directory)',
    nature: 'Period stated in the document',
    duree: '30 days (entered)',
    fondement: 'The platform does not characterise this period',
    provenance: 'Number of days entered by the user',
    pointDepart: 'Date the document was received',
    prorogation: 'The extension is repeated until the first day',
  },
  ht: {
    codeLibelle: 'Delè yo antre (deyò repètwa a)',
    nature: 'Delè dokiman an endike',
    duree: '30 jou (yo antre)',
    fondement: 'Platfòm nan pa kalifye delè sa a',
    provenance: 'Kantite jou itilizatè a antre',
    pointDepart: 'Dat yo resevwa dokiman an',
    prorogation: 'Ranvwa a repete jouk premye jou',
  },
} as const

const LOCALES = ['fr', 'en', 'ht'] as const

describe('§ 8.2 — le résultat public est ENTIER dans la langue demandée', () => {
  /**
   * Le 31 mars 2026 + 30 jours francs pose l'échéance au 1er mai — un jour du calendrier,
   * que le report franchit jusqu'au samedi 2 mai. Le raisonnement y est donc à son plus
   * long : il porte une étape de prorogation ET reproduit le fondement, ce qui était le
   * passage le plus visiblement français sur `/en`.
   */
  const REQUETE = (l: string) => `d=2026-03-31&n=30&locale=${l}`

  for (const locale of LOCALES) {
    it(`${locale} : l’entrée synthétique est écrite en ${locale}`, async () => {
      const r = await calcul(REQUETE(locale), 'public')
      const x = EMPREINTES[locale]
      expect(r.entree.codeLibelle).toBe(x.codeLibelle)
      expect(r.entree.objetFr).toBe(x.nature)
      expect(r.entree.dureeTexte).toBe(x.duree)
      expect(r.entree.pointDepartFr).toBe(x.pointDepart)
    })

    it(`${locale} : le RAISONNEMENT ne recopie aucune phrase d’une autre langue`, async () => {
      const r = await calcul(REQUETE(locale), 'public')
      if (r.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
      // Tout ce que la personne lit : les étapes, l'en-tête de l'entrée, les avertissements.
      const rendu = JSON.stringify({ entree: r.entree, resultat: r.resultat })
      for (const autre of LOCALES) {
        for (const [champ, phrase] of Object.entries(EMPREINTES[autre])) {
          if (autre === locale) expect(rendu, `${locale}/${champ}`).toContain(phrase)
          else expect(rendu, `${locale} contient du ${autre} — ${champ}`).not.toContain(phrase)
        }
      }
    })
  }

  /**
   * La tête d'affiche ne dépend PAS de la langue : c'est la même date, le même nombre
   * d'étapes, le même avertissement. Seuls les mots changent.
   */
  it('la langue ne déplace ni la date, ni la structure du raisonnement', async () => {
    const [fr, en, ht] = await Promise.all(LOCALES.map((l) => calcul(REQUETE(l), 'public')))
    if (fr.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
    for (const r of [en, ht]) {
      if (r.resultat.statut !== 'CALCUL') throw new Error('attendu CALCUL')
      expect(r.resultat.teteAffiche).toEqual(fr.resultat.teteAffiche)
      expect(r.resultat.etapes.map((e) => e.cle)).toEqual(fr.resultat.etapes.map((e) => e.cle))
      expect(r.resultat.avertissements.map((a) => a.cle)).toEqual(
        fr.resultat.avertissements.map((a) => a.cle),
      )
    }
    // ⚠️ Le 1er mai est une fête NATIONALE : depuis le report de l'art. 991 (20 août 2026,
    // seconde décision), la surface publique le franchit et rend le samedi 2 mai — un samedi,
    // qui ne proroge pas et où la cascade s'arrête.
    expect(fr.resultat.teteAffiche).toEqual({ y: 2026, m: 5, d: 2 })
  })
})

// ===========================================================================
// 3. LES FENÊTRES DE SIGNIFICATION — hors de la surface publique
// ===========================================================================

/**
 * ⚠️ **MÊME MOTIF QUE LE JOUR PRATICABLE, DÉCISION OPPOSÉE — jusqu'ici.** « De 6 h à 18 h ·
 * C. pr. civ., art. 991 » suppose que l'acte EST une signification : exactement la
 * qualification invoquée pour retirer le bloc « jour praticable » de la surface publique
 * (`franc-pur.ts` : « il suppose une qualification — signification, exécution — que la surface
 * publique ne demande plus »). Le même raisonnement, le même écran, deux décisions.
 *
 * ⚠️ **La coupe est ICI, pas dans l'écran.** Masquer le bloc côté rendu aurait laissé
 * `/api/public/delais/calculer` servir les fenêtres : la route et la page doivent voir le
 * même objet. `versionFenetres`, elle, reste rendue — c'est le `w` du permalien.
 */
describe('la route publique ne rend plus les fenêtres de signification', () => {
  it('LA SONDE : le portail, lui, les rend toujours', async () => {
    const r = await calcul('d=2026-03-31&e=autre&n=30&f=oui&src=Test&locale=fr', 'connecte')
    expect(r.fenetres.map((f) => f.matiere)).toEqual(['CIVILE'])
    expect(r.fenetres[0].source).toBe('C. pr. civ., art. 991')
  })

  it('publiquement : aucune fenêtre, dans aucune des trois langues', async () => {
    for (const l of LOCALES) {
      const r = await calcul(`d=2026-03-31&n=30&locale=${l}`, 'public')
      expect(r.fenetres, l).toEqual([])
      // L'art. 991 ne doit plus apparaître QUE dans le raisonnement, jamais dans une donnée
      // de procédure que la page n'a pas qualifiée.
      expect(JSON.stringify(r.fenetres), l).not.toContain('991')
    }
  })

  it('… mais la VERSION des fenêtres reste rendue : c’est le `w` du permalien', async () => {
    const r = await calcul('d=2026-03-31&n=30&locale=fr', 'public')
    expect(r.versionFenetres).toBe(1)
    expect(r.permalien).toContain('w=1')
  })
})
