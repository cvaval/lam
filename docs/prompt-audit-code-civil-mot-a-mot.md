# Prompt — Audit du Code civil, mot à mot et alinéa par alinéa, contre le fac-similé

> **Demande de Me Vaval (18 oct. 2026)** : « Générer un prompt pour auditer le code civil dans la base de données
> de législation annotée pour s'assurer que le contenu des articles soit respecté mot à mot et que les sauts de
> ligne soient effectués. » Pièce fournie : `~/Library/CloudStorage/Dropbox/Moniteur/Code Civil.pdf`.

Tu audites la fiche **Code civil d'Haïti annoté** de la Législation annotée. Pour chaque article, tu établis :
1. **le mot à mot** : le texte en base est-il, lettre pour lettre, celui de sa source de référence ?
2. **les sauts de ligne** : chaque alinéa de la source est-il une ligne en base, et une seule ?

**Tu ne corriges rien tant que le rapport n'est pas validé** (§ 9). Tu produis un relevé exhaustif, prouvé sur
l'image, des écarts classés par nature, puis un script de correction qui ne s'exécute que sur les natures
validées.

---

## § 0. Règles absolues

- **`.env` pointe sur la base de PRODUCTION** (Supabase). Toute écriture est une écriture en production.
- **Jamais de ré-import** du Code civil : il purge la fiche et change son id (`cmr4b6f3v0000iz56asjmwrlg`) ;
  favoris, renvois, `ArticleVersion`, liens des autres textes en dépendent. On corrige **en place**.
- **Ne touche jamais une ligne d'en-tête** (LOI, CHAPITRE, SECTION…). Les clés de jurisprudence `sec-K|art-N`
  se calculent sur la table parcourue dans l'ordre ; une ligne d'en-tête retouchée orpheline les annotations.
- **L'image prévaut.** La couche texte du PDF a été océrisée en 2016 par Acrobat Paper Capture : elle donne
  « Art. ter » pour « Art. 1er », « c. ctv. » pour « C. civ. », « !'Haïtien », « Ha1'tienne », « Lol » pour « Loi ».
  Elle sert à la **géométrie** (où sont les lignes, quelle taille, quel retrait), **jamais aux mots**.
- **Claude (vision) normalise ce qu'il lit** : il ajoute des accents, répare des coquilles, complète des mots.
  Aucun mot ne se décide sur une seule lecture par un modèle : il faut un second témoin (§ 2) et, en cas de
  désaccord, l'image regardée.
- **Le dépôt GitHub est PUBLIC** : aucune image du fac-similé (© Patrick Pierre-Louis, éd. Zémès) n'y entre.
  Les recadrages de preuve vont dans le scratchpad ou dans `~/Library/CloudStorage/Dropbox/Lam Veritab/`.
- Avant tout `--commit` et tout commit : `npx tsx scripts/verifier-empreintes-donnees.ts` **seul**, sortie lue
  (jamais derrière `| tail`, qui masque le code de sortie). `git add` fichier par fichier ; ne pas embarquer
  `tsconfig.json` ni les fichiers d'une autre session.
- Le pooler Supabase est à `connection_limit=1` : un seul fil d'écriture, pas de parallélisme sur la base.

---

## § 1. État mesuré (18 oct. 2026)

| Élément | Valeur |
| --- | --- |
| Fiche | `cmr4b6f3v0000iz56asjmwrlg`, `type=LEGISLATION`, `source=CODE_CIVIL_ANNOTE` |
| Corps | `bodyOriginal`, **3 535 lignes** ; `bodyClean` **null** (le lecteur affiche `bodyOriginal` + versions) |
| Convention | **une ligne = un alinéa** ; « Art. N » en tête de la ligne du 1er alinéa ; énumération : un item par ligne |
| En-têtes | 357 (`toc` = `navToc`, contrôle `reparer-sommaire-code-civil.ts`) |
| Têtes d'article | **2 107** = 2 047 numéros du Code + 60 articles décimaux insérés en 2020 (1774-1…, 1809-1…) |
| Statuts (`annotations.status`) | **278** : 140 modifié · 68 abrogé · 60 nouveau · 10 partiellement abrogé |
| `ArticleVersion` | 318 : `EN_VIGUEUR` 129 (régimes matrimoniaux 103, sûretés 23, filiation 3) · `AJOUTE` 60 (sûretés 57, régimes 3) · `ABROGE` 60 (régimes 50, filiation 10) · `MODIFIE` 129 (rédactions antérieures) |
| Anciennes rédactions de l'appareil | `annotations.oldVersions` : 193 ancres |
| Articles **sans statut** | **1 829** — ce sont eux que le livre gouverne |

### Ce qui a déjà été fait — et ce qui ne l'a jamais été

| Date | Passe | Document |
| --- | --- | --- |
| 14 juil. | rapport de structure | `docs/audit-code-civil-structure.md` |
| 31 juil. | confrontation au fac-similé : séquelles d'OCR (« € », « C. dv », césures), 1re note recollée | `docs/code-civil-confrontation-facsimile.md`, `docs/audit-code-civil-2026-07-31.md` |
| 2 août | **alignement sur CCH.docx** (1 733 articles, 322 paragraphes de loi restitués, 415 notes versées à l'appareil), énumérations rendues au dispositif (37 articles, 136 lignes), textes connexes sortis du corps, doublons d'OCR, sommaire | `docs/code-civil-audit-cch.md` (§ 1-11) |
| 26-29 août | décrets 2020, loi 2017, pastilles d'état | mémoires du projet |

**Jamais fait** : une collation **intégrale** de chaque article contre l'image, en mots ET en alinéas. L'alignement
du 2 août reposait sur CCH.docx et sur un discriminant typographique ; il a écarté 4 articles (682, 727, 1 333,
2 047) et exclu par construction les 218 articles à statut.

### Mesures préalables (sonde `scripts/sonder-code-civil-facsimile.py`, lecture seule)

**Base contre CCH.docx**, sur les 1 825 articles sans statut que le fichier contient :

| Résultat | Articles | Lecture |
| --- | ---: | --- |
| identiques (mots et alinéas) | **1 640** | — |
| CCH a des paragraphes en plus | 121 | encadrés et renvois « V. le D. du … », sortis du corps vers `connexe` (voulu) |
| la base a des lignes en plus | 40 | énumérations rendues au dispositif le 2 août — CCH les compose comme l'appareil |
| mots différents | **24** | à instruire un par un (§ 6) |

**Alinéas, base contre la géométrie du livre**, sur les 1 829 articles sans statut :

| Résultat | Articles |
| --- | ---: |
| même nombre d'alinéas | **1 526** |
| la base en a plus | 224 |
| la base en a moins | 39 |
| tête introuvable au relevé (numéro illisible, article abrogé en petit italique) | 40 |

⚠️ **Ce détecteur fait du bruit** : sur 8 écarts examinés (dont 4 sur l'image), **1 défaut réel** (art. 45) et
7 erreurs du détecteur. Ce sont des intertitres lus comme de la loi, des énumérations composées en petit corps (art. 452), une
ligne de renvoi décalée (art. 135, 451) et des items d'énumération à interligne normal (art. 75). Il sert à
**trier**, pas à conclure. Améliore-le (§ 4) avant de t'en servir.

**Contrôles mécaniques sur le corps** :

| Signal | Nombre | Exemples |
| --- | ---: | --- |
| double espace | 478 | arts 329-345, 1454 (« Art. 1454␣␣Il ») |
| espace insécable (U+00A0 / U+202F) | 656 | arts 572-581 |
| apostrophes droites / typographiques | 5 238 / 1 340 | deux sources mêlées |
| « Art. N » au milieu d'une ligne | 2 | art. 314 (trois décrets collés en milieu d'alinéa — connu depuis le 2 août) |
| référence d'arrêt (« Cass. ») dans le corps | 1 | art. 1193 (« pro- deniers de la communauté. Cass., 6 no… » : colonnes de notes lues en travers) |
| glose de l'éditeur versée au corps | 2 | art. 45, art. 267 |
| autre texte collé dans un article | 1 | art. 2047 (voir § 6) |
| intitulé de chapitre devenu alinéa | 1 | art. 727 |

---

## § 2. Les témoins, et leur rang

| Rang | Témoin | Emplacement | Vaut pour | Ne vaut pas pour |
| --- | --- | --- | --- | --- |
| **1 — arbitre** | **image** du fac-similé | `Code Civil.pdf`, rendu par PyMuPDF à `Matrix(3.2, 3.2)` minimum, recadré sur la zone de loi | tout | — |
| 2 | **CCH.docx**, fichier de composition du recueil | `~/Downloads/CCH.docx` ; extrait : `scripts/data/code-civil/cch-source.json` (`articles[N].paras` / `.notes`) | mots des articles ordinaires (1 640 concordances) | **énumérations** (composées comme l'appareil), encadrés, tout article modifié après sa date (antérieur à 2014 : l'art. 293 y est d'avant la loi Filiation) |
| 3 | **Tesseract 5.5.2**, langue `fra`, installé | `/opt/homebrew/bin/tesseract`, sur l'image à 300 dpi | second témoin indépendant, mot par mot | ponctuation fine, accents sur capitales, italique |
| 4 | **l'acte modificatif** (J.O.) | fiches `LOI_FILIATION_2014`, `DECRET_REGIMES_MATRIMONIAUX`, `DECRET_SURETES`, `LOI_SIGNATURE_ELECTRONIQUE_2017` (et tout acte nommé par `ArticleVersion.amendedByDocId` ou un bloc `connexe` de nature `modificatif`) | rédaction **en vigueur** des 278 articles à statut | — |
| ✗ | couche texte du PDF (`page.get_text()`) | — | géométrie seulement | les mots |
| ✗ | `Dropbox/Moniteur/Code Civil.docx` (juin 2020) | — | rien : c'est la **conversion de la couche OCR** (« hai:tien », « !'Organisation ») | — |
| ✗ | `Dropbox/Moniteur/Code_civil_Clean.docx` (python-docx, juin 2026) | — | rien : il **dérive de la base** | — |

**Règle de décision** : base = CCH = Tesseract (au bruit d'OCR près, § 4) ⇒ conforme. Tout autre cas ⇒ l'image,
regardée, recadrée sur l'article, et la décision écrite avec sa preuve.

Tire au sort **5 % des articles « conformes »** et vérifie-les sur l'image : c'est la mesure du taux d'erreur
résiduel du tri. S'il dépasse 0,5 %, le tri est trop lâche : resserre-le avant de continuer.

---

## § 3. Anatomie du livre (mesurée)

**Le volume** — 481 pages PDF ; **index PDF = folio imprimé + 1** (mesuré sur 7 812 lignes ; la mémoire du 2 août
disait « p. 219-220, l'index et le folio coïncident » : vérifie sur ces deux pages et corrige l'une des deux
affirmations).

| Pages PDF | Contenu |
| --- | --- |
| 1-22 | liminaires : table des matières (p. 7-15), introduction critique (p. 17-21), abréviations (p. 22) |
| **23-412** | **le Code** : LOI No 1 à LOI No 35, art. 1er à 2 047 |
| 413-452 | **Annexe** : loi du 5 sept. 1979 (expropriation), loi du 29 oct. 1984 (copropriété), Convention relative aux droits de l'enfant (Moniteur du 13 mars 1995), décret du 12 oct. 2005 (droit d'auteur), loi du 8 juillet 2008 (gage sans dépossession) |
| 453-480 | index alphabétique |

**La page** — repère PDF de 398 × 626 pt ; la marge gauche diffère entre pages paires et impaires (x ≈ 31 / 46).

| Strate | Composition | Ce qu'en fait la base |
| --- | --- | --- |
| **texte de loi** | Times-Roman 9,5-10,8 pt, justifié, interligne **12,0** ; un **nouvel alinéa** se voit à l'interligne **≈ 14,6-15,0**, sans retrait de première ligne | corps, une ligne par alinéa |
| tête | « **Art. N** » en gras, au fer | début de la ligne du 1er alinéa |
| énumération | 1re ligne en retrait ≈ 10 pt, suite en retrait suspendu ≈ 20 pt ; parfois en **petit corps** (art. 452 : « Les fruits civils; », « Le croît des animaux; ») | un item = une ligne |
| renvoi de l'éditeur | italique ≈ 10,5, collé à la fin de l'alinéa : « .- C. civ., 49, 133 et s, 180. » | reste dans le corps, en fin de ligne (convention établie, linkifiée) |
| article abrogé avant 2011 | « Art. 140 » + Helvetica-Oblique 7 « Abrogé par la loi du 20 juillet 1929. » | « Art. 140 Abrogé par la loi du 20 juillet 1929. » |
| **texte de loi en italique** | voir § 6.3 — environ 126 articles | **perdu** (texte brut) |
| glose de l'éditeur | petit italique sous l'article : « L'expression Grand-Juge est archaïque. », « Cet article n'est pas en harmonie avec… », « Ainsi modifié par le D. du 30 août 1988… », « V. le D. du 8 octobre 1982. » | appareil ou `connexe`, **jamais le corps** |
| appareil (jurisprudence) | Helvetica 7,1-7,3, **deux colonnes** (x ≈ 46 et 212) sous un filet court | `annotations.jurisprudence` |
| encadré (texte connexe) | ≈ 8,2 pt, filet de cadre, retrait ≈ 12 | `annotations.connexe` |
| titres courants, folio | ≈ 5,8 pt en haut ; folio en bas | ignorés |

**Pièges de la page** :
- les deux colonnes de notes se lisent **en travers** si l'on suit l'ordre vertical : c'est l'origine des notes
  entrelacées (arts 701, 846, 1193…). Trie par colonne avant de lire une note ;
- un alinéa peut **traverser un saut de page**, et même passer sous les notes de bas de page avant de reprendre :
  la première ligne de la page suivante est alors une suite (minuscule, ou ligne précédente sans ponctuation
  finale, ou césure) ;
- les **césures** de fin de ligne (« vingt-qua- / tre », « Ré- / publique ») se recousent ; un trait d'union
  réel en fin de ligne (« au- / dessus ») se garde : **l'image tranche**, et à défaut un mot
  attesté ailleurs dans le corpus ;
- le livre imprime des renvois **au-delà de 2 047** (2 075, 2 165, 2 255…) : ce sont des numéros d'éditeur, pas
  des fautes (mémoire du 3 juil.) ;
- l'art. 2 finit par « C. pén., » **sans numéro** : c'est le livre (p. 22 du folio), ne rien inventer.

---

## § 4. Ce que « mot à mot » veut dire

**Est un écart** toute différence de lettre, d'accent, de chiffre, de ponctuation, de majuscule, d'ordre ou
d'espacement significatif entre la base et la source de référence — y compris quand la base a « raison » contre
le livre. Exemple mesuré : le livre imprime à l'art. 41 « par le doyen du tribunal civil du ressort **pou** par le
juge qui le remplacera » ; la base porte « ou par le juge ». La base a corrigé une coquille **en silence** : c'est
un écart de nature `coquille-du-livre`, à décider (§ 9, question 1).

**Natures d'écart** (une seule par écart, liste FERMÉE) :

| Nature | Définition | Exemple |
| --- | --- | --- |
| `mot` | mot manquant, ajouté, remplacé | — |
| `ocr` | séquelle d'OCR en base | « ets, » pour « et s, » (art. 682, à confirmer) |
| `coquille-du-livre` | le livre porte une faute évidente | art. 41 « pou » |
| `ponctuation` | signe différent, manquant, ajouté | « blanc.- » en base, « blanc.– » au livre ? (art. 42, à confirmer) |
| `casse-accent` | majuscule, accent | « Etat » / « État » |
| `alinea-fusionne` | deux alinéas du livre sur une ligne en base | — |
| `alinea-scinde` | un alinéa du livre coupé en deux lignes | — |
| `enumeration` | items réunis ou coupés autrement que le livre | — |
| `cesure` | césure non recousue, ou trait d'union réel supprimé | art. 1193 « pro- deniers » |
| `intrus-appareil` | note, glose ou renvoi « V. » dans le corps | arts 45, 267, 1193 |
| `intrus-structure` | intitulé ou autre texte collé dans un article | arts 727, 2047, 314 |
| `manque` | alinéa ou partie d'article absente de la base | — |
| `renvoi` | liste « - C. civ., … » en fin d'alinéa différente | — |
| `typographie` | apostrophe, espace insécable, double espace | 478 + 656 + mélange d'apostrophes |
| `italique` | passage de loi en italique au livre (information perdue) | § 6.3 |

**Comparaison canonique** (pour trier, pas pour publier) : normalise **seulement** les apostrophes (’ → '), les
espaces insécables et les suites d'espaces. Tout le reste compte. La typographie est relevée à part (nature
`typographie`) et se règle en une passe décidée (§ 9, question 4).

**Bruit d'OCR tolérable entre témoins** (pour décider qu'un article est « conforme » sans regarder l'image) :
seules les paires classiques de Tesseract — `l/1/I`, `O/0`, `rn/m`, `ii/ü`, `é/e` sur capitale, ponctuation
collée — et seulement si **CCH et la base concordent**. Base ≠ CCH : image, toujours.

---

## § 5. Ce que « sauts de ligne » veut dire

1. **Un alinéa du livre = une ligne de la base.** Jamais la ligne imprimée : aucune ligne ne s'arrête là où la
   composition du livre passait à la ligne.
2. « **Art. N** » ouvre la ligne de son premier alinéa (pas de ligne « Art. N » seule).
3. **Énumération** : chaque item est un alinéa, y compris ceux composés en petit corps (art. 452) et les items
   sans numéro (« Par la mort… », « Lorsque… »).
4. Un alinéa qui **traverse une page** ou passe sous les notes reste **une** ligne.
5. Le **renvoi** « .- C. civ., … » reste à la fin de l'alinéa qui le porte : il ne fait pas une ligne.
6. **Aucune ligne vide**, aucun alinéa à cheval sur deux articles.
7. Les **articles à statut** : la rédaction en vigueur (`ArticleVersion.body` `EN_VIGUEUR` / `AJOUTE`) suit les
   alinéas de **l'acte modificatif** ; leurs anciennes rédactions (`MODIFIE`, `ABROGE`, `oldVersions`), les
   alinéas **du livre**.

---

## § 6. Constats déjà établis — à traiter en tête

### 6.1 Défauts réels, vus sur l'image ou dans les données

| Article | Constat | Preuve |
| --- | --- | --- |
| **2 047** | la ligne de l'article contient, après « …seront abrogés. », le **début de l'Annexe** (« Annexe Loi du 5 septembre 1979 sur l'expropriation pour cause d'utilité publique Le Moniteur No. 87 du 8 novembre 1979 Généralités Art \| L'expropriation… » — 1er article de la loi de 1979, « Art \| » d'OCR compris) et une **note de rédaction** (« — Fin du Code civil d'Haïti (Lois Nº 1 à 35, articles 1 à 2047). Les annexes du volume (…) ne sont pas reproduites ici… — ») : la ligne fait 1 049 caractères, l'article 252. La note omet en outre la Convention des droits de l'enfant. | base, dernière ligne ; livre p. 412-414 |
| **45** | « L'expression Grand-Juge est archaïque. » est un **alinéa de loi** en base ; c'est une glose de l'éditeur, en petit italique | livre p. 34 (folio 33) |
| **267** | « Cet article n'est pas en harmonie avec le Décret du 8 octobre 1982 et celle du 14 septembre 1983. » au corps — même genre que la glose de l'art. 221 que Me Vaval a fait retirer (« RESTE À DÉCIDER » depuis le 2 août) | base l. 386 |
| **727** | 2ᵉ ligne de l'article = « DE LA CAPACITÉ DE DISPOSER OU DE RECEVOIR PAR DONATION ENTRE VIFS OÙ PAR TESTAMENT » : un **intitulé de chapitre** devenu alinéa (absent du sommaire ? « OÙ » accentué ?) | à vérifier sur l'image |
| **314** | trois décrets (27 janv. 1959, 8 oct. 1982, 30 août 1988) collés **en milieu d'alinéa** (« …par la Loi. Décret du 27 janvier 1959, Art. 1. La filiation naturelle… ») | connu depuis le 2 août |
| **1193** | note de jurisprudence entrelacée dans le corps (« …était pro- deniers de la communauté. Cass., 6 no… ») | base |
| **682** | « C. p. c. 343, ets, 922. » (CCH : « et s, ») | à vérifier sur l'image |
| **41** | coquille du livre corrigée en silence (« pou » → « ou ») | livre p. 34 |

### 6.2 Les 24 articles où la base et CCH diffèrent en mots

Sortie de la sonde (`--detail` à ajouter) : 682, 1679, 727, 212, 1153, 1549, 428, 586, 1695, 1758, 25, 1628, 1947,
1121, 2024, 267, 738, 18, 1380, 1008, 2047, 1915, 1952, 1120. La plupart sont des **énumérations** que CCH range à
l'appareil et que la base a rendues au dispositif : CCH n'est **pas** l'arbitre ici, l'image l'est.

### 6.3 Le texte de loi en italique — une information que la base perd

Le livre compose en italique, entièrement ou presque, **environ 126 articles** (143 portent au moins une ligne de loi
en italique) ; par exemple l'art. 14, tout entier. Ils se groupent en blocs :
**14, 18, 21-27** (nationalité, droits civils) · **198-255** (effets du mariage, divorce) · **282-292, 314-324**
(filiation, puissance paternelle) · **1195-1323** (régimes matrimoniaux) · et des articles isolés (2, 350, 354, 416,
526, 583, 586, 604, 624-625, 635, 677, 735, 740, 753, 759, 835, 974, 1174, 1746, 1754, 1911, 1995).
55 d'entre eux portent déjà un statut en base (réformes de 2014 et 2020).

L'introduction critique (p. 17-21) n'explique pas cette convention. **Hypothèse** à soumettre, non à affirmer :
l'éditeur signale par l'italique les dispositions qu'il tient pour **tacitement abrogées ou dépassées** par un texte
postérieur (décret du 8 octobre 1982 sur la femme mariée, Constitution de 1987). L'art. 136 met en italique les seuls
mots « *vingt-cinq* » et « *vingt et un* » (âges de la majorité matrimoniale, remplacés par la majorité à 18 ans).
Relève la liste exacte (article, alinéas, mots) sur l'image ; ne décide pas de sa représentation (§ 9, question 2).

---

## § 7. Méthode

**Étape 0 — Instantané.** Exporte `bodyOriginal`, `annotationsJson` et toutes les `ArticleVersion` de la fiche dans
`scripts/data/code-civil/audit-mot-a-mot/avant.json` (avec l'empreinte SHA-256 de chaque champ). Lance le
vérificateur d'empreintes, seul. **Aucune écriture avant l'étape 6.**

**Étape 1 — Table article → page.** Pour chaque article 1 à 2 047 : index PDF, folio, et rang sur la page. Base :
la sonde (1 989 têtes relevées) ; les ~60 manquantes (numéros illisibles : « Art. t4S4 » = 1454, « Art. nos » ;
articles abrogés en petit italique) se placent par la séquence croissante **puis se vérifient sur l'image**. Sortie
`docs/livraison-code-civil-mot-a-mot/pages.csv`. Contrôle : 2 047 lignes, folios croissants, aucun doublon.

**Étape 2 — Zone de loi.** Rends chaque page 23-412 à 300 dpi. Pour chaque article, recadre la **zone de loi** :
de la tête à la fin du dernier alinéa, notes de bas de page et encadrés exclus (géométrie du § 3 : la loi traverse
la gouttière x ≈ 190-205, l'appareil jamais). Les recadrages restent hors du dépôt (§ 0).

**Étape 3 — Second témoin.** Tesseract (`-l fra --psm 4`, sortie hOCR) sur chaque zone de loi : texte et boîtes de
lignes. Les boîtes donnent les alinéas (interligne > 13,6 pt au repère PDF, ou retrait d'énumération).

**Étape 4 — Triangulation, article par article** (les 1 829 sans statut) :
- mots : base / CCH / Tesseract, alignés mot à mot (`difflib.SequenceMatcher`, `autojunk=False`) ;
- alinéas : nombre et bornes dans la base / CCH / géométrie / Tesseract ;
- classement : **conforme** (§ 2, règle de décision), sinon **à regarder** ;
- chaque article « à regarder » est lu sur l'image recadrée, mot à mot, et chaque écart reçoit sa nature (§ 4),
  le texte du livre, le texte de la base, la page, et la décision proposée ;
- le tirage de 5 % des conformes est fait et son résultat écrit.

**Étape 5 — Articles à statut** (278) :
- `EN_VIGUEUR` / `AJOUTE` : comparés à l'article correspondant de la **fiche de l'acte modificatif**, mots et
  alinéas ; si la fiche de l'acte n'a jamais été collationnée au J.O., le dire (ne pas tenir pour acquis) ;
- `MODIFIE`, `ABROGE`, `oldVersions` : comparés **au livre** (rédaction de 2011), comme un article ordinaire ;
- **le rendu** : pour 10 articles tirés au sort, compose le texte affiché comme la fiche
  (`applyAmendments(bodyOriginal, getAmendments(id), …)`, `src/lib/legislation/segment.ts`) et vérifie qu'aucun
  alinéa n'est perdu ni doublé à la jointure.

**Étape 6 — Rapport, puis correctifs** (§ 8).

---

## § 8. Livrables

1. **`scripts/collationner-code-civil-mot-a-mot.ts`** (ou `.py`) — lecture seule, rejouable, qui produit le relevé.
2. **`docs/livraison-code-civil-mot-a-mot/ecarts.csv`** — une ligne par écart : `article`, `index_pdf`, `folio`,
   `nature`, `base`, `livre`, `cch`, `tesseract`, `decision_proposee`, `vu_sur_image` (oui/non).
3. **`docs/livraison-code-civil-mot-a-mot.md`** — le rapport : méthode, taux d'erreur résiduel du tri, décompte par
   nature, les 20 écarts les plus graves (sens altéré d'abord), ce qui n'a pas pu être tranché, les questions.
4. **`scripts/corriger-code-civil-mot-a-mot.ts`** — écrit **seulement** les natures validées par Me Vaval :
   à blanc par défaut, `--commit` pour écrire ; mise à jour **en place** de `bodyOriginal` (et des `ArticleVersion`
   concernées) ; un intrus d'appareil n'est **jamais supprimé** : il est **déplacé** vers l'appareil
   (`jurisprudence`, `commentaires` ou `connexe` avec son `kind`) ; journal de chaque ligne avant/après ;
   `reindexDocument(id)` à la fin (sinon `searchText` reste périmé) ; `audit()` ; recompte.
5. **Garde-fous du correctif** (à tester avant `--commit`) :
   - **rien ne disparaît** : tout mot ≥ 4 lettres retiré du corps se retrouve dans le nouveau corps ou dans
     l'appareil, sauf une liste blanche explicite (séquelles d'OCR corrigées) ;
   - les lignes d'en-tête sont **identiques** octet pour octet avant/après ;
   - les clés `sec-K|art-N` de `jurisprudence` restent **toutes** rattachées (0 orpheline) ;
   - `ancresDuMenu(navToc)` = ensemble des ancres de `toc` ;
   - chaque article garde sa tête et son ancre ; nombre de têtes inchangé (2 107) ;
   - les 278 statuts et les 318 `ArticleVersion` sont intacts, sauf écart validé sur l'un d'eux.

---

## § 9. Questions à poser à Me Vaval — avant toute écriture

1. **Coquilles du livre** (ex. art. 41 « pou ») : reproduire la faute avec une note « (sic) » dans l'appareil, ou
   garder le texte corrigé en le signalant ? (Règle du corpus pour le J.O. : la lettre du texte prévaut ; mais le
   livre est une édition privée, pas le J.O.)
2. **L'italique de l'édition** (§ 6.3, environ 126 articles) : quel sens lui donne-t-elle ? Faut-il le rendre au lecteur
   (italique conservé, ou pastille « disposition signalée par l'éditeur »), ou seulement le documenter ?
3. **Les gloses de l'éditeur** versées au corps (arts 45, 267, et celles que l'audit trouvera) : vers l'appareil,
   ou retrait comme pour l'art. 221 ?
4. **Typographie** : harmoniser les apostrophes (’ partout ?), retirer les 478 doubles espaces, décider des 656
   espaces insécables ? Ce n'est pas du mot à mot, mais c'est visible.
5. **Art. 2 047 et l'Annexe du volume** : retirer de l'article le début de la loi de 1979 et la note « Fin du Code
   civil… » (évident) — et verser les cinq textes de l'Annexe comme fiches distinctes, ou les laisser hors corpus ?

---

## § 10. Contrôles de fin

| Contrôle | Attendu |
| --- | --- |
| articles couverts par la table article → page | 2 047 / 2 047 |
| articles sans statut triangulés | 1 829 / 1 829 |
| articles à statut confrontés à leur acte | 278 / 278 |
| écarts « à regarder » vus sur l'image | 100 % |
| taux d'erreur du tri (tirage de 5 % des conformes) | ≤ 0,5 %, chiffre publié |
| écarts sans nature, ou à nature hors liste | 0 |
| après correctif : mots perdus hors liste blanche | 0 |
| après correctif : lignes d'en-tête modifiées / clés orphelines / ancres de menu sans table | 0 / 0 / 0 |
| après correctif : `searchText` reconstruit, vérificateur d'empreintes | oui / « Rien à signaler » |

Ce qui n'a pas pu être tranché se dit, article par article, avec la raison : un audit qui affiche 100 % sans
dire ce qu'il n'a pas pu lire ne vaut rien.
