# PROMPT D'EXÉCUTION — Sous-thèmes de « Droit économique & des affaires »

> À coller tel quel dans une session Claude Code sur le dépôt `lam-veritab`.
> Préparé le 28 juillet 2026 sur inventaire vérifié de la base de production.

---

## Mission

Dans **Législation annotée → Droit économique & des affaires** (`economique`), créer
cinq sous-thèmes ciblés et y classer les textes du corpus existant, **par COPIE**
(double-listage — règle cliente : reclasser = copier, jamais déplacer) :

1. **Sociétés anonymes** — tous les textes qui régissent les sociétés anonymes ;
2. **Code de commerce & statut du commerçant** — l'ancien texte (Code de 1826 annoté),
   le nouveau texte (réforme du statut du commerçant, Loi 002-2018), le texte sur les
   agents commerciaux et le décret de 1960 sur la profession de commerçant ;
3. **Ports & droit maritime** ;
4. **Banques & institutions financières** — le sous-thème `droit-bancaire` EXISTE déjà
   (Loi de 2012 seule) : le compléter avec la série bancaire du corpus Vandal ;
5. **Fiscalité** — textes fiscaux du corpus + PHASE 2 de sourçage (décret de 2005 sur
   l'impôt sur le revenu, patente, quitus fiscal, droits de timbre, etc.) ;
6. **Propriété intellectuelle** (DÉCIDÉ le 28 juil.) — remplir le sous-thème
   `propriete-intellectuelle` qui existe déjà, vide, sous `commerce-industrie` ;
7. **Recoupements** — copier les mêmes textes dans les thèmes existants d'AUTRES
   branches de l'arbre qui les attendent, vides (voir la section Recoupements).

## État des lieux VÉRIFIÉ (28 juil. 2026 — à re-vérifier en début de session)

- Arbre actuel sous `economique` (9 enfants) : `commerce-industrie` (0 doc, 1 enfant
  `propriete-intellectuelle` à 0 doc), `agriculture-rural`, `amenagement-territoire`,
  `travaux-publics-transports`, `environnement`, `tourisme` (tous 0 doc),
  **`droit-commercial` (95 docs)**, **`droit-bancaire` (1 doc)**, **`droit-minier` (1 doc)**.
- `droit-commercial` contient : le **Code de commerce annoté** (`CODE_COMMERCE_ANNOTE`,
  644 art., réforme du Titre 1ᵉʳ déjà en overlay), la **Loi 002-2018**
  (`LOI_STATUT_COMMERCANT_2018`) et les **93 satellites Vandal** (`CC_VANDAL_*`).
- Infrastructure : `Theme` est hiérarchique (`parentId`), `ThemeBrowser` rend la
  profondeur RÉCURSIVEMENT (tri alphabétique des enfants), `documentsInTheme` agrège
  les descendants, `DocumentTheme` est M:N (un doc peut appartenir à plusieurs thèmes).
  **Aucun changement de code n'est nécessaire** — c'est une opération de données,
  hors phase 2 (imports de nouveaux textes).
- Recherche : les libellés de thèmes sont dénormalisés dans `searchText` →
  **`reindexDocument` sur chaque doc touché** après les affectations.
- Hors corpus Vandal, la base n'a AUCUN texte intégral fiscal/maritime/S.A. (les
  correspondances « impôt », « patente », « anonyme »… sont des fiches de l'Index du
  Moniteur, pas des textes). Les manques sont listés en phase 2.

## Sous-thème 1 — Sociétés anonymes

Créer `societes-anonymes` sous `economique` :
`labelFr « Sociétés anonymes »` · `labelEn « Corporations (sociétés anonymes) »` ·
`labelHt « Sosyete anonim »`.

Y COPIER (série IV du Vandal — vérifier chaque source en base) :

| Source | Texte |
|---|---|
| `CC_VANDAL_IV-A-1` | Loi du 3 août 1955, constitution et fonctionnement des S.A. |
| `CC_VANDAL_IV-A-2` | Décret du 28 août 1960, constitution et fonctionnement des S.A. |
| `CC_VANDAL_IV-A-3` | Décret du 16 octobre 1967, contrôle des sociétés de commerce |
| `CC_VANDAL_IV-A-4` | Décret du 11 novembre 1968, constitution du capital des sociétés par actions |
| `CC_VANDAL_IV-A-5` | Décret du 10 octobre 1979 sur les S.A. |
| `CC_VANDAL_IV-A-6` | Décret du 8 mars 1984 sur les S.A. |
| `CC_VANDAL_IV-B` | Loi du 16 juin 1975, S.A. étrangères (mod. 20 sept. 1979) |
| `CC_VANDAL_IV-C` | Loi du 16 septembre 1963, S.A. mixtes |

**Décision à demander à la cliente** : inclure aussi `CC_VANDAL_IV-D-1`/`IV-D-2`
(compagnies d'assurance 1956/1981 — des S.A., mais matière assurance) ? Par défaut NON.

## Sous-thème 2 — Code de commerce & statut du commerçant

Créer `code-de-commerce` sous `economique` :
`labelFr « Code de commerce & statut du commerçant »` · `labelEn « Commercial code &
trader status »` · `labelHt « Kòd komès & estati komèsan »`.

Y COPIER exactement les QUATRE textes demandés :

| Source | Rôle demandé |
|---|---|
| `CODE_COMMERCE_ANNOTE` | l'ANCIEN texte — Code de commerce de 1826 annoté (Vandal), 644 art. ; le Titre 1ᵉʳ y porte DÉJÀ l'overlay de la réforme (pastilles + anciennes versions repliables) |
| `LOI_STATUT_COMMERCANT_2018` | le NOUVEAU texte — Loi portant réforme du statut du commerçant (002-2018) |
| `CC_VANDAL_I-A` | Décret du 6 octobre 1986, statut et activités des AGENTS COMMERCIAUX |
| `CC_VANDAL_I-G` | Décret du 26 septembre 1960, exercice de la PROFESSION DE COMMERÇANT |

`droit-commercial` (le sous-thème existant à 95 docs) reste INTACT comme vue
d'ensemble — ne rien déplacer, ne rien renommer sans consigne.

## Sous-thème 3 — Ports & droit maritime

Créer `droit-maritime` sous `economique` :
`labelFr « Ports & droit maritime »` · `labelEn « Ports & maritime law »` ·
`labelHt « Pò & dwa maritim »`.

Y COPIER (série V + l'agent maritime de la série I) :

| Source | Texte |
|---|---|
| `CC_VANDAL_V-A-1` | Convention de Bruxelles du 10 mai 1952 (compétence civile, abordage) |
| `CC_VANDAL_V-A-2` | Règles pour prévenir les abordages en mer |
| `CC_VANDAL_V-B-1` | Décret du 13 février 1961, cabotage entre les ports haïtiens |
| `CC_VANDAL_V-C` | Convention STCW 1978 (formation des gens de mer) |
| `CC_VANDAL_V-D-1` | Loi du 20 août 1964, immatriculation et radiation des navires |
| `CC_VANDAL_V-E` | Décret du 4 janvier 1965, inscription hypothécaire des navires |
| `CC_VANDAL_V-F` | Loi du 5 février 1995 (abrogation du taux d'ajustement de 1989) |
| `CC_VANDAL_V-H` | Convention du 10 mai 1952, saisie conservatoire des navires |
| `CC_VANDAL_V-I` | Convention SOLAS + règles pour prévenir les abordages |
| `CC_VANDAL_V-J` | Convention de Bruxelles du 29 avril 1961 (transport de passagers par mer) |
| `CC_VANDAL_I-C-1` | Arrêté du 16 janvier 1979, profession d'AGENT MARITIME |

Manque connu (phase 2, si la cliente fournit les textes) : décret organique de
l'**Autorité Portuaire Nationale (APN)**, textes récents sur la sûreté portuaire.

## Sous-thème 4 — Banques & institutions financières (compléter l'existant)

`droit-bancaire` EXISTE (« Droit bancaire & financier », 1 doc : Loi banques 2012
`LOI_BANQUES_2012`). **Décision à demander** : renommer `labelFr` en « Banques &
institutions financières » (formulation de la cliente) ou garder l'intitulé actuel —
recommandation : renommer, c'est sa formulation.

Y COPIER la série II du Vandal (18 textes) :
`CC_VANDAL_II-A`, `II-B-1`, `II-B-2`, `II-B-3`, `II-B-4`, `II-C`, `II-D`, `II-E`,
`II-F`, `II-G`, `II-H-1`, `II-H-2`, `II-I-1`, `II-J`, `II-K`, `II-L-1`, `II-L-2`,
`II-M` (BRH 1979, BNC, réserves obligatoires 1984, réglementation bancaire 1980,
Banques d'épargne et de logement, sociétés financières de développement 1982, maisons
de transfert 1989, gestion des devises, taux d'intérêt 1995, etc.).

Rappel corpus voisin : les 140 Circulaires BRH vivent dans leur PROPRE section — ne
pas les mélanger ici ; un lien de navigation suffit s'il est demandé un jour.

## Sous-thème 5 — Fiscalité

Créer `fiscalite` sous `economique` :
`labelFr « Fiscalité »` · `labelEn « Taxation »` · `labelHt « Fiskalite »`.

### Phase 1 — classer l'existant (série VII du Vandal, 12 textes)

| Source | Texte |
|---|---|
| `CC_VANDAL_VII-A-1` | Loi du 27 juin 1955, livret de licence |
| `CC_VANDAL_VII-A-2` | Décret du 26 septembre 1960, livret de licence |
| `CC_VANDAL_VII-A-3` | Décret du 13 janvier 1978, droit de licence |
| `CC_VANDAL_VII-B-1` | L. 1903 / L. 1921 / L. 1959 / D. 1974, DROIT DE TIMBRE |
| `CC_VANDAL_VII-B-2` | Décret du 29 novembre 1978 sur le TIMBRE |
| `CC_VANDAL_VII-C` | Loi du 11 août 1903, droit de transmission (et mod.) |
| `CC_VANDAL_VII-D-1` | Décret du 29 septembre 1986, IMPÔT SUR LE REVENU (mod. 1988) |
| `CC_VANDAL_VII-D-2` | Décret du 9 octobre 1986, rectification fiscale |
| `CC_VANDAL_VII-D-3` | Loi du 5 février 1995, acompte de 2 % sur la valeur en douane |
| `CC_VANDAL_VII-D-4` | Décret du 28 septembre 1990, QUITUS FISCAL |
| `CC_VANDAL_VII-E` | Décret du 28 septembre 1987, PATENTE |
| `CC_VANDAL_VII-F-1` | Loi du 19 septembre 1982, taxe sur chiffre d'affaires (et mod.) |

### Phase 2 — sourcer et téléverser les textes MODERNES demandés

La cliente demande expressément le **décret de 2005 sur l'impôt sur le revenu** (le
Vandal n'a que celui de 1986). **Sources déjà sur le Mac** (~/Downloads, 20 juil.) :
fichiers `Code_Fiscal_*RECONSTITUE.docx` (extraits du Code Fiscal Paillant 2018) —
vérifié : ils contiennent le **Décret du 29 septembre 2005** (impôt sur le revenu),
le timbre 1978, le quitus 1990, la transmission, la licence, etc. Plan phase 2 :

1. inventorier les variantes `Code_Fiscal_*` (plusieurs versions du même extrait —
   choisir la plus complète, ignorer les doublons) et cartographier texte par texte ;
2. chaque texte retenu = un téléversement au **format lecteur annoté** (règle cliente :
   Sommaire + Index latéraux + renvois « article N », patron Loi banques/Décret minier),
   copié dans `fiscalite` ;
3. prioriser : décret 2005 impôt sur le revenu → patente → quitus → timbre ;
4. si un texte manque au Paillant, le demander à la cliente (scan Moniteur à l'appui) ;
   ne JAMAIS reconstituer un texte fiscal de mémoire (règle : zéro citation inventée).

## Sous-thème 6 — Propriété intellectuelle (décidé)

Le thème `propriete-intellectuelle` EXISTE (enfant de `commerce-industrie`, 0 doc).
Y COPIER la série III du Vandal (6 textes) :

| Source | Texte |
|---|---|
| `CC_VANDAL_III-A` | Loi du 14 décembre 1922, brevets d'invention |
| `CC_VANDAL_III-B-1` | Arrangement de Madrid, fausses indications de provenance |
| `CC_VANDAL_III-B-2` | Convention de La Haye du 6 novembre 1925, dessins et modèles |
| `CC_VANDAL_III-B-3` | Loi du 17 juillet 1954, marques de fabrique ou de commerce (et mod.) |
| `CC_VANDAL_III-B-4` | Décret du 12 octobre 1967, nom commercial |
| `CC_VANDAL_III-C` | Convention de Paris du 20 mars 1883, propriété industrielle |

(La section « Marques de commerce & de fabrique » de la plateforme reste ce qu'elle
est — dépôts et images, pas les textes de loi ; aucun lien à créer sans consigne.)

## Recoupements — mêmes textes, autres branches de l'arbre (copies)

L'arbre global comporte des thèmes déjà créés et VIDES qui attendent exactement ces
textes. Chaque ligne = `DocumentTheme` supplémentaire (`isPrimary: false`), même
mécanique que le reste :

| Thème existant (branche) | Textes à y copier | Défaut |
|---|---|---|
| `fiscal-douanier → fiscalite-impots` (0 doc) | les 12 textes fiscaux de la série VII (mêmes que `fiscalite`) — et, en phase 2, les textes Paillant | OUI |
| `fiscal-douanier → douane` (0 doc propre) | `CC_VANDAL_I-J` (commissionnaire en douane 1996), `CC_VANDAL_VII-D-3` (acompte 2 % valeur en douane) | OUI |
| `economique → travaux-publics-transports` (0 doc) | les 11 textes maritimes (série V + I-C-1) et les 7 aériens (série VI) | OUI |
| `economique → tourisme` (0 doc) | `CC_VANDAL_I-O` (établissements touristiques 1975) | OUI |
| `economique → agriculture-rural` (0 doc) | `CC_VANDAL_II-F` (BNDAI 1984) | OUI |
| `social → sante-publique` (0 doc) | `CC_VANDAL_I-R-1/2/3` (commerce des produits pharmaceutiques) | OUI |
| `economique → commerce-industrie` (0 doc) | commerce intérieur & institutions : `I-E` (cartels), `I-F-1/2` (Chambre de commerce), `I-H-1/2` (commerce de détail), `I-K` (Conseil National de la Comptabilité), `I-P-1/2` (marché noir, contrôle des prix), `I-Q-1..4` (poids et mesures), `II-D` (Magasin Général) | OUI |
| `droit-prive → obligations-biens-suretes` (Décret sûretés) | recoupement inverse : copier le **Décret sûretés** (`DECRET_SURETES`) dans `droit-bancaire` (il fonde les garanties du crédit) | À TRANCHER |

Nouveaux sous-thèmes POSSIBLES sous `economique` (créer seulement sur accord) :

| Sous-thème proposé | Textes | Défaut |
|---|---|---|
| `transport-aerien` « Transport aérien » | série VI : `VI-A`…`VI-F` (aérodromes 1961, Convention de Chicago 1944, circulation aérienne, statut des aéronefs 1948/1960, Rome 1933, transport aérien international) — 7 textes | OUI |
| `assurances` « Assurances » | `IV-D-1` (compagnies d'assurance 1956), `IV-D-2` (décret 1981) | OUI (règle du même coup la question assurance/S.A.) |
| ~~`professions-commerce`~~ | REMPLACÉ (décisions cliente, 2ᵉ-3ᵉ vagues du 28 juil.) par **`profession-de-commercant` « Profession de commerçant », ENFANT de `code-de-commerce`** — noyau strict : `LOI_STATUT_COMMERCANT_2018`, `I-G` (profession de commerçant 1960), `I-A` (agents commerciaux). Réaffectations décidées : `I-B-1/2` (agents de change) → `droit-bancaire` (21 docs) ; `I-C-1` (agents maritimes) → `droit-maritime` seul ; `I-J` (commissionnaire) → `douane` seul. EXÉCUTÉ. | FAIT |

## Sous-thème DÉCIDÉ (28 juil.) — Arbitrage & règlement des différends, sous DROIT PRIVÉ

Sur instruction cliente, ce sous-thème vit dans la branche **Droit privé** (« la
section droit civil »), PAS sous Droit économique. Créer `arbitrage` sous
`droit-prive` (frère de `droit-civil`, `personne-famille`,
`obligations-biens-suretes`) : `labelFr « Arbitrage & règlement des différends »` ·
`labelEn « Arbitration & dispute resolution »` · `labelHt « Abitraj & regleman dezakò »`.

Y COPIER (les textes restent aussi dans `droit-commercial`) :

| Source | Texte |
|---|---|
| `CC_VANDAL_I-D-1` | Loi du 11 juin 1935 réglementant l'arbitrage commercial |
| `CC_VANDAL_I-D-2` | Convention de New York (reconnaissance et exécution des sentences arbitrales étrangères) |
| `CC_VANDAL_I-Annexe-I` | Règlement de conciliation facultative |
| `CC_VANDAL_I-Annexe-II` | Règlement d'arbitrage |

Après TOUT cela, les seuls satellites Vandal sans second foyer restent la contrainte
par corps (`I-L-1..4` — matière voies d'exécution, aucun thème d'accueil n'existe) et
les bons à caractère commercial (`I-L-4`) : ils demeurent dans `droit-commercial`.

## Mécanique d'exécution (phase 1)

Écrire `scripts/_themes-droit-economique.ts`, idempotent, patron `_import-loi-banques.ts` :

1. préambule chargeur d'env habituel ; `DIRECT_URL` (5432) pour les écritures ;
2. créer les 4 nouveaux thèmes s'ils n'existent pas (`slug` ci-dessus, `parentId=economique`,
   `position` = max+1 — l'affichage trie alphabétiquement de toute façon) ;
3. pour chaque affectation : `DocumentTheme.create` si absent, **`isPrimary: false`**
   (le thème principal de chaque doc RESTE `droit-commercial` — copie, pas déplacement),
   `assignedBy: 'IMPORT'` ;
4. résoudre chaque doc PAR SON CHAMP `source` (jamais par titre) ; **échouer** si une
   source listée est introuvable ou ambiguë ;
5. `reindexDocument` sur chaque document nouvellement affecté (libellés de thèmes
   dénormalisés dans la recherche) ;
6. imprimer le bilan : docs par thème avant/après, zéro suppression.

## Vérifications de sortie (bloquantes)

- `droit-commercial` compte TOUJOURS 95 docs (rien déplacé, rien retiré) ;
- comptes attendus (phase 1, défauts) : `societes-anonymes` 8, `code-de-commerce` 4,
  `droit-maritime` 11, `droit-bancaire` 19, `fiscalite` 12,
  `propriete-intellectuelle` 6, `fiscalite-impots` 12, `douane` 2 (propres),
  `travaux-publics-transports` 18, `tourisme` 1, `agriculture-rural` 1,
  `sante-publique` 3, `commerce-industrie` 13 (propres),
  `arbitrage` (sous droit-prive) 4, et si acceptés :
  `transport-aerien` 7, `assurances` 2 ;
- chaque doc copié garde UN SEUL `isPrimary=true` (l'original) ;
- rendu : page Législation annotée → les nouveaux sous-thèmes apparaissent sous
  Droit économique avec leurs comptes ; chaque doc s'ouvre normalement depuis ses
  DEUX thèmes ; rejouer le script = zéro changement (idempotence) ;
- recherche : un doc copié ressort toujours (sondage sur 2-3 titres) ;
- accès par service (§03) inchangé : les barrières de `documentsInTheme` s'appliquent
  aux nouveaux thèmes comme aux anciens.

## Contre-audit (obligatoire avant livraison)

Workflow adversarial compact (2 lentilles) : (1) conformité de chaque affectation à la
liste du présent prompt (aucun doc oublié, aucun intrus, séries Vandal relues depuis la
base) ; (2) intégrité plateforme (isPrimary uniques, idempotence rejouée, comptes,
recherche, §03). Corriger tout constat confirmé avant commit/déploiement.

## Décisions à trancher AVANT d'exécuter (poser les questions en bloc)

1. Renommer `droit-bancaire` en « Banques & institutions financières » ? (défaut : oui)
2. Phase 2 fiscale : lancer le sourçage Paillant dans la foulée ou livrer la phase 1
   d'abord ? (défaut : phase 1 d'abord, phase 2 sur go)
3. Recoupements « OUI » du tableau : confirmer en bloc ou retrancher ? (défaut : tous)
4. Nouveaux sous-thèmes proposés : `transport-aerien`, `assurances` (défaut : oui —
   `assurances` règle du même coup l'appartenance des compagnies d'assurance, hors
   « Sociétés anonymes ») ; `professions-commerce` et la copie du Décret sûretés dans
   `droit-bancaire` : à trancher explicitement.

Décisions DÉJÀ prises (28 juil.) :
- Propriété intellectuelle = OUI (série III, 6 textes, thème existant) ;
- Arbitrage & règlement des différends = OUI, placé sous **Droit privé** (4 textes).

## Annexe — Arbre CIBLE après exécution (défauts + décisions prises)

Comptes entre parenthèses = documents PROPRES du thème (l'affichage agrège aussi les
descendants). ★ = créé par cette opération ; ✚ = thème existant qui se remplit.

```
Constitution & droits fondamentaux
Droit privé
├── Droit civil (1 — Code civil)
├── Personne et Famille (2 — Loi Filiation, Décret régimes matrimoniaux)
├── Obligations, biens & sûretés (1 — Décret sûretés)
├── Signature & échange électronique (0)
└── ★ Arbitrage & règlement des différends (4)
Droit économique & des affaires
├── Commerce & industrie ✚ (13 — commerce intérieur, prix, poids et mesures, institutions)
│   └── Propriété intellectuelle ✚ (6)
├── Droit commercial (95 — vue d'ensemble Vandal, INCHANGÉ)
├── ★ Code de commerce & statut du commerçant (4)
│   └── ★ Profession de commerçant (3 — décret 1960, Loi 002-2018, agents commerciaux)
├── ★ Sociétés anonymes (8)
├── Banques & institutions financières ✚ (21 — dont agents de change 1890/1989) [renommé]
├── ★ Ports & droit maritime (11)
├── ★ Transport aérien (7)
├── ★ Assurances (2)
├── ★ Fiscalité (12)
├── Droit minier & ressources minérales (1)
├── Travaux publics, transports & communications ✚ (18 — maritime + aérien)
├── Tourisme ✚ (1)
├── Agriculture, ressources naturelles & développement rural ✚ (1 — BNDAI)
├── Aménagement du territoire (0)
└── Environnement (0)
Droit fiscal & douanier
├── Fiscalité / impôts (DGI) ✚ (12 — miroir de Fiscalité)
├── Lois de finances (0)
└── Douane ✚ (2 — commissionnaire en douane, acompte 2 %)
    ├── Code douanier (1 — Code des douanes 2023)
    └── Tarifs douaniers (0)
Social
├── Droit du travail & sécurité sociale
│   └── Code du travail (1 + sous-thèmes de chapitres existants)
├── Santé publique ✚ (3 — commerce des produits pharmaceutiques)
├── Éducation (0)
└── Jeunesse & sport (0)
Droit public & administratif
├── Justice (0) · Élections (0) · Finances publiques & contrôle (0)
├── Administration centrale de l'État (0) · Affaires étrangères (0)
└── Intérieur & collectivités territoriales (0)
Droit pénal
├── Droit pénal général (1 — Code pénal)
├── Procédure pénale (0)
└── Infractions contre les personnes
    └── Agressions sexuelles (1)
```

## Rappels de conduite

- Copier, jamais déplacer (règle cliente) ; aucune suppression de document ;
- ne pas toucher aux corps (§02) — opération purement thématique en phase 1 ;
- phase 2 : format lecteur annoté OBLIGATOIRE pour tout nouveau texte de Législation
  annotée ; audit adversarial par texte téléversé ;
- build + commit + push + poll Vercel READY + doc de livraison + mémoire en fin de course.
