# Prompt — Élargir le périmètre du rôle Éditeur

## Ce qui est demandé

Un compte Éditeur (par exemple `wpetion@cabinetsales.com`) n'atteint aujourd'hui que trois
écrans de la console : Jurisprudence, Notes des lecteurs, Téléverser documents. Tout le
reste est réservé au Master Admin. Il faut ouvrir à la rédaction les écrans qui relèvent
du **travail éditorial**, et laisser au Master Admin seul ce qui relève de la
**gouvernance** : les comptes, l'argent, la sécurité.

---

## §1 — Le partage proposé

Deux natures de travail, deux périmètres. Le critère : *un éditeur peut-il abîmer autre
chose que du contenu ?* Si oui, l'écran reste au Master Admin.

**À ouvrir à l'Éditeur — curation du corpus**

| Écran | Route page | Route API |
| --- | --- | --- |
| Le Moniteur (éditions) | `/admin/moniteur`, `/admin/moniteur/manquants` | `/api/admin/moniteur/gaps` |
| Index du Moniteur | `/admin/index-moniteur` | `/api/admin/index-moniteur` |
| Marques | `/admin/marques` | `/api/admin/marques`, `/api/admin/marques/[id]/file` |
| Circulaires BRH | `/admin/brh` | `/api/admin/brh/gaps` |
| Tarifs douaniers | `/admin/tarifs` | `/api/admin/tarifs` |
| Carte judiciaire | `/admin/juridictions` | `/api/admin/jurisdictions` |
| Législation annotée : thèmes | `/admin/themes` | `/api/admin/themes` |
| Outils éditoriaux d'un document | `/admin/document/[id]` (déjà ouvert) | `/api/admin/legislation` |

**À laisser au Master Admin seul — gouvernance**

| Écran | Pourquoi |
| --- | --- |
| Vue d'ensemble (`/admin`) | Comptes inscrits, alertes d'anti-scraping — une console de sécurité |
| Utilisateurs (`/admin/users`) | Activer, suspendre, changer un rôle : de quoi se donner les droits qu'on n'a pas |
| Codes promo (`/admin/promo`) | Engage la facturation |
| Logs de sécurité (`/admin/logs`) | Celui qui est journalisé ne relit pas le journal |

> ⚠️ **Si ce partage ne correspond pas à l'intention, c'est LUI qu'il faut discuter avant
> d'écrire une ligne.** Le reste du prompt n'est que de la mécanique ; le périmètre est la
> seule décision réellement importante ici.

---

## §2 — La règle qui commande tout : DEUX gardes, jamais une

Chaque écran est protégé à deux endroits, et **les deux doivent bouger ensemble** :

1. la **page** (`requireAdmin` dans `src/app/[locale]/admin/**/page.tsx`) ;
2. la **route d'API** qu'elle appelle (`requireAdminApi`, ou un `user.role !== 'MASTER_ADMIN'`
   écrit à la main dans la route).

> ⚠️ **OUVRIR LA PAGE SANS LA ROUTE EST PIRE QUE DE NE RIEN OUVRIR.** L'éditeur voit le
> formulaire, saisit une entrée d'index, clique « Enregistrer », et reçoit un 401. Rien
> n'est écrit. Du point de vue de l'utilisateur, ce n'est pas un refus de droits : c'est
> une plateforme qui perd son travail.

Trois routes ne passent pas par `requireAdminApi` mais réécrivent le test à la main —
`index-moniteur`, `marques`, `marques/[id]/file`. Elles ne se trouvent pas en cherchant
`requireAdminApi` : chercher aussi `role !== 'MASTER_ADMIN'`.

---

## §3 — Une capacité explicite plutôt qu'un rôle recopié

Ne pas écrire `role === 'EDITEUR' || role === 'MASTER_ADMIN'` dans quinze fichiers. Ajouter
une capacité à la matrice de `src/lib/rbac.ts` :

```ts
| 'corpus.manage' // curer le corpus : éditions, index, marques, BRH, tarifs, thèmes, carte
```

Valeurs : `true` pour `EDITEUR` et `MASTER_ADMIN`, `false` pour les trois paliers lecteurs.

Ne pas réutiliser `upload.publish` : elle signifie « téléverser et publier un document »,
et sert déjà de garde au layout `/admin` et à `/api/admin/upload`. Deux intentions
distinctes sous un même nom deviennent impossibles à restreindre séparément le jour où l'on
voudra un éditeur qui verse sans curer, ou l'inverse.

Puis, dans `src/lib/auth/guard.ts`, la variante API qui manque :

```ts
/** Variante API de requireCapability — retourne l'utilisateur ou null (l'appelant répond 401). */
export async function requireCapabilityApi(cap: Capability): Promise<SessionUser | null>
```

`requireAdminApi` reste en place pour les quatre routes de gouvernance.

---

## §4 — La navigation

`src/components/AdminNav.tsx` construit ses entrées avec `...(isAdmin ? [...] : [])`.
Remplacer par trois groupes lisibles :

- entrées de **curation** — visibles si `can(role, 'corpus.manage')` ;
- entrées de **gouvernance** — visibles si `role === 'MASTER_ADMIN'` ;
- séparateur visuel entre les deux quand les deux sont présentes.

`consoleHref()` (`src/lib/nav.ts`) peut rester tel quel : un éditeur arrive sur
Jurisprudence, qui est son écran principal.

> ⚠️ **La navigation n'est pas une sécurité.** Masquer une entrée ne protège rien ; ce sont
> les gardes du §2 qui protègent. Ne jamais « ouvrir » un écran en se contentant d'afficher
> son lien.

---

## §5 — Les actions qui restent au Master Admin À L'INTÉRIEUR d'un écran ouvert

Ouvrir un écran n'ouvre pas tout ce qu'il permet. Cinq routes portent des suppressions ou
des remplacements de masse (`deleteMany`, ré-import purgeant) : `index-moniteur`, `tarifs`,
`legislation`, `marques`, `users`.

- **Toute suppression de document reste Master Admin.** Le corpus est la valeur de la
  plateforme et une suppression ne se rattrape pas depuis l'écran qui l'a causée.
- **Le ré-import des circulaires BRH reste Master Admin.** Il purge puis réimporte : il
  écrase les enrichissements ET les statuts d'abrogation posés à la main.
- Dans ces écrans, un éditeur voit le bouton **désactivé avec son motif affiché** — jamais
  un bouton actif qui échouera, jamais un bouton disparu sans explication.

Pour chaque route ouverte, vérifier que l'écriture appelle bien `audit()` avec
`actorId: user.id`. Une action éditoriale sans trace nominative dans un corpus juridique
n'est pas acceptable — et c'est précisément parce qu'on élargit le nombre de mains que la
trace devient indispensable.

---

## §6 — Ce qu'il ne faut PAS faire

- Ne pas donner `admin.accounts` à l'Éditeur, sous aucune forme.
- Ne pas ouvrir `/admin` (vue d'ensemble) : la redirection posée en `18f029e` mène déjà
  l'éditeur vers son premier écran.
- Ne pas modifier les gardes de lecture par service (`canReadService`, §03) : le périmètre
  d'ÉDITION et le périmètre de LECTURE sont deux choses différentes.
- Ne pas toucher au circuit de modération des notes ni aux règles d'anonymat.
- Ne pas créer un second rôle intermédiaire. Si la rédaction a besoin de plusieurs niveaux,
  c'est une décision produit à prendre séparément.

---

## §7 — Tests attendus

Dans `src/lib/rbac.test.ts` (ou un nouveau `src/lib/auth/perimetre.test.ts`) :

1. `can('EDITEUR', 'corpus.manage')` vrai ; faux pour `SITWAYEN`, `PWOFESYONEL`,
   `ENSTITISYON`.
2. `can('EDITEUR', 'admin.accounts')` **faux** — la garantie du §6.
3. **Matrice page ↔ API.** Un test qui lit les fichiers et vérifie, pour chaque écran de la
   liste du §1, que la page et sa route portent la MÊME garde. C'est ce test qui empêche de
   reproduire le défaut du §2 la prochaine fois qu'un écran sera ajouté.
4. `consoleHref('EDITEUR', 'fr')` inchangé.

---

## §8 — Vérifications avant de rendre la main

- [ ] `npx tsc --noEmit` propre.
- [ ] `npm run lint` propre.
- [ ] `npm test` — tests du §7 compris.
- [ ] `npx tsx scripts/audit-contraste.ts` → **0 échec**.
- [ ] `npm run build:check` compile (**`build:check`**, pas `build`, si le serveur de
      développement tourne).
- [ ] Sur chaque écran ouvert : **écrire réellement une entrée et la relire**. Un écran qui
      s'affiche ne prouve rien ; c'est l'enregistrement qui prouve que les deux gardes ont
      bougé ensemble.
- [ ] Vérifier qu'un éditeur ne voit NI n'atteint Utilisateurs, Codes promo, Logs, Vue
      d'ensemble — en tapant les URL à la main, pas seulement en regardant le menu.
- [ ] Vérifier dans `AuditLog` que les écritures faites sous un compte éditeur portent bien
      son `actorId`.
- [ ] Supprimer les données d'essai : la base est celle de **production**.

> ⚠️ **La vérification sous un compte Éditeur revient à la cliente.** Je ne saisis pas de
> mot de passe et ne peux pas ouvrir de session sous ce rôle : ce qui se prouve sans
> session doit l'être par des tests (§7), et le reste demande un passage de Me Vaval ou de
> Me Petion à l'écran.

---

## §9 — Après coup

Une fois le périmètre élargi, mettre à jour la mémoire projet : le partage curation /
gouvernance est exactement le genre de décision qu'on ne retrouve pas en lisant le code six
mois plus tard.
