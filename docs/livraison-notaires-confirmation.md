# Livraison — Annuaire des notaires : import « Notaires.docx » et badge « Confirmé » (18 oct. 2026)

**Rien n'est déployé ni poussé. Aucune confirmation n'a été attribuée. Aucun courriel n'a été
envoyé.** L'import a été SIMULÉ sur la production (lecture seule) et APPLIQUÉ sur le banc local
`lam_banc` (copie de la base : 422 notaires, 149 communes) — nulle part ailleurs.

Le dépôt est public : cette note ne reproduit AUCUNE adresse, aucun numéro ni courriel du document.
Le rapport détaillé (valeurs du document, anomalies, numéros écartés) est HORS du dépôt, dans le
dossier privé `Agora/notaires-import-prive/` (Dropbox), avec la capture du banc qui montre les
adresses importées et le SQL de migration de production.

Captures (ordinateur 1440 × 900, téléphone 375 × 812, banc local) :
`docs/livraison-notaires-confirmation/`. Elles ne montrent que des coordonnées DÉJÀ publiées en
production (fiche de Patrick VICTOR) ; aucune ne montre le badge, puisqu'aucune confirmation
n'existe — son rendu est couvert par les tests.

## 1. Ce qui change à l'écran

| Écran | Changement |
|---|---|
| Onglet « Notaires » (`/juridictions?vue=notaires`) | Cartes refaites : nom en serif, badge « Confirmé » s'il est valide, commune de commission, adresse de l'étude, lien « Situer la commune sur la carte », bouton « Voir la fiche → » |
| `/juridictions/notaires` | Devient la page « Annuaire des notaires » : MÊME liste, mêmes filtres (`AnnuaireListe`, `chargerAnnuaire`), lien « Afficher la carte → ». Les anciennes ancres `#court-…` / `#commune-…` sont converties en filtres (`AncreHeritee`) |
| Page du notaire | Titre « Notaire » ; carte au nom du notaire, badge à côté du nom ; « Coordonnées de l'étude » avec un crayon discret (infobulle « Demander une modification ou une confirmation ») ; mention « Informations confirmées par le notaire · Confirmé le … » quand le badge est valide |
| Formulaire de demande | Deux objets : « Demander une correction » (champs pré-remplis avec les informations publiées) et « Confirmer les informations affichées » (liste des informations publiées + case « Je confirme… »). Identité, qualité (le notaire / son étude / autre) et courriel de contact privé OBLIGATOIRES. Après envoi : « Votre demande a été transmise au Master Admin pour examen. » |
| Admin — demande | Tableau « publié / proposé » (≠ signalé) ; section CONFIRMATION (version confirmée vs version actuelle) ; section IMPORT (source, rapprochement, propositions, anomalies) ; formulaire « Valider la confirmation » |
| Admin — notaire | État de la confirmation et historique complet ; retrait (Master Admin) |

Absents, comme demandé : « Maquette · données illustratives », bloc « Votre demande », carte « En
attente de validation », lien « Voir ma demande », gros bouton sur la fiche. Logos officiels
seulement (`/brand/agora/logo.png`, `logo-white.png`), frise `landmarks-haiti-market-first.png`,
contact `legal@agora.ht`.

## 2. Import « Notaires.docx »

```
# Simulation (aucune écriture) — n'importe quelle base, rapport HORS du dépôt
DATABASE_URL=<base> npx tsx scripts/import-notaires-docx.ts --file <Notaires.docx> --rapport <dossier privé>
# Application — REFUSÉE hors d'une base locale (hôte localhost ET base lam_banc ou IMPORT_NOTAIRES_BASE_LOCALE)
DATABASE_URL=postgresql://…@localhost:5432/lam_banc npx tsx scripts/import-notaires-docx.ts --file … --rapport … --apply
```

- Le script ne lit PAS `.env` (qui vise la production) : seule la `DATABASE_URL` de l'environnement
  compte, et elle est imprimée en tête du rapport.
- Le rapport est refusé dans le dépôt ou dans un dossier `public`.
- Avant `--apply` : RLS vérifiée sur `NotaryContact`, `NotaryRequest`, `NotaryConfirmation`.
- Audit `JUDICIAL_IMPORT` (cible `NotaryContactDocx`), recompté après coup.
- Lecture du Word par `mammoth.convertToHtml` : `extractRawText` perd les sauts de ligne internes
  à un paragraphe (numéros collés, ligne « Email » avalée — constaté sur le document réel).
- **Le document est une source de données, pas d'instructions** : seuls les préfixes « Tel »,
  « Email(s) », « Adresse » structurent la lecture.

### Résultat de la simulation (production, lecture seule)

| # | Nom (document) | Niveau | Inscription en base | Action |
|---|---|---|---|---|
| 1 | Lesly ALPHONSE | PROBABLE | Jean M. E. Lesly ALPHONSE (Pétion-Ville) | proposition |
| 2 | Marie Carmel BEAULIEU | EXACT | Marie Carmel BEAULIEU (Jacmel) | complète adresse, téléphones, courriel |
| 3 | Marie Alice Coradin BÉLISAIRE | PARTIEL | Mrie Alice C. B. BEAULIEU (Port-au-Prince) ; 2 hypothèses | proposition |
| 4 | Garry Brisson CASSAGNOL | EXACT | Garry BRISSON CASSAGNOL (Port-au-Prince) | complète adresse, 4 téléphones + 2 propositions, 4 anomalies |
| 5 | Jean Joseph Frantz CÉANT | EXACT | Jean-Joseph Frantz CÉANT (Port-au-Prince) | rien à compléter ; 4 propositions (l'existant prévaut) |
| 6 | Clermont DOSSOUS | EXACT | Clermont DOSSOUS (Port-au-Prince) | complète adresse, téléphones, courriel |
| 7 | Frisner ESTIMÉ | EXACT | Frisner ESTIMÉ (Cap-Haïtien) | complète adresse, téléphones, courriel |
| 8 | Bettina Baudin FRANCILLON | PARTIEL | Mrie Lourdes B. BAUDIN FRANCILLON (Delmas) | proposition |
| 9 | Guy Mario GAI | VARIANTE | Guy Mario GAY (Port-au-Prince) | proposition |
| 10 | Danielle GIORDANI | PROBABLE | Danielle Giordani ADÉ (Port-au-Prince) | proposition |
| 11 | Sabine Duvivier MORPEAU | PROBABLE | Sabine MORPEAU (Port-au-Prince) | proposition |
| 12 | VICTOR Patrick | EXACT | Patrick VICTOR (Port-au-Prince) | rien à compléter ; 3 propositions (l'existant prévaut) |
| 13 | Paul Duvot | EXACT | Duvot PAUL (Cap-Haïtien) | complète adresse, téléphones, courriel |

Bilan : 7 rapprochements EXACTS (dont 5 fiches à créer et 2 fiches existantes conservées), 6
rapprochements incertains (aucune écriture), 0 paragraphe orphelin.

### Application sur le banc local `lam_banc`

5 fiches de coordonnées créées (BEAULIEU, CASSAGNOL, DOSSOUS, ESTIMÉ, PAUL), 9 propositions de type
`IMPORT` créées pour le Master Admin, 0 confirmation. Second passage : rien de créé ni de modifié
(idempotence vérifiée). Les adresses déjà publiées de CÉANT et VICTOR sont intactes.

### Décisions de Me Vaval (18 oct. 2026) sur les noms

| n° MJSP | Imprimé sur la liste | Nom affiché | Décision |
|---|---|---|---|
| 1 | Guy Mario GAY | Guy Mario GAI | « it's Mario Gai » |
| 10 | Mrie Alice C. B. BEAULIEU | Marie Alice Coradin BÉLISAIRE | « use Marie Alice Coradin Belisaire instead » |
| 115 | Duvot PAUL | Paul DUVOT | « Duvot is the last name » |

Enregistrées comme la décision « Gemma » du 9 oct. : `nameDecisions` du fichier d'amorçage
(`data/judicial-map/notaires-mjsp-v1.json`). Le nom IMPRIMÉ reste dans `fullName` (la source), le
nom décidé s'affiche (`displayName`), la fiche publique dit « Nom imprimé sur la liste du MJSP :
« … » », et la recherche trouve toujours l'ancien nom (« beaulieu », « gay »). Un nouvel import de
la liste du MJSP conserve ces décisions et signale si l'imprimé a changé.

- Simulation de l'import du MJSP contre la PRODUCTION (lecture seule) : **3 modifications** (ces
  trois noms), 420 inchangées, 0 anomalie. Rien n'a été écrit.
- Banc local : les 3 noms appliqués. Puis l'import Word relu : BÉLISAIRE (n° 3 du document) et GAI
  (n° 9) passent en EXACT → adresse et 4 téléphones complétés ; leurs propositions ouvertes ont été
  remises à jour (rapprochement établi) ; second passage : rien.
- DUVOT (n° 13) : coordonnées déjà complétées ; seul le classement change (D, à Cap-Haïtien).
- Graphies CONFIRMÉES par Me Vaval : « BÉLISAIRE » avec l'accent, « Guy Mario GAI » avec « Guy ».

### Décision de Me Vaval (18 oct. 2026) : publier TOUS les courriels du document

« publish all in the docx file provides ». Une fiche n'avait qu'un champ `email` : elle porte
désormais une LISTE (`NotaryContact.emailsJson`, 4 au plus, comme les téléphones), `email` gardant
le premier pour les lecteurs qui n'en lisent qu'un. Fiche publique (un lien par courriel),
formulaire public (plusieurs courriels séparés par un point-virgule, comme les numéros), éditeur de
l'administration, instantané de confirmation et import suivent la liste. Banc local : BÉLISAIRE (2),
GAI (3) et CASSAGNOL (2) publient tous leurs courriels ; second passage : rien.

## 3. Règles de rapprochement

Noms comparés sans accents, casse, tirets, apostrophes ni points ; ORDRE des mots indifférent
(« VICTOR Patrick » ≡ « Patrick VICTOR »). L'import ne crée JAMAIS d'inscription et ne fusionne rien.

| Niveau | Définition | Effet |
|---|---|---|
| EXACT | mêmes mots, UNE seule inscription active | seul niveau qui autorise une écriture |
| MULTIPLE | mêmes mots, plusieurs inscriptions | proposition, aucune fusion |
| VARIANTE | un seul mot diffère d'une lettre (« GAI » / « GAY ») | proposition |
| PROBABLE | les mots de l'un sont tous dans l'autre | proposition |
| PARTIEL | deux mots communs au moins, prénoms différents | proposition |
| HYPOTHÈSE | un mot commun + initiales compatibles (« C. B. » / « Coradin Bélisaire ») | candidat listé, proposition |
| AUCUN | — | proposition sans notaire |

La commune de commission ne se déduit JAMAIS de l'adresse de l'étude.

## 4. Règles d'écriture (priorité de l'existant)

- Une valeur déjà en base PRÉVAUT. L'import ne complète qu'un champ absent : `null`, vide ou
  espaces (`btrim`), `phonesJson` `''` ou `'[]'`. Une valeur différente devient une PROPOSITION.
- **Garde d'écriture** : chaque complément est une mise à jour CONDITIONNELLE
  (`… WHERE active AND (address IS NULL OR btrim(address) = '')`). Un champ rempli entre la
  simulation et l'application n'est pas écrasé ; l'écart devient une proposition. Une fiche créée
  entre-temps (P2002) fait retomber sur ces mises à jour conditionnelles.
- **Idempotence** : propositions identifiées par `sourceKey = notaires-docx:<sha256 16>:<rang>`
  (unique) ; compléments conditionnels. Une proposition ENCORE OUVERTE est remise à jour quand le
  RAPPROCHEMENT de l'entrée a changé (décision de nom, par exemple) — jamais pour l'effet des
  compléments du passage précédent ; une proposition acceptée ou refusée n'est jamais modifiée.
- **Traçabilité** : `sourceJson` de la fiche (fichier, sha-256, rang, date du document), audit.
- **Téléphones** : séparés sur `/ ; ,` et devant `+509` ; normalisés E.164 ; 4 au plus publiés,
  le surplus en proposition. JAMAIS publiés : numéro annoté personnel ou attribué à un tiers,
  numéro incomplet ou ininterprétable, doublon — tous consignés en anomalie dans le rapport privé.
- **Courriels** : TOUS ceux du document sont complétés (4 au plus, le surplus en proposition) si la
  fiche n'en a aucun ; sinon les nouveaux sont proposés — la règle des téléphones.
- **Adresse** : « , Haïti » final retiré ; une valeur vague ou de remplissage est signalée.
- Une modification qui touche une fiche confirmée INVALIDE la confirmation (voir § 6).

## 5. Classement de l'annuaire (inchangé)

Par juridiction (ordre alphabétique, « Juridiction non déterminée » en dernier), puis les études dont
l'adresse exacte est connue, puis nom de famille, prénoms, identifiant. **Le badge « Confirmé » n'est
PAS un critère de classement** (testé : un notaire confirmé ne remonte pas).

## 6. Badge « Confirmé »

- **Visuel propre à Agora** : coche blanche dans un disque bleu profond `#152E38`, libellé
  « Confirmé » sur fond sauge `#E9EDE7`. Aucune ressource ni aucun sceau d'un réseau social.
  Infobulle et nom accessible : « Informations confirmées par le notaire. »
- **Ce qu'il dit** : les informations de la fiche ont été confirmées par le notaire, et la
  confirmation validée par le Master Admin. Ni certification professionnelle, ni reconnaissance du
  MJSP, ni garantie ; son absence ne dit rien.
- **Version** : une confirmation fige un INSTANTANÉ (nom, commune, adresse, téléphones, courriels
  publics) et son EMPREINTE sha-256. Le badge n'est affiché que si la confirmation est ACTIVE **et**
  que l'empreinte égale celle des informations actuelles — vérifié À LA LECTURE, à chaque rendu.
- **Invalidation** : les écritures de coordonnées de l'administration (Master Admin, éditeur) et
  de l'import Word passent par `invaliderSiModifie` dans la MÊME transaction : la confirmation
  devient `INVALIDEE` (motif, auteur, date), audit `NOTARY_CONFIRMATION_INVALIDATED`. Toute autre
  modification (nouvel import de la liste du MJSP qui change un nom ou une commune, ancien script
  `import-coordonnees-notaires.ts`) ne marque pas l'historique, mais le badge disparaît quand même :
  la comparaison d'empreintes à la lecture est la garantie, l'historique n'en est que le registre.
- **Retrait** : Master Admin, motif obligatoire (10 caractères au moins) → `RETIREE`, audit
  `NOTARY_CONFIRMATION_WITHDRAWN`.
- **Historique** : rien n'est supprimé ; une nouvelle validation fait passer l'ancienne en
  `REMPLACEE`. Statuts : `ACTIVE`, `RETIREE`, `INVALIDEE`, `REMPLACEE`.
- **Pas de propagation** : la confirmation vise UNE inscription (`notaryId`) ; un homonyme ou une
  autre inscription du même notaire n'en hérite pas.
- **Réponses publiques** : la date de confirmation seule. La méthode, la référence de preuve, la
  note et l'identité du validateur ne sortent jamais de l'administration (la référence de preuve
  n'est affichée qu'au Master Admin et n'est pas écrite dans l'audit).

## 7. Parcours Master Admin

1. **Demande de CORRECTION** (public ou proposition `IMPORT`) : la page compare publié et proposé.
   « Accepter » ouvre l'éditeur de coordonnées pré-rempli ; l'enregistrement avec `requestId`
   (Master Admin seul, vérifié par la route) clôt la demande `ACCEPTEE` et invalide une
   confirmation devenue fausse. « Refuser » exige un motif.
2. **Demande de CONFIRMATION** : la demande porte la VERSION (empreinte) vue par le demandeur. Le
   Master Admin vérifie l'identité et la qualité du demandeur PAR UN CANAL INDÉPENDANT, puis
   « Valider la confirmation » : date de confirmation (pas dans le futur), méthode (appel à un
   numéro indépendant, courriel à une adresse connue, rencontre, document signé, autre),
   référence de preuve privée (3-300 caractères), note (10-1 000). Refus `409 version_changed` si
   la fiche a changé depuis la demande.
3. **Correction et confirmation sont DEUX décisions distinctes** : `VALIDER_CONFIRMATION` n'est
   permis que sur une demande de confirmation ; accepter une correction n'attribue jamais le badge.
4. **Retrait** depuis la page admin du notaire.

Toutes ces routes vérifient le rôle `MASTER_ADMIN` côté serveur (`requireAdminApi`), à chaque
appel ; masquer un bouton n'est pas une protection. Les courriels de notification existants
reconnaissent les nouveaux types (CONFIRMATION, IMPORT) — aucun envoi pendant le développement
(`RESEND_API_KEY` vide sur le banc).

## 8. Migration

Schéma (`prisma/schema.prisma`) : modèle `NotaryConfirmation`, colonne `NotaryRequest.sourceKey`
(unique, nullable), colonne `NotaryContact.emailsJson` (liste des courriels, défaut `[]`), types de
demande `CONFIRMATION` et `IMPORT`. Convention du dépôt :
`prisma db push` puis `npm run db:rls`.

Appliqué au banc local seulement. **Procédure de production (NON exécutée, sur instruction) :**

1. Revoir le SQL généré en lecture seule (`prisma migrate diff`, régénéré le 18 oct. après l'ajout
   des courriels) : 6 instructions — ajout de `emailsJson` et de `sourceKey`, création de
   `NotaryConfirmation`, 2 index, 1 clé étrangère — puis UNE reprise : le courriel unique des
   fiches existantes recopié dans la liste (aucune empreinte ne change, testé).
2. Appliquer ce SQL, puis `npm run db:rls` (RLS sur la nouvelle table).
3. Déployer le code (le badge ne s'affiche que s'il existe une confirmation : rien ne change
   visuellement au déploiement).
4. Décisions de nom : `npx tsx scripts/import-notaires-mjsp.ts --apply` (lit `.env` = production ;
   simulation du 18 oct. : exactement 3 modifications). AVANT l'import Word, sinon BÉLISAIRE et GAI
   restent incertains.
5. Relancer la SIMULATION de l'import Word contre la production (la base a pu bouger) ; comparer
   avec le rapport du 18 oct.
6. L'option `--apply` étant réservée à une base locale, les compléments EXACTS se font en
   production par le Master Admin depuis l'administration, ou par une autorisation explicite qui
   reste à donner (élargir le garde-fou est une décision, pas un réglage).

## 9. Vérifications

- `vitest --dir src` : 113 fichiers, **1 878 tests, tous verts** ; `vitest scripts/lib` : 5 fichiers,
  **97 tests, tous verts** (état du 18 oct., après la liste des courriels). Fichiers neufs ou étendus : `notaires-confirmation.test.ts` (13),
  `import-notaires-docx.test.ts` (29, valeurs FICTIVES), `import-notaires-docx-ecriture.test.ts` (10),
  `notaires-admin.test.ts` (24), `route.test.ts` public (22), `notaires-demandes.test.ts` (27),
  `notary-profile.test.tsx` (12), `notaires-demandes-ui.test.tsx` (22), `annuaire-ui.test.tsx` (15),
  `annuaire-notaires.test.ts` (37).
- `tsc --noEmit`, ESLint (fichiers touchés, 0 avertissement) : propres. `npm run build:check` : réussi.
- Navigateur (banc local, Turnstile en clés de TEST) : onglet et page d'annuaire, fiche, crayon,
  correction pré-remplie, confirmation, message d'envoi ; ordinateur et téléphone.

## 10. Limites et décisions humaines

1. **Propositions `IMPORT` encore ouvertes** (banc local ; à recréer en production par la
   simulation puis la procédure) : ALPHONSE, FRANCILLON, GIORDANI, MORPEAU (rapprochements
   incertains), CASSAGNOL (5ᵉ numéro), CÉANT et VICTOR (le document diffère de la fiche publiée,
   différences soumises à Me Vaval le 18 oct.) ; BÉLISAIRE et GAI n'ont plus rien à proposer — le
   Master Admin les clôt en enregistrant la fiche pré-remplie.
2. **Tranché par Me Vaval le 18 oct.** : noms de BÉLISAIRE, GAI et DUVOT (graphies confirmées),
   publication de tous les courriels du document. Restent à trancher : ALPHONSE, FRANCILLON,
   GIORDANI, MORPEAU ; CÉANT et VICTOR.
3. **Corrigé en passant** : « Ouvrir la fiche pré-remplie » d'une proposition d'IMPORT n'ouvrait
   pas l'éditeur pré-rempli et ne la clôturait pas (seules les demandes du public l'étaient).
4. **CASSAGNOL** : un numéro annoté comme appartenant à un tiers, un doublon, un numéro incomplet
   et un 5ᵉ numéro ne sont PAS publiés (rapport privé).
5. **Confirmation** : aucune n'existe ; le badge n'apparaît donc nulle part tant que le Master
   Admin n'en a pas validé une, preuve à l'appui.
6. **Préfixe « Me »** : non ajouté devant les noms (la liste du MJSP ne le porte pas).
7. **`NotaryDirectoryView`** : composant de l'ancienne page « Notaires par juridiction », plus
   rendu par aucune route (encore cité par deux tests) — à retirer dans un lot séparé.
8. **Libellés anglais et créoles** à valider par Me Vaval : 74 libellés, tableau
   `docs/livraison-notaires-confirmation/Libelles-en-ht-a-valider-2026-10-18.xlsx`.
