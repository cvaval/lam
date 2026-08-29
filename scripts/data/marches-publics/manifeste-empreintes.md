# Manifeste d’empreintes — corpus des marchés publics

Généré le 2026-08-27T23:42:46. Extracteur : ir2005/extraire.py (tabulations <w:tab/> et runs barrés préservés).

Les pièces `piece-*.txt` sont des **ré-extractions** des `.docx` d’origine de `~/Downloads/`,
faites avec l’extracteur canonique de la maison. Le manifeste porte **les deux séries**
d’empreintes, étiquetées (§ 4) : celle des `.docx` d’origine et celle des extractions.
La troisième colonne md5 est celle de l’extraction VOLATILE du scratchpad de séance,
conservée pour traçabilité.

## 1. Les 24 pièces retenues (24 textes + la loi-mère et sa table des matières)

| Texte(s) | Pièce dans le dépôt | md5 .docx d’origine | md5 extraction | ¶ non vides | TAB | têtes | § 8.2 |
|---|---|---|---|---|---|---|---|
| 00 | `piece-00-loi-2009-corps.txt` | `2b38aa3fc6` | `5fa21b88a0` | 491 | 179 | 179 | 179 ✓ |
| 00 | `piece-00-loi-2009-table-matieres.txt` | `fb093a70d0` | `39e161beb1` | 55 | 0 | 0 | 0 ✓ |
| 01 | `piece-01-decret-2004-12-03-reglementation.txt` | `4584084ef8` | `80d9c1ab8c` | 431 | 118 | 118 | 118 ✓ |
| 02 | `piece-02-arrete-2009-10-26-modalites.txt` | `ef0705bf51` | `f8568d17d2` | 871 | 572 | 387 | 387 ✓ |
| 03 | `piece-03-arrete-2009-10-26-manuel-procedures.txt` | `e481adb963` | `4a3e6739f6` | 985 | 336 | 3 | — ✓ |
| 04 | `piece-04-arrete-2009-10-26-organisation-cnmp.txt` | `2466f6637d` | `36e11a7afd` | 351 | 207 | 64 | 64 ✓ |
| 05 | `piece-05-arrete-2011-05-10-dao-travaux-tome1.txt` | `70039bb6c7` | `d6ba8efeb5` | 93 | 0 | 2 | 2 ✓ |
| 06 | `piece-06-arrete-2011-05-10-consultants-tome3.txt` | `257d5870b9` | `6a58e2cd76` | 99 | 0 | 2 | 2 ✓ |
| 07 | `piece-07-arrete-2011-05-10-ccag.txt` | `7378550ccb` | `4f98caf230` | 88 | 0 | 2 | 2 ✓ |
| 08 | `piece-08-arrete-2012-05-25-seuils.txt` | `0b1fac6133` | `a61683dee8` | 91 | 14 | 11 | 11 ✓ |
| 09 | `piece-09-arrete-2012-12-21-charte-ethique.txt` | `88f2b63644` | `3b17a36aa7` | 287 | 98 | 32 | 32 ✓ |
| 10 | `piece-10-arrete-2017-08-30-demande-prix-fournitures.txt` | `f3bf92681d` | `b623623562` | 943 | 0 | 17 | 17 ✓ |
| 11 | `piece-11-arrete-2017-08-30-procedures-celeres.txt` | `0746089f38` | `e5d682561c` | 818 | 0 | 30 | 30 ✓ |
| 12 | `piece-12-arrete-2017-08-30-cotations-travaux.txt` | `92b908c7e2` | `6bf69bdfaa` | 1052 | 179 | 30 | 30 ✓ |
| 13 | `piece-13-arrete-2017-08-30-allege-travaux.txt` | `6730f84a2e` | `54fbf48423` | 1598 | 3 | 6 | 6 ✓ |
| 14 | `piece-14-arrete-2017-08-30-allege-fournitures.txt` | `974b09e432` | `0446cac75a` | 1395 | 188 | 24 | 24 ✓ |
| 15 | `piece-15-arrete-2017-08-30-allege-consultants.txt` | `724feeb472` | `9821e06c95` | 1082 | 0 | 22 | 22 ✓ |
| 16 | `piece-16-arrete-2019-01-09-defense.txt` | `832c3976b5` | `e28b0868f2` | 166 | 70 | 23 | 23 ✓ |
| 17 | `piece-17-arrete-2019-12-26-nomination-cnmp.txt` | `1c19ae9907` | `c605a2ec5a` | 55 | 0 | 4 | 4 ✓ |
| 18 | `piece-18-arrete-2020-02-12-defense.txt` | `708db83e5d` | `33d8abaad6` | 152 | 72 | 24 | 24 ✓ |
| 19/20 | `piece-19-20-fascicule-sp8-2021-02-04.txt` | `a85cae5e01` | `21548b7b79` | 472 | 116 | 34 | 34 ✓ |
| 21/22 | `piece-21-22-fascicule-sp52-2021-11-09.txt` | `3e4e01f855` | `68901156f2` | 252 | 41 | 41 | 41 ✓ |
| 23 | `piece-23-arrete-2022-06-01-seuils.txt` | `f9fa7ef489` | `31f2e8fa35` | 180 | 0 | 19 | 19 ✓ |
| 24 | `piece-24-circulaire-010-2023-12-04.txt` | `b31909ac83` | `a8e25fbb5f` | 44 | 0 | 0 | 0 ✓ |

**Contrôle § 8.2.** Le prompt ne chiffre que **16 md5 distincts** sur les 31 pièces : 
ces 17 pièces-là sont **confirmées**, 
0 écart. Pour les 14 autres, 
ce manifeste **fixe** la référence par première mesure — il ne confirme rien, et c’est écrit
pièce par pièce dans le JSON (`md5_docx_origine_de_lattendu`).

Comptes de têtes : le § 8.2 en chiffre 22 ; les 22 concordent, 0 écart.

## 2. Les six écartés — jamais versés, gardés comme pièces de contrôle

| Pièce | md5 .docx | Motif |
|---|---|---|
| `ecartees/ecartee-a-2009-organisation-fonctionnement-cnmp.txt` | `fa178c8d34` | Transcription rivale du texte n° 4 ; porte « 64ème » année (faux, lire 164ème) et « rémunéré » minoritaire |
| `ecartees/ecartee-b-2009-organisation-4-novembre-2009.txt` | `952a9c370e` | Transcription rivale du texte n° 4 ; porte « prévus » agrammatical |
| `ecartees/ecartee-c-2017-sp35-transcription-abregee.txt` | `5bece78c8b` | Transcription ABRÉGÉE du texte n° 14 (11 123 mots contre 16 364 ; ratio 0,7503) |
| `ecartees/ecartee-d-2021-sp8-transcription-base.txt` | `ff16667a79` | Transcription rivale du fascicule Spécial n° 8 ; isolée contre _1 et _2 sur « SÉVÈRE » et « Ghislaine » Mompremier |
| `ecartees/ecartee-e-2021-sp8-transcription-1.txt` | `cc799360bd` | Transcription rivale du fascicule Spécial n° 8 ; exposants Unicode (U+1D49/U+02B3, « º ») hostiles au parsing |
| `ecartees/ecartee-f-2021-sp8-doublon-a-octet.txt` | `a85cae5e01` | Doublon À L'OCTET de _2 (md5 identiques) — s'exclut PAR NOM, jamais par md5 (§ 11.2) |

⚠️ `ecartee-f` est le **doublon à l’octet** de la gagnante `piece-19-20` : md5 `.docx` et md5
d’extraction IDENTIQUES des deux côtés. Il s’exclut **par son nom**, jamais par son md5 —
l’exclure par md5 exclurait la gagnante (§ 11.2).

## 3. Hors liste — une trouvaille non arbitrée

`hors-liste/2020-02-12-defense-transcription-rivale-non-arbitree.txt` — .docx `Arrete_12_fevrier_2020_Marches_Publics_Defense.docx`, md5 `9f0ad077a3`.

TROUVAILLE : 29e .docx absent des 28 du § 4 — transcription rivale du texte n° 18 (ratio au mot 0,9056). NON ARBITRÉE : question ouverte à Me Vaval, jamais versée en l'état.

## 4. Divergence mesurée entre l’extraction volatile et la ré-extraction

Sur les 31 pièces, **une seule** diverge par son CONTENU : les vingt autres ne diffèrent
que par des paragraphes VIDES que l’extraction de séance avait laissés tomber.

- **`piece-14-arrete-2017-08-30-allege-fournitures.txt`** — l’extraction de séance porte **0 tabulation(s)**, la ré-extraction **188**. C’est le **bug `<w:tab/>`** connu de la maison (leçon Loi UCREF 2017) : les colonnes du J.O. y étaient collées. Le `.docx` d’origine est le bon (md5 `974b09e432`, celui du § 4). **C’est la seule pièce du lot dont le `.docx` porte des éléments `<w:tab/>`** ; partout ailleurs les tabulations sont des U+0009 littéraux du texte. L’extraction de séance est conservée en preuve dans `divergences/`.

## 5. Typographie mesurée par corps (§ 9.3 — jamais supposée)

| Pièce | apostrophes droites | apostrophes courbes | espaces insécables | exposants Unicode |
|---|---|---|---|---|
| `piece-00-loi-2009-corps.txt` | 942 | 0 | 0 | — |
| `piece-00-loi-2009-table-matieres.txt` | 11 | 0 | 0 | — |
| `piece-01-decret-2004-12-03-reglementation.txt` | 598 | 0 | 0 | — |
| `piece-02-arrete-2009-10-26-modalites.txt` | 0 | 1464 | 0 | — |
| `piece-03-arrete-2009-10-26-manuel-procedures.txt` | 0 | 2034 | 0 | — |
| `piece-04-arrete-2009-10-26-organisation-cnmp.txt` | 222 | 0 | 180 | — |
| `piece-05-arrete-2011-05-10-dao-travaux-tome1.txt` | 39 | 0 | 0 | — |
| `piece-06-arrete-2011-05-10-consultants-tome3.txt` | 5 | 29 | 12 | — |
| `piece-07-arrete-2011-05-10-ccag.txt` | 6 | 26 | 0 | — |
| `piece-08-arrete-2012-05-25-seuils.txt` | 38 | 0 | 0 | — |
| `piece-09-arrete-2012-12-21-charte-ethique.txt` | 0 | 361 | 0 | — |
| `piece-10-arrete-2017-08-30-demande-prix-fournitures.txt` | 498 | 0 | 0 | — |
| `piece-11-arrete-2017-08-30-procedures-celeres.txt` | 710 | 0 | 0 | — |
| `piece-12-arrete-2017-08-30-cotations-travaux.txt` | 0 | 758 | 263 | — |
| `piece-13-arrete-2017-08-30-allege-travaux.txt` | 1230 | 0 | 0 | — |
| `piece-14-arrete-2017-08-30-allege-fournitures.txt` | 1018 | 0 | 0 | — |
| `piece-15-arrete-2017-08-30-allege-consultants.txt` | 0 | 876 | 0 | — |
| `piece-16-arrete-2019-01-09-defense.txt` | 0 | 151 | 0 | — |
| `piece-17-arrete-2019-12-26-nomination-cnmp.txt` | 16 | 0 | 0 | — |
| `piece-18-arrete-2020-02-12-defense.txt` | 146 | 0 | 0 | — |
| `piece-19-20-fascicule-sp8-2021-02-04.txt` | 0 | 266 | 0 | — |
| `piece-21-22-fascicule-sp52-2021-11-09.txt` | 224 | 0 | 0 | — |
| `piece-23-arrete-2022-06-01-seuils.txt` | 0 | 119 | 48 | {'ᵉ': 1} |
| `piece-24-circulaire-010-2023-12-04.txt` | 0 | 184 | 0 | — |

Aucune pièce retenue ne mélange les deux apostrophes : chacune est franchement droite
ou franchement courbe. Un seul exposant Unicode dans tout le jeu retenu — « 177ᵉ Année »
au bandeau de fascicule de `piece-23`, hors dispositif. Les exposants hostiles au parsing
(U+1D49 + U+02B3, U+00BA) restent cantonnés à l’écartée `ecartee-e` (§ 4.2).

## 6. Notes de transcription de l’ÉDITEUR repérées dans les pièces retenues

Elles vont **en note d’édition, jamais au dispositif** (§ 11.11). Lignes repérées :

| Pièce | lignes |
|---|---|
| `piece-06-arrete-2011-05-10-consultants-tome3.txt` | 102 |
| `piece-07-arrete-2011-05-10-ccag.txt` | 20 |
| `piece-10-arrete-2017-08-30-demande-prix-fournitures.txt` | 162, 256, 321, 1275 |
| `piece-12-arrete-2017-08-30-cotations-travaux.txt` | 394 |
| `piece-14-arrete-2017-08-30-allege-fournitures.txt` | 535 |
| `piece-21-22-fascicule-sp52-2021-11-09.txt` | 253 |

⚠️ `piece-07` (CCAG 2011) porte sa note **AU MILIEU** du fichier (l. 20-24), avant le début
de l’extrait : elle atteste l’absence de la page 2 du Moniteur (§ 4.3) et signale que le
dispositif reproduit est bien celui du CCAG, non celui du Tome IV de la couverture (§ 9.2).
D’autres pièces portent des notes **entre crochets, en ligne dans le corps** — notamment
`piece-02` l. 629 (début de l’article 174 partiellement illisible) et quatre passages de
`piece-10`. Ce ne sont pas des sics du J.O. : ce sont des interventions d’éditeur.
