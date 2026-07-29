# Prompt — Le NOTARIAT : décret-loi de 1969 et textes de 1862 à 1986

> Cahier des charges de téléversement. Rédigé après lecture intégrale des documents fournis
> (`19691127_L_transcription_corrigee.docx` et `NOTARIAT_compilation_revue.docx`), réparation
> des transcriptions et vérification de l'état de la base de production.

---

## 0. ⚠️ Deux constats qui commandent tout le dossier

La compilation apporte les textes MODIFICATEURS du décret de 1969. Deux d'entre eux changent
ce qui aurait été publié sans eux :

**a) L'article 3 (nombre de notaires) a été modifié DEUX FOIS depuis 1969.**

| Texte | Port-au-Prince | Autres |
|---|---|---|
| Décret 27 nov. 1969 | **12** notaires | Cap-Haïtien, Gonaïves, Cayes, Jacmel : 8 · … · autres communes : 3 |
| Décret **30 sept. 1974** | **20** notaires | idem, listes élargies |
| Décret **9 juil. 1986** (CNG) | **22** notaires | Delmas 5 · Pétion-Ville 5 · Carrefour 4 · Cap-Haïtien, Gonaïves, Cayes, Jacmel 10 · Port-de-Paix, Jérémie, Saint-Marc 7 · Anse-à-Veau, Miragoâne, Petit-Goâve, Aquin, Fort-Liberté, Borgne, Limbé, Léogâne, Grande Rivière du Nord, Plaisance, Trouin 5 · autres communes 3 |

→ **La version en vigueur est celle de 1986.** Publier le seul texte de 1969 afficherait un
état du droit périmé de quarante ans.

**b) L'article 76 du décret de 1969 est ABROGÉ** par l'article 2 du décret du 30 septembre
1974 (« Est et demeure abrogé l'Art. 76 du Décret du 27 Novembre 1969 »). Il porte sur les
notaires alors commissionnés à Port-au-Prince, non remplacés en cas de décès ou de démission.

Ces deux effets s'ajoutent à celui déjà consigné au §5 (article 30, réécrit par la loi du
14 février 2017).

---

## 1. Le texte

**Décret-loi du 27 novembre 1969** harmonisant les dispositions de la Loi du 24 février 1919
sur le Notariat en fonction des exigences nouvelles créées par le statut économique et social
du pays. Donné par Dr. François Duvalier, Président à vie.

- **80 articles**, 4 titres, 5 sections, une partie « Dispositions spéciales ».
- Source : `~/Downloads/19691127_L_transcription_corrigee.docx` (transcription OCR).

### Charpente rétablie

| Division | Articles |
|---|---|
| **TITRE PREMIER — RÉGIME DU NOTARIAT** | |
| · Section I — Attributions et répartition des notaires | 1 → 3 |
| · Section II — Conditions d'accès à la fonction de notaire | 4 → 17 |
| · Section III — Exercice de la fonction de notaire | 18 → 25 |
| **TITRE II — CONDITIONS ESSENTIELLES À LA VALIDITÉ DES ACTES NOTARIÉS** | |
| · Section I — Actes dressés en milieux urbain et rural | 26 → 36 |
| · Section II — Des minutes, grosses, expéditions et répertoires | 37 → 49 |
| **TITRE III — COMPÉTENCE DU MINISTÈRE PUBLIC … DISCIPLINE DES NOTAIRES** | 50 → 53 |
| **TITRE IV — TARIF … HONORAIRES ET DROIT DE TIMBRE MOBILE SPÉCIAL** | 54 → 64 |
| **DISPOSITIONS SPÉCIALES** | 65 → 80 |

⚠️ Les en-têtes du J.O. étaient **trop abîmés pour être détectés par motif** (« TITRE Il » avec
un L minuscule, en-tête du TITRE III fondu dans l'article 50, marqueur « Section II » réduit à
« ‘ Section II » en fin de ligne). La charpente est donc **rétablie explicitement** dans
`parse_notariat.py`, chaque en-tête étant rattaché à l'article qui l'ouvre — bornes vérifiées
contre la position réelle des articles.

---

## 2. ⚠️ État de la transcription — à lire avant de publier

Le fichier s'annonce « transcription corrigée », mais l'OCR reste **dégradé**. Diagnostic :

| Constat | Ampleur | Traitement |
|---|---|---|
| **Têtes d'article collées** au paragraphe précédent ou précédées d'un parasite (`LA Article 32`, `* Article 36`, `\| Article 57`, `'Article 58`) | 8 articles : 22, 32, 36, 49, 50, 57, 58, 64 | **réparé** — balayage séquentiel |
| **Mots coupés** en fin de ligne par la mise en colonnes (`Hono-` / `raires`) | 13 | **réparé** — recollage |
| **Lignes de bruit pur** (filets, folios : `° -# MONT`) | 4 | **supprimées** |
| **Coquilles sûres** (`jes`→les, `séra`→sera, `dactygraphiés`, `congignation`, `Quankile`…) | 25 lignes | **corrigées** (table explicite) |
| **Coquilles résiduelles** | **27 lignes signalées** | ⚠️ **NON corrigées** — relecture requise |

**Les 80 articles sont tous présents** — vérifié après réparation, sans doublon de numéro.

⚠️ **La zone la plus abîmée est le TARIF de l'article 54** (une soixantaine de lignes de
montants en gourdes, colonnes mal lues : `5-00` pour `5.00`, `19.00`, `7.55`…). **Aucun montant
n'a été deviné ni corrigé.** Un tarif de 1969 n'a plus de portée pratique, mais publier des
chiffres faux serait pire que ne rien publier : soit on relit cette zone sur le Journal
Officiel, soit on l'assortit d'un avertissement visible.

**Recommandation** : faire relire les 27 lignes signalées (le script les liste) et le tarif de
l'article 54 avant mise en ligne. Le reste du texte est propre.

---

## 3. Appareil éditorial — PRODUIT

Ni sommaire ni index n'existaient. Les deux ont été générés (IA Gemini, repli Claude), relus,
corrigés et livrés au format des documents de la cliente :

| Document | Contenu | Fichier |
|---|---|---|
| **Sommaire — décret 1969** | 80 rubriques + 10 en-têtes de charpente | `Sommaire_Decret_Loi_Notariat_1969.docx` |
| **Index — décret 1969** | **131 sujets · 315 renvois · 80/80 articles** | `Index_Decret_Loi_Notariat_1969.docx` |
| **Sommaire — compilation** | 79 rubriques, une section par texte (7 textes) | `Sommaire_Notariat_Compilation.docx` |
| **Index — compilation** | **228 sujets · 384 renvois · couverture intégrale des 7 textes** | `Index_Notariat_Compilation.docx` |

Corrections appliquées à la relecture (table nominative, jamais d'heuristique) : fusion de
8 doublons — casse (`Acte Notarié`/`Acte notarié`, `Timbre Mobile Spécial`), nombre
(`Honoraire`/`Honoraires`), notion (`Prestation de Serment` → `Serment`, `Étude` → `Étude
notariale`) — et désambiguïsation de « Ministère » en **« Ministère du notaire »** (art. 2,
« prêter leur ministère »), à ne pas confondre avec le **Ministère Public**.
Capitalisation normalisée à la française (majuscule au premier mot seul), avec une liste
d'exceptions pour les 8 institutions (Tribunal Civil, Ministère Public, Commissaire du
Gouvernement, Conseil Supérieur du Notariat, Doyen du Tribunal Civil, Juge de Paix, Banque
Nationale, Secrétaire d'État de la Justice).

⚠️ **Appareil éditorial produit par IA : il appelle une relecture juridique.** Les `.docx` sont
modifiables ; les scripts d'import reprendront les corrections telles quelles.

---

## 4. Place dans l'arborescence

**Double rattachement**, conformément à l'usage de la plateforme (reclasser = *copier*, pas
déplacer) :

- **Principal — Droit public & administratif → `justice`.** Le notaire est un **officier
  public** (art. 1er) ; le décret organise l'accès à la fonction, la nomination par le
  Président, le serment, la discipline exercée par le **Ministère Public**, la destitution.
  C'est un texte d'organisation d'une profession d'officier public.
- **Secondaire — Droit privé → `droit-civil`.** Les titres II et IV régissent l'**acte
  authentique**, sa validité, les minutes, grosses et expéditions — matière civile, en lien
  direct avec les articles 1100 s. du Code civil sur la preuve littérale.

Type `LEGISLATION`, statut `EN_VIGUEUR`, format « lecteur annoté » (sommaire + index latéraux
+ renvois inline), source suggérée `DECRET_LOI_NOTARIAT_1969`.

---

## 5. ⚠️ Article 30 — modifié par la loi du 14 février 2017

C'est le point qui relie ce texte au dossier « signature électronique » : **l'article 5 de la
loi du 14 février 2017 réécrit le premier paragraphe de l'article 30.**

**Version en vigueur** (loi de 2017, à faire prévaloir) :

> « Article 30.- Les actes des notaires sont, sous la responsabilité de ces officiers publics,
> écrits à l'encre, **manuellement ou mécaniquement**, sur papier timbré ou visé pour timbre en
> un seul et même contexte, lisiblement, sans blanc, abréviation, lacune ou intervalle. »

**Version de 1969** (à replier) :

> « Article 30. — Les actes des Notaires seront sous la responsabilité de ces Officiers Publics
> écrits à l'encre sur papier timbré ou visé pour timbre en un seul et même contexte,
> lisiblement, sans blanc, abréviation, lacune ou intervalle. »

L'apport est l'admission de l'écriture **mécanique**. Les alinéas suivants de l'article 30
(mentions obligatoires, dactylographie des expéditions, interdiction des photocopies) ne sont
**pas** touchés : seul le premier paragraphe est réécrit.

Traitement demandé :
- `status['art-30'] = 'modifié'` — pastille visible sans déplier ;
- `oldVersions['art-30']` = **premier paragraphe de 1969**, repliable, petits caractères ;
- `connexe['art-30']` = bloc cliquable vers la **loi du 14 février 2017**, ancre `art-5`
  (`ConnexeBlock` avec `docId` + `anchor` — `crossRefs.articles` ne vise que le même document).

⚠️ **Le décret du 9 décembre 2015 avait déjà réécrit ce même paragraphe** (son art. 5), dans
des termes quasi identiques (futur au lieu du présent). Ce décret étant supplanté par la loi de
2017, **c'est la rédaction de 2017 qui prévaut** ; mentionner l'antériorité de 2015 dans la
note connexe, sans en faire une version distincte — sinon l'article porterait trois états.

---

## 5 bis. Les sept textes de la compilation

`NOTARIAT_compilation_revue.docx` réunit neuf blocs. **Sept** sont à publier :

| Texte | Articles | Rôle |
|---|---|---|
| **Loi du 21 août 1862 sur le Notariat** | 11 | texte fondateur |
| **Loi du 8 août 1877** modificative | 2 | réécrit les art. 32 et 33 de la loi de 1862 + le tarif |
| **Loi du 24 février 1919 sur le Notariat** | 46 | régime que le décret de 1969 « harmonise » |
| **Arrêté** (Dartiguenave) sur l'examen et le cautionnement | 14 | application de la loi de 1919 |
| **Décret-loi du 20 juin 1941** (Lescot), étude devenue vacante | 2 | réécrit l'art. 30 de la loi de 1919 |
| **Décret du 30 septembre 1974** | 2 | art. 3 du D. 1969 réécrit · **art. 76 abrogé** |
| **Décret du 9 juillet 1986** (CNG) | 2 | réécrit le décret de 1974 (nombre de notaires) |

**Deux blocs sont ÉCARTÉS**, et il faut le savoir :

- le **décret-loi du 27 novembre 1969** y figure aussi — c'est un **DOUBLON** du fichier
  autonome déjà traité, et sa transcription y est **de moindre qualité** (« Officiers Publies »,
  « juridiction aimable » pour « amiable »). Ne pas l'importer depuis la compilation. Elle
  reste utile comme **second témoin** pour arbitrer les coquilles douteuses du §2 ;
- la **loi du 1er septembre 1951 sur l'expropriation pour cause d'utilité publique**
  (Magloire) : **hors sujet** — étrangère au notariat — et réduite à son seul préambule.
  À verser ailleurs si on veut la publier, jamais dans ce dossier.

La **loi du 6 avril 1880 sur les officiers de l'état civil** n'a que son titre dans la
compilation : rien à publier.

Traînent également dans la compilation, à traiter comme des annotations et non comme des
textes : une mention du **décret du 21 août 1975** (mise à la retraite des notaires et
arpenteurs frappés d'incapacité), une **annexe** listant des lois abrogées (13 avril 1938,
17 juin 1941, 14 septembre 1953…) et un **arrêt du 5 juin 1943** (les fautes purement
disciplinaires relèvent de la juridiction civile). Ces éléments valent d'être conservés en
notes connexes sous les articles concernés.

⚠️ **Transcription plus abîmée que celle du fichier autonome** : `Jjustice`, `iiotaires`,
`notaiiat`, `RFPUBLIQUE`, `NANPHY`, `Licutenant`, `Jaeques A. FranQois`, `arücle`,
`Constiotution`. Les coquilles sûres sont corrigées par table explicite dans
`extract_compilation.py` ; le reste appelle une relecture.

⚠️ **Piège rencontré** : les articles 37 et 38 de la loi de 1919 sont écrits « **Art 37-** »
(forme abrégée, sans « icle » ni point). Ne pas l'admettre faisait perdre ces deux articles
**et les huit suivants**, le garde séquentiel s'arrêtant au premier trou. Toujours accepter
`Art.` autant que `Article`.

---

## 6. Travail demandé

### Lot A — Téléversement du décret-loi de 1969
Source `DECRET_LOI_NOTARIAT_1969`, thèmes `justice` (principal) + `droit-civil`.
Données prêtes dans `scripts/data/notariat-1969/` : `bodyOriginal.txt`, `structure.json`
(toc 10 en-têtes + 80 libellés), `sommaire-index.json`. Sommaire et index à reprendre des
`.docx` livrés (ou du JSON, identique). Patron : `_import-decret-bail-pro.ts`.

### Lot B — Les sept textes de la compilation
Données prêtes dans `scripts/data/notariat-compilation/` : `textes.json` (corps + articles
par texte) et `sommaire-index.json`. Sommaire et index livrés en `.docx`, une section par
texte. Mêmes thèmes que le lot A. Sources suggérées : `LOI_NOTARIAT_1862`,
`LOI_NOTARIAT_1877`, `LOI_NOTARIAT_1919`, `ARRETE_NOTARIAT_EXAMEN_1919`,
`DECRET_LOI_NOTARIAT_1941`, `DECRET_NOTARIAT_1974`, `DECRET_NOTARIAT_1986`.

### Lot C — Overlays du décret de 1969  ⚠️ *le cœur du dossier*

| Article | Opération | Statut | Ancienne version repliable |
|---|---|---|---|
| **3** | réécrit par le D. 1974 **puis** par le D. 1986 | `modifié` | **les DEUX** états antérieurs (1969 et 1974) |
| **30** | premier paragraphe réécrit par la loi du 14 févr. 2017 | `modifié` | paragraphe de 1969 |
| **76** | abrogé par l'art. 2 du D. 1974 | `abrogé` | texte de 1969, replié |

Pour l'article 3, la chaîne compte **trois états** : présenter la version 1986 comme texte
principal, et replier les versions 1969 et 1974 dans l'ordre chronologique — c'est le seul
article du corpus à porter deux amendements successifs.

Notes connexes cliquables : art. 3 → D. 1974 et D. 1986 · art. 30 → loi de 2017 · art. 76 →
D. 1974.

### Lot D — Overlay de la loi de 1919
Son **article 30** est réécrit par le décret-loi du 20 juin 1941 (Lescot) : même traitement —
`modifié`, version de 1919 repliable, renvoi vers le décret-loi de 1941.
De même, les **articles 32 et 33 de la loi de 1862** sont réécrits par la loi du 8 août 1877.

### Lot E — Renvois croisés réciproques
- Depuis la **loi de 2017**, art. 5 → note connexe vers le décret-loi de 1969, ancre `art-30`.
- Depuis le **décret de 2015**, art. 5 → même renvoi, avec la mention que le texte est
  supplanté.
- Ces deux textes doivent donc être téléversés **avant** ce lot (cf.
  `docs/prompt-signature-echanges-administration-electroniques.md`).
- Depuis chaque texte modificateur (1877, 1941, 1974, 1986) → renvoi vers l'article qu'il
  modifie, et réciproquement.

---

## 7. Pièges

1. **Ne pas se fier aux en-têtes détectés par motif** : ils sont corrompus. La charpente est
   déclarée explicitement — si le fichier source change, revérifier les bornes.
2. **Balayage séquentiel des têtes d'article** : chercher le numéro N à partir de la fin du
   N-1. Un découpage paragraphe par paragraphe ne voit qu'une tête par paragraphe — l'article
   49 était niché dans le 48. Et cela neutralise les citations (« l'Article 27 du Code Rural »,
   « l'Article 22 du présent Décret ») qui, sinon, passeraient pour des têtes.
3. **Ne jamais inclure le point ni la virgule** dans le nettoyage de fin de bloc : la première
   version du parseur amputait la ponctuation finale de chaque article.
4. **Tiret d'introduction** : `Article 30. — ` — la capture de la tête doit consommer le tiret,
   sinon il se double avec celui que l'on repose.
5. **Tarif de l'article 54** : ne jamais « corriger » un montant par déduction.
6. **`.env` pointe sur la base de PRODUCTION** — sauvegarder avant écriture.
7. **Travail concurrent** : `src/app/[locale]/(app)/doc/[id]/page.tsx` est partagé (la cliente
   intègre d'autres textes en parallèle) ; n'y faire que des ajouts chirurgicaux aux deux `Set`
   de sources, et ne pas commiter le travail d'autrui.

---

## 8. Recette

- [ ] 80 articles, 10 en-têtes, segmentation `segmentAnnotated` = 10/10 et 80/80 (déjà vérifié
      sur les données préparées).
- [ ] Sommaire et index affichés dans les panneaux latéraux ; **0 renvoi mort** ; couverture
      80/80.
- [ ] Article 30 : version 2017 en texte principal, pastille « modifié », version 1969
      repliable, renvoi cliquable vers la loi de 2017 (art. 5).
- [ ] Les 27 lignes signalées ont été relues (ou l'avertissement sur le tarif est en place).
- [ ] Article 3 : version **1986** en texte principal ; versions 1969 et 1974 repliées dans
      l'ordre chronologique ; article 76 marqué « abrogé », texte replié.
- [ ] Les 7 textes de la compilation sont publiés ; le décret de 1969 n'y est **pas**
      dupliqué ; la loi de 1951 sur l'expropriation n'est **pas** versée au dossier notariat.
- [ ] Loi de 1919 : art. 30 « modifié » (décret-loi de 1941). Loi de 1862 : art. 32 et 33
      « modifiés » (loi de 1877).
- [ ] Thèmes : `justice` (principal) + `droit-civil`.
- [ ] Vocabulaire de statut inchangé — `npx tsx scripts/_audit-statuts.ts` : 0 écart.
- [ ] Recherche : « notaire », « minute », « grosse », « cautionnement », « répertoire »
      remontent le texte.
- [ ] Idempotence : chaque script relancé deux fois ne produit ni doublon ni écart.

---

## 9. Chaîne de production (versionnée)

```
scripts/data/notariat-1969/
  parse_notariat.py            réparation OCR + charpente → bodyOriginal.txt, structure.json
  render_sommaire_index.py     corrections éditoriales + rendu des deux .docx
scripts/_gen-notariat-sommaire-index.ts    rubriques + sujets (IA, incrémental)

scripts/data/notariat-compilation/
  extract_compilation.py       découpe en 7 textes (2 blocs écartés) → textes.json
  render_compilation.py        normalisation + rendu des deux .docx
scripts/_gen-notariat-compilation.ts       rubriques + sujets des 7 textes (IA, incrémental)
```

Tout est rejouable : `python3 … parse_notariat.py` puis `npx tsx …` puis
`python3 … render_sommaire_index.py`.
