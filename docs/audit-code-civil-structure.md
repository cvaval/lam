# Rapport technique — Structure du Code civil dans « Législation annotée »

**Date** : 14 juillet 2026
**Objet** : analyse structurelle du Code civil d'Haïti tel qu'il est réellement stocké en base de production.
**Source des chiffres** : `npx tsx scripts/_audit-code-civil.ts` (lecture seule, rejouable). Aucun chiffre de ce rapport n'est estimé — tous sont mesurés sur la base de prod.

---

## 1. Synthèse

Le Code civil est le texte annoté le plus abouti de la plateforme, et sa structure est **saine** : segmentation exacte, aucune ancre dupliquée, aucune lacune de numérotation, aucune clé d'annotation orpheline, aucun renvoi d'index mort, aucun lien sortant cassé.

| Contrôle d'intégrité | Résultat |
|---|---|
| En-têtes du sommaire appariés au corps | **333 / 333** ✓ |
| Articles segmentés / ancres distinctes | **2047 / 2047** ✓ |
| Ancres dupliquées | **aucune** ✓ |
| Lacunes de numérotation (1→2047) | **aucune** ✓ |
| Clés d'annotation orphelines | **aucune** ✓ |
| Renvois d'index morts | **aucun** (sur 5 453) ✓ |
| Ancres d'amendement hors corps | **aucune** ✓ |
| Liens sortants (documents cibles) | **1 / 1 résolu** ✓ |

**Un seul défaut de fond est ressorti** (§ 6.3) : **23 articles affichent un badge « modifié » ou « abrogé » sans aucune explication** — ni ancienne version, ni texte modificateur, ni note. Deux points d'architecture méritent par ailleurs une décision (§ 6.4 et § 8).

---

## 2. Le document

Le Code civil est **un seul enregistrement `Document`** — pas un document par livre.

| Champ | Valeur |
|---|---|
| `id` | `cmr4b6f3v0000iz56asjmwrlg` |
| `source` | `CODE_CIVIL_ANNOTE` (déclencheur du lecteur annoté) |
| `type` | `LEGISLATION` → section « Législation annotée » |
| `status` | `EN_VIGUEUR` |
| `titleFr` | Code civil d'Haïti |
| `number` | Code civil du 27 mars 1825 |
| `matiere` | `civil` |
| `publicationDate` | 1825-03-27 |
| `bodyOriginal` | **668 Ko**, 3 166 lignes |
| `annotationsJson` | **601 Ko** |
| `searchText` | **1 063 Ko** (corps + texte des annotations, cf. § 7) |
| Thème rattaché | `droit-civil` (1 seul, sans ancre) |

Pas de PDF, pas de `bodyClean`, pas de `themeIndexJson` : le Code civil est un texte **nativement structuré** (issu du docx retravaillé), contrairement au Code des douanes ou aux éditions du Moniteur qui passent par OCR.

---

## 3. Le corps (`bodyOriginal`)

Texte brut, une ligne par paragraphe. Il est la **source unique de vérité** : le lecteur ne stocke aucun HTML. Toute la structure (titres, articles, ancres) est **recalculée à la lecture** par `segmentAnnotated()`.

Le découpage repose sur deux règles, dans cet ordre :

1. **En-tête de section** — la ligne est *identique* à un libellé de la `toc` attendue, **dans l'ordre**. C'est un appariement positionnel strict, pas une heuristique : le parseur qui a produit la `toc` a lu le même corps, donc les libellés sont mot pour mot des lignes du corps.
2. **En-tête d'article** — `articleAnchorFromHeading()` reconnaît « Article N. … » et ouvre un bloc portant l'ancre `art-N`.

Tout le reste s'agrège au bloc courant.

> **Conséquence structurelle importante** : une ligne du corps qui *ressemble* à un article en ouvre un. C'est exactement le mécanisme qui a corrompu l'article 6 du **Code du travail** (une note « Article 35 » de la Constitution, insérée en clair dans le corps, y créait un article fantôme qui captait la jurisprudence de l'article 6). **Le Code civil est indemne de ce défaut** (§ 5).

### 3.1 Dix blocs sans ancre

10 blocs de corps ne portent ni ancre de section, ni ancre d'article :

```
1.  RÉPUBLIQUE D'HAÏTI / CODE CIVIL          (page de titre)
2.  Des effets de l'absence relativement aux biens…
3.  Des effets relativement au mariage
4.  Dispositions générales
5.  De l'administration de la communauté…
6.  De l'acceptation de la communauté et de la renonciation…
7.  Dispositions générales
8.  DES DIFFÉRENTES MANIÈRES DONT LE MANDAT FINIT
9.  DES CAUSES QUI INTERROMPENT OU SUSPENDENT LE COURS DE LA PRESCRIPTION
10. Dispositions générales
```

Le n° 1 est la page de titre (normal). **Les neuf autres sont de véritables intertitres du Code** (§ / paragraphes) qui **ne figurent pas dans la `toc`** : ils s'affichent donc en texte courant, sans ancre, et sont **absents du sommaire latéral**. Défaut mineur mais réel (§ 9, recommandation R3).

---

## 4. `annotationsJson` — anatomie

Objet unique de 601 Ko, 13 clés. C'est **la totalité de l'appareil critique**.

| Clé | Forme | Poids | Rôle |
|---|---|---|---|
| `labels` | objet, **2047** | 49,8 Ko | ancre → « Article N » (libellé affiché) |
| `toc` | tableau, **333** | 35,3 Ko | en-têtes, appariés au corps dans l'ordre |
| `navToc` | tableau, **1 groupe / 333 nœuds** | 28,7 Ko | même hiérarchie, mais **arborescente** (sommaire latéral) |
| `indexEntries` | tableau, **1454** | 84,2 Ko | index alphabétique : sujet → articles |
| `jurisprudence` | objet, **283 clés** | **318,4 Ko** | arrêts par article (le plus gros poste) |
| `connexe` | objet, **35 clés** | 75,7 Ko | législation connexe repliable, par article |
| `oldVersions` | objet, **13** | 5,4 Ko | ancienne version repliable |
| `status` | objet, **38** | 0,7 Ko | badge « modifié » / « abrogé » |
| `commentaires` | objet, **7** | 0,7 Ko | commentaires doctrinaux |
| `crossRefs` | tableau, **2** | 1,8 Ko | renvois éditoriaux au niveau section |
| `connexes` | tableau, **0** | — | *(sections d'annexe — vide : le Code civil n'a pas d'annexe interne)* |
| `title` / `annotationAuthor` | chaînes | — | `annotationAuthor` est **vide** (pas d'annotateur nommé, contrairement au Code du travail = J.-F. Salès) |

### 4.1 Deux formats de clé — à ne pas confondre

C'est le piège le plus coûteux de ce modèle :

| Clé | Forme | Pourquoi |
|---|---|---|
| `jurisprudence`, `commentaires` | **`sec-K\|art-N`** (qualifiée par section) | anti-collision : les annexes et lois internes renumérotent depuis l'article 1 |
| `connexe`, `oldVersions`, `status`, `labels` | **`art-N`** (ancre nue) | pas de collision possible : la numérotation du Code civil est continue |

Le Code civil ayant une numérotation **strictement continue de 1 à 2047**, la qualification par section est ici redondante — mais elle est conservée pour rester homogène avec le Code du travail, où elle est indispensable.

---

## 5. Hiérarchie et articles

### 5.1 Sommaire — 333 en-têtes, 3 niveaux

| Niveau | `kind` | Nombre |
|---|---|---|
| 1 | `loi` | **36** |
| 2 | `chapitre` | **122** |
| 3 | `section` | **175** |

`navToc` reprend cette hiérarchie sous forme d'arbre (1 groupe racine « Code civil d'Haïti », 36 enfants directs, 333 nœuds, profondeur 3), consommé par `CodeSidebar`.

### 5.2 Articles — 2047, sans trou

- 2 047 blocs d'article, **2 047 ancres distinctes** — bijection parfaite.
- Numérotation **continue de 1 à 2047**, **aucune lacune**, **aucun doublon**.
- 2 047 `labels` déclarés — cohérence exacte avec le corps.
- `noAnchors` (suppression d'ancre pour 2ᵉ occurrence) : **0** — inutile ici, faute de doublon.

C'est la condition qui rend les renvois `#art-N` fiables : chaque ancre est unique et résolue.

---

## 6. Amendements — **deux mécanismes coexistent**

C'est le point d'architecture le plus important du dossier. Le Code civil porte **38 articles à statut**, traités par **deux voies différentes**.

### 6.1 Voie A — overlay `ArticleVersion` (13 articles)

Table relationnelle `ArticleVersion`, **16 lignes / 13 articles**, toutes d'origine `MANUAL`, appliquées **au rendu** par `applyAmendments()` → `effectiveBody`.

| `status` | Nombre | Sens |
|---|---|---|
| `MODIFIE` | 3 | ancienne version conservée (art. 293, 311, 606) |
| `EN_VIGUEUR` | 3 | texte de remplacement affiché (art. 293, 311, 606) |
| `ABROGE` | 10 | art. 294, 295, 302, 303, 304, 306, 308, 309, 313, 611 |

13 de ces 16 lignes portent `amendedByDocId` → **Loi sur la Paternité, la Maternité et la Filiation** (2014), document existant et résolu. Les 3 lignes sans lien sont les versions historiques (`MODIFIE`).

> **Vérification faite** : la séquence d'abrogation (302, 303, 304, **306**, **308**, 309) *saute* 305 et 307. Ce n'est **pas** un oubli : la liste est explicite dans `scripts/_import-loi-filiation.ts` (`ABROGATED`), l'article 8 de la loi ne visant que ces six-là. **Aucune correction requise.**

### 6.2 Voie B — badge `annotationsJson.status` seul (25 articles)

25 articles portent un statut **sans** ligne `ArticleVersion` : leur texte modifié est **déjà consolidé dans le corps** (décrets intégrés à l'édition d'origine). Le `status` n'y est qu'un **badge d'affichage**.

### 6.3 ⚠️ Défaut — 23 badges sans aucune explication

Sur ces 25, **23 n'ont ni ancienne version, ni note connexe, ni overlay**. L'utilisateur voit :

> **Article 140** &nbsp;`ABROGÉ`

…sans savoir **par quel texte**, **à quelle date**, ni **ce que disait l'article**. Pour un praticien, un « abrogé » non sourcé est peu exploitable — et potentiellement trompeur.

Articles concernés :

```
19, 20, 130, 140, 141, 142, 143, 145, 229, 230, 241, 305,
314, 315, 325, 330, 332, 333, 335, 479, 608, 617, 742
```

(Seuls **55** et **331** — sur les 25 — disposent d'une note connexe explicative.)

À comparer aux 13 articles de la voie A, qui affichent, eux, l'ancienne version *et* le texte modificateur cliquable. **L'asymétrie de qualité est nette.**

### 6.4 Conséquence d'architecture

Les deux voies ne sont **pas unifiées** : un même badge « abrogé » recouvre deux réalités techniques distinctes, avec deux niveaux d'information très inégaux. Tout amendement futur devra choisir une voie — sans règle écrite aujourd'hui.

---

## 7. Index, jurisprudence, renvois

### 7.1 Index alphabétique — excellent

- **1 454 sujets**, **5 453 renvois** (3,8 par sujet).
- **Couverture : 2 046 / 2 047 articles** (~100 %).
- **Aucun renvoi mort.**
- Seul article non indexé : **art-479** — qui est précisément **abrogé**. Cohérent.
- Type `IndexEntry { subject, ctRefs }` — attention, la clé est **`ctRefs`**, pas `refs` (`refs` appartient à `Backlink`, qui porte les *autres* articles du même sujet).
- `indexBacklinks()` inverse l'index : sous chaque article s'affichent les sujets qui le citent, chacun renvoyant aux articles voisins traitant du même thème.

### 7.2 Jurisprudence

- **283 articles annotés / 2 047** (13,8 %) — **1 031 arrêts**.
- Rendue par le composant `Jurisprudence`, **variante `annotations`** pour le Code civil (titre « Annotations », commentaires doctrinaux + arrêts) — là où le Code du travail utilise la variante `juris` (« Jurisprudence »).
- Carte **repliable, fermée par défaut**.

### 7.3 Législation connexe

- **35 articles porteurs**, **37 blocs**.
- **13 blocs portent un `docId`** → l'intitulé devient un lien vers la fiche du texte modificateur (tous vers la Loi Filiation).
- **0 bloc porte une `anchor`** — le champ `ConnexeBlock.anchor` (ajouté le 13 juillet pour le renvoi Code du travail → Constitution art. 35) n'est **pas encore exploité** ici : les liens pointent vers le haut du document cible, pas vers l'article précis.
- **1 bloc a un libellé vide** (`label: ''`) — cas « citation nue », prévu par le type, mais à vérifier éditorialement.

### 7.4 Renvois croisés et renvois inline

- `crossRefs` : **2 entrées**, toutes deux sur des ancres de section valides.
  - `@sec-41` → 1 document + **2 articles insérés** (les principes généraux de la Loi Filiation, affichés sous l'en-tête LOI Nº 8).
  - `@sec-93` → 1 document (successions : art. 606 modifié, 611 abrogé).
- **Renvois inline** : le Code civil active `linkCivRefs` — les mentions « **C. civ., N** » dans le texte deviennent des liens `#art-N`. Il n'active **pas** `linkArtRefs` (« article N » nu), contrairement aux Codes pénal et des douanes.

---

## 8. Rendu et poids

### 8.1 Chaîne de rendu

```
Document (bodyOriginal + annotationsJson)
   └─ parseAnnotations()            coercition défensive (une régression de champ ne casse pas la page)
   └─ applyAmendments()             overlay ArticleVersion → effectiveBody      [serveur]
   └─ segmentAnnotated()            corps → blocs section/article               [serveur]
   └─ AnnotatedText                 SERVEUR — rend les 2047 articles en HTML
        ├─ OfficialText             SERVEUR — liens inline « C. civ., N »
        ├─ Jurisprudence            CLIENT  — carte repliable (par article)
        ├─ RelatedLaw               CLIENT  — connexe + ancienne version
        └─ OldVersion               CLIENT
   └─ CodeSidebar                   CLIENT  — reçoit navToc + indexEntries
```

Le corps n'est **pas** envoyé au client comme donnée : il est rendu en HTML côté serveur. **Bon choix.**

### 8.2 ⚠️ Poids du payload client

En revanche, les composants clients reçoivent leurs données **sérialisées dans le payload RSC** :

| Donnée sérialisée vers le client | Poids |
|---|---|
| `jurisprudence` (props de `Jurisprudence`) | 318 Ko |
| `indexEntries` (props de `CodeSidebar`) | 84 Ko |
| `connexe` (props de `RelatedLaw`) | 76 Ko |
| `navToc` (props de `CodeSidebar`) | 29 Ko |
| `oldVersions` | 5 Ko |
| **Total ≈** | **~512 Ko de JSON** |

…auxquels s'ajoute le **HTML de 2 047 articles**. La page du Code civil est donc **la plus lourde de la plateforme**, et tout est envoyé **d'emblée**, alors que 100 % des cartes de jurisprudence sont **fermées par défaut** (l'utilisateur n'en ouvrira qu'une poignée).

C'est le principal gisement de performance identifié.

---

## 9. Constats et recommandations

| # | Constat | Gravité | Recommandation |
|---|---|---|---|
| **R1** | **23 articles** affichent « modifié » / « abrogé » **sans aucune source** (§ 6.3) | **Élevée** — qualité juridique | Renseigner, pour chacun, le texte modificateur (décret/loi + date + Moniteur) dans un bloc `connexe`, comme cela a été fait pour les art. 55 et 331. À défaut de source fiable, envisager de **retirer le badge** plutôt que d'afficher une mention non sourcée. |
| **R2** | Deux mécanismes d'amendement non unifiés (§ 6.4) | Moyenne — dette | Écrire la règle : `ArticleVersion` pour tout amendement **postérieur** à l'édition (overlay, ancienne version conservée) ; `status`+`connexe` pour le **déjà consolidé**. Idéalement, faire porter à la voie B au moins la même note de source que la voie A. |
| **R3** | 9 intertitres réels absents de la `toc` (§ 3.1) | Faible | Les ajouter à la `toc`/`navToc` (niveau 4) pour qu'ils soient ancrés et navigables. |
| **R4** | ~512 Ko de JSON envoyés au client, cartes fermées par défaut (§ 8.2) | Moyenne — performance | Charger la jurisprudence **à la demande** (route `/api/doc/[id]/jurisprudence?art=N` à l'ouverture de la carte). Gain immédiat : **−318 Ko**, soit ~62 % du payload. |
| **R5** | `ConnexeBlock.anchor` inexploité (§ 7.3) | Faible | Faire pointer les 13 liens connexe vers l'**article précis** de la Loi Filiation (`#art-N`), et non vers le haut du document. Le champ existe déjà. |
| **R6** | 1 bloc connexe à libellé vide (§ 7.3) | Faible | Vérification éditoriale. |

**Aucune régression** n'a été détectée sur les invariants critiques : le Code civil ne souffre **pas** du défaut d'ancre fantôme qui avait corrompu l'article 6 du Code du travail.

---

## 10. Rejouer l'audit

```bash
npx tsx scripts/_audit-code-civil.ts
```

Lecture seule. À relancer après tout ré-import, enrichissement de l'index, ajout de jurisprudence ou nouvel amendement : il détecte les ancres dupliquées, les lacunes de numérotation, les **clés orphelines**, les renvois d'index morts et les liens sortants cassés.
