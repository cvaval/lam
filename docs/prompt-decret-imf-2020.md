# Prompt d'exécution — Décret sur les Institutions de Microfinance (IMF), 2020

> Téléversement en **lecteur annoté** (sommaire + index latéral + renvois croisés),
> au format du Code civil. Ce document est la spécification d'autorité : il a été
> écrit APRÈS analyse complète des trois fichiers ; tous les chiffres qui y figurent
> sont mesurés, pas supposés. Toute divergence constatée à l'exécution doit être
> traitée comme un défaut à investiguer, pas comme une donnée à ajuster.

## 1. Objet

**Décret portant organisation et fonctionnement des Institutions de Microfinance
(IMF)**, donné au Palais National le **5 juin 2020**, publié au **Moniteur, Spécial
N° 24 du mardi 25 août 2020** (175ᵉ Année), signé Jovenel Moïse.

- **Emplacement** : Législation annotée → Droit économique & des affaires →
  **Banques & institutions financières** (`droit-bancaire`, `isPrimary: true`) —
  le décret est le texte-cadre du secteur, sous supervision BRH ; il rejoint la Loi
  du 14 mai 2012 sur les banques et la série bancaire Vandal (21 docs aujourd'hui).
- **Source** : `DECRET_IMF_2020` · type `LEGISLATION` · statut `EN_VIGUEUR`.
- `publicationDate` **2020-08-25** (date du Moniteur ; ne PAS mettre le 5 juin, qui
  est la date du décret — la règle d'audit « aucune référence sans appui dans la
  source » s'applique) ; `moniteurRef` = « Le Moniteur, Spécial N° 24 du 25 août
  2020 ». L'entrée existe déjà à l'Index du Moniteur (25 août 2020) : la cohérence
  des deux fiches est vérifiable.

## 2. Sources fournies (rôles distincts)

| Fichier (~/Downloads) | Rôle |
|---|---|
| `decret-imf-texte_1.docx` | **texte officiel** — 440 ¶ + 1 tableau (20 lignes de signatures ministérielles) |
| `~/Downloads/Decret_IMF_Sommaire_CORRIGE.docx` | **sommaire CORRIGÉ (28 juil. 2026)** — autorité de STRUCTURE. Remplace `decret-imf-sommaire_1.docx`, dont les 32 folios étaient ceux du fichier Word ; ils portent désormais la pagination du Journal officiel (vérifiée page à page, 33/33 exacts), plus l'entrée SIGNATURES (p. 21-23) et 3 notes de relevé. Les 32 plages d'articles d'origine étaient exactes et sont inchangées. |
| `decret-imf-index_1.docx` | **index alphabétique préparé par la cliente** — autorité de l'INDEX (260 lignes) |
| `~/Library/CloudStorage/Dropbox/Moniteur/Microfinance.pdf` | **fac-similé du Journal officiel** (24 pages) fourni par la cliente — autorité SUPRÊME en cas de divergence |

Le fac-similé porte une couche texte OCR (`pdftotext -layout`) de qualité moyenne
(accents perdus, `l`→`!`, « les »→« Jes », « 50 »→« SO ») : exploitable pour les
contrôles de STRUCTURE (séquence des articles, ordre des en-têtes), **jamais** pour
un diff verbatim — pour la lettre du texte, lire les pages en image.

## 3. Structure établie (mesurée)

- **32 en-têtes** : 5 TITRES + 18 CHAPITRES + 9 Sections. Le sommaire client en
  liste les mêmes 32, plus deux lignes d'appareil (« TABLE DES TEXTES CITÉS 31 »,
  « INDEX ALPHABÉTIQUE DES MATIÈRES 32 ») qui ne sont PAS des en-têtes du corps.
- **80 articles** : numérotation 1 à 81, **sans article 13** (cf. §5).
- Découpage : TITRE I (art. 1ᵉʳ-5), TITRE II (6-47), TITRE III (48-70), TITRE IV
  (71-78), TITRE V (79-81). **L'article 48 se trouve entre le TITRE III et son
  CHAPITRE 1** (qui ouvre à l'art. 49) : le parseur doit accepter un article
  directement sous un TITRE.
- Masthead (4 lignes), page de garde, visas (17 « Vu ») et considérants (7),
  « DÉCRÈTE », puis le corps ; signatures en tableau à la fin.

## 4. Pièges du docx (tous constatés)

1. **Têtes d'articles COLLÉES** : `Article 12.-L'agrément…` — les 80 têtes sont sans
   espace après « .- ». Normaliser en `Article 12.- L'agrément…`.
2. **Ordinal en exposant Unicode** : `Article 1ᵉʳ.-` → normaliser en `Article 1er.-`
   (sans quoi `articleAnchorFromHeading` ne reconnaît pas la tête). Idem dans
   l'index : la référence « 1ᵉʳ » désigne l'article 1er. Fixer
   `labels["art-1"] = "Article 1er"`.
3. **Marqueurs d'énumération collés** : `1°)Autorité…`, `10°)le système…`,
   `a)à la qualité…` — environ 190 occurrences (23 formes « N°) », 11 formes
   « lettre) »). Normaliser par une espace après le marqueur.
4. **En-têtes sur DEUX lignes** : « TITRE I » / « DISPOSITIONS GÉNÉRALES »,
   « CHAPITRE 1 » / « CHAMP D'APPLICATION » → joindre « — » (patron Décret minier).
   Les 9 Sections sont déjà sur une seule ligne (« Section 2.- Conseil
   d'administration ») et doivent rester **verbatim**, y compris l'incohérence de la
   source entre `Section 1ᵉʳ.-` (chapitre 3) et `Section 1ʳᵉ.-` (chapitres 4 et 5) —
   elle figure à l'identique dans le sommaire client.
5. **Collision d'ancres** : une ligne « Section 1ᵉʳ.- … » non appariée au sommaire
   deviendrait l'ancre `art-1` (`articleAnchorFromHeading` accepte « section N »).
   Assertion obligatoire : ancres == exactement les 80 numéros d'articles, zéro
   doublon.
6. **Tableau final** = signatures (20 lignes, « fonction — nom »). Émission
   ligne-par-ligne, cellules jointes « — », paragraphes d'une même cellule joints
   par une **espace** (leçon Décret minier « zinc ;Concentré »).
7. **Note du transcripteur** entre les articles 12 et 14 (« [Note de transcription —
   lacune de numérotation… ») : ce n'est PAS du texte officiel → hors corps, mais
   son contenu doit être **reversé** en note (§5), jamais perdu (leçon IR 2005).
8. Aucun passage barré (`<w:strike/>` = 0) : pas d'annotation d'abrogation à prévoir.

## 5. Article 13 — lacune VÉRIFIÉE sur le fac-similé (réserve levée)

Le texte transmis passe de l'article 12 à l'article 14. **Vérification faite le
28 juillet 2026 sur le fac-similé fourni par la cliente** :

- **page 8 du Moniteur** (lecture en image) : l'article 12 s'achève par « …lui
  demandant de libérer le capital minimum souscrit en vue de l'obtention de
  l'agrément. », et la tête suivante est **« Article 14.- »** — aucun article 13 ;
- **balayage des 24 pages** (couche texte) : 80 têtes d'articles, soit exactement
  1 à 81 **sans le 13**, en ordre strictement croissant — cohérent avec la
  transcription et avec l'index client.

La lacune est donc celle du **Journal officiel lui-même**, pas de la transcription.
(Cas inverse du Décret minier 2026, où l'article 27 « absent » selon les documents
clients était en réalité imprimé « Articles 27.- ».)

Règles d'exécution :

- note publiée (crossRefs, ancre du CHAPITRE 1 du TITRE II), rédigée **en fait
  constaté avec sa référence** : « Le Journal officiel ne comporte pas d'article
  13 : la numérotation passe de l'article 12 à l'article 14 (Le Moniteur, Spécial
  N° 24 du 25 août 2020, p. 8). » ;
- assertion du parseur formulée sur la SOURCE, jamais sur la sortie : `bases ==
  [1..81] \ {13}` **et** « aucune ligne du docx ne commence par `Article 13` sous
  quelque forme que ce soit » (y compris le pluriel « Articles 13.- »). Vérification
  circulaire interdite (leçon audit vague 2 : ne pas relire le TOC produit) ;
- la contre-vérification du §11 rejoue le balayage sur le fac-similé, sans se fier
  au présent constat.

## 6. Index alphabétique (autorité cliente)

**239 entrées** : 105 sujets + 134 sous-entrées (« – … »), sur 20 lettres. Produire
une entrée `indexEntries` par ligne porteuse de renvois, libellé « Sujet — description »
pour les sous-entrées (patron Décret minier).

Grammaire des renvois, **à parser depuis la FIN de la ligne uniquement** :

| Forme | Exemple | Traitement |
|---|---|---|
| numéro simple | `Blâme 35` | `ctRefs: ["35"]` |
| liste `;` | `Confidentialité 55 ; 68 ; 70` | 3 renvois |
| article + alinéa | `Abus de position dominante 2, 1° ; 49` | renvois `2` et `49` ; l'alinéa « 1° » est reporté dans le libellé (« … (1°) »), jamais dans `ctRefs` |
| alinéas multiples | `Épargne 1ᵉʳ ; 2, 3°, 20°, 21° ; 8 …` | renvois `1`, `2`, `8`… ; libellé « (3°, 20°, 21°) » |
| ordinal exposant | `Coopérative … 1ᵉʳ ; 2, 21° ; 17 ; 41` | `1ᵉʳ` → `"1"` |

**Trois pièges vérifiés — des nombres figurent dans le LIBELLÉ et ne sont pas des
renvois** : « – délai de décision (90 jours) 11 », « Astreinte (pénalité de 1/1000)
71 », « Code pénal (article 323) 67 ; 70 ». Le parseur doit s'arrêter dès qu'un
token cesse de satisfaire la grammaire ci-dessus (balayage arrière), et **jamais**
scanner la ligne entière.

Assertions bloquantes : zéro renvoi hors des 80 ancres ; **couverture attendue
80/80** (mesurée : tous les articles sauf le 13 sont cités par l'index client). Si
la couverture n'est pas atteinte, c'est un défaut du parseur, pas de l'index.

## 7. Renvois croisés « comme dans le Code civil » — les quatre niveaux

1. **Renvois inline `article N`** : ajouter `DECRET_IMF_2020` à `ART_REFS_SOURCES`
   (page.tsx) → les ~85 renvois internes deviennent cliquables, l'anti-lien-mort
   filtrant le reste. Vérifier les 3 renvois EXTERNES repérés (« articles 9 et 17
   de la Loi du 17 août 1979 », « article 323 du Code pénal » ×2) : ils doivent
   rester en texte brut (gardes `ART_EXT_AFTER`, déjà en place — le tester).
2. **Index latéral + rebonds** : ajouter la source à `HIDE_INLINE_INDEX_SOURCES` ;
   `indexBacklinks` affiche alors sous chaque article les sujets connexes.
3. **Table des textes cités** (annoncée p. 31 du sommaire client mais **non fournie**)
   → la reconstituer à partir des visas et des citations inline, en `crossRefs.docs`
   sous l'en-tête du préambule, avec liens vers les documents DÉJÀ en ligne
   (identifiants vérifiés le 28 juil. 2026) :

   | Texte cité | Document plateforme |
   |---|---|
   | Constitution (art. 136, 159, 245) | `CONSTITUTION_1987` · `cmr1it23a0000b4r0l6r1xp5l` |
   | Code civil | `CODE_CIVIL_ANNOTE` · `cmr4b6f3v0000iz56asjmwrlg` |
   | Code de commerce | `CODE_COMMERCE_ANNOTE` · `cmrtnrxhu0000hg04ggz2lw0f` |
   | Loi du 3 août 1955, sociétés anonymes | `CC_VANDAL_IV-A-1` · `cmrtiwvt80000sa3z2kc7krwl` |
   | Loi du 13 juillet 1956, compagnies d'assurance | `CC_VANDAL_IV-D-1` · `cmrtix3ia0008sa3zg91rpcg3` |
   | Décret du 28 août 1960, régime spécial des SA | `CC_VANDAL_IV-A-2` · `cmrtiwwuo0001sa3zovs1xgz4` |
   | Loi du 17 août 1979 créant la BRH | `CC_VANDAL_II-B-1` · `cmrtiw94r0001ue7edw6au9ca` |
   | Décret du 17 mai 1995, taux d'intérêt | `CC_VANDAL_II-M` · `cmrtiwna3000hue7eew1lauci` |
   | Décret du 29 septembre 2005, impôt sur le revenu | `DECRET_IMPOT_REVENU_2005` · `cms43ptub00008lo8tv3y25kk` |
   | Loi du 14 mai 2012 sur les banques | `LOI_BANQUES_2012` · `cms18kwzl0002pt2kbk9kv39y` |

   Les autres textes visés (LBC/FT 2001 et 2013, UCREF 2017, TCA 2002, gage sans
   dépossession 2008) **ne sont pas encore sur la plateforme** : les citer en texte,
   sans lien, et les inscrire dans les réserves comme candidats d'acquisition.
4. **Mesures d'application (art. 80)** : l'article 80 charge la BRH d'édicter les
   mesures réglementaires. Les **trois circulaires BRH/IMF/2026** sont en ligne →
   les rattacher en `connexe` sous `art-80` (blocs cliquables, patron « Constitution
   de 1987 » sous l'art. 6 du Code du travail) :
   `cmqn0uy1q000013at67jc43f1` (risque de crédit), `cmqn0v5eo000113atdcveup4j`
   (liquidité), `cmqn0vcqo000213atbxlip573` (fonds propres).

## 8. Plateforme — une extension nécessaire

`NUMBER_RE` (`src/lib/doc/officiel.ts`) ne reconnaît pas le marqueur **« 13°) »**
(chiffre + degré + parenthèse) : la branche `\d{1,3}[.)°]` exige une espace après le
degré. Étendre pour la forme `\d{1,3}°\)` — sinon les ~190 alinéas numérotés des
articles 2, 12, 32… se recousent au paragraphe précédent. Régression à vérifier sur
les corpus existants (Loi banques, Code civil, Décret minier) : le motif est
nouveau, aucun texte en ligne ne l'utilise, mais le tester quand même.

## 9. Livrables

```
scripts/data/decret-imf-2020/parse_imf.py      # parseur (assertions bloquantes)
scripts/data/decret-imf-2020/bodyOriginal.txt  # corps officiel
scripts/data/decret-imf-2020/annotations.json  # toc, navToc, labels, indexEntries, crossRefs, connexe
scripts/_import-decret-imf.ts                  # import idempotent (upsert par source)
docs/livraison-decret-imf.md                   # livraison + réserves
```

`page.tsx` : `DECRET_IMF_2020` dans les deux ensembles (`HIDE_INLINE_INDEX_SOURCES`,
`ART_REFS_SOURCES`). Mémoire : mettre à jour `project-loi-banques.md` (la section
bancaire s'étoffe) ou créer `project-decret-imf.md`, + `MEMORY.md`.

**Fac-similé attaché** : téléverser `Microfinance.pdf` sur le Blob privé et
renseigner `sourcePdfUrl` (pipeline `project-pdf-storage` : route authentifiée
`/api/doc/[id]/pdf`, jeton `BLOB_READ_WRITE_TOKEN` explicite). Le lecteur pourra
ainsi confronter le texte annoté au Journal officiel — première fois qu'un texte de
la Législation annotée dispose de son fac-similé.

## 10. Vérifications bloquantes (avant tout commit)

1. **Parseur** : 32 en-têtes ; 80 ancres ; bases `[1..81] \ {13}` ; zéro doublon
   d'ancre ; aucune ligne « Article 13 » (toutes formes) dans la SOURCE ; sentinelles
   verbatim aux quatre coins (masthead « 175ᵉ Année — Spécial N° 24 », « DÉCRÈTE »,
   « Article 1ᵉʳ.- » normalisé, définition « 13°) Microcrédit », art. 80 BRH, art. 81
   abrogatoire, « Donné au Palais National… le 5 juin 2020 », dernière signature) ;
   notes de transcription exclues du corps mais reversées en note.
2. **Sommaire client** : appariement 32/32 dans l'ordre (libellés normalisés, après
   retrait des « (art. N à M) » et du numéro de page collé) ; plages d'articles du
   client vérifiées contre les positions réelles ; tuilage complet des 80 articles.
3. **Index client** : 239 entrées reproduites, 0 renvoi mort, couverture 80/80, aucun
   nombre de libellé pris pour un renvoi (les 3 cas du §6 testés explicitement).
4. **Import** : `segmentAnnotated` → 32 sections, 80 ancres, `labels` sans orphelin,
   `crossRefs`/`connexe` sur ancres existantes, thème `droit-bancaire` `isPrimary`.
5. **Rendu** : chaque article → unités `parseOfficialText` non vides, **aucune ligne
   perdue** (sonde tolérante aux marqueurs de liste) ; les alinéas « N°) » rendus en
   liste numérotée (après extension §8).
6. `npm run typecheck` + `npm run lint` + `npm test` + `npm run build` verts.

## 11. Contre-audit adversarial (obligatoire avant commit)

Workflow à 3 lentilles, avec vérification adversariale de chaque constat :

1. **Fidélité** : ré-extraction INDÉPENDANTE du docx (parcours séquentiel de
   `<w:body>`, tableau inclus, `<w:pPr>` retiré avant lecture des `<w:t>`) ; diff
   ligne-à-ligne et caractère-par-caractère ; les seules altérations admises sont
   les 4 normalisations déclarées (§4.1-4.4) — toute autre est un défaut.
   **Contrôle contre le fac-similé** (nouveau) : rejouer sur les 24 pages du PDF le
   balayage des têtes d'articles et de l'ordre des en-têtes (couche texte, tolérante
   aux confusions d'OCR `5`↔`S`, `0`↔`O`, `1er`↔`t ••`) ; lire **en image** au moins
   6 pages réparties et confronter mot à mot un paragraphe de chacune à la
   transcription — c'est le seul moyen de détecter une omission commune au docx et à
   l'index client.
2. **Conformité aux documents clients** : sommaire 32/32 et index 239/239 comparés
   programmatiquement (pas par sondage), plus sondage de FOND sur ≥ 12 entrées
   d'index (lire l'article ENTIER avant de juger le sujet).
3. **Plateforme & régressions** : `NUMBER_RE` étendue sans effet sur les corpus
   existants ; renvois inline (3 externes neutralisés, internes liés) ; liens de la
   table des textes cités et des circulaires résolus ; recherche (searchText,
   searchTsv) contenant les sujets d'index.

L'audit doit vérifier les **sources**, jamais les sorties du parseur (leçon vague 2 :
une assertion circulaire avait verrouillé la disparition du TITRE IV de
l'Enregistrement).

## 12. Réserves à consigner dans la livraison

- **Table des textes cités** (p. 31 du sommaire) non fournie : reconstituée des
  visas ; 5 textes visés absents de la plateforme (LBC/FT 2001 et 2013, UCREF 2017,
  TCA 2002, gage sans dépossession 2008) — candidats d'acquisition.
- L'article 13 n'est plus une réserve : son absence est **vérifiée au Journal
  officiel** (§5) et doit être présentée comme telle au lecteur.
- Incohérence `Section 1ᵉʳ` / `Section 1ʳᵉ` : conservée verbatim (présente dans la
  transcription ET le sommaire client) — le Journal officiel imprime en réalité la
  même forme abrégée dans les deux cas (p. 10 et 12).
- **Numérotation des chapitres** : le J.O. alterne romain (« CHAPITRE I » aux Titres
  I et II) et arabe (« CHAPITRE 2 » et suivants) ; la transcription docx uniformise
  en arabe. Le corps téléversé suivra la transcription (cohérence avec les libellés
  du sommaire, condition de l'appariement `segmentAnnotated`), la divergence étant
  consignée en note — arbitrage à confirmer avec la cliente si elle préfère le sic.
- Coquille du J.O. p. 13 : « RÉGLEMENTATIONET DIVULGATION FINANCIÈRES » (espace
  manquante), rétablie dans la transcription et le sommaire corrigé.
