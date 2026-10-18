# Livraison — Fiche des notaires en fenêtre modale (18 oct. 2026)

**Rien n'est déployé ni poussé. Aucun courriel envoyé. Aucune confirmation attribuée.** Vérifié sur
le banc local `lam_banc` (copie de la base). Captures : `docs/livraison-fiche-notaire-modale/` — la
fiche à badge est une fiche FICTIVE (« Jean EXEMPLE », numéros 555, `@exemple.ht`) créée sur le banc
pour les captures puis RETIRÉE ; aucune confirmation n'existe pour un notaire réel.

## 1. Ce qui change

Un clic sur « Voir la fiche → » (onglet « Notaires » de la carte, page d'annuaire) ou sur le nom d'un
notaire (fiche d'une commune, onglet « Juridictions ») ouvre la fiche **en fenêtre modale**, sans
navigation. La fermeture rend exactement le contexte : recherche, filtres, page, défilement, carte
(rien n'est rechargé ; vérifié dans le navigateur : position 3 108 px conservée, focus rendu au
bouton « Voir la fiche » d'origine).

| Élément | Comportement |
|---|---|
| En-tête | « Notaire » (titre du dialogue), croix de fermeture, séparateur discret |
| Identité | nom réel ; coche bleu profond + pastille sauge « Confirmé » et ligne « Informations confirmées le [date] » SEULEMENT si une confirmation valide vise la version publiée ; « Commune de commission : … » (jamais l'adresse ni la juridiction) ; nom imprimé par le MJSP s'il diffère |
| Crayon | petite icône à droite de l'identité, « Demander une modification ou une confirmation » (infobulle et nom accessible) → formulaire existant, prérempli (correction OU confirmation) |
| Coordonnées | zone ouverte, séparateurs légers : adresse + copie (« Adresse copiée », repli si le presse-papiers manque : `execCommand`, puis sélection du texte) ; chaque téléphone (`tel:`, « Appeler ») ; chaque courriel (`mailto:`, « Écrire ») ; lignes absentes masquées ; « Aucune coordonnée disponible pour le moment. » sinon |
| Pied | « Voir la commune sur la carte → » à gauche (la commune de commission sur la carte RÉELLE ; jamais « Localiser l'étude » : aucune étude n'a de coordonnées précises) ; « Fermer » à droite |
| États | chargement discret ; « Fiche introuvable » ; panne DISTINCTE (« La fiche n'a pas pu être chargée » + « Réessayer ») ; fermeture toujours disponible |

Infobulle du badge : au survol, au focus clavier, au toucher (bascule) — jamais affichée d'office ;
Échap la referme sans fermer la fiche. Ni encart vert répétitif, ni ressource LinkedIn, ni mention
« Maquette ».

## 2. Navigation et liens

- **L'URL porte la fiche** : `?notaire=<id>` ajouté à l'adresse courante
  (`/fr/juridictions?vue=notaires&q=…&notaire=mjsp-2026-09-08-11`). Ouverture par
  `history.pushState` (intégré au routeur Next 14.2) : pas de requête de page.
- **Précédent / Suivant** : ferme / rouvre la fiche. **Croix, Fermer, Échap, fond** : reviennent à
  l'entrée précédente si la fiche a été ouverte ici ; après un lien direct, remplacent l'adresse par
  celle de l'annuaire (on ne quitte pas le site) — le titre du document suit.
- **Lien direct** (courriel) : la page rend la fiche DÉJÀ ouverte côté serveur ; titre « [nom] —
  notaire | Agora », adresse CANONIQUE = la page du notaire (une seule adresse indexée par notaire).
- **Sans JavaScript** : chaque entrée garde son lien vers la PAGE DE REPLI
  `/{locale}/juridictions/notaires/{id}` (inchangée, indexée) ; une fiche rendue par le serveur se
  ferme par de simples liens.
- **Une seule implémentation** : `FicheNotaire` est rendu par la modale ET par la page de repli
  (qui y ajoute département, juridiction, provenance et ses liens).
- **Requêtes concurrentes** : chaque ouverture a un jeton ; la requête précédente est annulée ; une
  réponse obsolète ou portant un autre identifiant n'est jamais affichée.

## 3. Routes et composants

| Fichier | Rôle |
|---|---|
| `src/app/api/public/jurisdictions/notaires/[id]/route.ts` | **nouvelle API publique** (lecture seule) : `{ fiche }` = liste blanche ; 404 introuvable ; 503 panne ; 429 débit (`LIMITS.jurNotaire`, 120/min/IP) ; `no-store` |
| `src/lib/jurisdictions/fiche-notaire.ts` | liste blanche `versFichePublique`, URL (`urlAvecFiche`, `urlSansFiche`, `lireIdFiche`), `lienFicheNotaire` (courriels), `lienCarteFiche`, `lienDemande` |
| `src/lib/jurisdictions/fiche-controleur.ts` | chargement à jetons, `chargeurApi`, piège du clavier |
| `src/lib/jurisdictions/fiche-chargement.ts` | fiche initiale et métadonnées côté serveur (lien direct) |
| `src/components/jurisdictions/FicheNotaire.tsx` | **le** contenu de la fiche (modale + page de repli) |
| `src/components/jurisdictions/FicheNotaireModale.tsx` | dialogue : URL, historique, focus, Tab piégé, `inert`, Échap, défilement bloqué sans perte de position |
| `InfobulleConfirme.tsx`, `CocheConfirme.tsx`, `BadgeConfirme.tsx` | coche nommée + infobulle ; pastille « Confirmé » |
| `CopierAdresse.tsx` | copie avec retour accessible et replis |
| `fiche-libelles.ts` | libellés extraits côté serveur (la modale ne reçoit pas le dictionnaire entier) |
| `juridictions/page.tsx`, `juridictions/notaires/page.tsx` | montent la modale ; `?notaire=` lu par le serveur |
| `NotaryAnnuaireView.tsx`, `NotariesSection.tsx` | liens `data-fiche-notaire` (modale avec JavaScript, page de repli sans) |
| `NotaryProfileView.tsx` | page de repli reconstruite sur `FicheNotaire` |
| `format-telephone.ts` | affichage des numéros sans dépendance (côté client) |

**Migrations : aucune.** Le modèle de confirmation versionnée (`NotaryConfirmation` : date de
confirmation par le notaire, date d'approbation, instantané et empreinte, statut, historique) est
celui livré et MIGRÉ EN PRODUCTION le 18 oct. ; il répond aux §§ 6-7 tel quel.

## 4. Validation par le Master Admin (existant, rappel)

Côté serveur, à chaque appel (`requireAdminApi` = MASTER_ADMIN) ; rien de public ne modifie les
données publiées, n'attribue le badge ni ne change son statut (testé : `route.test.ts` public —
aucune confirmation créée ; `notaires-admin.test.ts` — validation réservée).

1. File `/admin/notaires/demandes` → la demande (publié ≠ proposé, demandeur, qualité, contact privé).
2. **Correction** : « Ouvrir la fiche pré-remplie » → relire → enregistrer (demande ACCEPTÉE, audit) —
   ou « Refuser » avec motif. Une correction acceptée n'attribue JAMAIS le badge, et invalide une
   confirmation devenue fausse.
3. **Confirmation** : vérifier la PROVENANCE par un canal indépendant (une case cochée ou un compte ne
   suffisent pas) → « Valider la confirmation » : date de confirmation, méthode, référence PRIVÉE des
   justificatifs, note ; refus si la fiche a changé depuis la demande (version).
4. Retrait motivé depuis `/admin/notaires/{id}` ; historique complet (ACTIVE, REMPLACÉE, INVALIDÉE,
   RETIRÉE). Aucune propagation à une autre inscription.

## 5. Courriel personnalisé

`{{lien_fiche_notaire}}` (variable conservée dans `Agora/emails/invitation-notaires.html`) =

```
https://agora.ht/fr/juridictions?vue=notaires&notaire=<identifiant en base>
```

construit par `lienFicheNotaire(id)` — HTTPS, identifiant validé, aucune donnée privée, aucun droit.
Préparation SANS ENVOI : `scripts/preparer-courriel-notaires.ts` (`--destinataires <csv>` ou
`--depuis-base`, `--modele`, `--sortie` hors du dépôt) : vérifie le modèle (variables, bouton
« Consulter mes informations » → la variable), rapproche chaque destinataire de SA fiche (identifiant
en base ; à défaut rapprochement EXACT et UNIQUE), et BLOQUE toute la préparation si une ligne est
ambiguë, incertaine, sans lien ou en double — aucun fichier d'envoi n'est alors produit. Essai sur le
banc (`--depuis-base`) : 22 destinataires prêts, rapport et fichier dans le dossier privé, rien
d'envoyé. `Agora/emails/INTEGRATION.txt` mis à jour.

## 6. Vérifications

- `vitest --dir src` : **1 913 tests verts** ; `vitest scripts/lib` : **110 tests verts** ; `tsc`
  et ESLint propres ; `npm run build:check` : voir le compte rendu.
- Nouveaux : `fiche-notaire.test.ts` (16 : liste blanche, URL, lien de courriel, action carte,
  réponses concurrentes, fermeture pendant le chargement, réponse d'un autre notaire, introuvable ≠
  panne, réessayer, lien direct non rechargé, piège du clavier), `route.test.ts` de l'API (5 : liste
  blanche et absence de données privées, 404, identifiant mal formé sans lecture, 503, 429),
  `fiche-notaire-ui.test.tsx` (12 : identité, badge seulement si confirmation valide, coordonnées
  multiples et absentes, `tel:`/`mailto:`, copie, crayon, dialogue, fermeture sans JavaScript, action
  carte, états, trois langues), `preparer-courriel-notaires.test.ts` (5).
- Navigateur (banc local, ordinateur 1440 × 900 et téléphone 375 × 812) : ouverture depuis l'annuaire
  et depuis la fiche d'une commune ; URL ; focus dans le dialogue ; Tab piégé (avant et arrière) ;
  arrière-plan `inert` et défilement bloqué ; Échap ; Précédent / Suivant ; lien direct et sa
  fermeture ; copie ; action carte (fiche fermée, commune choisie sur la carte réelle) ; fiche
  introuvable ; page de repli ; téléphone sans débordement.

## 7. Limites et points à trancher

1. **Message après envoi** : « Votre demande a été transmise à l’Administrateur pour examen. » —
   correction de Me Vaval CONFIRMÉE le 18 oct. (« keep the correction »), malgré « Master Admin »
   dans la demande.
2. **« Localiser l'étude → »** n'apparaît jamais : aucune étude n'a de coordonnées précises (aucun
   géocodage, conformément à la demande).
3. **Tests d'interaction** : le dépôt n'a pas d'environnement DOM de test (ni jsdom ni happy-dom) ; le
   focus, le clavier, l'historique et la copie sont vérifiés dans un vrai navigateur, leur LOGIQUE par
   des tests purs, le rendu par des tests serveur.
4. **Navigateurs anciens** sans l'attribut `inert` (Safari < 15.5) : l'arrière-plan n'est pas rendu
   inerte, mais le Tab reste piégé dans la fiche.
5. **Libellés créoles NOUVEAUX — VALIDÉS par Me Vaval le 18 oct. (« c'est ok »)** (`fiche*` dans `ht.ts`) : « Fèmen », « Fèmen fich la »,
   « N ap chaje fich la… », « Nou pa jwenn fich la », « Fich la pa t ka chaje. », « Rele », « Ekri »,
   « Kopye adrès la », « Adrès la kopye », « Notè a konfime enfòmasyon an nan dat {date} ».
6. Le formulaire de demande reste une page (parcours existant, Turnstile) : pas de modale imbriquée.
