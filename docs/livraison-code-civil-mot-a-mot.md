# Livraison — Audit mot à mot et alinéa par alinéa du Code civil

**18 octobre 2026.** Exécution de [prompt-audit-code-civil-mot-a-mot.md](prompt-audit-code-civil-mot-a-mot.md),
avec les décisions de Me Vaval du même jour (coquilles corrigées sans note, italique = abrogé, gloses vers les
annotations, typographie harmonisée, Annexe hors périmètre).

> **État : audit terminé, corrections prêtes et éprouvées à blanc — RIEN N'EST ENCORE ÉCRIT EN BASE.**
> Le prompt exige la validation de ce rapport avant toute écriture (§ 9 ci-dessous).

---

## 1. En bref

| | |
| --- | --- |
| Articles collationnés | **2 047** (+ 60 articles décimaux de 2020, gouvernés par leur décret) |
| Texte gouverné par le livre | 1 854 articles (1 829 sans statut + 25 statuts antérieurs à 2011) |
| Texte gouverné par un acte | 253 articles (réformes de 2014, 2017, 2020) |
| Tri automatique (base = CCH = Tesseract) | **1 682 conformes**, 365 à regarder |
| Lus sur l'image | 365 articles (six lots) + **84 en tirage de contrôle** |
| Articles à défaut réel corrigé | **≈ 150** (120 par collation sur l'image, plus séparateurs, intitulés, coquilles reproduites) |
| Coquilles du livre que la base avait déjà corrigées | 51 articles — **gardées** (décision) |
| Passe typographique | 2 628 lignes ou versions harmonisées |
| Liens de renvoi rendus par le lecteur | 7 366 → **7 426** (« C. dv », « €. tv » redevenus « C. civ. ») |
| Garde-fous du correctif, à blanc | **tous passés** |

## 2. Ce qui a été trouvé

| Nature | Articles | Exemples |
| --- | ---: | --- |
| **Texte manquant** | 7 | énumérations entières absentes : 1187, 1194, 1226, 1255, 1282 (8 items), 1920 ; renvoi omis à 310 |
| **Alinéas fondus** (une ligne pour plusieurs alinéas) | 29 | 55, 302, 311, 331, 611, 1187-1320 (série des régimes matrimoniaux), 1850, 1888 |
| **Note de jurisprudence prise pour du texte de loi** | 11 | 1193, 1554, 1563, 1742, 1766, 1780, 1818, 1843, 1846, 1897, 2047 |
| **Glose de l'éditeur dans le texte** | 26 | 45 (« L'expression Grand-Juge est archaïque. »), 267, 523, 624, la série « V. l'art. … du D. du 8 octobre 1982 » (1174-1323), « Abrogé par … » (1206, 1214-1216) |
| **Encadré (texte connexe) versé au corps** | 2 | 314 (trois décrets), 330 |
| **Titre courant, intitulé, folio pris pour du texte** | 9 | 611 (« 14l » = folio 141), 727, 1186, 1280, 1333, 1855, 302 (« ————— "TS ») |
| **Doublon** | 1 | 1517 : l'art. 1518 recopié à la fin de 1517 |
| **Faute de saisie** | 28 | « béritiers », « bardes », « béréditaire », « gfivé », « maïs », « ef », « Leffet », « cobligé », « ant. 3 », « €. tv », « C. dv », « c. iv » |
| **Mot** | 1 | 1978 : « poursuivie » au lieu de « suivie » (vérifié sur deux témoins) |
| **Renvois** (chiffres, « s », « ° ») | 12 | 1852 « 355 » → « 35 s », 1267 « 5385, 7965 » → « 538 s, 796 s », 1283 « 1282-P » → « 1282-1° » |
| **Ponctuation de fond** | 37 | virgules perdues, « C. p. c,, », séparateur interne **« ;- »** (17 cas, 1028-1147) |
| Casse, accent, césure | 12 | 1296 « où » → « ou », 1307 « conve- nue », 1858 « hypo- thèques » |
| **Coquilles du livre reproduites par la base** | 2 | 448 « de jouir de jouir », 1903 « les inscriptions les inscriptions » — corrigées sans note |

Le relevé complet est dans [`livraison-code-civil-mot-a-mot/ecarts.csv`](livraison-code-civil-mot-a-mot/ecarts.csv) ;
les opérations dans [`operations.csv`](livraison-code-civil-mot-a-mot/operations.csv) ; la table article → page
dans [`pages.csv`](livraison-code-civil-mot-a-mot/pages.csv).

⚠️ **Les anciennes rédactions des réformes de 2020** (`ArticleVersion` MODIFIE / ABROGE, affichées dans le repli
« Ancienne rédaction ») portaient l'essentiel des défauts de fond. 179 d'entre elles sont identiques au texte du
corps : le correctif corrige le corps et **reporte** la correction sur ces versions jumelles (75 versions
concernées) ; les 10 qui divergent sont corrigées une à une.

## 3. Mesure du tri — le tirage de contrôle

84 articles tirés au hasard parmi les 1 682 « conformes », relus en entier sur l'image :
- **0 écart dans le texte de loi** (ni mot, ni lettre, ni accent, ni alinéa) ;
- 19 écarts, tous dans la **ponctuation du renvoi de l'éditeur** : 16 réglés par la passe typographique (tiret
  « .- »), 2 coquilles du livre que la base corrige (gardées), **1 séparateur interne « ;- » (art. 1054)**. Cette
  famille a ensuite été cherchée sur tout le Code (lecture « ; » au livre, « . » en base) : **17 séparateurs**
  corrigés, dont 3 vérifiés à l'œil sur l'image.

Taux résiduel du tri dans le texte de loi : 0/84. Le seuil de 0,5 % du prompt est tenu pour le texte ; pour la
ponctuation des renvois, la seule famille manquée a été traitée en entier.

## 4. Typographie (décision « harmoniser »)

| Règle | Effet |
| --- | --- |
| Tête « Art. N » + une espace, sans point ni tiret | 1 520 têtes (cinq formes en base, une au livre) |
| Apostrophe droite dans le texte des articles | 1 340 apostrophes courbes ; les intitulés gardent ’ (la table les cite à l'identique) |
| Ni insécable, ni cadratin, ni double espace | 656 lignes |
| Séparateur du renvoi « .- » / « ;- » | « . – » (381), « . - » (309) ramenés ; **267 tirets perdus rétablis** (arts 1700-1999) |
| Une espace avant « ; » « : » dans le texte de loi | la liste de renvois garde la composition du livre (« 2046; C. pén. ») |
| Exposant ordinal « 3o » → « 3° » | 5 |

Le livre lui-même omet quelquefois le tiret (« conçu; C. civ. », art. 586, 588) : l'harmonisation le pose partout.
Là où le livre abrège « Civ., 79 » (41, 315, 431, 503, 504), la base garde sa forme harmonisée « C. civ., » — c'est
elle que le lecteur rend cliquable.

## 5. Intitulés (§ 6.4 du prompt)

Vus sur l'image ; le correctif change table, menu et ligne du corps **ensemble**, sans changer d'ancre :

| Intitulé | Correction |
| --- | --- |
| `sec-19` | « SECTION PREMIÈRE — Des effets de l'absence relativement aux biens **que l'absent possédait au jour de sa disparition** » (le libellé était tronqué) |
| `sec-21` | « SECTION III — Des effets relativement au mariage » (titre du livre) |
| `sec-115` | « … ENTRE VIFS **OU** PAR TESTAMENT » (« OÙ » fautif) |
| `sec-279` | « CHAPITRE IV — DES DIFFÉRENTES MANIÈRES **DONT LE MANDAT FINIT** » (le livre numérote V par coquille : I, II, III, V) |
| `sec-324` | « CHAPITRE IV — DES CAUSES QUI INTERROMPENT OU SUSPENDENT **LE COURS DE** LA PRESCRIPTION » |
| `sec-304`, `sec-306`, `sec-308` | intitulés nus « Section II/III/IV » retirés (doublons des intitulés complets qui les suivent) |

Et 6 lignes d'intitulé en double retirées du corps (l. 176, 202, 1972, 2883, 3461-3462), plus les titres courants
absorbés dans les arts 727 et 1186.

## 6. Articles réformés (étape 5)

- **179** rédactions en vigueur ou ajoutées sont identiques, mot pour mot, à leur acte (régimes matrimoniaux 96,
  sûretés 80, filiation 3) ; **1101, 1102, 1111, 1112** identiques à la loi du 14 février 2017.
- Les **10 articles partiellement abrogés** en 2020 (1902-1962) sont conformes à l'art. 7 du décret : chaque
  alinéa retiré concerne l'hypothèque légale de la femme mariée, aucun alinéa conservé n'en parle.
- 11 lignes `ArticleVersion` « ajouté » embarquent les intitulés qui les suivent — sans effet à l'écran (le lecteur
  affiche le corps) ; signalé, non corrigé.

## 7. Abrogations signalées par l'italique — À VALIDER

[`abrogations.csv`](livraison-code-civil-mot-a-mot/abrogations.csv) — 192 articles dont le texte est imprimé en
italique, en tout ou en partie :

| Décision proposée | Articles |
| --- | ---: |
| rien à écrire : l'article porte déjà un statut (réforme postérieure) | 72 |
| abroger, acte nommé par l'éditeur (« Abrogé par … », « V. … ») | 41 |
| à confirmer : acte déduit de la série (marque « (Loi du 5 mai 1949, art. 1) » de l'article voisin) | 38 |
| à décider : acte introuvable, ou terme désuet seul en italique (« Grand-juge », « tribunal civil ») | 37 |
| à préciser : partie abrogée à délimiter | 4 |

Actes les plus cités : décret du 8 octobre 1982 (51), décret-loi du 22 décembre 1944 (18), décret-loi du 6 mars
1940 (13), loi du 5 mai 1949 (11). **Aucun n'a de fiche au corpus** : l'acte sera nommé sans lien. Le correctif ne
pose aucun statut tant que la liste n'est pas validée.

## 8. Points à trancher

1. **Appliquer les corrections** des §§ 2, 4 et 5 (193 opérations + typographie) — `--commit` du correctif.
2. **La liste des abrogations** (§ 7) : en bloc ou ligne à ligne.
3. **Les 5 libellés d'intitulé** (§ 5) : ils changent le sommaire.
4. **Arts 349, 483 et 708 : absents du livre** (le folio passe de 348 à 350, de 482 à 484, de 707 à 709) et du
   fichier de composition. Leur texte en base vient du fichier Word d'import de juillet ; le 708 commence par
   « Peuvent demander… », sans sujet (l'art. 878 du Code civil français dit « Ils peuvent demander… »). À vérifier
   sur une autre édition.
5. **Art. 1970** : le livre imprime « de mille à cinq cents gourdes », la base « de cinq cents à mille ». Non
   corrigé : à trancher sur la source officielle.
6. **Arts 1769 et 1890** : le livre compose en corps de loi un alinéa qui ressemble à de la jurisprudence (1769) et
   des dispositions modificatives (1890 : « Néanmoins … sont abrogés »). Gardés comme texte.
7. **Lectures incertaines** : 1262 « privé » (mot taché à l'impression) ; 1458 (points ou virgules) ; la note de
   1818 complétée d'après l'image (colonne droite absente de la base).

## 9. Limites

- Les 1 682 articles « conformes » au tri n'ont pas été relus un par un sur l'image : le tirage de 5 % les mesure
  (0 écart dans le texte de loi).
- Les intitulés n'ont pas été collationnés en entier : seuls les doublons et les écarts rencontrés sont traités.
- L'étendue exacte de l'italique est établie sur l'image pour les 365 articles lus ; pour les autres, par la police
  de la couche texte.

## 10. Rejouer, appliquer

```bash
python3 scripts/collationner-code-civil-livre.py "<Code Civil.pdf>" <travail>          # phase 1 : le livre (≈ 40 s)
python3 scripts/collationner-code-civil-comparer.py <travail> <instantané>            # phase 2 : le tri
python3 scripts/collationner-code-civil-livrables.py <travail> <corrections.json>    # livrables
npx tsx --tsconfig <tsconfig jsx> scripts/corriger-code-civil-mot-a-mot.tsx <corrections.json> --typographie            # à blanc
npx tsx --tsconfig <tsconfig jsx> scripts/corriger-code-civil-mot-a-mot.tsx <corrections.json> --typographie --commit   # après validation
```

L'instantané de la base (avant), son empreinte et le fichier `corrections.json` sont **hors du dépôt** (public),
dans `~/Library/CloudStorage/Dropbox/Lam Veritab/audit-code-civil-mot-a-mot/`. Le correctif refuse d'écrire si la
fiche a changé depuis l'instantané.
