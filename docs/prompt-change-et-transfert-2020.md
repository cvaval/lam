# Prompt — sommaires et index des décrets de 2020 sur le change et les transferts

> À donner tel quel à une session de travail sur le dépôt `lam-veritab`.
> Chaque chiffre ci-dessous a été **mesuré** sur les quatre `.docx` et sur la base de production,
> en rejouant les fonctions réelles (`articleAnchorFromHeading`, `segmentAnnotated`).

---

## Ce n'est pas un téléversement : les trois décrets sont DÉJÀ en base, sans aucune annotation

Les quatre fichiers fournis ne contiennent **aucun texte de loi** — deux sommaires, deux index.
Les textes qu'ils décrivent sont publiés depuis longtemps, et tous les trois ont
`annotationsJson = NULL` : ni sommaire, ni menu, ni index, et donc **pas de barre latérale**
(`doc/[id]/page.tsx` la conditionne au seul `annotations ?`).

| source | id | corps | têtes reconnues | ancres émises |
|---|---|---|---|---|
| `DECRET_INTERMEDIAIRES_CHANGE_2020` | `cmsqyfecr0000kg2hgx6eh1sv` | 232 lignes | 68 | 60 |
| `DECRET_AFFICHAGE_PRIX_2020` | `cmsqyfi2z0003kg2hn3kw66p0` | 73 lignes | 18 | **13** |
| `DECRET_MAISONS_TRANSFERT_2020` | `cmsr2h1dz0003pgnqqg3yhmvn` | 51 lignes | 5 | 5 |

La mission est donc d'**enrichir**, pas de créer. Créer ferait doublon.

Écrire un `annotationsJson` **fait basculer ces documents d'un lecteur à l'autre** — de
`OfficialText` pleine largeur à `AnnotatedText` avec barre latérale. C'est voulu, mais cela veut
dire que la comparaison avant/après doit porter sur le rendu, pas sur la donnée.

Deux autres documents sont concernés, tous deux **déjà annotés** :

- **`CC_VANDAL_II-K`** (`cmrtiwkrt000eue7e1gwsze2c`) — Décret du 6 juillet 1989 sur les maisons
  de transfert, 21 articles tous ancrés, `toc` de 7 chapitres, `navToc` 1, index 0, `status` 0.
- **`CC_VANDAL_I-B-2`** (`cmrtinshw0004ot7lpvt5ll1g`) — Décret du 31 janvier 1989 sur la
  profession d'agent de change.

## Les fichiers

| fichier | ¶ | nature |
|---|---|---|
| `Sommaire_Detaille_Decret_5_juin_2020.docx` | 56 | rubriques (visas, considérants, dispositif, signatures) |
| `Index_Mots-cles_Decret_5_juin_2020.docx` | 139 | tableau 3 colonnes + table de concordance + observations |
| `Sommaire_Detaille_Moniteur_Special_N41_2020.docx` | 121 | 3 parties, résumé article par article |
| `Index_Mots_Cles_Moniteur_Special_N41_2020.docx` | 186 | 3 parties, alphabétique — 116 / 20 / 12 entrées |

⚠️ Piège d'extraction déjà payé : convertir `<w:tab/>` en `<w:t> </w:t>` et retirer
`<w:pPr>…</w:pPr>` **avant** de lire les `<w:t>`. Les corps en base portent d'ailleurs de vraies
tabulations (« Article 1ᵉʳ.-⇥Le présent Décret… ») : ne les normalise pas, tu casserais l'appariement.

## Les trois défauts mesurés

### 1. Au décret sur l'affichage, deux articles ont perdu leur ancre au profit d'intertitres

`articleAnchorFromHeading` reconnaît explicitement `section` comme tête d'article
(`/^(?:art(?:icle)?\.?|section)\s+…/`), et `OfficialText.headingAnchor` attribue les ancres
**au premier arrivé** (`usedAnchors`). Le corps de l'affichage est ordonné ainsi :

```
¶22 Section 1ʳᵉ            → reçoit #art-1
¶23 Dispositions générales
¶24 Article 1ᵉʳ.- …        → MUET
¶25 Section 2              → reçoit #art-2
¶27 Article 2.- …          → MUET
¶35 Section 3              → muette (art-3 pris par l'article 3)
¶39 Section 4              → muette
¶47 Section 5              → muette
```

Aujourd'hui, en production, **`#art-1` et `#art-2` désignent des intertitres**, les articles 1er
et 2 ne sont atteignables par aucun lien, et trois sections sont muettes : 18 têtes pour
13 ancres. C'est la première raison de faire ce travail.

Au décret sur les intermédiaires, la même mécanique joue mais l'ordre est favorable : les huit
« Section … » arrivent après les articles homonymes et sont toutes muettes. Les 60 ancres sont
exactes — 58 articles + 54.1 + 54.2. **Ne casse pas ce qui marche.**

**Inscrire les sections au `toc` règle le défaut** : elles cessent d'être des corps d'article et
ne disputent plus l'ancre. Vérifie-le en comparant l'ensemble des ancres d'article avant et après.

### 2. Les articles décimaux fonctionnent déjà — il faut les préserver, pas les réparer

Contrôlé sur le corps : `Article 54.1.-` → `art-54-1`, `Article 54.2.-` → `art-54-2`,
`Article 3.1.-` → `art-3-1`. `anchorFromDesignation` gère la décimale. L'index le confirme
(« Articles 1 à 58, y compris les articles 54.1 et 54.2 » ; « Articles 1 à 12, y compris
l'article 3.1 »).

Conséquence pour l'index : un renvoi « Art. 54.1 » doit devenir le `ctRef` `'54-1'` (chaîne),
**jamais** `54`. Le lien se construit `#art-${ref}` et `prettyRef` le réaffiche « 54.1 ».

### 3. Les index citent d'autres lois dans le libellé — ne les prends pas pour des renvois

L'index du Moniteur n° 41 est **déjà partitionné** par texte (¶5 première partie, ¶141 deuxième,
¶173 troisième) : chaque entrée appartient sans ambiguïté à un document, il n'y a donc pas de
routage à inventer. En revanche une regexp naïve `art\.\s*(\d+)` y récolte des numéros qui
n'appartiennent pas au décret indexé :

- ¶8 « Abrogation (Décret du 31 janvier 1989 ; **art. 75 et s. du Code de Commerce** ;
  dispositions contraires) — Art. 57, 58 » → seuls **57 et 58** sont des `ctRefs` ;
- ¶94 « Loi du 14 mai 2012 … — Art. 7 (1°), 47 (**renvois aux art. 178 et 180** …) » → seuls
  **7 et 47**.

De même, les indices d'item — « Art. 27 (3°, 4°) », « Art. 11 (1° e) » — ne sont pas des
articles. **Le séparateur est le tiret cadratin** : ce qui précède « — » est le sujet, ce qui
suit est la localisation. Découpe là-dessus, et sur rien d'autre.

L'index du décret du 5 juin est d'une autre forme : un **tableau à trois colonnes**
(Mot-clé / Localisation / Contexte) aplati en paragraphes, **38 entrées de 3 ¶** (¶9 à ¶122),
suivi d'une « II. Table de concordance par article » (article → mots-clés) et d'observations
d'ensemble. Ses localisations visent souvent des parties **sans ancre** — « Cons. 1 », « Vu 1 »,
« Préambule final », « Art. 2, al. 3 ». Seuls les « Art. N » deviennent des `ctRefs` ; le reste
demeure dans le `subject` ou dans le texte de l'entrée. Ne fabrique pas d'ancre pour un visa.

## Sommaire et menu : la contrainte qui décide de tout

Dans les corps, les têtes de division sont **nues**, le titre est sur la ligne suivante :

```
¶25 CHAPITRE Iᵉʳ
¶26 DE L’OBJET ET DU CHAMP D’APPLICATION
…
¶39 Section 1ʳᵉ
¶40 De l’agrément des intermédiaires de change
```

Or `segmentAnnotated` apparie `toc.label` à une **ligne exacte du corps, dans l'ordre**. Donc :

- `toc` → les lignes nues : « CHAPITRE Iᵉʳ », « Section 1ʳᵉ », « CHAPITRE II »… ;
- `navToc` → les libellés composés du sommaire fourni, qui se lisent bien :
  « CHAPITRE II — DE L'AGRÉMENT (art. 6 à 17) », « Section 1ʳᵉ — De l'agrément des intermédiaires
  de change (art. 6 à 13) ».

C'est la leçon du Code d'instruction criminelle, où 45 libellés sur 67 joignaient deux lignes et
aucun ne s'appariait. Attention aussi : le corps répète « Section 1ʳᵉ » et « Section 2 » sous
plusieurs chapitres — l'appariement étant ordonné, cela fonctionne, mais **compte les entrées**
(intermédiaires : 7 chapitres + 8 sections = 15 ; affichage : 5 sections ; transfert : aucune).

Le décret du 5 juin n'a **aucune division** : cinq articles à la suite. Son sommaire décrit des
rubriques — « Intitulé et autorité », « Visas (6) », « Considérants (5) », « Dispositif »,
« Clausule et signatures » — qui ne sont pas des lignes du corps. Laisse `toc: []` (le tableau
vide suffit à faire apparaître la barre latérale, `parseAnnotations` n'exige qu'un `Array`) et
mets les cinq articles au `navToc`.

Ce sommaire-là est lui aussi un **tableau aplati**, par groupes de trois paragraphes : rubrique,
puis « intitulé p. 17 », puis description. Les repères de page (17 à 20) sont ceux du journal
officiel — ils enrichissent utilement les libellés du `navToc`, mais ne sont pas des ancres.

Contrôle avant écriture : **toute ancre du `navToc` existe dans la page rendue.**

## Index : la forme attendue

`IndexEntry { subject, ctRefs, docRefs? }` — `docRefs` est bien rendu, par `IndexPanel`
(`CodeSidebar.tsx:294-360`), sous forme de liens `/doc/{id}#{anchor}`. Cibles mesurées :

- intermédiaires de change : **116 entrées** ;
- affichage des prix : **20 entrées** ;
- maisons de transfert (5 juin) : **38 entrées**.

Les **12 entrées de la troisième partie** — « Avis et Lignes directrices de la BRH aux agents de
change du 14 décembre 2020 », qui renvoient à des « points » et à cinq annexes — **n'ont aucun
document d'accueil** : ce texte n'est pas au corpus (vérifié ; une recherche sur « directrices »
ne ramène que des arrêtés de pension où le mot désigne des directrices d'école). Ne les invente
pas une cible. Deux options, à trancher et à dire : les écarter, ou les porter en entrées du
décret sur les intermédiaires avec le seul `subject` et zéro renvoi. **Signale-le dans la note de
livraison** : c'est un texte à récupérer.

L'index du 5 juin, lui, cite abondamment le décret de 1989 qu'il modifie (« Articles 2, 3, 4, 7,
8, 9, 10 et 17 du Décret du 6 juillet 1989 ») : c'est là, et là seulement, que `docRefs` vers
`CC_VANDAL_II-K` a un sens.

## Les abrogations à porter

Trois, toutes vérifiées sur le texte :

1. **Décret du 5 juin 2020, art. 1er** rapporte les articles **2, 3, 4, 7, 8, 9, 10 et 17** du
   décret du 6 juillet 1989 — les huit existent et sont ancrés dans `CC_VANDAL_II-K`. Pose
   `status: { 'art-2': 'abrogé', … }` sur ce document, plus un `connexe` renvoyant au décret de
   2020 par `docId`. Patron : la loi de filiation ou le décret sur les régimes matrimoniaux.
2. **Décret sur les intermédiaires de change, art. 57** : « Le présent Décret abroge le Décret du
   31 janvier 1989 déterminant les conditions d'exercice de la profession d'agent de change ainsi
   que les articles 75 et suivants du Code de Commerce po[ur…] ». Le décret de 1989 est
   `CC_VANDAL_I-B-2` — abrogation **totale**, à porter sur le document. Lis l'article 57 en
   entier avant de traiter le Code de commerce : l'abrogation y est **sectorielle**, limitée à un
   objet, et se traite alors comme l'écartement des art. 1484-1549 du Code civil par le décret
   sur le bail professionnel — un encadré, **pas** un statut « abrogé ».
3. **Article 58** : clause abrogatoire générale. Elle ne se porte sur rien — aucune cible nommée.

**Ne réécris aucun texte de 1989.** Le statut et le renvoi suffisent : une abrogation n'est pas
une réécriture.

## Un lien réciproque à poser

La **Circulaire BRH n° 127 « Intermédiaires de change »** (`cmqbnm0eb001bsmfzfiddjilj`, Port-au-
Prince, 13 janvier 2022) est prise « en application … des articles 6 à 13 du décret du
25 novembre 2020 sur les intermédiaires de change » et cite ses articles 2 et 11. Relie les deux
documents dans les deux sens. ⚠️ Ce n'est **pas** le texte du 14 décembre 2020 de la troisième
partie de l'index — ne les confonds pas.

## Exécution

Un script re-jouable par document dans `scripts/`, **simulation par défaut**, `--apply`,
`--voir=N`. Données parsées versionnées sous `scripts/data/change-transfert-2020/`. Avant
d'écrire, il doit vérifier :

- **la cible, par `source`, jamais par le titre** — « affichage » ramène quatre documents, dont
  deux fiches d'Index du Moniteur et une circulaire BRH ;
- **idempotence** : ces trois documents n'ont aujourd'hui aucune annotation ; refuser d'écraser
  un `annotationsJson` non vide sans `--force` (`CC_VANDAL_II-K` et `CC_VANDAL_I-B-2`, eux, en
  ont un : là, **fusionne**, n'écrase pas) ;
- que chaque entrée de `toc` s'apparie à une ligne du corps — compte les blocs `kind:'section'`
  et compare à `toc.length` ;
- **aucune ancre d'article perdue** par rapport à l'état actuel, et les deux gagnées à
  l'affichage : compter `b.anchor && !b.noAnchors` — `segmentAnnotated` ne retire pas une ancre
  répétée, il pose `noAnchors`, et compter `b.anchor` seul fait passer des muets pour des ancrés ;
- zéro ancre morte dans `navToc`, zéro `ctRefs` vers un article inexistant, zéro `docRefs` vers
  une ancre absente du document cible.

⚠️ **N'ajoute jamais `kind: 'connexe'` à une entrée de `toc`** : `inAnnexe`, dans
`annotated.ts:244`, est un verrou à sens unique — il passe à `true` et n'est jamais remis à
`false`, et tout ce qui suit perd son ancre.

Écriture en transaction avec `audit()`, et **`searchText` recalculé** par `buildSearchText` : il
n'est reconstruit que par les routes d'administration, une écriture directe le laisserait en
arrière.

## Vérification

Par le **chemin de rendu réel** — un test `vitest` `.tsx` rendant `<AnnotatedText>` avec les
props que `doc/[id]/page.tsx` passe pour ces sources. Contrôle nommément :

- au décret sur l'affichage, `#art-1` et `#art-2` désignent **les articles 1er et 2**, plus les
  intertitres ; les cinq sections sont des blocs de section ;
- au décret sur les intermédiaires, les 60 ancres sont intactes et `art-54-1` / `art-54-2` sont
  distinctes ;
- l'index latéral s'affiche et ne produit aucun lien mort ;
- sur `CC_VANDAL_II-K`, les huit articles portent la pastille « Abrogé » et le renvoi au décret
  de 2020 — et les treize autres ne la portent pas.

Puis consigne la livraison, commite, pousse, et rapporte : ce qui a changé document par document,
ce que tu as tranché, et ce que tu n'as pas pu faire.
