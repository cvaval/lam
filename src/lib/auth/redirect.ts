/**
 * Redirection après un CHANGEMENT D'IDENTITÉ (connexion, 2FA, déconnexion, réinitialisation).
 *
 * Toujours une navigation DURE — jamais `router.push`.
 *
 * Pourquoi : le cache de routeur de Next conserve côté CLIENT la charge déjà rendue des
 * segments visités (30 s pour une route dynamique, faute de `staleTimes` configuré).
 * `router.push` est une navigation douce : elle ressert cette charge sans repasser par le
 * serveur. Si l'utilisateur se déconnecte puis se reconnecte avec un AUTRE compte dans la
 * demi-minute — c'est-à-dire chaque fois qu'on teste le changement de compte — le tableau
 * de bord affiché est celui rendu pour le compte précédent : nom, rôle, quota, favoris.
 * La session serveur, elle, est bien la nouvelle : rien n'est cassé en base, c'est
 * l'affichage qui ment.
 *
 * `window.location.assign` recharge la page : cache de routeur vidé, état client jeté,
 * authentification réévaluée par le serveur. C'est le seul moyen sûr, et le coût — un
 * rechargement, aux deux instants de la session où l'utilisateur s'y attend — est nul.
 *
 * Le défaut s'est déjà produit une fois, sur la déconnexion par inactivité (IdleTimer) ;
 * la leçon y avait été corrigée mais pas portée ailleurs. D'où cette fonction : une seule
 * maison pour la règle, et un nom que l'on peut chercher. Le test
 * `src/lib/auth/redirect.test.ts` échoue si un composant d'authentification revient à
 * `router.push`.
 */
export function hardRedirect(path: string): void {
  window.location.assign(path)
}
