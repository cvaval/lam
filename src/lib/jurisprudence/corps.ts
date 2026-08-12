/**
 * Corps de repli d'une décision, tant que le texte intégral n'a pas été versé.
 *
 * ⚠️ `bodyOriginal` est NON NULLABLE et le sommaire analytique ne porte pas le texte des
 * arrêts. On y compose résumé + dispositif — jamais une chaîne vide pour satisfaire la
 * contrainte : un corpus juridique dont le corps est vide est un corpus qui ment.
 *
 * Cette composition sert AUSSI de marqueur : un corps qui lui est identique signale une
 * fiche encore dépourvue de texte intégral. C'est ce qui permet à un nouveau versement du
 * sommaire de ne PAS écraser un texte intégral déjà en place.
 */
export function compositionSommaire(resume: string | null, dispositif: string | null): string {
  return [resume, dispositif && `Dispositif : ${dispositif}`].filter(Boolean).join('\n\n')
}
