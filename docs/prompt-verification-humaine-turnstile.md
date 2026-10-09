# Prompt : vérifier qu'une personne, et non un robot, demande à figurer sur la plateforme

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (plateforme **Agora**,
> agora.ht).
>
> - **Version 1**, 9 octobre 2026, à la demande de Me Vaval : « quand quelqu'un demande à être
>   ajouté à la plateforme comme notaire ou avocat, il doit confirmer qu'il est un humain ».
> - Fait suite à `docs/prompt-coordonnees-notaires.md` (chantier D, demandes des tiers), livré
>   en local le 9 octobre : commits `5e3d715` (code) et `3b726f9` (docs), **ni poussés ni
>   migrés**. Note de livraison : `docs/livraison-coordonnees-notaires-saisie-et-demandes.md`.
> - **Revient sur une décision** du chantier D : « Sans captcha tiers : la CSP n'autorise que
>   `connect-src 'self'` ». La cliente demande désormais une vérification humaine explicite.
>   L'outil retenu est **Cloudflare Turnstile**.

---

## Ce qui est demandé

Toute personne qui demande à être **ajoutée à la plateforme comme notaire ou comme avocat** doit
confirmer qu'elle est une personne avant que sa demande soit enregistrée.

- **Aujourd'hui**, une seule porte d'entrée existe : le formulaire des tiers
  `/{locale}/juridictions/notaires/demande`. Il sert aux deux objets, « ajouter ou corriger des
  coordonnées » et « signaler un notaire absent de la liste ». **La vérification couvre le
  formulaire entier**, quel que soit l'objet.
- **Les avocats** n'ont encore ni couche, ni liste de référence, ni formulaire. Ce chantier ne
  les crée pas. Il livre une vérification **générique**, que le futur formulaire des avocats
  devra utiliser ; un test sentinelle l'impose (voir « Avocats »).
- **Hors périmètre par défaut** : l'inscription d'un compte (`/register`). C'est la question 3.

## Pourquoi Turnstile

- **Gratuit.** Le plan gratuit compte jusqu'à 20 widgets par compte, 10 noms d'hôte par
  widget, et des vérifications en nombre illimité.
- **Sans puzzle la plupart du temps.** En mode « Managed », Cloudflare décide s'il faut une
  interaction ; souvent, une simple case suffit, ou rien.
- **Le domaine n'a pas besoin d'être chez Cloudflare.** Turnstile fonctionne sur tout site,
  que son trafic passe ou non par le réseau de Cloudflare.
- **Compatible avec la CSP à nonce du site** (`'strict-dynamic'`), à condition d'y ajouter
  deux directives (voir « La CSP »).

## L'état de départ (à vérifier en début de session)

- **Formulaire** : `src/components/jurisdictions/NotaryRequestForm.tsx`, composant client.
  - Sans JavaScript, `POST` classique et redirection 303.
  - Avec JavaScript, la même route répond en JSON, et la saisie reste à l'écran.
- **Route** : `src/app/api/public/jurisdictions/notaires/demandes/route.ts`.
  - Protections actuelles : champ piège `site`, délai minimal de 3 s (`t`), frein mémoire,
    frein persistant de 3 demandes par heure et par IP, plafond de 30 courriels par jour.
- **Interrupteur** : `demandesOuvertes()` dans `src/lib/jurisdictions/notaires-demandes.ts`.
  Le formulaire est **fermé** (404) tant que `NOTARY_REQUESTS_ENABLED` ne vaut pas `true`.
- **Table** `NotaryRequest` dans `prisma/schema.prisma`, **pas encore migrée en production** :
  on peut encore y ajouter une colonne sans migration supplémentaire.
- **CSP** : `buildCsp()` dans `src/middleware.ts`, à nonce par requête (`x-nonce`), avec
  `'strict-dynamic'`, `frame-src 'self' blob:` et `connect-src 'self'`.
- **Politique de confidentialité** : addition en PROJET dans
  `docs/confidentialite-demandes-notaires.md`, à valider par la cliente avant l'ouverture.

Si l'un de ces points a changé (par exemple, commits poussés ou table migrée), adapte-toi et
dis-le dans la note de livraison.

## Côté Cloudflare : la procédure (faite par la titulaire du compte, pas par la session)

La session **ne crée rien chez Cloudflare** et **ne demande jamais la clé secrète** : en local
et sur le banc, elle travaille avec les clés de test publiques (plus bas).

1. **Se connecter** à Cloudflare (compte gratuit) et ouvrir la page **Turnstile** du compte :
   `https://dash.cloudflare.com/?to=/:account/turnstile`.
2. **Add widget**, puis remplir :
   - **Widget name** : « Agora — demandes d'inscription » ;
   - **Hostname management** : `agora.ht` et `www.agora.ht`. **Pas** `localhost` : le
     développement utilise les clés de test ;
   - **Widget mode** : **Managed** (recommandé) ;
   - **Pre-clearance** : **non**. Inutile ici, et cela exigerait de toucher `connect-src`.
3. **Create**, puis copier la **clé de site** (*sitekey*, publique) et la **clé secrète**.
   - La clé secrète ne passe ni par courriel, ni par une conversation, ni par un fichier du
     dépôt. Elle se colle directement dans Vercel.
4. **Vercel** → projet → *Settings* → *Environment Variables* :

   | variable | Production | Preview et Development |
   |---|---|---|
   | `TURNSTILE_SITE_KEY` | la clé de site du widget | `1x00000000000000000000AA` (test, passe toujours) |
   | `TURNSTILE_SECRET_KEY` | la clé secrète, marquée *Sensitive* | `1x0000000000000000000000000000000AA` (test) |

   Les déploiements *Preview* ont une adresse en `*.vercel.app`, qui n'est pas déclarée dans le
   widget : ils utilisent donc les clés de test.
5. **Redéployer** pour que les variables soient lues.
6. **Contrôler** : les statistiques du widget (7 jours d'historique) montrent les vérifications.
7. **Changer la clé secrète** (fuite, départ d'un prestataire) : widget → *Settings* → *Rotate
   Secret Key*.
   - L'ancienne et la nouvelle clé restent valides **deux heures** ; mettre à jour Vercel et
     redéployer dans ce délai.
   - On ne peut pas relancer une rotation pendant ces deux heures.

## Variables d'environnement

- **`TURNSTILE_SITE_KEY`** est publique. Elle est lue **côté serveur**, au rendu de la page,
  puis passée en propriété au composant. **Pas de `NEXT_PUBLIC_`** : changer de clé ne doit pas
  exiger de reconstruire le site.
- **`TURNSTILE_SECRET_KEY`** est secrète et serveur seulement. Elle n'apparaît jamais dans un
  composant client, un journal, un audit ni un message d'erreur.
- **Documente les deux dans `.env.example`**, avec les clés de test en commentaire.
  **Ne touche jamais `.env`.**
- **Règle d'ouverture**, à coder dans `demandesOuvertes()` ou à côté : le formulaire n'est
  ouvert que si `NOTARY_REQUESTS_ENABLED=true` **et** si les deux clés sont présentes.
  - Il vaut mieux un formulaire fermé qu'un formulaire ouvert sans protection.
  - En production, des clés de test comptent comme **absentes** (préfixes `1x`, `2x`, `3x`
    suivis de zéros).
  - Test : chaque combinaison.

## La CSP

Dans `buildCsp()` (`src/middleware.ts`), et **seulement pour les pages qui affichent le
widget**. Déclare la liste de ces chemins dans une constante, aujourd'hui le seul formulaire des
tiers : aucune autre page ne doit pouvoir appeler Cloudflare.

- **`script-src`** : ajouter `https://challenges.cloudflare.com`.
  - Les navigateurs CSP3 suivent le nonce et `'strict-dynamic'`.
  - Le nom d'hôte sert de repli aux autres navigateurs.
- **`frame-src`** : ajouter `https://challenges.cloudflare.com`. Le widget est une iframe.
- **`connect-src`** : **inchangé** (`'self'`). Sans *pre-clearance*, Turnstile n'en a pas
  besoin.
- **Le script** `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` est
  chargé avec le nonce de la requête.
  - La page serveur lit `headers().get('x-nonce')` et le passe au composant, qui utilise
    `next/script` avec `nonce`.
  - Le script se charge depuis cette adresse **exacte** : ni copie, ni proxy, ni cache, sinon
    Turnstile casse à la mise à jour suivante.
- **Test** : la CSP du formulaire contient les deux ajouts ; celle de toutes les autres pages
  ne les contient pas ; `connect-src` reste `'self'` partout.

## Côté client : le widget

Crée un composant générique, par exemple
`src/components/security/VerificationHumaine.tsx`.

- **Rendu explicite** (`turnstile.render`), pour garder la main en React et réinitialiser le
  widget. Il est retiré au démontage (`turnstile.remove`).
- **`action`** : `notary-request` pour le formulaire actuel (32 caractères au plus : lettres,
  chiffres, `_`, `-`). Le futur formulaire des avocats utilisera `lawyer-request`.
- **Langue** : `fr` sur /fr, `en` sur /en.
  - **Le créole n'est pas pris en charge par Turnstile** : sur /ht, `fr` (question 5).
- **Apparence** : `theme: 'light'` (le portail est clair), `size: 'flexible'` (il tient dans
  la gouttière de 16 px sur téléphone), `appearance: 'always'` : la personne voit qu'elle a
  été vérifiée.
- **Le jeton** est le champ caché `cf-turnstile-response` que Turnstile crée dans le
  formulaire. Il part avec les autres champs, dans le `FormData` comme dans le `POST`
  classique.
- **Avant l'envoi** : si le jeton manque, n'envoie rien. Affiche l'erreur sous le widget
  (« Confirmez que vous êtes une personne ») et donne-lui le focus.
  - Le bouton d'envoi reste actif : un bouton grisé sans explication ne se comprend pas.
- **Après une réponse de la route** : si elle indique `jetonConsomme: true`, appelle
  `turnstile.reset`. Un jeton ne sert qu'une fois.
  - Une erreur de saisie **ne consomme pas** le jeton (voir l'ordre de la route) : la personne
    corrige sans refaire la vérification.
- **Expiration** (5 minutes) : `refresh-expired: 'auto'`, le widget se renouvelle seul.
- **Sans JavaScript**, Turnstile ne peut pas fonctionner.
  - Un `<noscript>` le dit : « Ce formulaire vérifie que vous êtes une personne et a besoin
    de JavaScript. Vous pouvez aussi écrire à legal@agora.ht. »
  - Le `POST` classique reste branché, mais sans jeton la route refuse avec `erreur=humain`.
  - C'est un **changement** par rapport au chantier D, qui exigeait un formulaire utilisable
    sans JavaScript (question 2).
- **Mention sous le widget**, petite, en fr/en/ht : « Vérification par Cloudflare Turnstile —
  [politique de confidentialité d'Agora] ».
- **Accessibilité** : l'iframe de Cloudflare porte son propre libellé. Le composant ajoute un
  intitulé visible au-dessus (« Vérification »), et l'erreur se relie au conteneur par
  `aria-describedby`.

## Côté serveur : la vérification

Module `src/lib/security/turnstile.ts`. La partie pure se teste sans réseau.

- **`lireReponseSiteverify(json, attendu)`** est pure. Elle rend
  `{ ok: true, verifieLe }` ou `{ ok: false, motif, codes }` :
  - `success` doit valoir `true` ;
  - `action` doit égaler l'action attendue ;
  - `hostname` doit appartenir à la liste de production (`agora.ht`, `www.agora.ht`). On ne
    contrôle pas le nom d'hôte quand on utilise une clé secrète de test ;
  - `challenge_ts` doit dater de moins de 300 s ;
  - les `error-codes` se rangent en motifs : `absent`, `invalide`, `expire` (y compris
    `timeout-or-duplicate`), `action`, `hote`, `indisponible`.
- **`verifierHumain({ jeton, ip, action })`** fait l'appel réseau :
  - jeton absent ou de plus de 2 048 caractères : refusé **sans appel** ;
  - `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`, en
    `application/x-www-form-urlencoded`, avec `secret`, `response`, `remoteip` et une
    `idempotency_key` (UUID) ;
  - délai de 5 s, **une** nouvelle tentative avec la même `idempotency_key` en cas d'échec
    réseau ou d'`internal-error` ;
  - **jamais** le jeton ni la clé dans un journal.
- **Si Cloudflare ne répond pas** : refus, avec le message « vérification momentanément
  indisponible, réessayez dans un instant » (question 4).

## L'ordre dans la route `POST /api/public/jurisdictions/notaires/demandes`

1. Formulaire fermé (interrupteur **ou** clés absentes) → 404.
2. Frein mémoire.
3. Lecture des champs ; **champ piège ou envoi trop rapide** → confirmation silencieuse,
   **sans appeler Cloudflare** : le piège reste la première défense, gratuite.
4. **Validation de la saisie** (`lireDemande`). En cas d'erreur, réponse
   `jetonConsomme: false` : le jeton n'a pas été présenté à Cloudflare.
5. **`verifierHumain`**, action `notary-request`. En cas d'échec :
   - audit `HUMAN_CHECK_FAILED` (nouvelle `AuditAction`), avec l'IP, le motif et les codes,
     **sans le contenu** de la demande ;
   - réponse `erreur=humain` (redirection) ou `{ ok: false, erreurs: ['humain'],
     jetonConsomme: true }` (JSON), statut 403.
6. Frein persistant par IP.
7. Enregistrement, avec **`humanVerifiedAt`** = `challenge_ts`. C'est une nouvelle colonne
   `DateTime?` sur `NotaryRequest`, ajoutée **avant** la migration de production si elle n'a
   pas encore eu lieu.
8. Audit `NOTARY_REQUEST_CREATED`, puis courriel à la rédaction. Le courriel ajoute une
   ligne « Vérification humaine : réussie ».
9. Confirmation, identique dans tous les cas.

## Back-office

- **Le détail d'une demande** affiche « Vérification humaine : réussie le … ». Une demande
  enregistrée **avant** ce chantier (s'il y en a) affiche « non vérifiée ».
- **Les échecs** se lisent dans les journaux : `/admin/logs?action=HUMAN_CHECK_FAILED`.
- **La file des demandes** rappelle l'état de la protection : « Vérification humaine :
  active » ou « clés absentes, formulaire fermé ».

## Avocats

- Le module et le composant ne connaissent **aucune profession** : ils reçoivent l'`action`.
- **Test sentinelle** : toute route publique de demande (`src/app/api/public/**/demandes*/route.ts`)
  doit appeler `verifierHumain`. Un futur formulaire des avocats qui l'oublierait fait
  échouer la suite.
- **La couche des avocats** (liste de référence, page, carte) est un chantier à part, avec sa
  propre spécification. Ne la commence pas ici.

## Confidentialité

Le widget transmet à Cloudflare des données techniques sur le visiteur (adresse IP, signaux du
navigateur). Il faut donc :

- **compléter le projet** `docs/confidentialite-demandes-notaires.md` (ne rien publier) :
  - § 6 Destinataires : Cloudflare, Inc., pour la vérification anti-robot du seul formulaire
    de demande ;
  - § 7 Hébergement : transfert vers les États-Unis ;
  - § 9 Cookies : ce que Turnstile dépose ou non. Relève-le **dans la documentation de
    Cloudflare au jour du travail**, cite la page, et n'affirme rien qui n'y figure pas ;
- **ne charger le script que sur la page du formulaire**, jamais sur l'ensemble du site ;
- **ne pas toucher au bandeau de cookies** sans la décision de la cliente (question 6).

## Ce que la cliente doit trancher

Applique le défaut et signale-le dans la note de livraison.

| # | question | défaut proposé |
|---|---|---|
| 1 | Turnstile (Cloudflare) convient-il, ou préférez-vous un autre service ? | Turnstile |
| 2 | Le formulaire exigera JavaScript. Acceptable, avec un renvoi vers legal@agora.ht pour qui n'en a pas ? | oui |
| 3 | Protéger aussi l'inscription d'un compte (`/register`) ? | non en v1 ; même module, ajout facile |
| 4 | Si Cloudflare ne répond pas : refuser la demande (« réessayez ») ou l'enregistrer en la marquant « non vérifiée » ? | refuser |
| 5 | Le créole n'est pas pris en charge par Turnstile : le widget en français sur /ht ? | oui |
| 6 | Turnstile relève-t-il des cookies « strictement nécessaires » (sécurité), sans consentement ? | à trancher par la cliente, juriste ; rien de changé d'ici là |
| 7 | Avocats : quelle liste de référence (tableau de quel barreau) pour la future couche ? | hors de ce chantier |

## Vérification

- **Tests** :
  - module pur : succès ; mauvaise action ; mauvais nom d'hôte ; jeton trop vieux ;
    `timeout-or-duplicate` ; `internal-error` ; jeton absent ou trop long ;
  - route, avec `fetch` simulé :
    - sans jeton → 403, rien d'enregistré, audit `HUMAN_CHECK_FAILED` ;
    - jeton refusé → idem ;
    - jeton accepté → demande enregistrée avec `humanVerifiedAt` ;
    - erreur de saisie → **aucun appel** à Cloudflare, `jetonConsomme: false` ;
    - piège → aucun appel ;
    - Cloudflare injoignable → refus ;
    - clés absentes → 404 ;
  - interrupteur : `NOTARY_REQUESTS_ENABLED` × clés présentes, absentes ou de test en
    production ;
  - CSP : les deux ajouts sur le formulaire seul, `connect-src` inchangé ;
  - rendu : conteneur du widget, `<noscript>`, mention Cloudflare, erreur reliée ;
  - sentinelle des routes de demande.
- **Commandes** : `npx tsc --noEmit`, `npm run lint`, `npx vitest run --dir src`,
  `npm run build:check`. **Jamais** `npm run build`.
- **Banc** (`lam_banc`, build de production, configuration `lam-banc-verify-demandes` du
  `launch.json` du dossier PARENT, à compléter avec les clés de test) :
  - clé de site `1x00000000000000000000AA` + secret `1x0000000000000000000000000000000AA` :
    la demande passe ;
  - secret `2x0000000000000000000000000000000AA` : refus « humain », rien d'enregistré ;
  - secret `3x0000000000000000000000000000000AA` : `timeout-or-duplicate`, refus ;
  - clé de site `3x00000000000000000000FF` : le défi interactif s'affiche ;
  - **aucune violation CSP** dans la console ; le script de Cloudflare n'est chargé sur aucune
    autre page ;
  - largeur téléphone : le widget tient dans la page, sans défilement horizontal ;
  - /fr, /en, /ht.
  - Retire du banc les données d'essai à la fin.

## Contraintes du dépôt

- **Le dépôt est partagé** avec d'autres sessions, et un outil de maquette écrit en parallèle
  dans `src/components/agora-portal.css` : lis le diff complet de tout fichier partagé avant de
  le commiter.
- **Jamais** `git add -A` : on ajoute fichier par fichier.
- **Jamais** `npm run build`.
- **Jamais** de modification de `.env`. Le `.env` local pointe vers la base de **production**.
- **Le créole** suit la convention de la cliente (pas d'accent grave ajouté), sous réserve de
  sa réponse à la question en suspens sur les libellés existants.
- **ARRÊTE-TOI et demande à Me Vaval avant** :
  - tout `prisma db push` sur la production ;
  - tout `git push` ou déploiement ;
  - toute création ou modification de variable dans Vercel.

## Livraison

- **Une note** `docs/livraison-verification-humaine.md` :
  - ce qui est fait ;
  - les vérifications ;
  - les défauts appliqués aux questions ;
  - la procédure Cloudflare et Vercel, reprise telle quelle pour la cliente.
- **Le commit** se fait fichier par fichier. **Ne pousse pas** sans instruction. Rapporte.
