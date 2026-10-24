# Prompt — Audit du Code du travail, mot à mot et alinéa par alinéa, contre le fac-similé

> **Demande de Me Vaval (23 oct. 2026)** : « générer un prompt pour auditer le code du travail et revoir les sauts de
> ligne et réviser le contenu mot pour mot. » Pièce fournie : `~/Library/CloudStorage/Dropbox/Moniteur/code_du_travail.pdf`
> (J.-F. Salès, *Code du travail de la République d'Haïti*, Presses de l'Université Quisqueya, décembre 1992).
> Modèles : [prompt-audit-code-procedure-civile-mot-a-mot.md](prompt-audit-code-procedure-civile-mot-a-mot.md) et
> [livraison-cpc-mot-a-mot.md](livraison-cpc-mot-a-mot.md) — la chaîne de collation du CPC se réutilise, adaptée (§ 7).

Tu audites la fiche **Code du Travail** de la Législation annotée. Pour chaque article, tu établis :
1. **le mot à mot** : le texte en base est-il, lettre pour lettre, celui du livre ?
2. **les sauts de ligne** : chaque alinéa et chaque point d'énumération du livre est-il une ligne en base, et une seule,
   avec son **marqueur** (« a) », « 1°) », « • ») ?

**Tu ne corriges rien tant que le rapport n'est pas validé** (§ 9). Tu produis un relevé exhaustif, prouvé sur
l'image, des écarts classés par nature, puis un correctif qui ne s'exécute que sur les natures validées.

> **Décisions de Me Vaval déjà prises sur les autres codes** — elles valent ici sauf avis contraire :
>
> | Décision (texte de Me Vaval) | Ce que tu en fais pour le Code du travail |
> | --- | --- |
> | coquilles du livre : « uniquement corriger ne pas besoin de signaler » | la base porte la forme correcte, sans note (§ 4) |
> | « le contenu du livre prévaut. corriger ce qui est en base. » | hors coquille évidente, le texte du livre gagne… |
> | « Le Moniteur prévaut » (29 août : entre le J.O. et une édition privée, le J.O. est le texte) | …sauf là où le J.O. est au corpus : il prime sur Salès (§ 2) |
> | gloses de l'éditeur : « les deplacer dans anotations » | tout intrus d'appareil sort du corps vers les annotations, jamais supprimé |
> | « D. » = « Décret », et lien quand l'acte est en base | marques de modification et renvois d'actes, `annotations.actesLies` (§ 6.7) |
> | typographie du Code civil : « oui uniformiser » (CPC, 18 oct.) | **à confirmer pour ce code** (§ 4.1, § 9) |
> | listes : « mettre la liste des jours en bullet points » (20 oct.) | une énumération s'affiche en liste ; **le marqueur est celui du livre** (§ 5, § 6.1) |
> | « italique = abrogé » (Code civil) | **ne s'applique pas** : ici l'italique est celui des extraits d'arrêts (§ 3) |

---

## § 0. Règles absolues

- **`.env` pointe sur la base de PRODUCTION** (Supabase). Toute écriture est une écriture en production.
- **Jamais de ré-import.** La fiche (`cmr102ish0012ttoijkh8f31e`, `source = CODE_TRAVAIL_ANNOTE`) a été enrichie en place
  depuis l'import du 30 juin : repli « Constitution de 1987 » de l'art. 6 et re-clef de sa jurisprudence (13 juil.),
  reclassement en LEGISLATION (17 oct.), listes à puces des art. 41, 42, 45, 110 (20 oct.). L'importeur
  (`parse_ct.py`, `_import-code-travail.ts`) n'est **pas au dépôt** et recrée les défauts qu'on a réparés. On corrige **en
  place**.
- **Ne touche pas une ligne d'en-tête** hors de la procédure du § 6.2. Le lecteur reconnaît un intitulé à l'**égalité
  exacte** de la ligne et du libellé de table attendu (table parcourue dans l'ordre) ; les clés de jurisprudence
  `sec-K|art-N` en découlent. Un intitulé ajouté change la clé de tous les articles qui le suivent dans sa section :
  leurs notes se **re-clefent** dans la même écriture, ou elles deviennent orphelines.
- **Les annexes renumérotent depuis l'article 1** (472 blocs d'article homonymes, sans ancre). Les clés de
  jurisprudence sont qualifiées par section ; les replis `connexe` sont rangés par ancre (`art-N`) et ne s'attachent
  qu'au bloc ancré (correctif du lecteur `576675a`, 20 oct. — **à déployer**). Ne crée **aucune** ancre `art-N` dans une annexe.
- **L'image prévaut.** La couche texte est un OCR Acrobat Paper Capture : elle lit « lère » pour « 1ère »,
  « !'Organisation », « TRA V AIL », « <légats » pour « dégats », « é$alité », « étran~ers », perd la graisse d'une tête
  sur deux, et **inverse des lignes** (art. 94 : « e ) les / d) agences… »). Elle sert à la **géométrie**, et de second
  témoin — jamais d'arbitre.
- **Claude (vision) normalise ce qu'il lit** (accents, coquilles réparées) : aucun mot ne se décide sur une seule
  lecture par un modèle. Deux témoins, et l'image regardée en cas de désaccord.
- **Le dépôt GitHub est PUBLIC** : aucune image du fac-similé n'y entre ; recadrages dans le scratchpad ou dans
  `~/Library/CloudStorage/Dropbox/Lam Veritab/audit-code-travail/`, hors de `lam-veritab/`.
- Avant tout `--commit` et tout commit : `npx tsx scripts/verifier-empreintes-donnees.ts` **seul**, sortie lue.
  `git add` fichier par fichier ; jamais `tsconfig.json` ni le travail d'une autre session.
- Écritures : un seul fil (`connection_limit=1`) ; **toute écriture sur cette fiche dépasse 5 s** (trigger `tsvector` sur
  468 000 caractères) → transaction à 120 s au moins ; ajoute `socket_timeout=300&connect_timeout=30` à l'URL **dans
  l'environnement du processus** (jamais dans `.env`) : le Mac se met en veille couvercle fermé et laisse sinon la
  transaction pendue. Verrou optimiste sur `updatedAt`.

---

## § 1. État mesuré (23 oct. 2026)

| Élément | Valeur |
| --- | --- |
| Fiche | `cmr102ish0012ttoijkh8f31e`, `type=LEGISLATION`, `source=CODE_TRAVAIL_ANNOTE`, `number = « Décret du 24 février 1984 »` ; importée le 30 juin depuis `~/Downloads/Code_du_travail_annote_RECONSTITUE_2.docx` (+ `INDEX ALPHABÉTIQUE DES MATIÈRES.docx`) |
| Corps | `bodyOriginal`, **3 557 lignes** = **Code 1 182** (jusqu'à « ANNEXE I ») + **annexes 2 375** ; `bodyClean` null |
| Convention | **une ligne = un alinéa** ; tête « **Article N.** » (forme du livre) en tête de la ligne du 1er alinéa ; annexes : « Article N.- » là où leur source l'imprime (33) |
| Articles du Code | **516**, ancrés `art-1` → `art-516`, sans lacune ni doublon ; 0 tête seule ; 0 décimal |
| Intitulés (`toc`) | **210** : 5 de page de titre · 28 TITRES/LOIS (niv. 1) · 112 intitulés de niv. 2 · 41 chapitres · 11 sections · **13 annexes** (I à VIII, Règlements du Tribunal spécial, et 4 textes du salaire minimum ajoutés en juillet depuis les docx officiels : Loi du 6 oct. 2009, arrêtés de 2017, 2022, 2026) |
| Jurisprudence | **154 clés, 1 100 notes** (`ref` + `excerpt`, 922 avec renvoi RAEJH), 314 arrêts distincts ; **0 clé orpheline** |
| Autres annotations | `connexe` : 1 (art. 6, Constitution) — le 2ᵉ (art. 110, décret du 11 déc. 2024 sur les fêtes légales) est **prêt, non écrit** (`scripts/connexe-fetes-legales-2024-code-travail.tsx`, attend le déploiement de `576675a`) · index : **652 entrées** · `ArticleVersion` 0 · `status` 0 · `oldVersions` 0 |
| Typographie (Code) | apostrophes **’ 1 840 / ' 0** · « ; » collé 343 / précédé d'une espace 0 · « : » 113 / 0 · insécables, tabulations, lignes vides : **0** (fiche entière : ’ 4 420, « ; » 685, « : » 403) |
| Typographie (annexes) | **441 lignes vides**, **199 tabulations**, **228 insécables** · notes « * » : 12 lignes (« * = Modifié depuis par le Décret du 27 mai 1986. », « * Voir l'Annexe VII… », séparateurs « ***** ») |

**Contrôles mécaniques sur le Code** :

| Signal | Nombre | Lecture |
| --- | ---: | --- |
| **points d'énumération sans marqueur** | **326 lignes** en minuscule, dans **77 articles** (22 ×7, 30 ×8, 65 ×11, 94 ×12…) | le livre les numérote « a) », « b) »… (**267** points « a) » dans la couche texte du Code, 40 « 1°) », 63 « • ») ; la base a perdu **tous** les marqueurs (0 « a) », 0 « 1°) ») ; le lecteur **recoud** ces lignes en un seul paragraphe (§ 6.1) |
| puces « • » en base | 25 | toutes posées le 20 oct. (art. 41, 42, 45, 110) — voir § 6.1 |
| intitulés **collés dans l'article qui précède** | 7 lignes | « Section II » + « De la résiliation … par le consentement mutuel des parties » (art. 38), « Section III » + « … par l'une des parties » (art. 40), « Section II » (art. 139), « Section V » (art. 158), « Disposition générale » (art. 480) |
| intitulés **absents** | à établir | le sommaire du livre porte « Obligations de l'employeur » (p. 21), « De plein droit » (p. 29), « Pourboire » (p. 90), « Salaire annuel complémentaire ou boni » (p. 92) : aucune ligne en base ; les sections III et IV du chapitre « Des salaires » manquent (la base passe de « Section II » à « Section V ») |
| intitulé **fusionné** | 1 | « Chapitre III — Des conflits collectifs de travail Règlements amiables Conciliation » (trois intitulés en un) |
| glose de l'éditeur dans le corps | ≥ 1 | « (Voir également à l'Annexe IV, la Loi du 15 septembre 1980 … Le Moniteur No. 69 du 27 septembre 1984.) » sous « Chapitre VI — Des salaires » |
| lignes rendues en **gras** dans un article | 12 | les 4 « Section N » ci-dessus ; « Disposition générale » collée à l'art. 480 ; les 7 lignes de signatures de fin de décret (« Jean-claude DUVALIER », les ministres), à l'art. 516 |

### Ce qui a déjà été fait — et ce qui ne l'a jamais été

| Date | Passe |
| --- | --- |
| 30 juin | import depuis le docx reconstitué ; jurisprudence sortie du corps (0 fuite vérifiée) ; sommaire et index imprimés retirés |
| 13 juil. | note « * Constitution de 1987 » de l'art. 6 → repli `connexe` ; jurisprudence re-clefée `sec-7\|art-35` → `sec-7\|art-6` |
| 17 oct. | type DOCTRINE → LEGISLATION |
| 20 oct. | listes à puces : art. 110 (fêtes légales), 45 (barème du préavis), 41 et 42 (motifs de résiliation) — texte fourni par Me Vaval pour 41, 42, 45 |

**Jamais fait** : une collation article par article, en mots ET en alinéas, contre l'image.

---

## § 2. Les témoins, et leur rang

| Rang | Témoin | Vaut pour | Ne vaut pas pour |
| --- | --- | --- | --- |
| **0 — texte** | le **J.O.** : *Le Moniteur* n° 18-A de 1984 (Index : « Décret harmonisant le Code du Travail voté le 12 septembre 1961… ») | tout le Code | **ABSENT** — ni en base (seul le n° 18 y est), ni sur le disque (`1981-1990/1984 par numéro/` n'a que le n° 18) ; à demander (§ 9) |
| **1 — arbitre** | **image** du fac-similé (PyMuPDF, ≥ 300 dpi) | tout | — |
| 2 | **Tesseract 5.5.2** `fra`, sur l'image où tout ce qui n'est pas une ligne de loi est blanchi | second témoin indépendant, mot par mot | ponctuation fine, chiffres romains, puces, points de conduite |
| 3 | **couche Acrobat** | géométrie ; soutien d'une lecture de la base | **pas indépendant de la base** : le docx d'import en descend ; `code_du_travail.docx` (Dropbox, 15 Mo) en est l'export |
| 3 bis | **le second passage du scan** : les folios 213 → 258 sont scannés **deux fois** (PDF 230-273 et 274-319) | deux OCR indépendants de la même page | — |
| 4 | **le J.O. des annexes**, là où il est au corpus : *Le Moniteur* n° 46 du 9 juin 1986 (`cmsxbu65w0010fmjgf7l3awlp`, décret du 27 mai 1986, Annexe I) ; le Code pénal (`CODE_PENAL_ANNOTE`, Annexe VII) ; le Code de procédure civile (`CODE_PROCEDURE_CIVILE`, audité le 18 oct., Annexe II — **attention** : extraits de 1992, vérifier la numérotation) ; les `Officiel_*.docx` du salaire minimum (`Dropbox/Moniteur/Code du travail/`) | les annexes (lot 2) | le Code : aucun |
| ✗ | `Code_du_travail_annote*.docx`, `…RECONSTITUE_*.docx` | rien : c'est la **source de la base** | — |

**Règle de décision — mots** : base = Tesseract (au bruit d'OCR près, § 4) ⇒ conforme. Le bruit n'est admis que si la
couche Acrobat lit ce que porte la base, ou si l'écart se réduit à des espaces perdus, à une confusion classique
(« 1er/ler/Ier », « É/E », « l/1 »). **Quand Tesseract et Acrobat s'accordent contre la base, c'est l'image**, toujours.
Sur les folios 213-258, les **deux** passages Acrobat comptent comme deux lectures.

**Règle de décision — alinéas et marqueurs** : bornes et marqueurs de la base = ceux du livre (§ 3) ⇒ conforme. Sinon
l'image.

Tire au sort **5 % des articles « conformes »** et relis-les entiers sur l'image : c'est la mesure du tri. S'il
dépasse 0,5 % d'écart dans le texte de loi, resserre le tri.

---

## § 3. Anatomie du livre (mesurée)

**Le volume** — 462 pages PDF, page 409 × 622 pt, **une seule colonne**. Liminaires PDF 1-17 (page de titre p. 2,
table des matières PDF 6-10, préface PDF 12) · **Code : folios 1-220 = PDF 18-237** (index PDF = folio + 17) ·
Annexes I-VIII : folios 221-376 · index alphabétique : folios 377-398 (PDF 438-459).

⚠️ **Le scan n'est pas linéaire** :

| PDF | Folios | Note |
| --- | --- | --- |
| 18 → 273 | 1 → 258 | **les folios 255-256 manquent** (PDF 271 = 254, PDF 272 = 257) |
| 274 → 437 | 213 → 376 | **second passage** : 213-258 rescannés (dont 255-256, seuls ici : PDF 316-317) ; index PDF = folio + 61 |
| 438 → 459 | 377 → 398 | index alphabétique |

Le fichier `pages.csv` doit donc porter, pour chaque article, **le folio ET la ou les pages PDF**.

| Strate | Composition (couche texte) | Ce qu'en fait la base |
| --- | --- | --- |
| **texte de loi** | Times romain **11,9-12,4 pt**, pas de ligne ≈ 11,5-12 pt ; un **nouvel alinéa = retrait de première ligne** (x + 18-22 pt), **pas** d'interligne supplémentaire ; marge gauche ≈ 65 (page paire) / 68 (impaire) | corps, une ligne par alinéa |
| tête | « **Article N.** » (Times gras ≈ 11,3 pt ; la couche perd souvent la graisse), précédée d'un blanc ≈ 23 pt | début de la ligne du 1er alinéa |
| **énumération** | « a) … », « b) … » en retrait suspendu (≈ 267 dans le Code) ; « 1°) » (≈ 40) ; puces « • » (≈ 63 ; art. 1, art. 110) | un point = une ligne, **marqueur perdu** (§ 6.1) |
| barème | lignes à **points de conduite** (« de 3 mois à 12 mois de service ........ 15 jours », art. 45) | « . . . » (§ 6.1) |
| **intitulés** | « TITRE I », « LOI No. II », « Chapitre VI » puis son titre (« Du préavis ou délai congé ») en Helvetica gras 13-16 pt ; « Section II » puis son titre | table ; certains **collés** ou **absents** (§ 6.2) |
| **jurisprudence** | rubrique « *Jurisprudence* » soulignée ; arrêt « **3. Arrêt du 11 décembre 1978, 1ère section, Mireille ADAM c. Boucard & Co.** » (Times gras ≈ 10,3) ; extrait « "Attendu que…" » en **Helvetica oblique ≈ 7,9 pt** | `annotations.jurisprudence` (`ref` = l'intitulé de l'arrêt, `excerpt` = l'extrait) |
| renvois de l'éditeur | « (Voir également à l'Annexe IV…) », notes « * … » | intrus du corps (§ 6.4) |
| titres courants, folio | « Code du Travail annoté » (pages paires) / « Me. Jean-Frédéric Salès » (impaires), Helvetica oblique 9,5 ; « TITRE I - 41 » en pied ; **filets décoratifs** lus par l'OCR comme des chaînes « M& Ml ;:::: » | ignorés |

**Pièges de la page** :
- l'**alinéa se repère au retrait**, pas à l'interligne (contrairement au CPC) ; le retrait d'un point d'énumération
  (« a) » à x ≈ 89) est plus fort que celui d'un alinéa : ne pas confondre la suite d'un point (x ≈ 104) avec un
  nouvel alinéa ;
- un alinéa traverse les **sauts de page** et la **jurisprudence** s'intercale entre deux articles (jamais au milieu
  d'un alinéa — à vérifier) ;
- les **césures** se recousent (« énoncia- / tions ») ; un trait d'union réel se garde : l'image tranche ;
- la couche **inverse ou mêle** parfois deux lignes voisines (art. 94, points d) et e)) : l'ordre se lit sur l'image ;
- une citation de décret modificatif **numérote ses propres articles** au milieu du Code (art. 110 : « Article 1. Dès
  la publication du présent Décret… », « Article 2. … ») : ce ne sont pas des articles du Code.

---

## § 4. Ce que « mot à mot » veut dire

**Est un écart** toute différence de lettre, d'accent, de chiffre, de ponctuation, de majuscule ou d'ordre entre la
base et le livre — y compris quand la base a « raison ». Si l'image confirme le livre et que la faute est **évidente et
sans portée**, c'est une **coquille du livre** : la base garde la forme correcte, sans note (décision). Une divergence qui
peut changer le sens va au rapport.

**Natures d'écart** (liste FERMÉE) : `mot` · `ocr` (séquelle d'OCR en base) · `coquille-du-livre` · `ponctuation` ·
`casse-accent` · `alinea-fusionne` · `alinea-scinde` · `marqueur` (« a) », « 1°) », « • » perdu, faux ou ajouté) ·
`enumeration` (point fusionné avec le précédent ou scindé) · `ordre` (lignes interverties) · `cesure` ·
`intrus-appareil` (glose, renvoi, note « * » dans le corps) · `intrus-structure` (intitulé, signature, titre courant
collé dans un article) · `intitule` (absent de la table, fusionné, ou libellé différent) · `manque` · `typographie`.

### 4.1 Typographie

| Élément | Convention | Statut |
| --- | --- | --- |
| tête | « **Article N.** » — la forme du livre ; annexes : la forme de leur source | conforme (516) |
| marqueurs | ceux du livre, tels quels : « a) », « 1°) », « • » | **à restaurer** (§ 6.1) |
| marques d'acte | « D. » → « **Décret** », « L. » → « **Loi** », « D-L » → « **Décret-loi** » | décidé (Code civil, CPC) |
| apostrophe | droite « ' » (convention du Code civil) | **à valider** : 1 840 courbes au Code, 4 420 sur la fiche |
| avant « ; » et « : » | une espace (convention du Code civil) | **à valider** : 343 + 113 au Code, 685 + 403 sur la fiche |
| espaces | ni insécable, ni tabulation, ni double espace, **ni ligne vide** | s'applique aux annexes (228 · 199 · 441) |
| à ne pas toucher | les lignes d'en-tête, « .- » des têtes d'annexe, les points de conduite des barèmes | — |

---

## § 5. Ce que « sauts de ligne » veut dire

1. **Un alinéa du livre = une ligne de la base.** Jamais la ligne imprimée.
2. « **Article N.** » ouvre la ligne de son premier alinéa : aucune tête seule.
3. **Énumération** : chaque point est une ligne **et porte le marqueur du livre**. C'est le marqueur qui fait la liste
   au lecteur (`parseOfficialText` : « a) » et « 1°) » → liste numérotée au marqueur d'origine, « • » → liste à puces) ;
   sans lui, une ligne qui commence en minuscule est **recousue** au paragraphe précédent, et une ligne courte sans
   ponctuation finale s'affiche en **intertitre gras**.
4. Un alinéa qui traverse une page ou la jurisprudence reste **une** ligne.
5. **Un intitulé n'est jamais une ligne d'article** : c'est un intitulé de la table (§ 6.2). « Section II » et son titre
   forment **un** intitulé (« Section II — Du paiement des salaires »), comme « Chapitre VI — … ».
6. Aucune ligne vide ; aucun alinéa à cheval sur deux articles.

---

## § 6. Constats déjà établis — à traiter en tête

### 6.1 Les marqueurs d'énumération perdus (326 lignes, 77 articles)
Au livre, « Article 22. Le contrat écrit contiendra les énonciations suivantes: / a) les noms, prénoms… / b)
l'indication précise… » ; en base, « les noms, prénoms… » sans « a) », et le lecteur recoud les sept points en un pavé.
Même chose aux art. 30, 31, 37, 38, 65, 75, 87, 89, 94… Correction : **le marqueur du livre, tel qu'il est imprimé**,
en tête de chaque point (« a) », « 1°) », « • »), sur preuve de l'image page par page ; ni renumérotation, ni marqueur
inventé. Contrôle de rendu : chaque article énumératif rend une `<ol>` ou une `<ul>`, autant de points qu'au livre.

⚠️ **Les quatre articles traités le 20 oct. sur décision de Me Vaval** ne suivent pas tous le livre :

| Art. | Le livre | La base depuis le 20 oct. |
| --- | --- | --- |
| 110 | puces « • » (citation du décret du 23 mai 1989) | « • » — **conforme** |
| 41 | « a) », « b) »… | « • », découpage du livre |
| 42 | « a) », « b) »… ; le point a) contient « … menaces; a provoqué par sa conduite… » | « • », **découpage de Me Vaval** : « a provoqué… » est un point à part ; l'absence et le refus des mesures de prévention en font un seul, de même l'inaptitude et la condamnation |
| 45 | barème **sans puces**, à points de conduite ; « **et** à partir de 10 ans… » en tête de la 5ᵉ ligne | « • » ; « et » déplacé à la fin du 4ᵉ point |

Tu ne reviens sur aucun de ces quatre articles sans décision (§ 9).

### 6.2 Les intitulés : collés, absents, fusionnés
- **Collés** à la fin de l'article qui précède : « Section II » + « De la résiliation du contrat individuel de travail par
  le consentement mutuel des parties » (art. 38), « Section III » + « … par l'une des parties » (art. 40), « Section II »
  (art. 139, son titre « Du paiement des salaires » est déjà à la table), « Section V » (art. 158, idem « Dispositions
  générales »), « Disposition générale » (art. 480, intitulé du livre p. 181).
- **Absents** (sommaire du livre, à confirmer sur la page) : « Obligations de l'employeur » (p. 21), « De plein droit »
  — section I de la résiliation (p. 29), « Pourboire » (p. 90), « Salaire annuel complémentaire ou boni » (p. 92).
- **Fusionné** : « Chapitre III — Des conflits collectifs de travail Règlements amiables Conciliation » → le chapitre et
  ses deux subdivisions, chacun à son rang.

Correction synchrone (comme au CPC, `promouvoir-intitule`) : la ligne devient un intitulé de la table (`toc` +
`navToc`, au rang voulu, ancre neuve, dans l'ordre) et quitte l'article ; **re-clef** des annotations des articles qui
suivent dans la section ; contrôle : 0 clé orpheline, ancres du menu = ancres de la table. **Change le sommaire : à
valider** (§ 9).

### 6.3 Les annexes (lot 2)
Les annexes I à VIII sont au livre (folios 221-376). Les 4 textes du salaire minimum (`sec-207` → `sec-210`) **n'y sont
pas** : ils se collationnent contre leurs `Officiel_*.docx`, jamais contre Salès. L'Annexe I se collationne d'abord
contre le J.O. (*Le Moniteur* n° 46 de 1986, en base). Les 441 lignes vides, 199 tabulations et 228 insécables sont
toutes dans les annexes.

### 6.4 Intrus du corps
- sous « Chapitre VI — Des salaires » : « (Voir également à l'Annexe IV, la Loi du 15 septembre 1980 … ) » → annotations ;
- annexes : les notes « * = Modifié depuis par le Décret du 27 mai 1986. », « * Voir l'Annexe VII… », « ** Les articles 49
  à 71… », et les séparateurs « ***** » → annotations ou retrait (le séparateur n'est pas du texte) ;
- fin de l'art. 516 : les signatures de la formule de promulgation restent au corps (elles sont au J.O.) mais ne
  doivent pas s'afficher en intertitres : à présenter comme bloc final du décret.

### 6.5 Écarts de lecture déjà vus (premier tri)
- art. 94 : la couche Acrobat inverse les points d) et e) — l'ordre de la base (« les agences, les bureaux d'affaires; »
  puis « toute entreprise effectuant des opérations de change… ») est à confirmer sur l'image ;
- « dégats » (art. 41, 42 : base et livre) — forme du livre, à garder ou à corriger selon la règle des coquilles.

### 6.6 L'art. 110 et les fêtes légales
Le repli « Législation connexe » vers le décret du 11 déc. 2024 est décidé (Me Vaval, 20 oct. : « ne pas mettre abrogé
mais ajouter la référence du décret de 2024 en repli avec la liste des fêtes légales correspondantes ») et prêt ; il
s'écrit **après** le déploiement du correctif du lecteur. Ne pas le refaire.

### 6.7 Les actes liés
Inventorie les actes nommés dans le corps du Code (« Décret du 7 novembre 1985 - Moniteur No. 79 », « Décret du
23 mai 1989 », « Décret du 27 mai 1986 »…) : ceux dont le texte ou le Moniteur est en base se lient
(`annotations.actesLies`, rendu `src/lib/doc/acterefs.ts`), avec le **nom complet** (nature + date + objet). Jamais une
clause-balai.

---

## § 7. Méthode

**Étape 0 — Instantané** de `bodyOriginal`, `annotationsJson` (empreintes SHA-256), hors dépôt
(`~/Library/CloudStorage/Dropbox/Lam Veritab/audit-code-travail/`). Vérificateur seul.

**Étape 1 — Le livre** : `scripts/collationner-ct-livre.py "<pdf>" <travail> --pages 18-237`, adapté de
`collationner-cpc-livre.py` (même environnement : `/usr/bin/python3`, PyMuPDF 1.26, Tesseract) :
- **une colonne** et **pas de notes de marge** : retirer ces deux étages ;
- strates par **police et corps** (§ 3) : loi (Times ≈ 12), arrêt (Times ≈ 10,3), extrait (Helvetica oblique ≈ 7,9),
  intitulé (Helvetica gras), titre courant et folio ; filets décoratifs écartés ;
- alinéa = **retrait** de première ligne mesuré par page ; marqueur d'énumération reconnu à la tête de ligne ;
- Tesseract sur l'image où seules les lignes de loi restent ;
- `pages.csv` : folio + page(s) PDF, en tenant compte du double passage (§ 3).
Contrôle : 516 têtes sur 516, en séquence (la couche n'en lit que ≈ 505 : les autres sur l'image).

**Étape 2 — Le tri** : `scripts/collationner-ct-comparer.py <travail> <instantané>` — par article : mots (base /
Tesseract / Acrobat ; sur 213-258, les deux passages), alinéas, **marqueurs**, ordre des points ; verdict conforme / à
regarder.

**Étape 3 — L'image**, par page : chaque article « à regarder » est lu sur l'image recadrée ; chaque écart reçoit sa
nature (§ 4), le texte du livre, celui de la base, le folio, la décision proposée. Le tirage de 5 % des conformes est
fait et son résultat écrit. Corrections en **remplacements programmés** sur le texte de la base (jamais retapés) ; tout
mot ajouté doit se lire dans Tesseract ou la couche Acrobat.

**Étape 4 — Intitulés** : chaque libellé de la table comparé à la page du livre ; les intitulés du § 6.2 relevés avec
leur rang.

**Étape 5 — Jurisprudence (contrôle léger)** : pour chaque note, l'intitulé `ref` (date, section, parties) contre l'arrêt
imprimé sous **le même article** — une note rangée sous le mauvais article est un défaut de structure. Les extraits ne
sont pas collationnés mot à mot dans ce lot (sauf avis contraire, § 9).

**Étape 6 — Lot 2, les annexes**, même méthode, témoins du § 2 rang 4.

**Étape 7 — Rapport, puis correctifs** (§ 8).

---

## § 8. Livrables

1. `scripts/collationner-ct-livre.py`, `scripts/collationner-ct-comparer.py` — lecture seule, rejouables.
2. `docs/livraison-ct-mot-a-mot/` — `pages.csv` (article → folio, page PDF), `ecarts.csv` (un écart par ligne : article,
   folio, nature, base, livre, décision, vu sur l'image), `operations.csv`.
3. `docs/livraison-ct-mot-a-mot.md` — méthode, taux du tri, décompte par nature, les écarts graves, ce qui n'a pas pu
   être tranché, les questions.
4. `scripts/corriger-ct-mot-a-mot.tsx` — sur le modèle de `corriger-cpc-mot-a-mot.tsx` (opérations `remplacer`,
   `retirer-ligne`, `promouvoir-intitule`, `deplacer-commentaire`, `developper-actes`, `actes-lies`) **+ `marqueurs`**
   (pose le marqueur du livre en tête d'une suite de points) ; à blanc par défaut, `--commit` pour écrire ; en place ; un
   intrus n'est **jamais supprimé**, il est déplacé ; journal avant/après ; `reindexDocument` ; `audit()` puis recompte.
5. **Garde-fous** : rien ne disparaît (mots ≥ 4 lettres retrouvés au corps ou à l'appareil, liste blanche explicite) ;
   lignes d'en-tête identiques hors § 6.2 validé ; 0 clé orpheline ; menu = table ; 516 têtes ; liens identiques ; le
   rendu (`AnnotatedText`) compte les mêmes liens et **autant de points de liste qu'au livre** ; les replis `connexe` de
   l'art. 6 (et 110) intacts.

---

## § 9. Ce qui reste à faire valider — avant le `--commit`

> **Tranché par Me Vaval (23 oct. 2026)** :
> - marqueurs du livre dans les 77 articles : « yes » ;
> - art. 41 et 42 : « go back to the book's letter and split » — les « a) » du livre et SON découpage ;
> - art. 45 : « books » — le barème du livre ;
> - typographie : « should be as in the rest of the platform » — mesuré sur les 308 fiches annotées le 23 oct. :
>   apostrophe **courbe** (211 fiches contre 97 ; le Code du travail l'a déjà) et **une espace avant « ; » et « : »**
>   (139 contre 82 ; 161 contre 72) ⇒ espace à ajouter au Code (343 + 113), apostrophes inchangées ;
> - lot 2 (annexes) et contrôle de la jurisprudence : « no » — hors de cette production.
>
> Restent ouverts : le J.O. n° 18-A (1), les intitulés (4).

1. **Le J.O.** : *Le Moniteur* n° 18-A de 1984 n'est ni en base ni sur le disque. Me Vaval l'a-t-elle ? S'il arrive, il
   devient le texte (« Le Moniteur prévaut ») et Salès passe témoin.
2. **Les quatre articles du 20 oct.** (§ 6.1) : art. 41 et 42 — garder les puces, ou rendre les « a) » du livre (et, au
   42, son découpage) ? art. 45 — garder les puces et « et » en fin de 4ᵉ point, ou revenir au barème du livre ?
3. **Les marqueurs** à restaurer dans les 77 articles (§ 6.1) : le marqueur du livre partout — c'est la règle proposée.
4. **Les intitulés** à ajouter, détacher ou séparer (§ 6.2) : ils changent le sommaire.
5. **La typographie** : apostrophe droite (1 840 au Code, 4 420 sur la fiche) et espace avant « ; : » (456 au Code, 1 088 sur la fiche) — la convention du Code civil, retenue
   pour le CPC, vaut-elle ici ?
6. Tout écart `mot`, `manque` ou `ordre` qui **change le sens**.
7. **Le lot 2** (annexes) et le **contrôle de la jurisprudence** (étape 5) : dans cette production, ou à part ?

Le reste — séquelles d'OCR, coquilles évidentes, césures, alinéas, intrus — s'applique sur la seule validation du
rapport.

---

## § 10. Contrôles de fin

| Contrôle | Attendu |
| --- | --- |
| articles placés au livre (folio + page PDF) | 516 / 516 |
| articles triangulés | 516 / 516 |
| écarts « à regarder » vus sur l'image | 100 % |
| taux d'erreur du tri (tirage de 5 % des conformes) | ≤ 0,5 %, chiffre publié |
| après correctif : points d'énumération sans marqueur / intitulés dans un article / gloses au corps | 0 / 0 / 0 |
| après correctif : lignes recousues par le lecteur qui sont des points au livre | 0 |
| après correctif : mots perdus hors liste blanche, clés orphelines, ancres de menu sans table | 0 / 0 / 0 |
| après correctif : « D. » d'acte | 0 |
| après correctif : `searchText` reconstruit, vérificateur d'empreintes | oui / « Rien à signaler » |

Ce qui n'a pas pu être tranché se dit, article par article, avec la raison.
