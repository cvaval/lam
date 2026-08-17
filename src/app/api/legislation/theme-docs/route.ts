/**
 * COMPATIBILITÉ — ancien chemin de la route des textes d'un thème.
 *
 * Renommée en /api/themes/docs le 17 août 2026 : « legislation » dans le chemin d'une route
 * qui sert aussi les circulaires de la BRH est le genre de nom qui égare — exactement le
 * travers que la correction des rubriques du même jour visait à supprimer.
 *
 * Ce fichier n'existe que pour les onglets restés ouverts pendant le déploiement : sans lui,
 * un clic sur un thème répondrait 404, et le navigateur afficherait « Aucun texte accessible
 * dans ce thème » — un mensonge, là où il fallait une erreur. Supprimable au déploiement
 * suivant.
 */
export { GET, runtime } from '../../themes/docs/route'
