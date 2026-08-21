/**
 * CE QUE L'ÉCRAN MONTRE, ET CE QUE LE PRESSE-PAPIERS EMPORTE.
 *
 * Le défaut visé n'est pas un défaut de calcul : c'est une CITATION FAUSSE. L'art. 987 agrafé
 * sous un délai du Code du travail, ou une date copiée sans ses réserves, produit une écriture
 * qui a l'air fondée et qui ne l'est pas.
 */
import { describe, expect, it } from 'vitest'
import { CALENDRIER_V1 } from './feries'
import { REPERTOIRE, construireEntrees } from './repertoire'
import { calculer } from './index'
import { SLUG_AUTRE } from './permalien'
import { texteRaisonnement, textesAppliques } from './affichage'

const ENTREES = construireEntrees(REPERTOIRE)
const ART_354 = ENTREES.find((e) => e.slug === 'cpc-354-appel-parties-demeurant-haiti')!
const UNE_TRAVAIL = ENTREES.find((e) => e.code === 'TRAVAIL' && e.kind === 'JOURS')!
const UNE_CIVIL = ENTREES.find((e) => e.code === 'CIVIL' && e.kind === 'JOURS')!

describe('les textes appliqués — on ne cite QUE ce qui a servi', () => {
  it('procédure civile : art. 987 puis art. 991, puis l’article de l’entrée', () => {
    const out = textesAppliques(ART_354)
    expect(out.map((x) => x.reference)).toEqual([
      'C. pr. civ., art. 987',
      'C. pr. civ., art. 991',
      'C. pr. civ., art. 354',
    ])
    expect(out[0].texte).toContain('Tous les délais prévus au Code de procédure civile sont francs.')
    // Le lien profond a besoin du `Document.id` gelé, et de lui seul.
    expect(out[0].docId).toBeTruthy()
  })

  it('travail : art. 511 et 512 — JAMAIS l’art. 987, qui ne fonde pas ce Code', () => {
    const out = textesAppliques(UNE_TRAVAIL)
    const refs = out.map((x) => x.reference)
    expect(refs[0]).toBe('C. trav., art. 511')
    expect(refs[1]).toBe('C. trav., art. 512')
    expect(refs.join(' ')).not.toContain('987')
    expect(refs.join(' ')).not.toContain('991')
  })

  it('civil : ni 987 ni 511 — le Code civil n’a AUCUNE règle générale de computation', () => {
    const refs = textesAppliques(UNE_CIVIL).map((x) => x.reference)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toContain('C. civ., art.')
  })

  it('l’article de l’entrée montre sa DURÉE telle qu’écrite, jamais une citation reconstituée', () => {
    const dernier = textesAppliques(ART_354).at(-1)!
    expect(dernier.texte).toContain(ART_354.dureeTexte)
    expect(dernier.source).toContain('répertoire')
  })
})

describe('le raisonnement copié — opposable tel quel, jamais la date seule', () => {
  const resultat = calculer({
    depart: { y: 2026, m: 6, d: 4 },
    entree: ART_354,
    km: [],
    versionCalendrier: 1,
    entreesCalendrier: CALENDRIER_V1,
  })
  const texte = texteRaisonnement({
    resultat,
    entree: ART_354,
    permalien: '/fr/delais?d=2026-06-04&e=cpc-354-appel-parties-demeurant-haiti&r=1&c=1&w=1',
    origine: 'https://lam.ht',
    versionCalendrier: 1,
    versionFenetres: 1,
    revision: 1,
  })

  it('porte la date, les étapes, les jours écartés, les lectures, les textes, les avis', () => {
    expect(texte).toContain('DATE LIMITE : lundi 6 juillet 2026 — 06/07/2026')
    expect(texte).toContain('LE RAISONNEMENT, PAS À PAS')
    expect(texte).toContain('JOURS ÉCARTÉS')
    expect(texte).toContain('LECTURES CONCURRENTES DU TEXTE')
    expect(texte).toContain('TEXTES APPLIQUÉS')
    expect(texte).toContain('AVERTISSEMENTS')
  })

  it('porte le permalien ABSOLU : une citation sans son adresse n’est pas vérifiable', () => {
    expect(texte).toContain('https://lam.ht/fr/delais?d=2026-06-04')
  })

  it('porte les trois versions — sans elles, la citation ne se rejoue pas dans dix ans', () => {
    expect(texte).toContain('Calendrier des fêtes : version 1')
    expect(texte).toContain('Fenêtres de signification : version 1')
    expect(texte).toContain('révision 1')
  })

  it('n’horodate RIEN : le bloc 12 exige deux copies identiques au caractère près', () => {
    const bis = texteRaisonnement({
      resultat,
      entree: ART_354,
      permalien: '/fr/delais?d=2026-06-04&e=cpc-354-appel-parties-demeurant-haiti&r=1&c=1&w=1',
      origine: 'https://lam.ht',
      versionCalendrier: 1,
      versionFenetres: 1,
      revision: 1,
    })
    expect(bis).toBe(texte)
  })

  it('est BEAUCOUP plus qu’une date : au moins vingt lignes', () => {
    expect(texte.split('\n').length).toBeGreaterThan(20)
  })
})

describe('un refus se copie AUSSI, et il ne porte aucune date', () => {
  const refusee = ENTREES.find((e) => e.kind === 'MOIS')!
  const resultat = calculer({
    depart: { y: 2026, m: 6, d: 4 },
    entree: refusee,
    versionCalendrier: 1,
    entreesCalendrier: CALENDRIER_V1,
  })

  it('le texte copié dit le refus et son motif, sans jamais nommer un jour', () => {
    const texte = texteRaisonnement({
      resultat,
      entree: refusee,
      permalien: '/fr/delais',
      origine: '',
      versionCalendrier: 1,
      versionFenetres: 1,
      revision: null,
    })
    expect(resultat.statut).toBe('REFUS')
    expect(texte).toContain('CET ARTICLE NE PERMET PAS DE CALCULER UNE DATE.')
    expect(texte).toContain('Motif :')
    // Un refus qui affiche une date — même une seule, même deux — n'est pas un refus.
    for (const jour of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
      expect(texte.toLowerCase()).not.toContain(jour)
    }
  })
})

// ===========================================================================
// § 7.3 — LES DEUX BANDEAUX PARTENT AVEC LE TEXTE COPIÉ
// ===========================================================================

/**
 * ⚠️ Le presse-papiers recevait la date, les étapes, les jours écartés, les réserves, les
 * textes, les avertissements et le permalien — mais **pas** « Cette entrée a été retirée du
 * répertoire le […] », ni « La règle a changé depuis ce calcul ». L'impression, elle, était
 * indemne (le bandeau n'a pas de classe `.no-print`) : le trou était propre à la copie.
 *
 * Le § 6.3 j pose que ce texte « doit être opposable tel quel » et que c'est « la citation que
 * l'avocate collera dans une écriture ». Une date calculée sous une règle retirée, collée
 * dans une écriture sans un mot sur son retrait, est le § 0 dans sa forme exacte.
 */
describe('§ 7.3 — le bandeau est DANS le presse-papiers', () => {
  const resultatCopie = calculer({
    depart: { y: 2026, m: 6, d: 4 },
    entree: ART_354,
    km: [],
    versionCalendrier: 1,
    entreesCalendrier: CALENDRIER_V1,
  })

  const commun = {
    resultat: resultatCopie,
    entree: ART_354,
    permalien: '/fr/delais?d=2026-06-04&e=cpc-354',
    origine: 'https://lam.ht',
    versionCalendrier: 1,
    versionFenetres: 1,
    revision: 3,
  }

  it('une entrée RETIRÉE : le retrait est écrit EN TÊTE, avant la date', () => {
    const texte = texteRaisonnement({
      ...commun,
      bandeau: {
        type: 'ENTREE_RETIREE',
        statutEntree: 'supprime',
        motif: 'Durée fausse : l’article n’en porte aucune.',
        retireeLe: '2026-09-01',
      },
    })
    expect(texte).toContain('CETTE ENTRÉE A ÉTÉ RETIRÉE DU RÉPERTOIRE')
    expect(texte).toContain('2026-09-01')
    expect(texte).toContain('Durée fausse')
    // EN TÊTE : avant la date limite, pas dans un pied de page.
    expect(texte.indexOf('RETIRÉE DU RÉPERTOIRE')).toBeLessThan(texte.indexOf('DATE LIMITE'))
  })

  it('une RÈGLE CHANGÉE : les deux révisions et la date du changement', () => {
    const texte = texteRaisonnement({
      ...commun,
      bandeau: {
        type: 'REGLE_CHANGEE',
        revisionDemandee: 3,
        revisionCourante: 5,
        changeeLe: '2026-09-12',
        hrefActuelle: '/fr/delais?r=5',
      },
    })
    expect(texte).toContain('LA RÈGLE A CHANGÉ DEPUIS CE CALCUL')
    expect(texte).toContain('révision 3 → révision courante 5')
    expect(texte).toContain('2026-09-12')
  })

  it('sans bandeau, le texte est inchangé — aucune mention parasite', () => {
    const texte = texteRaisonnement(commun)
    expect(texte).not.toContain('⚠')
    expect(texte.startsWith('C. pr. civ., art. 354')).toBe(true)
  })

  it('le texte copié se traduit, comme l’écran (§ 8.2)', () => {
    const en = texteRaisonnement({ ...commun, locale: 'en' })
    expect(en).toContain('DEADLINE')
    expect(en).toContain('THE REASONING, STEP BY STEP')
    expect(en).not.toContain('LE RAISONNEMENT')
  })
})

// ===========================================================================
// § 6.3 — « art. Art. 164 » : le préfixe recollé sur un article qui l'a déjà
// ===========================================================================

/**
 * ⚠️ 135 des 393 entrées portent déjà leur préfixe dans `article` — 37 du C. trav., 98 du
 * C. civ. Tous les gabarits d'affichage y recollaient « art. » : « Code du travail · art.
 * Art. 164 », « C. civ., art. Art. 229 (L. 5 mai 1949) », « Entrée : TRAVAIL art. Art. 164 ».
 * Le défaut suivait jusque dans le presse-papiers, donc dans l'écriture que l'avocate colle.
 */
describe('§ 6.3 — un seul « art. » devant un numéro d’article', () => {
  const AVEC_PREFIXE = { ...ART_354, code: 'TRAVAIL' as const, article: 'Art. 164' }

  it('la référence des textes appliqués ne double pas le préfixe', () => {
    const dernier = textesAppliques(AVEC_PREFIXE).at(-1)!
    expect(dernier.reference).toBe('C. trav., art. 164')
    expect(dernier.reference).not.toContain('art. Art.')
  })

  it('le presse-papiers non plus — ni en tête, ni au pied technique', () => {
    const texte = texteRaisonnement({
      resultat: calculer({
        depart: { y: 2026, m: 6, d: 4 },
        entree: AVEC_PREFIXE,
        versionCalendrier: 1,
        entreesCalendrier: CALENDRIER_V1,
      }),
      entree: AVEC_PREFIXE,
      permalien: '/fr/delais',
      origine: '',
      versionCalendrier: 1,
      versionFenetres: 1,
      revision: 1,
    })
    expect(texte).not.toContain('art. Art.')
    expect(texte).toContain('C. trav., art. 164')
    expect(texte).toContain('TRAVAIL art. 164, révision 1')
  })

  it('« Arts. 30–34 » garde son pluriel, « Jur. (art. 488) » reste intact', () => {
    expect(textesAppliques({ ...ART_354, article: 'Arts. 30–34' }).at(-1)!.reference).toBe(
      'C. pr. civ., art. 30–34',
    )
    expect(textesAppliques({ ...ART_354, article: 'Jur. (art. 488)' }).at(-1)!.reference).toBe(
      'C. pr. civ., art. Jur. (art. 488)',
    )
  })
})

// ===========================================================================
// § 4.12 — LE GENRE « AUTRE » N'EST PAS DU CODE CIVIL
// ===========================================================================

/**
 * ⚠️ `entreeAutre` pose `code: 'CIVIL'` et `article: <nature saisie>` — « l'attache la moins
 * affirmative » du point de vue du moteur. Composée par les gabarits d'affichage, elle
 * produisait trois affirmations fausses d'affilée : « **C. civ., art. Circulaire DGI** —
 * 15 jours (saisis) — **Durée telle qu'écrite au répertoire** », puis un renvoi vers un
 * article qui n'existe pas. Le délai n'est pas du Code civil, il n'est pas au répertoire, et
 * il n'y a pas d'article à ouvrir.
 */
describe('§ 4.12 — « Autre » n’emprunte aucune référence', () => {
  const AUTRE = {
    slug: SLUG_AUTRE,
    code: 'CIVIL' as const,
    article: 'Circulaire DGI',
    dureeTexte: '15 jours (saisis)',
    objetFr: 'Circulaire DGI',
  }

  it('aucune référence de code, aucune mention du répertoire, aucun lien corpus', () => {
    const out = textesAppliques(AUTRE)
    expect(out).toHaveLength(1)
    expect(out[0].reference).not.toContain('C. civ.')
    expect(out[0].reference).not.toContain('art.')
    // « Durée telle qu'écrite AU RÉPERTOIRE » est l'affirmation fausse : ce délai n'y est pas.
    expect(out[0].source).not.toContain('telle qu’écrite au répertoire')
    expect(out[0].source).toContain('ne vient d’aucune entrée du répertoire')
    expect(out[0].docId).toBeNull()
    expect(out[0].numeroArticle).toBeNull()
  })

  it('la nature saisie est REPRODUITE, telle qu’elle a été écrite (§ 4.12)', () => {
    expect(textesAppliques(AUTRE)[0].texte).toContain('Circulaire DGI')
    expect(textesAppliques(AUTRE)[0].texte).toContain('15 jours (saisis)')
  })

  it('le presse-papiers ne compose pas « C. civ., art. Circulaire DGI » non plus', () => {
    const texte = texteRaisonnement({
      resultat: calculer({
        depart: { y: 2026, m: 6, d: 4 },
        entree: { ...ART_354, ...AUTRE, jours: 15, kind: 'JOURS' },
        versionCalendrier: 1,
        entreesCalendrier: CALENDRIER_V1,
      }),
      entree: AUTRE,
      permalien: '/fr/delais',
      origine: '',
      versionCalendrier: 1,
      versionFenetres: 1,
      revision: null,
    })
    expect(texte).not.toContain('C. civ., art. Circulaire DGI')
    expect(texte).toContain('hors répertoire')
  })
})

/**
 * § 4.12, SUITE — **LE CAS PUBLIC : IL N'Y A PLUS DE NATURE SAISIE DU TOUT.**
 *
 * Depuis que la surface publique ne demande que deux champs, le genre « Autre » est la sortie
 * de 100 % des calculs publics et `src` y est toujours absent. `entreeAutre()` posait alors
 * `article: NATURE_PUBLIQUE` — la phrase « Délai indiqué dans l'acte » — et tout gabarit
 * d'article la recopiait : « art. Délai indiqué dans l'acte » en tête du résultat, dans le
 * raisonnement et dans la requête corpus. La nature vit désormais dans `objetFr`, et
 * `article` est VIDE : c'est cette forme-là que ces contrôles fixent.
 */
describe('§ 4.12 public — la nature n’est pas un article', () => {
  const PUBLIC = {
    slug: SLUG_AUTRE,
    code: 'CIVIL' as const,
    // ⚠️ VIDE : le genre « Autre » n'a pas d'article, et publiquement il n'a pas de nature
    // saisie non plus.
    article: '',
    objetFr: 'Délai indiqué dans l’acte',
    dureeTexte: '15 jours (saisis)',
  }

  it('le texte appliqué reproduit la NATURE, pas une chaîne vide', () => {
    const out = textesAppliques(PUBLIC)
    expect(out).toHaveLength(1)
    expect(out[0].texte).toContain('Délai indiqué dans l’acte')
    expect(out[0].texte).not.toContain('«  »')
    expect(out[0].reference).not.toContain('art.')
  })

  it('le presse-papiers n’écrit ni « art. », ni un intitulé vide', () => {
    const texte = texteRaisonnement({
      resultat: calculer({
        depart: { y: 2026, m: 6, d: 4 },
        entree: { ...ART_354, ...PUBLIC, jours: 15, kind: 'JOURS' },
        versionCalendrier: 1,
        entreesCalendrier: CALENDRIER_V1,
      }),
      entree: PUBLIC,
      permalien: '/fr/delais',
      origine: '',
      versionCalendrier: 1,
      versionFenetres: 1,
      revision: null,
    })
    expect(texte).toContain('Délai saisi (hors répertoire)')
    expect(texte).toContain('Délai indiqué dans l’acte')
    expect(texte).not.toContain('art. Délai indiqué')
    expect(texte).not.toContain('«  »')
    // L'étape « Délai : 15 jours francs (« 15 jours (saisis) ») » ne cite AUCUNE référence.
    expect(texte).not.toMatch(/\(« 15 jours \(saisis\) », /)
  })
})

// ===========================================================================
// § 6.3 g — LE TEXTE DE L'ARTICLE, CITÉ SUR PLACE
// ===========================================================================

describe('§ 6.3 g — `citationArticle` atteint enfin l’écran', () => {
  it('quand la plateforme détient le texte, elle le cite et le DIT', () => {
    const out = textesAppliques({
      ...ART_354,
      citationArticle: 'Le délai d’appel est de trente jours francs.',
    }).at(-1)!
    expect(out.texte).toContain('trente jours francs')
    expect(out.source).toContain('tel que lu au corpus')
    expect(out.source).not.toContain('se lit au corpus')
  })
})
