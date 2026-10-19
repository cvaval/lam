# Prompt — verser de nouvelles décisions dans le Recueil de jurisprudence

> À donner tel quel à une session de travail sur le dépôt `lam-veritab`.
> Chaque chiffre a été **mesuré** les 19 et 20 octobre 2026 — sur la base de production, sur
> les fichiers du disque, et en exécutant l'outillage existant sur le lot visé — puis
> **contre-mesuré par deux passes d'audit indépendantes** (quatre auditeurs, puis un cinquième
> sur la version corrigée) qui ont repris la première version de ce texte sur une centaine de
> points. Ce qui n'a pas été mesuré est dit tel quel. Quand deux mesures divergent selon
> l'extracteur, les deux sont données.

---

## L'état du Recueil — ce dans quoi tu verses

**1 343 décisions**, `type = 'JURISPRUDENCE'`, trois sources :

| source | décisions | ce que c'est |
|---|---|---|
| `CASSATION_1964_1965` | 80 | textes intégraux, formations 80/80, sommaires analytiques : règle de droit, question et motifs 80/80, résumé 61/80, dispositif 29/80, `compositionNote` 42/80 |
| `CASSATION_1965_1966` | 82 | textes intégraux, formations 82/82, **aucun sommaire** (règle 0, dispositif 0, résumé 0) |
| `RAEJH_SALES` | 1 181 | **extraits seulement** — fiches de 1 358 c. en médiane ouvrant par « Extraits seulement — le texte intégral de cet arrêt n’est pas au corpus » (apostrophe **courbe**) ; 0 formation ; 2 923 extraits (2 683 sur ces fiches, 240 reportés sur les 162 arrêts à texte intégral) sous 741 notions portant des extraits (745 dans la source) ; fac-similé = les trois tomes |

⚠️ **Les 162 arrêts à texte intégral n'ont aucun fac-similé attaché** (`sourcePdfUrl` 0/80 et
0/82). Le bulletin ci-dessous sera le premier texte intégral avec son PDF.

La rubrique (`/{locale}/jurisprudence`) se lit **par volume d'abord, par notion ensuite** :
**27 volumes**, un par exercice judiciaire de 1963-1964 à 1989-1990, `recueilRef` =
« Cour de Cassation — exercice AAAA-AAAA » (suffixe « (recueil complet) » pour 1964-1965 et
1965-1966 seulement — `rangVolume()`, `page.tsx:73`, ouvre ceux-là et replie les autres).
**Aucune décision postérieure à 1990.** Les notions (racine `jurisprudence-sales`) sont
réservées à cette rubrique par `racinesReserveesHors` ; un arrêt sans notion reste visible par
son volume. 1 320 des 1 343 décisions portent un `DocumentTheme`.

Formations (`chambre`) : Première Section 639 · Deuxième Section 623 · Sections Réunies 72 ·
Assemblée Générale 2 · `null` 7. Magistrats : 22 fiches, 1 126 participations, tous des
années 1960.

**Clé d'identité.** (source, chambre, number) : 0 doublon **parmi les 162 arrêts à texte
intégral** — mais les 1 181 fiches RAEJH n'ont **pas de `number`** (le livre n'en donne pas) :
leur clé est `date | chambre | parties` (`cleDoc`, `scripts/verser-raejh.ts:111`), et leur
rapprochement avec un texte intégral se fait par date + shingles (`integrer-raejh.ts:93`).
L'idempotence par (source, chambre, number) vaut donc pour le bulletin, pas pour le RAEJH.

### ⚠️ Un défaut de la rubrique, à ne pas reproduire et à réparer (lot D)

Le champ `juridiction` devait porter l'une de trois clés — `JURIDICTIONS = ['CASSATION',
'APPEL', 'PREMIERE_INSTANCE']` (`src/lib/types.ts:50`) — que le filtre de recherche compare
**par égalité stricte** (`src/lib/search/ftsql.ts:76`) et que l'interface offre en trois
pastilles. Or il porte **43 valeurs distinctes en prose** : « Cour de Cassation de la
République d'Haïti, Première Section » (583, apostrophe courbe), « Cour de Cassation, Deuxième
Section — pourvoi contre un arrêt de la Cour d'Appel des Cayes du 24 juillet 1962… » (1), et,
pour l'arrêt 1964-1965 n° 29 (`cmstqokqe000s106g8pvqo5vx`), **vingt-et-une lignes** jointes par
des retours à la ligne — une colonne d'import tombée dans le champ. **Aucune des 1 343 décisions
ne répond au filtre « Juridiction » de la recherche.**

La cause est en amont, à quatre endroits : l'API du back-office accepte toute chaîne de
200 caractères (`z.string().trim().max(200)`, `api/admin/jurisprudence/route.ts:35`) ;
`parse.ts` (l. 19, 98, 180) rend la prose du recueil ; `JurisprudenceEditor.tsx` (l. 201) est
un champ texte libre ; et `referenceDecision()` (route, l. 62-65) **concatène `juridiction`
dans `moniteurRef`** — avec la clé, il écrirait « CASSATION · Première Section · n° … ».

Donc, pour tout versement : **`juridiction = 'CASSATION'`**, la clé. La prose — qui décrit
souvent la décision attaquée — va dans `decisionAttaquee` ou dans la notice. Le lot D répare
l'existant et la chaîne.

---

## ⚠️ Ce qui est sur le disque et qui N'EST PAS de nouvelles décisions

Six fichiers des 13 et 18 octobre dans `~/Downloads` visent la **Première Section 1965-1966**,
**déjà en base** (38 arrêts, n° 1 à 38, source `CASSATION_1965_1966`) :

| fichier | ¶ non vides | contenu |
|---|---|---|
| `Sommaire_Analytique_1re_Section_Arrets_1-15_1965-1966.docx` | 177 | notices n° 1-15 (préambule « pipeline Lam », « onze rubriques ») — **version révisée du 19 oct. ÉCRITE EN BASE le 19 oct. 2026** (`scripts/enrichir-cassation-1965-1966-1re-1-15.ts`, livraison `docs/livraison-sommaires-cassation-1965-1966-1re-1-15.md`) |
| `Sommaire_Analytique_1re_Section_Arrets_16-28.docx` | 149 | notices n° 16-28 (sans préambule, mêmes rubriques) |
| `Sommaire_Analytique_1re_Section_1965-1966_Arrets_29-36.docx` | 101 | notices n° 29-36 |
| `Cour_de_Cassation_Haiti_Arrets_1965-1966_Premiere_Section.docx` | 571 | textes n° 1-15, **transcription remise en forme** (têtes « Arrêt No N — date », guillemets « », table des arrêts en tête) |
| `Cour_de_cassation_1965-1966_arrets_16-28.docx` | 421 | textes n° 16-28, **mise en page du pipeline** (tabulations, têtes « No.N).- ») |
| `Cassation_1966_arrets_29-36.docx` | 290 | textes n° **29-36** — ⚠️ la tête « No.36).- » manque, le 36 n'est annoncé que par « [Mentions manuscrites : « 36 » — « 28 Juillet 1966 »] » (¶ 255) : un découpage par têtes **colle le 36 au 35** ; 7 lignes « [Mentions manuscrites : …] » à écarter du corps |

Les notices : **36 têtes « No N — parties »** ; rubriques mesurées sur les 36 — Date du
prononcé · Juridiction · Décision attaquée / objet de la saisine · Composition · Domaines du
droit · Analyse · Règle de droit (Rule of Law) · Question de droit (Issue) · Solution et motifs
(Holding and Reasoning) (36 chacune) ; Date portée sur l'extrait (36, dont 21 « (inventaire) ») ;
Anomalies de source (8). **Aucune rubrique autonome « Dispositif »**, mais 21 notices (14 du
1-15, 7 du 29-36, 0 du 16-28) terminent « Solution et motifs » par une sous-mention
« Dispositif : … » qu'un lecteur peut isoler.

⚠️ Ce n'est **ni** le contrat de format des cahiers (sept étiquettes fermées, cf.
`project-sommaires-format-retour`), **ni** ce que lit `parse.ts`. Le lecteur existe depuis le
19 oct. 2026 : `src/lib/jurisprudence/notices.ts` (`analyserNotices`, `separerDispositif`) ; les
n° 1-15 sont enrichis, les n° 16-36 restent à faire avec lui. C'est un **autre chantier** : il
ENRICHIT des arrêts existants, il n'en crée aucun.

Les textes sont une **seconde transcription**, à **collationner dans les deux sens, jamais à
substituer** : le n° 1 fait 13 893 c. (corps seul) contre 13 907 en base, 95,7 % de shingles de
six mots en commun — l'écart tient aux accents et à l'en-tête, mais aussi à des **coquilles
propres à la nouvelle transcription** (« justicative », « reconnnu », « appicables », « excat »,
« tpus », « dde ») et à « 1°) » contre « 1o) ». Elle n'est pas un oracle. Les n° 16, 29 et 36
recouvrent la base à 99,0 / 97,5 / 99,2 %.

**Ne touche pas à ces fichiers dans ce chantier.** Dis dans la livraison qu'ils attendent leur
propre prompt.

---

## Le lot : le Bulletin des arrêts 2011-2014

Fichier : `~/Dropbox/Moniteur/Bulletin des arrets de la Cour de Cassation␣␣de la Republique
d'Haiti--Annees judiciaires 2011-2012; 2012-2013; 2013-2014.pdf` — ⚠️ **deux espaces** entre
« Cassation » et « de » ; résous-le par motif `Bulletin des arrets*.pdf`. Copie identique sous
`~/Dropbox/lois haiti/Lois/`. **SHA-256
`f0a85ef043c17a5e363c431e482170ca533e7f128d2b6e879d2b678b9dba4167`**, 1 458 790 octets.

**328 pages, Adobe InDesign CS6 (PDF créé le 22 juillet 2016) — couche texte NATIVE, pas un
scan** : aucun OCR, aucune lecture par modèle de langue. Publication du projet
**PROJUSTICE / USAID** avec la Cour de cassation : p. 4, « Arrêts compilés par » Camille
Fièvre, Fritz Frédéric, Daniel Jean, Fabrice Fièvre, « Mise en page et impression Futura
Group » ; p. 5, préface signée Marceau Jude Edouard Jr., directeur du projet, 30 juin 2016 ;
p. 7, « Mot du Président de la Cour de Cassation » (il annonce « quatre-vingt-dix arrêts » —
le bulletin en imprime **91** : écart à consigner, pas à reproduire). Arrêts **pp. 9-317 du PDF**
(7-315 en pagination imprimée : page imprimée = page PDF − 2), chacun ouvrant sur sa propre
page, de 2 à 7 pages (le n° 62 est le plus long). **Index alphabétique pp. 318-324.**

**C'est la première source postérieure à 1990 du Recueil**, et la première à porter la
numérotation propre de la Cour.

### Ce que le fichier contient — mesuré sur les 91

**91 arrêts**, numéros d'ordre du bulletin 01 à 91 **sans lacune** (le n° 79 — # 4408, RG écrit
« RG 6107: », 23 juin 2014, 1ʳᵉ section, héritiers Oriol c. Mario Samson, pp. 273-277 — échappe
à un motif « RG : N » strict ; c'est ainsi que la première version de ce prompt en comptait 90).
Chaque arrêt ouvre sur un bloc d'identification à **deux colonnes**, puis « TEXTE COMPLET DE
L'ARRÊT », puis la formule de clôture :

```
Nos d'identification de l'arrêt      RG : 4537                 # Arrêt : 4021
Date de l'arrêt et section           15 novembre 2011 2e section
Domaine de l'arrêt                   Droit civil
Mots clés                            Opération d'arpentage- Déguerpissement-
Parties                              Demandeur en cassation : Audilon Celestin
                                     Défenderesse : Kettelie Celestin
Décision attaquée                    Jugement du Tribunal de première instance de
                                     Mirebalais en date du 19 octobre 2009
Textes de loi appliqués              Article 282 du CPC,
Résumé                               Le locataire qui n'a pas payé ses loyers …
```

⚠️ **Ce bloc se lit par colonnes, pas par lignes.** Dans l'extraction `-layout`, un libellé
centré verticalement tombe **entre deux lignes de son contenu** (« Parties » seul sur sa ligne,
entre « Demandeur en cassation : … » et « Défenderesse : … »), et le contenu peut précéder le
libellé (n° 4). Découpe par position horizontale. Les libellés varient de casse et de
ponctuation : « Domaine de l'Arrêt » (7), « Date de l'Arrêt » (5), « PARTIES », « Parties : »,
« Résumé de l'arrêt » (16) — compare-les **insensiblement à la casse**. Aux n° 65 et 67, le RG
est séparé de son libellé par un blanc plus large (une autre ligne dans l'extraction par défaut).

**Rubriques sur les 91** — libellés : Date, Domaine, Mots clés, Décision attaquée, Textes de loi
91/91 ; Résumé 90/91 (le **n° 8** a son résumé sans libellé, à la suite d'une rubrique vide) ;
Parties 90/91 (le **n° 45** n'a pas le libellé mais son contenu). Contenus vides, à ne pas
inventer : « Décision attaquée » vide aux **n° 13 et 77** (`decisionAttaquee` null) ; « Textes de
loi appliqués » vide sur **15 arrêts** (n° 8, 13, 14, 15, 17, 18, 21, 24, 25, 27, 30, 39, 49,
80, 91 : aucun renvoi à créer). Le **n° 86 (# 4421)** n'a pas la ligne-titre « TEXTE COMPLET DE
L'ARRÊT » — son texte est là, à ancrer sur « a rendu l'arrêt suivant ». Le n° 38 porte sa date
sur la **deuxième ligne** de la rubrique (« Première section » / « 15 juin 2015,1ère section »,
chute de colonne).

**Numéros de la Cour.** `# Arrêt` : 91 renseignés, **90 distincts en gardant les suffixes**
(« 4038C » n° 9, « 4112A » n° 19 face à « 4112 » n° 18, « 4229A » n° 46, « 4302 A » n° 55) —
le seul # strictement partagé est **4334** (n° 62, RG 4992, 10 février 2014, 1ʳᵉ ; n° 63,
RG 4850, 23 janvier 2014, 2ᵉ) ; le n° 91 porte # = RG = 6064, hors séquence (4461 → 6064), à
vérifier à l'œil. `RG` : 90 renseignés, 89 distincts — le n° 88 imprime « RG : manquant »,
le n° 89 deux RG (« 6084/6085 », pourvois joints), le n° 50 « 4425A », et le **RG 4603 est
partagé** (n° 36 # 4175 et n° 37 # 4176). Donc : `number` = le `#` **avec son suffixe** ; le RG
en texte nullable dans `metaJson` — **il ne départage rien** ; la clé reste (source, chambre,
number) et sépare les deux 4334 par la section.

**Sections** : Première 42 (« 1ère section » 40, « 1e section » 1, « Première section » 1),
Deuxième 47 (« 2ème » 37, « 2ème Section » 2, « 2e » 6, « 2eme » 2), Sections réunies 2
(n° 26, 33). Formes atypiques de la ligne : « 20) Février 2013,1ère section » (n° 32), tiret
demi-cadratin (n° 44, 52), ordre inversé « Cour de cassation, 1ère section, 19 février 2014 »
(n° 65, 66). À écrire comme en base : « Première Section », « Deuxième Section », « Sections
Réunies ».

**Années (en-têtes)** : 2007 (1) · 2011 (3) · 2012 (19) · 2013 (31) · 2014 (35) · 2015 (2).
**Trois arrêts hors des années du titre** : n° 16 (# 4106, 14 novembre 2007, 1ʳᵉ — formation
de 2007 : Georges Moise, Menan Pierre-Louis, Rénold Jean-Baptiste Pierre, Josué Pierre), n° 33
(# 4167, 22 juillet 2015, Sections réunies), n° 38 (# 4193, 15 juin 2015, 1ʳᵉ). Ils sont dans
le bulletin : on les verse, dans leur exercice, et on le dit.

**L'index alphabétique (pp. 318-324) est un témoin interne — pas un oracle.** 262 entrées
« Cass H, 2ème section, 27 mars 2014, 234 » : section, date et **page imprimée** (89-91
triplets selon la normalisation de la section). C'est la source de vérification indépendante
que la règle de 1965-1966 impose de chercher avant d'écrire une ligne d'import, et elle est
imparfaite : concordance (section, date d'en-tête, page) sur **81 arrêts sur 91** ; **8 arrêts
sans entrée complète** — 1 absent (n° 45) et 7 en entrée dégradée (n° 5-8 sans section, n° 49
sans jour ni année, n° 54 sans page, n° 90 « 201 » pour 2014 : 24 mentions dégradées sur 286,
dont les témoins date + page restent utilisables) ; 4 renvois de page qui ne tombent sur aucun
arrêt ; et deux contradictions avec l'en-tête — n° 19 (index « 4 mars 2012 », un dimanche) et
n° 75 (index « 24 avril 2014 »). Les trois hors-titre y figurent (pp. 59, 118, 134). Ses notions
sont l'œuvre des compilateurs (voir « Les droits »).

### L'extraction — nomme ton extracteur, ou tes chiffres ne valent rien

Les comptes de césures varient de 75 à 1 126 selon l'outil, parce que **`pdftotext` en mode par
défaut recolle lui-même les fins de ligne, aveuglément** (« Port-auPrince » × 20,
« Portau-Prince » × 15) : ne t'en sers **jamais comme source**, seulement comme témoin du
recollage. Source : `pdftotext -layout` (césures visibles : **842** lignes finissant par
lettre + tiret, 1 113 par le seul « - ») ou PyMuPDF (1 126) — ou `src/lib/pdf/text-layer.ts`
du dépôt. Puis, dans cet ordre :

1. **retirer les 316 pieds de page** « Recueil d'Arrêts de la Cour de Cassation de la
   République d'Haïti », numéro de page **avant** (pages paires) ou **après** (impaires) le
   libellé — AVANT de recoller, car **7 mots sont coupés par un pied de page** (« ordi-|pied|
   naire », n° 90) et parce que joindre les lignes d'abord colle un numéro de page au dernier
   nom d'une ligne « AINSI SIGNÉ » ; et les numéros d'ordre (« 03 ») en tête de première page ;
2. **recoller les césures** avec un lexique = **tout le bulletin** hors en-têtes : recoller si le
   mot soudé y existe sans tiret, sinon garder le tiret et signaler (« Port-au-|Prince » × 19
   est un vrai tiret) ; « officiersde » (× 21) et autres mots collés se reproduisent tels quels,
   c'est la lettre du bulletin ;
3. retirer les lignes « AINSI SIGNÉ : … » (**77 arrêts** : 61 en capitales, 15 « Ainsi
   signé », 1 « Ainsi Signé ») : elles répètent les noms de la composition en capitales séparés
   de tirets (celle du n° 2 omet le tiret entre AUGUSTIN et JULES CANTAVE) et ne font pas une
   seconde composition — `ligneCompositionDeLArret()` coupe avant, à « Il est ordonné » —, mais
   elles servent de **second témoin des noms**.

### ⚠️ L'outillage existant NE LIT PAS ce bulletin tel quel — mesuré, puis contre-mesuré

Base de toutes les mesures qui suivent : **91 formules de clôture** — l'ancre est « prononcé
par Nous », insensible à la casse ; 89 sont en capitales (le n° 4 écrit « PRONONCE » sans
accent), 2 en minuscules — n° 16 (# 4106) et n° 30 (# 4159, « Ainsi **décidé** et prononcé »).

**1. `dateDeLArret()` rend `null` sur 89 formules sur 91.** L'ancre `audience[^.;]{0,80}?\bdu`
(`numeraux.ts:135`) **mord déjà** sur « à l'audience ordinaire et publique du mardi », et
`quantiemeEnLettres('mardi quinze')` = 15 (le jour de semaine est filtré). La cause est
**l'alternative du millésime** `(\d{4}|(?:mil|mille)…)`, qui exige qu'une année en lettres
commence par « mil » : « deux mille onze » commence par « deux ». En étendant cette seule
alternative (`(?:deux\s+)?mil(?:le)?…`), **≈ 76 formules se lisent** (« deux mil quatorze »,
n° 90, se lit alors). Restent **15**, en catégories disjointes : **13 dates à chiffres entre
parenthèses placés avant ou après le mois** (n° 20, 23, 38, 58, 61, 62, 66, 72, 73, 75, 78, 84,
85 — « vingt huit (28) novembre », « quinze juin (15) » n° 38, « trente juin (30 juin) » n° 84 ;
26 formules portent des chiffres parenthésés, mais 13 se lisent quand même : le placement après
le millésime, « deux mille douze (2012) », ne bloque pas), dont deux portent **aussi** un
millésime fautif (n° 38 « deux mille (2015) », n° 75 « deux treize ») ; le **n° 39, sans aucune
date dans sa formule** (« du mercredi en présence de… ») ; et le **n° 33 « mille quinze »**
(= 1015). (« vingt-et-trois », n° 43, est un quantième et se lit.) Étends `numeraux.ts` et
ajoute les n° 2, 20, 38 et 84 au test.

⚠️ **L'en-tête n'est PAS un oracle, et le jour de semaine ne tranche pas toujours.** Trois
arrêts ont une date d'en-tête contredite par la formule, et c'est la **formule** qui est juste,
jour de semaine à l'appui : n° 19 (en-tête 4 mars 2013, un lundi ; formule « mercredi vingt-et-un
novembre deux mille douze » — un mercredi), n° 26 (9 janvier 2012 ; « vendredi vingt-cinq janvier
deux mille treize »), n° 44 (3 juin 2013 ; « jeudi vingt-trois mai deux mille treize »). Un
**quatrième conflit ne se tranche pas seul** : n° 75 (# 4398, RG 6029) — en-tête « 24 avril
2013 », formule « mercredi vingt-quatre (24) avril deux treize » (le 24 avril 2013 est un
mercredi), mais l'index dit « 24 avril 2014 », et le RG 6029 comme la place du n° 75 entre le
n° 74 (4 juin 2014) et le n° 76 (18 juin 2014) plaident pour 2014. Règle unique, reprise en
« Exécution » : **sur désaccord, le script n'écrit pas la fiche ; il consigne les témoins
(en-tête, formule, jour de semaine, index, RG, séquence) et l'arbitrage proposé ; l'écriture
suit une décision consignée** — jamais un arbitrage silencieux. Attends ≈ 85 accords. Le n° 39
se date par l'en-tête (10 avril 2013, un mercredi, conforme).

**2. `lireComposition()` lit le siège du n° 2 (`PRESIDENT_FF` + 4 `JUGE`) mais perd le parquet
dans 58 formules sur 91 et le greffe dans 78 — et 36 présidences sur 91.** Trois regex de
`composition.ts` n'acceptent que « de » là où le bulletin écrit « **du** » : la coupe de
`ligneCompositionDeLArret()` (l. 302 : la clause d'audience est retirée jusqu'au premier « en
présence **de** » — « en présence **du** ministère public » est avalé avec elle), `RE_MP` (l. 148)
et `RE_GREFFE` (l. 149 : « avec l'assistance **du** greffier du siège » écarté). Les présidences :
**13 sont signalées** « présidence non reconnue » (# 4019, 4027, 4038C, 4124, 4138, 4150, 4246,
4260, 4301, 4302 A, 4326, 4340, 4663) — rôle collé au nom sans virgule (11 formules, dont « Jules
Cantave vice-président, » × 6), « remplissant **la** fonction de président » (# 4019),
« vicce-président » (n° 60), capitales séparées de tirets (n° 26), « par Nous, juges, … »
(n° 26, 55) ; le n° 38 (« président de la section ») est lu, son « de la section » seulement
écarté en fragment — et **23 sont perdues EN SILENCE** : « par
Nous **:** » ouvre **26 formules** (n° 3, 22, 28, 29, 30, 35, 36, 44, 51, 54, 62, 63, 64, 69, 70,
76, 77, 79, 81, 82, 85, 87, 88, 89, 90, 91), l'ancre `par\s+nous\s*,?\s*` (l. 294) laisse le
« : » en tête de ligne et `ressembleAUnNom()` rejette le président. **C'est la correction la
plus rentable du gabarit E** : faire avaler `\s*[:,]?\s*` par l'ancre, tester sur le n° 30.
Vocabulaire sur les 91 clauses : « greffier du siège » 65, « avec l'assistance du greffier »
42, « commissaire du gouvernement » 39, « vice-président » 37-40 selon la tolérance au trait
d'union, **« faisant office de » 14 (la forme majoritaire)**, « faisant fonction de » 3,
« remplissant la fonction » 1, « en présence du ministère public(,) représenté par » 9,
« substitut » 84, « assisté(s) du » 3, « audience solennelle » 2 (n° 26, 33) ; **82 formules
sur 91 écrivent « juges » puis la clause d'audience sans virgule**. Ajoute un **gabarit E** à
`composition.ts`, un test par forme — et **ne régresse pas** les 33 parquets et 13 greffes déjà
lus. La prose entre les juges et le greffe (date, audience) va dans `compositionNote`.

**3. `deduireSolution()` — le dispositif de la Cour est le DERNIER « Par ces motifs », toute
casse, césure recollée, AVANT « prononcé par Nous ».** 51 arrêts sur 91 reproduisent d'abord le
dispositif de la décision attaquée dans leur récit (« Par ces motifs, le tribunal … infirme la
sentence… ») : sur le n° 2, le premier rend `null` là où celui de la Cour (« déclare Audilon
Célestin déchu de son pourvoi ») donne `DECHEANCE`. Ne cherche pas les capitales : **12
dispositifs de la Cour échappent à « PAR CES MOTIFS »** — 11 en minuscules (# 4106, 4112A, 4122,
4124, 4136, 4159, 4160, 4165, 4167, 4168, 4193) et un « PAR CES MOTIIFS » (# 4412). S'y ajoute
une occurrence **césurée** « PAR CES MO-|TIFS » (# 4455, n° 89, p. 306 du PDF) — c'est le
dispositif de la Cour d'appel cité dans le récit, pas celui de la Cour — à recoller pour que le
compte des 51 tienne. Zéro « Par ces motifs » après la formule.

Rendement mesuré sur les 91, pieds de page retirés, césures recollées : **67 sens déduits,
24 `null`** — REJET 21 · CASSATION_AVEC_RENVOI 20 · CASSATION_SANS_RENVOI 9 · IRRECEVABILITÉ 12
· DÉCHÉANCE 4 · NULLITÉ 1. (Sans retirer les pieds de page, « Recueil d'Arrêts de la Cour de
Cassation » collé dans un dispositif déclenche la branche `cassation` : nettoie d'abord.) Les
24 `null` sont de **cinq sortes** :

- cassations **sans mot** de renvoi ni de fond : # 4040 (« casse par voie de réduction du
  seul chef de pension »), 4124, 4325, 4334 (n° 63), 4461 — à lire ;
- cassations **avec renvoi hors du vocabulaire** du regex : « renvoie en conséquence le sieur X
  par-devant un autre juge » (# 4202), « les renvoie par-devant le Tribunal / la Cour d'appel »
  (# 4415, 4663), « Renvoie en conséquence la cause et les parties » (# 4306 — « en
  conséquence » casse `renvoi(e)?\s+la\s+cause`) ;
- **bloqués par le NOM « cassation »** dans le dispositif : « déclare irrecevable le recours
  **en cassation** » (# 4129, 4138), « rejette … le pourvoi des demandeurs **en cassation** »
  (# 4390), « rejette la demande de récusation … **Cour de cassation** » (# 4405) — un défaut de
  `deduireSolution` sur la rédaction moderne : la branche `cassation|\bcasse\b` tire sur le
  substantif. **À corriger dans `constants.ts` avec tests** (neutraliser « pourvoi/recours/
  demandeur(s) en cassation » et « Cour de cassation » avant le test), puis re-mesurer ;
- nullités d'une formulation nouvelle : « déclare nul le pourvoi » (# 4392, 4412), « déclare
  nulle la requête » (# 4421), « dit et déclare inopérante la ratification … déclare nulle la
  déclaration de pourvoi » (# 4406) — et **un faux positif** : # 4301, « déclare frappé de nullité
  LE JUGEMENT … renvoie … par-devant le même tribunal » est une annulation avec renvoi, pas une
  nullité du pourvoi (`SOLUTIONS` ne distingue pas la nullité du jugement attaqué de celle du
  pourvoi) ;
- hors liste : « admet la requête de prise à partie » (# 4053), **un déport** (# 4159, n° 30 :
  « se déporte de ce pourvoi »), « dit et déclare que l'exécution provisoire sans caution a été
  accordée… » (# 4150), mainlevée d'opposition (# 4175), maintien de séquestre (# 4370),
  « dit et déclare inexistant le jugement » (# 4389), comparution personnelle (# 4409).

`null` reste `null` : on ne devine pas un sens, et la liste `SOLUTIONS` ne s'étend que sur
décision de la rédaction (précédent du 18 août 2026). Rapporte chaque `null` dispositif à
l'appui, et le faux positif # 4301.

**4. Les magistrats sont tous nouveaux — et `cleMagistrat()` ne rapproche pas leurs graphies.**
Siège + parquet + greffe des 91 formules : **49 clés (33 au siège), pour ≈ 27 personnes**
(≈ 15 juges dont la formation de 2007, ≈ 6 greffiers, ≈ 6-8 substituts) ; **12 clés sont des
artefacts** (rôle collé au nom — « cantave jules president vice » —, deux noms fusionnés par un
tiret, « juges » absorbé) à purger avant toute fiche. ⚠️ La clé exacte **ne signale pas**
« Henri Michel Augustin » (34-36) / « Henry » (4), ni Franzi (33)/Frantzi (11) Philémon,
Medtzgher/Medtgher/Medzgher/Wedtzgher Théodore(/Théodor), Jules/Jule Cantave, Joseph Mécène
Jean-Louis / Mécène Jean Louis, Joassaint/Joissaint, Sainclair/Sinclair, Bergrome/Bergromme,
Satiné/Satine, Jean Fritz/« Frtitz » Satiné — **une dizaine de paires** : prescris une passe de
clés voisines (distance ≤ 2) **soumise à la rédaction**. Et sache ce que fait
`import-cassation-juges.ts` (l. 168-169) : **un `Judge` par `matchKey`** — dans un lot, la clé
DÉCIDE (les graphies d'une même clé fusionnent, `nameAsWritten` les conserve), seuls les
rapprochements inter-clés sont signalés. « Signale, ne fusionne pas » vaut pour ces derniers.

### Ce qu'il faut écrire, champ par champ

Nouvelle source **`CASSATION_BULLETIN_2011_2014`**. ⚠️ **`Document` n'a ni `observation` ni
`sourceJson`** : les constats de parsing, le RG, les pages, l'empreinte et la provenance vont
dans **`metaJson`** (JSON), et ce qui doit se lire va dans la **notice** en tête du corps.
`noteRedaction` ne se détourne jamais : elle est signée au nom d'un éditeur.

| champ | valeur |
|---|---|
| `type` · `juridiction` | `JURISPRUDENCE` · **`CASSATION`** |
| `chambre` | « Première Section » / « Deuxième Section » / « Sections Réunies » |
| `number` | le **# Arrêt**, suffixe compris (« 4112A ») |
| `publicationDate` | la date de l'arrêt arbitrée — **pas** `adoptionDate`, qui reste vide (règle des arrêts) |
| `exerciceDebut/Fin` | règle de `verser-raejh.ts:109` : mois ≥ 10 → (A, A+1), sinon (A−1, A). 29 octobre 2014 → 2014-2015 ; 14 novembre 2007 → 2007-2008 ; 15 juin 2015 → 2014-2015 |
| `recueilRef` | « Cour de Cassation — exercice AAAA-AAAA » — **cinq volumes nouveaux** (2007-2008, 2011-2012, 2012-2013, 2013-2014, 2014-2015), **sans** « (recueil complet) » |
| `moniteurRef` | « Cour de Cassation · Deuxième Section · n° 4021 · 2011-2012 » (standard C d'`integrer-raejh.ts`) ; la fiche l'affiche **nue** |
| `titleFr` | « Audilon Celestin c. Kettelie Celestin » depuis « Parties » ; le n° 45, à l'œil |
| `bodyOriginal` | le texte complet, nettoyé comme ci-dessus, **rien d'autre corrigé** — précédé d'une **notice** d'une ligne : « Bulletin des arrêts de la Cour de Cassation (PROJUSTICE/USAID, 2016), compilé par C. Fièvre, F. Frédéric, D. Jean et F. Fièvre — n° 02, p. 10-12 (PDF 12-14), RG 4537 » (pagination **imprimée** d'abord : c'est elle que cite l'index) |
| `summaryFr` | le « Résumé » du bulletin — ⚠️ **à trancher avant `--apply`** : `JurisprudenceSommaire.tsx` (l. 43, ordre des lignes l. 76-83) l'affiche sous « Résumé éditorial », en **deuxième** ligne du sommaire, après « Domaine du droit » ; une notice dans le corps ne change pas cette étiquette. Recommandation : écrire `summaryFr` **et** rendre le libellé conditionnel par source (« Résumé du bulletin (compilateurs) » pour `CASSATION_BULLETIN_2011_2014`), avec son test de rendu — c'est déjà la situation des 61 résumés de 1964-1965, qui viennent du recueil. Sinon, le résumé reste dans la notice et `metaJson`. Aucune pastille n'en découle |
| `dispositif` · `solution` | le dernier « Par ces motifs » de la Cour, verbatim · `deduireSolution()` corrigé, `null` gardé |
| `decisionAttaquee` · `keywords` · `matiere` | « Décision attaquée » (null aux n° 13 et 77) · « Mots clés » (indexés) · **« Domaine de l'arrêt », présent sur les 91** — 30 graphies exactes, 25 à casse confondue, 21 après normalisation (« Procédure civile » 31, « Droit civil » 15, « Droit pénal » 10, « Droit du travail » 6, « Droit administratif » 3, composites, « Droit cvil » sic) — verbatim dans `matiere`, qui reste la formule du recueil ; `classer-jurisprudence-themes.ts` classe d'après elle : exécute-le à blanc, il signale ce qu'aucune règle n'atteint |
| `regleDroit` · `questionDroit` · `motifs` | **vides** — pas de sommaire IRAC ; les tirer de la prose reviendrait à signer une analyse au nom d'un éditeur qui ne l'a pas lue |
| `traitement` · `portee` | **jamais écrits** — un blanc n'est pas un neutre |
| `sourcePdfUrl` | le bulletin sur le Blob privé (`source-pdf/jurisprudence/bulletin-2011-2014.pdf`), **une fois** ; pages imprimée et PDF dans `metaJson` |
| `metaJson` | `{ rg, ordreBulletin, pagesImprimees, pagesPdf, sha256, dateArbitree: { entete, formule, jourSemaine, index, retenue }, parsing: [...] }` |

**« Textes de loi appliqués » → renvois** (76 arrêts en portent). Libellés libres (« Article
282 du CPC, », « 465, 1168, 1169 du Code civil. Art. 2 du décret du 29 novembre 1979 », « du
CP- Art. 325, 326 C.I.C. », « la Constitution en date 1987- la loi du 10 Juin 1996- Article 424
du CPC »). ⚠️ Ce que la première version de ce prompt prescrivait — `toId` null + `toLabel` +
`note` — **ne serait jamais résolu** : `refs.ts` (`resolveCrossRefs`, l. 41-96) ne résout que par
`toId` ou par (`toType`, `toNumber`), `note` n'est lue nulle part, et `resoudre-renvois-raejh.ts`
ne touche que `JurisExtraitRef` ; le back-office refuse d'ailleurs `!toId && !(toType &&
toNumber)` (`api/admin/legislation/route.ts:86`). Donc un `CrossRef` par texte cité,
`kind = 'CITE'`, `source = 'AUTO'` (valeur prévue par le schéma pour un renvoi écrit par
script), avec **`toId`** quand le registre `src/lib/jurisprudence/cibles.ts` (`CPC`, `CC`, `CP`,
`CIC`, `CONST-1987`…) résout — et `toAnchor` « art-N » **seulement si la tête d'article existe**
(`articleAnchorFromHeading`, `src/lib/doc/anchors.ts:38`) — sinon **`toType` + `toNumber`**
(désignation que l'affichage résoudra plus tard). ⚠️ **Un arrêt de 2012 cite le Code pénal de
1835 et le Code d'instruction criminelle**, pas les codes révisés de 2025 (en ligne depuis le
17 octobre, en vigueur le 1ᵉʳ janvier 2027) : `CP` → `CODE_PENAL_ANNOTE`, `CIC` →
`CODE_INSTRUCTION_CRIMINELLE`. « La loi du 10 Juin 1996 » est la loi sur la patente, en base —
résous-la. Un `CrossRef` vise **un** texte ; le `kind` AFFIRME : un arrêt cite, il ne modifie ni
n'abroge. Aujourd'hui **0 `CrossRef` part d'une décision** (298/298 sont `EDITORIAL`) : tu
inaugures ce chemin — teste son rendu.

**Aucun doublon possible avec le RAEJH** (il s'arrête en 1989) — vérifie-le par la mesure :
0 arrêt en base daté après 1990, à constater avant d'écrire. Si un recueil des années 1963-1989
se présentait un jour, la règle est celle d'`integrer-raejh.ts` : même jour, formation
compatible, couverture ≥ 0,40 en shingles de six mots et second candidat < 0,15 ⇒ même
arrêt ⇒ les extraits passent à la fiche à texte intégral, la fiche d'extraits est supprimée
(audit `DOC_DELETED`) — jamais deux fiches.

### Les droits — à demander avant de publier

Le Répertoire de Me Salès a été versé parce que la cliente a dit, le 14 septembre 2026, que
l'ouvrage appartient à la plateforme. Ce bulletin est une **publication PROJUSTICE/USAID de
2016**, compilée par quatre avocats, préfacée par le directeur du projet, présentée par le
Président de la Cour, imprimée par Futura Group : la question de diffusion se pose du côté du
bailleur et de l'éditeur autant que des compilateurs. Les arrêts sont des actes publics ; les
résumés, les mots-clés et l'index alphabétique sont l'œuvre des compilateurs. Pose la question
avant le `--apply`, consigne la réponse. Dans le doute, verse les arrêts et **retiens** résumés,
mots-clés et index.

---

## Lot D — réparer `juridiction` sur les 1 343, et fermer la chaîne

Script à part, `scripts/reparer-juridiction-jurisprudence.ts` (à créer), simulation par défaut :
`juridiction = 'CASSATION'` pour toute décision dont la valeur commence par « Cour de Cassation »
(les 43 variantes — remesure qu'aucune n'est d'une autre juridiction). **La prose n'est pas
jetée** : journal `scripts/data/jurisprudence/juridiction-avant-2026-10.json` (id → ancienne
valeur) et `meta.avant` dans l'audit. L'arrêt n° 29 (`cmstqokqe000s106g8pvqo5vx`) : lire ses 21
lignes avant de remplacer — ce qui n'est nulle part ailleurs (décision attaquée, pourvois
joints) va dans `metaJson`.

Les **7 `chambre` null** (RAEJH) : deux titres sont cassés — « Section réunis, Guy Eddy
LÉVEILLÉ ȼ Banque Populaire Haïtienne » (`cmu1khx7o00fg7fnr32htri7u`, la formation tombée
dans le titre : corrige-le, pose « Sections Réunies ») et « 4 août 1989, COLES MANUFACTURE c.
Marie-Lourdes DÉBROSSE » (`cmu1khyf200j47fnrjz66r3td`, la date tombée dans le titre) ; les cinq
autres restent `null`.

**Et la chaîne** : `juridiction: z.enum(JURIDICTIONS)` dans la route ; `parse.ts` et
`JurisprudenceEditor.tsx` (menu à trois valeurs) produisent la **clé** et non la prose ;
`referenceDecision()` rend le libellé « Cour de Cassation » à partir de la clé — sinon tout
`POST` issu d'un `PUT` serait rejeté `400 invalidFields`. Teste le `POST` complet.

---

## Exécution — les règles de la maison

- ⚠️ **`.env` vise la base de PRODUCTION** : toute simulation lit prod, tout `--apply` écrit prod ;
- lance les scripts avec **`SEARCH_PROVIDER=fts`** (prod = FTS ; `.env` local dit `opensearch`
  et `reindexDocument()` tenterait un miroir local), comme le fait `integrer-raejh.ts` ;
- script re-jouable dans `scripts/`, **simulation par défaut**, `--apply`, `--voir=N` ; données
  parsées versionnées sous `scripts/data/cassation-bulletin-2011-2014/` avec `EMPREINTES.txt`
  (le SHA-256 ci-dessus comme valeur de référence) ;
- idempotence par **(source, chambre, number)** ; refuser si l'existant n'est pas de type
  `JURISPRUDENCE` ; refuser d'écraser un `bodyOriginal` de texte intégral par autre chose ;
- **refuser d'écrire** (`process.exit(1)`) sur : numéro en double dans une même formation,
  corps de moins de 500 caractères (sans exception : les 91 ont un texte), section illisible non
  tranchée ; **sur désaccord de date, la règle unique du § 1 : la fiche n'est pas écrite, les
  témoins et l'arbitrage proposé sont consignés, l'écriture suit une décision consignée** ;
- écriture en transaction avec `audit()` — et **recompter `auditLog.count()` après** :
  `audit()` avale ses erreurs ; `reindexDocument()` à chaque fiche (≈ 3,5 s par arrêt :
  **lance le `--apply` en arrière-plan**, 91 arrêts dépassent la limite du premier plan ; il est
  idempotent, une reprise met à jour) ;
- **aucune pastille, aucune note de rédaction écrite par script** ;
- le contrôle d'empreintes se lance **seul**, verdict lu, puis l'écriture dans un **autre**
  appel — jamais `verifier | tail && --apply` ;
- **lis `git status` en entier** avant tout `add` : le dépôt porte des dizaines de fichiers non
  suivis et des modifications d'autres sessions ; `git add` fichier par fichier, jamais `-A` ;
  **diff complet** avant tout commit d'un fichier partagé ;
- `npm run typecheck && npm run lint && npm run test`, puis `npm run build:check`.

## Vérification

Par le **chemin de rendu réel** : un test `vitest` `.tsx` rendant la fiche d'un arrêt du bulletin
avec les props que `doc/[id]/page.tsx` passe à une décision. Contrôle nommément : la référence
s'affiche nue ; la composition ne nomme que ceux qui ont siégé et porte le greffier et le parquet
(n° 2 : Jean Fritz Satiné, Me Gilbaud Robert) ; le résumé est attribué au bulletin, selon ce qui
a été tranché ; aucune pastille ; le lien « Aller au texte de l'arrêt » existe ; les renvois
« Textes de loi » se rendent ; et — nouveau — **le filtre « Cassation » de la recherche rend ces
91 arrêts** (et, après le lot D, les 1 343). Puis, sur la rubrique, les cinq volumes nouveaux
apparaissent sous leur exercice, et les 27 anciens n'ont pas bougé.

## Livraison

`docs/livraison-jurisprudence-bulletin-2011-2014.md` : les 91 (dont les trois hors années et le
n° 86 sans ligne-titre « TEXTE COMPLET »), les 24 sens non déduits avec leur dispositif et le
faux positif # 4301, les quatre dates arbitrées (n° 19, 26, 44, 75), les ≈ 27 magistrats et leurs
graphies voisines, les renvois résolus et non résolus, la réponse sur les droits, ce qui a été
tranché pour `summaryFr`, ce que le lot D a changé, et tout ce que tu as dû décider. Commite,
pousse, rapporte.
