# Prompt — Signature électronique, échanges électroniques, administration électronique

> Cahier des charges d'intégration de **5 textes** à la plateforme Lam. Rédigé après lecture
> intégrale des 9 documents fournis et vérification de l'état réel de la base de production.

---

## 1. Inventaire vérifié

| # | Texte | Publication | Articles | Destination |
|---|---|---|---|---|
| **T1** | Décret du **9 déc. 2015** sur la signature électronique | Moniteur 171ᵉ Année, N° 20, 29 janv. 2016 | 17 | Droit privé |
| **T2** | Décret du **6 janv. 2016** — administration électronique | Moniteur 171ᵉ Année, N° 20, 29 janv. 2016 | 51 (6 titres) | **Droit public** |
| **T3** | Loi du **14 fév. 2017** sur la signature électronique | Moniteur 172ᵉ Année, Spécial N° 12, 11 avr. 2017 (promulguée 17 mars 2017) | 17 → **25** | Droit privé |
| **T4** | Loi du **14 fév. 2017** sur les échanges électroniques | Moniteur 172ᵉ Année, Spécial N° 12, 11 avr. 2017 | 18 (17 + art. 9-1) | Droit privé |
| **T5** | Décret du **20 août 2025** amendant la loi de 2017 | Moniteur 180ᵉ Année, Spécial N° 55, 27 août 2025 | 3 | Droit privé |

Documents d'appui fournis : sommaire analytique + index pour T5, sommaire + index pour T3,
sommaire pour T4. **Aucun** pour T1 et T2 (à produire, ou à livrer sans index — voir §7).

---

## 2. Chaîne des modifications — le cœur du dossier

```
Décret 20 août 2025 (T5)
   └─ amende ─► Loi 14 fév. 2017 signature (T3)
                   ├─ art. 1  ─ réécrit ─► C. civ. art. 1101
                   ├─ art. 2  ─ réécrit ─► C. civ. art. 1102   ⚠ art. 2 lui-même amendé par T5
                   ├─ art. 3  ─ réécrit ─► C. civ. art. 1111
                   ├─ art. 4  ─ réécrit ─► C. civ. art. 1112
                   └─ art. 5  ─ réécrit ─► décret-loi 27 nov. 1969 (notariat), art. 30 §1
```

**Ce que fait exactement T5** (article 2 du décret, vérifié article par article) :

| Opération | Articles de la loi de 2017 | Nb |
|---|---|---|
| **Ajoutés** (« nouveau ») | 1.1 · 2.1 · 2.2 · 2.3 · 2.4 · 2.5 · 8.1 · 8.2 | **8** |
| **Réécrits** (« modifié ») | 2 · 6 · 7 · 8 · 10 · 11 · 14 · 15 | **8** |
| **Abrogé** | 16 | **1** |

L'article 3 de T5 est une clause d'abrogation **générique** (« toutes dispositions
contraires ») : ne rien marquer comme abrogé sur son seul fondement.

**T1 (2015) et T3 (2017) sont quasi identiques** : mêmes 17 articles, même plan, mêmes
matières — T3 reprend T1 au présent de l'indicatif (« pourront » → « peuvent ») et modifie
l'article 16 (« Un Arrêté présidentiel déterminera… » → « La loi détermine… »). T3 abroge
les dispositions contraires (art. 17). **T1 est donc supplanté par T3** — voir la décision
à trancher au §8.

**T2 et T4 sont autonomes** : ils ne réécrivent aucun article d'un texte existant.

---

## 3. ⚠️ Le manque à combler : le Code civil n'a jamais été mis à jour

Vérifié en production le 23 juil. 2026 — les quatre articles visés affichent **encore leur
texte de 1825** :

| Article | Statut actuel | Ancienne version | Overlay `ArticleVersion` |
|---|---|---|---|
| C. civ. 1101 | aucun | non | aucun |
| C. civ. 1102 | aucun | non | aucun |
| C. civ. 1111 | aucun | non | aucun |
| C. civ. 1112 | aucun | non | aucun |

Un avocat qui consulte aujourd'hui l'article 1101 du Code civil sur la plateforme y lit une
règle de preuve **antérieure à la réforme de 2017**. C'est le point le plus important du
dossier : il ne s'agit pas d'ajouter des textes, mais de **corriger un état du droit faux**.

⚠️ **Double cascade sur l'article 1102** : la version à retenir n'est PAS celle de la loi de
2017, mais celle que le décret de 2025 lui substitue (« … dans les conditions fixées par
l'**Arrêté d'application de la Loi sur la signature électronique** », et non « … fixées par
la loi »). Vérifier mot pour mot contre T5, paragraphe « L'article 2 se lit désormais
comme suit ».

Le **décret-loi du 27 novembre 1969 sur le notariat** (art. 30 §1, également réécrit) n'est
pas sur la plateforme en texte intégral — seulement en entrée d'Index du Moniteur. Hors
périmètre ; à consigner comme reste-à-faire.

---

## 4. Arborescence d'accueil (thèmes vérifiés, tous deux VIDES aujourd'hui)

- **Droit privé → `signature-electronique`** « Signature & échange électronique » — thème
  déjà créé, 0 document : il attend précisément ces textes. Destination de T1, T3, T4, T5.
- **Droit public → `droit-public`** « Droit public & administratif », 0 document.
  Destination de T2. Ajouter en thème secondaire `administration-centrale`
  « Administration centrale de l'État » (patron du Code de commerce : thème précis +
  thème parent).

Type `LEGISLATION`, format « lecteur annoté » (sommaire + index latéraux + renvois inline),
conformément à la règle générale du projet.

---

## 5. Travail demandé, par lots

### Lot A — Loi de 2017 sur la signature électronique, **texte consolidé** (T3 + T5)

C'est la pièce maîtresse. L'index de la cliente le dit expressément : « les renvois
s'entendent des articles de la **Loi du 14 février 2017 telle qu'amendée** ».

- Document unique, source `LOI_SIGNATURE_ELECTRONIQUE_2017`, titre mentionnant la
  consolidation (« … telle qu'amendée par le décret du 20 août 2025 »).
- **Le texte en vigueur prévaut** : chaque article réécrit affiche la version 2025.
- 8 articles **« nouveau »** (1.1, 2.1→2.5, 8.1, 8.2) — ancres `art-1-1`, `art-2-1`… (vérifié).
- 8 articles **« modifié »** — version 2017 d'origine en **repliable** (`oldVersions`).
- Article 16 **« abrogé »** — son texte conservé, replié.
- Sommaire et index : ceux fournis pour T5 (le sommaire emploie déjà « (nouveau) »,
  « (modifié) », « Abrogé » — vocabulaire identique à celui de la plateforme) complétés du
  sommaire/index de T3 pour les articles non touchés.
- Note connexe cliquable vers T5 sous chaque article amendé (patron du décret sûretés).

### Lot B — Décret du 20 août 2025 comme texte autonome (T5)

Source `DECRET_SIGNATURE_ELECTRONIQUE_2025`. 3 articles propres + les articles amendés
cités *in extenso*. Renvois croisés vers le Lot A. Même patron que
`_import-decret-bail-pro.ts`.

### Lot C — Loi de 2017 sur les échanges électroniques (T4)

Source `LOI_ECHANGES_ELECTRONIQUES_2017`. 18 têtes d'article (attention : **art. 9-1**,
ancre `art-9-1`). Texte autonome, aucun overlay. Sommaire fourni ; index à produire ou à
omettre.

### Lot D — Décret du 6 janvier 2016, administration électronique (T2) → **Droit public**

Source `DECRET_ADMINISTRATION_ELECTRONIQUE_2016`. 51 articles, hiérarchie riche
(6 TITRES → CHAPITRES → Sections) : la table des matières doit la refléter fidèlement.

### Lot E — Décret du 9 décembre 2015 (T1)

Source `DECRET_SIGNATURE_ELECTRONIQUE_2015`. 17 articles. Statut à trancher (§8).
Note connexe renvoyant à T3 qui lui succède.

### Lot F — Overlay du Code civil ⚠️ *le plus important*

Sur `CODE_CIVIL_ANNOTE`, articles **1101, 1102, 1111, 1112** :

- Texte principal = **nouvelle rédaction** (1102 : version 2025 ; les trois autres :
  version 2017).
- `status` = **« modifié »**.
- `oldVersions` = texte de 1825, **repliable**, petits caractères.
- `connexe` = bloc cliquable vers le Lot A à l'ancre de l'article source (art. 1 → 1101,
  art. 2 → 1102, art. 3 → 1111, art. 4 → 1112).

Deux mises en œuvre possibles — **choisir la même que pour les décrets déjà appliqués au
Code civil** (régimes matrimoniaux, filiation, sûretés) pour ne pas créer une seconde
mécanique : soit `applyAmendments` / `ArticleVersion` (overlay), soit réécriture du corps +
`oldVersions`. Vérifier ce qu'ont fait `_apply-decret-suretes-cc.ts` et
`_apply-decret-regimes-matrimoniaux.ts` et s'y conformer.

---

## 6. Règles d'affichage (uniformité — déjà en place, à respecter)

| Statut | Étiquette | Ancienne version repliable |
|---|---|---|
| Article réécrit | **modifié** | **oui** |
| Article ajouté | **nouveau** | non |
| Article abrogé | **abrogé** | **oui** (texte conservé, replié) |

Vocabulaire **unique** de la plateforme, audité le 23 juil. 2026 sur les 27 textes annotés :
`modifié` · `nouveau` · `abrogé` · `partiellement abrogé` — **0 écart**. Le terme « amendé »
a été écarté par la cliente : ne pas le réintroduire, malgré le titre du décret de 2025
(« portant **amendement** de la loi… ») qui ne vaut que pour le titre.

Rendu (composants `RelatedLaw` / `OldVersion`, déjà conformes) : version en vigueur en texte
principal, ancienne version **repliée par défaut, 11,5 px** (contre 15 px), pastille de
statut visible **sans déplier**. Contrôle : `npx tsx scripts/_audit-statuts.ts`.

---

## 7. Pièges — relevés sur les intégrations précédentes

1. **Numérotation décimale.** `Article 1.1` → `art-1-1`, `Article 8.2` → `art-8-2`,
   `Article 9-1` → `art-9-1` (vérifié sur `articleAnchorFromHeading`). Ne pas laisser un
   analyseur lire « article 1 » puis un « 1 » orphelin.
2. **Guillemet ouvrant en tête de chaque alinéa cité.** T5 cite les articles amendés entre
   guillemets, avec le « répété à chaque alinéa (usage français de la citation longue). La
   détection de tête d'article est ancrée en `^` : une ligne « « Article 2.1.- » n'est PAS
   reconnue. Retirer le guillemet partout (leçon des décrets sûretés et bail professionnel).
3. **Index mêlant deux référentiels.** L'index de T5 renvoie aux articles de la LOI, mais
   cite aussi des articles du CODE CIVIL (« Acte authentique, art. 2 (C. civ., art. 1102) »).
   Un « 1102 » ne doit jamais devenir un renvoi interne à la loi : filtrer sur les ancres
   réellement existantes (anti-lien-mort) et traiter les renvois « C. civ. » comme externes.
4. **Renvois vers un AUTRE document** : `crossRefs.articles` vise le même document et n'a pas
   de champ d'ancre. Pour pointer du Code civil vers la loi (ou l'inverse), employer un
   `ConnexeBlock` avec `docId` + `anchor`.
5. **Ancres `sec-N` : ne jamais renuméroter** en insérant des en-têtes ; prendre des ancres
   au-delà du maximum utilisé, insérées à la bonne position dans la table.
6. **Sentinelles à relever dans le TEXTE, jamais dans le sommaire client.** Une sentinelle
   tirée d'un sommaire a fait échouer, à juste titre, l'import du décret bail professionnel.
7. **Ne pas confondre T1 et T3** : quasi identiques mot pour mot. Les distinguer par la
   conjugaison (futur/présent) et par l'article 16. Vérifier qu'on importe le bon fichier.
8. **`.env` pointe sur la base de PRODUCTION.** Sauvegarder avant (`scripts/backup-db.sh`
   ou export ciblé des documents touchés).
9. **Travail concurrent.** La cliente intègre d'autres textes en parallèle (décret IMF, loi
   UCREF) : `src/app/[locale]/(app)/doc/[id]/page.tsx` est partagé — n'y faire que des
   ajouts chirurgicaux aux deux `Set` de sources, et ne pas commiter le travail d'autrui.

---

## 8. Décisions — TRANCHÉES le 29 juil. 2026

**a) Statut du décret du 9 décembre 2015 (T1) — VALIDÉ.** Publié avec le statut **ABROGÉ**,
assorti de la note « Supplanté par la loi du 14 février 2017 sur la signature électronique
(abrogation des dispositions contraires, art. 17) ». Il s'agit d'une abrogation tacite,
jamais énoncée article par article : la note doit le dire, sans prétendre à une abrogation
expresse.

**b) Loi de 2017 : document consolidé — VALIDÉ.** **Un seul document** portant le texte
« telle qu'amendée » (Lot A), conforme à l'index de la cliente et à l'usage — l'avocat
cherche le droit en vigueur. Le décret de 2025 reste consultable à part (Lot B).

**c) Index manquants — PRODUITS.** Les trois index absents ont été générés (IA Gemini,
repli Claude), relus, corrigés et livrés au format .docx de la cliente :

| Index | Sujets | Renvois | Couverture | Fichier |
|---|---|---|---|---|
| Décret 2015 signature | 49 | 65 | 17/17 art. | `Index_Decret_Signature_Electronique_2015.docx` |
| Décret 2016 administration | 177 | 265 | 51/51 art. | `Index_Decret_Administration_Electronique_2016.docx` |
| Loi 2017 échanges | 67 | 79 | 18/18 art. | `Index_Loi_2017_Echanges_Electroniques.docx` |

Chaîne de production, versionnée dans `scripts/data/electronique-2015-2025/` :
`extract_arts.py` → `_gen-index-electronique.ts` (IA, incrémental) → `render_index_docx.py`
(corrections éditoriales + consolidation + rendu Word). Format identique à celui des index
de la cliente : en-tête, nota, en-têtes de lettre, `sujet` + TABULATION + `art. N ; art. M`.

Contrôles passés : **0 renvoi mort**, **100 % des articles couverts**, relecture des
297 libellés. Corrections appliquées à la relecture (table nominative, pas d'heuristique) :
deux libellés pour une même notion au décret de 2015 (« Prestataire de services de
certification » / « … électronique ») fusionnés ; anglicismes « (Definition) » supprimés ;
« Relation extra contractuelle » → « extracontractuelle » ; sujets satellites sans point
d'entrée nouveau absorbés.

⚠️ **Ces index restent un appareil éditorial produit par IA : ils appellent une relecture
juridique avant publication.** Les fichiers .docx sont modifiables directement ; toute
correction y sera reprise telle quelle par les scripts d'import.

---

## 9. Recette (critères de réception)

- [ ] **C. civ. 1101, 1102, 1111, 1112** affichent la nouvelle rédaction, pastille
      « modifié », texte de 1825 en repliable — et **1102 porte bien la version 2025**
      (mention de l'« Arrêté d'application »), non celle de 2017.
- [ ] Loi de 2017 consolidée : **8** articles « nouveau », **8** « modifié » avec version
      2017 repliable, art. 16 « abrogé » avec texte replié. Total 25 têtes d'article.
- [ ] Sommaire et index de la cliente reproduits fidèlement ; **0 renvoi mort**.
- [ ] Renvois « C. civ. » de l'index non transformés en liens internes à la loi.
- [ ] Loi échanges : 18 têtes, dont `art-9-1`. Décret 2016 : 51 articles, 6 titres, hiérarchie
      complète dans la navigation. Décret 2025 : 3 articles.
- [ ] Thèmes : T1/T3/T4/T5 sous « Signature & échange électronique » ; T2 sous « Droit public
      & administratif ».
- [ ] Vocabulaire de statut inchangé (`_audit-statuts.ts` : 0 écart, 0 « amendé »).
- [ ] Sentinelles : 10 phrases relevées à la main dans les .docx, retrouvées à l'identique.
- [ ] Recherche : « signature électronique », « prestataire de services de confiance »,
      « message de données », « CONATEL », « administration électronique » remontent les
      bons textes.
- [ ] Idempotence : chaque script relancé deux fois ne produit ni doublon ni écart.

---

## 10. Reste-à-faire consigné

- **Décret-loi du 27 novembre 1969 sur le notariat**, art. 30 §1, réécrit par l'article 5 de
  la loi de 2017 : le texte n'est pas sur la plateforme (seulement en Index du Moniteur).
  À téléverser puis à amender, dans un lot ultérieur.
- **Arrêté d'application** de la loi sur la signature électronique : visé à de nombreuses
  reprises par le décret de 2025 (niveaux de sécurité, conditions de qualification,
  admissibilité en justice…). Un arrêté CONATEL du 18 septembre 2025 existerait ; à
  rechercher et intégrer — sans lui, plusieurs renvois de la loi consolidée restent sans
  cible.
