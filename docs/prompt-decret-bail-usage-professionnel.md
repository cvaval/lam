# Prompt — Décret du 9 avril 2020 sur le Bail à Usage Professionnel

> **À lire avant d'exécuter.** Ce prompt est destiné à être confié à un agent (ou repris en
> début de session) pour intégrer le décret à la plateforme Lam. Il est écrit à partir de la
> lecture intégrale des trois documents sources et de l'état réel de la base de production.

---

## ⚠️ Rectification de prémisse — à valider avant de commencer

La demande initiale décrivait ce texte comme « le décret sur le bail à usage professionnel
**qui modifie le Code civil** ». La lecture du décret établit autre chose :

| Ce qui a été supposé | Ce que fait réellement le décret |
|---|---|
| Il modifie le Code civil | Il modifie le **Code de commerce** (titre VII du livre 1er) |
| Il abroge des articles du Code civil | Il n'en abroge **aucun** |

Textuellement, l'**article 1729-3** (inséré au Code de commerce) dispose que les dispositions
du chapitre II de la Loi n° 23 du Code civil sur le louage des choses **« ne sont pas
applicables au bail à usage professionnel »**. Ce n'est **pas une abrogation** : ces articles
demeurent pleinement en vigueur pour tous les autres baux (habitation, ferme…). Les marquer
« abrogé » serait une **erreur juridique** aux conséquences sérieuses pour un utilisateur
qui consulterait le Code civil pour un bail d'habitation.

**Conséquence sur le travail** : la consigne « les articles abrogés indiqueront abrogé et
seront repliables » n'a pas d'objet ici — il n'y a aucun article abrogé à traiter. Elle est
néanmoins conservée au **Lot D** (uniformisation), où elle s'applique aux articles réellement
abrogés du Code civil et du Code de commerce par d'autres textes.

---

## Objectif

1. Publier le décret comme **texte autonome** consultable.
2. Appliquer ses effets au **Code de commerce** (33 articles nouveaux + 1 renuméroté + refonte
   d'un intitulé de titre).
3. Poser au **Code civil** une signalisation exacte : les articles du louage des choses sont
   *écartés pour le bail professionnel*, non abrogés.
4. **Uniformiser** la présentation des statuts d'articles dans les deux codes.

---

## Données d'entrée

| Fichier | Contenu | Rôle |
|---|---|---|
| `Decret_Bail_a_Usage_Professionnel_9_avril_2020.docx` | Texte intégral (~18 200 car.) | Corps |
| `Sommaire_Decret_Bail_a_Usage_Professionnel.docx` | Sommaire client, art. par art. | `navToc` / `toc` |
| `Index_Decret_Bail_a_Usage_Professionnel.docx` | Index alphabétique des matières | `indexEntries` |

Référence de publication : **Le Moniteur, 175ᵉ Année, Spécial N° 4, lundi 11 mai 2020, pp. 1–8**.
Signataire : Jovenel Moïse, président — donné le 9 avril 2020.

---

## Inventaire vérifié du décret

Le décret compte **11 articles propres** (`Décret, art. 1er` à `art. 11`) qui insèrent
**33 articles** au Code de commerce, répartis en 9 sections :

| Section | Intitulé | Articles | Nb |
|---|---|---|---|
| 1 | Champ d'application | 1721-1 → 1721-3 | 3 |
| 2 | Conclusion et durée du bail | 1722-1 → 1722-3 | 3 |
| 3 | Obligations du bailleur | 1723-1 → 1723-8 | 8 |
| 4 | Obligations du preneur | 1724-1 → 1724-4 | 4 |
| 5 | Loyer | 1725-1 → 1725-2 | 2 |
| 6 | Cession et sous-location | 1726-1 → 1726-2 | 2 |
| 7 | Conditions et formes du renouvellement | 1727-1 → 1727-6 | 6 |
| 8 | Résiliation du bail | 1728-1 → 1728-2 | 2 |
| 9 | Dispositions finales | 1729-1 → 1729-3 | 3 |
| | | **Total** | **33** |

Opérations structurelles supplémentaires (`Décret, art. 1er`) :

- **Titre VII du livre 1er** renommé : « Des achats et ventes » → **« Des contrats commerciaux »**.
- Ce titre comporte désormais **deux chapitres** : ch. Ier « Des achats et des ventes »,
  ch. II « Du bail à usage professionnel ».
- **Article 111 renuméroté en 1710-1**, *libellé inchangé* — c'est une renumérotation, non une
  réécriture. (L'art. 111 existe bien en base : « Article 111.- Les achats et ventes se
  constatent: ».)
- `Décret, art. 11` : clause d'abrogation **générique** (« toutes dispositions contraires »),
  sans désignation d'article — ne rien marquer comme abrogé sur cette base.

---

## État actuel de la plateforme (vérifié en production)

| | Code civil | Code de commerce |
|---|---|---|
| `source` | `CODE_CIVIL_ANNOTE` | `CODE_COMMERCE_ANNOTE` |
| `id` | `cmr4b6f3v0000iz56asjmwrlg` | `cmrtnrxhu0000hg04ggz2lw0f` |
| articles (`labels`) | 2107 | 709 (n° max : 673) |
| `oldVersions` | 189 | 8 |
| `status` | 274 | 148 |

`annotationsJson` a **la même structure dans les deux codes** :
`title, annotationAuthor, navToc, toc, connexes, jurisprudence, commentaires, connexe,
indexEntries, oldVersions, status, labels, crossRefs`.

Vocabulaire `status` **actuellement en base** :

| Valeur | Code civil | Code de commerce |
|---|---|---|
| `modifié` | 136 | 65 |
| `abrogé` | 68 | 18 |
| `nouveau` | 60 | 65 |
| `partiellement abrogé` | 10 | — |

Ni `1710-1` ni `1721-1` n'existent encore au Code de commerce. Les articles du louage des
choses au Code civil (**1484 → 1549**, chapitre II de la Loi 23, 3 sections) n'ont
**aucun statut** posé aujourd'hui.

---

## Travail demandé

### Lot A — Le décret comme texte autonome

Importer le décret en **LÉGISLATION**, thème **Droit commercial** (celui du Code de commerce),
avec `source = DECRET_BAIL_PRO_2020`, sur le modèle des imports précédents (décret minier,
décret sûretés).

- Corps : les 11 articles du décret, avec les articles insérés cités *in extenso*.
- `navToc` / `toc` : depuis le **sommaire client** (le respecter à la lettre — il est validé).
- `indexEntries` : depuis l'**index client**. Attention, l'index mêle deux systèmes de
  renvois — les numéros nus (`1724-2`) visent les articles **du Code de commerce**, tandis que
  `Décret, art. 11` vise le décret. Le nota en tête de l'index l'explicite : le respecter.
- Métadonnées : date de signature 2020-04-09, `moniteurRef` = Moniteur 175ᵉ année, Spécial N° 4
  du 11 mai 2020.

### Lot B — Overlay du Code de commerce

C'est le cœur du travail. Sur `CODE_COMMERCE_ANNOTE` :

1. **33 articles nouveaux** (1721-1 → 1729-3) : insérés avec `status = "nouveau"`, et
   l'étiquette **« nouveau »** visible. Les 9 sections doivent apparaître comme en-têtes dans
   le corps et dans la table des matières.
2. **Article 111 → 1710-1** : le texte demeure **identique**. C'est une **renumérotation**.
   Ne pas la présenter comme une modification de fond : conserver l'ancienne désignation en
   version repliable avec la mention « ancienne numérotation : article 111 », et poser
   `status = "modifié"`.
3. **Titre VII du livre 1er** : intitulé mis à jour, structure en deux chapitres.
   ⚠️ *Leçon du décret sûretés* : un intitulé absent de la table des matières **disparaît**
   sous l'overlay. Vérifier que les deux nouveaux chapitres apparaissent bien dans `navToc`.
4. Renvoi croisé : depuis l'article 1710-1 et depuis le chapitre II, lier vers le décret
   (`CrossRefEntry.docs`), comme pour la loi Filiation → Code civil.

### Lot C — Signalisation au Code civil (sans abrogation)

Sur les articles **1484 à 1549** du Code civil (chapitre II « Du louage des choses ») :

- **Ne poser aucun statut d'abrogation.** Ces articles restent en vigueur.
- Ajouter un **encadré de renvoi** (repliable, sur le modèle de l'encadré « Constitution de
  1987 » de l'art. 6 du Code du travail) portant une mention du type :

  > **Bail à usage professionnel** — Les dispositions du présent chapitre contraires au
  > chapitre II du titre VII du livre 1er du Code de commerce ne sont **pas applicables**
  > au bail à usage professionnel (C. com., art. 1729-3, décret du 9 avril 2020). Elles
  > demeurent applicables aux autres baux.

  avec un lien cliquable vers C. com. art. 1729-3 et vers le décret.
- Poser cet encadré **au niveau du chapitre** (art. 1484) au minimum ; l'appliquer à chaque
  article de la plage est préférable si le lecteur peut arriver directement sur un article
  par ancre ou par recherche — ce qui est le cas.

### Lot D — Uniformisation de la présentation des statuts

C'est la demande « revoir le format des autres articles afin que ce soit uniforme ».

**Décision arrêtée : le terme retenu est « modifié »**, pour rester uniforme avec le reste du
Code civil. « amendé » est écarté. **Aucune migration de données n'est donc nécessaire** : les
201 articles déjà étiquetés `"modifié"` (136 au Code civil, 65 au Code de commerce) restent en
l'état, et tout article modifié par le présent décret reçoit `status = "modifié"`.

Le vocabulaire étant déjà uniforme, ce lot porte sur la **présentation** :

| Statut | Étiquette affichée | Ancienne version repliable ? |
|---|---|---|
| Article réécrit par un texte postérieur | **modifié** | **oui** — l'ancienne version, en petits caractères |
| Article ajouté par un texte postérieur | **nouveau** | non (il n'y a pas d'antérieur) |
| Article abrogé | **abrogé** | **oui** — le texte abrogé, repliable |
| Article partiellement abrogé | **partiellement abrogé** | **oui** — la partie abrogée |

Règles d'affichage (déjà en place pour le Code civil, à rendre uniformes) :

- La **version en vigueur prévaut** : elle est le texte principal, en pleine taille.
- L'**ancienne version est repliable**, en **caractères plus petits**, fermée par défaut.
- L'étiquette de statut est visible **sans avoir à déplier**.
- Un article abrogé conserve son texte, mais **replié**, avec l'étiquette « abrogé ».

Périmètre : `CODE_CIVIL_ANNOTE` **et** `CODE_COMMERCE_ANNOTE` (les deux, sinon l'uniformité
demandée n'est pas atteinte). Vérifier ensuite que les autres textes annotés porteurs de
statuts (Code du travail, Code pénal, loi bancaire, décret minier) emploient le même
vocabulaire, ou consigner l'écart s'il est volontaire.

---

## Pièges connus — à ne pas redécouvrir

1. **Collision de numérotation entre les deux codes.** Les nouveaux articles du Code de
   commerce portent les numéros 1721 à 1729 ; le Code civil possède aussi des articles 1721 à
   1729 (il va jusqu'à 2107). Un renvoi « 1721-1 » ne doit **jamais** pointer vers l'article
   1721 du Code civil. Vérifier `anchors.ts` / `anchorFromDesignation` et la logique de
   renvois inline (`CIV_RE`, `artRefs`, `linkCivRefs`).
2. **Numérotation décimale.** Le format `1721-1` doit produire une ancre du type `art-1721-1`
   (précédent établi par le décret minier : `art-39-1`). Risque réel : un analyseur naïf lit
   « article 1721 » puis un « 1 » orphelin. Un article `1710-1` **ne doit pas** être confondu
   avec l'intervalle « 1710 à 1 ».
3. **`<w:tab/>` et `<w:tabs>` dans le docx** — pièges rencontrés sur le Code pénal et le Code
   civil : les tabulations disparaissent à l'extraction naïve et soudent les mots.
4. **Énumérations collées** (`1)`, `2)`, `3)`) : très présentes dans ce décret (art. 1721-1,
   1729-3). Précédent loi bancaire : ne pas laisser `NUMBER_RE` avaler ces numéros comme des
   numéros d'article.
5. **Jamais de filtre de longueur sur les têtes de section** (leçon phase 2 fiscale : « TITRE
   IV » disparaissait).
6. **Vérification circulaire = aveugle** (leçon décret sûretés) : ne pas valider l'extraction
   avec le script qui l'a produite. Utiliser des **sentinelles** — phrases tirées à la main du
   docx et recherchées dans le résultat final.
7. **`.env` pointe sur la base de PRODUCTION.** Toute écriture est immédiate et réelle.
   Sauvegarder avant (`scripts/backup-db.sh`), et vérifier la cible avant tout script d'import.

---

## Recette (critères de réception)

À produire comme sortie de contrôle, chiffres à l'appui :

- [ ] Le décret est consultable, sommaire et index conformes aux documents clients.
- [ ] Code de commerce : **33** articles nouveaux présents, étiquetés « nouveau », répartis
      dans les 9 sections attendues (3/3/8/4/2/2/6/2/3).
- [ ] Article 1710-1 présent, **texte identique** à l'ancien article 111 (comparaison
      caractère par caractère), ancienne numérotation consultable en repliable.
- [ ] Titre VII intitulé « Des contrats commerciaux », ses deux chapitres visibles dans la
      navigation.
- [ ] Code civil : articles 1484–1549 **toujours sans statut d'abrogation**, porteurs de
      l'encadré de renvoi vers C. com. 1729-3.
- [ ] Vocabulaire de statut identique dans les deux codes ; **0** occurrence du terme
      « amendé » (écarté).
- [ ] Anciennes versions : repliées par défaut, en petits caractères, étiquette visible sans
      dépliage.
- [ ] Aucun renvoi « 17xx-x » du Code de commerce ne pointe vers le Code civil (contrôle
      automatisé sur l'ensemble des liens générés).
- [ ] Sentinelles : 10 phrases tirées à la main des trois docx, retrouvées à l'identique.
- [ ] Recherche plein-texte : « bail à usage professionnel », « preneur », « 1729-3 »
      remontent les bons documents.

---

## Décision arrêtée

**Terme retenu : « modifié ».** « amendé » est écarté, au profit de l'uniformité avec le reste
du Code civil — c'est aussi le terme usuel de la légistique haïtienne, « amendé » s'employant
plutôt pour la Constitution.

Conséquence : **aucune migration de données**. Les 201 articles existants portent déjà le bon
terme. Le Lot D se limite donc à la **présentation** (ancienne version repliable, en petits
caractères, étiquette visible sans dépliage) et au contrôle que les autres textes annotés
— Code du travail, Code pénal, loi bancaire, décret minier — n'emploient pas un vocabulaire
divergent.
