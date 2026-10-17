# Prompt — Code fiscal 2026 : rendre cliquables, dans le texte, les renvois aux autres textes (visas et dispositif)

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (Agora, agora.ht).
> Rédigé le 14 octobre 2026, **mis à jour le 17 octobre** avec les réponses de Me Vaval (§ 6) et
> les préalables qu'elles commandent (§ 0). Les chiffres ont été **mesurés** sur la fiche en ligne et,
> en lecture seule, sur la base de production. **Refais chaque mesure avant d'écrire** : un écart
> t'arrête.

## Le constat de Me Vaval

> « Le corps du texte n'a pas fait les cross references vers les textes en base, tels que le Code
> civil, le Code pénal, etc. »

La fiche : `CODE_FISCAL_2026`, id `cmv7ldx9r0001soj2gggluol8`, en ligne depuis le 14 oct. Elle
s'intitule « Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal ».

**Ce qui existe déjà, et pourquoi on ne le voit pas dans le texte :**
- la fiche porte **46 `CrossRef`**, écrits par `scripts/_import-code-fiscal-2026.ts` :
  - 43 `CITE`, un par visa identifié (`scripts/data/code-fiscal-2026/visas.json`) ;
  - 1 `ABROGE`, non résolu, vers le Décret de 2022 ;
  - 2 `VOIR`, vers les fascicules `LM2023-SP3` et `LM2026-SP48-A`.

  Ils ne s'affichent que **dans le bloc « Citations », en bas de la fiche** (`page.tsx`, section
  `outRefs`), jamais dans le corps ;
- **dans le corps**, le lecteur ne relie aujourd'hui que :
  - les renvois **internes** « l'article N » (`artRefs`). Ces liens marchent : 480 mentions « article(s)
    N » dans le dispositif, soit 592 numéros, presque toutes internes ;
  - les **abréviations** « C. p. c. », « C. pén. » et « C. i. c. » (`src/lib/doc/coderefs.ts`), et
    seulement pour les fiches déclarées en dur dans `page.tsx` (`CITE`/`PAR_SOURCE`) : le Code civil, le
    Code de procédure civile et ses appendices, le Code d'instruction criminelle ;
- le Code fiscal écrit les textes **en toutes lettres** (« du Code Pénal », « de la Constitution de la
  République d'Haïti », « du décret du 1er juin 2005 portant immatriculation… ») : **aucun mécanisme ne
  les relie** ;
- pire, le garde `ART_EXT_AFTER` (`src/lib/doc/artrefs.ts`) écarte **volontairement** « l'article N du
  Code X » des renvois internes. C'est juste : ce n'est pas un article du Code fiscal. Mais ce renvoi
  reste alors du texte mort.

## Ce qui est demandé

1. **Les visas.** La désignation de chaque visa identifié avec certitude devient un lien vers la fiche
   visée. Faute de fiche, le lien mène à l'entrée de l'**Index du Moniteur**, si elle est identifiée avec
   certitude (§ 2.2).
2. **Le dispositif.** Chaque mention d'un autre texte dans les articles 1 à 543 devient un lien vers ce
   texte. Quand l'article cité est précisé (« les articles 1539 et 1540 du Code Civil », « l'article 200.2
   de la Constitution »), **le numéro mène à l'article lui-même** (`#art-1539`, `#art-200-2`).
3. **Le bloc « Citations »** dit la même chose que le texte : un `CITE` par cible, avec `toAnchor`
   quand un article est visé.
4. **Le texte officiel ne change pas d'un caractère.** Seul le rendu porte les liens (§02).

---

## § 0 — Les préalables (décisions de Me Vaval du 17 octobre)

### 0.1 Code du travail : reclassé en LEGISLATION — FAIT le 17 oct.

« Le code du travail doit être dans législation annotée. Déclassez-le et rangez-le dans législation
annotée. » La rubrique « Législation annotée » liste les types `LEGISLATION` et `DOCTRINE`
(`DOC_TYPE_META.DOCTRINE.corpus`) : le Code du travail y figurait, mais seul code sous le type
`DOCTRINE`. C'est réglé par `scripts/reclasser-code-travail-legislation.ts` :
- `cmr102ish0012ttoijkh8f31e` passe en `LEGISLATION`, **même id** : favoris, notes, thèmes (174),
  versions d'articles et liens restent attachés ;
- le `CITE` du visa 14 (`toType` `DOCTRINE`) est corrigé ; les deux autres renvois vers lui étaient
  déjà justes (`LEGISLATION`, ou `null` = résolu par `toId`) ;
- `_import-code-travail.ts` crée désormais la fiche en `LEGISLATION` ;
- conséquence voulue : la fiche a maintenant le bouton « Version Word » (testé : 331 Ko, texte
  intégral) ;
- la **copie `DOCTRINE` du Code des douanes** reste telle quelle (non visée par la décision).

Pour ce chantier : le Code du travail se résout par `{ source: "CODE_TRAVAIL_ANNOTE", type:
"LEGISLATION" }`. Le lien est soumis au service Législation, comme le Code civil.

### 0.2 Visa 36 : la loi est du 24 juin 1932 — FAIT le 17 oct.

Règle de Me Vaval : « la date d'entrée effective de la loi est celle du vote de la dernière
chambre ». Le Bulletin des lois et actes de 1932 (édition officielle, p. 166-172 ; Dropbox
`Moniteur/Lois_18_20/1932-N.pdf`, p. 168-174 du PDF), lu sur l'image, porte trois dates :

| Étape | Formule du J.O. | Date |
| --- | --- | --- |
| Sénat (premier vote) | « Donné à la Maison Nationale à Port-au-Prince » | 6 mai 1932 |
| Chambre des députés (**dernier vote**) | « Fait à la Chambre des Députés, à Port-au-Prince » | **24 juin 1932** |
| Promulgation | « Donné au Palais National » | 29 juillet 1932 |

Le Moniteur n° 31 du 16 avril 1979 (Index `LM1979-31`) publie le décret sous le titre « Décret
révisant la Loi du 24 Juin 1932… ». Le Moniteur n° 76-B d'octobre 1989 et la Cassation (1976 et
1989) disent aussi 24 juin. Seule la fiche `CPC_APPENDICE_III_2_1` disait « 6 mai 1932 », la date
du Sénat. Son titre, son résumé, son appareil et le libellé du `CITE` du visa 36 sont corrigés par
`scripts/corriger-date-loi-avocats-1932.ts`. Le corps n'est pas touché (il ne porte pas la date).
La transcription du Moniteur n° 212 de 2013, qui écrit « 6 mai 1932 » dans un visa, est du J.O. :
on n'y touche pas.

### 0.3 Code pénal et Code de procédure pénale : les téléverser AVANT les renvois — À FAIRE

« Nous devons les téléverser dans législation annotée avant de faire les cross references. »

Le Code fiscal de 2026 dit « Code Pénal » et « Code de Procédure Pénale ». C'est l'appellation des
codes du 11 mars 2020, **révisés par deux décrets du 24 juin 2025**. Aucun n'a de fiche :

| Texte | Index du Moniteur | Éditions (fascicule) | Transcription |
| --- | --- | --- | --- |
| Décret révisant celui du 11 mars 2020 portant Code pénal | `LM2025-SP44`, `3951be5f-8b8e-4a9d-be2e-67a09abf63db` | `cmv5j14h0001bppxsz0njo9s2`, 184 p., PDF | **aucune** (corps de 184 car.) |
| Décret révisant celui du 11 mars 2020 portant Code de procédure pénale | `LM2025-SP44-A`, `73f7a4cc-d161-489f-a6e2-88ca755ccc12` | `cmv5j15f4001cppxsx7275lwh`, 240 p., PDF | **aucune** (corps de 186 car.) |
| Décret du 11 mars 2020 portant Code pénal (rédaction d'origine) | `LM2020-SP10`, `5e18593b-c1ac-48b9-a50e-87032d293cc8` | — | témoins Dropbox : `Moniteur/Code_Penal_2020.docx`, `Moniteur/code-penal-haiti-2022.pdf` (214 p., scan du Spécial n° 10 du 24 juin 2020) |
| Décret du 24 décembre 2025 reportant l'entrée en vigueur des codes révisés | `LM2026-SP5`, `08f069d9-35fc-49b7-8d88-67212e5b754c` | `cmqzigchq003ix374qo3hrsez`, transcrit | — |

⚠️ **Ces codes ne sont pas encore en vigueur.** Le décret du 24 décembre 2025 (Spécial n° 5 du
16 février 2026) fixe leur « entrée en vigueur intégrale » au **1er janvier 2027**, au terme de trois
phases. D'ici là :
- le Code pénal de 1835 (`CODE_PENAL_ANNOTE`) et le Code d'instruction criminelle (`CIC`) restent
  **en vigueur**. Aucune pastille « Abrogé », aucun `ABROGE` vers eux avant cette date ;
- les deux fiches nouvelles ne se présentent pas comme en vigueur. Elles mentionnent le décret de
  report et la date du 1er janvier 2027.

Chaque code est un chantier entier, du calibre du Code fiscal. Il lui faut **son propre prompt**,
sur le modèle de `docs/prompt-code-fiscal-2026.md` :
- transcription OCR combinée (Opus + Tesseract, `scripts/ocr-combine-pdf.ts`), puis collation mot à
  mot sur le fac-similé ; le J.O. fait foi à la lettre ;
- format « lecteur annoté » : Sommaire et Index latéraux, plages d'articles calculées, aucun numéro
  de page ;
- thèmes : `penal-general` (Code pénal) et `procedure-penale` (Code de procédure pénale) ;
- `number` = nature + date + objet (« Décret du 24 juin 2025 révisant celui du 11 mars 2020 portant
  Code pénal ») ; `adoptionDate` = 24 juin 2025 (date du décret) ;
- liens Éditions ↔ fiche ↔ Index, comme pour le Code fiscal.

**Ce chantier-ci (les renvois) attend que les deux fiches soient en ligne.** Ensuite :
- le `CITE` du visa 10, qui vise aujourd'hui le Code pénal de **1835**, est **re-ciblé** vers le Code
  pénal révisé. D'ici là, il affirme une citation inexacte : c'est connu, ne le « corrige » pas vers
  l'Index ;
- art. 12 (3.), 482 (×2), 485, 486, 494 → le Code pénal révisé ;
- art. 218, 489, 494 → le Code de procédure pénale révisé. **Jamais** le Code d'instruction
  criminelle.

---

## § 1 — Les règles (déjà payées sur ce corpus)

- **Un renvoi vise un TEXTE, résolu par `source` (et `type`), jamais par le titre.** Le titre ment :
  - trois fiches portent « Décret du 9 avril 2020 » ;
  - six portent « Décret du 6 janvier 2016 » ;
  - le Code des douanes a deux fiches de même `source`, une `LEGISLATION` et une `DOCTRINE`.
- **Une table FERMÉE, vérifiée ligne à ligne**, pas une heuristique au rendu : `renvois-externes.json`
  (§ 3). Seul ce qui est identifié **avec certitude** devient un lien. Le reste demeure du texte, et la
  table dit pourquoi.
- **Un lien d'article n'existe que si l'ancre existe dans la cible ET si le contenu correspond.** Ouvre
  l'article cible et vérifie qu'il dit ce que le Code fiscal lui fait dire. Jamais de lien mort.
- **Clause générale = aucun lien.** « la Loi », « la législation relative à l'urbanisme », « les lois et
  règlements », « une convention fiscale », « arrêté du Ministre… », « la Banque de la République
  d'Haïti » comme institution : rien ne les désigne. Pas de lien, pas de `CrossRef`. C'est la règle de
  la clause-balai.
- **Le `kind` d'un `CrossRef` AFFIRME.** Ce sont des `CITE`, jamais des `ABROGE` ni des `MODIFIE`. La
  `note` d'un `CrossRef` n'est lue nulle part : n'y mets aucune mise en garde.
- **L'accès suit le service** : un lien vers une fiche que le lecteur ne peut pas ouvrir est rendu en
  texte simple, comme dans `outRefs` (`accessible`). (Le Code du travail n'est plus un cas à part :
  il est en `LEGISLATION` depuis le 17 oct., § 0.1.)
- **L'Index ne se réécrit pas.** On s'y relie, on ne le touche pas.

---

## § 2 — L'inventaire, mesuré le 14 octobre

### 2.1 Les visas : 103 au total, 43 avec une fiche certaine

La table vérifiée est `scripts/data/code-fiscal-2026/visas.json` (43 `source`, 60 `null` avec leur
motif). Relis-la, puis **rends chaque visa identifié cliquable sur sa désignation** :
- « la Loi du 14 mai 2012 sur les banques et autres institutions financières » est le texte du lien ;
- « Vu » et le point-virgule restent hors du lien.

Points d'attention déjà relevés :

| Visa | Cible | À savoir |
| --- | --- | --- |
| 10 « le Code Pénal » | le **Code pénal révisé** (décret du 24 juin 2025), à téléverser (§ 0.3) | le `CITE` posé le 14 oct. vise le Code de 1835 : à **re-cibler** une fois la fiche en ligne |
| 14 « le Code du Travail » | `CODE_TRAVAIL_ANNOTE`, type **LEGISLATION** depuis le 17 oct. (§ 0.1) | — |
| 36 Décret du 29 mars 1979 (avocats) | `CPC_APPENDICE_III_2_1` | **réglé** (§ 0.2) : loi du 24 juin 1932, la fiche est corrigée |
| 6 Pacte de San José, 72 Statut général de la fonction publique | appendices du Code de procédure civile | la fiche n'est qu'un **extrait** (art. 7, art. 201 s.) : lien vers la fiche, sans ancre d'article |
| 88, 89 | lois de 2017 et 2018 | dates de la fiche corrigées le 14 oct. sur la date du visa : elles concordent désormais |
| 98 « le Décret du 19 décembre 2022 portant Code Fiscal » | aucune fiche → entrée d'Index `LM2023-SP3` « Décret portant Code Fiscal » | **décidé** (§ 6) ; l'entrée est marquée abrogée et remplacée depuis le 14 oct. |
| 99 « le Décret du 23 décembre 2022 portant Code des Douanes » | `CODE_DOUANES_ANNOTE`, type **LEGISLATION** | jamais la copie DOCTRINE |

### 2.2 Les 60 visas sans fiche : l'Index du Moniteur, à défaut

**Décidé le 17 oct.** : un visa sans fiche est relié à son entrée d'Index **quand elle est certaine**.

Un appariement grossier a été fait : mots de l'objet, plus une publication dans les deux ans. Il trouve
au moins un candidat à l'Index pour **34 visas sur 60**. **Ce n'est pas une identification**, c'est une
liste à vérifier une par une : nature, date et objet doivent concorder.

Faux amis déjà vus :
- **visa 26** (timbres de la Justice, 1968) → trois arrêtés de timbres-poste de 1969 : faux ;
- **visa 38** (Loi du 17 août 1979 créant la BRH) → un contrat de services : faux. Le visa reste
  ambigu même en fiche (deux lois BRH de ce jour) ;
- **visa 70** (Décret du 8 septembre 2004, Unité de Lutte contre la Corruption) → l'Index porte un
  « **Arrêté** » créant le même organisme : la nature diffère, à trancher ;
- **visa 54** (taxe d'apprentissage, 14 octobre 1988) → deux candidats. Le bon est `LM1988-95` ;
- **visa 102** (Décret du 29 mars 2026, prix des produits pétroliers) → `LM2026-SP15`, publié le
  **27** mars : publication avant la date du visa ? Vérifie sur le fascicule.

Candidats qui paraissent justes, à confirmer :
- 30 → `LM1974-11` ; 31 → `LM1974-77` ; 34 → `LM1978-81` ;
- 44 → `LM1983-78` ; 45 → `LM1986-67` ; 47 → `LM1987-22` ;
- 48 → `LM1987-57B` (avec son erratum `LM1987-74A`) ; 49 → `LM1987-22` ; 51 → `LM1987-79` ;
  53 → `LM1987-86A` ;
- 55 → `LM1994-103` ; 57 → `LM1995-50` ;
- 59 → `LM1996-52` ; 60 → `LM1996-51A` ; 61 → `LM1996-52` ; 63 → `LM1996-52` ;
- 65 → `LM2002-62` ; 69 → `LM2003-76` ; 78 → `LM2006-47` ; 80 → `LM2008-17` ;
- 84 → `LM2014-87` ; 86 → `LM2017-SP5` ;
- 90 → `LM2020-SP20` ; 91 → `LM2020-SP9` (et `SP9A`) ; 95 → `LM2020-SP44` ; 97 → `LM2022-SP28-A`.

**Une entrée d'Index désigne l'acte, pas le fascicule.** Lie la visa à l'entrée (`type: INDEX`, résolue
par `number` + titre vérifié). La fiche d'Index renvoie déjà au fascicule quand celui-ci est en Éditions
(commit `7ebc2d5`). `publicationDate` y est la date de **publication**, pas celle du visa.

Pour chacun des 60, consigne le sort dans `visas.json` : `index` (avec le numéro), ou `aucun` (avec le
motif).

### 2.3 Le dispositif : les mentions d'autres textes

Relevé exhaustif des art. 1 à 543, à refaire et compléter :

| Art. du Code fiscal | Désignation imprimée | Cible | Article visé | Vérifié |
| --- | --- | --- | --- | --- |
| 250 (4.) | « Les articles 1539 et 1540 du Code Civil » | `CODE_CIVIL_ANNOTE` | `art-1539`, `art-1540` | ✅ : bail de plusieurs années / d'une année, perte par cas fortuits — c'est la matière de l'art. 250 |
| 524 | « l'article 200.2 de la Constitution de la République d'Haïti » | `CONSTITUTION_1987` | `art-200-2` | ✅ : « Ses décisions ne sont susceptibles d'aucun recours sauf, de pourvoi en cassation » (Cour supérieure des comptes) |
| 12 (3.), 482 (×2), 485, 486, 494 | « le Code Pénal » | Code pénal révisé (§ 0.3) | — | ⏸ attend la fiche ; **jamais** le Code de 1835 |
| 218, 489, 494 | « Code de Procédure Pénale » / « Code de Procédure Pénal » | Code de procédure pénale révisé (§ 0.3) | — | ⏸ attend la fiche. **Jamais** le Code d'instruction criminelle |
| 218, 490, 521 | « le Code de Procédure Civile » | `CODE_PROCEDURE_CIVILE` | — | ✅ |
| 54 | « le Code du Travail » | `CODE_TRAVAIL_ANNOTE` (LEGISLATION) | — | ✅ |
| 203 (×2), 481 | « du décret portant Code des douanes », « le Code des Douanes » | `CODE_DOUANES_ANNOTE` (LEGISLATION) | — | ✅ |
| 12 (3.) | « la Décret du 17 mai 2005 portant révision du Statut général de la Fonction publique » | `CPC_APPENDICE_II_A_3` (extrait) | — | ✅ (le « la » est du J.O. : n'y touche pas) |
| 140 (2.) | « du décret du 21 août 2026 établissant le régime d'imposition applicable au secteur » | `DECRET_JEUX_IMPOSITION_2026` | — | ✅ par l'objet. ⚠️ l'art. 140 écrit **21 août** (la publication, Spécial 43-B), le visa 103 **11 août** (l'adoption). Le texte ne change pas ; à signaler |
| 154 | « du décret du 1er juin 2005 portant immatriculation et circulation des véhicules » | `DECRET_CIRCULATION_VEHICULES_2005` | — | ✅ |
| 202 | « du décret déterminant les modalités de fixation des prix des produits pétroliers » | aucune fiche | — | Index `LM2026-SP15` si le visa 102 y est confirmé (§ 2.2) |

**Non reliés** (désignations générales, § 1) :
- « la Loi » (art. 32, 221, 241, 245, 254, 262, 334, 408, 482, 523, 537) ;
- « la législation relative aux privilèges accordés aux anciens grands commis » (54), « … sur les
  sociétés anonymes » (137), « … relative à l'urbanisme » (287) ;
- « une convention fiscale… » (48, 463, 464), « une convention prévoyant une assistance mutuelle » (364) ;
- « arrêté du Ministre » (76, 80, 202, 240), « arrêté pris en Conseil des Ministres » (241) ;
- « circulaire du Ministre » (103), « instructions et circulaires publiées par l'Administration fiscale »
  (468) ;
- la BRH comme institution (71, 240-242, 403).

Les mentions internes (« Code Général des Impôts », « Livre des Procédures Fiscales », « le présent
Code ») ne sont pas des renvois externes.

---

## § 3 — La table fermée : `scripts/data/code-fiscal-2026/renvois-externes.json`

Une ligne par **occurrence** :

```json
{
  "bloc": "art-250",
  "texte": "Les articles 1539 et 1540 du Code Civil",
  "occurrence": 1,
  "cible": { "source": "CODE_CIVIL_ANNOTE", "type": "LEGISLATION" },
  "articles": [ { "texte": "1539", "ancre": "art-1539" }, { "texte": "1540", "ancre": "art-1540" } ],
  "verifie": "art. 1539-1540 C. civ. : bail, perte de récolte par cas fortuits (14 oct.)"
}
```

Champs :
- `bloc` : l'ancre du bloc où se lit la mention, telle que `segmentAnnotated` la produit.
  - un article (`art-250`, `art-406-2`) ;
  - pour un visa, l'ancre `sec-N` du bloc du préambule ;
- `texte` : la désignation **verbatim**, apostrophes courbes et espaces insécables compris ;
- `occurrence` : son rang dans le bloc ;
- `cible`, au choix :
  - une fiche : `{ source, type }` ;
  - une entrée d'Index : `{ index: "LM1974-11", titre: "Décret révisant la Loi du 4 Décembre 1959…" }` ;
- `articles` : les numéros, **à l'intérieur de `texte`**, qui deviennent des liens d'article. Facultatif.

Le script de construction **refuse** une ligne dans quatre cas :
- `texte` est introuvable dans son bloc, ou ne s'y lit pas au rang indiqué ;
- la cible n'existe pas, ou existe plusieurs fois ;
- une ancre d'article n'existe pas dans la cible (calcul par `segmentAnnotated` sur la cible, comme
  `scripts/_import-code-fiscal-2026.ts`) ;
- `verifie` est vide pour une ligne qui porte des `articles`.

---

## § 4 — Le mécanisme (générique, alimenté ici pour le seul Code fiscal)

**Données.** Ajoute `annotationsJson.extRefs`, facultatif, avec la forme du § 3.
- ⚠️ `parseAnnotations` est une **liste blanche** : sans le champ, il disparaît sans erreur (leçon
  `pointAnchors`).
- On n'y écrit **pas d'id** de document : la résolution se fait à l'affichage, par `source`/`type` ou
  `number`. Un id change au ré-import.

**Résolution** (`page.tsx`, une seule requête, comme `codeHrefs`) :
- réunis les cibles distinctes de `extRefs` ;
- résous-les par la même règle que `refs.ts` (`pickBest`) ;
- vérifie l'accès (`canReadService`) ;
- passe à `AnnotatedText` une table `cible → href | null`.

**Rendu** (`AnnotatedText` → `OfficialText`) :
- dans le bloc indiqué, la n-ième occurrence de `texte` est enveloppée d'un lien `/{locale}/doc/{id}`,
  avec `title` = le titre de la cible ;
- chaque numéro de `articles` devient un lien `/{locale}/doc/{id}#{ancre}` ;
- une cible inaccessible reste du texte ;
- **le texte affiché est identique, octet pour octet**, au rendu sans `extRefs`.

Deux cohabitations :
- **avec `artRefs`** : « l'article 200.2 de la Constitution » n'est pas un renvoi interne
  (`ART_EXT_AFTER`), et ne doit pas le devenir. Le lien externe le prend en charge. Aucun numéro ne
  porte deux liens ;
- **avec `coderefs.ts`** : les abréviations restent traitées comme avant. Cette fiche n'en porte pas.

**Aucune autre fiche ne change** : sans `extRefs`, le rendu est celui d'aujourd'hui. Ajoute un test qui
le montre sur le Code civil.

**`CrossRef`.** Complète les 43 `CITE` :
- un `CITE` par cible nouvelle (entrées d'Index des visas, fiches du dispositif absentes des 43) ;
- un `CITE` avec `toAnchor` pour chaque article visé (Code civil `art-1539`, `art-1540` ; Constitution
  `art-200-2`) ;
- **re-cible le `CITE` du visa 10** vers le Code pénal révisé (§ 0.3).

Tout dans une transaction. Puis recompte : `audit()` avale ses erreurs.

**La version Word** (`src/lib/legislation/word.ts`) n'a pas de liens : c'est voulu. Ne la change pas.

---

## § 5 — Contrôles avant de déclarer le travail fini

1. **Table** : chaque ligne de `renvois-externes.json` se retrouve dans son bloc, au bon rang. Chaque
   cible est résolue une seule fois. Chaque ancre d'article existe. **0 lien mort.**
2. **Texte** : `textContent` de la fiche rendue, avec et sans `extRefs`, **identique**. `bodyOriginal`
   inchangé (même empreinte qu'avant).
3. **Rendu** (vitest, sur les données versées, comme `AnnotatedTextCodeFiscal.test.tsx`) :
   - chaque visa identifié est un lien vers sa cible ;
   - « 1539 » et « 1540 » mènent à `#art-1539` / `#art-1540` du Code civil, « 200.2 » à `#art-200-2` de
     la Constitution ;
   - aucune désignation générale (§ 2.3) n'est un lien ;
   - « Code de Procédure Pénale » mène au Code de procédure pénale révisé, jamais au Code
     d'instruction criminelle ; « le Code Pénal », au Code pénal révisé, jamais au Code de 1835.
4. **Accès** : un compte sans service Législation voit les désignations en texte simple.
5. **Autres fiches** : Code civil et Code pénal de 1835 rendus à l'identique (test).
6. **`CrossRef`** : recompte par `kind` et par cible. Les cibles d'Index sont des entrées `type: INDEX`,
   jamais des fascicules.
7. **Fin de chaîne** :
   - `npm run typecheck && npm run lint && npx vitest run --dir src` ;
   - `npm run build:check` (jamais `npm run build`) ;
   - après déploiement, contrôle visuel de la fiche connectée, en fr/en/ht : les liens du préambule, de
     l'art. 250, de l'art. 524.

## § 6 — Réponses de Me Vaval (17 octobre 2026)

| Question | Réponse | Effet |
| --- | --- | --- |
| 1. « le Code Pénal » : quel code ? | « nous devons les téléverser dans législation annotée avant de faire les cross reference » | le Code pénal **révisé** (2025), à téléverser d'abord (§ 0.3) |
| 2. « Code de Procédure Pénale » | même réponse | le Code de procédure pénale **révisé** (2025), à téléverser d'abord (§ 0.3) |
| 3. Visa 98 → Index `LM2023-SP3` ? | « oui » | lien vers l'entrée « Décret portant Code Fiscal » |
| 4. Visas sans fiche → Index ? | « oui » | quand l'entrée est certaine (§ 2.2) |
| 5. Art. 140 (21/11 août) | — | on relie par l'objet, le texte ne change pas |
| 6. Code du travail | « déclassez-le et rangez-le dans législation annotée » | **fait** (§ 0.1) |
| 7. Visa 36 | « la date d'entrée effective de la loi est celle du vote de la dernière chambre » | **fait** : 24 juin 1932 (§ 0.2) |

## § 7 — Contraintes du dépôt

- **`.env` = base de PRODUCTION.**
  - Tout script s'exécute à blanc par défaut.
  - `--commit` ne se lance que sur instruction explicite de Me Vaval.
  - Si le pooler sature : `connection_limit=1..2&connect_timeout=30`.
- **Contrôle d'empreintes** : `npx tsx scripts/verifier-empreintes-donnees.ts` avant tout commit et
  avant tout `--commit`. Recontrôle **après** le commit d'un jeu suivi (« ÉCART GIT » est normal juste
  avant).
- **Git** :
  - `git add` fichier par fichier, jamais `-A` ;
  - relis le diff complet de tout fichier partagé ;
  - pas de push sans instruction.
- **Note de livraison** : complète `docs/livraison-code-fiscal-2026.md` (§ « Renvois externes »). Elle
  contient la table des renvois, les visas reliés à l'Index et les réponses de Me Vaval.
