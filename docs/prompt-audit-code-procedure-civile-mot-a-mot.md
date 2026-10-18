# Prompt — Audit du Code de procédure civile, mot à mot et alinéa par alinéa, contre le fac-similé

> **Demande de Me Vaval (18 oct. 2026)** : « Generate a prompt similar to the one for the Code Civil to review the
> Code de Procédure Civile. Une fois le prompt rédigé, lancer la production pour la recherche mot à mot et les sauts
> de ligne pour optimiser l'accuracy du document. » Pièce fournie : `~/Library/CloudStorage/Dropbox/Moniteur/Code_procedure_civile-pdf.pdf`.
> Modèle : [prompt-audit-code-civil-mot-a-mot.md](prompt-audit-code-civil-mot-a-mot.md).

Tu audites la fiche **Code de procédure civile d'Haïti** de la Législation annotée. Pour chaque article, tu établis :
1. **le mot à mot** : le texte en base est-il, lettre pour lettre, celui du livre ?
2. **les sauts de ligne** : chaque alinéa du livre est-il une ligne en base, et une seule ?

**Tu ne corriges rien tant que le rapport n'est pas validé** (§ 9). Tu produis un relevé exhaustif, prouvé sur
l'image, des écarts classés par nature, puis un correctif qui ne s'exécute que sur les natures validées.

> **Décisions de Me Vaval reprises du Code civil (18 oct. 2026)** — elles valent ici sauf avis contraire :
>
> | Décision (texte de Me Vaval) | Ce que tu en fais pour le CPC |
> | --- | --- |
> | coquilles du livre : « uniquement corriger ne pas besoin de signaler » | la base porte la forme correcte, sans note au lecteur (§ 4) |
> | « le contenu du livre prévaut. corriger ce qui est en base. » | hors coquille évidente, le texte du livre gagne |
> | gloses de l'éditeur : « les deplacer dans anotations » | tout intrus d'appareil sort du corps vers les annotations, jamais supprimé |
> | « Les "D." pour les abrogations ou amendements signifient "décret". Remplacer par Décret et, quand le texte ou le moniteur est en base, faire la cross-reference. » | les marques de modification (« Article 18 (Mod. L. 18 sept 1985 et D. 22 août 1995).- ») disent « Décret » ; les actes en base sont liés (`annotations.actesLies`, § 6.6) |
> | typographie : « oui harmoniser » | la convention du Code civil (§ 4.1) — **à confirmer pour le CPC** : elle touche 3 617 apostrophes et 615 points-virgules (§ 9) |
> | « italique = abrogé » | **ne s'applique pas** : au CPC l'italique est celui de la jurisprudence (vérifié, § 3) |

---

## § 0. Règles absolues

- **`.env` pointe sur la base de PRODUCTION** (Supabase). Toute écriture est une écriture en production.
- **Jamais de ré-import** du CPC : la fiche (`cms7u9239000212wwoddflgnu`, `source = CODE_PROCEDURE_CIVILE`) est citée par
  12 documents (59 renvois) et porte l'index de 1 060 entrées. On corrige **en place**.
- **Ne touche pas une ligne d'en-tête** hors de la procédure du § 6.2. Le lecteur reconnaît un intitulé à l'**égalité
  exacte** de la ligne et du libellé de table attendu (table parcourue dans l'ordre) ; les clés de jurisprudence
  `sec-K|art-N` en découlent. Un intitulé ajouté à la table change la clé de tous les articles qui le suivent dans sa
  section : leurs notes se **re-clefent** dans la même écriture, ou elles deviennent orphelines.
- **Aucune mention d'édition, d'éditeur ni d'annotateur** dans les métadonnées publiées (consigne de la cliente) : le
  livre (éd. La Périchole, 2013, annoté par Pierre Marie Michel) est une **pièce de contrôle**, pas une source citée.
- **L'image prévaut.** La couche texte a été océrisée par Acrobat Paper Capture : elle lit « Ane art » pour « Anc
  art », « Article IO » pour « Article 10 », perd la graisse de deux têtes sur trois et fond la note de marge dans la
  ligne de loi. Elle sert à la **géométrie**, et de second témoin — jamais d'arbitre.
- **Claude (vision) normalise ce qu'il lit** (accents, coquilles réparées) : aucun mot ne se décide sur une seule
  lecture par un modèle. Deux témoins, et l'image regardée en cas de désaccord.
- **Le dépôt GitHub est PUBLIC** : aucune image du fac-similé n'y entre ; recadrages dans le scratchpad ou dans
  `~/Library/CloudStorage/Dropbox/Lam Veritab/`, hors de `lam-veritab/`.
- Avant tout `--commit` et tout commit : `npx tsx scripts/verifier-empreintes-donnees.ts` **seul**, sortie lue.
  `git add` fichier par fichier ; jamais `tsconfig.json` ni le travail d'une autre session.
- Pooler Supabase à `connection_limit=1` : un seul fil d'écriture.

---

## § 1. État mesuré (18 oct. 2026)

| Élément | Valeur |
| --- | --- |
| Fiche | `cms7u9239000212wwoddflgnu`, `type=LEGISLATION`, `source=CODE_PROCEDURE_CIVILE` ; source d'import : `CPC_cumule_corrige.docx` (30 juil.) |
| Corps | `bodyOriginal`, **1 955 lignes** ; `bodyClean` null |
| Convention | **une ligne = un alinéa** ; tête « **Article N.-** » (forme du livre) en tête de la ligne du 1er alinéa |
| Articles | **1 040** = 997 entiers (1 → 997, sans lacune) + 43 décimaux du Livre IX (957-1 … 978-1) |
| Intitulés (`toc` = `navToc`) | **116** : 10 livres · 73 titres · 3 chapitres · 30 sections |
| Statuts | **83** : 40 « modifié » · 43 « nouveau » (Livre IX, décret du 28 déc. 2005 ; 717-728 loi du 12 sept. 1966 ; 18 ; 813) — **0 `ArticleVersion`** |
| Annotations | jurisprudence : 317 clés, 1 287 notes · `commentaires` : 771 (« Ancienne numérotation : article N. ») · `connexe` : 14 · index : 1 060 entrées |
| Typographie | apostrophes **’ 3 617 / ' 0** · insécables 45 · « ; » collé 615 / précédé d'une espace 26 · « : » 48 / 22 · doubles espaces, tabulations, lignes vides : 0 |

**Contrôles mécaniques sur le corps** :

| Signal | Nombre | Exemples |
| --- | ---: | --- |
| **tête seule sur sa ligne** (« Article 385.- », le texte à la ligne suivante) | **90** | arts 385 → 474, tout le Livre IV |
| **intertitres hors table**, composés comme du texte | **≈ 27** | 4 hors de tout article (« I.- De la caution à fournir par les étrangers », « I.- Des demandes incidentes », « I.- De la comparution personnelle des parties », « A.- Dispositions générales ») ; ≈ 23 **dans** l'article qui les précède (« II.- De l'incompétence… » à la fin de l'art. 97, « III.- Des nullités » art. 102, « IV.- … » 103, « V.- … » 117, 120, 123, 161, 186, 229, 235, 257, « B.- / C.- / D.- De la récusation… » 441, 446, 452) |
| notes de l'éditeur dans le corps | 1 | art. 997 : « [1] L'art 929 correspond à l'art 424. [2] L'art 954 correspond… » |
| marques de modification en tête | 15 | « Article 18 (Mod. L. 18 sept 1985 et D. 22 août 1995).- », « Article 717 (L.12 sept 1966).- » (717-728), « Article 813 (D. 29 mai 1968).- » ; 2e alinéa de l'art. 61 : « (L. 28 août 1980).- » — **c'est le livre** |
| lignes hors de tout article | 15 | titres de livre (« Sur le mode de procéder à la Justice de Paix »…) et les 4 intertitres ci-dessus |

### Ce qui a déjà été fait — et ce qui ne l'a jamais été

| Date | Passe |
| --- | --- |
| 30 juil. | import des Livres I-X depuis `CPC_cumule_corrige.docx` ; contrôle « le PDF comme second témoin » : 996/997 articles repérés, **présence des mots seulement** |
| 31 juil. | jurisprudence et ancienne numérotation sorties du corps (5 543 → 1 955 lignes) ; concordance française retirée |
| 28-29 août | Livre IX : décret du 28 déc. 2005 posé en annotation (83 pastilles), corps intact |

**Jamais fait** : une collation article par article, en mots ET en alinéas, contre l'image.

### Mesure préalable — l'Appendice (lot 2, hors de cette production sauf avis contraire)

Recouvrement des **trigrammes de mots** de chaque texte de l'Appendice (116 fiches `CPC_APPENDICE_*`) par le
fac-similé (p. 285-489) :

| Recouvrement | Fiches | Lecture |
| --- | ---: | --- |
| ≥ 0,9 | 90 | conformes au livre |
| 0,5-0,9 | 10 | à collationner |
| **< 0,5** | **16** | 2 expliquées (tarif judiciaire I.E et loi CSPJ I.A.7.3 : reprises du J.O. fourni par la cliente, plus complet que le livre) ; **14 ne reproduisent pas le livre** (IV.1 à IV.6, III.5, III.6.1, III.6.2 — dont les décrets de 1968 et 1982 et la loi de 1949 sur le divorce, constat du 18 oct.) |

⚠️ Ces 14 fiches ne doivent être **liées nulle part** tant qu'elles ne sont pas reprises sur le livre.

---

## § 2. Les témoins, et leur rang

| Rang | Témoin | Vaut pour | Ne vaut pas pour |
| --- | --- | --- | --- |
| **1 — arbitre** | **image** du fac-similé (PyMuPDF, ≥ 300 dpi, recadrée sur la colonne) | tout | — |
| 2 | **Tesseract 5.5.2** `fra`, **colonne par colonne**, sur l'image où tout ce qui n'est pas une ligne de loi est blanchi | second témoin indépendant, mot par mot | ponctuation fine, chiffres romains, puces |
| 3 | **couche Acrobat** (OCR de 2013) | géométrie ; soutien d'une lecture de la base | **pas indépendant de la base** : la transcription d'import en est partie |
| 4 | **l'acte modificatif** | rédaction en vigueur : Loi du 18 sept. 1985 (`LOI_ORGANISATION_JUDICIAIRE_1985`), Décret du 22 août 1995 (`CPC_APPENDICE_I_B_1`, fidèle 0,98), Loi du 28 août 1980 (`CPC_APPENDICE_I_C_1_2`, 1,0), Décret du 28 déc. 2005 (`DECRET_LIVRE_IX_CPC_2005`) | la loi du 12 sept. 1966 (717-728) et le décret du 29 mai 1968 (813) ne sont **pas** au corpus |
| ✗ | `CPC_cumule_corrige.docx`, `Code_procedure_civile_*.docx` (Téléchargements) | rien : c'est la **source de la base** | — |

**Règle de décision — mots** : base = Tesseract (au bruit d'OCR près, § 4) ⇒ conforme. Le bruit n'est admis que si la
couche Acrobat lit ce que porte la base, ou si l'écart se réduit à des espaces perdus (« surle-champ », « Article436 »),
à un appel de note (« paix.1 ») ou à une confusion classique (« 1er/ler/Ier », « É/E »). **Quand Tesseract et Acrobat
s'accordent contre la base, c'est l'image**, toujours.

**Règle de décision — alinéas** : bornes de la base = bornes du livre (§ 3) ⇒ conforme. Sinon l'image.

Tire au sort **5 % des articles « conformes »** et relis-les entiers sur l'image : c'est la mesure du tri. S'il
dépasse 0,5 % d'écart dans le texte de loi, resserre le tri.

---

## § 3. Anatomie du livre (mesurée)

**Le volume** — 567 pages ; **index PDF = folio imprimé**. Liminaires p. 1-14 (préface, avertissement, abréviations
p. 13) · **Code p. 17-284** (Livre I p. 17, II p. 35, III p. 125, IV p. 143, V p. 173, VIII p. 257, IX p. 271, X p. 279) ·
Appendice p. 285-489 · tables alphabétique (p. 490) et chronologique (p. 526), table des matières (p. 563).

**La page** — 670 × 825 pt, **deux colonnes**, chacune précédée d'une **bande de notes de marge** ; les colonnes
bougent d'une page à l'autre (scan) : on les localise page par page.

| Strate | Composition (couche texte) | Ce qu'en fait la base |
| --- | --- | --- |
| **texte de loi** | Times romain 10-12,8 pt, pas de ligne **12,4-13 pt** ; un **nouvel alinéa** : **≥ 15,5 pt** (mesuré : 12-13 → 7 003 interlignes, 16-18 → 982) | corps, une ligne par alinéa |
| tête | « **Article N.-** » (gras à l'image ; la couche perd la graisse 2 fois sur 3) | début de la ligne du 1er alinéa |
| marque de modification | « Article 18 (Mod. L. 18 sept 1985 et D. 22 août 1995).- » ; en tête d'alinéa : « (L. 28 août 1980).- » | dans la ligne, telle quelle (« D. » → « Décret », § 4.1) |
| énumération | « 1°) … », « a) … », puces « • » (Livre IX) | un item = une ligne |
| **intitulés** | « LIVRE II » en italique ≈ 13 pt + son titre ; « Titre II.- … », « Section I.- … » en gras ; **intertitres** « I.- … », « A.- … » | table ; les intertitres **manquent** à la table (§ 6.2) |
| note de marge | « Art 62 fr » (concordance française) · « Anc art 72 » (ancienne numérotation) | la 1re **retirée** (décision du 31 juil.) ; la 2e en `commentaires` |
| **jurisprudence** | Helvetica oblique ≈ 10 pt, parfois Times italique 11 ; notes « 1.- … », arrêt « Cass. 1ère sect., 24 juin 1974 - … » | `annotations.jurisprudence` |
| notes de bas de page de l'éditeur | Times romain ≈ 7,9 pt, appel en exposant dans le texte (« paix.¹ ») | ni corps ni appel d'exposant |
| titres courants, folio | Helvetica 7-8 pt | ignorés |

⚠️ **Pas de convention « italique = abrogé »** : aucune ligne de loi en italique dans le Code (p. 17-284) ; les seules
mentions d'abrogation sont dans les notes de bas de page de l'éditeur (p. 19, 252).

**Pièges de la page** (chacun a coûté une passe à la phase 1) :
- la **note de marge est fondue dans la ligne de loi** par la couche texte, dans un même fragment : « Ane art 368
  avant le commencement de la plai- », « Ancart353 mé au cours… », « !\.ne art 192 du délai… » ;
- la note de marge de la **colonne droite** est composée juste après la fin des lignes de gauche (x ≈ 285-340) : son
  centre tombe à gauche du milieu de page ;
- la **tête** a sa ligne de base 1-2 pt plus bas que la suite de sa ligne, et un espace large après « Article 342.- » ;
- un alinéa traverse les **sauts de colonne et de page** ; la jurisprudence s'intercale entre deux colonnes de loi ;
- les **césures** se recousent (« pronon- / cées ») ; un trait d'union réel se garde : l'image tranche.

---

## § 4. Ce que « mot à mot » veut dire

**Est un écart** toute différence de lettre, d'accent, de chiffre, de ponctuation, de majuscule ou d'ordre entre la
base et le livre — y compris quand la base a « raison ». Exemples mesurés : le livre imprime à l'art. 5 « Dans **le**
cas prévus », à l'art. 10 « les **délai** prévus », à l'art. 44 « se **pouvoir** au pétitoire » ; la base porte « les
cas », « les délais », « se pourvoir ». Si l'image confirme le livre, ce sont des **coquilles du livre** : la base garde
la forme correcte, sans note (décision). La règle ne vaut que pour une faute **évidente et sans portée** ; une
divergence qui peut changer le sens va au rapport.

**Natures d'écart** (liste FERMÉE) : `mot` · `ocr` (séquelle d'OCR en base) · `coquille-du-livre` · `ponctuation` ·
`casse-accent` · `alinea-fusionne` · `alinea-scinde` · `tete-seule` · `enumeration` · `cesure` · `intrus-appareil`
(note, jurisprudence, renvoi dans le corps) · `intrus-structure` (intertitre, titre courant collé dans un article) ·
`intitule` (intitulé absent de la table ou libellé différent) · `manque` · `marge` (ancienne numérotation fausse) ·
`typographie`.

### 4.1 Typographie

| Élément | Convention | Statut |
| --- | --- | --- |
| tête | « **Article N.-** » — la forme du livre (le CPC ne prend pas la forme « Art. N » du Code civil) | conforme (1 040) |
| marques d'acte | « D. » → « **Décret** », « D-L » → « **Décret-loi** » (décision du 18 oct.) ; « L. » → « **Loi** » | **« L. » à valider** (§ 9) |
| apostrophe | droite « ' » (convention du Code civil : `fold()` ne ramène pas ’ à ') | **à valider** : 3 617 |
| espaces | ni insécable (45), ni cadratin, ni double espace | s'applique |
| avant « ; » et « : » | une espace (convention du Code civil) | **à valider** : 615 + 48 |
| à ne pas toucher | les lignes d'en-tête, « .- » après la tête, les énumérations « 1°) » | — |

---

## § 5. Ce que « sauts de ligne » veut dire

1. **Un alinéa du livre = une ligne de la base.** Jamais la ligne imprimée.
2. « **Article N.-** » ouvre la ligne de son premier alinéa : **aucune tête seule** (90 au Livre IV).
3. **Énumération** : chaque item est un alinéa.
4. Un alinéa qui traverse une colonne, une page ou la jurisprudence reste **une** ligne.
5. La marque « (L. 28 août 1980).- » en tête d'alinéa reste dans son alinéa.
6. **Un intertitre n'est jamais une ligne d'article** : c'est un intitulé de la table (§ 6.2).
7. Aucune ligne vide ; aucun alinéa à cheval sur deux articles.

---

## § 6. Constats déjà établis — à traiter en tête

### 6.1 Les 90 têtes seules (Livre IV, arts 385 → 474)
La ligne « Article N.- » est seule ; le 1er alinéa suit. Correction mécanique : joindre la tête et la ligne suivante
(« Article 385.- Une partie peut former tierce-opposition… »), sur la seule preuve de l'image pour un échantillon.

### 6.2 Les intertitres absents de la table
≈ 27 subdivisions numérotées (« I.- », « II.- », « A.- »…) sont, au livre, des **intitulés** (gras, centrés) ; en base,
du texte — 4 hors de tout article, ≈ 23 collés **à la fin** de l'article qui les précède (art. 97 se termine par
« II.- De l'incompétence, de la litispendance et de la connexité »). Correction synchrone : la ligne devient un
intitulé de la table (`toc` + `navToc`, niveau 5, ancre neuve, dans l'ordre) et quitte l'article ; **re-clef** des
annotations des articles qui suivent dans la section (`sec-K|art-N` → `sec-K'|art-N`) ; contrôle : 0 clé orpheline,
`ancresDuMenu(navToc)` = ancres de `toc`. **Change le sommaire : à valider** (§ 9).

### 6.3 L'ancienne numérotation (note de marge « Anc art N »)
69 articles où la note de marge du livre et `commentaires["art-N"]` ne s'accordent pas, dont une **série décalée
d'un article** au Livre IV (391 → « ancien 415 » en base, « 416 » au livre ; 392 → 416 / 417…). À vérifier sur
l'image avant toute correction : la note de marge peut être lue sur la ligne voisine.

### 6.4 Intrus
- art. 997 : les notes de l'éditeur « [1] L'art 929 correspond à l'art 424. [2] … » sont dans le corps → `commentaires`.

### 6.5 Écarts de mots à trancher sur l'image (premier tri)
5, 10, 44, 49, 52, 272 (« compenser » / livre « commencer » ?), 494, 510, 813, 957-3, 960 (sept lectures), 961-3,
980, 985 ; ponctuation 86, 597, 833, 961-2, 961-4 ; mots absents des deux OCR 96, 335, 879, 982 ; lignes du livre
sans équivalent en base 45, 725, 859 (à identifier : loi, ou note de l'éditeur composée en romain ?) ; tête
introuvable : 726.

### 6.6 Les actes liés (« cross-reference »)
`annotations.actesLies` (désignation → fiche ; rendu `src/lib/doc/acterefs.ts`) : Loi du 18 septembre 1985, Décret du
22 août 1995, Loi du 28 août 1980, Décret du 28 décembre 2005. **Jamais** une fiche de l'Appendice à recouvrement < 0,9.

---

## § 7. Méthode

**Étape 0 — Instantané** de `bodyOriginal`, `annotationsJson` (empreintes SHA-256), hors dépôt. Vérificateur seul.

**Étape 1 — Le livre** : `scripts/collationner-cpc-livre.py "<pdf>" <travail> --pages 17-284` (≈ 30 s) — lignes de loi
par colonne (géométrie de la couche), intitulés et notes de marge à part, Tesseract colonne par colonne sur l'image
masquée. Contrôle : 1 039 têtes sur 1 040, en séquence.

**Étape 2 — Le tri** : `scripts/collationner-cpc-comparer.py <travail> <instantané>` — par article : mots (base /
Tesseract / Acrobat), alinéas, tête seule, ancienne numérotation ; verdict conforme / à regarder.

**Étape 3 — L'image**, par page : chaque article « à regarder » est lu sur l'image recadrée ; chaque écart reçoit sa
nature (§ 4), le texte du livre, le texte de la base, la page, la décision proposée. Le tirage de 5 % des conformes est
fait et son résultat écrit. Les lecteurs produisent leurs corrections en **remplacements programmés** sur le texte de
la base (jamais retapés) ; tout mot ajouté doit se lire dans Tesseract ou la couche Acrobat.

**Étape 4 — Intitulés** : chaque libellé de la table comparé à la page du livre ; les intertitres du § 6.2 relevés
avec leur rang.

**Étape 5 — Articles modifiés** : 18, 61 al. 2, Livre IX contre leur acte (§ 2, rang 4) ; 717-728 et 813 contre le
livre seul (acte absent du corpus).

**Étape 6 — Rapport, puis correctifs** (§ 8).

---

## § 8. Livrables

1. `scripts/collationner-cpc-livre.py`, `scripts/collationner-cpc-comparer.py` — lecture seule, rejouables.
2. `docs/livraison-cpc-mot-a-mot/` — `pages.csv` (article → page), `ecarts.csv` (un écart par ligne : article, page,
   nature, base, livre, décision, vu sur l'image), `operations.csv`.
3. `docs/livraison-cpc-mot-a-mot.md` — méthode, taux du tri, décompte par nature, les écarts graves, ce qui n'a pas pu
   être tranché, les questions.
4. `scripts/corriger-cpc-mot-a-mot.tsx` — à blanc par défaut, `--commit` pour écrire ; en place ; un intrus n'est
   **jamais supprimé**, il est déplacé ; journal avant/après ; `reindexDocument` ; `audit()` puis recompte.
5. **Garde-fous** : rien ne disparaît (mots ≥ 4 lettres retrouvés au corps ou à l'appareil, liste blanche explicite) ;
   lignes d'en-tête identiques hors § 6.2 validé ; 0 clé orpheline ; menu = table ; 1 040 têtes ; liens de renvoi
   identiques ; le rendu du lecteur (`AnnotatedText`) compte les mêmes liens.

---

## § 9. Ce qui reste à faire valider — avant le `--commit`

1. **Les intertitres** à ajouter à la table (§ 6.2) : ils changent le sommaire.
2. **La typographie** : apostrophe droite (3 617) et espace avant « ; : » (663) — la convention du Code civil vaut-elle
   ici ?
3. **« L. » → « Loi »** dans les marques de modification (« D. » → « Décret » est décidé).
4. Tout écart `mot` ou `manque` qui **change le sens**.
5. **L'ancienne numérotation** décalée (§ 6.3), une fois prouvée sur l'image.
6. **L'Appendice** (lot 2) : 14 fiches à reprendre sur le livre.

Le reste — séquelles d'OCR, coquilles évidentes, césures, alinéas, têtes seules, intrus — s'applique sur la seule
validation du rapport.

---

## § 10. Contrôles de fin

| Contrôle | Attendu |
| --- | --- |
| articles placés au livre | 1 040 / 1 040 |
| articles triangulés | 1 040 / 1 040 |
| écarts « à regarder » vus sur l'image | 100 % |
| taux d'erreur du tri (tirage de 5 % des conformes) | ≤ 0,5 %, chiffre publié |
| après correctif : têtes seules / intertitres dans un article / notes au corps | 0 / 0 / 0 |
| après correctif : mots perdus hors liste blanche, clés orphelines, ancres de menu sans table | 0 / 0 / 0 |
| après correctif : « D. » d'acte | 0 |
| après correctif : `searchText` reconstruit, vérificateur d'empreintes | oui / « Rien à signaler » |

Ce qui n'a pas pu être tranché se dit, article par article, avec la raison.
