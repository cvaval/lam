'use client'

/**
 * Redirection après un CHANGEMENT D'IDENTITÉ (connexion, 2FA, déconnexion, réinitialisation).
 *
 * Toujours une navigation DURE — jamais `router.push`.
 *
 * POURQUOI. Le cache de routeur de Next conserve côté CLIENT la charge déjà rendue des
 * segments visités. `router.push` est une navigation douce : elle ressert cette charge sans
 * repasser par le serveur. Qui se déconnecte puis se reconnecte avec un AUTRE compte revoit
 * donc le tableau de bord rendu pour le précédent — nom, rôle, quota, favoris. La session
 * serveur, elle, est bien la nouvelle : c'est l'affichage qui ment.
 *
 * La fenêtre n'est pas de 30 secondes mais de CINQ MINUTES pour les pages préchargées : le
 * logo du bandeau est un `<Link>` vers le tableau de bord, toujours dans le champ de vision,
 * donc préchargé en mode `auto` — Next garde ces entrées réutilisables 300 s (`staleTimes`
 * n'est pas redéfini dans next.config.mjs). D'où le « ça garde TOUJOURS l'ancien compte ».
 *
 * `window.location` recharge la page : cache de routeur vidé, état React jeté,
 * authentification réévaluée par le serveur.
 *
 * SORTIE ou ENTRÉE. En sortie (déconnexion, inactivité) on REMPLACE l'entrée d'historique :
 * sans quoi le « Précédent » ramène à une page du compte quitté, servie depuis le cache du
 * navigateur. En entrée (connexion) on empile normalement.
 *
 * LE STOCKAGE LOCAL NE SUIT PAS L'IDENTITÉ. Rien dans l'application ne l'efface jamais.
 * L'historique de recherche du compte précédent réapparaîtrait donc dans l'autocomplétion du
 * suivant — sur un poste partagé de cabinet, c'est une fuite de confidentialité autant qu'un
 * symptôme. On purge ici les clés qui portent du contenu d'utilisateur. On NE touche PAS aux
 * deux clés de signalisation : `lv:logged-out` est le signal que la déconnexion vient d'être
 * posée à l'intention des autres onglets, `lv:last-activity` celui de l'inactivité.
 *
 * Le défaut s'est produit deux fois — d'abord sur la déconnexion par inactivité, corrigée
 * seule, puis sur le bouton de déconnexion et sur la connexion. D'où cette fonction : une
 * seule maison pour la règle. `redirect.test.ts` échoue si un composant d'authentification
 * revient à `router.push` ou appelle `window.location` directement.
 */

/**
 * Clés de SIGNALISATION, à ne jamais purger : elles ne portent rien de l'utilisateur et
 * servent justement à orchestrer la déconnexion entre onglets.
 */
const CLES_DE_SIGNAL = new Set(['lv:logged-out', 'lv:last-activity'])

/**
 * ⚠️ ON PURGE PAR PRÉFIXE, ET NON PAR LISTE. La liste littérale nommait
 * `lv:doctrineMode` et `lv:doctrineTree` ; le jour où le navigateur de thèmes a préfixé ses
 * clés par la rubrique (`lv:legislationannotee:tree`, `lv:circulaires:tree`), ces deux noms
 * ont cessé d'exister — la purge visait des clés fantômes, et son test restait vert parce
 * qu'il posait lui-même les anciennes. Une liste à maintenir à la main finit toujours par
 * décrire le code d'hier.
 *
 * ⚠️ ET SUR LES DEUX STOCKAGES. Seul `localStorage` était nettoyé, alors que l'état de
 * l'arbre — thème ouvert, sous-thèmes dépliés — vit dans `sessionStorage`. Sur un poste
 * partagé de cabinet, l'avocat suivant retrouvait la navigation du précédent.
 */
function purgerStockage(): void {
  for (const store of [localStorage, sessionStorage]) {
    const aRetirer: string[] = []
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k?.startsWith('lv:') && !CLES_DE_SIGNAL.has(k)) aRetirer.push(k)
    }
    // Retiré APRÈS l'énumération : supprimer pendant décale les index et saute des clés.
    for (const k of aRetirer) store.removeItem(k)
  }
}

export function hardRedirect(path: string, options: { sortie?: boolean } = {}): void {
  // Même origine seulement. Aucun appelant ne passe aujourd'hui autre chose qu'un littéral,
  // mais la fonction est un point d'entrée partagé et invitant : « //exemple.tld » partirait
  // hors du site.
  const cible = path.startsWith('/') && !path.startsWith('//') ? path : '/'
  try {
    purgerStockage()
  } catch {
    /* stockage indisponible (navigation privée, quota) : la redirection prime */
  }
  if (options.sortie) window.location.replace(cible)
  else window.location.assign(cible)
}
