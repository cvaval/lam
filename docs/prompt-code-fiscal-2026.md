# Prompt — Verser le Code fiscal de 2026 (Le Moniteur Spécial n° 48-A), son sommaire et son index ; mettre à jour l'Index du Moniteur et les Éditions

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (Agora, agora.ht).
> Rédigé le 13 octobre 2026. Tous les chiffres ci-dessous ont été **mesurés** sur les fichiers
> et, en lecture seule, sur la base de production. **Refais chaque mesure avant d'écrire** : un
> écart t'arrête.

## Ce qui est demandé

1. **Législation annotée → lois fiscales.** Verser le décret du 30 septembre 2026, qui remplace
   le Code fiscal de 2022, dans le format « lecteur annoté » du corpus, **à l'identique du Code
   civil** (§ 6 bis) : texte, **Sommaire** (table des matières, avec les articles de chaque
   division) et **Index des mots-clés** au panneau latéral, renvois « article N » cliquables.
   Archiver la version Word d'origine.
2. **Index du Moniteur.** Ajouter l'entrée de l'acte publié dans le Spécial n° 48-A.
3. **Éditions Le Moniteur.** Cataloguer le fascicule Spécial n° 48-A, dont le PDF a été fourni le
   13 octobre (§ 9).

> **Révisé le 13 oct. après l'audit du fac-similé.** Consigne de Me Vaval : « auditer la version
> PDF du texte avant de trancher ; ne pas faire de changement qui ne serait pas prévu dans le texte
> original ». **Le texte du Journal officiel fait foi, à la lettre**, y compris ses propres
> irrégularités (§ 2). Ni la transcription Word ni la table des matières fournie ne priment sur lui.

### Les pièces

| Fichier (`~/Downloads/`) | Contenu | SHA-256 |
| --- | --- | --- |
| `Code_Fiscal_2026_Moniteur_48-A.docx` (264 589 o) | le décret entier, de la manchette à la dernière signature | `02193031afd76a0a2ea4b605a0ae788b42e01fc44d6174d35b1897164f8be074` |
| `TABLES DES MATIÈRES.docx` (34 920 o) | sommaire : 419 entrées, avec des numéros de page (7 → 190) qui **ne sont PAS ceux du J.O.** et **ne s'affichent pas** : la version HTML indique les articles (§ 6) | `5e58a5ab6341d4e3a1a4d0f8206571ff4ef0ddd22a82e92609d934dd8c9fa0cf` |
| `Code_Fiscal_2026_Index_mots-cles.docx` (42 344 o) | index analytique en deux parties : Livre I (art. 1-297), Livre II (art. 298-543) | `d07522fcb24f3ce0f62c7a04d3b9a0b8fbd41a1d09d7cb2ed1adffea808590dc` |

Trois transcriptions partielles traînent aussi dans `~/Downloads/` :
- `Moniteur_48A_p43-89.docx` (art. 121-297) ;
- `Moniteur_48A_p121-156.docx` (art. 404-501) ;
- `Code_fiscal_art_502-543_Moniteur_48-A.docx`.

⚠️ **Ce ne sont PAS des témoins indépendants.** Le fichier complet a été assemblé à partir
d'elles, et elles portent les mêmes défauts (l'article 406 en double s'y trouve aussi). Elles ne
départagent rien. Seul le fac-similé départage.

**Le fac-similé** : `~/Library/CloudStorage/Dropbox/Moniteur/Code Fiscal_2026_small.pdf` (184 pages,
38 359 555 o, scanner Hewlett-Packard, SHA-256
`4de4e837f1a58b9e495b5cd2e08c3406c50ef513e6a74b0b2b1b0dca05153ae6`). La page imprimée est la page du
PDF. On y trouve :

| Pages | Contenu |
| --- | --- |
| 1 | manchette et sommaire |
| 1-170 | le décret, jusqu'aux signatures |
| **171-183** | **la table des matières du J.O. lui-même**, avec les vraies pages |
| 184 | avis tarifaire des Presses nationales, à **exclure** du corps en Législation |

Sa couche texte (OCR du scanner) est **bruitée** : « d6sirant » pour « désirant », « 1’ » pour
« l’ », le tiret lu « .' » ou « ._ ». Elle sert à **localiser**, jamais à **trancher** : on tranche
sur l'image.

Enregistre ces empreintes dans `scripts/data/code-fiscal-2026/EMPREINTES.txt`, à côté
du script d'extraction.

---

## § 1 — L'acte, mesuré

| | |
| --- | --- |
| Manchette | « LE MONITEUR — Journal officiel de la République d'Haïti — 181ᵉ Année – **Spécial N° 48-A** – Port-au-Prince – **Mercredi 30 Septembre 2026** » (le 30 sept. 2026 est bien un mercredi) |
| Intitulé | « **Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal** » |
| Autorité | « Le Conseil des Ministres », sur le rapport du Ministre de l'Économie et des Finances |
| Préambule | **103 visas**, **8 considérants**, « DÉCRÈTE » |
| Intitulé du code | « CODE FISCAL COMPRENANT LE CODE GÉNÉRAL DES IMPÔTS (CGI) ET LE LIVRE DES PROCÉDURES FISCALES (LPF) » |
| Signature | « Donné au Palais National, à Port-au-Prince, le **30 Septembre 2026** » ; **19 signataires**, du Premier ministre Alix Didier FILS-AIMÉ et du ministre de l'Économie Serge Gabriel COLLIN jusqu'à Pr. Vijonet DEMERO |
| Entrée en vigueur | **1ᵉʳ octobre 2026** (art. 540) |
| Articles | numérotés de 1ᵉʳ à 543, **542 têtes** — dans le J.O. lui-même : **pas d'article 294, et deux « Article 406 »** (§ 2) |
| Volume | 4 195 paragraphes, ≈ 525 000 caractères, **9 tableaux** |

**Architecture.** On la lit dans la table des matières, qui fait autorité :

| Division | Livre I : CGI (art. 1-297) | Livre II : LPF (art. 298-543) |
| --- | --- | --- |
| Parties | 3 (Préalables · Impôts d'État · Impôts locaux) | 7 + une « CONCLUSION : DISPOSITIONS TRANSITOIRES ET FINALES » qui a ses propres 1ʳᵉ et 2ᵉ parties |

Sur l'ensemble du code, la table des matières compte :
- 2 Livres ;
- 11 Parties, plus la Conclusion ;
- 6 Titres ;
- 4 Sous-titres ;
- 63 Chapitres ;
- 134 Sections ;
- 146 rubriques « A. » ;
- 43 rubriques « 1. » ;
- 8 rubriques « i. ».

**Neuf niveaux en tout.** ⚠️ La numérotation des Parties **recommence** dans la Conclusion. Les
ancres de section se numérotent donc dans l'ordre du corps (`sec-1`, `sec-2`…), **jamais** d'après
le libellé.

**Les neuf tableaux**, chacun placé après son article :

| Article | Contenu du tableau |
| --- | --- |
| 154 (×2) | taxes sur les véhicules |
| 202 | accises |
| 230 | usufruit et nue-propriété |
| 274 | barème de la contribution foncière des propriétés bâties (CFPB) |
| 293 | tarif d'affichage, 21 lignes |
| 403 (×3) | valeurs locatives : gardien, pièces, véhicules |

**Le Word lui-même :**
- aucune note de bas de page (`footnotes.xml` ne porte que les séparateurs) ;
- aucune numérotation automatique (`numPr` = 0) ;
- **0 tabulation littérale U+0009**, mais des **éléments `<w:tab/>`** :
  - dans **282 têtes**, celles des articles 121 à 293 et 295 à 403 : « Article 121.-`<w:tab/>`Ont
    à payer… » ;
  - en tête de ces mêmes paragraphes ;
  - dans les énumérations « `<w:tab/>`a.`<w:tab/>`… ».

  ⚠️ **C'est le bug `<w:tab/>` de nos extracteurs** (leçon de la loi UCREF). Une tabulation devient
  une **espace**, jamais rien : sinon on obtient « Article 121.-Ont à payer… ».

**Les têtes d'article, vérifiées UNE PAR UNE sur l'image du J.O.** (planches de toutes les têtes,
13 oct.) :

| Forme dans le J.O. | Articles |
| --- | --- |
| « Article 1ᵉʳ.- » | 1 |
| « Article N.- » | tous les autres |
| « Article N. » **sans tiret** | **296, 442, 443, 444, 492, 519, 527, 534, 535, 536** (10) |
| « Article129.- » **sans espace** | 129 |

⚠️ **La transcription Word s'écarte du J.O. sur six têtes :**
- elle **ajoute un tiret** aux articles **296, 442, 443, 444 et 492** ;
- elle **ajoute une espace** dans « Article 129 ».

Ce sont des changements que l'original ne porte pas : le corps versé reprend la forme **du J.O.**
(§ 2). `anchors.ts` doit reconnaître les trois formes, ainsi que « Article129.- » sans espace, sans
casser les 29 000 autres corps du corpus.

---

## § 2 — Les irrégularités : tranchées sur le fac-similé, et le J.O. fait foi

Audit du 13 octobre, sur l'**image** des pages :

| | Où (page du J.O.) | Ce que porte le J.O. | Décision |
| --- | --- | --- | --- |
| **A** | Droit d'affichage, **p. 88-89** | **Il n'y a PAS d'article 294 dans le J.O.** L'art. 293 (a-c) est suivi du tableau « Tarif des affiches publicitaires », puis de « 2. Le montant de l'impôt est égal à : … » et « 3. … », puis de l'**art. 295**. La numérotation saute de 293 à 295. La transcription est **fidèle**. | **Reproduire tel quel** : pas d'ancre `art-294`, pas de tête inventée. ✅ **Confirmé par Me Vaval le 13 oct.** (« oui »), après l'audit qui a montré que l'original n'en porte aucun. |
| **B** | Vérification de comptabilité, **p. 123-124** | « **Article 406.-** » imprimé **deux fois**, puis le second renvoie « au 2. de l'article 405 ». | **Laisser tel quel** (décision de Me Vaval, 13 oct.). Les deux têtes affichent « Article 406.- ». Pour la technique seulement : il faut **deux ancres distinctes**, `art-406` et `art-406-2` par exemple, sans rien changer au texte. Les renvois de l'index à « 405 » ne trouvent aucune ancre : signale-les dans la liste d'index (§ 7) au lieu de les relier en silence. |
| **C** | Patente, Section V, **p. 13-14** | Le corps imprime « **A.** Déclaration et paiement de la patente » puis « **C.** Certificat de patente » : pas de B. ⚠️ **Le J.O. se contredit** : sa propre table des matières (p. 171) écrit « **B.** Certificat de patente … 14 ». | **Reproduire le corps** (« C. »), qui est le texte. Signaler la contradiction dans la note de livraison. |
| **D** | Art. 274, barème CFPB, **p. 84** | « 6, 6% », « 7, 7% », « 8, 8% », « 9, 9% », « 11% ». Le J.O. écrit ses décimales avec une espace après la virgule : à l'art. 272, sur la même page, « zéro virgule vingt-cinq pour cent (**0, 25%**) ». | **Reproduire tel quel.** Ce sont des taux de **6,6 %, 7,7 %, 8,8 % et 9,9 %**, pas un chiffre doublé. Aucune correction. |
| **E** | Têtes d'article (§ 1) | 10 têtes sans tiret ; « Article129.- » sans espace. | **Forme du J.O.** : retirer le tiret ajouté aux art. 296, 442, 443, 444 et 492 ; garder « Article129.- ». |
| **F** | Art. 230, tableau d'usufruit, **p. 73** | 2ᵉ ligne : « De 21 à moins **de** 31 ans révolus ». La 6ᵉ ligne est bien « De 61 à moins 71 ans révolus », sans « de ». | La transcription a **perdu le « de »** de la 2ᵉ ligne : **le rétablir**. La 6ᵉ ligne reste sans « de ». |
| **G** | Art. 22, **p. 13** | Énumération « **f.** » et « **g.** » au lieu de « a. » et « b. » ; transcription fidèle. | Reproduire. |
| **H** | Art. 202, tableau des accises, **p. 64** | « inhalationautres », collé ; transcription fidèle. | Reproduire. |

**Ce qui a été contrôlé, et ce qui ne l'a pas été :**
- les **543 têtes** d'article ;
- les **9 tableaux**, cellule par cellule : art. 154 (×2), 202, 230, 274, 293 et 403 (×3). Ils sont
  conformes, à la ligne F près. Seule la mise en forme diffère : à l'art. 403, le J.O. fond les trois
  tranches de tonnage dans une seule cellule ;
- une **comparaison des nombres** (montants, taux, délais, renvois) entre le Word et la couche OCR.
  Elle relève environ 100 écarts, tous attribuables au bruit de l'OCR sur les cas vérifiés.

⚠️ **Mais la ligne F n'a été vue qu'en contrôlant un tableau** : un mot manquant ne se voit pas dans
une comparaison de nombres. **Une collation COMPLÈTE du texte, mot à mot, contre le fac-similé est
donc requise avant publication** (§ 11). Il faut un témoin propre : l'OCR du scanner ne suffit pas,
passe le PDF par la chaîne « OCR combiné » du dépôt. Chaque divergence se tranche sur l'image, et
seule l'**image** fait foi.

---

## § 3 — Ce qui existe déjà en base (mesuré le 13 oct., lecture seule)

**Le Code fiscal de 2022 n'a jamais été versé en Législation annotée.** Il n'existe qu'à deux
endroits :
- dans l'**Index**, avec deux entrées `LM2023-SP3` du vendredi 20 janvier 2023 :
  - « Décret portant Code Fiscal » (`DECRET`) ;
  - « Code Général des Impôts (CGI) » (`AUTRE`) ;
- dans les **Éditions**, avec le fascicule `LM2023-SP3` (« Édition spéciale n° 3 — Janvier
  2023 », `MONITEUR_PDF_2023`, PDF sur Blob).

**L'Index du Moniteur :**
- aucune entrée `LM2026-SP48-A` ;
- les dernières entrées sont celles d'août 2026 (SP39, SP43, 43-A, 43-B), versées par
  `scripts/index-moniteur-2026-aout.ts`.

**Les Éditions 2026 :**
- 359 fascicules ;
- le dernier est le **Spécial 43 du 21 août** ;
- aucun Spécial 44 à 48-A n'est en base, et **le 48-A n'existe sur aucun disque de ce poste**
  (cherché dans `~/Downloads` et `~/Desktop/Moniteur`).

**« Législation annotée → lois fiscales ».** Aucun thème ne s'appelle ainsi. La demande
correspond aux deux branches où vivent les textes fiscaux :

| Thème | Chemin | Textes |
| --- | --- | --- |
| `fiscalite` | Droit économique & des affaires › Fiscalité | 33 |
| `fiscalite-impots` | Droit fiscal & douanier › Fiscalité / impôts (DGI) | 18 |

Rattache le code à `fiscalite` en **principal**, comme le décret IR 2005, et à `fiscalite-impots`
en second. N'ouvre aucun thème.

**Les textes fiscaux déjà au corpus, tous `EN_VIGUEUR` :**
- impôt sur le revenu 2005 ;
- timbre 1978 (consolidé) ;
- patente 1996 (consolidée) ;
- CFGDCT 1996 ;
- CFPB 1979 ;
- enregistrement 1977 ;
- TCA 1995 et 2002 ;
- la série Vandal VII :
  - licence 1955, 1960 et 1978 ;
  - timbre ;
  - transmission 1903 ;
  - impôt sur le revenu 1986 ;
  - rectification 1986 ;
  - acompte 1995 ;
  - quitus 1990 ;
  - patente 1987 ;
  - TCA 1982 ;
- l'Appendice V du Code de procédure civile ;
- le régime d'imposition des jeux (2026).

Le nouveau code en reprend la matière : patente, licence, impôt sur le revenu, taxe sur la masse
salariale (TMS), quitus, véhicules, TCA, accises, timbre, enregistrement, CFGDCT, CFPB, contribution
foncière des propriétés non bâties…

---

## § 4 — Abrogations : une seule est nommée

- **Le remplacement du décret du 19 décembre 2022 est nommé dans l'intitulé.** C'est un renvoi
  nominatif, avec sa date : il produit un `CrossRef` **`ABROGE`**.
  - `toLabel` : « Décret du 19 décembre 2022 portant Code Fiscal ».
  - **Ne le résous pas vers l'entrée d'Index ni vers le fascicule.** Un `ABROGE` qui pointerait
    vers un fascicule affirmerait que le fascicule est abrogé. Laisse `toId` nul : la mention
    « cible non importée » est vraie et utile.
  - Ajoute un second renvoi, **`VOIR`**, vers le fascicule `LM2023-SP3`, pour que le lecteur
    atteigne le texte de 2022.
- **Les articles 541, 542 et 543 sont des clauses-balais** (« Tous les impôts… qui n'ont pas été
  reconduits… sont abrogés », « … qui lui sont contraires »). Ils ne nomment aucun texte, donc :
  - aucun statut « Abrogé » ;
  - aucune `ArticleVersion` ;
  - aucun `CrossRef` `ABROGE` vers les textes du § 3.

  Ces clauses restent lisibles dans le corps, à leur article. La **note de tête** les cite, avec
  la date d'entrée en vigueur.
- **N'écris jamais une mise en garde dans la `note` d'un CrossRef** : elle n'est lue nulle part.
- **Ne modifie pas les deux entrées d'Index `LM2023-SP3`.** La règle de l'Index est l'ajout seul,
  jamais la réécriture.

Le sort des textes fiscaux antérieurs est une **décision de la cliente** (§ 13, question 6).

---

## § 5 — Les visas : 103, dont au moins 47 déjà au corpus

Un appariement automatique, par nature et par date, trouve **au moins 47 visas** dont la cible est
en base. Exemples :
- `CODE_PENAL_ANNOTE`, `CODE_CIVIL_ANNOTE`, `CODE_COMMERCE_ANNOTE` ;
- `DECRET_LOI_NOTARIAT_1969` ;
- `DECRET_ENREGISTREMENT_1977`, `DECRET_TIMBRE_1978_CONSOLIDE`, `DECRET_CFPB_1979_CONSOLIDE` ;
- `LOI_PATENTE_1996_CONSOLIDE`, `LOI_CFGDCT_1996_CONSOLIDE` ;
- `CODE_INVESTISSEMENTS_2002`, `LOI_TCA_2002`, `DECRET_IMPOT_REVENU_2005` ;
- `MARCHES_LOI_2009`, `LOI_BANQUES_2012` ;
- `LOI_ECHANGES_ELECTRONIQUES_2017`, `LOI_STATUT_COMMERCANT_2018` ;
- `DECRET_SURETES`, `DECRET_BLANCHIMENT_2023` ;
- `DECRET_JEUX_IMPOSITION_2026`.

⚠️ **La date seule confond, dans les deux sens.**
- **Elle désigne parfois plusieurs textes.** Quatre décrets du 11 mars 2020 sont visés, et
  l'appariement ne les distingue pas ; il en va de même pour les deux décrets du 17 mai 2005 et
  les deux lois du 10 juin 1996.
- **Elle en manque d'autres.** Le Code des douanes du 23 décembre 2022 est au corpus
  (`CODE_DOUANES_ANNOTE`), mais son titre ne porte pas la date : l'appariement l'a manqué.

Construis donc une **table fermée** `visa → source`, vérifiée une ligne après l'autre, dans
`scripts/data/code-fiscal-2026/visas.json`. Seuls les visas **identifiés avec certitude** donnent
un `CrossRef` `CITE` (règle : un renvoi se résout par `source`, jamais par le titre). Les autres
restent du texte.

Deux visas à noter :
- « Vu le Décret du 19 décembre 2022 portant Code Fiscal » : c'est aussi le texte remplacé (§ 4) ;
- « Vu le Pacte National … du 21 février 2026 (Spécial N° 7) » : absent du corpus.

---

## § 6 — Le sommaire : des ARTICLES, jamais des pages

**Les 419 entrées se retrouvent toutes, dans l'ordre, dans le corps.**

Le corps écrit souvent une division sur **deux lignes**, là où la table l'écrit sur une :

| Corps | Table des matières |
| --- | --- |
| « TITRE I » + « PRÉALABLE COMMUN À L'ENSEMBLE DES CONTRIBUABLES » | « TITRE I. PRÉALABLE COMMUN… » |
| « PREMIÈRE PARTIE : » + son intitulé (Livre II) | une seule ligne |
| le Ch. 1 des Impôts locaux, sur **trois** lignes (« CHAPITRE 1 » / « CONTRIBUTION AU FONDS DE GESTION » / « ET DE DÉVELOPPEMENT DES COLLECTIVITÉS TERRITORIALES ») | une seule ligne |

`segmentAnnotated(body, toc)` apparie les en-têtes **ligne à ligne**, et une entrée qui ne s'apparie
pas fait échouer la segmentation. **Apparie le `toc` sur la première ligne** de l'en-tête et porte le
libellé complet dans `navToc`. Ne joins **pas** les lignes du corps : ce serait modifier la mise en
page du texte officiel, ce que la consigne exclut.

Contrôle d'arrêt : **segmentation = 419 / 419**.

### Dans la version HTML, chaque division renvoie à ses ARTICLES (consigne de Me Vaval, 13 oct.)

Le sommaire de la fiche n'affiche **aucun numéro de page** : ni ceux de `TABLES DES MATIÈRES.docx`,
ni ceux du J.O. À la place, chaque entrée affiche la **plage d'articles** qu'elle couvre, et
l'entrée comme la plage mènent à l'ancre du premier article.

```
LIVRE I : CODE GÉNÉRAL DES IMPÔTS ........................ art. 1 à 297
  PREMIÈRE PARTIE : PRÉALABLES ........................... art. 1 à 44
    TITRE I. PRÉALABLE COMMUN À L'ENSEMBLE DES CONTRIBUABLES  art. 1 à 12
      CHAPITRE UNIQUE : MATRICULE FISCAL ................... art. 1 à 12
    TITRE II. PRÉALABLES APPLICABLES AUX CONTRIBUABLES … ... art. 13 à 44
      …
        Section I. Répartition des recettes ................ art. 13
        Section II. Champ d'application .................... art. 14 à 16
          A. Personnes imposables ........................... art. 14
          B. Personnes exonérées ............................ art. 15 et 16
```

**Règles de calcul :**
- la plage se **calcule sur le corps versé**. Elle va du premier au dernier article situés entre
  l'en-tête et la division suivante de même niveau ou de niveau supérieur. Jamais à la main ;
- on écrit « art. 13 » pour un seul article, « art. 15 et 16 » pour deux articles consécutifs et
  « art. 13 à 31 » au-delà ;
- **une division qui n'a pas d'article propre prend l'union de ses sous-divisions** : la
  « CONCLUSION : DISPOSITIONS TRANSITOIRES ET FINALES » couvre les art. 540 à 543, par sa
  1ʳᵉ partie (art. 540) et sa 2ᵉ partie (art. 541 à 543) ;
- **les irrégularités du J.O. ne se corrigent pas dans les plages.** Le Droit d'affichage couvre
  « art. 293 à 295 », 294 n'existant pas ; la Vérification de comptabilité couvre « art. 404 à
  414 », avec deux « 406 ». La plage est un intervalle, pas une liste.

Mesuré le 13 oct. sur la transcription : **419 divisions, toutes avec une plage non vide** (la
Conclusion par union). Livre I : art. 1 à 297, soit 296 têtes ; Livre II : art. 298 à 543, soit
246 têtes. Recalcule-les après la collation (§ 2) et compare : tout écart s'explique.

**Les numéros de page ne servent qu'au travail, jamais à l'affichage :**
- ceux de `TABLES DES MATIÈRES.docx` **ne sont pas ceux du J.O.** Le Droit d'affichage y est en
  « p. 100 », mais il est imprimé page **88** ; l'écart varie de 1 à 22 pages. Ignore-les ;
- le J.O. porte sa **propre table des matières**, pages 171 à 183 du fac-similé, avec les vraies
  pages, qui sont aussi celles du PDF. Elle sert à **localiser** une division sur le scan pendant
  la collation, et rien d'autre ;
- pour les **libellés**, suis les intitulés du **corps**. Là où les deux tables divergent (« B. »
  contre « C. », § 2 C), c'est le corps imprimé qui fait foi.

⚠️ Pièges du lecteur annoté, déjà payés :
- les entrées du `toc` s'**intercalent dans l'ordre du corps** ;
- `jurisKey = curSection|artAnchor` ;
- seul le niveau 3 garde sa casse ;
- le corps est en **apostrophes courbes**, et `normLine()` ne replie que les espaces.

---

## § 6 bis — Le format : exactement celui du Code civil et des autres textes annotés

Consigne de Me Vaval : la table des matières et l'index des mots-clés se présentent **comme au Code
civil et aux autres textes de la Législation annotée**. C'est le même appareil, pas une
imitation : `CodeSidebar` (`src/components/CodeSidebar.tsx`), à gauche du texte, avec ses deux
onglets « **Sommaire** » et « **Index** » et sa recherche dans le texte. Il est alimenté par
`annotationsJson` (types dans `src/lib/legislation/annotated.ts`). Mesuré le 13 oct. sur les fiches
en base :

| Clé de `annotationsJson` | Code civil | Décret minier 2026 | IR 2005 | **Code fiscal 2026** |
| --- | --- | --- | --- | --- |
| `title` | « Code civil d'Haïti » | intitulé | intitulé | intitulé du décret (§ 8) |
| `toc` (plat : `level`, `label`, `anchor`, `kind`) | 357 | 67 | 56 | **419** + « Préambule » ; `kind: "code"` |
| `navToc` (arbre : `label`, `anchor`, `children`) | 1 groupe | 17 | 5 | **2 groupes** (Livre I, Livre II) + Préambule + Conclusion, sur 9 niveaux |
| `indexEntries` (`subject`, `ctRefs`) | 1 481 | 392 | 369 | ≈ 497 sujets avant fusion (§ 7) |
| `labels` (`art-N` → « Article N ») | 2 107 | 342 | 191 | 542 (« Article 1er », deux « Article 406 ») |
| `crossRefs` (notes de section affichées) | 2 | 2 (dont le « sic » de l'art. 27) | 2 | les irrégularités du J.O. (ci-dessous) |
| `jurisprudence`, `connexes`, `commentaires`, `status`, `oldVersions` | oui | vides | partiels | **vides** : texte neuf, rien n'est amendé |

**Le Sommaire :**
- **`navToc` reproduit l'arborescence entière**, Livre → Partie → Titre → Sous-titre → Chapitre →
  Section → A. → 1. → i. `CodeSidebar` la rend récursivement : premier niveau déplié, niveaux
  profonds repliés, comme au Code civil.
- **Les libellés sont les intitulés du corps**, réunis sur une ligne : « TITRE I — PRÉALABLE COMMUN
  À L'ENSEMBLE DES CONTRIBUABLES », « CHAPITRE 1 — CONTRIBUTION AU FONDS DE GESTION ET DE
  DÉVELOPPEMENT DES COLLECTIVITÉS TERRITORIALES ». Garde la casse de l'original.
- **Une entrée « Préambule »** en tête mène aux visas et considérants, comme pour l'IR 2005.
- **La plage d'articles** de chaque entrée (§ 6) s'ajoute par un champ **facultatif** de
  `NavItem`, par exemple `articles: "art. 1 à 12"`. `CodeSidebar` l'affiche discrètement après le
  libellé. **Les fiches existantes, qui n'ont pas ce champ, ne changent pas** : c'est la seule
  retouche de composant du chantier. Teste-la sur le Code civil (inchangé) et sur le Code fiscal.
  ⚠️ N'écris jamais la plage dans `toc.label` : `toc` borne les segments d'article et doit
  s'apparier au corps.

**L'Index :** voir § 7. Une liste alphabétique unique, filtrable (« Filtrer un sujet… »), chaque
renvoi menant à `#art-N`.

**Les renvois dans le texte :** les mentions « l'article 76 », « au 1. de l'article 21 » sont
cliquables grâce à `ART_REFS_SOURCES` ; `HIDE_INLINE_INDEX_SOURCES` met l'index au panneau et non
sous le texte. Inscris `CODE_FISCAL_2026` dans les deux, comme les autres textes annotés.

**Les irrégularités du J.O.** s'annoncent comme le « sic » de l'article 27 du décret minier : une
note dans `annotationsJson.crossRefs`, ancrée à la section concernée. Le texte, lui, n'est jamais
touché. Trois notes :
- **Chapitre 7, Droit d'affichage** : « Le Journal officiel passe de l'article 293 à l'article 295 ;
  aucun article 294 n'y est imprimé. Le texte est reproduit tel quel. »
- **Section IV, Vérification de comptabilité** : « Le Journal officiel imprime deux fois
  « Article 406 » ; le second renvoie au 2. de l'article 405. Reproduit tel quel. »
- **Section V, Établissement de la patente** : « Le Journal officiel passe de la rubrique A à la
  rubrique C, alors que sa table des matières écrit « B. Certificat de patente ». Le texte est
  reproduit tel quel. »

Fais valider ces trois formulations par Me Vaval avant publication.

**Contrôle :**
- ouvre côte à côte la fiche du Code civil et celle du Code fiscal ;
- mêmes onglets, même recherche, même comportement de l'index, mêmes renvois cliquables ;
- seule différence admise : les plages d'articles du sommaire.

---

## § 7 — L'index : celui de la cliente, vérifié couple par couple

**Ce que contient le fichier :**
- **315 entrées et 182 sous-entrées** (« – ad valorem : art. 202, 203 ») ;
- **3 715 renvois** ;
- deux parties, Livre I et Livre II ; un même mot peut figurer dans les deux (« Arrondi : art.
  17 » et « Arrondi : art. 300 »).

**Couverture : 540 articles sur 543.** Les articles 289, 290 et 541 ne sont jamais cités.

**Bornes :** tous les renvois tombent entre 1 et 543, et chaque partie ne renvoie qu'à son Livre.

⚠️ **Le fichier a été établi aujourd'hui** (auteur « Un-named », 13 oct., 15 h 55), et il contient
des renvois **faux**. L'exemple type :
- « Assistance administrative internationale : **art. 48** » (Livre I) — or l'art. 48 dit « Sont
  assujetties à l'Impôt sur le Revenu » ;
- l'expression n'apparaît qu'aux art. 358, 401, 463 et 464 ;
- la partie Livre II cite « 358, 401, 414, 420, 464 » : elle **omet 463** et ajoute 414 et 420.

Un test grossier (la racine du premier mot de l'entrée présente dans l'article) échoue sur **776
couples sur 3 712**. Ce sont surtout des variantes de forme (« Agriculture » face à « agricole »).
Il faut un **contrôle plus fin** : lemmes, synonymes, sous-entrées rattachées à leur vedette.

**Règle :**
- l'index de la cliente est l'**autorité** : on le reproduit ;
- **mais chaque couple (entrée, article) est vérifié sur le texte de l'article** ;
- les couples douteux vont dans une **liste remise à la cliente**
  (`docs/livraison-code-fiscal-2026/index-a-valider.csv`), jamais corrigés ni retirés en silence.

C'est la règle des index clients du décret minier, et celle du sujet d'index : les mots
**exacts** du corps.

**La forme est celle du Code civil (§ 6 bis)** : une seule liste alphabétique de
`{ subject, ctRefs }`.
- Une sous-entrée s'écrit « **Vedette — sous-entrée** », comme pour le décret minier
  (« Abandon des travaux — déclaration préalable »). Exemple : « Accises (droits d') — ad valorem »
  → `ctRefs: ["202","203"]`.
- La **vedette garde ses propres renvois** : « Accises (droits d') » → `["35","195",…,"211","240"]`.
  Une plage « 195 à 211 » se **déplie** en 17 numéros.
- Les deux parties Livre I / Livre II **se fondent** dans la liste unique. Un sujet présent dans les
  deux (« Arrondi (règles d') » : 17 et 300) devient une entrée aux renvois réunis — c'est d'ailleurs
  ce que fait déjà `CodeSidebar` en dédoublonnant par sujet.
- `ctRefs` sont des **chaînes** (`"202"`), comme pour le décret minier et l'IR 2005. Chacune
  doit atteindre une ancre `art-N` réelle : **0 lien mort**.

Les renvois de l'index vers « **405** » n'ont pas d'article de ce numéro dans le J.O. (§ 2 B).
Retire-les du panneau, pour ne publier aucun lien mort, et **liste-les** dans
`index-a-valider.csv` : retirés, mais pas en silence. Même traitement pour tout renvoi vers 294.

---

## § 8 — Ce qu'il faut écrire en Législation annotée

| Champ | Valeur |
| --- | --- |
| `type` | `LEGISLATION` |
| `source` | `CODE_FISCAL_2026` |
| `titleFr` = `number` | « **Décret du 30 septembre 2026 remplaçant le Décret du 19 décembre 2022 portant Code Fiscal** » (règle du corpus : nature + date + objet ; voir § 13, question 4) |
| `keywords` | dont « Code fiscal ; Code général des impôts (CGI) ; Livre des procédures fiscales (LPF) » |
| `adoptionDate` | 2026-09-30 (pour un décret : la signature) |
| `publicationDate` | 2026-09-30 |
| `effectiveDate` | **2026-10-01** (art. 540) |
| `moniteurRef` | « Le Moniteur, 181ᵉ Année – Spécial N° 48-A, mercredi 30 septembre 2026 » |
| `status` | `EN_VIGUEUR` |
| `sourceFileUrl` | le `.docx` d'origine, sur Blob **privé** (c'est la « version Word ») |
| `sourcePdfUrl` | le fac-similé du Spécial 48-A sur Blob (§ 9) |
| thèmes | `fiscalite` (principal) + `fiscalite-impots` |
| `titleEn` / `titleHt` | traduits ; le créole suit la convention de la cliente, sans accent grave ajouté |

**Le corps :**
- il commence à « LIBERTÉ ÉGALITÉ FRATERNITÉ / RÉPUBLIQUE D'HAÏTI / DÉCRET… » et s'arrête à la
  **dernière signature** ;
- la manchette et le sommaire du fascicule (les 10 premières lignes) sont **coupés**, et leurs
  références d'autorité passent dans `moniteurRef` et dans la note de tête. Règle : toute coupe
  de front matter reverse ses références (leçon du « N° 87 » inventé).

**Les tableaux :** reprends le traitement éprouvé, c'est-à-dire le barème de l'IR 2005 et la
cellule multi-paragraphes du décret minier, dont les paragraphes se joignent par une **espace**.
Vérifie ensuite le rendu (en-tête figé, « Copier TSV »).

**Le lecteur annoté :**
- inscris `CODE_FISCAL_2026` dans `HIDE_INLINE_INDEX_SOURCES` et `ART_REFS_SOURCES`
  (`src/app/[locale]/(app)/doc/[id]/page.tsx`) ;
- les renvois internes (« visées à l'article 76 », « au 1. de l'article 21 ») atteignent
  l'**ancre de l'article** ;
- un renvoi vers un numéro que le J.O. n'imprime pas (« l'article 405 », 294) reste du **texte
  simple**, sans lien deviné. Liste-les dans la note de livraison.

**Les sources :**
- archive les pièces dans `scripts/data/code-fiscal-2026/` ;
- écris le script d'import `scripts/_import-code-fiscal-2026.ts` : **à blanc par défaut**,
  `--commit` sur instruction ;
- recompte après la transaction, parce qu'`audit()` avale ses erreurs ;
- lance `reindexDocument()` **hors** transaction.

---

## § 9 — Éditions Le Moniteur : le fascicule

Une fiche d'Éditions est un **fascicule**. Celui-ci est fourni : 184 pages, voir « Les pièces ».

1. **Nom de fichier.** `import-moniteur-pdf.ts` lit le numéro et le jour dans le nom ; or
   `Code Fiscal_2026_small.pdf` ne les porte pas. **Ne renomme pas le fichier de la cliente.**
   Prépare plutôt, dans le scratchpad, un lien symbolique au nom attendu :
   `Le Moniteur Spécial No.48-A Mercredi 30 Septembre 2026.pdf` (`realpathSync` garde le vrai chemin).
2. Lance `import-moniteur-pdf.ts --dir <staging> --year 2026 --completer`.
   - Lance-le d'abord à blanc : à blanc, `--completer` ne lit pas la base, donc vérifie à la main
     que `LM2026-SP48-A` est absent.
   - Puis relance avec `--commit`, sur instruction.
   - L'année vient du drapeau, jamais du fichier.
3. Lance `migrate-pdfs-to-blob.ts --commit` ; relance-le en cas d'échecs transitoires (38 Mo).
4. Établis la transcription par la chaîne « OCR combiné ». La couche du scanner HP est inexploitable
   en l'état (« D6CRET »).
5. Relis la date sur la manchette : mercredi 30 septembre 2026.
6. **Ne remplace jamais la transcription du fascicule par le texte propre du Word.** Le fac-similé
   et sa transcription restent ce qu'ils sont ; la version propre vit en Législation (même règle
   que pour les jeux de hasard).
7. Attache le même PDF en **fac-similé** de la fiche de Législation (`sourcePdfUrl`, sur le modèle
   de `attacher-facsimile-ir-2005.ts`). Ce sont deux objets distincts, et il faut les deux.
8. Pose un `CrossRef` **`VOIR`** de la fiche de Législation vers le fascicule `LM2026-SP48-A`.
9. Demande à la cliente s'il existe un **Spécial n° 48** (sans « -A ») le même jour, et signale que
   les Spéciaux **44 à 48** manquent en base.

---

## § 10 — L'Index du Moniteur : une entrée, l'ajout seul

Calque `scripts/index-moniteur-2026-aout.ts` dans un script
`scripts/index-moniteur-2026-sp48a.ts`, à blanc puis `--commit` :

| Champ | Valeur |
| --- | --- |
| `type` / `source` | `INDEX` / `MONITEUR` |
| `number` | `LM2026-SP48-A` |
| `publicationDate` | 2026-09-30 |
| `category` | `DECRET` |
| `editionType` | `SPECIALE` |
| `titleFr` | « Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal » |
| `moniteurRef` | « Le Moniteur · LM2026-SP48-A · Mercredi 30 septembre 2026 » (mois en minuscule : pratique de toutes les entrées depuis 2020) |

**Une seule entrée.** Le sommaire du fascicule n'annonce qu'un acte, et c'est lui qui fait foi.
L'Index d'origine avait fait deux entrées pour 2022 (« Décret » et « CGI ») ; ne reproduis pas ce
dédoublement.

Le titre de l'entrée suit la pratique de l'Index : l'intitulé tel qu'imprimé au sommaire. La règle
« nature + date + objet » vaut pour les fiches de Législation.

Tant que le fascicule n'est pas en Éditions, la fiche d'Index dira « fascicule pas encore
numérisé » (commit `7ebc2d5`). C'est exact.

---

## § 11 — Contrôles avant de déclarer le travail fini

1. **Articles :**
   - **542 têtes**, comme dans le J.O. : pas de 294, et 406 deux fois avec deux ancres distinctes ;
   - recompte par forme de tête : `1er.-` (1), `N.` (10 : 296, 442, 443, 444, 492, 519, 527, 534,
     535, 536), « Article129.- » (1), `N.-` (tous les autres).
2. **Collation complète** contre le fac-similé (§ 2) :
   - chaque divergence est tranchée sur l'image et consignée dans
     `docs/livraison-code-fiscal-2026/collation.csv` ;
   - aucune correction ne va au-delà de ce que porte le J.O.
2 bis. **Tabulations :** aucune tête collée. Cherche `Article \d+\.-\S` dans le corps versé.
3. **Segmentation et sommaire :**
   - 419 / 419 ; les 9 niveaux s'affichent ; aucune ancre `sec-N` en double ;
   - **chaque entrée porte sa plage d'articles**, calculée et non saisie, et **aucun numéro de
     page** n'apparaît sur la fiche ;
   - la plage de la Conclusion (art. 540 à 543) est obtenue par union ;
   - **comparaison côte à côte avec la fiche du Code civil** : mêmes onglets « Sommaire » et
     « Index », même filtre, mêmes renvois ; la fiche du Code civil est inchangée après la retouche
     de `CodeSidebar`.
4. **Index :**
   - 3 715 renvois, 0 lien mort ;
   - les couples douteux sont listés et non supprimés ;
   - la couverture de 540 / 543 est rapportée.
5. **Tableaux :** 9 au bon article, contenu identique au Word, cellule par cellule.
6. **Corps :** il commence à « LIBERTÉ ÉGALITÉ FRATERNITÉ », finit à « Pr. Vijonet DEMERO », et
   compte 19 signataires.
7. **Renvois :**
   - un `ABROGE` nominatif, vers le décret de 2022, laissé non résolu ;
   - un `VOIR` vers `LM2023-SP3` ;
   - les `CITE` de la table fermée des visas ;
   - **zéro `ABROGE`** issu des art. 541-543 ;
   - aucun statut modifié sur les textes du § 3.
8. **Dates :** adoption et publication le 30 sept. 2026, entrée en vigueur le 1ᵉʳ oct. 2026.
9. **Index du Moniteur :** l'entrée `LM2026-SP48-A` existe ; aucune autre entrée n'a changé.
10. **Recherche :** « code fiscal », « livre des procédures fiscales », « matricule fiscal » et
    « vérification de comptabilité » trouvent la fiche (le moteur de production est le FTS).
11. **Fin de chaîne :**
    - `npm run typecheck && npm run lint && npx vitest run --dir src` ;
    - `npm run build:check`, jamais `npm run build` ;
    - contrôle visuel de la fiche dans les trois langues.

---

## § 12 — Contraintes du dépôt

- **`.env` = base de PRODUCTION.**
  - Tout script s'exécute à blanc par défaut.
  - `--commit` ne se lance que sur instruction explicite de Me Vaval.
  - Le jeton Blob se passe explicitement (piège OIDC).
- **Git :**
  - `git add` fichier par fichier, jamais `-A`.
  - Relis le diff complet de tout fichier partagé avant de commiter.
- **Pas de déploiement** sans instruction explicite.
- **La note de livraison** `docs/livraison-code-fiscal-2026.md` est brève. Elle contient :
  - ce qui est versé ;
  - les anomalies et leur sort ;
  - la liste d'index à valider ;
  - la table des visas ;
  - les questions restées ouvertes.

---

## § 13 — Ce que ce prompt ne tranche pas (questions à Me Vaval)

1. ~~Le PDF du Spécial n° 48-A~~ — **fourni le 13 oct.** Reste à savoir s'il existe un Spécial n° 48
   sans « -A », et ce qu'il en est des Spéciaux 44 à 47.
2. ~~L'article 294~~ — **TRANCHÉ le 13 oct.** : il reste absent, comme dans le J.O. (§ 2 A).
   Confirmation de Me Vaval.
3. ~~Les anomalies B à E~~ — **tranchées sur le scan** (§ 2) : 406 deux fois, « C. » sans B,
   « 6, 6% » = 6,6 % et les têtes sans tiret se reproduisent tels quels ; seuls les écarts **de la
   transcription** sont corrigés : 5 tirets en trop, « Article129 », le « de » de l'art. 230.
4. **Le titre.** Je recommande le nom de l'acte (§ 8).
   - L'autre voie est le nom de code « Code fiscal (2026) ».
   - La règle du titre complet exempte les codes, mais deux « Code fiscal » existent : 2022 et
     2026. Le nom seul ne suffit donc plus à les distinguer.
5. **La liste des couples d'index douteux** est à valider (§ 7).
6. **Les textes fiscaux antérieurs** (§ 3) : faut-il un renvoi `VOIR` de chacun vers le Code
   (« matière reprise par le Code fiscal de 2026 ») ? Par défaut, rien.
   - Aucun statut ne change par l'effet des clauses-balais.
   - Seule une décision expresse de la cliente peut changer un statut.
7. **La « version Word » pour les abonnés.**
   - Aujourd'hui, seule l'archive existe (`sourceFileUrl`, Blob privé). Le téléchargement Word
     n'existe que pour les annexes des circulaires BRH (filigrane, palier `export.sealed`).
   - Proposer « Télécharger le texte (Word) » sur cette fiche serait une **fonction nouvelle**.
     Par défaut : non.
8. **Le Code fiscal de 2022 lui-même** : le verser en Législation annotée comme version
   historique ? Par défaut : non. Il reste lisible dans son fascicule `LM2023-SP3`.
