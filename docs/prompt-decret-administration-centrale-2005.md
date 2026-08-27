# Prompt — Verser le Décret sur l'Administration Centrale de l'État (2005), son amendement de 2016, leurs sommaires et leurs index

## Ce qui est demandé

Verser en **Législation annotée → Droit public & administratif** :

1. le **Décret du 17 mai 2005 portant organisation de l'Administration Centrale de l'État**,
   avec son sommaire et son index de mots-clés ;
2. le **Décret du 6 janvier 2016 portant amendement** du précédent, avec son sommaire et
   son index ;
3. les **amendements et abrogations en pliables**, article par article, sur le modèle du
   Code civil (`ArticleVersion`, overlay, lecture allégée).

Six fichiers, tous dans `~/Downloads/` :

```
Decret_Administration_Centrale_Etat_2005.docx                        33 843 o
Sommaire_Decret_Administration_Centrale_Etat_2005.docx               10 286 o
Index_Mots_Cles_Decret_Administration_Centrale_Etat_2005.docx        11 009 o
Decret_6_janvier_2016_amendement_Administration_Centrale_Etat.docx   14 376 o
Sommaire_Decret_6_janvier_2016.docx                                  10 945 o
Index_mots_cles_Decret_6_janvier_2016.docx                           11 419 o
```

---

## §1 — L'état des lieux, mesuré

| | Décret 2005 | Décret 2016 |
| --- | --- | --- |
| Source | Le Moniteur, 160ᵉ Année – **Spécial No. 8**, mardi 27 septembre 2005 | Le Moniteur, 171ᵉ Année – **No. 21**, lundi 1ᵉʳ février 2016 |
| Signé le | 17 mai 2005 | **6 janvier 2016** (publié le 1ᵉʳ février) |
| Président | — (à relever au préambule) | Michel Joseph MARTELLY |
| Lignes / caractères | 619 · 80 042 | 161 · 12 357 |
| **Articles** | **216** | **3** |
| Structure | 6 TITRE · 12 CHAPITRE · 15 Section · 12 Sous-Section | aucune |

Le décret de 2005 compte **1 à 174 sans aucun trou**, plus 42 articles subordonnés — voir §2.

---

## §2 — ⚠️ TROIS CONVENTIONS DE NUMÉROTATION DANS UN SEUL TEXTE

C'est le piège principal, et il coûte cher si on le manque.

| Forme | Nombre | Exemples |
| --- | --- | --- |
| Entière | **174** | `Article 1er.-` … `Article 174.-` |
| **Décimale** | **37** | `19.1`, `26.1` à `26.6`, `29.1`, `31.1`, `37.1`, `38.1`, `40.1` à `40.6`, `95.1`, `135.1` à `135.3`, `138.1`, `138.2`, `140.1` à `140.6`, `142.1`, `145.1` à `145.4`, `147.1`, `166.1`, `166.2` |
| **À TIRET** | **5** | `163-1`, `163-2`, `163-3`, `169-1`, `169-2` |

> ⚠️ **UN ANALYSEUR QUI NE CONNAÎT QUE `N` ET `N.M` PERD CINQ ARTICLES EN SILENCE.**
> `Article 163-1.-` sera lu comme une seconde tête de l'article 163 : les cinq textes à
> tiret disparaissent, et l'article 163 hérite d'un corps qui ne lui appartient pas. Un
> premier comptage a d'ailleurs annoncé « 17 articles en double » — c'était cet artefact,
> et il n'y a **aucun doublon réel** dans le fichier.

L'expression régulière doit donc accepter les trois formes :
`/^Article\s+(\d+(?:er)?(?:[.-]\d+)?)\s*\.?-/`

⚠️ **Les ancres doivent distinguer `163-1` de `163.1`.** La plateforme écrit déjà
`#art-39-1` pour les décimaux du décret minier : `163-1` et `163.1` y produiraient la
**même ancre**. Ils ne coexistent pas dans ce texte, mais la règle de conversion doit être
écrite et testée, sans quoi le premier texte qui les mêlera cassera sans bruit.

---

## §3 — ⚠️ LE PIÈGE D'HOMONYMIE : « Décret du 6 janvier 2016 » EXISTE DÉJÀ EN BASE

```
id       cms6bhd33000311j6wepdkkqa
number   « Décret du 6 janvier 2016 »
source   DECRET_ADMINISTRATION_ELECTRONIQUE_2016
titre    Décret du 6 janvier 2016 reconnaissant le droit de tout administré à
         s'adresser à l'administration publique par des moyens électroniques
paru     Le Moniteur, 171e Année, No. 20 du 29 janvier 2016
thèmes   Droit public & administratif · Administration centrale de l'État
```

**Deux décrets différents, signés le même jour, publiés dans deux numéros consécutifs du
Moniteur** (n° 20 le 29 janvier, n° 21 le 1ᵉʳ février). L'existant porte déjà, comme
`number`, l'intitulé exact que le nouveau prendrait naturellement — et il est déjà rattaché
aux deux mêmes thèmes.

> ⚠️ **NE PAS RÉUTILISER `number: 'Décret du 6 janvier 2016'`.** Deux textes sous une même
> référence, c'est le défaut qui a mis 51 fascicules de 2025 sous l'identité de leur voisin.
> Distinguer par l'objet : `Décret du 6 janvier 2016 (amendement — Administration Centrale)`,
> ou par le Moniteur : `LM2016-21`. **Décision de la rédaction à prendre avant d'écrire.**

⚠️ Vérifier aussi qu'aucun des deux décrets n'est déjà versé sous une autre source : le
thème `administration-centrale` existe et porte déjà ce document.

---

## §4 — Les amendements et abrogations, exhaustifs

L'article 2 du décret de 2016 énumère **quinze interventions** sur le décret de 2005.
Elles ont été relevées deux fois — dans le dispositif ET dans le sommaire fourni — et les
deux relevés concordent.

### RÉÉCRITS — « se lit désormais comme suit » (6)

| Article | Objet |
| --- | --- |
| **23** | Secrétariat Général de la Primature — mission de coordination, **13 attributions** |
| **64** | Unité d'Études et de Programmation |
| **71** | Direction des Affaires Administratives et du Budget — **6 attributions** |
| **72** | Direction ou Service des Ressources Humaines — **8 attributions** |
| **108** | Organes de Coordination Stratégique |
| **113** | Office de Management et des Ressources Humaines (OMRH) |

### AJOUTÉS — « Il est ajouté un article … » (4)

| Article | Objet |
| --- | --- |
| **23.1** | Structure du Secrétariat Général — Bureau et Unités |
| **23.2** | Statut des emplois — agents publics de carrière |
| **23.3** | Conseil de Gouvernement |
| **29.2** | Secrétariat Général du Conseil des Ministres (SGCM) |

> ⚠️ **`29.1` EXISTE DÉJÀ DANS LE TEXTE DE 2005.** Le 2016 ajoute `29.2` : il s'enchaîne, il
> ne remplace pas. Vérifier qu'aucun des quatre ajoutés ne heurte un article existant —
> contrôlé : `23.1`, `23.2`, `23.3` et `29.2` sont bien absents de la version de 2005.

### ABROGÉS (5)

**110, 111, 112** — puis **114, 115**, en deux phrases distinctes de l'article 2.

> ⚠️ Les articles abrogés restent **affichés et barrés**, avec leur clause d'abrogation en
> pliable — jamais supprimés. C'est la règle appliquée au Code civil et au Code pénal.

### La clause générale

L'article 3 de 2016 abroge « toutes Lois ou dispositions de Lois… contraires ».
⚠️ **Une clause balai ne s'applique à aucun article en particulier.** Elle se cite dans la
note d'édition du décret de 2016 ; elle ne produit **aucun** statut « Abrogé » sur un article
de 2005. Ne pas la faire dire plus qu'elle ne dit.

---

## §5 — Le sommaire et l'index

### Sommaire 2005 — 54 lignes, hiérarchique

Il donne la plage d'articles de chaque division : `TITRE I – DISPOSITIONS GÉNÉRALES · Art. 1 à 8`.
Il descend jusqu'à la Sous-Section et **borne certaines plages sur un article décimal** —
`Section I – De la Présidence · Art. 15 à 19.1`, `Chapitre IV · Art. 116 à 142.1`.

⚠️ **Aucun article à TIRET n'apparaît dans le sommaire** : le Chapitre I du TITRE IV est
annoncé « Art. 163 à 166.2 », ce qui englobe `163-1` à `163-3` sans les nommer. Ne pas en
conclure qu'ils n'existent pas.

⚠️ Une entrée du sommaire est **coupée sur deux lignes** (« Chapitre III – Des Structures
Transversales de Coordination / et de Consultation »). Un analyseur ligne à ligne en fera
deux divisions, dont une sans plage.

### Index 2005 — 76 lignes, alphabétique

Format `Terme — art. N, N, N`, avec lettres-vedettes (`A`, `B`, …). Il cite les décimaux
(`31.1`) **et les articles à tiret, mais au tiret** (`163-2`, `163-3`, `169-1`).

⚠️ **Couverture mesurée : 197 articles sur 216.** Quatorze ne sont jamais cités — 10, 31,
32, 33, 37, 40, 40.4, 40.5, 49, 61, 115, 130, 159, 168. C'est normal pour un index de
mots-clés ; le signaler, ne pas le « compléter » d'office.

### Sommaire et index 2016

Le sommaire 2016 a **deux parties** : le sommaire officiel du numéro n° 21 (quatre textes,
dont trois qui ne sont **pas** dans le fichier — une note du document le dit), puis la table
des dispositions du décret. ⚠️ **Ne cataloguer que le premier texte.** Les trois autres
relèvent de l'Index du Moniteur, pas de la Législation annotée.

L'index 2016 est en **trois colonnes** — Terme · Occurrences · Localisation — et non en
liste : l'analyseur du sommaire de 2005 ne le lira pas.

---

## §6 — Ce qu'il faut écrire

Deux documents `LEGISLATION`, sur le patron du Code civil et du Décret minier.

| Champ | Décret 2005 | Décret 2016 |
| --- | --- | --- |
| `source` | `DECRET_ADMIN_CENTRALE_2005` | `DECRET_ADMIN_CENTRALE_AMEND_2016` |
| `number` | à décider (§3) | **à décider — homonymie** (§3) |
| `titleFr` | Décret du 17 mai 2005 portant organisation de l'Administration Centrale de l'État | Décret du 6 janvier 2016 portant amendement du Décret du 17 mai 2005 … |
| `moniteurRef` | Le Moniteur, 160ᵉ Année – Spécial No. 8, mardi 27 septembre 2005 | Le Moniteur, 171ᵉ Année – No. 21, lundi 1ᵉʳ février 2016 |
| `publicationDate` | 2005-09-27 (**parution**, pas la signature) | 2016-02-01 |
| `status` | `EN_VIGUEUR` | `EN_VIGUEUR` |
| Thèmes | `droit-public` + `administration-centrale` (les DEUX existent déjà) | idem |

⚠️ **Distinguer la date de SIGNATURE de la date de PARUTION.** Le décret de 2005 est signé
le 17 mai et paraît le 27 septembre — quatre mois d'écart. Le titre porte la signature,
`publicationDate` porte la parution.

---

## §7 — Le lecteur annoté

Pour que les deux textes se lisent comme le Code civil, inscrire les deux sources dans :

- `HIDE_INLINE_INDEX_SOURCES` — l'index vit dans le panneau latéral, pas dans le corps ;
- `ART_REFS_SOURCES` — « l'article 23 » devient cliquable (anti-lien-mort : seul un article
  RÉEL est relié).

Les deux ensembles sont dans `src/app/[locale]/(app)/doc/[id]/page.tsx`.

⚠️ **`themeIndexJson` est le champ de l'index thématique**, distinct de l'index de mots-clés.
Le document existant du thème (`DECRET_ADMINISTRATION_ELECTRONIQUE_2016`) ne l'a pas :
ne pas s'en inspirer.

---

## §8 — Renvois croisés

Poser un `CrossRef` **réciproque** entre les deux décrets.

> ⚠️ **LE `kind` D'UN CROSSREF AFFIRME QUELQUE CHOSE.** `ABROGE` sur un renvoi qui ne fait
> que citer transforme une mention en abrogation, et la fiche l'affichera. Réserver `ABROGE`
> aux articles 110 à 112 et 114 à 115 ; tout le reste est `CITE` ou `MODIFIE`.

Le décret de 2016 vise aussi le **Décret du 17 mai 2005 portant révision du Statut Général
de la Fonction Publique** — un texte distinct, non fourni. Le noter, ne pas l'inventer.

---

## §9 — Contrôles avant de déclarer le travail fini

1. **216 articles** en base pour 2005, dont 37 décimaux et **5 à tiret** — recompter par
   forme, pas seulement le total.
2. Les **5 articles à tiret** ont un corps propre, et l'article 163 ne contient pas le leur.
3. **15 articles portent une trace de 2016** : 6 réécrits (version d'origine en pliable),
   4 ajoutés (signalés comme tels), 5 barrés et datés.
4. Les **quatre ajoutés** ne heurtent aucun article existant.
5. `29.1` (2005) et `29.2` (2016) coexistent et s'affichent dans l'ordre.
6. Aucune référence n'entre en collision avec le décret homonyme de 2016 (§3).
7. Le sommaire rend ses **6 TITRE, 12 CHAPITRE, 15 Section, 12 Sous-Section**, y compris la
   division dont l'intitulé tient sur deux lignes.
8. L'index renvoie sur des ancres qui répondent — 197 articles cités, aucun lien mort.
9. `npm test` vert, et **le contrôle visuel fait sur la fiche**, pas seulement en base.

---

## §10 — Ce que ce prompt ne tranche pas

**Une seule** décision appartient encore à la rédaction :

1. **La référence du décret de 2016** — l'homonymie du §3 ;
~~2. Le sort des trois autres textes du Moniteur n° 21~~ — **SANS OBJET, vérifié le 26 août** :
   les quatre textes du n° 21 sont **déjà à l'Index du Moniteur**, y compris les trois
   absents du fichier (RPCV, organes de la Présidence, arrêté ACRA). Rien à ajouter.
   ⚠️ Ils y étaient datés du **1er janvier 2016** au lieu du 1er février — corrigé le
   26 août (`scripts/corriger-date-index-lm2016-21.ts`). Voir §12.
~~3. Le degré de consolidation~~ — **TRANCHÉ le 26 août 2026, et pour TOUT LE CORPUS** :
   voir §11.

---

## §11 — LA RÈGLE DU CORPUS : la version en vigueur prévaut, l'ancienne se replie

**Décision de la rédaction, 26 août 2026. Elle ne vaut pas que pour ce décret : elle vaut
pour tout le corpus.**

> Un lecteur qui ouvre un article doit lire **le droit applicable aujourd'hui**, sans avoir
> à reconstituer la version en vigueur à partir d'un texte d'origine et d'une pile
> d'amendements. L'ancienne rédaction ne disparaît pas pour autant : elle se replie.

Concrètement, pour ce versement :

- le corps affiché du décret de 2005 porte, pour les six articles réécrits, **la rédaction
  de 2016** ;
- l'ancienne rédaction est en **pliable**, datée et sourcée (« Décret du 6 janvier 2016 ») ;
- les cinq articles abrogés restent **visibles, réduits et barrés**, leur texte d'origine
  au pliable ;
- les quatre articles ajoutés s'insèrent à leur rang, signalés comme ajoutés en 2016.

### ✔ Le moteur fait DÉJÀ exactement cela

`applyAmendments` (`src/lib/legislation/segment.ts`) remplace le corps de chaque article
amendé par sa version `EN_VIGUEUR` et réduit un article abrogé à une ligne ; l'ancienne
rédaction reste lisible par `AmendmentHistory`. `bodyOriginal` demeure canonique en base :
c'est une transformation d'AFFICHAGE, rien n'est détruit.

Les trois statuts d'`ArticleVersion` portent la règle, et ils sont peuplés :

| Statut | Rôle | En base |
| --- | --- | --- |
| `EN_VIGUEUR` | la rédaction qui s'affiche | 138 |
| `MODIFIE` | l'ancienne, au pliable | 132 |
| `ABROGE` | réduite, barrée, datée | 77 |

Trois textes l'emploient : **Code civil** (318 versions, 189 articles), **Code de commerce**
(15/14), **Code pénal** (14/12).

### ⚠️ DEUX TEXTES DU CORPUS NE LA SUIVENT PAS — ils consolident SANS conserver l'ancien

| Source | Passages concernés |
| --- | --- |
| `LOI_PATENTE_1996_CONSOLIDE` | **5** |
| `DECRET_CFPB_1979_CONSOLIDE` | **1** |

Ils portent l'amendement **en clair dans le corps**, sous la forme d'une note éditoriale :

> « — Article 4 Loi de Finances 2015-2016 : le troisième paragraphe de l'article 6 de la loi
> du 10 juin 1996 relative à la Patente **se lit désormais comme suit** : … »

La nouvelle rédaction prévaut donc bien, et sa source est nommée — la moitié de la règle est
tenue. Mais **l'ancienne rédaction n'est nulle part** : ni pliable, ni encadré, ni base. Elle
n'a pas été conservée au versement.

⚠️ **Les mettre en conformité suppose de retrouver les rédactions d'origine** dans les
Moniteurs de 1979, 1981 et 1996 — ce n'est pas une migration de données, c'est un travail
éditorial. À décider séparément ; six passages en tout.

### Ce qui n'est PAS une entorse à la règle

Un texte **amendant** n'a pas d'`ArticleVersion` : l'effet vit sur le texte **amendé**. Le
décret sur les sûretés, celui sur les régimes matrimoniaux, la loi de 2017 sur la signature
électronique n'en portent aucune — et c'est juste : leurs amendements sont sur le Code civil,
qui en compte 318. Ne pas les compter comme des manquements.

---

## §12 — ⚠️ 187 fascicules de l'Index portent une date fausse

Trouvé en vérifiant le sort des trois textes du n° 21 : leurs quatre entrées étaient datées
du **1er janvier 2016**, quand la manchette dit « Lundi 1er Février 2016 ». Le voisinage le
démontrait sans ouvrir le fascicule — le n° 20 est du 28 janvier, le n° 22 du 2 février : un
n° 21 au 1er janvier serait paru quatre semaines AVANT son prédécesseur.

Le 1er janvier est le **repli de l'import d'origine** quand la date n'a pas pu être lue.

| | |
| --- | --- |
| Fascicules indexés | 8 306 |
| Datés du 1er janvier | **208** |
| **Contredits par leur propre prédécesseur** | **187** |

Les 187 sont démontrablement faux : le fascicule qui les précède porte une date postérieure.
Les 21 restants peuvent être d'authentiques parutions du 1er janvier — à vérifier une à une,
pas à corriger en bloc.

Le n° 21 de 2016 est corrigé. **Les 186 autres ne le sont pas** : chacun demande qu'on relève
sa date à la source, ou qu'on l'interpole entre ses voisins. Le script du n° 21 refuse
d'écrire si la date choisie ne s'insère pas entre le fascicule précédent et le suivant — le
même garde-fou servirait à un traitement de masse.
