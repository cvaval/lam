/**
 * 404 du segment localisé : rend la même carte que la 404 racine (../not-found).
 * Nécessaire en propre — Next n'applique la not-found RACINE qu'aux URL sans
 * route ; un notFound() lancé dans une page (ex. doc/[id] inexistant) rend la
 * not-found la plus proche dans l'arborescence.
 */
export { default } from '../not-found'
