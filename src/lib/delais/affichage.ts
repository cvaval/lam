/**
 * § 6.3 — CE QUE L'ÉCRAN MONTRE DU CALCUL, en fonctions PURES.
 *
 * Deux choses vivent ici, et elles y vivent ensemble pour une raison : **le bloc « textes
 * appliqués » à l'écran et le texte que « Copier le raisonnement » met dans le
 * presse-papiers doivent dire la même chose**. C'est la citation que l'avocate collera dans
 * une écriture ; si l'écran et le presse-papiers divergeaient, la version opposable serait
 * celle que personne n'a relue.
 *
 * Aucun `Date`, aucun `Intl`, aucune E/S : ce fichier se teste sans base et sans navigateur,
 * et le composant serveur comme le bouton client en consomment le même produit.
 */
import type { CodeDelai } from './regimes'
import { ABREGE_CODE } from './regimes'
import type { Resultat } from './calcul'
import { numeroArticle } from './calcul'
import { SLUG_AUTRE } from './permalien'
import { TEXTES } from './textes'
import type { Locale } from './format'
import { dateComplete, dateEnToutesLettres } from './format'
import { phrasesAffichage } from './phrases-affichage'
import type { Bandeau } from './bandeau'

export type TexteApplique = {
  cle: string
  reference: string
  /** VERBATIM. Jamais traduit (§ 8.2 : `dureeTexte` et les citations d'articles ne le sont pas). */
  texte: string
  source: string
  /** `Document.id` en base — le lien profond n'existe que pour un utilisateur connecté. */
  docId: string | null
  /** `#art-987`, construit par `articleAnchorFromNum` côté écran. */
  numeroArticle: string | null
}

/**
 * § 6.3 g — les textes appliqués, cités INTÉGRALEMENT, dans l'ordre du gabarit : la règle de
 * computation de la matière, sa clause de prorogation, puis l'article de l'entrée choisie
 * avec sa durée telle qu'écrite.
 *
 * ⚠️ On ne cite QUE ce qui a effectivement servi. L'art. 987 sous un délai du Code du travail
 * serait une référence fausse : c'est l'art. 511 qui rend francs les délais de ce Code, et
 * l'art. 512 qui en interdit la signification les jours fériés. De même, le Code civil n'a
 * **aucune** règle générale de computation — n'y agrafer ni 987 ni 991 est le seul rendu
 * honnête, et le fondement du régime le dit déjà en toutes lettres.
 */
export function textesAppliques(
  entree: {
    slug?: string
    code: string
    article: string
    /**
     * La NATURE du délai, pour le seul genre « Autre » — jamais `article`, qui est vide sur
     * une entrée hors répertoire. Le repli sur `article` ne sert qu'aux appels historiques.
     */
    objetFr?: string
    dureeTexte: string
    dureeFondementFr?: string | null
    citationArticle?: string | null
  },
  locale: Locale = 'fr',
): TexteApplique[] {
  const p = phrasesAffichage(locale)
  const out: TexteApplique[] = []

  /**
   * § 4.12 — LE GENRE « AUTRE » N'A NI CODE, NI ARTICLE, NI LIGNE AU RÉPERTOIRE.
   *
   * `entreeAutre` pose `code: 'CIVIL'` et `article: <nature saisie>` — « l'attache la moins
   * affirmative » du point de vue du MOTEUR. Composée par ce gabarit-ci, elle produisait
   * pourtant trois affirmations fausses d'affilée : « **C. civ., art. Circulaire DGI** —
   * 15 jours (saisis) — **Durée telle qu'écrite au répertoire** », suivies d'un renvoi vers
   * un article qui n'existe pas. Le délai n'est pas du Code civil, il n'est pas au
   * répertoire, et il n'y a pas d'article à ouvrir : on ne compose donc AUCUNE référence.
   */
  if (entree.slug === SLUG_AUTRE) {
    return [
      {
        cle: 'entree-autre',
        reference: p.autreReference,
        // ⚠️ La nature se lit dans `objetFr`, PAS dans `article` : sur la surface publique,
        // qui ne demande plus la nature, `article` est vide et cette phrase rendait
        // « Nature indiquée : «  » ».
        texte: p.autreTexte(entree.objetFr ?? entree.article, entree.dureeTexte),
        source: p.autreSource,
        docId: null,
        numeroArticle: null,
      },
    ]
  }
  const pousser = (cle: string, numero: string | null) => {
    const t = TEXTES[cle]
    if (!t) return
    out.push({
      cle,
      reference: t.reference,
      texte: t.texte,
      source: t.source,
      docId: t.docId,
      numeroArticle: numero,
    })
  }

  if (entree.code === 'CPC') {
    pousser('cpc-987', '987')
    pousser('cpc-991', '991')
  } else if (entree.code === 'TRAVAIL') {
    pousser('ctrav-511', '511')
    pousser('ctrav-512', '512')
  }

  // L'article de l'entrée. Son texte n'est gelé dans `TEXTES` que pour une poignée
  // d'articles (l'art. 74, les quatre « cinq lieues »…) ; ailleurs, ce que la plateforme
  // détient de lui est sa DURÉE TELLE QU'ÉCRITE au répertoire, et c'est cela qu'on montre —
  // jamais une citation reconstituée.
  const abrege = ABREGE_CODE[entree.code as CodeDelai] ?? entree.code
  const corps = [
    entree.citationArticle ?? entree.dureeTexte,
    entree.dureeFondementFr ?? null,
  ].filter((s): s is string => Boolean(s))
  out.push({
    cle: `entree-${entree.article}`,
    // ⚠️ `numeroArticle` retire le préfixe que 135 des 393 lignes portent déjà : sans lui,
    // « C. civ., art. Art. 229 (L. 5 mai 1949) » (défaut 13).
    reference: `${abrege}, art. ${numeroArticle(entree.article)}`,
    texte: corps.join('\n'),
    source: entree.citationArticle ? p.sourceCitation : p.sourceRepertoire,
    docId: null,
    numeroArticle: entree.article,
  })

  return out
}

/** Les jours de la semaine dont le résultat a besoin — le moteur les a déjà rédigés en `fr`. */
function ligne(...morceaux: (string | null | undefined)[]): string {
  return morceaux.filter(Boolean).join(' ')
}

/**
 * § 6.3 j — LE TEXTE INTÉGRAL du presse-papiers et de la citation. **Jamais la date seule.**
 *
 * Il doit être opposable tel quel : la date, les étapes, les jours écartés, les lectures
 * concurrentes, les textes appliqués, les avertissements, et le permalien. Ce que l'écran
 * montre, et rien de moins — un extrait serait pire qu'une absence, parce qu'il aurait
 * l'apparence d'une citation complète.
 */
export function texteRaisonnement(args: {
  resultat: Resultat
  entree: {
    slug?: string
    code: string
    article: string
    objetFr: string
    dureeTexte: string
    dureeFondementFr?: string | null
    citationArticle?: string | null
  }
  permalien: string
  origine: string
  versionCalendrier: number
  versionFenetres: number
  revision: number | null
  locale?: Locale
  /**
   * § 7.3 — LES DEUX BANDEAUX, DANS LE PRESSE-PAPIERS AUSSI.
   *
   * L'impression les emportait (aucune classe `.no-print`), la copie non : le texte que
   * l'avocate colle dans une écriture ne disait pas un mot du retrait de l'entrée, ni du
   * changement de règle. C'est le défaut du § 0 dans sa forme exacte — une date calculée sous
   * une règle retirée, citée sans réserve. Le pied technique ne dit que « révision 3 », ce
   * qui ne signale rien à un lecteur.
   */
  bandeau?: Bandeau
}): string {
  const { resultat, entree, permalien, origine } = args
  const locale = args.locale ?? 'fr'
  const p = phrasesAffichage(locale)
  const estAutre = entree.slug === SLUG_AUTRE
  const abrege = ABREGE_CODE[entree.code as CodeDelai] ?? entree.code
  const l: string[] = []

  // EN TÊTE, en majuscules comme les autres sections : ce qui relativise la date doit se lire
  // avant elle, pas dans un pied de page.
  const bandeau = args.bandeau ?? null
  if (bandeau?.type === 'ENTREE_RETIREE') {
    l.push(p.bandeauRetiree(bandeau.retireeLe, bandeau.motif))
    l.push('')
  } else if (bandeau?.type === 'REGLE_CHANGEE') {
    l.push(p.bandeauRegleChangee(bandeau.revisionDemandee, bandeau.revisionCourante, bandeau.changeeLe))
    l.push('')
  }

  // Le genre « Autre » ne se compose pas en « C. civ., art. <nature saisie> » (défaut 15), et
  // sa nature se lit dans `objetFr` : `article` y est VIDE depuis que la surface publique ne
  // demande plus la nature.
  l.push(
    estAutre
      ? p.autreEnTete(entree.objetFr)
      : `${abrege}, art. ${numeroArticle(entree.article)} — ${entree.objetFr}`,
  )
  l.push(`${p.dureeLabel} : ${entree.dureeTexte}`)
  l.push('')

  if (resultat.statut === 'REFUS') {
    l.push(p.titreRefus)
    l.push(`${p.motifLabel} : ${resultat.motif}`)
    l.push(`${p.regimeLabel} : ${resultat.regimeAffiche}`)
  } else if (resultat.statut === 'INCOMPLET') {
    l.push(p.titreIncomplet)
    for (const m of resultat.manque) l.push(`— ${m}`)
  } else {
    l.push(`${p.titreDate} : ${dateComplete(resultat.teteAffiche, locale)}`)
    l.push('')
    l.push(resultat.phraseSecurite)
    l.push('')
    l.push(p.titreEtapes)
    resultat.etapes.forEach((e, i) => l.push(`${i + 1}. ${e.texte}`))

    l.push('')
    l.push(p.titreJoursEcartes)
    if (resultat.joursEcartes.length === 0) {
      l.push(p.aucunJourEcarte)
    } else {
      for (const j of resultat.joursEcartes) {
        for (const m of j.motifs) {
          l.push(
            ligne(
              `— ${dateEnToutesLettres(j.date, locale)} :`,
              m.libelle,
              `(${m.source})`,
              m.autorite === 'REDACTION' ? p.sansSourceTextuelle : null,
              m.noteJournee ?? null,
            ),
          )
        }
      }
    }

    if (resultat.praticable.necessaire) {
      l.push('')
      l.push(p.titrePraticable)
      l.push(resultat.praticable.texte)
    }

    l.push('')
    l.push(p.titreLectures)
    if (resultat.lectures.length === 0) {
      l.push(p.aucuneLecture)
    } else {
      for (const lec of resultat.lectures) {
        l.push(`— ${lec.libelle} → ${dateEnToutesLettres(lec.date, locale)}`)
        l.push(`  ${lec.fondement}`)
      }
      l.push(`${p.lectureLaPlusLarge} → ${dateEnToutesLettres(resultat.lectureLaPlusLarge, locale)}`)
    }

    l.push('')
    l.push(p.titreTextes)
    for (const t of textesAppliques(entree, locale)) {
      l.push(`— ${t.reference}`)
      l.push(t.texte)
    }

    l.push('')
    l.push(p.titreAvertissements)
    for (const a of resultat.avertissements) {
      // A6 porte son renvoi au corpus en donnée : dans un texte collé, un lien ne se clique
      // pas — on écrit donc la requête, et on ne feint pas un bouton (défaut 14).
      l.push(`— ${a.texte}${a.rechercheLibelle ? ` ${a.rechercheLibelle}.` : ''}`)
    }
  }

  l.push('')
  l.push(
    // ⚠️ La version des RÈGLES DE LECTURE ne se nomme que sur un CALCUL : un refus n'a pas de
    // date, donc aucune règle ne lui a été appliquée. L'écrire quand même ferait porter une
    // coordonnée à un texte qui n'en a pas.
    p.pied(
      args.versionCalendrier,
      args.versionFenetres,
      resultat.statut === 'CALCUL' ? resultat.versionRegles : null,
    ) +
      (args.revision != null && !estAutre
        ? ` · ${p.piedEntree(entree.code, numeroArticle(entree.article), args.revision)}`
        : ''),
  )
  l.push(`${origine}${permalien}`)
  return l.join('\n')
}
