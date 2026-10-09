# Politique de confidentialité : addition pour les demandes des notaires (PROJET)

**À valider par Me Vaval. Rien de ce texte n'est publié.** Le formulaire public reste fermé
(`NOTARY_REQUESTS_ENABLED` absent) tant que cette addition n'est pas validée **et** versée dans
`src/lib/legal.ts` (`CONFIDENTIALITE`).

9 octobre 2026. Fonctionnalité : `docs/livraison-coordonnees-notaires-saisie-et-demandes.md`.

## Ce que le formulaire collecte

| donnée | pourquoi | publiée ? |
|---|---|---|
| nom du demandeur, qualité (le notaire, son étude, autre) | savoir qui déclare | non |
| courriel du demandeur | lui répondre **à la main** | **jamais** ; aucun courriel automatique ne lui est envoyé |
| nom du notaire, commune de commission | identifier l'inscription visée | oui, **après vérification** (inscription) |
| adresse, téléphones, courriel de l'étude | les publier sur la page du notaire | oui, **après vérification** par la rédaction |
| précisions libres | contexte de la demande | non |
| adresse IP | frein anti-abus (3 demandes par heure) | non ; journal de sécurité, 12 mois comme les données de connexion |
| signaux techniques du navigateur (adresse IP, empreinte TLS, en-tête User-Agent) | vérification humaine par **Cloudflare Turnstile**, sur la seule page du formulaire | non ; traités par Cloudflare |

## Additions proposées, section par section

### § 2.1 Données fournies par l'utilisateur — ajouter

> Demandes relatives aux notaires : nom, qualité et adresse électronique de la personne qui
> écrit ; nom, commune et coordonnées professionnelles de l'étude notariale (adresse,
> téléphones, adresse électronique) ; précisions éventuelles.

### § 3 Finalités — ajouter

> Tenue de la liste des notaires de la carte judiciaire : examen des demandes d'ajout ou de
> correction des coordonnées d'une étude, ou d'inscription d'un notaire absent de la liste
> publiée par le ministère de la Justice et de la Sécurité publique.

### § 4 Base juridique — ajouter à « Consentement »

> … et pour les demandes relatives aux notaires, recueilli par une case à cocher avant l'envoi.

### § 5 Durée de conservation — ajouter

> Demandes relatives aux notaires : jusqu'à la décision de la rédaction, puis douze (12) mois
> après cette décision. Les coordonnées professionnelles publiées le restent tant que l'étude
> ne demande pas leur retrait ou leur correction.

### § 6 Destinataires — préciser

> Une demande relative aux notaires est lue par l'administrateur de la Plateforme ; une
> notification, sans le courriel du demandeur, est adressée à legal@agora.ht.

et ajouter à la liste des prestataires :

> Prestataire de vérification anti-robot : Cloudflare, Inc. (Turnstile), sur la seule page du
> formulaire de demande relatif aux notaires, pour distinguer une personne d'un programme
> automatisé.

### § 7 Localisation et hébergement — ajouter

> La vérification anti-robot du formulaire de demande est assurée par Cloudflare, Inc.
> (États-Unis).

### § 9 Cookies — à trancher (question 5 ci-dessous)

Ce que dit Cloudflare (politique de confidentialité de Turnstile, consultée le 9 octobre 2026,
https://www.cloudflare.com/turnstile-privacy-policy/) :

- Turnstile traite des « signaux » : adresse IP, empreinte TLS, en-tête User-Agent, clé du
  widget et origine ;
- ces signaux servent « uniquement à détecter et bloquer les robots », et Cloudflare s'en sert
  aussi pour améliorer Turnstile (il en est alors responsable de traitement) ;
- Cloudflare qualifie ces signaux de « strictement nécessaires » à la détection des robots ;
- la page ne dit PAS si Turnstile dépose un cookie ou utilise le stockage du navigateur : elle
  renvoie à la politique de cookies de Cloudflare.

Rien de plus ne doit être affirmé dans la politique d'Agora sans l'avoir vérifié.

### § 10 Droits — rien à ajouter

Le droit de retrait et de rectification s'exerce déjà par legal@agora.ht. Une étude peut aussi
reprendre le formulaire pour corriger ses coordonnées.

## Questions à la cliente

1. **Base juridique** : le consentement (case à cocher) suffit-il, ou faut-il viser aussi
   l'intérêt légitime (exactitude d'un annuaire professionnel) ?
2. **Durée** : 12 mois après la décision, comme les données de connexion. Plus court ?
3. **Coordonnées publiées** : la politique doit-elle dire qu'elles sont **professionnelles**
   et publiées à la demande de l'étude, pour les distinguer des données des abonnés ?
4. **Version créole et anglaise** de l'addition : à traduire, ou la politique reste-t-elle en
   français seulement, comme aujourd'hui ?
5. **Turnstile et le bandeau de cookies** : la vérification anti-robot relève-t-elle des
   traceurs « strictement nécessaires » (sécurité), sans consentement préalable ? Le formulaire
   ne fonctionne pas sans elle.

## Pour ouvrir le formulaire, une fois validé

1. Verser l'addition dans `src/lib/legal.ts`.
2. Dans Vercel (Production), définir `NOTARY_REQUESTS_ENABLED=true`. Facultatif :
   `NOTARY_REQUEST_ALERT_TO` (par défaut `legal@agora.ht`).
3. Redéployer. Les liens discrets apparaissent alors sur la page de chaque notaire, sous la
   section « Notaires » d'une commune et au bas de la liste par juridiction.
