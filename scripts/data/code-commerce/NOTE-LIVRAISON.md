# Note de livraison — Code de commerce, édition Vandal (20 juillet 2026)

## Livré (94 documents, thème « Droit commercial » sous « Droit économique & des affaires », À PLAT)

- **Le Code de commerce** (source `CODE_COMMERCE_ANNOTE`) : 644 articles (1→673),
  4 Livres / 26 Titres / 19 Chapitres / 52 Sections / 4 §, 79 statuts
  modifié/abrogé (marqueurs « mod »/« abr » et têtes « (L./D. …) » de l'édition),
  36 arrêts de jurisprudence (référence + considérant) en blocs REPLIABLES sous
  16 articles — clé `sec-K|art-N` identique au Code du travail / Code civil,
  reconnue 16/16 par le lecteur ; capture des DEUX formats Vandal (numéroté
  « N.- Arrêt… » ET nu « Arrêt du… », ce dernier manqué à la 1ʳᵉ livraison) ;
  9 notes éditoriales « Notes • … » en commentaires repliables (8 articles) ;
  considérants, notes et 108 marqueurs « Anc art N » retirés du texte officiel
  (corps 253 Ko) ; variante de lecteur « annotations » (comme le Code civil :
  collapsible « Annotations » = Commentaires + Jurisprudence) ; renvois inline
  « l'article N » actifs, lecteur annoté identique au Code civil.
- **93 textes satellites** (sources `CC_VANDAL_<id>`) : 1 909 articles au total,
  titres exacts du CSV, référence Moniteur (`moniteurRef`) et date de publication
  extraites de la ligne 2 quand présentes, désignation dans `Document.number`
  (résolution « par désignation »), conventions maritimes ancrées par « Règle N ».
- **Index maître Vandal** (201 sujets, 2 645 références) :
  · sur le Code : 185 sujets (118 avec renvois internes, 53 alias « V. sujet »
    résolus, 55 sujets portant 426 renvois inter-documents « D. 28 août 1960,
    art 6 › » cliquables) ;
  · sur 36 satellites : leurs propres sujets (ancres validées) ;
  · 58 CrossRef ÉDITORIAL « VOIR » Code → textes cités (rétroliens « cité par »
    automatiques) ; les références de pages imprimées ne sont jamais affichées.
- Recherche : chaque document cherchable (searchText) ; les sujets d'index
  alimentent annotationsText (« nolissement », « warrant » → le Code).
- Miroir OpenSearch local réindexé au fil de l'eau (la prod est en FTS).

## Exclusions (décision cliente)

8 extraits du Code douanier NON importés (version plus récente déjà en ligne) :
I-C-2, I-I, I-M, I-N, V-A-3, V-B-2, V-D-2, V-G. V-F (loi de 1995, texte
autonome) importée.

## Corrections cliente du 20 juil. (2ᵉ passe)

- 11 arrêts au format nu récupérés (art. 13, 19, 21, 38, 42, 54, 91, 96, 212, 215, 264).
- Notes éditoriales repliables : « Marine Haïtienne » sur l'art. 232 bis
  (⚠ l'art. 233 est ABSENT de l'édition Vandal, qui passe de 232 bis à 234 ;
  la note suit l'art. 232 bis dans la source — l'« article 233 » de fait) ;
  « L'art 188 est devenu 231 » sur l'art. 242 + renvoi d'index cliquable
  vers l'art. 231 au bas de l'article.
- Titre « Des prescriptions » (Livre I) inséré comme en-tête avant l'art. 68.
- Titre de la Section III (commissionnaires) complété : « … par terre, par eau
  ou par la voie de l'air. ».
- Casse des en-têtes corrigée : chiffres romains en capitales (« Section III »,
  plus « Section Iii ») ; tiret cadratin en double (« — — ») supprimé (23 titres).

## Anomalies assumées

- Art. 233 absent de l'édition source ; articles 55-67 et 292-312 absents car
  renvoyés aux décrets satellites / abrogés (décret-loi du 22 déc. 1944) —
  documenté dans le texte.
- II-M et VII-E : consolidations Vandal à numérotation imbriquée (10 têtes en
  double ; première occurrence ancrée).
- V-C et V-I : conventions en prose sans articles numérotés (lecteur standard).
- 7 désignations de l'index citent des textes hors du lot (D. 24 sept. 1970…) —
  consignées, aucun lien mort ; 6 dates ambiguës liées vers tous leurs candidats.
- 113 références de l'index vers des ancres absentes des satellites — écartées
  (anti-lien-mort), détail dans resolution-report.json.

## Limitation moteur (préexistante, hors lot)

Le moteur intégré (prod) ne trouve pas un mot présent UNIQUEMENT dans le corps
d'un document (candidat éliminé au scoring — constat déjà documenté à l'audit
de juillet). Mitigé ici par la richesse de l'index Vandal injecté dans
annotationsText. Recommandation plateforme : plancher de score sur la
correspondance searchText.

## Livrables

- `Officiel_Inventaire_controle.csv` (colonne contrôle remplie : OK / OK avec
  réserve / EXCLU) · `table-correspondance.csv` (id Vandal ↔ id plateforme) ·
  `parsed/resolution-report.json` (table de résolution + anomalies).
- Scripts commités : `parse_cc0.py`, `parse_index.py`, `parse_satellites.py`,
  `_import-code-commerce.ts`, `_import-code-commerce-satellites.ts`,
  `_link-code-commerce-index.ts`, `_audit-code-commerce.ts`.
- Backup pré-import : `backups/lam-2026-07-20.dump` (12 Mo, 55 tables).

## Audit final

31 contrôles OK · 0 problème — échantillons article-par-article conformes aux
sources, 11 références d'index vérifiées (document + ancre), 58/58 CrossRef
résolus, 0 document manquant vs CSV, 0 résidu d'entités HTML, 0 titre en
double inter-sections, thème à 94/94.
