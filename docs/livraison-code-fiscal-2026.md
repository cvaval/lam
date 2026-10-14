# Livraison — Code fiscal de 2026 (Le Moniteur Spécial N° 48-A)

13 octobre 2026. Spécification : `docs/prompt-code-fiscal-2026.md`. Ordre de Me Vaval : « lancer la
production et compléter la relecture ».

## 1. Ce qui est versé

| Objet | État | Identifiant |
| --- | --- | --- |
| **Éditions Le Moniteur** — fascicule `LM2026-SP48-A`, spéciale, mercredi 30 septembre 2026, 184 p. | ✅ écrit en production, PDF sur le Blob privé, transcription « OCR combiné » écrite (583 026 c.) | `cmv7jyh2x0000sz8i5zsubbf5` |
| **Index du Moniteur** — « Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal », `DECRET`, `SPECIALE` | ✅ écrit (Index 28 955 → 28 956), audit écrit | `cmv7k1guo0000mm7kbti7pazr` |
| **Législation annotée** — « Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal » (`CODE_FISCAL_2026`), thèmes `fiscalite` (principal) + `fiscalite-impots` | ✅ écrite le 14 oct. après déploiement (`36d4e36`, agora.ht), recomptée : 1 ABROGE non résolu, 2 VOIR, 43 CITE ; Word et fac-similé sur le Blob privé ; recherche FTS : rang 1 sur « code fiscal », « livre des procédures fiscales », « matricule fiscal », « vérification de comptabilité » | `cmv7ldx9r0001soj2gggluol8` |
| **Index** — les 3 entrées `LM2023-SP3` du Code de 2022 | ✅ abrogées, « remplacé par » la fiche de 2026 (décision du 14 oct.) | — |

Le fascicule a été catalogué par `import-moniteur-pdf.ts --completer --commit`, depuis un lien symbolique
au nom attendu (`Le Moniteur Spécial No.48-A Mercredi 30 Septembre 2026.pdf`) : **le fichier de la cliente
n'a pas été renommé**, et l'en-tête de la fiche garde son vrai nom (`Code Fiscal_2026_small.pdf`). Date relue
sur la manchette. La transcription ne remplace pas le fac-similé, et le texte propre du Word ne remplace pas la
transcription.

⚠️ **Index de recherche du fascicule.** Le scan HP porte sa propre couche texte, versée dans `searchText` à
l'import. Elle compte 93 061 jetons, et la transcription 91 409. La règle « l'index ne baisse jamais » aurait
donc gardé la couche du scanner. Or celle-ci coupe les mots à chaque accent : les 2 580 « mots » qu'elle a
en plus sont **tous** des fragments (« claration », « rification », « comptabilit »). L'index a été remplacé
par la transcription, par une décision nommée (`--remplacer-index`), et la mesure est consignée dans le script.

## 2. La collation (§ 2, § 11)

**Méthode.** Il y a deux témoins propres du fac-similé, chacun obtenu par la chaîne « OCR combiné » du dépôt
lancée hors base (`scripts/ocr-combine-pdf.ts`) :
- Claude Opus 5.5 + Tesseract ;
- Claude Haiku 5.5 + Tesseract.

Le Word a été comparé mot à mot à chacun des deux, article par article. Tesseract a aussi été relu seul,
sur trois angles morts : les accents, les mots collés et la ponctuation. **Chaque divergence a été tranchée sur
l'image** (planches à 300 ppp, agrandissements au besoin). Tout est consigné dans
`docs/livraison-code-fiscal-2026/collation.csv` : **425 lignes, toutes tranchées**.
- 305 lieux de divergence ;
- 109 cas d'angle mort (accents, espaces) et 3 de ponctuation ;
- les 8 décisions du § 2, revues sur l'image.

**22 corrections du Word** (`scripts/data/code-fiscal-2026/corrections-jo.json`). Ce sont les seuls cas où
le J.O. diffère de la transcription :

| Lieu (page du J.O.) | J.O. | Word corrigé |
| --- | --- | --- |
| têtes des art. 296, 442, 443, 444, 492 (p. 89-154) | « Article N. » sans tiret | tiret retiré (5) |
| tête de l'art. 129 (p. 45) | « Article129.- » | espace retirée |
| art. 172 (p. 53) | « (1/2%) » | « ½ » → « 1/2 » |
| art. 210 (p. 68), art. 222 (p. 71) | « b être remplacée », « b proportionnels. » : repère sans point | point retiré (2) |
| art. 306, 371, 396, 492 (p. 95-154) | « entrainé », « entraine » sans circonflexe | accent retiré (4) |
| art. 377, 417, 423 (p. 112-128) | « A l’issue », « A défaut » | « À » → « A » (3) |
| art. 427 (p. 131), art. 436 (p. 135) | « au 1.. », « au 3.. » : point doublé | point doublé rétabli (2) |
| visa du Décret du 30 avril 2023 (p. 5), art. 76 (p. 28), art. 126 (p. 43) | « Haiti » sans tréma | tréma retiré (3) |
| art. 306 (p. 95) | « présentées parles entreprises » (collé) | espace retirée |

⚠️ **Le § 2 F de la spécification est démenti par l'image.** À l'art. 230 (tableau d'usufruit, p. 73), la
2ᵉ rangée du J.O. se lit « De 21 à moins 31 ans révolus », **sans « de »**. Vérification faite :
- agrandissement ×2 à 300 ppp ;
- sur les deux PDF du 13 octobre.

Le Word est donc fidèle. **Aucun « de » n'a été rétabli.** Seules les rangées 3, 4, 5 et 7 portent
« moins de ».

Tout le reste est conforme au J.O., y compris ses propres irrégularités, que la transcription suivait déjà :
- « Pacte San Jose », « ContreTiers », « octobre1983 » ;
- l'énumération « c. d. c. d. » (art. 63) ;
- « 15. À ce titre » ;
- « (10, 000, 000.00) » ;
- « moi sentier », « comparais on », « fuvial », « fux » ;
- « Code fiscale », « Procédure Pénal » ;
- les doubles points « au 1.. », « au 2.. » déjà présents dans le Word.

Les lecteurs OCR, eux, « corrigeaient ». Ce qu'ils ont fait :
- Haiku a sauté l'article 485 en entier et lu les p. 132-133 dans le désordre ;
- Opus a omis quelques numéros d'alinéa.

Aucune de ces lectures n'a été reprise.

## 3. Les anomalies du J.O. et leur sort

- **Pas d'art. 294.** Reproduit ; pas d'ancre. Note en tête du Chapitre 7, Droit d'affichage.
- **« Article 406.- » deux fois.** Reproduit. Deux ancres techniques, `art-406` et `art-406-2`
  (`annotationsJson.repeatedHeads`), libellées toutes deux « Article 406 ». Note en tête de la
  Section IV, Vérification de comptabilité.
- **Patente : rubriques A puis C.** Le corps est reproduit (« C. »). Note en tête de la Section V.
  ⚠️ Le J.O. se contredit : sa table (p. 171) écrit « B. ».
- **« 6, 6% »…** Reproduit : c'est la notation décimale du J.O.
- **Têtes sans tiret et « Article129.- ».** Forme du J.O., reconnue par `anchors.ts`.
- **« inhalationautres », « f. / g. » de l'art. 22.** Reproduits.

## 4. Sommaire et index

**Sommaire.** C'est la table de la cliente, sans ses numéros de page (ils ne sont pas ceux du J.O.).
- 419/419 entrées appariées au corps : 363 sur une ligne, 55 sur deux, 1 sur trois.
- Les lignes de suite des intitulés entrent au `toc` sous le genre `suite`. Elles ne sont jamais jointes dans
  le corps.
- `navToc` : Préambule + Livre I + Livre II, sur 9 rangs. La Conclusion est dans le Livre II.
- **Chaque entrée porte sa plage d'articles calculée** (champ facultatif `articles`), sans aucune page.
  Exemples : Livre I art. 1 à 297, Livre II art. 298 à 543, Conclusion art. 540 à 543 (par union), Droit
  d'affichage art. 293 à 295, Vérification de comptabilité art. 404 à 414.

**Index.** Liste plate, au format « Vedette — sous-entrée », Livres I et II fondus.
- 354 sujets ; 105 vedettes communes aux deux Livres ont été réunies.
- 3 715 renvois une fois les plages dépliées (3 713 distincts après redirection).
- **0 lien mort**.
- **31 renvois redirigés vers le bon texte** (décision du 14 oct.) ; aucun n'est retiré :
  - les 19 « 405 » vont au premier « Article 406 » (B. Avis de vérification) : le second « Article 406 »
    le cite lui-même comme « l'article 405 » ;
  - les 9 « 406 » vont au second (C. Vérification inopinée, ancre `art-406-2`), affiché « 406 (2ᵉ) » ;
  - les 3 « 294 » vont à l'art. 293, dont les alinéas 2 et 3 (après le tableau) portent la matière.
- **96 couples douteux**, reproduits tels quels. Le contrôle compare chaque entrée au texte de l'article et
  aux intitulés de ses divisions, sur des radicaux et des mots distinctifs. L'exemple
  « Assistance administrative internationale : 48 » est bien relevé.

Les deux listes (couples redirigés, couples douteux) sont dans
`docs/livraison-code-fiscal-2026/index-a-valider.csv`.

Couverture : 539 articles sur 542. Les art. 289, 290 et 541 ne sont jamais cités (comme dans l'index de la
cliente : 540 numéros sur 543, dont 294).

## 5. Table des visas (`scripts/data/code-fiscal-2026/visas.json`)

Les 103 visas ont été vérifiés un par un.
- **43 sont identifiés avec certitude** et donneront un `CITE`, résolu par `source` et `type`.
- 60 restent du texte : 57 sont absents du corpus, 1 est ambigu (les deux lois BRH du 17 août 1979), 1 vise le
  Décret de 2022 (renvois ABROGE et VOIR à la place), 1 vise le Pacte National du 21 février 2026.

**Visas 88 et 89 : la date du visa fait foi, corrigée sur toute la plateforme** (décision du 14 oct.,
`scripts/corriger-dates-lois-2017-2018.ts`, état antérieur dans `docs/livraison-code-fiscal-2026/`).
- « Loi du **16 février 2017** sur les échanges électroniques » : la fiche disait 14 février. Le 16 février
  est le vote du Sénat, que la fiche notait déjà.
- « Loi du **3 avril 2018** portant Réforme du statut du commerçant… » : la fiche disait 23 avril. Le 3 avril
  est le dernier vote (Sénat), le 23 avril la promulgation.
- Corrigés : titres fr/en/ht, référence, résumé, date d'adoption, ligne de titre éditoriale du corps de 2017,
  65 marques « (L. du 3 avril 2018) » du Code de commerce, 8 `ArticleVersion`, importeurs et données.
- Non touchés : le texte officiel (la promulgation du 23 avril reste dans le corps de 2018), les visas des
  autres textes, les transcriptions d'Éditions, l'Index (aucune de ses entrées ne porte ces dates).

Reste à signaler :
- **visa 36** : le décret de 1979 sur la profession d'avocat est dit « révisant la Loi du 24 juin 1932 ». La
  fiche dit « du 6 mai 1932 ».

## 6. Code (poussé le 14 oct. 2026)

- `anchors.ts` reconnaît « Article129.- » (tête collée), **avec « .- » seulement**. Mesuré sur les 33 752
  corps : les 190 lignes de cette forme sont toutes dans des transcriptions d'Éditions, rendues sans ancre.
- `segmentAnnotated` accepte `repeatedHeads` (seconde occurrence d'une tête imprimée deux fois).
- `NavItem.articles` / `articlesAnchor` sont facultatifs. `CodeSidebar` les affiche ; **les fiches sans ce
  champ sont rendues à l'identique** (test).
- `AnnotatedText` :
  - reconnaît la tête collée ;
  - **rend les tableaux à l'intérieur des articles, à la place de leurs rangées**. Seules deux fiches du
    corpus portent des tableaux (les circulaires 105-2 et 127), et tous hors bloc d'article : leur rendu ne
    change pas.
- `CODE_FISCAL_2026` est inscrit dans `HIDE_INLINE_INDEX_SOURCES` et `ART_REFS_SOURCES`.
- Tests : `AnnotatedTextCodeFiscal.test.tsx` rend la fiche réelle. Il vérifie :
  - les 542 ancres, une fois chacune ;
  - les 9 tableaux, chacun dans son article et à la place de ses rangées ;
  - les plages du sommaire, sans aucune page.
- **Version Word** (décision du 14 oct.) : bouton « Version Word » sur toute fiche de la Législation annotée,
  route `/api/doc/[id]/word`. Le fichier est **généré du texte officiel de la fiche**
  (`src/lib/legislation/word.ts`), jamais tiré du .docx d'origine, qui garde les 22 écarts au J.O. Même
  habillage et mêmes gardes que les annexes BRH : filigrane, mention légale, palier d'export, journal.
- `annotationsJson.refDisplay` (facultatif) : libellé d'un renvoi d'index (« 406 (2ᵉ) »).
- Bandeau d'abrogation : résolu aussi hors BRH, formule neutre « abrogé et remplacé par : ».
- `typecheck`, `lint` et `vitest` passent : 1 721 tests verts. `build:check` compile.

Déployé après autorisation (« oui », 14 oct.), puis la fiche a été écrite :

```bash
npx tsx scripts/_import-code-fiscal-2026.ts --commit
npx tsx scripts/remplacement-code-fiscal-2022.ts --commit
```

## 7. Décisions du 14 octobre 2026, et ce qui reste ouvert

Tranché par Me Vaval :
- **art. 230** : texte du J.O. sans « de » (confirmé) ;
- **les trois notes de section** : validées ;
- **déploiement** : autorisé, puis écriture de la fiche ;
- **renvois 405/294** : redirigés vers le bon texte (§ 4) ;
- **visas 88/89** : la date du visa, corrigée sur toute la plateforme (§ 5) ;
- **titre** : tel que dans le texte, « Décret remplaçant le Décret du 19 décembre 2022 portant Code Fiscal »
  (la référence garde « Décret du 30 septembre 2026 … ») ;
- **version Word** : ajoutée pour la Législation annotée (§ 6) ;
- **conflits Dropbox** : corrigés (48 copies supprimées, dossiers de compilation exclus de Dropbox,
  manifestes reposés) ;
- **Code de 2022** : remplacé par celui de 2026. Les trois entrées d'Index `LM2023-SP3` passent au statut
  abrogé, avec lien vers la fiche de 2026 ;
- **Spéciaux 44 à 48** : pour plus tard.

Encore ouvert :
0. **Contrôle visuel en fr/en/ht** de la fiche en ligne : la page exige une connexion, que je ne fais pas à
   votre place. Le rendu est vérifié par les tests sur les données versées (542 ancres, 9 tableaux en place,
   sommaire à plages, renvois d'index).
1. **Index à valider** : 96 couples douteux, et les 31 renvois redirigés (`index-a-valider.csv`).
2. **Visa 36** : « Loi du 24 juin 1932 » (visa) contre « loi du 6 mai 1932 » (fiche de l'Appendice III.2).
3. **Textes fiscaux antérieurs** : un renvoi VOIR de chacun vers le Code ? Par défaut, rien.
4. **Créole du titre** : « Dekre ki ranplase Dekre 19 desanm 2022 sou Kod Fiskal la », sans accent grave, à
   valider.
