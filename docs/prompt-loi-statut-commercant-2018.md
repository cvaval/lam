# Prompt Claude Code — Loi N° 002-2018 portant Réforme du statut du commerçant
## Intégration à la plateforme Lam : téléversement annoté + refonte du Titre 1er du Livre premier du CODE DE COMMERCE
### Version rédigée après analyse du texte officiel — prête pour exécution agentique

---

## ⚠️ 0. Rectification de matière (constat d'analyse — à lire en premier)

La demande initiale indiquait que ce texte « modifie le Code civil ». **L'analyse du texte officiel établit qu'il modifie le CODE DE COMMERCE** : son article 1er dispose que « Le titre 1er du livre premier du Code de Commerce est désormais intitulé : “Des Commerçants, des Actes de Commerce et du Registre du Commerce” » et le recompose intégralement. **Aucune disposition ne touche le Code civil.** Toute l'opération vise donc le **Code de commerce annoté** (94 documents, thème « Droit commercial », déployé le 20 juil. 2026) — l'exécutant NE DOIT PAS écrire sur le Code civil.

---

## 1. Paramètres d'exécution

- `SOURCE_DOCX` = `/Users/cvaval/Downloads/Statut de commercant.docx` — **SOURCE PRINCIPALE** (consigne cliente du 25 juil. 2026 : préférer le docx, écarter le PDF comme source). Transcription propre et VÉRIFIÉE de la seule Loi 002-2018 : 284 paragraphes, 67 lignes « Article » (2 porteurs + 65 articles de code, comptages par série 1/4/9/13/2/4/9/3/3/15/2 exacts, 0 doublon), aucune coupure `<w:br/>` ; l'anomalie de la Section VI du Moniteur y est fidèlement reproduite (cf. §7.1).
- `PDF_COLLATION` = `/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/Statut-Commercant - 2018.pdf`, **pages 10-23** — pièce de COLLATION uniquement (images du Moniteur pour trancher un doute de transcription) ; ne rien en extraire par OCR. Ses pages 1-9 (Loi 003-2018, formation professionnelle) sont hors sujet.
- Pièges docx CONSTATÉS sur cette source : retirer `<w:pPr>…</w:pPr>` avant d'extraire les `<w:t>` (leçon `<w:tabs>` du Décret sûretés) ; en-têtes structurels en lignes SÉPARÉES à joindre (« TITRE PREMIER » + « DES COMMERÇANTS… », « SECTION VI » + « DE L'INFORMATION… », triplet « CODE DE COMMERCE / LIVRE PREMIER / SUR LE COMMERCE EN GÉNÉRAL ») ; têtes d'article COLLÉES (« Article 1.-Le titre 1er… », « Article 1000-1.-Tout commerçant… » — pas d'espace après « .- ») ; « Article 1.- » (et non « 1er ») pour le porteur ; apostrophes typographiques ’ déjà en place.
- Fin du document : « … Jovenel MOÏSE / Par le Président : » — les contreseings ministériels ne figurent NI dans le docx NI dans la page 23 du PDF (réserve mineure, ne rien suppléer).
- Référence : **Loi N° 002-2018 du 23 avril 2018, Le Moniteur, Spécial N° 5 du lundi 21 mai 2018** (173e année). Votée Chambre 31 août 2017, Sénat 3 avril 2018, promulguée Jovenel Moïse.
- Cible A (téléversement) : nouveau Document `source=LOI_STATUT_COMMERCANT_2018`, Législation annotée → thème **`droit-commercial`** (« Droit commercial » — celui du Code de commerce, pour qu'ils voisinent).
- Cible B (overlay) : le **Code de commerce annoté** — VÉRIFIÉ EN BASE : doc maître `cmrtnrxhu0000hg04ggz2lw0f`, `source=CODE_COMMERCE_ANNOTE`, corps ouvrant sur « Livre Premier — Sur le commerce en général / Titre Premier — Des commerçants et des actes de commerce ». **L'ancien Titre 1er = les articles 1er à 8** (commerçants, actes de commerce, mineur émancipé, femme marchande publique) — dont les arts. 5, 6 et 8 (consentement du mari) sont précisément les dispositions discriminatoires que la loi élimine. Le Titre II (« Des livres de commerce ») commence à l'article 9 : borne de fin de la zone remplacée.
- Patrons de référence (mêmes mécanismes, scripts versionnés) : `_import-decret-suretes.ts` (téléversement annoté), `_apply-decret-suretes-cc.ts` (overlay + insertions + restructuration de sommaire), `parse_ds.py` (normalisations).

---

## 2. Rôle et mission

Tu es l'éditeur juridique de la plateforme Lam (lam.ht), section Législation annotée. Mission en **deux volets** :

1. **Volet A — Téléverser la Loi 002-2018** en lecteur annoté complet (sommaire hiérarchique, index alphabétique, renvois inline « article N », pastilles) — patron Décret sûretés/régimes matrimoniaux.
2. **Volet B — Porter la refonte au Code de commerce annoté** : le Titre 1er du Livre premier est **remplacé** par la nouvelle structure (3 chapitres, 9 sections, **65 articles nouveaux** en numérotation « 1111-1 »), les anciens articles du Titre 1er passant en état « remplacé » avec texte historique replié.

## 3. Garde-fous non négociables (leçons des opérations précédentes)

1. **Reproduction verbatim du docx** — zéro reformulation, zéro OCR. En cas de doute sur un passage, collation contre l'image de la page correspondante du `PDF_COLLATION` ; toute divergence docx↔Moniteur est consignée (jamais arbitrée silencieusement).
2. **Extraction « défaut-inclure jusqu'à borne structurelle »** pour les textes cités, JAMAIS de liste blanche de motifs (leçon sûretés : items a)–i) et alinéas nus perdus). Bornes = têtes d'article, intitulés, marqueurs de narration explicites.
3. **Sentinelles anti-circularité** : la vérification de fidélité compare le contenu en base à des chaînes témoins choisies dans le PDF À LA MAIN (jamais à la propre extraction du script). Sentinelles imposées : « L'achat de biens, meubles ou immeubles, en vue de leur revente » (1111-2 a), « Le mineur, sauf s'il est émancipé » (1112-2), « cinq (5) ans si elles ne sont pas soumises » (1120-1), « quarante-huit (48) heures » (1135-2), « accusé d'enregistrement de l'immatriculation » (1136-4 a), « articles 1332-1 et 1332-2 » (1137-2).
4. **Sauvegarde intégrale préalable** du Code de commerce (corps + annotations + ArticleVersion) avant toute écriture ; script idempotent ; restauration + ré-application en un passage propre si un correctif s'impose.
5. **bodyOriginal du Code de commerce : uniquement les éditions décidées ici** ; les libellés de sommaire = lignes du corps VERBATIM (jamais retapés — apostrophes !).
6. **Audit adversarial AVANT soumission** (obligatoire) : 3 relecteurs indépendants (fidélité OCR↔PDF page à page ; diff avant/après du corps ; conformité structurelle à l'article 1er de la loi) + contestation de chaque constat ; contre-audit après correctifs.
7. Aucune écriture sur le Code civil (cf. §0). Aucune suppression de document (règle DOC_DELETED sinon).

## 4. Structure du texte (analysée — inventaire de référence)

**Article 1er de la loi** recompose le Titre 1er du Livre premier du Code de commerce ainsi :

```
CODE DE COMMERCE — LIVRE PREMIER — SUR LE COMMERCE EN GÉNÉRAL
  Article 1000-1                     (champ d'application : tout commerçant, forme, territoire)
  TITRE PREMIER — DES COMMERÇANTS, DES ACTES DE COMMERCE ET DU REGISTRE DU COMMERCE
    Chapitre I — Du Statut du Commerçant
      Section I  — Définition du commerçant et des actes de commerce    arts. 1111-1 à 1111-4   (4)
      Section II — De la capacité d'exercer le commerce                 arts. 1112-1 à 1112-9   (9)
    Chapitre II — De la Prescription                                    arts. 1120-1 à 1120-13  (13)
    Chapitre III — Du Registre du Commerce
      Section I   — Missions du Registre                                arts. 1131-1, 1131-2    (2)
      Section II  — Organisation du Registre                            arts. 1132-1 à 1132-4   (4)
      Section III — Conditions de l'immatriculation                     arts. 1133-1 à 1133-9   (9)
      Section IV  — Effets de l'immatriculation                         arts. 1134-1 à 1134-3   (3)
      Section V   — Du Fichier National                                 arts. 1135-1 à 1135-3   (3)
      Section VI  — Informatisation du Registre et du Fichier National  arts. 1136-1 à 1136-15  (15)
      Section VII — Contentieux relatif au Registre                     arts. 1137-1, 1137-2    (2)
```

**Article 2 de la loi** : clause abrogatoire générale (« toutes dispositions contraires »), exécution par le Ministère du Commerce et de l'Industrie.

**Invariants de complétude (contrôles bloquants)** : **65 articles** de code cités (1 + 4 + 9 + 13 + 2 + 4 + 9 + 3 + 3 + 15 + 2) + **2 articles porteurs** de la loi ; 1 TITRE, 3 chapitres, 9 sections ; préambule = 11 visas + 8 considérants ; signatures Chambre (Bodeau/Jean/Alexandre), Sénat (Lambert/Chérubin/Joseph), promulgation Moïse du 23 avril 2018. Tout écart de comptage = STOP et rapport (ne pas « forcer » les invariants : les recompter sur pièce, cf. écarts constatés sur la table régimes matrimoniaux).

## 5. Volet A — téléversement de la loi (patron Décret sûretés)

1. Extraction directe du docx (parseur python patron `parse_ds.py` : pPr retiré, une ligne par alinéa, énumérations a)/1. conservées avec leur marqueur original).
2. `bodyOriginal` : intitulés en paires/triplets JOINTS « — » (libellés toc = lignes du corps verbatim) ; le docx n'a pas de bandeau du Moniteur (provenance dans `moniteurRef`) ; normaliser « Article N.-Texte » → « Article N.- Texte » (espace après « .- », journalisé) ; guillemets : structure directe non guillemetée, seuls des guillemets INTERNES légitimes (« Des Commerçants, … ») — n'y pas toucher.
3. `annotationsJson` : toc (lignes charnières verbatim : titre de la loi L1, visas→dispositif via « Le Pouvoir Exécutif a proposé et le Corps Législatif a voté la loi suivante : » ou la ligne réelle équivalente, TITRE/Chapitres/Sections, signatures) ; navToc descriptif ; labels (`art-1`, `art-2` de la loi + les 65 `art-1000-1`…`art-1137-2` — **vérifier la non-collision des ancres** : la loi a un « Article 1er » ET le code un « Article 1000-1 », pas de doublon attendu) ; index alphabétique curé (~20 sujets : actes de commerce par nature/par la forme, capacité, mineur émancipé, conjoint du commerçant, étranger/CARICOM, incompatibilités, interdictions, prescription quinquennale/annale, suspension/interruption, médiation, Registre du Commerce, immatriculation, radiation, Fichier National, voie électronique, accusé d'enregistrement, présomption de commercialité, patente, contentieux).
4. Fiche : `type=LEGISLATION`, `number='Loi N° 002-2018 du 23 avril 2018'`, `moniteurRef='Le Moniteur, Spécial N° 5 du 21 mai 2018'`, `publicationDate=2018-05-21`, matière commerciale, thème `commerce-industrie` (principal). `page.tsx` : ajouter la source à `linkArtRefs` + `hideInlineIndex`.
5. Renvois inline : « articles 1111-2 et 1111-3 ci-dessus » (1112-2), « l'article 1132-3 » (1133-2, 1133-5), « articles 1120-x » internes → liens d'ancre (anti-lien-mort automatique).

## 6. Volet B — refonte du Titre 1er du Livre premier du Code de commerce

1. **Reconnaissance préalable (lecture seule)** : dresser l'état du Titre 1er actuel — **articles 1er à 8** (« Article premier.- Sont commerçants ceux qui exercent des actes de commerce… » → « Article 8.- Les femmes marchandes publiques peuvent également engager, hypothéquer… »), intitulé « Titre Premier — Des commerçants et des actes de commerce », annotations existantes (jurisprudence Vandal !) sur ces 8 articles. Produire l'inventaire AVANT toute écriture. ⚠ Le corps porte des scories d'édition (« Titre II — Des livres de commerce Anc art 8 ») : ne pas les prendre pour des bornes.
2. **Remplacement structurel** (patron sûretés : indices capturés avant mutation, remplacements puis insertions de bas en haut) :
   - le nouvel intitulé du Titre 1er remplace l'ancien (corps + toc + navToc, ancre conservée → clés de jurisprudence stables) ;
   - insertion des 3 chapitres / 9 sections / 65 articles à la suite, chaque article préfixé « Art. N (L. du 23 avril 2018) » ;
   - les **anciens articles du Titre 1er** : pastille « **remplacé** » (à créer dans STATUS_BADGE si absente — sinon « abrogé » avec note explicite), texte historique + jurisprudence d'époque **repliés** (règle cliente : replier l'ancienne version), note connexe cliquable → la loi téléversée, à l'ancre homonyme ;
   - la jurisprudence Vandal des anciens articles reste attachée aux textes anciens (aucune migration sans instruction — règle §10 bis du chantier régimes matrimoniaux).
3. **Interaction Décret sûretés 2020 (déjà en réserve)** : porter les couches dans l'ordre chronologique — d'abord la présente loi (2018), puis le Décret sûretés (TITRE II : arts. 1611-1, 1611-2 remplaçant 91 et 93-95, art. 92 abrogé, art. 600 al. 3-5 réécrits — cf. `docs/livraison-decret-suretes.md` §d). Les deux chantiers sont indépendants (Titre 1er vs Titre VI/faillite) : aucune collision d'ancre attendue — le vérifier.
4. **Index du Code de commerce** : fusionner les ~20 sujets du §5.3 avec l'index maître existant (renvois vers les nouvelles ancres).
5. Contrôles avant écriture : segmentation projetée (en-têtes appariés = toc), nombre d'ancres = existant + 65 − (anciens articles supprimés ? NON — ils restent, remplacés) ; aucune ancre orpheline ; sentinelles §3.3 présentes dans les blocs extraits.

## 7. Anomalies de source — préservées et documentées, jamais corrigées silencieusement

1. **Intitulé de la Section VI discordant** — CONFIRMÉ dans les deux sources (docx rangées 40 vs 228-229 ; Moniteur p. 11 vs p. 20) : le sommaire de l'article 1er dit « De l'**informatisation** du Registre du Commerce et du Fichier National », l'en-tête du corps dit « DE L'**INFORMATION** DU REGISTRE DU COMMERCE ET DU FICHIER NATIONAL ». Retenir l'en-tête du CORPS pour l'affichage (verbatim), consigner l'écart.
2. **Renvois vers des articles inexistants** : 1137-1 renvoie à « l'article **1321-17** du Code de Commerce » et 1137-2 aux « articles **1332-1 et 1332-2** » — numérotation « nouvelle » d'autres tranches de la refonte du Code de commerce **jamais publiées à notre connaissance**. NE PAS créer de liens (anti-lien-mort les neutralise automatiquement) ; réserve explicite en note de livraison ; note connexe possible sous 1137-1/1137-2 signalant que ces articles ne figurent dans aucun texte publié connu.
3. **1112-3** contient une abrogation matérielle dans son propre texte (« Sont abrogées, les dispositions assujettissant l'étranger commerçant à l'obtention de la licence d'étranger et du permis de travail ») — vise notamment le décret du 13 janvier 1978 (droit de licence, visé au préambule) : consigner, aucun autre document de la plateforme à modifier.
4. La numérotation « 1000-1 / 1111-1… » est disjointe de la numérotation historique du Code (1-648…) : c'est le système de la loi, à reproduire tel quel (`articleAnchorFromHeading` gère « 1111-1 » → `art-1111-1`).
5. Scories OCR : à corriger seulement dans les limites du §10 du chantier régimes matrimoniaux (corrections mono-caractère non ambiguës, journalisées) — le reste préservé.

## 8. Contrôles de fin (pass/fail exécutables)

1. Comptages du §4 exacts (65 + 2 ; 3 chapitres ; 9 sections) — loi ET overlay.
2. Sentinelles §3.3 présentes dans les corps stockés (loi et Code de commerce).
3. Segmentation des deux documents : en-têtes appariés N/N ; 0 ancre orpheline ; 0 renvoi d'index mort.
4. Rendu effectif : chaque ligne stockée → son propre paragraphe/item (simulation `parseOfficialText`, leçon du recousage) ; aucun « / » orphelin ; anciens articles du Titre 1er repliés avec pastille.
5. Recherche : « acte de commerce », « immatriculation registre du commerce », « prescription commerciale » → la loi et le Code de commerce en tête.
6. Audit adversarial (§3.6) : tous constats corrigés + contre-audit PASS avant commit/déploiement.

## 9. Livrables

1. Scripts versionnés : `scripts/data/loi-statut-commercant-2018/` (OCR vérifié + annotations + parseur), `_import-loi-statut-commercant.ts`, `_apply-loi-statut-commercant-ccom.ts` (+ sauvegarde `backup-before-*.json`).
2. `docs/livraison-loi-statut-commercant.md` : opérations, corrections d'OCR journalisées, anomalies (§7), réserves (renvois 1321-17/1332-x ; anciens articles remplacés — liste exacte à arrêter en Phase de reconnaissance), contrôles §8.
3. Mémoire projet mise à jour (project-code-commerce).

*Rappel du disclaimer Lam : reproduction fidèle, non officielle ; en cas de divergence, la version publiée au Moniteur prévaut.*
