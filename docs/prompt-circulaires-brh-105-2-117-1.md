# Prompt — Téléversement des circulaires BRH n° 105-2 et n° 117-1

> Cahier des charges d'intégration de **2 circulaires** à la section **Circulaires BRH**.
> Rédigé après extraction intégrale des 2 `.docx`, lecture des 2 PDF originaux et
> **vérification de l'état réel de la base de production** (30 juillet 2026).
> Format cible : **lecteur annoté** (Sommaire + Index latéral + renvois cliquables),
> conformément à la consigne permanente sur les textes ajoutés en Circulaires BRH.

---

## 1. Inventaire vérifié

### 1.1 Fichiers fournis

| Fichier | Rôle | Contenu mesuré |
|---|---|---|
| `~/Downloads/BRH-Circulaire-105-2-15sept2025.docx` | **corps HTML** de la 105-2 | 3 087 ¶ · **20 tableaux** · 0 image · 1 096 lignes après aplatissement |
| `~/Downloads/Circulaire-No-105-2-…-15-septembre-2025_0001.pdf` | **fac-similé** 105-2 | 10,8 Mo · **48 pages** · scan signé (paraphe du Gouverneur à chaque page) |
| `~/Downloads/Circulaire-117-1.docx` | **corps HTML** de la 117-1 | 142 ¶ · 0 tableau · **0 note de bas de page** (vérifié : `footnotes.xml` vide de contenu) |
| `~/Downloads/Circulaire-117-1.pdf` | **fac-similé** 117-1 | 2,2 Mo · **10 pages** · scan signé |

**Fidélité docx ↔ PDF : vérifiée** par lecture croisée (pages 1-4 de la 105-2, pages 1-2 de
la 117-1). Le `.docx` reproduit le PDF à l'identique, y compris la ponctuation « 1.- », les
montants en gourdes et les intitulés de sections. Aucun écart relevé.

### 1.2 État de la section Circulaires BRH en production

| Mesure | Valeur |
|---|---|
| Circulaires en base | **140** (`type = CIRCULAIRE_BRH`) |
| avec fac-similé PDF | 140 / 140 |
| avec `richBlocksJson` (tableaux rendus) | 40 |
| **avec `annotationsJson` (lecteur annoté)** | **0 / 140** |
| Sources | `BRH` (recueil 2017, purgé/réimporté), `BRH-WEB` (ajouts unitaires), `BRH-CEC` |
| Statuts | 134 `EN_VIGUEUR` · 6 `ABROGE` |

⚠️ **Ces deux circulaires seront les premières de la section à recevoir le lecteur annoté.**
Ce n'est pas un obstacle — `page.tsx:130` appelle `parseAnnotations(doc.annotationsJson)`
pour **tous** les types, `CIRCULAIRE_BRH` compris — mais cela impose de créer des `source`
dédiées (§ 2.3) plutôt que de basculer les 140 circulaires existantes.

### 1.3 Devancières présentes en base (identifiants vérifiés)

| Circulaire | id | Statut actuel | Observation |
|---|---|---|---|
| n° 105 (28 nov. 2013) | `cmqomvbgn001t11mf1eseajlz` | **`EN_VIGUEUR`** | ⚠️ **anomalie préexistante** — voir § 6.2 |
| n° 105-1 (3 avr. 2017) | `cmqbnm0dc000lsmfz6a4ehce5` | `EN_VIGUEUR` | à passer `ABROGE` (§ 6.1) |
| n° 117 (5 oct. 2020) | `cmqbnm0du0010smfzwe2im3jl` | `EN_VIGUEUR` | à passer `ABROGE` (§ 6.1) |
| n° 89-3 (contrôle interne) | `cmqmixgub00012xbwz8v3nqr6` | `EN_VIGUEUR` | cible d'un renvoi de la 117-1 |
| n° 129 / 129-1 (LBC/FT) | `cmqbnm0ed001dsmfzjn2r5y8q` / `cmqbnm0ef001esmfzx82dettd` | `EN_VIGUEUR` | cibles de renvois de la 117-1 |

---

## 2. Identité des deux documents à créer

### 2.1 Circulaire n° 105-2

| Champ | Valeur |
|---|---|
| `type` | `CIRCULAIRE_BRH` |
| `titleFr` | `Circulaire BRH n° 105-2 — Transmission au Bureau d'Information sur le Crédit (BIC) des informations sur les crédits octroyés` |
| `number` | `Circulaire n° 105-2` — **forme canonique obligatoire** (§ 2.4) |
| `status` | `EN_VIGUEUR` |
| `publicationDate` | `2025-09-15` (« Port-au-Prince, le 15 septembre 2025. ») |
| `effectiveDate` | `2025-10-15` (point 12 : « entre en vigueur le 15 octobre 2025 ») |
| `matiere` | `Droit bancaire` |
| `source` | `CIRC_BRH_105_2` |
| `sealed` | `true` |
| `sourcePdfUrl` | Blob privé `lam-pdfs` (§ 8.4) |

### 2.2 Circulaire n° 117-1

| Champ | Valeur |
|---|---|
| `type` | `CIRCULAIRE_BRH` |
| `titleFr` | `Circulaire BRH n° 117-1 — Pratiques de gouvernance` (reprend l'intitulé de la 117) |
| `number` | `Circulaire n° 117-1` |
| `status` | `EN_VIGUEUR` |
| `publicationDate` | `2025-11-20` (« Port-au-Prince, le 20 novembre 2025 ») |
| `effectiveDate` | `2026-01-05` (point 10 : « entrent en vigueur le 5 janvier 2026 ») |
| `matiere` | `Droit bancaire` |
| `source` | `CIRC_BRH_117_1` |
| `sealed` | `true` |
| `sourcePdfUrl` | Blob privé `lam-pdfs` |

### 2.3 Pourquoi une `source` dédiée par circulaire

`page.tsx:445-447` conditionne le lecteur annoté à `doc.source` :

```ts
hideInlineIndex={HIDE_INLINE_INDEX_SOURCES.has(doc.source ?? '')}
linkArtRefs={ART_REFS_SOURCES.has(doc.source ?? '') || (doc.source ?? '').startsWith('CC_VANDAL_')}
```

Ajouter `'BRH-WEB'` à ces ensembles changerait le rendu d'une **centaine** de circulaires
qui n'ont pas d'annotations — effet de bord non demandé. Deux sources dédiées
(`CIRC_BRH_105_2`, `CIRC_BRH_117_1`) isolent strictement le changement.

Second bénéfice : `import-brh.ts:371` fait `deleteMany({ where: { source: 'BRH' } })` avant
chaque réimport du recueil. Une source distincte met ces deux documents **hors de portée de
la purge**.

### 2.4 Forme canonique du numéro — contrainte de tri

`src/lib/brh/gaps.ts:49` :

```ts
/^(lettre[-\s])?circulaire\s+n[°ºo]?\s*\.?\s*(\d+)(?:-([1-9]))?$/i
```

Le numéro doit s'écrire **exactement** `Circulaire n° 105-2` / `Circulaire n° 117-1`.
Toute autre graphie (`105-2`, `Circ. 105-2`, `No 105-2`) casse `compareCirculaireNumber`
et renvoie la circulaire **en fin de liste** au tri par numéro, en plus de fausser
l'audit des circulaires manquantes (`src/lib/brh/gaps.ts`).

**Assertion à écrire** : `parseCirculaireRef(number)` retourne
`{ serie: 'CIRCULAIRE', base: 105, rev: 2 }` et `{ base: 117, rev: 1 }`.

---

## 3. Circulaire n° 105-2 — structure à reproduire

### 3.1 Corps (pages 1-4 du PDF)

Chapeau (visas) : articles **87 et 179** de la loi du 14 mai 2012 sur les banques,
article **69** du décret du 5 juin 2020 sur les IMF, article **12** de la loi du
26 juin 2002 sur les CEC.

**12 points numérotés** en `N.-`, dont le point 9 se subdivise :

| Point | Objet |
|---|---|
| 1.- | Définitions (*institution financière*, *filiale de banque*) |
| 2.- | Transmission mensuelle au BIC (au plus tard le 10) |
| 3.- | Chèques retournés pour insuffisance de fonds |
| 4.- | Champ et format (renvoi aux annexes) |
| 5.- | Obligations a) à e) (correction sous 5 jours, sécurisation…) |
| 6.- | Exactitude des informations · transmission partielle = défaut |
| 7.- | **Consentement signé de l'emprunteur** (à compter du 15 oct. 2025) + clause contractuelle |
| 8.- | Consultation obligatoire du rapport de crédit · validité 1 mois |
| 9.- | Pénalités → **9.1** retard de transmission · **9.2** retard de correction · **9.3** absence de rapport · **9.4** absence de consentement · **9.5** autres infractions |
| 10.- | Prélèvement automatique des amendes · pénalité de 2 500 HTG/jour |
| 11.- | Période de grâce de 4 mois pour toute institution nouvellement affiliée |
| 12.- | **Abroge la circulaire 105-1** du 3 avril 2017 · entrée en vigueur 15 oct. 2025 |

⚠️ **Montants — à reproduire au centime près, jamais reformulés** : 100 000 / 50 000 HTG
par jour jusqu'au 15 du mois ; 150 000 / 75 000 HTG au-delà ; 50 000 / 25 000 HTG pour
le retard de correction ; 200 000 HTG par cas pour 9.3, 9.4 et 9.5 ; 2 500 HTG/jour de
retard de paiement.

### 3.2 Annexes

- **ANNEXE 1** — A) Spécifications pour le transfert des fichiers : 1. Introduction ·
  2. Connectivité SFTP · 3. Processus de transmission · 4. Répertoires.
- **ANNEXE 2** — B) Spécifications des fichiers de collecte de données : 6 fichiers
  (`ent_resp_act_credit_*`, `ind_emp_credit_*`, `credit_surete_*`, `credit_activite_*`,
  `ent_cheque_*`, `ind_cheque_*`), chacun avec son tableau de champs.
- **ANNEXE 3** — Données de référence : tableaux 1 à 10.

### 3.3 Inventaire des 20 tableaux (**910 lignes cumulées**)

| # | Dimensions | Rattachement |
|---|---|---|
| T01 · T03 · T05 · T07 | 3 × 4 | Abréviations de type de crédit (répétées avant chaque fichier) |
| T02 | **45 × 6** | Fichier 1 — Entreprise / Responsable / Actionnaire / Crédit |
| T04 | **45 × 6** | Fichier 2 — Individu / Emploi / Crédit |
| T06 | 9 × 6 | Fichier 3 — Crédit / Garantie |
| T08 | 9 × 6 | Fichier 4 — Crédit / Activité |
| T09 | 21 × 6 | Fichier 5 — Entreprise / Chèques retournés |
| T10 | 29 × 6 | Fichier 6 — Individu / Chèques retournés |
| T11 | **86 × 2** | Tableau 1 — Secteur d'activités |
| T12 | **146 × 4** | Tableau 2 — Liste des communes (codes IHSI) |
| T13 | **141 × 4** | Tableau 3 — Liste des pays (ISO) |
| T14 | 20 × 2 | Tableau 4 — Forme juridique |
| T15 | 4 × 2 | Tableau 5 — Type de sûreté |
| T16 | 21 × 3 | Tableau 6 — Nature de la garantie |
| T17 | **190 × 5** | Tableau 7 — Liste des codes postaux |
| T18 | **102 × 2** | Tableau 8 — Liste des professions |
| T19 | 19 × 2 | Tableau 9 — Codes de statut des crédits |
| T20 | 11 × 3 | Tableau 10 — Responsabilité envers le crédit |

**Rendu attendu : `richBlocksJson`**, conformément au patron déjà employé pour la
circulaire 94-2 (38 blocs `type: 'table'`) et pour les réserves obligatoires. Contrat
défini dans `src/lib/doc/richblocks.ts` :

```ts
{ type: 'table', caption?: string, afterText?: string, untilText?: string, rows: RichCell[][] }
```

`afterText` / `untilText` doivent être des extraits **VERBATIM de `bodyOriginal`** encadrant
la zone aplatie que le tableau remplace ; sinon le bloc est ajouté en fin de document sans
rien retirer — d'où un **doublon silencieux**. C'est le principal risque de cette livraison.

**Assertion bloquante** : pour chacun des 20 blocs, `afterText` et `untilText` doivent être
trouvés **une seule fois** dans `bodyOriginal`, et dans cet ordre. Toute ancre absente ou
ambiguë (les 4 tableaux « Abréviation type de crédit » sont identiques !) fait échouer
l'import. Pour ces 4-là, l'ancre doit inclure la ligne `Nom du fichier N : …` qui les
précède, seule discriminante.

### 3.4 Sommaire (`toc` / `navToc`) — contrainte de segmentation

`segmentAnnotated` (`src/lib/legislation/annotated.ts:181-230`) apparie **ligne à ligne, dans
l'ordre** : une ligne du corps devient une section si et seulement si
`normLine(ligne) === normLine(toc[ptr].label)`. Un libellé qui ne correspond pas à une
**ligne entière** produit une ancre morte, silencieusement.

Or, dans la 105-2, les points 2 à 12 sont des **paragraphes entiers**, pas des titres courts.
Sont de vraies lignes-titres autonomes, donc éligibles au `toc` :

`1.- Dans le cadre de la présente circulaire, on entend par :` · `9.1. Retard de transmission`
· `9.2. Retard de correction` · `9.3. Absence de rapports de crédit` ·
`9.4. Absence de consentement au partage d'information` · `9.5. Autres infractions` ·
`Liste des annexes :` · `ANNEXE 1` · `A) SPÉCIFICATIONS POUR LE TRANSFERT DES FICHIERS` ·
`1. INTRODUCTION` · `2. CONNECTIVITÉ SFTP` · `3. PROCESSUS DE TRANSMISSION` · `4. RÉPERTOIRES`
· `ANNEXE 2` · `B) SPÉCIFICATIONS DES FICHIERS DE COLLECTE DE DONNÉES` · les 6 intitulés de
fichiers · `ANNEXE 3` · les 10 intitulés `Tableau N – …`.

⚠️ **Lignes répétées à l'identique — appariement en ordre.** Le corps contient
**7 occurrences** de `ANNEXE 3` (en-tête courant de page du scan), **4** de
`Abréviation type de crédit :`, **4** de `2 segments par enregistrement :`, et 2 chacune
de `- Entreprise : segment obligatoire`, `- Crédit : segment obligatoire`,
`- Individu : segment obligatoire`, `- Réf. Crédit : segment obligatoire`,
`- Chèque : segment obligatoire`. `segmentAnnotated` avance son pointeur dans l'ordre :
une entrée `ANNEXE 3` unique dans le `toc` s'apparie à la **première** occurrence, les
6 suivantes restant du texte courant. C'est le comportement voulu — mais les 6 répétitions
doivent être **retirées dans `bodyClean`** (en-têtes de page parasites), `bodyOriginal`
restant intact. Ne jamais dédupliquer en amont dans le `toc`.

➜ **Décision à arbitrer avant exécution : voir § 7.**

### 3.5 Index alphabétique (`indexEntries`)

Environ **90 à 110 sujets** couvrant les 12 points et les annexes. Format
`{ subject, ctRefs }`, `ctRefs` renvoyant aux ancres de sections retenues au § 7.
Sujets attendus, entre autres : *Amendes (barème par catégorie d'institution)*,
*Bureau d'Information sur le Crédit (BIC)*, *Chèques retournés pour insuffisance de fonds*,
*Consentement de l'emprunteur au partage d'informations*, *Filiale de banque (définition)*,
*Période de grâce des nouvelles affiliées*, *Prospection commerciale (interdiction)*,
*Rapport de crédit (validité d'un mois)*, *SFTP (connectivité)*, *Codes IHSI des communes*,
*Codes postaux*, *Formes juridiques*, *Professions (nomenclature)*, *Statuts de crédit*,
*Sûretés et garanties (nomenclature)*.

**Assertions** : 0 renvoi mort · couverture de **100 %** des divisions ancrées ·
aucun couple `(subject, ctRefs)` en double.

---

## 4. Circulaire n° 117-1 — structure à reproduire

### 4.1 Plan — les 20 têtes sont toutes des lignes autonomes

Chapeau (visas) : articles **23, 27, 28, 33 à 41, 83 et 161** de la loi du 14 mai 2012 ;
articles **20 à 31, 34 et 37** du décret du 5 juin 2020 sur les IMF ; articles **18 à 21
et 42** du décret du 25 novembre 2020 sur les intermédiaires de change.

```
1. Définitions
2. Mise en place d'un système de gouvernance
3. Rôle des administrateurs et dirigeants
4. Du conseil d’administration
   4.1. Attributions du conseil d’administration
   4.2. Caractéristiques et responsabilités en matière de gouvernance du conseil d’administration
      4.2.1 Composition et qualification du conseil d’administration
      4.2.2. Responsabilités en matière de gouvernance du conseil d’administration
   4.3. Participation aux réunions du conseil d’administration
5. De la direction générale et des dirigeants
   5.1. Responsabilités en matière de gouvernance de la direction générale
   5.2. Désignation des dirigeants
   5.3. Qualification des dirigeants
6. De la gestion et du contrôle du cadre organisationnel
   6.1. Des outils de gestion du cadre organisationnel
   6.2. Des outils de contrôle de la gestion du cadre organisationnel
7. De la gestion des risques liés à la défaillance de la gouvernance
8. Sanctions
9. Disposition transitoire
10. Entrée en vigueur
```

⚠️ **Piège déjà rencontré (phase 2 fiscale, TITRE IV de l'Enregistrement) :** le libellé
`4.2. Caractéristiques et responsabilités en matière de gouvernance du conseil
d’administration` fait **94 caractères**. **Aucun filtre de longueur** ne doit être appliqué
à la détection des têtes — c'est exactement ainsi que le TITRE IV avait disparu.
De même, `4.2.1` n'a **pas** de point final là où `4.2.2.` en a un : reprendre la
ponctuation **verbatim**, sans l'harmoniser.

`toc` : 20 entrées verbatim (`level` 1 pour `N.`, 2 pour `N.M.`, 3 pour `4.2.1`/`4.2.2.`).
`navToc` : arbre à 3 niveaux reprenant le plan ci-dessus.

### 4.2 Index alphabétique (`indexEntries`)

Environ **80 à 95 sujets**. Exemples : *Administrateur (définition)*, *Appétence pour le
risque*, *Casier judiciaire et certificat de police*, *Comité d'audit · gestion des risques
· nominations · rémunérations*, *Conflits d'intérêts*, *Cumul des mandats (interdiction
dans deux institutions de même catégorie)*, *Délai de la BRH (20 jours ouvrables)*,
*Deux dirigeants au moins (banques)*, *Groupes et sociétés mères*, *Loyauté, diligence,
vigilance, prudence, indépendance*, *Officier de conformité*, *Participation aux réunions
(seuil de 50 %)*, *Séparation des fonctions de président et de directeur général*,
*Transactions avec les personnes liées*.

**Assertions** : 0 renvoi mort · couverture 20/20 des sections · pas de doublon.

### 4.3 Points de vigilance rédactionnels

- Le chapeau annonce « un **quadruple** devoir » puis énumère **cinq** qualités (loyauté,
  diligence, vigilance et conformité, prudence et indépendance). **C'est le texte officiel** :
  le reproduire tel quel et le signaler par une note dans `crossRefs`, jamais le corriger.
- Le point 8 renvoie « aux sections **4.2.1 et 5.3** » : ce renvoi doit être cliquable
  (§ 7).
- Le point 9 (disposition transitoire) ne vise que la section 4.2.1.

---

## 5. Renvois croisés — cibles vérifiées en base

Toutes les ancres ci-dessous ont été **vérifiées présentes** (`art-N` dans `labels`).

### 5.1 Depuis la 105-2

| Renvoi du texte | Cible | Vérification |
|---|---|---|
| art. 87 et 179, loi du 14 mai 2012 | `LOI_BANQUES_2012` (`cms18kwzl0002pt2kbk9kv39y`) | 206 ancres — `art-87`, `art-179` **présentes ✓** |
| art. 69, décret du 5 juin 2020 (IMF) | `DECRET_IMF_2020` (`cms5d6tp200002695mv8c5bdb`) | 80 ancres — `art-69` **présente ✓** |
| art. 12, loi du 26 juin 2002 (CEC) | — | **texte ABSENT de la base** → mention sans lien + entrée dans les priorités d'acquisition |
| circulaire 105-1 (abrogée) | `cmqbnm0dc000lsmfz6a4ehce5` | lien interne ✓ |

### 5.2 Depuis la 117-1

| Renvoi du texte | Cible | Vérification |
|---|---|---|
| art. 23, 27, 28, 33 à 41, 83, 161 — loi de 2012 | `LOI_BANQUES_2012` | **les 16 ancres citées existent ✓** |
| art. 20 à 31, 34, 37 — décret IMF 2020 | `DECRET_IMF_2020` | **les 15 ancres citées existent ✓** (rappel : l'art. 13 n'existe pas au J.O., aucun renvoi ne le vise) |
| art. 18 à 21, 42 — décret du 25 nov. 2020, intermédiaires de change | — | **texte ABSENT** (seules les circulaires 119 et 127 traitent du sujet) → mention sans lien |
| « la circulaire sur les normes minimales de contrôle interne » (§ 4.2.2) | **n° 89-3** `cmqmixgub00012xbwz8v3nqr6` | lien interne ✓ — la 89-3 porte exactement ce titre |
| dispositif LBC/FT (§ 3, § 6.2) | n° 129 et n° 129-1 | liens internes ✓ |
| circulaire 117 (remplacée) | `cmqbnm0du0010smfzwe2im3jl` | lien interne ✓ |

### 5.3 Liens réciproques à poser

Sur le **décret IMF 2020** et la **loi bancaire 2012**, ajouter les deux nouvelles
circulaires à la table des textes d'application (`crossRefs[].docs`), comme cela a été
fait pour la loi UCREF ↔ décret IMF.

---

## 6. Effets sur le corpus existant

### 6.1 Abrogations expressément prononcées

| Document | Nouveau statut | `abrogatedByNumber` | Fondement |
|---|---|---|---|
| `Circulaire n° 105-1` | `ABROGE` | `Circulaire n° 105-2` | 105-2, point 12 : « abroge la circulaire 105-1 en date du 3 avril 2017 » |
| `Circulaire n° 117` | `ABROGE` | `Circulaire n° 117-1` | 117-1, point 10 : « Les dispositions de la présente circulaire remplacent celles de la circulaire 117 » |

Le bandeau d'abrogation (`page.tsx:111-116`) résout la cible **par numéro**, pas par id :
la forme canonique du § 2.4 est donc indispensable pour que le lien apparaisse.

### 6.2 Anomalie préexistante à corriger dans la même opération

La **circulaire n° 105** est encore `EN_VIGUEUR` en base alors que la **105-1** l'abroge
explicitement en son point 8 :

> « 8.- La présente circulaire abroge la circulaire 105 en date du 28 novembre 2013 »

À corriger : `Circulaire n° 105` → `ABROGE`, `abrogatedByNumber = 'Circulaire n° 105-1'`.
Le défaut est antérieur à cette livraison ; il devient visible parce que la chaîne
105 → 105-1 → 105-2 est désormais complète.

### 6.3 Faux positif écarté

L'audit des doublons de numéro remonte 5 « doublons » (88-1 ×3, 118-1, 89-2, 116, 114-3).
Vérification faite : ce sont les **notes additionnelles**, qui partagent volontairement le
numéro de la circulaire mère (`… — Note additionnelle`). **Convention du corpus, pas un
défaut** — ne rien dédupliquer.

---

## 7. Décision à arbitrer : ancrage des points numérotés

La consigne permanente demande des **renvois inline cliquables**. Or les circulaires ne
numérotent pas en « Article N » mais en « 1.- » / « 1. » :
`articleAnchorFromHeading` (`src/lib/doc/anchors.ts:44`) exige le préfixe
`article` / `art.` / `section` et ne produira donc **aucune ancre `art-N`**. Les renvois
internes réels sont :

- 105-2 § 9.1 : « dans le délai établi à **l'article 2** de la présente circulaire » ;
- 105-2 § 9.4 : « tel qu'exigé à la **section 7** de la présente circulaire » ;
- 117-1 § 8 : « énoncés aux **sections 4.2.1 et 5.3** de la présente circulaire ».

**Option A — sections seules (la plus sûre).** `toc` limité aux vraies lignes-titres
(§ 3.4 et § 4.1), ancres `sec-N`. Les renvois internes deviennent des **notes de
`crossRefs`** au lieu de liens. Aucune modification de code hors les deux `Set` de
`page.tsx`. **Limite :** les renvois de la 105-2 vers « l'article 2 » restent en texte brut.

**Option B — ancrage des points numérotés (recommandée).** Ajouter à `segmentAnnotated`
un mode piloté par les annotations, par exemple `annotations.pointAnchors: true`, qui
transforme une tête de paragraphe `^(\d{1,2})(?:\.\d+)*\.-?\s` en ancre `art-N` /
`art-N-M`. Le drapeau étant porté par le document, **l'impact sur les 29 000 autres
documents est nul**. Les renvois « l'article 2 », « la section 7 », « les sections 4.2.1
et 5.3 » deviennent alors tous cliquables, et l'index peut viser le point exact plutôt que
la section englobante.

➜ **Recommandation : option B**, seule conforme à la consigne « renvois inline cliquables ».
Elle demande ~30 lignes dans `annotated.ts` + un test d'assertion, et doit être livrée avec
une vérification que les documents **sans** le drapeau produisent une segmentation
strictement identique à l'actuelle (comparaison bloc à bloc sur le Code civil, le Code
pénal et la Constitution).

---

## 8. Pipeline d'exécution

### 8.1 Extraction (`scripts/data/circ-brh-105-2/parse_105_2.py`, `…/circ-brh-117-1/parse_117_1.py`)

Reprendre le patron éprouvé, **avec le correctif de tabulation obligatoire** :

```python
p = re.sub(r"<w:pPr>.*?</w:pPr>", "", m.group(0), flags=re.S)
# ⚠ la tabulation sépare deux <w:t> : la remplacer par une espace nue dans le XML
# ne sert à rien (seul le CONTENU des <w:t> est extrait) → injecter un <w:t> </w:t>.
p = re.sub(r"<w:tab\b[^>]*/?>", "<w:t> </w:t>", p)
p = re.sub(r"<w:br\s*/?>", "<w:t> </w:t>", p)
```

Pour la 105-2, parcourir `<w:tbl>` et `<w:p>` **dans l'ordre du corps** ; joindre les
paragraphes multiples d'une même cellule **par une espace** (leçon du décret minier :
sans cela on obtient `zinc ;Concentré`).

### 8.2 Index (`build_index.py` par circulaire)

Rédiger l'index **après lecture intégrale**, avec les assertions bloquantes du § 3.5 / § 4.2.
Produire `_index.json`. Ne jamais publier un index dont une assertion est désactivée.

### 8.3 Import (`scripts/_import-circ-brh-105-2.ts`, `_import-circ-brh-117-1.ts`)

Idempotents, `DIRECT_URL`, chargement manuel du `.env` (pas de `dotenv` dans le projet).
Avant écriture :

1. `segmentAnnotated(body, toc)` → **toutes** les entrées du `toc` appariées, dans l'ordre ;
2. 0 ancre morte dans `indexEntries` et `crossRefs` ;
3. couverture des divisions à 100 % ;
4. aucune annotation orpheline (clé sans cible) ;
5. `richBlocksJson` : les 20 couples `afterText`/`untilText` trouvés **une seule fois** ;
6. `buildSearchText` régénéré (titre + numéro + corps + matière).

### 8.4 Fac-similés PDF

Téléverser les deux PDF sur le Blob privé `lam-pdfs` via `uploadToBlob`, puis renseigner
`sourcePdfUrl`. **Passer `BLOB_READ_WRITE_TOKEN` explicitement** (piège connu du jeton OIDC).
Les circulaires sont téléchargeables par tous (`page.tsx:171` : `canViewPdf = type === 'CIRCULAIRE_BRH' || …`).

### 8.5 Câblage du lecteur annoté

Ajouter `'CIRC_BRH_105_2'` et `'CIRC_BRH_117_1'` à `HIDE_INLINE_INDEX_SOURCES` **et** à
`ART_REFS_SOURCES` dans `src/app/[locale]/(app)/doc/[id]/page.tsx`.

### 8.6 Durabilité — `scripts/brh-enrichments.json`

`import-brh.ts` purge `source: 'BRH'` puis réapplique `html[]`, `supplement[]` et `status[]`
depuis ce fichier. Les deux nouvelles circulaires ayant une source dédiée **échappent à la
purge**, mais il faut malgré tout :

- ajouter les deux circulaires à `supplement[]` (filet de sécurité en cas de reconstruction
  complète) — le schéma actuel force `source: 'BRH'` (`import-brh.ts:442`) : **l'étendre
  avec un `source` optionnel et un `annotationsJson` optionnel**, sans quoi une
  reconstruction les recréerait dépouillées de leurs annotations et sous la mauvaise source ;
- ajouter à `status[]` les **trois** changements du § 6 : 105 → `ABROGE` (par 105-1),
  105-1 → `ABROGE` (par 105-2), 117 → `ABROGE` (par 117-1).

Sans cette étape, le prochain `import-brh` **efface silencieusement** les abrogations.

---

## 9. Garde-fous § 02 et déontologie de la donnée

- `bodyOriginal` = texte officiel **inaltéré**. Corrections d'OCR ou de style éventuelles
  → `bodyClean` uniquement.
- **Aucun montant, code, seuil ou délai inventé.** Les nomenclatures des tableaux 1 à 10
  (codes IHSI, ISO, codes postaux, professions, statuts de crédit) sont reprises telles
  quelles ; une cellule illisible reste vide et est signalée, jamais devinée.
- Les incohérences du texte officiel (« quadruple devoir » suivi de cinq qualités,
  « 4.2.1 » sans point final) sont **conservées** et documentées en note.
- Toute suppression de document écrit un audit `DOC_DELETED` — aucune suppression n'est
  prévue ici.

---

## 10. Vérification finale

1. `npx tsc --noEmit` et `npm run build`.
2. Contrôle de rendu mécanique : pour chaque circulaire, comparer le nombre de lignes de
   `bodyOriginal` au nombre de lignes rendues (aucune ligne perdue), et vérifier que les
   20 tableaux de la 105-2 apparaissent **une seule fois** (pas de doublon d'ancrage).
3. Audit adverse en 3 lentilles (fidélité au PDF · intégrité de l'index et des renvois ·
   effets sur le corpus), avec vérification indépendante de chaque constat.
4. Contrôle du tri : dans la liste des circulaires triée par numéro, la 105-2 suit
   immédiatement la 105-1, et la 117-1 la 117.
5. Contrôle des bandeaux : 105, 105-1 et 117 affichent « abrogée par … » avec un lien vivant.
6. Commit, push, attente de `READY` sur Vercel, puis contrôle sur `lam.ht`.
7. Note de livraison `docs/livraison-circulaires-brh-105-2-117-1.md` + mise à jour de la
   mémoire projet (`project-brh-circulaires.md`).

---

## 11. Résumé des décisions à prendre avant exécution

| # | Décision | Recommandation |
|---|---|---|
| 1 | Ancrage des points numérotés (§ 7) | **Option B** — drapeau `pointAnchors` sur les deux documents |
| 2 | Corriger le statut de la circulaire 105 (§ 6.2) | **Oui**, dans la même opération |
| 3 | Étendre le schéma `supplement[]` de `brh-enrichments.json` (§ 8.6) | **Oui** — sinon perte silencieuse au prochain réimport |
| 4 | Loi CEC 2002 et décret « intermédiaires de change » 2020 absents (§ 5) | mention sans lien + ajout aux priorités d'acquisition |
