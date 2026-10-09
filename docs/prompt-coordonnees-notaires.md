# Prompt : chercher un notaire, voir ses coordonnées, laisser un tiers les proposer

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (plateforme **Agora**,
> agora.ht).
>
> - **Version 2**, 9 octobre 2026, relue et complétée à la demande de Me Vaval : prénom
>   « Gemma » confirmé, demandes des tiers ajoutées.
> - Fait suite à `docs/prompt-notaires-et-couches-carte-judiciaire.md`, livré en local le même
>   jour (commits `234f6af` et `5a305ad`), **ni poussé ni migré**.
> - Note de livraison du chantier précédent : `docs/livraison-notaires-carte.md`.
> - **9 oct. 2026, soir : chantiers A0, A et B RÉALISÉS** (voir la note de livraison). Restent C
>   (saisie par la rédaction) et D (demandes des tiers).

---

## Ce qui est demandé

1. Quand on **cherche un notaire**, on voit son **adresse**, son **téléphone** et son
   **courriel**, s'ils sont connus.
2. Me Vaval fournit les coordonnées de **cinq notaires** ; d'autres suivront.
3. Un **tiers** (un notaire, son étude) peut **demander, discrètement**, à ajouter ou corriger
   ses coordonnées, ou à **figurer sur la carte** :
   - la demande va au **master admin** ;
   - une **notification** part par courriel à **legal@agora.ht**.

Cinq chantiers, livrés dans cet ordre :

| | chantier | contenu |
|---|---|---|
| A0 | le prénom de Me Gemma Anglade Gilles | correction décidée par la cliente, la liste restant reproduite |
| A | les coordonnées | modèle, amorçage des cinq, import |
| B | la recherche et l'affichage | recherche par nom, page de chaque notaire |
| C | la saisie par la rédaction | écran d'administration des coordonnées |
| D | les demandes des tiers | formulaire discret, file du master admin, courriel à legal@agora.ht |

## L'état de départ (vérifié le 9 octobre)

- **Le modèle `Notary`** (`prisma/schema.prisma`) porte les 423 entrées de la liste du MJSP.
  - Identifiant : `mjsp-<édition>-<n>`, édition `2026-09-08`.
  - **Une ligne = une entrée, pas une personne.**
  - La juridiction se déduit de la commune (rattachement technique `TPI_COMPETENT`), jamais
    stockée ; elle s'affiche sans « TPI ».
- **Le code des notaires** :
  - plan d'import : `src/lib/jurisdictions/notaires-plan.ts` ;
  - import : `scripts/import-notaires-mjsp.ts` ;
  - lectures : `src/lib/jurisdictions/data.ts` ;
  - affichage : `NotariesSection.tsx`, `NotaryDirectoryView.tsx`, page
    `src/app/[locale]/juridictions/notaires/page.tsx`.
- **La table `Notary` n'existe pas encore en production**, et rien n'y a été écrit.
  - Le banc local `lam_banc` (PostgreSQL sur localhost) porte le référentiel de la carte et
    les 423 notaires : c'est là qu'on teste.
  - Pour pousser le schéma sur le banc, utilise une copie de `schema.prisma` dont les URL
    sont écrites **en dur** vers localhost, lancée depuis un dossier sans `.env`.
  - **Jamais** via le `.env` du dépôt : il pointe sur la production.
- **La recherche de la carte** ne connaît que les 149 communes :
  - route `GET /api/public/jurisdictions/search` ;
  - fonction `searchPlaces()` dans `src/lib/jurisdictions/search-places.ts` ;
  - composant `JudicialSearch.tsx` (combobox ARIA, délai de 200 ms, 8 suggestions au plus).
- **Les courriels** passent par `sendMail()` (`src/lib/mail.ts`) :
  - service Resend, texte brut ;
  - **« au mieux »** : un échec est seulement journalisé, l'appelant n'en sait rien.
- **Le précédent à ne pas répéter.** Le 19 août 2026, quatre demandes d'accès sont restées
  **30 à 43 jours** sans réponse : rien n'alertait personne.
  - Depuis : alerte par courriel, pastille chiffrée dans `AdminNav` (`enAttente`), tuile
    donnant le nombre et l'âge de la plus ancienne demande.
  - Les demandes du chantier D suivent ce modèle.
- **legal@agora.ht** est publiée en pied de page.
  - Le MX d'agora.ht pointe chez HostGator (lu le 9 octobre).
  - Vérifie que la boîte **reçoit** avant d'en dépendre : un envoi de test, sur instruction.

## Les cinq premières coordonnées

Communiquées par Me Vaval le 9 octobre 2026. Toutes portent sur des entrées actives de
Port-au-Prince (juridiction de Port-au-Prince).

| n° | identifiant | imprimé par le MJSP | nom à afficher |
|---|---|---|---|
| 9 | `mjsp-2026-09-08-9` | Gamma ANGLADE GILLES | **Gemma** ANGLADE GILLES (chantier A0) |
| 11 | `mjsp-2026-09-08-11` | Patrick VICTOR | inchangé |
| 13 | `mjsp-2026-09-08-13` | Jean-Joseph Frantz CÉANT | inchangé |
| 17 | `mjsp-2026-09-08-17` | Marilyn Merceron CHARLES | inchangé |
| 21 | `mjsp-2026-09-08-21` | Gilbert Emile GIORDANI | inchangé |

| n° | adresse (telle que communiquée) | téléphone(s) | courriel |
|---|---|---|---|
| 9 | 394, route de Bourdon, Port-au-Prince | +509 2998-47-47 ; +509 4643-05-03 | etudeanglade@gmail.com |
| 11 | 14 rue Marcadieux, Bourdon, Port-au-Prince | +509 2942-3848 | patrickvictor@etudevictor.com |
| 13 | 390, ave John Brown, Bourdon | +509 2813-1299 | secretariat@etudenotaireceant.com |
| 17 | #52, Avenue Lamartinière, Bois-Verna, Port-au-Prince | +509 2940-4134 | etude_charles@yahoo.com |
| 21 | #3, rue Théodule, Bourdon, Port-au-Prince | *(non communiqué)* | Contact@etudegilbertgiordani.net |

**À savoir avant de les saisir.** Consigne chacun de ces points dans `observation` et reprends-le
dans la note de livraison.

1. **n° 21 et non n° 37.** Gilbert Emile GIORDANI figure deux fois : n° 21 (Port-au-Prince,
   actif) et n° 37 (Cité Soleil, retiré sur décision de la cliente).
   - Les coordonnées vont au n° 21.
   - Le **n° 2, « Danielle Giordani ADÉ »**, est une autre notaire. Une recherche « Giordani »
     la trouve, mais elle ne reçoit rien.
2. **n° 21, « Théodule ».**
   - La pièce jointe par Me Vaval (`scripts/data/notaires-coordonnees/piece-giordani-adresse.png`)
     écrit « Theodule » sans accent ; son message écrit « Théodule ».
   - Par défaut, retiens le message (question 3).
3. **n° 21, pas de téléphone.**
   - Le champ reste vide.
   - N'affiche ni « non communiqué » ni une ligne vide : affiche ce qui existe.
4. **n° 13, adresse sans commune** : reproduis-la telle quelle, sans ajouter « Port-au-Prince ».
5. **n° 9, deux numéros**, découpés différemment (« 2998-47-47 »).
   - Le second (46…) ressemble à un portable (question 4).
6. **n° 17, le rattachement** : par identifiant, jamais par recherche sur le nom. La liste compte
   une douzaine d'autres « CHARLES ».
7. **n° 21, le courriel** commence par une majuscule (« Contact@ ») : garde-le tel quel.
8. **Les adresses ne déplacent pas le notaire.** Il est commissionné pour une commune
   (décret-loi du 27 novembre 1969, art. 3 et 47).
   - Une adresse qui semblerait relever d'une autre commune est **signalée**, jamais
     « corrigée ».
   - **Aucune géolocalisation** : le 👤 reste au centroïde de la commune.

## Chantier A0 : « Gemma », décision de la cliente

Me Vaval l'a confirmé le 9 octobre 2026 : **le prénom est « Gemma »**. La liste du MJSP imprime
« Gamma » (n° 9). La règle de la liste tient toujours : elle se **reproduit**, on ne la corrige
pas. La correction prend donc la forme d'une **décision**, comme le retrait du n° 37 :

- **Le modèle `Notary` gagne `displayName String?`.**
  - `fullName` reste le nom imprimé.
  - `sourceJson.printed` garde la ligne d'origine.
- **L'amorçage `data/judicial-map/notaires-mjsp-v1.json` gagne une décision de nom**, validée
  par Zod et appliquée par le plan :
  - n° 9 ;
  - `displayName: « Gemma ANGLADE GILLES »` ;
  - décision du `2026-10-09` ;
  - observation : « prénom confirmé par la cliente ; la liste du MJSP imprime « Gamma » ».
- **Garde-fou** : l'import vérifie que le nom imprimé est toujours « Gamma ANGLADE GILLES ».
  Sinon, il le signale : la liste a peut-être été corrigée à la source.
- **Affichage** : partout `displayName ?? fullName` — fiche, liste, page, suggestions, points
  si un nom y figurait (il n'y en a pas).
- **Sur la page du notaire**, une mention discrète : « « Gamma » sur la liste du MJSP ».
- **Recherche** : « Gemma » et « Gamma » la trouvent toutes les deux.
- Seul le prénom est corrigé ; « ANGLADE GILLES » reste tel qu'imprimé (question 1).

## Deux autorités, toujours

La liste du MJSP dit **qui est notaire et où il est commissionné**. Les coordonnées disent
**comment joindre son étude**. Une demande de tiers n'est **qu'une déclaration** tant que la
rédaction ne l'a pas vérifiée.

- Les deux sources gardent chacune sa date et sa provenance.
- L'import du MJSP ne touche jamais aux coordonnées, et l'inverse non plus.
- Une demande ne modifie **rien** de publié avant la décision du master admin.

## Données personnelles : prudence, pas de jugement

Les coordonnées professionnelles d'un officier public restent des données personnelles au sens
de l'arrêté du 30 avril 2018 (en base, source `ARRETE_PDP_2018`). Le formulaire du chantier D en
collecte de nouvelles : le courriel de contact du demandeur.

Tu ne tranches pas la question juridique ; la cliente est juriste. Tu dois en revanche :

- **enregistrer la provenance** de chaque fiche (`sourceJson`) : qui, quand, par quel canal, sur
  quelle pièce ;
- **afficher une provenance en clair**, sans URL brute ni nom de fichier :
  - par défaut, « Coordonnées communiquées à la rédaction d'Agora, à jour au 9 octobre 2026 » ;
  - pour une demande acceptée, « Coordonnées communiquées par l'étude, vérifiées par la
    rédaction le … » ;
- **offrir la correction** :
  - le lien « Signaler une erreur » vers `erreur@agora.ht` (déjà en pied de page) ;
  - et le formulaire du chantier D ;
- **rédiger, sans la publier, l'addition à la politique de confidentialité** (`/confidentialite`)
  pour le formulaire : finalité, données, durée de conservation, destinataires. La cliente la
  valide avant toute mise en ligne du chantier D ;
- **ne mettre aucune coordonnée** dans les points de la carte ni dans les suggestions de
  recherche ;
- **n'envoyer aucun courriel aux notaires ni aux demandeurs**, et n'appeler personne pour
  « vérifier ».

## Chantier A : les coordonnées

Crée un modèle **séparé** de `Notary`. Les coordonnées ont leur propre provenance. Une nouvelle
édition de la liste du MJSP créera de nouveaux identifiants sans effacer les anciens : les fiches
devront alors être **rattachées de nouveau, explicitement**.

```prisma
model NotaryContact {
  id                String    @id            // contact-<notaryId>
  notaryId          String    @unique
  address           String?                 // verbatim, une ligne
  phonesJson        String    @default("[]") // E.164 : ["+50929423848"]
  email             String?                 // tel que communiqué
  searchAliasesJson String    @default("[]")
  observation       String?
  sourceJson        String    @default("{}") // providedBy, providedOn, channel, evidence, requestId
  upToDateOn        DateTime?               // « à jour au »
  active            Boolean   @default(true)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  notary Notary @relation(fields: [notaryId], references: [id])
}
```

- **Amorçage** : `data/judicial-map/notaires-coordonnees-v1.json`. Une entrée par notaire :
  - `notaryId` ;
  - `expectedName`, le `fullName` imprimé, qui sert de garde-fou ;
  - `address`, `phones` tels que communiqués, `email` ;
  - `observation`, `source`.
- **Normalisation, dans un module pur et testé**, partagé avec les chantiers C et D :
  - téléphone :
    - stocké en E.164 (`+509` suivi de 8 chiffres) ;
    - affiché uniformément (« +509 2998-4747 ») ;
    - lien `tel:+50929984747` ;
    - tout autre format est refusé ;
  - courriel : forme valide, gardé tel que communiqué ;
  - adresse : une ligne, 200 caractères au plus.
- **Contrôles bloquants**, calqués sur `scripts/import-notaires-mjsp.ts` :
  - le `notaryId` existe et l'entrée est **active** : le n° 37 est refusé ;
  - le `fullName` en base est égal à `expectedName`, à la normalisation près. C'est le verrou
    contre un décalage de numéros entre deux éditions ;
  - chaque coordonnée se normalise ;
  - aucun doublon ;
  - au moins une coordonnée par fiche ;
  - **RLS active** sur la table, sinon `--apply` est refusé.
- **Garanties** :
  - simulation par défaut ;
  - `--dry-run` et `--apply` sont exclusifs ;
  - import idempotent ;
  - **aucune suppression implicite** ;
  - rapport des créations, modifications, fiches inchangées et anomalies ;
  - audit `JUDICIAL_IMPORT` (`targetType: 'NotaryContactSeed'`), **recompté** après coup :
    `audit()` avale ses erreurs.
- **Repli tant que la table n'existe pas** (`estSchemaAbsent`) : les pages restent servies,
  sans coordonnées.

## Chantier B : chercher un notaire, voir ses coordonnées

### La recherche par nom

**Le module pur** : `src/lib/jurisdictions/search-notaries.ts`, testé.

- **Index** : les notaires **actifs**, avec `fullName`, `displayName` et les alias de leur fiche.
- **Normalisation** : `normalizePlaceName` (casse, accents, tirets).
- **Correspondance** :
  - tous les mots de la requête doivent se trouver dans le nom (ET) ;
  - le dernier mot peut n'être qu'un début de mot ;
  - tolérance : distance d'édition ≤ 1 (`boundedEditDistance`) sur les mots de 5 lettres et
    plus ;
  - la mention (« PDD ») n'est **pas** cherchable.
- **Le module renvoie tous les résultats classés.** C'est la route qui tronque.

**La table de tests**, tirée des données réelles :

| requête | résultat attendu |
|---|---|
| « Patrick Victor », « victor » | n° 11 |
| « Giordani » | n° 2 **et** n° 21, jamais n° 37 (inactif) |
| « Ceant », « céant », « CEANT » | n° 13 |
| « Marilyn Charles » | n° 17 seul, parmi les « CHARLES » |
| « Gemma », « Gamma », « Gemma Anglade » | n° 9, affiché « Gemma ANGLADE GILLES » |
| « Anglade » | n° 9 et n° 113 (Anglade GABEAUD) |
| « Saint-Louis » | les communes Saint-Louis-du-Nord et Saint-Louis-du-Sud **et** le n° 385 (Saint-Louis CHARLES) |
| « PDD » | aucun notaire |

**La barre de recherche de la carte.**

- La route renvoie des suggestions typées (`kind: 'commune' | 'notaire'`).
- **Partage des 8 places** : 5 au plus pour les communes, 5 au plus pour les notaires, 8 en
  tout. Sinon, sur « Saint-Louis », les communes masquent le notaire.
- Une suggestion de notaire ne porte que `id`, le nom affiché, `mention`, `communeId` et
  `communeName` : **aucune coordonnée**.
- `JudicialSearch` écrit le type en clair (« Notaire · Port-au-Prince ») et garde sa combobox
  ARIA. Choisir un notaire mène à sa page.
- Cherche d'abord les autres consommateurs de la route avant d'en changer la forme.

**La page `/{locale}/juridictions/notaires`** gagne un champ de recherche :

- formulaire `GET ?q=`, traité côté serveur ;
- il fonctionne **sans JavaScript** ;
- il garde le classement par juridiction.

### La page d'un notaire : `/{locale}/juridictions/notaires/[id]`

C'est **le seul endroit où s'affichent les coordonnées.**

- **L'identité** :
  - le nom affiché, la mention, et le nom imprimé s'il diffère ;
  - la commune, avec un lien vers sa fiche sur la carte ;
  - le département (référentiel) et la **juridiction** déduite, affichée **sans « TPI »** :
    les notaires ne dépendent pas des tribunaux de première instance (Me Vaval, 9 oct. 2026).
    Utiliser `nomJuridiction()` (`notaires-format.ts`).
- **Les coordonnées** : l'**adresse** ; les **téléphones** en liens `tel:` ; le **courriel** en
  lien `mailto:`.
- **Les sources** : la provenance de la liste et celle des coordonnées.
- **Les liens discrets** : « Signaler une erreur » et le lien du chantier D.
- **Sans coordonnées**, une phrase (« Coordonnées non communiquées »), et le reste de la page
  inchangé.
- **Les cas limites** :
  - entrée inactive (n° 37) ou identifiant inconnu : **404** ;
  - entrée sans commune (le cas ne se présente plus depuis le rattachement de Petit-Bourg à
    Port-Margot, mais le mécanisme demeure) : la page est servie.
- **L'indexation** : `noindex` par défaut (question 5), et les mêmes `alternates` de langue que
  les autres pages publiques.

### Ailleurs : un lien, pas les coordonnées

Dans « Notaires (N) » de la fiche de la commune et dans la liste par juridiction :

- **chaque nom devient un lien** vers sa page ;
- quand une fiche existe, une mention discrète « coordonnées » l'annonce.

**Les coordonnées elles-mêmes n'y figurent pas.**

- La liste est une page indexée ; la page d'un notaire est en `noindex`.
- L'API publique `communes/[id]` renvoie la fiche entière : y mettre les coordonnées
  permettrait de toutes les aspirer en 149 appels.
- Cohérence : les coordonnées n'existent qu'à un endroit (question 6).

### Les libellés

Prévois fr, en et ht pour : Adresse, Téléphone, Courriel, Coordonnées, « Coordonnées non
communiquées », les lignes de provenance, « Signaler une erreur », « Rechercher un notaire », le
type « Notaire » dans les suggestions, et tout le formulaire du chantier D.

Reprends le vocabulaire de `ht.ts` (« Adrès », « Notè »). Fais valider le créole par la cliente,
selon sa convention : aucun accent grave ajouté à ce qu'elle écrit sans.

## Chantier C : la rédaction saisit les coordonnées

- **L'écran** : `/{locale}/admin/notaires`, capacité `corpus.manage` (éditeur et master admin).
  **Deux gardes**, une sur la page et une sur la route.
- **Ce qu'il permet** :
  - chercher un notaire, avec le module du chantier B ;
  - créer ou modifier sa fiche : adresse, téléphones, courriel, alias, provenance, date « à jour
    au » ;
  - désactiver une fiche ;
  - la suppression définitive est réservée au master admin.
- **La validation** est celle du chantier A, avec le même schéma Zod.
- **L'audit** : action `NOTARY_CONTACT_UPDATED`, avec l'avant et l'après. Ajoute-la au type
  `AuditAction` (`src/lib/auth/audit.ts`).

## Chantier D : la demande d'un tiers

### Discrète

- **Aucune entrée dans la navigation principale.** Pas de bannière, pas de fenêtre surgissante.
- **Trois liens en petit texte** :
  - sur la page d'un notaire : « Vous êtes ce notaire ? Proposer ou corriger vos coordonnées »
    (formulaire prérempli avec cet identifiant) ;
  - au bas de « Notaires (N) » dans la fiche de la commune ;
  - au bas de la liste par juridiction : « Notaire absent de la liste ? »

### Le formulaire : `/{locale}/juridictions/notaires/demande`

- **La route** :
  - segment statique, il l'emporte sur `[id]` (aucun identifiant ne s'appelle « demande ») ;
  - `noindex` ;
  - **il fonctionne sans JavaScript** : `POST` vers
    `/api/public/jurisdictions/notaires/demandes`, puis redirection 303 vers une confirmation.
- **Deux types de demande** :
  1. **Ajouter ou corriger les coordonnées** d'un notaire déjà sur la carte (identifiant
     prérempli, ou nom à saisir) ;
  2. **Figurer sur la carte** : notaire absent de la liste du MJSP. La **commune de
     commissionnement** est choisie parmi les 149.
- **Les champs** :
  - nom et prénom ;
  - qualité du demandeur : le notaire, son étude, autre (à préciser) ;
  - adresse de l'étude ;
  - téléphone(s) ;
  - courriel à publier ;
  - message, 1 000 caractères au plus ;
  - **courriel de contact du demandeur**, obligatoire, **jamais publié**, pour que la rédaction
    puisse vérifier ;
  - case de consentement : « J'accepte que ces informations soient vérifiées puis, le cas
    échéant, publiées par Agora », avec un lien vers la politique de confidentialité.
- **La validation** reprend la normalisation du chantier A. Les erreurs s'affichent à côté de
  leur champ, en fr, en et ht.
- **La confirmation est toujours la même**, que le notaire ait déjà une demande ou non : rien ne
  doit permettre d'apprendre qui a écrit quoi.

### L'enregistrement d'abord, le courriel ensuite

```prisma
model NotaryRequest {
  id             String    @id @default(cuid())
  kind           String    // CONTACT | LISTING
  notaryId       String?   // pour CONTACT
  payloadJson    String    // champs validés et normalisés
  requesterName  String
  requesterRole  String    // NOTAIRE | ETUDE | AUTRE
  requesterEmail String    // jamais publié
  locale         String
  status         String    @default("NOUVELLE") // NOUVELLE | EN_COURS | ACCEPTEE | REFUSEE
  decidedById    String?
  decidedAt      DateTime?
  decisionNote   String?
  notifiedAt     DateTime? // courriel à legal@ envoyé (Resend a répondu 2xx)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@index([status, createdAt])
}
```

L'ordre des opérations :

1. **Validation complète** (Zod) ; le champ piège rempli (voir plus bas) est rejeté en silence.
2. **Enregistrement en base.** RLS active dès la création de la table.
3. **Audit `NOTARY_REQUEST_CREATED`** avec l'adresse IP, **sans le contenu**.
4. **Courriel à legal@agora.ht**, dans un `try` qui ne fait jamais échouer la demande.
   - `sendMail()` ne dit pas s'il a réussi : fais-lui renvoyer un booléen, ou écris une
     variante, pour remplir `notifiedAt`.
   - Une demande sans `notifiedAt` reste visible dans la file.
5. **Redirection** vers la confirmation.

**Le courriel de notification** :

- **Destinataire** : `legal@agora.ht`, surchargeable par `NOTARY_REQUEST_ALERT_TO`. **Jamais**
  l'adresse saisie par le demandeur. Un accusé de réception automatique ferait du site un relais
  pour écrire à n'importe qui.
- **Objet fixe**, sans texte saisi : « [Agora] Demande n° {8 premiers caractères} —
  coordonnées | inscription ». Aucun retour à la ligne ne peut y entrer.
- **Corps en texte brut** :
  - le type, le nom du demandeur, le notaire concerné, la commune et la date ;
  - un **lien vers la demande** dans le back-office.
- **Par défaut, ni téléphone, ni courriels, ni message dans le corps** : on les lit dans le
  back-office, derrière l'authentification (question 9).

### La file du master admin

- **Les écrans** : `/{locale}/admin/notaires/demandes` et le détail de chaque demande.
  - Réservés au **rôle MASTER_ADMIN**, comme demandé. Une capacité partagée avec l'éditeur ne
    suffit pas.
  - Deux gardes, page et route.
- **La pastille** : le nombre de demandes **NOUVELLE** dans `AdminNav`, plus une tuile donnant
  le nombre et l'**âge de la plus ancienne** (leçon du 19 août).
- **Le traitement** :
  - **Accepter une demande de coordonnées** ouvre l'éditeur du chantier C, prérempli. Rien
    n'est publié avant son enregistrement.
    - `sourceJson.requestId` relie la fiche à la demande.
    - Provenance publique : « communiquées par l'étude, vérifiées par la rédaction le … ».
  - **Accepter une demande d'inscription** ne crée rien automatiquement. Le master admin
    vérifie (acte de commission, confirmation du MJSP…), consigne **comment**, puis crée
    l'entrée (voir plus bas).
  - **Refuser**, avec une note interne.
  - La réponse au demandeur se fait **à la main**, depuis legal@.
  - Audit `NOTARY_REQUEST_DECIDED` (avant et après le statut).
- **La conservation** : une demande refusée ou traitée est purgée au bout de **12 mois**
  (question 10), par une tâche calquée sur la purge des sessions (`/api/cron/sessions`).

### Les notaires ajoutés hors de la liste du MJSP

Une inscription acceptée crée une entrée `Notary` **distincte** de la liste :

- identifiant `tiers-<aaaammjj>-<n>`, édition `tiers` ;
- `sourceDepartment` et `sourceCommune` = la commune déclarée ;
- `sourceJson` : la demande, qui a vérifié, quand, comment.

Ce que cela oblige à corriger dans le code de la couche notaires :

- **L'import du MJSP** ne compare et ne signale comme orphelines que les entrées de **son
  édition**. Sinon, chaque import signalerait les entrées `tiers` comme « absentes du
  fichier ».
- **La liste par juridiction** ne dit plus « 422 inscriptions affichées sur les 423 de la
  liste ». Elle compte à part : « 422 inscriptions de la liste du MJSP, N ajoutées après
  vérification par la rédaction ».
- **La provenance est par entrée** : la ligne « Liste publiée par le ministère… » ne vaut pas
  pour une entrée `tiers`.
- **Les totaux par TPI de l'import** portent sur les entrées du MJSP. Les tests qui recomptent
  422 restent vrais **par source**.

### Contre les abus

Sans captcha tiers : la CSP n'autorise que `connect-src 'self'`.

- **Champ piège** caché, plus un temps de remplissage minimal.
- **Frein persistant par IP** : `guardPersistent` sur l'action `NOTARY_REQUEST_CREATED`, par
  défaut 3 demandes par heure.
- **Plafond global** : au-delà de 30 demandes par jour, on enregistre toujours, mais **un seul
  courriel** signale le volume anormal.
- **Pièces jointes** : aucune en v1. Le master admin les demande par courriel.

## Ce que la cliente doit trancher

Le prénom « Gemma » est **réglé** (chantier A0). Pour le reste, applique le défaut et signale-le
dans la note de livraison.

| # | question | défaut proposé |
|---|---|---|
| 1 | n° 9 : seul le prénom change (« Gemma ANGLADE GILLES »), ou le nom d'usage est-il « Gemma Anglade » ? | seul le prénom |
| 2 | Coordonnées publiques, ou réservées aux comptes connectés ? | publiques, sur la page du notaire seulement |
| 3 | n° 21 : « Théodule » (message) ou « Theodule » (pièce) ? | « Théodule » |
| 4 | n° 9 : le second numéro (+509 4643-0503) est-il professionnel ? | publié, puisque transmis |
| 5 | Pages de notaire indexées par les moteurs de recherche ? | non (`noindex`) |
| 6 | Coordonnées aussi dans la fiche de la commune et dans la liste ? | non : un lien vers la page |
| 7 | Qui peut demander à figurer sur la carte : seulement les notaires, ou toute profession juridique (couches à venir) ? | notaires seulement en v1 |
| 8 | Quelle preuve exiger avant d'inscrire un notaire absent de la liste du MJSP ? | au choix du master admin, consignée |
| 9 | Contenu du courriel à legal@agora.ht : résumé et lien, ou demande complète ? | résumé et lien |
| 10 | Durée de conservation des demandes traitées | 12 mois |
| 11 | Texte ajouté à la politique de confidentialité (rédigé par la session) | à valider avant la mise en ligne du chantier D |
| 12 | Format des numéros et ligne de provenance | « +509 XXXX-XXXX » ; « Coordonnées communiquées à la rédaction d'Agora, à jour au … » |

## Vérification

**Tests `vitest`** (`npx vitest run --dir src`) :

- **A0** : le n° 9 s'affiche « Gemma », `fullName` reste « Gamma » ; le garde-fou signale un nom
  imprimé modifié ; idempotence.
- **A** :
  - la normalisation des téléphones (« +509 2998-47-47 » → `+50929984747`, affiché
    « +509 2998-4747 ») ;
  - le plan d'import : les cinq fiches, `expectedName` faux, n° 37, numéro à 7 chiffres,
    idempotence, aucune suppression.
- **B** :
  - toute la table de recherche, et le partage des 8 places ;
  - aucune coordonnée dans les suggestions ;
  - le rendu de la page d'un notaire : complète (n° 9, deux `tel:`), partielle (n° 21, aucune
    ligne de téléphone), sans fiche ; 404 pour le n° 37 ;
  - **aucune coordonnée** dans la fiche de la commune, la liste, l'API `communes/[id]` ni les
    points.
- **C** : les gardes, l'audit avant/après.
- **D** :
  - le champ piège ;
  - le frein par IP et le plafond global ;
  - **l'enregistrement survit à un échec d'envoi** (`notifiedAt` reste vide) ;
  - le courriel part **uniquement** à legal@ (ou `NOTARY_REQUEST_ALERT_TO`), avec un objet sans
    texte saisi ;
  - **aucun courriel au demandeur** ;
  - la même confirmation dans tous les cas ;
  - la file réservée au MASTER_ADMIN (un éditeur obtient un refus) ;
  - la pastille ;
  - une inscription acceptée crée une entrée `tiers` ;
  - l'import du MJSP ne la signale pas comme orpheline, et la liste la compte à part.

Lance ensuite `npm run typecheck && npm run lint` et **`npm run build:check`**. Jamais
`npm run build`.

**Contrôle à l'écran sur le banc local**, sur ordinateur et sur mobile, dans les trois langues
et sans JavaScript :

- « Gemma » dans la barre de la carte → sa page : deux numéros cliquables et le courriel ;
- « Giordani » → n° 2 et n° 21, rien à Cité Soleil ;
- « Ceant » → « 390, ave John Brown, Bourdon » ;
- la fiche de Port-au-Prince : les noms en liens, aucune coordonnée en clair ;
- une demande envoyée sans JavaScript → confirmation, ligne en base, pastille dans l'admin.
  Le courriel est journalisé en console : sans `RESEND_API_KEY`, rien ne part en local.

## Contraintes du dépôt

- **`.env` = base de PRODUCTION.**
  - `prisma db push`, `npm run db:rls`, tout `--apply`, tout envoi réel de courriel de test,
    tout `git push` ou déploiement attendent une **instruction explicite de Me Vaval**.
  - En production, il faudra créer **les trois tables** (`Notary` n'y est pas encore), activer
    la RLS, importer les notaires, puis les coordonnées.
  - La base était à 475 Mo le 9 octobre : vérifie la place avant de migrer.
- **Commits** :
  - `git add` fichier par fichier, jamais `-A` ;
  - relis le diff complet de tout fichier partagé ;
  - un outil de maquette écrit en parallèle dans `src/components/agora-portal.css`.
- **MapLibre** reste épinglé en 5.24.0.

## Livraison

- **La note `docs/livraison-coordonnees-notaires.md`**, brève :
  - ce qui est fait ;
  - les cinq fiches telles qu'enregistrées ;
  - les douze questions et leurs défauts ;
  - le texte proposé pour la politique de confidentialité ;
  - ce que tu as décidé seul ;
  - des captures : la recherche « Gemma », la page du n° 9, le formulaire, la file du master
    admin.
- **La mise à jour de `docs/carte-judiciaire.md`** : les coordonnées, la manière d'en ajouter,
  les demandes des tiers et les entrées `tiers`.
- **Le commit** se fait fichier par fichier. **Ne pousse pas** sans instruction. Rapporte.
