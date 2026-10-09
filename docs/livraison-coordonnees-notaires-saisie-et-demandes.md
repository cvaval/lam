# Livraison : saisie des coordonnées par la rédaction (C) et demandes des tiers (D)

9 octobre 2026. Spécification : `docs/prompt-coordonnees-notaires.md`, chantiers C et D.

**État : en local, commité, NI POUSSÉ NI MIGRÉ.** Le formulaire des tiers est **fermé** par
défaut ; il ne s'ouvre qu'après la validation de l'addition à la politique de confidentialité
(`docs/confidentialite-demandes-notaires.md`).

## Chantier C : la rédaction saisit les coordonnées

- **Écran** `/{locale}/admin/notaires`, entrée « Notaires » du menu Corpus.
  - Capacité `corpus.manage` : éditeur et master admin.
  - Recherche par nom (module du chantier B) et liste des fiches existantes.
- **Fiche** `/{locale}/admin/notaires/{id}` : adresse, téléphones, courriel, autres noms pour la
  recherche, « à jour au », communiqué par, canal, observation interne, publiée ou non.
- **Mêmes règles que l'import** :
  - téléphones en E.164 ;
  - un numéro illisible est REFUSÉ et nommé dans le message ;
  - source et canal obligatoires ;
  - une entrée retirée (n° 37) ne reçoit pas de coordonnées.
- **Route** `PUT /api/admin/notaires/{id}/coordonnees`. `DELETE` est réservé au master admin ;
  pour retirer une fiche sans la perdre, on décoche « Publiée ».
- **Audit** `NOTARY_CONTACT_UPDATED`, avec l'état avant et après.

## Chantier D : la demande d'un tiers

### Le formulaire public

- **Adresse** : `/{locale}/juridictions/notaires/demande`, `noindex`, en fr, en et ht.
  **404 tant que `NOTARY_REQUESTS_ENABLED` ne vaut pas `true`.**
- **Trois liens discrets**, visibles seulement quand le formulaire est ouvert :
  - page du notaire : « Vous êtes ce notaire ? Proposer ou corriger les coordonnées » ;
  - bas de la section « Notaires » d'une commune : « Notaire absent de la liste ? Le signaler » ;
  - bas de la liste par juridiction : même lien.
- **Deux objets** : corriger ou ajouter les coordonnées d'un notaire listé ; signaler un
  notaire absent (commune parmi les 149).
- **Sans JavaScript** : `POST` classique, puis redirection 303.
- **Avec JavaScript** : la même route répond en JSON. La saisie reste à l'écran, chaque
  erreur s'affiche sous son champ, et le résumé en tête reçoit le focus.
- **Contre les abus, sans service tiers** :
  - champ piège et délai minimal de 3 s ;
  - 3 demandes par heure et par adresse IP ;
  - au-delà de 30 demandes par jour, un seul courriel de volume.
- **L'ordre des opérations** :
  1. la demande est enregistrée ;
  2. l'audit `NOTARY_REQUEST_CREATED` est écrit, avec l'IP mais **sans le contenu** ;
  3. un courriel part, « au mieux », vers `legal@agora.ht` (ou `NOTARY_REQUEST_ALERT_TO`) ;
  4. `notifiedAt` est rempli si le courriel est parti.
- **Le courriel** donne un résumé et un lien vers la demande.
  - Il ne contient **jamais** l'adresse du demandeur.
  - **Aucun envoi automatique au demandeur** : le site ne doit pas servir de relais.
- **La confirmation est identique dans tous les cas**, piège compris.

### La file du master admin

- **Écran** `/{locale}/admin/notaires/demandes`, entrée « Demandes de notaires » du menu
  Administration. **MASTER_ADMIN seulement**, avec un garde sur la page et un sur la route.
- **Pastille** : nombre de demandes NOUVELLES.
- **Tuile** sur la vue d'ensemble (nombre et âge de la plus ancienne). Elle n'apparaît que si
  le formulaire est ouvert ou qu'une demande attend.
- **Demande de coordonnées** : « Ouvrir la fiche pré-remplie » mène à l'écran du chantier C.
  - Rien n'est publié avant l'enregistrement.
  - L'enregistrement accepte la demande dans la même transaction.
  - Si le tiers n'avait choisi aucun notaire, la demande lui est rattachée à ce moment-là, et
    la file propose les notaires qui portent le nom saisi.
  - Provenance publique : « Coordonnées communiquées par l'étude, vérifiées par la rédaction
    d'Agora, à jour au … ».
- **Demande d'inscription** : « Inscrire ce notaire ».
  - Une **vérification consignée** est obligatoire : comment (10 caractères au moins) et quand.
  - Elle crée l'entrée `tiers-AAAAMMJJ-n` (édition `tiers`), puis ouvre sa fiche de
    coordonnées, pré-remplie avec la demande.
- **Refus** : motif interne. Aucun courriel n'est envoyé ; la réponse se fait à la main depuis
  legal@.
- **Audit** `NOTARY_REQUEST_DECIDED` à chaque décision. Une demande décidée ne se rouvre pas.

### Les notaires ajoutés hors de la liste du MJSP

- **La liste par juridiction compte à part** :
  - « 422 inscriptions affichées sur les 423 de la liste. » ;
  - puis « S'y ajoute 1 notaire absent de la liste, inscrit par la rédaction après
    vérification. »
- **Leur page** dit : « Notaire absent de la liste du MJSP, ajouté par la rédaction d'Agora
  après vérification, le … ».
- **Dans les listes**, ils portent la mention « · ajouté par la rédaction ». Ils sont classés
  après les inscriptions du MJSP.
- **La provenance « Liste publiée par le ministère… »** ne se lit plus jamais sur une entrée
  `tiers`.
- **L'import du MJSP** ignore les entrées `tiers` : il ne les compare pas et ne les signale pas
  comme orphelines.

### Conservation

Les demandes décidées depuis plus de 12 mois sont supprimées par le cron des sessions (Vercel
n'en accorde que deux à ce projet). `?simulation=1` les compte sans rien supprimer.

## Vérifications

- **Tests**, 58 nouveaux :
  - module pur (`notaires-demandes.test.ts`, 24) ;
  - route publique (10) ;
  - routes d'administration (13) ;
  - rendu (11).
  - Un test existant a été mis à jour : l'ordre des notaires est désormais « liste, puis
    ajoutés ».
- **Commandes** : `npx tsc --noEmit`, `npm run lint`, `npx vitest run --dir src` (1 652 tests)
  et `npm run build:check` passent.
- **Banc local** (`lam_banc`, build de production) :
  - formulaire ouvert :
    - demande valide enregistrée et notifiée ;
    - piège : rien d'enregistré ;
    - saisie invalide renvoyée avec ses champs ;
    - avec JavaScript : erreur sous le champ, saisie gardée, puis succès ;
  - courriel journalisé vers legal@agora.ht seulement, sans l'adresse du demandeur ;
  - inscription d'un notaire fictif, puis fiche pré-remplie et enregistrée ;
  - demande de coordonnées acceptée depuis la fiche ;
  - pages publiques et audit conformes ;
  - formulaire fermé (défaut) : 404 sur la page et la route, aucun lien, pas de tuile ;
  - gardes : 403 anonyme sur les routes, renvoi vers la connexion pour la file ;
  - cron en simulation : `demandesNotairesSupprimees: 0`.
  - Les données d'essai ont été retirées du banc (423 notaires, 5 fiches, 0 demande).

## Mise en production (sur instruction)

1. **Migration** : une seule table, additive (`NotaryRequest` et son index).
   - Vérifiée en lecture seule avec `prisma migrate diff` contre la production.
   - Puis `npx prisma db push`, et `npm run db:rls` (RLS sur la nouvelle table).
   - Le code se déploie sans danger avant la migration : toute lecture de la table absente
     se replie.
2. **`git push`**. Le chantier C est alors en ligne ; le formulaire D reste fermé.
3. **Pour ouvrir D**, après validation de l'addition à la politique de confidentialité :
   `NOTARY_REQUESTS_ENABLED=true` dans Vercel, puis redéployer.

## Décidé seul

1. **Créole** : les nouveaux libellés suivent la graphie du fichier `ht.ts` existant (« notè »,
   « lòt »…), comme les libellés des notaires déjà en ligne. La règle mémorisée de la cliente
   est de ne pas ajouter d'accent grave. Une relecture est donc à prévoir (voir la question 1
   ci-dessous).
2. **Demande sans notaire choisi** : elle se rattache au notaire au moment de l'acceptation
   (la spécification ne le prévoyait pas).
3. **Inscription** : après la création, la fiche s'ouvre pré-remplie avec les coordonnées
   déclarées. Rien n'est publié tant qu'on n'a pas enregistré.

## Questions à la cliente

1. **Libellés créoles** : faut-il les reprendre sans accent grave (« note », « lot »), et
   aligner du même coup ceux des notaires déjà en ligne ?
2. **Addition à la politique de confidentialité** : à valider. Elle comporte ses propres
   questions (base juridique, durée, traduction).
3. **Les questions 7 à 10 de la spécification** sont appliquées avec leurs défauts :
   - notaires seulement ;
   - preuve au choix du master admin, consignée ;
   - courriel = résumé et lien ;
   - 12 mois.
