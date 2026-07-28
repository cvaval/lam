# Livraison — Décret régissant les activités minières (30 mars 2026)

**Document** : « Décret régissant les activités minières », donné au Palais National le
27 mars 2026, publié au **Moniteur, Spécial N° 16 du lundi 30 mars 2026** (62 pages).
Entrée en vigueur **six mois après publication** (art. 305), soit le 30 septembre 2026 —
`effectiveDate 2026-09-30`.

**Emplacement** : Législation annotée → Droit économique & des affaires → **Droit minier
& ressources minérales** (`droit-minier`) — **nouvelle section**, créée sous `economique`,
sœur de Droit commercial et Droit bancaire & financier. Premier texte de la section ;
vocation à accueillir le Décret minier de 1976 (historique), les règlements d'application
à venir, la Convention Minière type, etc.

Doc prod : `cms1b7se9000213pmtu7n66jz` · `source = DECRET_MINIER_2026`.

## a) Sources et reconstitution du corps

Quatre fichiers fournis / retrouvés (~/Downloads) :

| Fichier | Rôle |
|---|---|
| `Décret_activités_minières_Moniteur_Spécial_16_30-03-2026.docx` | transcription pages 1-32 : masthead, préambule, **articles 1 → 142** |
| `Decret_Minier_Moniteur_30_mars_2026.docx` | transcription pages 33-62 : **articles 143 → 306** + signatures (Premier Ministre FILS-AIMÉ + 18 ministres) |
| `Decret_Minier_2026_Sommaire.docx` | sommaire préparé par la cliente — autorité de STRUCTURE |
| `Decret_Minier_2026_Index_alphabetique.docx` | index alphabétique préparé par la cliente — autorité de l'INDEX |
| `Mines_Moniteur 30 mars 2026_1.pdf` / `-2.pdf` | scans du Journal officiel (32 + 30 pages) — arbitrage des divergences |

Le fichier joint au message ne couvrait que les articles 1-142 (sa note finale l'indique) ;
la **seconde moitié** (143-306), présente dans Downloads et `Dropbox/Moniteur`, a été
intégrée pour livrer le décret **complet**. Notes du transcripteur écartées du corps
(note « [Fin de l'extrait…] », 6 lignes de couverture, « AVERTISSEMENT ÉDITORIAL »).

**Corps produit** : 1 101 lignes, **342 articles** = 306 articles de base + **36 articles
décimaux officiels** (39.1, 39.2, 46.1… 302.2) — ancres `art-39-1`, affichage « 39.1 »
(`prettyRef`), libellés dans `labels`.

## b) L'« affaire de l'article 27 » (constat matériel)

Le sommaire et l'index clients affirment tous deux que **l'article 27 est absent** du
décret (« la numérotation passe de l'article 26 à l'article 28 »). Vérification faite
sur le **scan du Journal officiel (p. 12)** : l'article 27 **existe** — le Moniteur
l'imprime « **Articles 27.-** » (sic, au pluriel), coquille qui l'a masqué aux outils de
relevé. Contenu : renouvellement de l'Autorisation de Prospection (une fois, six mois).

Traitement : ligne conservée **verbatim** (« Articles 27.- ») ; la machinerie d'ancres
(`anchors.ts`) reconnaît désormais la forme plurielle **uniquement** suivie de la
ponctuation de tête « .- » (aucune citation « Articles 185 à 188 » ne devient une tête —
corpus scanné, zéro régression) ; badge affiché « Article 27 » ; note rectificative en
renvoi de section (Chapitre IV du Titre II). Les plages de l'index client (« 25 à 29 »)
s'étendent sur les articles réels et couvrent donc l'article 27.

## c) Sommaire (client, validé contre le corps)

67 en-têtes : **17 TITRES + 50 CHAPITRES** (paires/triplets du docx joints « — »),
appariés un à un contre le sommaire client (intitulés normalisés + **plages d'articles
vérifiées aux positions réelles**). Aucune SECTION dans ce décret.

Note [¹] du sommaire client reprise : le J.O. imprime « CHAPITRE PREMIER — DISPOSITIONS
GÉNÉRALES » au niveau hiérarchique des Titres (= TITRE PREMIER). Corps verbatim, entrée
de niveau 1, navToc affiché « TITRE PREMIER — DISPOSITIONS GÉNÉRALES », note en renvoi
de section (`sec-1`).

## d) Index alphabétique (client, autorité)

**392 entrées** issues des 124 sujets du client (chaque sous-entrée « – description,
réfs » → une entrée « Sujet — description ») :

- plages « N à M » étendues sur les articles **réels** (« 163 à 165.2 » inclut 165.1) ;
- renvois décimaux « 289.1 » → ancre `art-289-1` ;
- 58 renvois qualifiés « 6 (32°) » : la référence pointe l'article 6 (terminologie), le
  numéro d'alinéa est reporté dans le libellé « — définition (32°) » ;
- **0 renvoi mort** (assertion bloquante).

**Couverture : 331/342 articles.** Onze articles ne sont cités par aucune entrée de
l'index client : **1, 2, 5, 17-20, 302, 302.1, 302.2, 305** (objet du décret, mise en
valeur des ressources, liste transitoire des permis, entrée en vigueur). L'index client
étant l'autorité, rien n'a été ajouté — à compléter sur instruction si souhaité.

## e) Tableau des redevances (art. 232.2)

Seul tableau Word du corpus (6 lignes) : émis **ligne par ligne**, cellules verbatim
jointes « — » (le lecteur annoté ne consomme pas `richBlocksJson`). Contenu vérifié
cellule à cellule contre le scan p. 48 (Bauxite 5,0 % / 4,0 %, concentrés 3,5 %, lingots
4,0 % l'once Troy, pierres précieuses 5,0 % le carat ; notes LME/FOB conservées).

## f) Normalisations de transcription (exhaustives)

1. « Article 1ᵉʳ.- » (exposant Unicode) → « Article 1er.- » ;
2. quatre têtes transcrites « Article N. » **sans tiret** (161, 193, 211, 226) rétablies
   « Article N.- » — style uniforme du Moniteur vérifié sur les scans (pp. 8-13, 47-48) ;
3. en-têtes TITRE/CHAPITRE joints « — » ; lignes de tableau jointes « — ».

Aucune autre altération : sentinelles verbatim exigées aux quatre coins du texte
(masthead, art. 6, « Articles 27 », charnière 142/143, tableau, art. 305, signatures).

## g) Code partagé touché

- `src/lib/doc/anchors.ts` : tête plurielle « Articles N.- » (garde stricte « .- ») ;
- `src/components/AnnotatedText.tsx` : `LEAD_ART` accepte le pluriel (retrait du libellé) ;
- `src/components/OfficialText.tsx` : renvois inline « article 54.1 » — suffixe décimal
  1-2 chiffres dans `ART_REF_RE`/`ART_NUM_RE` (anti-lien-mort inchangé : le lien n'est
  émis que si l'ancre existe dans le document) ;
- `page.tsx` : `DECRET_MINIER_2026` dans `hideInlineIndex` + `linkArtRefs`.

## h) Vérifications

- Parseur : segmentation 67/67, 342 ancres, index 0 mort, 13 sentinelles, notes de
  transcription exclues, plages sommaire ↔ positions réelles ;
- rendu : 342 articles → unités `parseOfficialText`, zéro perte de caractères,
  `LEAD_ART` 0 échec ; ancres pluriel/décimales + garde anti-citation testées ;
- renvois décimaux : « articles 54, 54.1, 54.2 » → 3 liens ; point final de phrase
  jamais capturé ;
- build Next : ✓ ;
- contre-audit adversarial (3 lentilles + vérification par constat) : voir §i.

## i) Contre-audit (workflow adversarial, 3 lentilles + vérification par constat)

**Lentille 1 — fidélité docx ↔ corps** : ré-extraction indépendante, diff token-par-token
sur les 27 214 tokens, alignement 1101/1101 lignes, audit caractère-par-caractère des
1 023 paragraphes appariés. **PASSE** : zéro ligne perdue, zéro ligne inventée, les
5 normalisations déclarées (§f) confirmées comme les seules altérations. **1 constat
mineur CONFIRMÉ puis corrigé** : deux paragraphes d'une même cellule du tableau
(« Concentré des métaux ») recousus sans espace (« zinc ;Concentré ») → jointure par
espace dans le parseur, corps réimporté (sentinelle ajoutée).

**Lentille 2 — conformité aux documents clients** : comparaison programmatique complète
(pas de sondage). **PASSE intégral** : sommaire 67/67 (intitulés au caractère près),
54/54 plages exactes avec tuilage complet des 342 articles ; index 392/392 identiques
(sujets, descriptions, renvois — 0 divergence), couverture 331/342 exacte, 16 sondages
de fond sémantiquement justes ; crossRefs factuellement exacts.

**Lentille 3 — plateforme & régressions** : scan exhaustif des 29 084 corps en base —
la branche plurielle « Articles N.- » ne matche qu'une ligne au monde (l'art. 27 du
décret) ; LEAD_ART n'avale aucun libellé ailleurs ; doc prod conforme octet pour octet ;
recherche FTS vérifiée de bout en bout (les 392 sujets d'index sont retrouvables —
« abandon travaux » matche hors corps). **1 constat mineur CONFIRMÉ puis corrigé** :
le suffixe décimal capturait le style des traités « article 17.2) » (Convention de
Paris) et 7 renvois perdaient leur lien de base → décimal refusé devant « ) », les
7 liens restaurés (6 cas de non-régression testés). Effet de bord **positif** conservé :
un lien faux préexistant de la Loi banques (« articles 4.2.1 à 4.2.5 de la loi du
21 février 2001 » → art. 4) disparaît.

**Observations sans suite** (choix assumés) : cellule fusionnée verticalement du tableau
(l'indice de prix Bauxite vaut pour les deux lignes < 5 % / ≥ 5 % — rendu texte standard
d'une fusion, rien répété) ; toc[0] verbatim J.O. + navToc rétabli « TITRE PREMIER » ;
`sourcePdfUrl` vide (les scans du Spécial N° 16 existent — à téléverser sur Blob si
souhaité).

## Réserves documentées

- La **Convention Minière type annexée** mentionnée par la note du transcripteur ne
  figure ni dans les transcriptions ni dans le sommaire client (les scans s'arrêtent
  aux signatures) — à intégrer si la cliente fournit le fascicule complémentaire.
- Les 11 articles non couverts par l'index client (§d).
