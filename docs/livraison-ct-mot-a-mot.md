# Livraison — Audit mot à mot et alinéa par alinéa du Code du travail

**23 octobre 2026.** Exécution de [prompt-audit-code-du-travail-mot-a-mot.md](prompt-audit-code-du-travail-mot-a-mot.md)
contre le fac-similé (J.-F. Salès, 1992, 462 p.), avec les décisions de Me Vaval du 23 oct. (§ 9 du prompt).

> **État : ÉCRIT EN PRODUCTION le 23 oct. 2026** — 108 opérations en deux écritures, typographie de la plateforme.
> Contrôles après écriture : 516 têtes, 0 clé de jurisprudence orpheline, annexes identiques à l'octet, replis
> `connexe` intacts, **365 points d'énumération portent un marqueur** dans 82 articles (25 avant, toutes posées le 20 oct.) —
> dont les 5 puces provisoires de l'art. 45 (§ 5).
> **24 oct. 2026 — seconde passe contre le J.O.** (*Le Moniteur* n° 18-A, scan fourni par Me Vaval) : le texte suit
> désormais le **Journal officiel** (« Le Moniteur prévaut ») — 702 leçons en 304 articles, 20 opérations d'intitulés
> (« yes »), marqueurs et alinéas du J.O. (§ 9).
> **Reste à écrire** : l'art. 45, après le déploiement de la règle du barème (§ 5).

---

## 1. En bref

| | |
| --- | --- |
| Articles collationnés | **516 / 516** (pages PDF 18-237 ; second scan des folios 213-220 lu aussi) |
| Tri automatique (base / Tesseract / couche Acrobat) | **359 conformes**, 157 à regarder |
| Lus sur l'image | **92 articles** : 74 « à regarder », **18 tirés au sort parmi les conformes** |
| Tirage de contrôle (5 % des conformes) | **0 écart dans le texte de loi sur 18** (une espace avant un astérisque d'appel, art. 211) |
| **Mots de la loi à corriger en base** | **2** (art. 133, art. 426) + 2 ponctuations rendues au livre (« etc... », art. 289 et 302) |
| Coquilles du livre que la base corrigeait déjà | 11 (gardées : décision du 18 oct.) |
| **Défauts de structure corrigés** | **340 marqueurs** du livre rendus · 20 alinéas fusionnés séparés · 8 alinéas coupés au changement de page recousus · 2 notes de l'éditeur sorties du corps |
| Typographie (« as in the rest of the platform ») | une espace avant « ; » et « : » (436 lignes) ; apostrophe courbe, déjà en place |

Le Code du travail en base est **fidèle au livre mot pour mot**. Ses défauts sont des défauts **de structure** : la
transcription d'import avait perdu **tous** les marqueurs d'énumération (« a) », « 1) », « 1. »), si bien que le lecteur
recousait chaque énumération en un seul paragraphe.

## 2. Ce qui a été corrigé

| Défaut | Articles | Correction |
| --- | ---: | --- |
| **Marqueurs perdus** : « Article 22. Le contrat écrit contiendra les énonciations suivantes: / les noms… » — au livre « a) les noms… » | **80** (22, 30, 31, 65, 75, 94, 189, 238, 308, 339, 394, 406, 439, 484…) | le marqueur imprimé, tel quel (« a) », « 1) », « 1. », « • ») ; le lecteur rend une vraie liste |
| **Alinéas fusionnés** : deux alinéas du livre sur une ligne | 20 (3, 4, 5, 8, 10, 14, 17, 33, 42, 264, 381, 435, 448, 451, 477, 480, 502, 516) | séparés |
| **Alinéas coupés au changement de page** (« … permanente ou » / « temporaire, … ») | 8 (2, 42, 99, 264, 437, 457, 499) | recousus |
| Art. 41 et 42 (puces du 20 oct.) | 2 | les « a) » du livre et **son** découpage (décision du 23 oct.) |
| Art. 12 : « 1. », « 2. », « 3. » | 1 | posés |
| « qu'il y aura **de** personnes » (art. 133) | 1 | « **des** personnes » (livre ; les deux OCR) |
| « com menceront » (art. 426) | 1 | « commenceront » |
| « etc. » (art. 289, 302) | 2 | « etc... », comme le livre |
| Notes de l'éditeur dans un article : « * Voir l'Annexe VII… » (art. 423), « * Extrait des Règlements… » (art. 504) | 2 | vers les annotations de l'article |
| Typographie | 436 lignes | une espace avant « ; » et « : » (hors deux chiffres) — mesure sur 308 fiches annotées : la plateforme l'emploie dans 139 fiches contre 82, et l'apostrophe courbe dans 211 contre 97 |

Le relevé : [`livraison-ct-mot-a-mot/ecarts.csv`](livraison-ct-mot-a-mot/ecarts.csv) (un écart lu sur l'image par
ligne), [`operations.csv`](livraison-ct-mot-a-mot/operations.csv), [`pages.csv`](livraison-ct-mot-a-mot/pages.csv)
(article → pages PDF, verdict du tri, lecture).

## 3. Les coquilles du livre (la base garde la bonne leçon)

86 « légitinité » · 93 « extratives », « batiments » · 140 « intégralemant » · 190 « (lock out) » (200-202 impriment
« lock-out ») · 307 « les document suivants » · 437 « Article 437. les visites » · 477 « entre-prises » · 516 « Minstre »
(deux fois).

Leçons du livre que la base **reproduit** (fautes d'origine, signalées, non touchées) : « dégats » (41, 42), « quelque
soit » (2), « concurence » (30), « nécéssité » (381), « occasionel » (399), « rebellions » (423), « cas prévues » (435),
« qu'il puissent » (439), « déterminants » (451), « infectueuses » (457).

## 4. Mesure du tri

- 18 articles tirés au hasard parmi les 359 « conformes » (graine 20261023), relus en entier sur l'image : **0 écart
  dans le texte de loi**.
- Les « à regarder » se sont résolus en : marqueurs et alinéas (§ 2), coquilles du livre (§ 3), et **bruit
  d'extraction** — Tesseract lit la puce « • » comme « e », « b) » comme « h) », perd les filets de points ; la couche
  Acrobat inverse deux points de l'art. 94 ; **deux pages sont des images sans couche texte** (PDF 121 et 181 : articles
  182-187, 393-398), lues par Tesseract seul puis sur l'image.

## 5. Le barème de l'art. 45 (et de l'art. 260)

Le livre compose ces barèmes en lignes à points de conduite, **sans marqueur** (« de 3 mois à 12 mois de service
.......... 15 jours »), et « **et** à partir de 10 ans… » ouvre la 5ᵉ ligne. Rendues telles quelles, ces lignes (qui
commencent en minuscule) seraient recousues par le lecteur en un paragraphe — le défaut d'origine. D'où une règle du
lecteur (`src/lib/doc/officiel.ts`, `BAREME_RE`) : une ligne à points de conduite terminée par une valeur chiffrée, qui
suit une autre ligne de barème ou une annonce « … : », reste seule et ne s'affiche jamais en intertitre (≤ 110
caractères). Effet mesuré sur les 858 documents qui ont des points de conduite : outre le Code du travail, des
sommaires et des listes d'éditions du Moniteur (Code fiscal 2026 n° 48-A : entrées du sommaire qui cessent d'être en
gras ; Moniteur n° 90 de 1991 : une pension par ligne au lieu de plusieurs recousues).

**L'art. 45 s'écrira après le déploiement de cette règle** (`corrections-ct-art45.json`, hors dépôt) : sans elle, le
barème redeviendrait un pavé. Jusque-là, il garde les puces du 20 oct.

## 6. Points à trancher

**Tranchés par Me Vaval (23 oct.)** : marqueurs du livre (« yes ») ; art. 41 et 42 (« go back to the book's letter and
split ») ; art. 45 (« books ») ; typographie (« should be as in the rest of the platform ») ; annexes et contrôle de la
jurisprudence hors de cette production (« no »).

**Restent ouverts :**
1. **Le J.O.** (*Le Moniteur* n° 18-A de 1984), ni en base ni sur le disque.
2. **Les intitulés** (ils changent le sommaire) :
   - **absents de la table**, imprimés au livre : « Obligations de l'employeur » (avant l'art. 31), « Section I — De la
     résiliation de plein droit du contrat individuel de travail » (avant l'art. 38), « Section III — Du pourboire »
     (avant l'art. 149), « Section IV — Du salaire annuel complémentaire ou boni » (avant l'art. 154), « Du pourvoi
     contre les jugements » (Titre VII) ;
   - **collés à la fin d'un article** : « Section II » + « De la résiliation … par le consentement mutuel des parties »
     (art. 38), « Section III » + « … par l'une des parties » (art. 40), « Section II » (art. 139), « Section V »
     (art. 158), « Disposition générale » et « De La Carte De Santé » (art. 480) ;
   - **fusionné** : « Chapitre III — Des conflits collectifs de travail Règlements amiables Conciliation » ;
   - **faux intitulé** : la suite de la note « * Extrait des Règlements Intérieurs du Tribunal Spécial… » (art. 504) a été
     importée comme un intitulé « TITRE VI: DE LA RECUSATION ET DU REPORT » suivi d'un « Article 22. Aucun plaideur… »,
     entre les art. 505 et 506 : à sortir du sommaire et à rattacher à la note.
3. **Les notes de l'éditeur sous un intitulé de chapitre** (« (Voir également à l'Annexe IV, la Loi du 15 septembre
   1980…) », « * = Modifié depuis par le Décret du 27 mai 1986. », « @ = Repris verbatim… ») : hors de tout article, et
   les signes « * » / « @ » des têtes d'article y renvoient — laissées en place.

## 7. Limites

- Les 341 articles conformes non tirés au sort n'ont pas été relus un par un : le tirage de 5 % les mesure.
- La jurisprudence (1 100 notes) et les annexes n'ont pas été collationnées (décision du 23 oct.).
- Le J.O. de 1984 manque : le livre de Salès sert de texte.

## 8. Rejouer

```bash
/usr/bin/python3 scripts/collationner-ct-livre.py "<code_du_travail.pdf>" <travail> --pages 18-237 --passage2 274-281
/usr/bin/python3 scripts/collationner-ct-comparer.py <travail> <instantané>
/usr/bin/python3 scripts/collationner-ct-livrables.py <dossier audit-code-travail>
npx tsx --tsconfig <tsconfig jsx> scripts/corriger-ct-mot-a-mot.tsx <corrections.json> --typographie            # à blanc
npx tsx --tsconfig <tsconfig jsx> scripts/corriger-ct-mot-a-mot.tsx <corrections.json> --typographie --commit   # écrire
```

L'instantané, les lectures sur l'image et les fichiers d'opérations sont **hors du dépôt** (public), dans
`~/Library/CloudStorage/Dropbox/Lam Veritab/audit-code-travail/`. Le correctif refuse d'écrire si la fiche a changé.

## 9. Seconde passe : le Journal officiel (24 oct. 2026)

Me Vaval a fourni le J.O. (*Le Moniteur* n° 18-A du 5 mars 1984 : scan de 37 pages,
`Dropbox/Moniteur/Code du travail_Le Moniteur No.18-A Lundi 5 Mars 1984.pdf`, et une transcription
`Code_du_travail_1984_Le_Moniteur_18-A_1.docx`). Le J.O. devient le texte ; Salès, un témoin.

**Témoins** : la transcription (faite par un outil : elle normalise) ; **Tesseract** sur le scan (couche texte du PDF
inutilisable) ; l'**image**. Tri : transcription = Tesseract contre la base ⇒ leçon du J.O. confirmée (tirage de 21 sur
l'image : 21 justes) ; Tesseract = base ⇒ erreur de la transcription ; sinon l'image (349 points, 7 lots).

| | |
| --- | --- |
| Écarts base (Salès) ↔ J.O. | 873 |
| **Leçons du J.O. écrites** | **702** (304 articles) — dont des mots (art. 2 « qu'elle », 14 « les travailleurs », 22 « devra être », 26 « Direction ou », 56 « reconduction »…), la casse et la ponctuation du J.O., et les chiffres sans les lettres que Salès ajoutait (« 50 o/o » pour « cinquante pour cent (50%) ») |
| Coquilles du J.O. (base gardée) | 29 (« incrire », « afflicitive », « conditons », « look », « emprisonement », « minimun »…) + « toute entreprises » (art. 94) |
| Césures et traits d'union de la transcription (base gardée) | 47 |
| Illisibles (marge rognée, base gardée) | 8 |
| Non appliqués, soumis | art. 422 « inviter » (J.O., lecture pâle) / « porter » ; art. 423 « Loi No 3 » (rogné) / « Loi No. 4 », « paragraphe » / « paragraphes … du Chapitre III », « Gdes 1.000.-- » / « 1.000 gourdes » |
| Art. 109, 110, 111 | **non touchés** : le J.O. de 1984 porte leur rédaction d'origine, abrogée (1985) ou réécrite (décret du 23 mai 1989) — la version en vigueur reste affichée |

**Intitulés** (Me Vaval : « yes » ; chacun vu au J.O.) : insérés — « Obligations de l'employeur » (avant l'art. 31),
« Section I — De la résiliation de plein droit… » (38), « Section III — Du pourboire » (149), « Section IV — Du salaire
annuel complémentaire ou boni » (154), « Règlements amiables » et « Conciliation » (171), « Du pourvoi contre les
jugements » (506) ; promus — Sections II et III de la résiliation (39, 41), « Disposition générale » (après 480) ;
renommés — Sections I, II, V des salaires, chapitre III des conflits ; **retiré** — le faux « TITRE VI: DE LA RECUSATION
ET DU REPORT » et son « Article 22 », suite de la note de l'art. 504 (rendus à ses annotations ; ses 8 arrêts sur la
récusation passent à l'art. 505). 20 clés de jurisprudence re-clefées, 0 orpheline.

**Marqueurs et alinéas du J.O.** : tirets « – » (art. 1, 19, 411, 413), « 1. 2. » (11), « 1) 2) 3) » (12), « 1) » à « 12) »
(94, le J.O. saute le 6) : rétabli) ; alinéas fondus (20, 81, 336) ou séparés (423) comme au J.O. ; **un alinéa manquait
en base** (art. 459 : « il est permis la création de cantines communes… »).

Au J.O., trois titres de chapitre sont fautifs et corrigés à la main sur l'exemplaire (Titre II ch. V et VI, Titre III
ch. II), et le chapitre I du contrat d'apprentissage porte le titre du chapitre I du Titre VI : la base garde les bons.

**Restent ouverts** : les quatre lectures soumises ci-dessus ; les notes de chapitre de Salès (« (Voir également…) »,
signes « * » et « @ ») absentes du J.O. ; la rédaction de 1984 des art. 109-111 en repli « Ancienne rédaction ».
