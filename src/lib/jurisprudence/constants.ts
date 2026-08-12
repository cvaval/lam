/**
 * Vocabulaire des décisions judiciaires — SOURCE UNIQUE, partagée par le formulaire de
 * saisie, l'analyseur de recueil, l'API et la lecture publique.
 *
 * ⚠️ CES CLÉS SONT STOCKÉES EN BASE. Les libellés se traduisent, les clés jamais : une
 * renommée casserait les enregistrements existants et tous les filtres.
 */

/** Issue du pourvoi — liste fermée, filtrable. Le libellé littéral vit dans `dispositif`. */
export const SOLUTIONS = [
  'REJET',
  'CASSATION_AVEC_RENVOI',
  'CASSATION_SANS_RENVOI',
  'DECHEANCE',
  'IRRECEVABILITE',
] as const
export type Solution = (typeof SOLUTIONS)[number]

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
 * Devine l'issue à partir du dispositif littéral. Utilisée par l'analyseur de recueil,
 * JAMAIS pour écraser un choix humain.
 *
 * ⚠️ RETOURNE `null` PLUTÔT QUE DE DEVINER. Sur un corpus juridique, une issue inventée
 * est pire qu'une issue absente : la seconde se voit à l'écran de contrôle, la première
 * se propage dans les filtres sans que personne ne la remette en cause.
 *
 * L'ordre des tests compte : « cassation sans renvoi » contient « cassation », et
 * « rejet de la fin de non-recevoir ET DU POURVOI » contient « recevoir ».
 */
export function deduireSolution(dispositif: string): Solution | null {
  const t = dispositif
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  if (/cassation/.test(t)) return /sans renvoi/.test(t) ? 'CASSATION_SANS_RENVOI' : 'CASSATION_AVEC_RENVOI'
  if (/decheance/.test(t)) return 'DECHEANCE'
  // « rejet » l'emporte sur « irrecevabilité » : « rejet de la fin de non-recevoir et du
  // pourvoi » est un rejet, pas une irrecevabilité.
  if (/rejet/.test(t)) return 'REJET'
  if (/irrecevab/.test(t)) return 'IRRECEVABILITE'
  return null
}
