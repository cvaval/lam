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

**Manquent quatre notions.** Deux options — trancher explicitement et documenter le choix :

1. **Colonnes dédiées** (`decisionAttaquee`, `solution`, `chambre`, `recueilRef`) —
   requêtables, indexables, typées. Impose une migration Prisma.
2. **`metaJson`** — aucune migration, mais ni filtre ni index, et le champ devient un
   fourre-tout.

**Recommandation : colonnes dédiées.** L'issue (`solution`) a vocation à être **filtrée**
(« tous les rejets en matière de travail ») ; enfouie dans `metaJson`, elle ne le serait
pas. Prévoir la migration, et un index sur `(type, juridiction, solution)`.

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
2. **Liste des décisions** — une carte par arrêt, repliable, avec les huit champs.
   Ajout/retrait de cartes sans limite.
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

---

## 5. Lecture publique

Une décision se lit comme un texte de droit, pas comme une fiche :

- corps en **Source Serif 4** sur **blanc**, largeur de lecture bornée ;
- en-tête : intitulé, référence composée, juridiction, date ;
- **décision attaquée** et **dispositif** mis en évidence — ce sont les deux points qu'un
  juriste cherche en premier ;
- **domaines** en pastilles cliquables, menant à la liste filtrée ;
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

---

## 8. Résultat attendu

- un écran de saisie manuelle d'une décision, accessible aux éditeurs ;
- un téléversement de recueil .docx avec écran de contrôle avant écriture ;
- les 15 arrêts du document joint en ligne, lisibles et filtrables ;
- aucune régression : contraste, liens, tests et build inchangés.
