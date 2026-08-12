# Prompt — Saisie et téléversement des décisions judiciaires (Lam)

## Contexte

Projet Next.js 14 (App Router, TypeScript, Tailwind, Prisma, i18n FR/EN/HT) :
`/Users/cvaval/Library/CloudStorage/Dropbox/Lam Veritab/lam-veritab`

La plateforme publie le droit haïtien. Le type de document `JURISPRUDENCE` **existe déjà**
dans le code — il figure dans `src/lib/types.ts`, porte la pastille `JUR` dans
`src/lib/brand.ts`, et son onglet apparaît au tableau de bord — mais **la base n'en compte
aucun document**. Tout le circuit est donc à créer : saisie, téléversement, lecture.

Document de référence joint : `Sommaire_Analytique_Arrets_2-16_1964-1965.docx`
(Cour de Cassation, Première Section, exercice 1964-1965, arrêts n° 2 à 16 —
28 octobre 1964 au 13 janvier 1965). **C'est lui qui fixe le modèle de données** : ne rien
inventer au-delà, ne rien en retrancher.

---

## 1. Ce que le document impose comme modèle

Le recueil a deux niveaux, et l'écran doit refléter les deux.

### 1.1 Le RECUEIL (en-tête, une fois)

| Donnée | Exemple | Remarque |
|---|---|---|
| Juridiction | Cour de Cassation de la République d'Haïti | |
| Section / chambre | Première Section | facultatif hors Cassation |
| Exercice | 1964-1965 | deux millésimes, pas une année |
| Plage d'arrêts | n° 2 à 16 | déduite, à ne pas ressaisir |
| Période couverte | 28 octobre 1964 – 13 janvier 1965 | déduite des dates |

### 1.2 Chaque DÉCISION (15 dans ce volume)

| Champ | Exemple | Obligatoire |
|---|---|---|
| Numéro d'arrêt | `2` | oui |
| Intitulé (parties) | Jules CESAR c. Fleurant LALANNE | oui |
| Date de l'arrêt | 28 octobre 1964 | oui |
| Juridiction | Cour de Cassation…, Première Section | oui — héritée du recueil, modifiable |
| Décision attaquée | Trois jugements du Tribunal de Paix d'Aquin (11 août, 13 septembre et 4 novembre 1961) | oui |
| Solution | Déchéance du pourvoi. | oui |
| Résumé de la décision | paragraphe libre | oui |
| Domaine(s) du droit | Procédure civile (voies de recours…) | oui |

**La « Solution » est à double détente.** Le document écrit des phrases entières
(« Rejet du pourvoi ; confiscation de l'amende ; distraction des dépens au profit de
Me LUBIN. »), mais toutes se ramènent à **cinq issues** :

`REJET` · `CASSATION_AVEC_RENVOI` · `CASSATION_SANS_RENVOI` · `DECHEANCE` · `IRRECEVABILITE`

Prévoir donc **deux champs** : l'issue (liste fermée, filtrable et statistiquement
exploitable) et le **dispositif littéral** (texte libre, reproduit tel quel). Réduire l'un
à l'autre ferait perdre soit la recherche, soit la fidélité au texte.

⚠️ Une décision peut cumuler (« Jonction des requêtes ; irrecevabilité… ») : l'issue retient
la mesure PRINCIPALE, le dispositif conserve l'intégralité.

### 1.3 La synthèse finale

Le document se clôt sur une **« Synthèse par domaine du droit »** — quatre paragraphes qui
commentent l'ensemble du volume. Elle appartient au recueil, pas à une décision : lui
prévoir un champ propre, et l'afficher en tête du recueil.

### 1.4 Deux qualifications posées par l'éditeur

Au-delà de ce que le document contient, MASTER_ADMIN et EDITEUR doivent pouvoir qualifier
chaque décision sur **deux axes indépendants**. Indépendants, et il faut y insister : un
arrêt peut faire jurisprudence ET avoir été renversé depuis. Les fondre en un seul champ
rendrait ce cas indescriptible.

#### Axe 1 — TRAITEMENT ultérieur (positif / négatif / neutre)

Comment les décisions postérieures ont traité celle-ci.

| Valeur stockée | Icône | Libellé FR | Sens |
|---|---|---|---|
| `POSITIF` | ✅ | Confirmée, suivie | reprise ou approuvée depuis |
| `NEGATIF` | ⚠️ | Renversée, critiquée | contredite ou abandonnée depuis |
| `NEUTRE` | ➖ | Citée sans prise de position | mentionnée, sans approbation ni rejet |
| *(non renseigné)* | — | Non évalué | état par défaut |

⚠️ **TROIS FORMES DISTINCTES, pas trois couleurs.** Coche, triangle, tiret : chacune se
reconnaît en niveaux de gris et en daltonisme. La règle 5 de la charte interdit
l'information portée par la seule couleur — or le rouge et le vert sont à 1,05:1 de
luminance, indiscernables en daltonisme rouge-vert. Un émoji vert et un émoji rouge de
même forme seraient exactement le défaut que la règle proscrit.

⚠️ **L'ÉMOJI NE DOIT JAMAIS VOYAGER SEUL.** Il accompagne toujours son libellé textuel :
les émojis se rendent différemment d'un système à l'autre, et les lecteurs d'écran les
annoncent de façon inconstante. Prévoir `aria-hidden` sur le glyphe et le sens dans le
texte.

⚠️ **NE PAS STOCKER L'ÉMOJI.** La base garde l'énumération (`POSITIF`…), l'interface rend
le glyphe. Stocker une présentation interdit de la changer, et casse tout filtre.

#### Axe 2 — PORTÉE (fait jurisprudence, ou non)

Toute décision n'établit pas une règle. Distinguer :

| Valeur stockée | Icône | Libellé FR | Sens |
|---|---|---|---|
| `JURISPRUDENCE` | ⚖️ | Fait jurisprudence | pose ou confirme une règle |
| `ESPECE` | 📄 | Décision d'espèce | tranche un litige sans portée générale |
| *(non renseigné)* | — | Non qualifiée | état par défaut |

Dans le volume joint, la distinction est parlante : les arrêts qui prononcent une
**déchéance** pour défaut de consignation de l'amende (n° 2, 6, 10, 11) tranchent une
formalité et n'établissent rien ; ceux qui appliquent l'article 1170 C.Civ. à la garde
des choses (n° 5, 7, 13) posent une règle. **Ne pas déduire cette qualification
automatiquement** — c'est un jugement éditorial, il revient à l'éditeur.

#### Ce que ces deux champs imposent

**Une qualification non sourcée est une affirmation gratuite.** Sur une plateforme
juridique, dire d'un arrêt qu'il est « renversé » sans dire par quoi n'engage personne et
n'aide pas le lecteur. Chaque axe reçoit donc :

- une **note libre** (« renversée par Cass. 2e Sect., n° 47 du 12 mars 1971 ») ;
- l'**auteur** de la qualification et sa **date**, tracés par `audit()`.

Les deux champs restent **facultatifs** : mieux vaut « non évalué » qu'une évaluation
inventée pour remplir la case. L'interface doit rendre cet état visible — un blanc n'est
pas un neutre.

**Réutiliser `src/components/StatusChip.tsx`**, déjà factorisé (constat d'audit : quatre
implémentations identiques auparavant). Y ajouter les nouvelles clés plutôt que de créer
une cinquième pastille — mais en veillant à ce que le glyphe accompagne le libellé, ce
que le composant actuel ne prévoit pas encore.

**Filtres** : les deux axes rejoignent juridiction, exercice, issue et domaine dans les
filtres de la liste (§5). C'est le premier usage réel de ces qualifications — « les arrêts
qui font jurisprudence en matière de travail, hors ceux renversés depuis ».

### 1.5 Note de l'éditeur

Un champ de commentaire éditorial propre à chaque décision : ce que Lam veut dire de
l'arrêt au-delà de ce que l'arrêt dit lui-même — portée réelle, rapprochement avec
d'autres décisions, réserve d'interprétation.

- **Rédacteur** : MASTER_ADMIN ou EDITEUR uniquement.
- **Texte long**, mis en forme simple (paragraphes, listes) — pas de HTML libre : le
  contenu est rendu par React et échappé, comme partout ailleurs sur la plateforme.
- **Signée et datée** : nom de l'éditeur et date de dernière révision, affichés.

⚠️ **AUCUN ANONYMAT ICI NON PLUS.** La note de la rédaction n'est pas une contribution
parmi d'autres : c'est Lam qui parle, dans la fiche même de la décision. Elle est signée,
comme tout ce qu'écrit un éditeur sur la plateforme (§1.6) — l'anonymat est un droit du
lecteur, jamais une option du personnel.
- **Toujours visible** quand elle existe, en dessous du résumé et des domaines.

⚠️ **ELLE DOIT SE DISTINGUER DU TEXTE DE L'ARRÊT AU PREMIER COUP D'ŒIL.** Le corps de
l'arrêt est du droit, la note est un commentaire ; les confondre serait grave sur une
plateforme juridique. Surface distincte (Pil ou blanc encadré, filet Wouj à gauche),
intitulé explicite « Note de la rédaction », et **jamais la fonte du corpus** — la note
se compose en Libre Franklin, quand l'arrêt se lit en Source Serif 4.

---

### 1.6 Notes des utilisateurs, soumises à validation

Les utilisateurs authentifiés peuvent proposer une note sous une décision. **Aucune note
n'est visible avant qu'un éditeur l'ait approuvée.**

#### Circuit

`BROUILLON` → `EN_ATTENTE` → `APPROUVEE` (publiée) ou `REFUSEE` (motif obligatoire)

- L'auteur voit **toujours sa propre note**, quel que soit son état, avec une mention
  claire de cet état — sans quoi il la croit publiée et la ressoumet.
- Les autres utilisateurs ne voient que les notes `APPROUVEE`.
- Le refus **exige un motif**, communiqué à l'auteur. Un refus muet est un renvoi sans
  explication.
- Après approbation, toute **modification par l'auteur repasse en `EN_ATTENTE`** et la
  version publiée reste affichée entre-temps. Sans cette règle, une note anodine peut
  être approuvée puis réécrite en tout autre chose.

#### File de modération

Écran éditeur listant les notes en attente : décision visée, auteur, date, texte intégral,
et deux actions — approuver, refuser avec motif. Compteur des notes en attente visible
dans la navigation du back-office : une file invisible ne se traite pas.

#### Signature, date, et anonymat au choix

Chaque note publiée porte **le nom de son auteur et la date** de sa contribution.

**L'anonymat est réservé aux UTILISATEURS de la plateforme** — `SITWAYEN`, `PWOFESYONEL`,
`ENSTITISYON`. Le choix se fait note par note, à la soumission, et reste modifiable par
l'auteur.

⚠️ **UN ÉDITEUR NE PEUT JAMAIS ÊTRE ANONYME.** `EDITEUR` et `MASTER_ADMIN` commentent
toujours sous leur nom, l'option n'apparaît même pas dans leur formulaire — et le serveur
refuse le drapeau si le rôle est éditorial, car une option absente de l'écran n'est pas
une option interdite. Un éditeur parle avec l'autorité de la maison ; non signée, cette
parole aurait le poids de Lam sans que personne ne la porte.

Cette réserve produit une propriété utile, à ne pas défaire : **une note anonyme ne peut
jamais émaner de la rédaction.** Le lecteur qui voit « Contribution anonyme » sait, par
construction, qu'il ne lit pas la position de Lam.

⚠️ L'anonymat ne dispense de rien : la note d'un utilisateur anonyme suit **le même
circuit de validation**, approuvée par un éditeur ou le master admin avant publication.

⚠️ **ANONYME À L'AFFICHAGE, JAMAIS ANONYME EN BASE.** C'est la règle qui fait tenir tout
le reste. La table conserve toujours `userId` ; seul le RENDU masque le nom. Sans cette
distinction :
- le frein de débit ne s'applique plus — on ne compte pas les envois d'un auteur inconnu ;
- un contributeur abusif devient introuvable, et ses notes irretirables en bloc ;
- l'auteur ne peut plus retirer sa propre note, faute de pouvoir prouver qu'elle est
  sienne ;
- la modération se fait à l'aveugle.

**Le modérateur voit toujours l'identité réelle**, y compris pour une note anonyme, et
l'écran le dit explicitement (« publiée sous anonymat »). Modérer sans savoir qui écrit
serait modérer sans rien savoir.

⚠️ **NE PAS AFFICHER LE RÔLE SOUS ANONYMAT.** Même restreint aux utilisateurs, montrer
« Professionnel (anonyme) » réduit le champ des auteurs possibles et, dans une communauté
de spécialistes qui se connaissent, désigne parfois la personne. Sous anonymat, aucune
qualité n'est montrée.

**La date, elle, reste affichée**, anonymat ou non : elle situe la contribution dans le
temps sans rien dire de son auteur. Une note sur un arrêt de 1964 rédigée en 2019 ou en
2026 ne se lit pas de la même façon.

**Libellé** : « Contribution anonyme », et non « Anonyme » seul — la première formule dit
qu'un auteur existe et a choisi de ne pas se nommer ; la seconde laisse croire à un
contenu sans origine.

#### Ce qu'il faut prévoir, et qui n'est pas optionnel

⚠️ **DISTINCTION VISUELLE ABSOLUE.** Un lecteur ne doit JAMAIS pouvoir prendre la note
d'un utilisateur pour la position de Lam. Bloc nettement séparé, intitulé « Notes des
lecteurs », nom de l'auteur et sa qualité (rôle) affichés, et un avertissement en tête :
ces contributions n'engagent que leurs auteurs. C'est la contrepartie directe de la clause
des CGU — « Lam fournit de l'information juridique à titre documentaire, et non un conseil
juridique ; l'utilisation de la Plateforme ne crée aucune relation avocat-client ». Une
note de lecteur mal cadrée transformerait la plateforme en lieu de consultation.

⚠️ **PAS DE HTML.** Texte simple, échappé par React. Longueur bornée (2 000 caractères
suffisent) et bornée AUSSI côté serveur : une limite posée seulement dans le formulaire
n'est pas une limite.

⚠️ **FREIN À LA SOUMISSION.** Réutiliser `guard()` de `src/lib/security/ratelimit.ts`,
déjà employé sur `/api/auth/verify`. Sans frein, un compte peut inonder la file de
modération et la rendre inutilisable.

⚠️ **CE QU'ON FAIT DU PASSÉ.** Trancher explicitement, et l'écrire :
- compte supprimé → que deviennent ses notes approuvées ? (anonymiser plutôt que
  supprimer préserve la cohérence des échanges ; supprimer respecte mieux l'effacement) ;
- décision supprimée → ses notes suivent, en cascade ;
- l'auteur peut-il retirer sa note après publication ? (recommandation : oui, avec trace
  d'audit — c'est sa contribution).

**Audit** : `NOTE_SOUMISE`, `NOTE_APPROUVEE`, `NOTE_REFUSEE`, `NOTE_SUPPRIMEE`, avec
l'acteur, la cible et le motif. La modération est une décision éditoriale : elle se trace
comme les autres.

**Modèle** : nouvelle table (`DecisionNote` ou `UserNote`) — `documentId`, `userId`
(**toujours renseigné**, y compris sous anonymat), `body`, `status`, `anonymous`,
`moderatorId`, `moderatedAt`, `rejectionReason`, horodatages. Index sur
`(documentId, status)` pour la lecture publique et sur `(status, createdAt)` pour la file.

Le drapeau `anonymous` n'est accepté que si le rôle de l'auteur n'est PAS éditorial —
contrôle **côté serveur**, à la soumission comme à la modification.

⚠️ **L'API PUBLIQUE NE DOIT JAMAIS SÉRIALISER `userId` NI LE NOM D'UNE NOTE ANONYME.**
Le masquage se fait à la SOURCE, dans la couche de données — pas dans le composant. Une
note anonyme dont l'identité voyage jusqu'au navigateur est une note démasquée : il suffit
d'ouvrir l'inspecteur. C'est le contrôle n° 17 ci-dessous.

**Portée** : le prompt vise les décisions judiciaires, mais le mécanisme n'a rien de
propre à elles. Concevoir la table sur `documentId` — et non sur un identifiant d'arrêt —
pour qu'elle serve demain aux lois et aux circulaires sans migration.

---

## 2. Ce que le schéma offre déjà, et ce qui manque

`model Document` (prisma/schema.prisma) couvre l'essentiel **sans modification** :

| Champ du document | Colonne existante |
|---|---|
| numéro d'arrêt | `number` |
| intitulé | `titleFr` |
| date de l'arrêt | `publicationDate` |
| juridiction | `juridiction` (commentée « CASSATION \| APPEL \| PREMIERE_INSTANCE ») |
| domaine(s) | `matiere` |
| résumé | `summaryFr` |
| texte intégral / dispositif | `bodyOriginal` |
| exercice | `year` |

**Manquent quatre notions du document** (décision attaquée, solution, chambre, référence
de recueil) **et quatre posées par l'éditeur** (§1.4) : traitement, note de traitement,
portée, note de portée. Deux options — trancher explicitement et documenter le choix :

1. **Colonnes dédiées** — `decisionAttaquee`, `solution`, `chambre`, `recueilRef`,
   `traitement`, `traitementNote`, `portee`, `porteeNote`. Requêtables, indexables,
   typées. Impose une migration Prisma.
2. **`metaJson`** — aucune migration, mais ni filtre ni index, et le champ devient un
   fourre-tout.

**Recommandation : colonnes dédiées.** L'issue (`solution`), le traitement et la portée
ont tous vocation à être **filtrés** (« les arrêts qui font jurisprudence en matière de
travail, hors ceux renversés depuis ») ; enfouis dans `metaJson`, ils ne le seraient pas.
Prévoir la migration, et un index sur `(type, juridiction, solution)` ainsi que sur
`(type, portee, traitement)`.

⚠️ `status` ne convient pas pour l'issue : il porte déjà `EN_VIGUEUR | ABROGE | MODIFIE |
PUBLIE`, propre aux textes normatifs. Une jurisprudence n'est pas abrogée, elle est
renversée — ne pas détourner la colonne.

---

## 3. Écran de saisie manuelle

À créer : `/[locale]/admin/jurisprudence`, accessible **MASTER_ADMIN et EDITEUR**
(la demande vise « master admin ou éditeur »).

**Imiter `src/components/IndexMoniteurEditor.tsx`**, qui résout déjà les mêmes problèmes :
en-tête de recueil + lignes répétables, détection de doublon, blocage motivé de
l'enregistrement. En reprendre surtout ces trois acquis :

- **Le doublon n'écrase jamais la saisie.** Si l'arrêt existe déjà (même juridiction,
  même exercice, même numéro), afficher la version enregistrée et proposer deux issues
  explicites — la reprendre pour correction, ou conserver la saisie. Ne rien écrire tant
  que l'opérateur n'a pas tranché.
- **Un bouton grisé dit pourquoi.** Le motif du blocage s'affiche à côté, jamais
  seulement en désactivant le bouton.
- **Reprendre une entrée antérieure recharge TOUS ses champs**, date et juridiction
  comprises — sinon l'opérateur les ressaisit et redate l'arrêt à son insu.

Structure de l'écran :

1. **Bloc recueil** — juridiction, section, exercice, synthèse. Renseigné une fois, il
   pré-remplit chaque décision ajoutée ensuite.
2. **Liste des décisions** — une carte par arrêt, repliable, avec les huit champs du
   document **plus les deux qualifications du §1.4**. Ajout/retrait de cartes sans limite.
   Le traitement et la portée se choisissent parmi des boutons portant glyphe ET libellé —
   jamais un menu d'émojis nus, où l'on choisit à l'aveugle.
3. **Aperçu** de la référence composée (`Cass., 1re Sect., n° 2, 28 octobre 1964`) —
   visible avant enregistrement, comme l'éditeur de l'Index affiche `LM2024-51`.

**Validations bloquantes** — numéro entier positif ; date réelle **et cohérente avec
l'exercice** (signaler l'écart sans le refuser : une décision peut être publiée l'année
suivante) ; intitulé, décision attaquée, issue, résumé et domaine non vides.

---

## 4. Téléversement d'un recueil (.docx)

Second mode, indispensable ici : le document joint contient **15 arrêts**, personne ne
les saisira à la main.

**Analyser le .docx côté serveur** — jamais dans le navigateur : le fichier peut peser
plusieurs mégaoctets et l'analyse doit être reproductible.

Le gabarit est régulier et **doit être vérifié, pas supposé** :

- un arrêt commence par un paragraphe `ARRÊT NO. n` ;
- suivent, dans l'ordre, l'intitulé puis les lignes préfixées
  `Juridiction :`, `Date de l'arrêt :`, `Décision attaquée :`, `Solution :` ;
- puis les intertitres `Résumé de la décision` et `Domaine(s) du droit`, chacun suivi
  d'un paragraphe.

⚠️ **Le document s'ouvre sur un TABLEAU RÉCAPITULATIF** qui répète les mêmes décisions sous
forme de six colonnes. L'analyseur doit l'ignorer et ne lire que la partie détaillée,
faute de quoi chaque arrêt sera importé deux fois — sous une forme tronquée.

⚠️ **Piège `<w:tab/>` déjà rencontré sur ce dépôt** : les extracteurs .docx maison collent
les colonnes du tableau faute de convertir les tabulations. Convertir `<w:tab/>` en
séparateur AVANT toute analyse.

**Écran de contrôle obligatoire avant écriture.** Le téléversement ne doit RIEN écrire
directement : il affiche ce qu'il a compris — n arrêts détectés, leurs numéros, les
champs manquants, les doublons avec la base — et l'opérateur valide. Un import muet sur
un corpus juridique est indéfendable.

**Rapport après import** : créés / mis à jour / ignorés, et la liste nominative des
rejets avec leur motif.

⚠️ **L'IMPORT NE QUALIFIE RIEN.** Traitement et portée restent vides après téléversement :
le document joint ne les contient pas, et les déduire d'un mot du dispositif produirait
des affirmations qu'aucune source n'appuie. C'est à l'éditeur de les poser, arrêt par
arrêt, après lecture.

---

## 5. Lecture publique

Une décision se lit comme un texte de droit, pas comme une fiche :

- corps en **Source Serif 4** sur **blanc**, largeur de lecture bornée ;
- en-tête : intitulé, référence composée, juridiction, date ;
- **décision attaquée** et **dispositif** mis en évidence — ce sont les deux points qu'un
  juriste cherche en premier ;
- **domaines** en pastilles cliquables, menant à la liste filtrée ;
- **traitement et portée** en pastilles (glyphe + libellé), avec la note de qualification
  au survol ou en dessous — et rien du tout si l'éditeur ne s'est pas prononcé ;
- rattachement au recueil (« Arrêts n° 2 à 16, exercice 1964-1965 »), navigable.

**Filtres de la liste** : juridiction, exercice, issue, domaine. C'est la raison d'être
des colonnes dédiées du §2.

---

## 6. Contraintes non négociables

**Charte « Klinik » v3.0 + avenant AV-03** (`src/lib/brand-colors.ts`) :
Wouj conduit l'ACTION (fond de bouton, texte **blanc** — Chabon sur Wouj ne vaut que
2,76:1), Sitwon atteste la VÉRIFICATION et **n'est jamais une couleur de texte**.
Ne jamais introduire de couleur hors palette.

**Accessibilité** — contraste AA vérifié par `npx tsx scripts/audit-contraste.ts`, qui doit
rester à **0 échec** ; contrôles d'au moins **44 px** ; libellés liés aux champs par
`htmlFor`/`id` ; messages d'erreur reliés par `aria-describedby` ; aucune information
portée par la seule couleur.

**Trilingue** — libellés d'interface en FR/EN/HT. Le contenu des arrêts reste en français :
ne pas fabriquer de traduction d'un texte juridique.

**Sécurité** — rôle vérifié **côté serveur** à chaque appel d'API, jamais seulement dans
l'interface. Toute création, modification et suppression écrit une entrée d'audit
(`audit()`), la suppression écrivant obligatoirement `DOC_DELETED`. Aucun identifiant ne
doit permettre d'écrire sur un document d'un AUTRE type — reprendre le garde-fou de
`src/app/api/admin/index-moniteur/route.ts`, qui vérifie le type avant tout `update`.

**Base de PRODUCTION** — `.env` pointe sur Supabase en production. Tout script d'import
doit offrir `--dry-run` et l'exécuter par défaut.

**Ne pas modifier** la logique existante hors de ce périmètre.

---

## 7. Vérifications attendues

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm test`
4. `npx tsx scripts/audit-contraste.ts` → 0 échec
5. `npm run build` (arrêter le serveur de dev d'abord ; `.next` est exclu de la
   synchronisation Dropbox par `xattr com.dropbox.ignored` — ne pas retirer cet attribut,
   sans quoi la synchronisation corrompt le build)
6. Import du document joint en `--dry-run` : **15 arrêts détectés, numéros 2 à 16**,
   aucun champ manquant
7. Import réel, puis relecture d'un arrêt sur le site : intitulé, date, décision attaquée,
   dispositif, résumé et domaines conformes au document
8. Réimport du MÊME fichier : aucun doublon créé (idempotence)
9. Écrans testés à 320 px et 390 px, sans débordement horizontal
10. Les trois traitements et les deux portées se distinguent **en niveaux de gris** —
    capture d'écran désaturée à l'appui : c'est le contrôle qui prouve que la forme, et
    non la couleur, porte l'information
11. Un arrêt non qualifié n'affiche AUCUNE pastille de traitement — l'absence
    d'évaluation ne doit pas se lire comme un « neutre »
12. Une note soumise par un utilisateur **n'apparaît pas** pour un AUTRE utilisateur tant
    qu'elle n'est pas approuvée — vérifié depuis deux sessions distinctes, pas seulement
    en lisant le code
13. Son auteur, lui, la voit avec son état ; un refus lui parvient avec son motif
14. La modification d'une note déjà approuvée la remet en attente, la version publiée
    restant affichée entre-temps
15. La limite de longueur est refusée par le SERVEUR, contournement du formulaire compris
16. Une note signée affiche nom ET date ; une note anonyme affiche « Contribution
    anonyme » et la date, sans aucune mention de rôle
16 bis. Le formulaire d'un compte `EDITEUR` ou `MASTER_ADMIN` **n'offre pas** l'option
    d'anonymat — et une requête forgée qui la pose quand même est **refusée par le
    serveur**, contrôlée en appelant l'API directement
17. **La charge utile reçue par le navigateur ne contient ni `userId` ni nom** pour une
    note anonyme — vérifié dans l'onglet réseau, pas dans le rendu
18. La file de modération montre l'identité réelle d'une note anonyme, en le signalant

---

## 8. Résultat attendu

- un écran de saisie manuelle d'une décision, accessible aux éditeurs ;
- une note de la rédaction par décision, signée et datée ;
- des notes de lecteurs soumises à approbation, avec file de modération et motif de refus ;
- un téléversement de recueil .docx avec écran de contrôle avant écriture ;
- les 15 arrêts du document joint en ligne, lisibles et filtrables ;
- aucune régression : contraste, liens, tests et build inchangés.
