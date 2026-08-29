# Marchés publics — le graphe, les pastilles, les renvois, l'Index

Relevé du **27 août 2026**. Tâche 3 du prompt d'exécution (§ 6, § 7, § 8.5, § 8.6).
Tout ce qui suit est **mesuré** sur les corps préparés du dépôt et, pour l'Index, par
`SELECT` seul en base de production. **Aucune écriture.** `--apply` n'a pas été lancé.

Fichiers produits, tous dans `scripts/data/marches-publics/` :

| Fichier | Contenu |
|---|---|
| `graphe-construire.py` | le constructeur — **aucune clause n'y est retapée** : chacune est extraite du corps par une sentinelle, et la construction échoue si la sentinelle n'apparaît pas exactement une fois |
| `graphe-crossrefs.json` | **72 arêtes**, chacune avec sa clause citée mot pour mot, son fichier, sa ligne, son md5, et la justification de son `kind` |
| `graphe-pastilles.json` | les 2 statuts de document, les 3 articles à pastille, les replis (`oldVersions`) et les `ArticleVersion`, avec les deux états de chaque texte et leur md5 |
| `graphe-index.json` | les rattachements à l'Index du Moniteur, résolus **en deux temps**, ids contrôlés un à un en base |

Recompter : `python3 scripts/data/marches-publics/graphe-construire.py`.

---

## 1. Le graphe en un coup d'œil

**72 arêtes** : `ABROGE` 4 · `MODIFIE` 4 · `CITE` 64.
**13 renvois en clair** vers **8 cibles distinctes** hors corpus · **0 lien mort** ·
**0 arête en double** · **0 arête sans clause citée**.

Le degré de chaque texte est dans `graphe-crossrefs.json` (`degres`). Deux valeurs méritent
d'être lues comme des constats, pas comme des trous :

- **loi-mère : 21 arêtes entrantes.** Vingt-et-un des vingt-quatre autres textes la visent
  nommément. Les trois qui ne la visent pas sont mesurés, et chacun pour une raison :
  le décret de 2004 lui est **antérieur** ; le modificatif du 9 décembre 2020 ne vise que
  l'arrêté qu'il modifie et la Charte ; l'arrêté CCAG de 2011 **n'a pas de visas du tout**.
- **texte n° 7 (CCAG 2011) : 0 arête sortante, 4 entrantes.** La page 2 du Moniteur manque au
  scan source — ni en-tête, ni visas, ni premiers considérants. Il n'y a rien à citer. Ne pas
  « compléter » (§ 4.3 du prompt, interdit n° 15).

### Les huit arêtes qui affirment quelque chose

| # | De | Vers | `kind` | La clause, et où elle est |
|---|---|---|---|---|
| A01 | Loi du 10 juin 2009 | Décret du 3 déc. 2004 | **ABROGE** | art. 99 de la Loi — dispositif, cible **nommée** |
| A02 | Loi du 10 juin 2009 | Loi du 16 sept. 1953 *(absente)* | **ABROGE** | art. 99, même clause |
| A03 | Loi du 10 juin 2009 | Arrêté du 4 déc. 2006 *(absent)* | **ABROGE** | art. 99, même clause |
| A04 | Arrêté du 9 déc. 2020 | Arrêté modalités 2009, **art. 227** | **MODIFIE** | art. 2 du modificatif — rédaction nouvelle entre guillemets |
| A04b | Arrêté du 9 déc. 2020 | Arrêté modalités 2009, **art. 227-1** | **MODIFIE** | même art. 2 |
| A05 | Arrêté du 9 janv. 2019 | Arrêté du 30 août 2017 *(absent)* | **MODIFIE** | art. 1ᵉʳ — « porte révision de » |
| A06 | Arrêté du 12 févr. 2020 | Arrêté du 9 janv. 2019 | **ABROGE** | art. 15 — « remplace », cible nommée |
| A07 | Décret du 21 oct. 2021 | Arrêté du 12 févr. 2020, **art. 2** | **MODIFIE** | art. 16.1 al. 2 — « annule et remplace la définition » |

Les 64 autres sont des `CITE` : visas, considérants, renvois d'application, fondements.

### Ce qui n'est PAS une abrogation — et pourquoi le graphe ne le dit pas

- **Art. 97 de la Loi** : il *maintient* le décret de 2004 « applicable[…] aux marchés et
  avenants déjà approuvés ». C'est une clause de **transition**. Le relevé du 27 août au
  matin fondait l'arête A01 dessus ; c'est **corrigé** : l'acte est l'article 99.
- **Le considérant de la Loi** nomme lui aussi le décret de 2004 : c'est le motif, jamais l'acte.
- **Arrêté du 25 mai 2012** : mesuré, il n'a **aucune** clause d'abrogation — son art. 8 est
  une clause d'exécution. Il ne remplace l'arrêté du 5 septembre 2009 qu'**en fait** (A10).
- **Arrêté du 1ᵉʳ juin 2022** : son art. 10 « rapporte tout Arrêté […] contraire » sans nommer
  personne ; c'est le considérant qui nomme l'arrêté de 2012. Donc `CITE` + note (A08, A09).
  `ABROGE` serait une décision d'éditeur — **§ 13.3, non tranchée**.
- **Arrêté du 21 octobre 2021** : il porte lui aussi, à son **art. 8**, une clause générique
  (« rapporte tout autre Arrêté ou disposition d'Arrêté qui lui est contraire ») — que le
  relevé n'avait pas notée. Elle ne nomme personne et ne change aucun `kind` ; son art. 6, lui,
  **maintient expressément** les seuils d'intervention de 2012 (A11).
- **Arrêté composition CMMP/CSMP** : « compléter l'Arrêté du 26 octobre 2009 » est dans un
  **considérant**, et son dispositif ne réécrit aucun article. `CITE` (A12).

### Les deux ancres d'une arête — piège évité

`CrossRef.toAnchor` désigne un article **du document visé**. L'article où la clause est
*écrite* appartient au document **source** : il n'entre pas dans `toAnchor`, il est nommé dans
la note. Le premier jet les confondait — un `toAnchor: 'art-99'` sur l'arête A01, qui vise le
décret de 2004, aurait ouvert la fiche du décret sur **son** article 99. Le constructeur porte
désormais deux champs distincts et **deux gardes séparées** : `toAnchor` doit exister chez la
cible, `ancre_de_la_clause_chez_la_source` chez la source.

> Le piège n'est pas théorique : mesuré, le décret de 2004 **a** un article 99 — il fixe le
> délai de sept jours ouvrables dans lequel la CNMP rend sa décision sur une contestation.
> Le lecteur serait tombé là, sans rien qui le prévienne.

---

## 2. Les pastilles et les replis

### 2.1 Deux documents entrent ABROGE

| Texte | Abrogé par | Clause |
|---|---|---|
| **n° 1** — Décret du 3 décembre 2004 | Loi du 10 juin 2009 | art. 99, cité en entier dans la note de fiche |
| **n° 16** — Arrêté du 9 janvier 2019 | Arrêté du 12 février 2020 | art. 15, cité en entier |

Les deux cibles sont au corpus : **liens résolus**, pas de libellé sec. La note du décret de
2004 dit aussi ce que l'article 97 conserve — sans quoi la fiche laisserait croire que le
texte est mort d'un coup le 12 juin 2009.

### 2.2 Trois articles portent une pastille

**(a) et (b) — Arrêté modalités 2009, art. 227 et 227-1.** Pastille « modifié », rédaction
2020 affichée, rédaction 2009 repliée, `ArticleVersion` ×2 par article (`MODIFIE` seq 0,
`EN_VIGUEUR` seq 1). Ancres `art-227` et `art-227-1` — **présentes** dans le corps préparé
(`prep-02-arr-modalites-2009.json`, 387 labels).

⚠️ **Un constat qu'il fallait mesurer, pas supposer.** La rédaction nouvelle est citée
*entre guillemets* par le modificateur. Portée telle quelle dans `ArticleVersion.body`, la
chaîne du lecteur (`applyAmendments` puis `LEAD_ART`) affiche une **tête en double** :

```
verbatim  →  Article 227.- « Article 227.- Le Comité de Règlement des Différends…
             Article 227-1.- « Article 227.1.- Les membres du Comité…     ← les deux graphies empilées
payload   →  Article 227.- Le Comité de Règlement des Différends…
             Article 227.1.- Les membres du Comité…                        ← badge « Article 227-1 »
```

`applyAmendments` ne reconnaît pas une tête d'article derrière un guillemet et rajoute la
sienne. Les deux états sont donc fournis, avec leur md5 : le **verbatim** (qui reste dans la
note du CrossRef et, intact, dans le corps du modificateur) et le **payload** — obtenu par le
retrait du `«` ouvrant et du `»` fermant **de bord**, et de rien d'autre. Le constructeur le
prouve : hors guillemets et blancs, les deux états sont le même texte, caractère à caractère.
Ce n'est pas une normalisation de citation ; le modificateur n'est pas touché.

Les replis suivent la convention de la maison (`_apply-notariat-overlays.ts`) : la tête
« Article 227.- » est retirée du texte replié, le libellé étant affiché à part. La
réversibilité est vérifiée par assertion (le payload est un suffixe exact du verbatim).

**(c) — Arrêté défense 2020, art. 2 : pastille + note, SANS substitution.**
La clause ne remplace que « la définition ». Or l'article 2 de l'arrêté de 2020 porte, après
sa phrase de définition, une énumération de **DOUZE** catégories.

> ⚠️ **Divergence mesurée avec le § 7 du prompt**, qui en annonce onze. Onze est le compte de
> la rédaction de **2019** ; l'arrêté de 2020 a inséré « 11) Les marchés publics de
> l'électricité » et repoussé l'ancienne 11ᵉ en 12ᵉ position. Vérifié item par item sur les
> deux corps. La question § 13.4 porte donc sur **douze** catégories.

Substituer tout emporterait la liste ; ne substituer que la première phrase suppose qu'elle
survit. Aucune des deux lectures ne se déduit du texte : **rien n'est substitué**, ni
`oldVersions`, ni `ArticleVersion`. Seulement la pastille et une note qui expose la clause.

### 2.3 Les statuts que le script ne pose pas

| Texte | Défaut retenu en l'absence de décision |
|---|---|
| n° 8 (seuils 2012) et n° 22 (seuils 2021) | `EN_VIGUEUR` + note citant l'art. 7-1 de 2022 — **jamais `ABROGE`** (§ 11.8) |
| n° 17 (nomination CNMP 2019) | **non versé** sans décision (§ 13.2) — l'arête `F17` qui le relie à la loi tombe avec lui |

---

## 3. Les renvois laissés en clair — jamais en lien

Treize arêtes visent un texte absent du corpus. `toId`, `toType` et `toNumber` sont **tous
nuls** ; la désignation vit dans `toLabel`, la note dit pourquoi et donne, quand elle existe,
la référence Moniteur. `resolveCrossRefs` les rend `pending` : affichés en texte, sans lien.

| Cible absente | Citée par | Existe à l'INDEX ? |
|---|---|---|
| Loi du 16 septembre 1953 sur l'adjudication | Loi 2009 (art. 99) ; Décret 2004 (visa) | non repérée |
| Arrêté du 4 décembre 2006 (seuils) | Loi 2009 (art. 99) | LM2006-117 |
| Arrêté du 5 septembre 2009 (seuils) | textes n° 2, 3, 5, 6, 8 — **cinq visas mesurés** | LM2009-95 |
| Arrêté du 30 août 2017 (défense) | texte n° 16 (art. 1ᵉʳ) | LM2017-143 |
| Circulaire n° 008 du 5 septembre 2022 | Circulaire 010, deux fois | non |
| Arrêté du 21 déc. 2012 (documents standards) | art. 240 de l'arrêté modalités | LM2013-SP1 |
| les sept autres arrêtés du 10 mai 2011 | visas de la Charte (les dix, énumérés) | LM2011-SP3 |
| Décret du 23 octobre 1989 | Décret 2004 (visa) | LM1989-91 |

> ⚠️ **Une entrée d'INDEX n'est pas le texte.** Ces numéros sont cités **dans la note**, en
> clair. Les poser en `toType`/`toNumber` serait pire qu'un lien mort : voir § 4.3.

---

## 4. L'Index du Moniteur

### 4.1 La résolution en deux temps, et la preuve qu'elle est nécessaire

Cardinaux **mesurés en base** pour `number` + `type = 'INDEX'` :

```
LM2005-12   1     LM2011-SP3   4     LM2013-3     4     LM2021-SP8    7
LM2009-SP10 3     LM2012-93    8     LM2017-143   3     LM2009-95     5
LM2012-104  1     LM2019-SP3   1     LM2020-SP1   1     LM2006-117    6
LM2019-221  0     LM2021-SP52  0     LM2022-SP15  0
```

Un numéro du Moniteur désigne un **fascicule**, pas un acte : LM2012-93 porte huit lignes
(dont six nominations et les marques de fabrique), LM2017-143 en porte trois (dont une
naturalisation). D'où : (1) restreindre par `number` + `type`, (2) **désigner par `id`**, et
relire le `titleFr` pour contrôler. Les **21 ids du relevé ont été vérifiés un par un** en
base : tous existent, tous en `type = INDEX`, `source = MONITEUR`, avec le `number` et le
titre attendus.

### 4.2 Ce que le relevé du 27 août ne portait pas, ou portait à tort

- **LM2019-SP3 — id retrouvé.** Le relevé rangeait cette entrée en « connexe » sans son id ;
  elle est pourtant la publication du texte n° 16. Une seule ligne INDEX :
  `271b0f4a-f612-4339-b0b9-334374d20056`.
- **Tomes 2011 — l'appariement est désormais MESURÉ, et il corrige le relevé.**
  Le rattachement se fait sur le **dispositif** de chaque arrêté, jamais sur la couverture ni
  sur le nom de fichier :

  | Texte | Ce que son article 1ᵉʳ sanctionne | Entrée INDEX |
  |---|---|---|
  | n° 5 | « le dossier d'appel d'offres standard pour la réalisation de travaux » | **Tome I**, item 1 |
  | n° 6 | « le dossier de demandes types de propositions pour des services de consultants et modèles de contrats » | **Tome III**, item 1 |
  | n° 7 | « le Cahier des clauses administratives générales (CCAG) applicables aux marchés publics de fournitures, de services, d'informatique et de bureautique » | **Tome IV**, item 3 |
  | — | — | **Tome II** : aucun fichier du lot |

  Le relevé proposait le **Tome II** pour le texte n° 7 : c'est faux. Le Tome II porte les CCAG
  des concessions et des prestations intellectuelles, pas celui des fournitures. Le § 13.5
  demandait « quel appariement Tome ↔ fichier » : la réponse factuelle est ci-dessus ; ce qui
  reste à Me Vaval est de la **confirmer** et de décider du sort des annexes et des sept
  autres arrêtés.
- **Le miroir INDEX se contredit sur la date de 2012.** Le titre de l'entrée LM2012-93 renvoie
  à « la Reproduction […] dans **LM2012-104 du vendredi 29 juin 2012** », alors que la
  `publicationDate` de LM2012-104 vaut **2012-06-28** en base. Le fac-similé, lu au contrôle
  adverse, porte le 29 juin. Trois pièces sur quatre disent le 29 ; la quatrième est le champ
  à corriger — **c'est une écriture, donc § 13.7**. Le rattachement, lui, n'en dépend pas.
  *(Le titre de LM2012-93 porte aussi « erreur matèrielle », accent grave — sic du miroir.)*

### 4.3 Les interdits qui s'appliquent ici

- **Jamais de `toType` + `toNumber` sur un numéro de fascicule.** `resolveCrossRefs`
  (`src/lib/legislation/refs.ts`, `pickBest`) choisit alors « le meilleur » candidat selon le
  statut puis la date : sur LM2017-143, il pourrait désigner l'arrêté de naturalisation. Le
  constructeur refuse toute arête qui porterait ces champs.
- **Les deux faux amis restent dehors** : LM1974-79 (droits communaux perçus par tickets) et
  LM1996-15 (arrêté communal de Port-au-Prince) — des marchés **physiques**.
- **Aucun rattachement fabriqué** pour les six Spéciaux 2017, LM2019-221, LM2021-SP52,
  LM2022-SP15 et la Circulaire 010 : **0 ligne, mesuré numéro par numéro**. Le miroir porte
  bien des Spéciaux 2017 (SP1 à SP17, puis SP27, SP29, SP30) — mais aucun des six qui nous
  intéressent : SP25, SP26, SP28, SP31, SP35, SP42. La lacune est ciblée, pas une simple
  troncature de série.
- **Chaînes d'erratum : deux entrées pour un texte**, rattachées des deux côtés — loi-mère
  (LM2009-60 + LM2009-78) et seuils 2012 (LM2012-93 + LM2012-104). La reproduction est la
  référence affichée.

---

## 5. Les constats à porter au rapport de livraison

1. **Douze catégories, pas onze**, à l'art. 2 de l'arrêté défense 2020 (§ 2.2 ci-dessus).
2. **La Circulaire 010 cite l'arrêté du 9 décembre 2020 *composition* (n° 20), pas le
   modificatif des art. 227/227-1 (n° 19).** Deux arrêtés portent cette date ; la Circulaire
   renvoie aux « articles 4 et 6 de l'Arrêté du 9 décembre 2020 précité » — or le modificatif
   n'a que **trois** articles (mesuré : `prep-19` a trois labels, `prep-20` en a dix). Le
   renvoi ne peut viser que le n° 20, et la Circulaire le nomme d'ailleurs en toutes lettres
   par son objet. Un CrossRef vers le n° 19 aurait été un faux lien.
3. **La Circulaire 010 nomme aussi, par son objet, l'arrêté des procédures célères** (n° 11,
   Spécial n° 26) : renvoi résolu, pas un renvoi collectif à la série 2017.
4. **§ 13.10 — l'énigme de l'art. 7-1, éclairée sans être tranchée.** Le **visa** de l'arrêté
   du 1ᵉʳ juin 2022 désigne l'arrêté de 2021 *correctement* (« … en dessous des seuils
   d'intervention de la CNMP ») ; son **art. 7-1** le désigne sous l'intitulé de celui de 2012.
   Le même texte porte donc les deux désignations. C'est un élément pour Me Vaval, pas une
   conclusion : le CrossRef se résout sur le texte n° 22, la citation reste verbatim, et la
   note dit l'écart.
5. **Le « bloc Donné » se compte sur sa phrase entière, pas sur `^Donné`.** Le contrôle du
   § 8.3 tombe à faux sur le Spécial 35 : le fichier contient « Données de bilan des trois
   derniers exercices » et « Données des comptes de résultats » dans le DAO annexé. Le motif
   doit être `Donné au Palais National` / `Donné à Port-au-Prince`. Mesurés ainsi : un bloc
   par acte partout, deux dans la Charte (Delmas + Charte), neuf dans le Spécial n° 8, deux
   dans le Spécial 52, **trois dans la loi-mère** (Sénat 4 juin · Chambre 10 juin · Palais
   National 12 juin), zéro dans la Circulaire 010.
6. **Deux textes visent « la Loi du 10 Juin 2009 » avec une majuscule à Juin** (n° 2 et n° 3) :
   sic conservé, et il fait tomber tout motif de recherche insensible à ce détail.
7. **Le texte n° 7 n'a aucun visa** — la page 2 du Moniteur manque au scan source : il n'a donc
   pas d'arête de fondement vers la loi, et il ne faut pas lui en fabriquer une. De même le
   n° 19 ne vise pas la loi-mère : il ne vise que l'arrêté qu'il modifie et la Charte.
8. **Apostrophes, mesurées par corps** — aucun fichier n'est mixte, sauf un :
   `prep-07-arr-ccag-2011-corps.txt` porte **20 courbes et 6 droites**. Les corps des textes
   n° 2 et n° 19 sont tous deux en apostrophes **courbes** : la rédaction de 2020 s'insère dans
   l'arrêté de 2009 sans conversion. Ceux des n° 18 et n° 21 sont tous deux en **droites**.
9. **Deux copies rivales des mêmes sources coexistent dans le dépôt** :
   `piece-NN-*.txt` (manifeste d'empreintes) et `prep-sources/txt-NN-*.txt` (entrée du
   préparateur du lecteur). Contenu **identique** hors lignes vides — vérifié : sur le Spécial
   n° 8, 497 lignes contre 484, et les 472 lignes non vides sont les mêmes, dans le même ordre.
   Aucun écart de texte, mais **les numéros de ligne diffèrent** : toute citation par numéro de
   ligne doit dire à quel fichier elle se réfère. Les clauses de `graphe-crossrefs.json` citent
   les `prep-NN-*-corps.txt` — les corps qui seront versés.
10. **Un fichier hors des 28** traîne dans le dossier de travail : une re-extraction rivale de
    l'arrêté défense du 12 février 2020, rangée en `hors-liste/`. Elle n'est **pas** l'un des
    six écartés du § 4.1 et n'a **pas** été arbitrée. À signaler, à ne pas verser.

---

## 6. Ce qui reste à Me Vaval — rien n'a été tranché

| § | Question | Ce que la mesure apporte |
|---|---|---|
| 13.2 | Verser l'arrêté de nomination n° 221 ? | inchangée |
| 13.3 | Statut des seuils 2012 et 2021 | le n° 22 a **aussi** une clause générique (art. 8) ; aucune ne nomme personne |
| 13.4 | Étendue de la modification de l'art. 2 du défense 2020 | la liste compte **douze** catégories, pas onze |
| 13.5 | Appariement Tome ↔ fichier | **mesuré** : I→n° 5, III→n° 6, IV→n° 7, II sans fichier — à confirmer |
| 13.7 | Corriger la `publicationDate` de LM2012-104 ? | le miroir se **contredit lui-même** (titre de LM2012-93 = 29 juin) |
| 13.10 | Un second arrêté du 21 octobre 2021 ? | le **visa** du même arrêté de 2022 désigne correctement celui de 2021 |
| 13.1 · 13.6 · 13.8 · 13.9 · 13.11 | — | inchangées |
