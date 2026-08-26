/**
 * Vocabulaire des décisions judiciaires — SOURCE UNIQUE, partagée par le formulaire de
 * saisie, l'analyseur de recueil, l'API et la lecture publique.
 *
 * ⚠️ CES CLÉS SONT STOCKÉES EN BASE. Les libellés se traduisent, les clés jamais : une
 * renommée casserait les enregistrements existants et tous les filtres.
 */

/**
 * SENS DE L'ARRÊT — liste fermée, filtrable. Le libellé littéral vit dans `dispositif`.
 *
 * ⚠️ « SENS DE L'ARRÊT », PAS « ISSUE DU POURVOI ». Le champ ne répond pas à « comment le
 * pourvoi s'est-il terminé ? » mais à « qu'a fait la Cour ? ». La nuance n'est pas de
 * style : un arrêt AVANT_DIRE_DROIT n'a pas d'issue — la cause revient — et il fallait
 * bien que le champ puisse le dire. La clé de colonne reste `solution`, terme des
 * recueils ; c'est le libellé affiché qui porte le sens (cf. LIBELLE_SOLUTION).
 *
 * ⚠️ LES CINQ DERNIÈRES NE SONT PAS DES ISSUES DE POURVOI. Beaucoup d'arrêts de la Cour
 * ne tranchent aucun pourvoi — prise à partie, dessaisissement, mesure d'instruction — ou
 * n'en sont qu'à une étape. Sans ces valeurs, 12 arrêts du fonds (mesure du 18 août 2026)
 * n'entraient dans aucune case et sortaient de tout filtre sans le moindre signal.
 */
export const SOLUTIONS = [
  'REJET',
  'CASSATION_AVEC_RENVOI',
  'CASSATION_SANS_RENVOI',
  'DECHEANCE',
  'IRRECEVABILITE',
  'NULLITE',
  'NON_ADMISSION',
  'NON_LIEU_A_STATUER',
  'AVANT_DIRE_DROIT',
  'RENVOI_JURIDICTION',
] as const
export type Solution = (typeof SOLUTIONS)[number]

/**
 * Libellés du sens de l'arrêt. ⚠️ LES CLÉS NE SE TRADUISENT PAS, LES LIBELLÉS NON PLUS.
 *
 * ⚠️ EN FRANÇAIS DANS LES TROIS LANGUES — CE N'EST PAS UN OUBLI (décision de la rédaction,
 * 18 août 2026). Ne pas « compléter » cette table par des variantes EN/HT. « Cassation avec
 * renvoi », « Déchéance du pourvoi » ne sont pas des tournures françaises : ce sont les
 * noms que le droit haïtien donne à ces catégories, dans la langue où la Cour de cassation
 * rend ses arrêts. Les traduire fabriquerait des catégories qui n'existent dans aucun
 * recueil et que ne reconnaîtrait aucun juriste — le lecteur anglophone ou créolophone est
 * mieux servi par le terme exact que par une approximation dans sa langue.
 *
 * ⚠️ « NULLITÉ » N'EST PAS « IRRECEVABILITÉ ». Un pourvoi frappé de nullité est un acte
 * vicié ; un pourvoi irrecevable est un acte régulier que la Cour refuse d'examiner.
 * Les confondre effacerait une distinction que la Cour prend soin de faire.
 */
export const LIBELLE_SOLUTION: Record<Solution, string> = {
  REJET: 'Rejet du pourvoi',
  CASSATION_AVEC_RENVOI: 'Cassation avec renvoi',
  CASSATION_SANS_RENVOI: 'Cassation sans renvoi',
  DECHEANCE: 'Déchéance du pourvoi',
  IRRECEVABILITE: 'Irrecevabilité du pourvoi',
  NULLITE: 'Nullité de la déclaration de pourvoi',
  NON_ADMISSION: 'Requête non admise',
  NON_LIEU_A_STATUER: 'Non-lieu à statuer',
  AVANT_DIRE_DROIT: 'Avant dire droit',
  RENVOI_JURIDICTION: 'Renvoi devant une autre juridiction',
}

/**
 * Traitement ultérieur — comment les décisions postérieures ont traité celle-ci.
 *
 * ⚠️ TROIS FORMES DISTINCTES, PAS TROIS COULEURS. Coche, triangle, tiret : chacune se
 * reconnaît en niveaux de gris et en daltonisme. Wouj et Vèt sont à 1,05:1 de luminance —
 * deux glyphes de même forme, l'un rouge l'autre vert, seraient indiscernables pour un
 * lecteur daltonien, ce que la règle 5 de la charte proscrit.
 */
export const TRAITEMENTS = ['POSITIF', 'NEGATIF', 'NEUTRE'] as const
export type Traitement = (typeof TRAITEMENTS)[number]

/** Portée — la décision pose-t-elle une règle, ou tranche-t-elle une espèce ? */
export const PORTEES = ['JURISPRUDENCE', 'ESPECE'] as const
export type Portee = (typeof PORTEES)[number]

/**
 * Glyphes. ⚠️ NE JAMAIS STOCKER CES CARACTÈRES : la base garde la clé, l'interface rend
 * le glyphe. Stocker une présentation interdit d'en changer et casse tout filtre.
 * ⚠️ Ils ne voyagent jamais seuls — toujours accompagnés du libellé, `aria-hidden` posé
 * sur le glyphe : les émojis se rendent différemment selon les systèmes et les lecteurs
 * d'écran les annoncent de façon inconstante.
 */
export const GLYPHE_TRAITEMENT: Record<Traitement, string> = {
  POSITIF: '✅',
  NEGATIF: '⚠️',
  NEUTRE: '➖',
}
export const GLYPHE_PORTEE: Record<Portee, string> = {
  JURISPRUDENCE: '⚖️',
  ESPECE: '📄',
}

export function estSolution(v: string): v is Solution {
  return (SOLUTIONS as readonly string[]).includes(v)
}
export function estTraitement(v: string): v is Traitement {
  return (TRAITEMENTS as readonly string[]).includes(v)
}
export function estPortee(v: string): v is Portee {
  return (PORTEES as readonly string[]).includes(v)
}

/**
 * Devine le sens de l'arrêt à partir du dispositif littéral. Utilisée par l'analyseur de
 * recueil, JAMAIS pour écraser un choix humain.
 *
 * ⚠️ RETOURNE `null` PLUTÔT QUE DE DEVINER. Sur un corpus juridique, un sens inventé est
 * pire qu'un sens absent : le second se voit à l'écran de contrôle, le premier se propage
 * dans les filtres sans que personne ne le remette en cause.
 *
 * ⚠️ CE PRINCIPE A DÉJÀ ÉTÉ VIOLÉ UNE FOIS, ET IL EN A COÛTÉ CINQ FICHES. La branche
 * « cassation » rendait CASSATION_AVEC_RENVOI par DÉFAUT, en ne basculant sur « sans
 * renvoi » que devant ces deux mots écrits littéralement. Or la Cour de cassation d'Haïti
 * casse le plus souvent SANS renvoyer : elle retient la cause et juge elle-même « en vertu
 * de l'article 116 de la Constitution », formule qui ne contient pas « sans renvoi ». Cinq
 * des huit arrêts codés cassation portaient donc un renvoi qui n'a jamais eu lieu (mesure
 * du 18 août 2026). D'où l'ordre ci-dessous : on ne conclut au renvoi que s'il est ÉCRIT,
 * on conclut à l'absence de renvoi si la Cour a statué au fond, et on rend `null` sinon.
 *
 * ⚠️ « RENVOI » NE SUFFIT PAS, IL FAUT SON OBJET. « Renvoie des liens de la prévention »
 * est une relaxe, pas un renvoi après cassation. D'où le motif qui exige la cause, les
 * parties, l'affaire ou une juridiction derrière le mot.
 *
 * L'ordre des tests compte, et chaque rang protège le suivant :
 *   — « cassation » d'abord : « rejet des fins de non-recevoir ; cassation » est une
 *     cassation, et « déchéance des défenses ; cassation du jugement » aussi ;
 *   — « rejet » avant « irrecevabilité » : « rejet de la fin de non-recevoir ET DU
 *     POURVOI » est un rejet ; et avant « nullité » : « rejet de la nullité » aussi ;
 *   — « déchéance » avant « non-lieu » : « déchu de son pourvoi ; dit sans objet
 *     l'incident » est une déchéance.
 */
export function deduireSolution(dispositif: string): Solution | null {
  const t = dispositif
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  if (/cassation|\bcasse\b/.test(t)) {
    if (/sans\s+renvoi/.test(t)) return 'CASSATION_SANS_RENVOI'
    if (/renvoi(e|ant)?\s+(de\s+la\s+cause|la\s+cause|les\s+parties|l.affaire|devant)/.test(t)) return 'CASSATION_AVEC_RENVOI'
    // La Cour a jugé elle-même : il n'y a personne à qui renvoyer.
    if (/au\s+fond|a\s+fond|art(icle)?\.?\s*116|statuant\s+a\s+nouveau|jugeant\s+a\s+nouveau|retient\s+la\s+cause/.test(t))
      return 'CASSATION_SANS_RENVOI'
    return null
  }
  if (/decheance|\bdechu\b|\bdechue\b|\bdechus\b|\bdechues\b/.test(t)) return 'DECHEANCE'
  if (/rejet/.test(t)) return 'REJET'
  if (/irrecevab/.test(t)) return 'IRRECEVABILITE'

  // ── Arrêts qui ne tranchent aucun pourvoi, ou pas encore ──────────────────────
  if (/frappee?\s+de\s+nullite|nullite\s+de\s+la\s+declaration|declaration\s+de\s+pourvoi\s+.{0,20}nulle/.test(t))
    return 'NULLITE'
  if (/pas\s+lieu\s+d.admettre|pas\s+lieu\s+a\s+poursuivre|non[-\s]admission/.test(t)) return 'NON_ADMISSION'
  if (/desistement|sans\s+objet|non[-\s]lieu\s+a\s+statuer/.test(t)) return 'NON_LIEU_A_STATUER'
  if (/avant\s+(faire|dire)[-\s]?droit|sursis|surseoit|sursoit/.test(t)) return 'AVANT_DIRE_DROIT'
  if (/dessaisissement|se\s+dessaisit/.test(t)) return 'RENVOI_JURIDICTION'

  return null
}
