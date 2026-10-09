# Livraison : vérification humaine (Cloudflare Turnstile)

9 octobre 2026. Spécification : `docs/prompt-verification-humaine-turnstile.md`.

## Ce qui est fait

Toute personne qui demande à figurer sur la plateforme passe par une **vérification
humaine** avant que sa demande soit enregistrée. Aujourd'hui, la seule porte est le formulaire
des notaires ; demain, le formulaire des avocats devra l'utiliser lui aussi.

- **Module serveur** : `src/lib/security/turnstile.ts`.
  - Lecture stricte de la réponse de Cloudflare : action `notary-request`, hôte `agora.ht` ou
    `www.agora.ht`, jeton de moins de 300 s.
  - Un jeton absent ou trop long ne part pas chez Cloudflare.
  - Délai de 5 s et une seule nouvelle tentative, avec la même clé d'idempotence.
  - **Cloudflare injoignable : la demande est refusée**, avec « réessayez dans un instant ».
- **Widget** : `src/components/security/VerificationHumaine.tsx`, générique (il reçoit
  l'action), placé avant le bouton d'envoi.
  - Mode Managed, thème clair, largeur fluide.
  - En français sur /fr et /ht (Turnstile ne connaît pas le créole), en anglais sur /en.
  - Mention « Vérification par Cloudflare Turnstile — Politique de confidentialité ».
  - Sans JavaScript, un `<noscript>` renvoie à legal@agora.ht.
- **L'ordre dans la route** :
  1. formulaire fermé ;
  2. frein ;
  3. piège (Cloudflare n'est pas appelé) ;
  4. **validation de la saisie** : une faute ne consomme pas le jeton, la personne corrige
     sans refaire la vérification ;
  5. **vérification humaine** ;
  6. frein par IP ;
  7. enregistrement avec `humanVerifiedAt` ;
  8. courriel à la rédaction, avec la ligne « Vérification humaine : réussie ».
- **Échecs** journalisés `HUMAN_CHECK_FAILED` (IP, motif, codes ; ni jeton ni contenu),
  lisibles dans `/admin/logs?action=HUMAN_CHECK_FAILED`.
- **CSP** : `challenges.cloudflare.com` est ajouté à `script-src` et `frame-src` **sur la
  seule page du formulaire**. `connect-src` ne change nulle part. Le script de Cloudflare porte
  le nonce de la requête.
- **Règle d'ouverture** : le formulaire n'est ouvert que si `NOTARY_REQUESTS_ENABLED=true`
  **et** si les deux clés Turnstile sont présentes. En production Vercel, des clés de test
  valent des clés absentes.
- **Back-office** :
  - le détail d'une demande affiche « Vérification humaine : réussie le … » ;
  - la file indique « active » ou « clés absentes, formulaire fermé », avec un lien vers le
    journal des échecs.
- **Sentinelle** : toute route publique de demande doit appeler `verifierHumain`. Le futur
  formulaire des avocats ne pourra pas l'oublier.
- **Schéma** : colonne `NotaryRequest.humanVerifiedAt`, ajoutée avant la première migration
  de la table, qui reste donc unique.

## Découvert en vérifiant

**La clé secrète de test « passe toujours » (`1x…AA`) accepte N'IMPORTE QUEL jeton**, pas
seulement le jeton factice.

- Vérifié directement auprès de Cloudflare : la réponse porte
  `"metadata": {"result_with_testing_key": true}`.
- Deux protections en conséquence :
  - en production Vercel, des clés de test ferment le formulaire ;
  - et toute réponse marquée « clé de test » y est refusée, même si une clé de test avait
    échappé au premier filtre.

## Vérifications

- **Tests** :
  - 18 pour le module (lecture de la réponse, clés, appel réseau simulé, CSP, sentinelle) ;
  - 8 nouveaux pour la route : sans jeton, jeton refusé, mauvaise action ou mauvais site,
    faute de saisie sans appel, piège sans appel, Cloudflare injoignable, POST sans
    JavaScript, clés absentes ;
  - 2 de rendu ;
  - la règle d'ouverture revue.
- **Commandes** : `npx tsc --noEmit`, `npm run lint`, `npx vitest run --dir src` et
  `npm run build:check` passent.
- **Banc** (`lam_banc`, build de production, clés de test, vrais appels à Cloudflare) :
  - CSP élargie sur le formulaire seul, nonce du script identique à celui de l'en-tête ;
    aucune autre page ne charge Cloudflare ;
  - widget chargé (« Succès ! »), jeton produit, **aucune erreur dans la console** ;
  - envoi complet par le navigateur → confirmation, `humanVerifiedAt` en base, courriel avec
    « Vérification humaine : réussie » ;
  - sans jeton : 403 et `HUMAN_CHECK_FAILED` (motif `absent`), rien d'enregistré ;
  - page créole sur téléphone (375 px) : widget en français, aucun défilement horizontal.
  - Données d'essai retirées du banc.

## Côté Cloudflare et Vercel

Fait le 9 octobre 2026 par Me Vaval :

- widget « Agora — demandes d'inscription » : `agora.ht` et `www.agora.ht`, Managed, sans
  pre-clearance ;
- clé secrète remplacée aussitôt ;
- `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY` dans Vercel, en Production.

Procédure de rotation : voir la spécification.

## Reste à décider par la cliente

Les défauts sont appliqués en attendant :

- le formulaire exige JavaScript ;
- le widget est en français sur /ht ;
- si Cloudflare ne répond pas, la demande est refusée ;
- l'inscription des comptes n'est pas protégée en v1.

**À trancher avant l'ouverture du formulaire** : l'addition à la politique de confidentialité
(`docs/confidentialite-demandes-notaires.md`), qui nomme désormais Cloudflare, et la question
des cookies.
