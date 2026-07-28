# Livraison — Phase 2 fiscale, vague 1 (textes du Code Fiscal Paillant 2018)

Trois textes fiscaux CONSOLIDÉS téléversés en Législation annotée (lecteur annoté :
sommaire + index latéral + renvois inline), classés par COPIE dans les deux foyers
fiscaux : **Fiscalité** (Droit économique, thème principal) et **Fiscalité / impôts
(DGI)** (Droit fiscal & douanier). Source des trois : fichiers
`Code_Fiscal_*RECONSTITUE.docx` (~/Downloads), reconstitutions de l'édition Joseph
Paillant du Code Fiscal d'Haïti (2018).

## 1) Décret du 29 septembre 2005 relatif à l'Impôt sur le Revenu

Doc `cms43ptub00008lo8tv3y25kk` · `source=DECRET_IMPOT_REVENU_2005` — **le texte
demandé nommément par la cliente**, absent de la plateforme jusqu'ici (le corpus
Vandal n'avait que le décret IR de 1986).

- **189 articles** + insertions des lois de finances (63-1, 63-2 ancrés ; les
  articles LF répétant un numéro — 2ᵉ « 15 », « 31 », « 64-66 » primes des agents
  publics, secteur informel, carrières de sable — restent à leur place de
  consolidation, sans ancre propre) ;
- sommaire 32 en-têtes (4 titres, 10 chapitres, 18 sections), barème de l'impôt
  (tableau 5 tranches, 0 %→30 %) restitué ligne à ligne ;
- **8 passages abrogés** (barrés dans l'édition : anciens seuils et rédactions)
  retirés du corps vif et restitués VERBATIM en annotations repliables sous les
  articles 8, 33, 43, 45, 49 (×3) et 81 ; l'occurrence vive de « quinze millions »
  à l'art. 187 (seuils historiques transitoires) est conservée ;
- **index alphabétique curé : 369 sujets, couverture intégrale 191/191** (curation
  distribuée en 5 tranches avec lecture intégrale de chaque article, fusion et
  assertions bloquantes : zéro renvoi mort, zéro article non couvert) ;
- exclusions déclarées (pas du texte officiel) : bloc de titre d'édition, « Note
  d'édition » du transcripteur, bloc « Table des matières » du livre ;
- normalisation unique : « Article 74.a) » → « Article 74.- a) » (tête sans « .- »).

## 2) Décret du 29 novembre 1978 sur le droit de timbre (consolidé)

Doc `cms442pmz00008e3gecnevdfu` · `source=DECRET_TIMBRE_1978_CONSOLIDE` — version
**consolidée par les LF 2011-2012 et 2013-2014** (le texte d'origine de 1978, non
consolidé, reste disponible dans le corpus Vandal — règle copier-jamais-déplacer).

- 42 articles, 9 chapitres ; index 33 sujets, couverture 42/42 ;
- pastille « abrogé » sur l'art. 33 (Timbre Santé, abrogé par le décret du
  14 octobre 1988) ;
- premier jet d'index chapitre-par-chapitre CORRIGÉ après lecture des 42 articles
  (leçon Loi banques : plusieurs attributions initiales étaient fausses).

## 3) Loi du 10 juin 1996 relative à la patente (texte consolidé)

Doc `cms44buwc0000l3ru6aypo0vd` · `source=LOI_PATENTE_1996_CONSOLIDE` — **la « loi
sur la patente » demandée** : décret du 28 septembre 1987 refondu par la Loi du
10 juin 1996, consolidé par les **LF 2012-2013 et 2015-2016**.

- 30 articles, 5 chapitres + 18 sous-titres (liste blanche verbatim) + section
  tarif ; **tarif de patente : 93 lignes de nomenclature des secteurs** (tableau
  ligne à ligne, note des codes ajoutés par la LF 2012-2013 conservée) ;
- **6 anciennes rédactions barrées** (arts 6, 7, 8 ×2, 12, 29 — remplacées par la
  LF 2015-2016) en annotations repliables + pastille « modifié » sur ces articles ;
- les articles modificateurs de la LF 2015-2016 cités en regard sont préfixés
  « — » (sans quoi « Article 4 Loi de Finances… » serait pris pour une tête
  d'article) — contenu verbatim après le préfixe ;
- index 29 sujets, couverture 30/30 (rédigé après lecture intégrale de la tranche).

## Quitus fiscal — déjà couvert

Le **Décret du 28 septembre 1990 sur le quitus fiscal** est déjà sur la plateforme
en texte intégral (corpus Vandal `CC_VANDAL_VII-D-4`), classé en Fiscalité +
Fiscalité/impôts depuis la phase 1. La rubrique Paillant correspondante (« 9.- Droit
pour l'obtention du quitus fiscal ») n'apporte que le barème du droit — intégrable
plus tard avec les « Droits et taxes divers » (voir Reste à faire).

## Vérifications

- Parseurs : assertions bloquantes (bornage, séquences d'articles, sentinelles aux
  quatre coins, barrés hors corps vif mais capturés, couverture d'index) ;
- rendu : chaque article des 3 textes → unités `parseOfficialText`, zéro ligne
  perdue (sonde tolérante aux marqueurs de listes) ;
- imports : segmentation N/N, ancres complètes, zéro renvoi d'index mort,
  annotations non orphelines ; thèmes `fiscalite` (principal) + `fiscalite-impots` ;
- `page.tsx` : les 3 sources dans `hideInlineIndex` + `linkArtRefs` ; build ✓ ;
- contre-audit adversarial 3 lentilles (fidélité IR ; fidélité timbre+patente ;
  index de fond + plateforme) : voir §Contre-audit.

## Contre-audit (3 lentilles + vérification par constat)

Fidélité vérifiée par ré-extractions indépendantes : IR **749/749 lignes identiques
caractère par caractère**, timbre et patente **SHA1 identiques** (délimitation de la
portion patente refaite de zéro par l'auditeur, champ TOC Word correctement évité),
barrés/tarifs/sous-titres tous conformes. **3 constats majeurs CONFIRMÉS, tous
corrigés avant commit :**

1. **Références de consolidation de l'IR perdues à la coupe** (« Moniteur spécial
   # 10 du 5 octobre 2005 », « modifiant celui du 29 septembre 1986 », 5 lois de
   finances avec leurs Moniteurs) → reprises VERBATIM dans la note de tête
   (patron timbre) + assertions dans le parseur ;
2. **`moniteurRef` inventé** (« N° 87 du 29 septembre 2005 » — sans appui dans la
   source) → corrigé en « Spécial N° 10 du 5 octobre 2005 », dates alignées.
   L'audit a intercepté ici une violation de la règle « zéro citation inventée » ;
3. **8 sujets d'index pointant sur le mauvais homonyme** (le contenu des articles
   insérés par LF — carrières de sable, secteur informel, primes des agents
   publics — renvoyait aux 1ᵉʳˢ articles 15/31/64-66 sans rapport) → les insertions
   sont désormais préfixées « — » (texte courant sous l'article hôte, comme la
   patente) et les 8 entrées reciblées vers les articles hôtes (20, 42, 95) avec
   mention « insertion des lois de finances ».

Observation intégrée : entrée CSCCA renommée « (recours et contrôle) » (l'art. 183
vise le contrôle, pas le recours). Constat positif notable : les annotations
« passages barrés » se rendent sans réglage supplémentaire (le composant affiche
les commentaires dès qu'ils existent), pastilles « abrogé »/« modifié » actives.

## Réserves documentées (artefacts de la SOURCE, conservés verbatim)

- IR, art. 96 : résidu de reconstitution « au taux de te% 15% » (coquille du
  fac-similé — à corriger si la cliente fournit le scan du Moniteur) ;
- timbre, chapitres VI-VII : 118 montants collés aux libellés (« Timbre Bébé
  Sain20.00 ») — le docx source est déjà ainsi ; lisible, à retoucher sur consigne ;
- les 186 balises `<w:strike w:val="false">` du docx timbre sont explicitement
  NON barrées (vérifié par l'audit — aucune abrogation manquée).

## Reste à faire (vagues suivantes, sur go)

L'inventaire complet des `Code_Fiscal_*` de ~/Downloads révèle le Code Fiscal
Paillant quasi entier. Candidats des prochaines vagues :

1. **Livre I, 2ᵉ partie — Droits et taxes divers** (9 rubriques : carte d'identité
   fiscale — décret du 29 septembre 2005 distinct de l'IR, carte professionnelle
   1960, droits de fonctionnement, timbre proportionnel sur capital social 1903/1974,
   transmission des titres, taxe sur masse salariale 1988, droit de licence 1978,
   droit du quitus 1990/1995) ;
2. **Livre I, 3ᵉ partie (suite)** : CFGDCT (loi du 20 août 1996), CFPB (décret du
   5 avril 1979), droit d'alignement, numérotage, étalonnage… ;
3. **Livre II** : enregistrement & conservation foncière (décrets du 28 septembre
   1977), droits et taxes divers, TCA/CAS ;
4. **Livre III** : zones franches (loi du 22 septembre 2003? — vérifier), code des
   investissements, marchés publics 2009, CSCCA 23 novembre 2005, parcs
   industriels, lois de finances 2016, pension civile 2011 ;
5. sommaire général (`SOMMAIRE_RECONSTITUE`) et index du livre (`Index_RECONSTITUE`)
   utilisables comme autorités de structure pour ces vagues.
