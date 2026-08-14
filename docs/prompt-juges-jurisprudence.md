# Prompt — Le sommaire d’une décision : rubriques d’analyse, juges, et recherche par magistrat

## Ce qui est demandé

Dans la section Jurisprudence, deux choses :

1. **Compléter le sommaire d'une décision** par quatre rubriques d'analyse — règle de
   droit, question de droit, solution et motifs, domaine du droit.
2. Ajouter la **composition de la formation de jugement** : le ou les juges qui ont rendu
   la décision, **une case de saisie par juge**, et la possibilité de **chercher par nom
   de juge** — la recherche ramenant, distinctement, les décisions que le magistrat a
   **présidées** et celles auxquelles il a **participé**.

---

## §1 — L'état des lieux

| | |
| --- | --- |
| Modèle | `Document` + les colonnes de jurisprudence (`chambre`, `solution`, `dispositif`, `traitement`, `portee`, `noteRedaction`…) — **aucun champ de juge** |
| Corpus en base | 15 arrêts, **Première Section n° 2 à 16**, exercice 1964-1965, texte intégral versé |
| Corpus reçu, non versé | `Sommaire_Analytique_Arrets_1964-1965_full.docx` (178 245 c.) et `Cour_de_Cassation_Arrets_1964-1965_full.docx` (581 234 c.) — **33 décisions** : Première Section n° 35 à 52, Deuxième Section n° 1 et n° 16 à 29 |
| Saisie | `/[locale]/admin/jurisprudence`, onglets « Verser un recueil » et « Éditer le corpus » |
| API | `/api/admin/jurisprudence` — `PUT` analyse, `POST` verse, `PATCH` appareil éditorial |
| Lecture | `src/components/JurisprudenceHeader.tsx` sur `/[locale]/doc/[id]` |
| Recherche | moteur intégré PostgreSQL (`SEARCH_PROVIDER=fts` en production), facettes dans `src/components/ContextualFilters.tsx` |

Les juges figurent à **deux** endroits, et c'est le second qu'il faut lire.

Dans le texte de l'arrêt, en formule de clôture — utilisable, mais périlleux (§8) :

> « Ainsi jugé et prononcé par Nous, Luc BOIVERT, **Président**, Ludovic MAGLOIRE,
> Louis B. VILGRAIN, Ulrick Is. NOEL et Louis BANATTE, **Juges**, en audience publique du… »

Et surtout, dans le **sommaire analytique**, comme un CHAMP ÉTIQUETÉ :

> « **Composition** : Luc Boivert, Président ; Ludovic Magloire, Louis B. Vilgrain,
> Ulrick Noël, Frédéric Robinson, Juges — **Ministère Public** : Anthony Rivière,
> Substitut du Commissaire du Gouvernement »

> ⚠️ **LIRE LE SOMMAIRE, PAS L'ARRÊT.** Le champ « Composition » est déjà séparé, ponctué
> et qualifié : le président avant le point-virgule, les juges après, le ministère public
> après le tiret cadratin. Aller chercher les mêmes noms dans la prose de l'arrêt, c'est se
> donner les six pièges du §8 pour un résultat moins bon.

### Trois gabarits de sommaire coexistent dans le même fichier

Les étiquettes ne sont pas stables. Relevé sur le recueil complet :

| Rubrique | Graphies rencontrées |
| --- | --- |
| Règle de droit | `Règle de droit (Rule of Law)` ×19 · `Rule of Law (Règle de droit)` ×19 · `Rule of law (règle de droit)` ×14 · `Règle de droit` ×20 |
| Domaine | `Domaines du droit` ×19 · `Domaine(s) du droit` ×67 |
| Date | `Date de l'arrêt` · `Date` ×34 · `Date du prononcé` ×14 |
| Composition | `Composition` ×53 · `Composition du siège` ×33 |
| Autres | `Résumé` ×14 · `Analyse` ×14 · `Solution` ×14 · `Ministère public` ×14 · `Greffe` ×14 · `Matière (mention marginale de la source)` ×14 |

Trois familles se dégagent : l'une met l'anglais d'abord et le domaine **après** les
rubriques, l'autre le français d'abord et le domaine **avant**, la troisième ajoute
ministère public, greffe et mention marginale.

> ⚠️ **NE PAS CÂBLER L'ANALYSEUR SUR UN GABARIT.** L'avertissement figure déjà en tête de
> `src/lib/jurisprudence/parse.ts` ; il est ici **prouvé à l'échelle**. Reconnaître une
> étiquette doit se faire sur sa clé normalisée — sans accents, sans casse, sans la
> parenthèse anglaise — et toute étiquette inconnue doit remonter en avertissement, jamais
> être ignorée en silence.

Le gabarit français porte en outre, entre le domaine et la règle de droit, une **phrase
d'analyse libre et non étiquetée** — « Décision de pure procédure civile », « Même solution
procédurale que le No 37 », « jumelle du No 41 ». Elle n'a pas de champ ; la ranger dans la
règle de droit serait une erreur de nature.

### La numérotation se répète d'une section à l'autre

| n° 16 en base | n° 16 dans le nouveau sommaire |
| --- | --- |
| Dame Olyptia FRAGILE c. Phalante BAZELAIS — **Première Section**, 13 janvier 1965 | Solange LACROIX c. Joseph ROC — **Deuxième Section** |

> ⚠️ **LE NUMÉRO SEUL N'IDENTIFIE PAS UN ARRÊT.** Chaque section tient sa propre série. La
> clé de dédoublonnage actuelle de `/api/admin/jurisprudence` — `(type, source, number)` —
> ne tient que parce que chaque recueil a sa `source` : verser les deux sections sous une
> même source **écraserait** l'arrêt n° 16 déjà en ligne par un autre, sans un mot.
> La clé doit devenir **(section, numéro, exercice)**, et l'écran de contrôle doit refuser
> un versement où deux décisions partagent cette clé.

---

## §2 — Le stockage : une relation, pas une chaîne

« Une case séparée pour chaque nom » décrit la SAISIE. Le stockage doit suivre : un champ
texte unique où les noms seraient collés par des virgules interdirait tout ce qui fait
l'intérêt de la demande.

Créer deux modèles (migration **additive**, aucune colonne existante touchée) :

```prisma
/// Magistrat ayant siégé — identité éditoriale, distincte de chaque mention dans un arrêt.
model Judge {
  id        String   @id @default(cuid())
  /// Nom tel qu'il est retenu par la rédaction : « Ulrick Is. NOEL ».
  displayName String
  /// Clé de rapprochement : minuscules, sans accents, sans initiales ni ponctuation.
  /// « Ulrick Is. NOEL », « Ulrick IS. NOEL » et « Ulrick NOEL » partagent « noel ulrick ».
  matchKey  String
  decisions DecisionJudge[]
  @@index([matchKey])
}

/// Participation d'un juge à UNE décision, avec le nom LITTÉRAL de cet arrêt-là.
model DecisionJudge {
  id         String   @id @default(cuid())
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  judgeId    String
  judge      Judge    @relation(fields: [judgeId], references: [id], onDelete: Cascade)
  /// Graphie de CET arrêt — « Louis B. VILGRAIN » ici, « Louis VILGRAIN » ailleurs.
  nameAsWritten String
  /// Rôles RELEVÉS dans les recueils, pas inventés :
  /// PRESIDENT · PRESIDENT_FF (« Juge, faisant fonction de Président », « … remplissant
  /// les fonctions de Président ») · JUGE · MINISTERE_PUBLIC (« Substitut du Commissaire
  /// du Gouvernement », « Commissaire du Gouvernement ») · GREFFE (« Commis-Greffier »).
  /// Nullable — voir §4.
  role       String?
  position   Int      @default(0)
  @@unique([documentId, judgeId])
  @@index([judgeId])
}
```

> ⚠️ **`nameAsWritten` N'EST PAS UNE REDONDANCE.** L'arrêt écrit ce qu'il écrit. La fiche
> doit pouvoir afficher la composition **telle qu'elle figure dans la décision**, tout en
> permettant de regrouper les arrêts d'un même magistrat. Écraser la graphie de l'arrêt par
> le nom retenu par la rédaction, c'est réécrire une pièce de procédure.

---

## §3 — Le piège d'identité, mesuré sur le corpus réel

Les recueils nomment une dizaine de magistrats, sous des graphies qui varient d'un arrêt à
l'autre — **accent, initiale, casse** :

| Magistrat | Graphies rencontrées |
| --- | --- |
| NOEL | `Ulrick Is. NOEL`, `Ulrick IS. NOEL`, `Ulrick NOEL`, `Ulrick Is. Noel`, `Ulrick Noël`, `Ulrick Is. Noël` |
| VILGRAIN | `Louis B. VILGRAIN`, `Louis VILGRAIN` |
| BANATTE | `Louis BANATTE`, `Louis J. BANATTE`, `Louis Banatte` |
| BOIVERT | `Luc BOIVERT`, `Luc Boivert` |
| MAGLOIRE | `Ludovic MAGLOIRE`, `Ludovic Magloire` |
| DUPLESSY | `Max Duplessy`, `Max C. Duplessy` |
| ROBINSON, ROUSSEAU | `Frédéric Robinson`, `André Rousseau` |
| Ministère public | `Arsène AMISIAL` / `Arsène Amisial`, `Anthony Rivière` / `Anthony RIVIERE`, `Jh. Marthyl ST JULIEN` / `Jh. Marthyl Saint-Julien` |

> ⚠️ **« Noël » ET « NOEL » SONT LE MÊME HOMME, « Saint-Julien » ET « ST JULIEN » AUSSI.**
> La clé de rapprochement doit donc retirer les accents ET normaliser les abréviations
> usuelles (`St` ↔ `Saint`). Elle reste une SUGGESTION : voir ci-dessous.

> ⚠️ **LE RAPPROCHEMENT SE PROPOSE, IL NE SE DÉCIDE PAS TOUT SEUL.** `matchKey` sert à
> SUGGÉRER un juge existant à l'écran de saisie ; c'est l'éditeur qui confirme. Deux
> magistrats homonymes existent — fusionner « Louis BANATTE » et « Louis J. BANATTE » sans
> relecture reviendrait à attribuer des arrêts à quelqu'un qui ne les a pas rendus, et rien
> à l'écran ne le montrerait.

L'écran de saisie affiche donc, sous chaque case : *« Rapprocher de : Ulrick Is. NOEL
(7 arrêts) ? »* avec un bouton **Oui, même magistrat** et un bouton **Non, créer une fiche
distincte**. Aucun rapprochement automatique.

---

## §4 — La saisie : une case par juge

La saisie manuelle reste la référence, mais elle part d'un champ déjà structuré : le
versement d'un recueil doit **pré-remplir** les cases depuis la ligne « Composition » du
sommaire (§8), l'éditeur n'ayant plus qu'à relire.

Dans « Éditer le corpus » (`JurisprudenceCorpusEditor.tsx`), sous les qualifications :

- une liste de **cases individuelles**, une par juge, avec un bouton « + Ajouter un juge »
  et un bouton de retrait par ligne ;
- l'ordre est celui de l'arrêt (`position`) — le président en tête ;
- **cible d'au moins 44 px**, `aria-label` explicite par ligne (« Juge n° 2 »), l'ajout et
  le retrait annoncés (`aria-live`) : une case qui apparaît sans être annoncée est invisible
  au lecteur d'écran ;
- le **rôle** est un menu déroulant facultatif à côté du nom. La formule distingue
  « Président » de « Juges » : le champ existe pour le porter, mais **rien n'est présumé** —
  un rôle non renseigné reste vide, jamais « Juge » par défaut.

> ⚠️ **NE PAS RÉUTILISER LE CHAMP `chambre`.** Il porte « Première Section » — la formation,
> pas ses membres. Il devient en revanche **indispensable à l'identité de la décision**
> (§1) : c'est lui qui sépare le n° 16 de la Première Section de celui de la Deuxième.

Le **ministère public** et le **greffe** figurent sur la même ligne que la composition,
après un tiret cadratin. Ils ne sont pas membres de la formation : les stocker avec le rôle
correspondant, et **ne pas les compter comme juges** dans la facette de recherche.

---

## §5 — La lecture

Dans `JurisprudenceHeader`, une ligne « Composition » après le dispositif :

> **Composition** — Luc BOIVERT (président) · Ludovic MAGLOIRE · Louis B. VILGRAIN ·
> Ulrick Is. NOEL · Louis BANATTE

Chaque nom est un lien vers **ses décisions**, et ce lien mène à une vue qui distingue les
deux qualités (§7). Afficher la **graphie de l'arrêt** (`nameAsWritten`), pas le nom retenu.

> ⚠️ **RIEN NE S'AFFICHE SI LA COMPOSITION N'A PAS ÉTÉ SAISIE.** Pas de « composition
> inconnue », pas de bloc vide : une absence de saisie n'est pas une information.

---

## §6 — Le sommaire de la décision : quatre rubriques d'analyse

Le sommaire d'un arrêt ne se résume pas à un paragraphe. Il porte quatre rubriques
distinctes, et c'est leur séparation qui en fait un outil de recherche :

| Rubrique | Ce qu'elle porte | État actuel |
| --- | --- | --- |
| **Règle de droit** | la règle que la décision énonce — l'attendu de principe | **à créer** (`regleDroit`) |
| **Question de droit** | ce que la Cour avait à trancher | **à créer** (`questionDroit`) |
| **Solution et motifs** | ce qui est jugé ET pourquoi | **partiellement** : `dispositif` porte le libellé littéral, `solution` l'issue codée — les **motifs** manquent (`motifs`) |
| **Domaine du droit** | matière et sous-matière | **existe** : `matiere` |

Les recueils reçus emploient **déjà ces quatre rubriques**, ce qui règle la question des
libellés — mais sous trois graphies concurrentes (§1) :

```
Domaines du droit : Droit du travail ; procédure civile
Règle de droit (Rule of Law) : Le congé annuel n'est pas cumulatif (art. 130 C.T.)…
Question de droit (Issue) : Le désistement du défendeur rend-il le pourvoi sans intérêt ?
Solution et motifs (Holding and Reasoning) : Non sur les deux points. Le pourvoi manifeste…
```

Trois colonnes nullables à ajouter (migration additive) : `regleDroit`, `questionDroit`,
`motifs`. Ne pas réutiliser `summaryFr` : le résumé éditorial est un texte suivi, ces
rubriques sont des champs distincts qu'on doit pouvoir afficher, comparer et chercher
séparément.

> ⚠️ **NE PAS FONDRE « SOLUTION » ET « MOTIFS ».** `dispositif` reproduit ce que l'arrêt
> écrit — « Rejet du pourvoi. » — et `solution` le code en `REJET`. Les motifs sont le
> raisonnement qui y conduit. Les mettre dans le même champ ferait perdre ce qui distingue
> une décision d'espèce d'un arrêt de principe : deux arrêts peuvent partager un
> dispositif et n'avoir aucun motif commun.

> ⚠️ **AUCUNE DE CES RUBRIQUES NE SE DEVINE.** Ni règle, ni question, ni motifs ne
> s'extraient d'un texte par motif : ce sont des travaux de rédaction. Les champs restent
> vides tant qu'un éditeur ne les a pas écrits, et la fiche n'affiche **que ce qui est
> renseigné** — pas de rubrique vide, pas de « non renseigné ».

**Saisie** — dans « Éditer le corpus », sous le résumé éditorial, quatre zones étiquetées
dans cet ordre : règle de droit, question de droit, solution et motifs, domaine du droit.
Le domaine réutilise le champ existant plutôt que d'en ouvrir un second qui divergerait.
L'analyseur de recueil les reconnaît sur leur clé normalisée et les pré-remplit.

> ⚠️ **LA PHRASE D'ANALYSE LIBRE N'EST PAS LA RÈGLE DE DROIT.** Entre le domaine et la
> règle, le gabarit français glisse une remarque sans étiquette — « Décision de pure
> procédure civile », « jumelle du No 41 ». Elle appartient au résumé éditorial, pas à la
> règle de droit : l'y verser ferait passer un commentaire pour un attendu de principe.

**Lecture** — dans `JurisprudenceHeader`, un bloc « Sommaire » avant le texte de l'arrêt,
une rubrique par ligne, en `<dl>` comme la décision attaquée et le dispositif. Ce sont les
premières lignes qu'un juriste lit : elles passent **avant** le corps, pas après.

**Recherche** — les quatre rubriques doivent entrer dans `buildSearchText` (§7). Une règle
de droit qu'on ne peut pas retrouver ne sert qu'à celui qui l'a écrite.

---

## §7 — La recherche : quatre couches, comme toujours

C'est le point où ce projet s'est fait prendre deux fois cette semaine. Un critère de
recherche doit être câblé dans **les quatre** :

| Couche | Fichier | Sans elle |
| --- | --- | --- |
| Navigation (Prisma) | `src/lib/search/fts.ts` | le filtre ne filtre rien |
| Recherche texte (SQL) | `src/lib/search/ftsql.ts` | il filtre en navigation puis **cesse dès qu'on tape un mot** |
| Miroir OpenSearch | `src/lib/search/opensearch.ts` | il rend tout le corpus en développement, le défaut n'apparaît qu'en production |
| Clé de cache | `src/lib/search/index.ts` | la page filtrée sert le résultat non filtré déjà en mémoire |

Quatre choses distinctes à livrer — et **`judge` comme `judgeRole` traversent les quatre
couches ci-dessus** : un filtre de qualité câblé d'un seul côté rendrait « présidées » en
navigation et « tout » dès qu'on ajoute un mot-clé.

1. **`SearchQuery.judge?: string`** — filtre par `matchKey` (identité), pas par chaîne
   libre. Le filtre porte sur la relation : `{ judges: { some: { judge: { matchKey } } } }`.
   Il couvre **tous les intervenants nommés** — juges, ministère public, greffe : chercher
   « AMISIAL » doit ramener les arrêts où il a conclu, comme chercher « BOIVERT » ramène
   ceux qu'il a présidés.

   > ⚠️ **CHERCHABLE N'EST PAS COMPTÉ COMME JUGE.** La facette (point 3) ne liste et ne
   > dénombre que les magistrats de la formation. Un substitut qui apparaîtrait dans la
   > liste des juges donnerait à lire une composition fausse — l'erreur est de fond, pas
   > d'affichage. Le rôle (`role`) fait la séparation ; la recherche l'ignore, la facette
   > s'y tient.
2. **Le plein texte doit trouver le nom même sans texte intégral.** `buildSearchText`
   (`src/lib/search/normalize.ts`) doit inclure les noms des juges **et les quatre
   rubriques du §6**. Sans cela, une décision dont seul le sommaire est versé ne répondrait
   ni à « BOIVERT » ni à une règle de droit qu'elle énonce pourtant.
3. **Une facette** dans `ContextualFilters` pour le type `JURISPRUDENCE` : la liste des
   magistrats avec le nombre d'arrêts, dérivée des données comme les années BRH — jamais
   une liste codée en dur, qui dériverait au premier arrêt versé.

4. **Les décisions d'un magistrat se lisent EN DEUX ENSEMBLES.** Chercher un magistrat doit
   ramener, distinctement :

   > **Luc BOIVERT** — a **présidé** 12 décisions · a **siégé** 4 · a **conclu** 0

   Un même magistrat change de qualité d'un arrêt à l'autre : Ludovic Magloire préside par
   intérim (« Juge, faisant fonction de Président ») dans certains arrêts et siège comme
   simple juge dans d'autres ; Frédéric Robinson préside les uns et siège aux autres. Les
   confondre effacerait précisément ce qu'un juriste vient chercher.

   Mise en œuvre : `SearchQuery.judgeRole?: 'PRESIDENT' | 'JUGE' | 'MINISTERE_PUBLIC'`,
   **facultatif**. Absent, le filtre rend tout — présidence et participation ensemble, avec
   le décompte par qualité en tête de résultats. Présent, il restreint.
   `PRESIDENT` englobe `PRESIDENT_FF` : présider par intérim, c'est présider.

   > ⚠️ **LE DÉCOMPTE PAR QUALITÉ SE CALCULE, IL NE S'ESTIME PAS.** Un total « 16 décisions »
   > sans ventilation laisserait croire à seize présidences. Si la ventilation n'est pas
   > livrée, ne pas afficher de total du tout.

> ⚠️ **PENSER AUX DÉCISIONS SANS JUGE SAISI.** Comme pour les circulaires sans date, une
> facette bâtie sur les seuls arrêts renseignés laisse les autres hors de tout filtre. Soit
> une puce « composition non renseignée » avec son compte, soit rien — mais le dire.

---

## §8 — Reprendre les juges des arrêts déjà versés

Deux sources, deux fiabilités. **Préférer toujours la première.**

**a) Le champ « Composition » du sommaire** — structuré, ponctué, qualifié :

```
Composition : Ludovic Magloire, Juge, faisant fonction de Président ; Louis B. Vilgrain,
Ulrick Is. Noël, André Rousseau, Louis Banatte, Juges — Ministère Public : Arsène Amisial,
Substitut du Commissaire du Gouvernement
```

Découpe : point-virgule entre le président et les juges, virgule entre les juges, tiret
cadratin avant le ministère public. Les qualités écrites (« Juge, faisant fonction de
Président ») donnent le rôle sans avoir à le deviner. C'est la voie à retenir pour les
33 décisions des nouveaux recueils.

> ⚠️ **LE CHAMP N'EST PAS RÉGULIER POUR AUTANT.** Relevé sur le recueil : `Ministère
> Public :` mais aussi `Min. Public :` ; des mentions qui ne sont pas des membres du siège
> — « en présence de M. Anthony Rivière », « assistés de M. Clément Romulus », « Commis-
> Greffier » ; et surtout des **doutes du transcripteur laissés dans le texte** —
> « (lecture à vérifier) », « possiblement "Boisvert" ». Ces incises ne sont pas des noms :
> un analyseur qui les prend pour tels crée des magistrats qui n'ont jamais siégé. Toute
> mention non reconnue **remonte en avertissement** et n'est pas versée.

**b) La formule de clôture de l'arrêt** — nécessaire seulement pour les décisions dont
aucun sommaire n'est disponible. Un script peut les PROPOSER ; il ne les écrit pas seul.

- **Ancrer sur la formule de CLÔTURE**, en fin de texte : `Ainsi jugé et prononcé par Nous,
  … Juges,`. Une recherche naïve du premier « prononcé » du corps se trompe sur **6 des 15**
  arrêts — elle attrape « prononcer l'irrecevabilité », « le prononcé a été mal accordé »,
  « prononcée par le jugement dénoncé ».
- Découper sur les virgules et « et », retirer les mentions de fonction (`Président`,
  `Juges`), ignorer ce qui suit « en audience publique ».
- **Sortie : un tableau à relire**, pas une écriture. Chaque nom proposé avec l'arrêt, la
  graphie, le rôle deviné et le rapprochement suggéré. L'éditeur valide à l'écran.
- Le script est **à blanc par défaut**, `--apply` pour écrire, idempotent, et il **compte ce
  qu'il n'a pas su lire** au lieu de le taire.

Ordre de grandeur attendu, corpus complet (15 arrêts en base + 33 reçus) : **une dizaine de
magistrats, 48 arrêts, ~240 participations**, plus 3 à 4 représentants du ministère public
et 1 greffier. Un résultat très éloigné de ces nombres signale un analyseur qui se trompe,
pas un corpus surprenant.

---

## §9 — Ce qu'il ne faut PAS faire

- Ne pas fusionner deux graphies sans validation humaine (§3).
- Ne pas enrichir les noms depuis une source extérieure : la composition vient de la
  décision, et d'elle seule.
- Ne pas déduire un rôle non écrit, ni compléter une initiale manquante.
- Ne pas toucher aux colonnes existantes de jurisprudence, ni au circuit des notes de
  lecteurs.
- Ne pas rendre la composition modifiable depuis la fiche publique : les outils éditoriaux
  vivent dans la section d'édition (`/admin/document/[id]` et « Éditer le corpus »).

---

## §10 — Tests attendus

1. `matchKey` : « Ulrick Is. NOEL », « Ulrick IS. NOEL » et « Ulrick NOEL » donnent la même
   clé ; « Louis BANATTE » et « Luc BOIVERT » en donnent des différentes.
2. Extraction : la formule de clôture est trouvée sur les 15 arrêts, et **les six pièges du
   §8 ne produisent aucun juge**.
3. Extraction : « Luc BOIVERT, Président, Ludovic MAGLOIRE, … et Louis BANATTE, Juges »
   rend 5 noms, le premier avec le rôle `PRESIDENT`.
4. Un nom non reconnu remonte en avertissement — il n'est pas inventé.
5. Le filtre `judge` est présent dans **les quatre couches** (test de fichiers, sur le
   modèle de `src/lib/search/order.test.ts`).
6. `buildSearchText` inclut les noms des juges.
7. `JurisprudenceHeader` n'affiche RIEN quand la composition n'est pas saisie.
8. Le bloc « Sommaire » n'affiche que les rubriques RENSEIGNÉES — une règle de droit vide
   ne produit ni ligne ni intitulé.
9. `buildSearchText` inclut les quatre rubriques : une expression écrite dans la règle de
   droit ramène la décision.
10. **Étiquettes** : `Règle de droit (Rule of Law)`, `Rule of Law (Règle de droit)`,
    `Rule of law (règle de droit)` et `Règle de droit` se ramènent à la MÊME rubrique ;
    idem `Domaines du droit` / `Domaine(s) du droit`, `Date` / `Date de l'arrêt` /
    `Date du prononcé`, `Composition` / `Composition du siège`. Une étiquette inconnue
    remonte en avertissement.
11. **Composition** : la ligne citée au §8 rend 1 président par intérim, 4 juges et
    1 ministère public — le ministère public n'étant PAS compté comme juge.
12. **Identité** : `Ulrick Noël` et `Ulrick Is. NOEL` partagent une clé ;
    `Jh. Marthyl ST JULIEN` et `Jh. Marthyl Saint-Julien` aussi.
13. **Ministère public** : chercher « AMISIAL » ramène ses arrêts ; il n'apparaît PAS dans
    la facette « juge » ni dans le décompte des membres de la formation.
14. **Présidé / participé** : un magistrat qui préside deux arrêts et siège à trois est
    rendu par le filtre sans rôle avec les cinq, ventilés « 2 présidées · 3 siégées » ; avec
    `judgeRole=PRESIDENT`, seuls les deux — **`PRESIDENT_FF` compris**.
15. **Incises** : « en présence de M. Anthony Rivière », « assistés de M. Clément Romulus »,
    « (lecture à vérifier) » et « possiblement "Boisvert" » ne produisent AUCUN magistrat et
    remontent en avertissement.
16. **Collision de numéro** : deux décisions n° 16 de sections différentes coexistent sans
    que l'une écrase l'autre, et un versement qui produirait deux fois la même clé
    (section, numéro, exercice) est REFUSÉ à l'écran de contrôle.

---

## §11 — Vérifications avant de rendre la main

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` propres.
- [ ] `npx tsx scripts/audit-contraste.ts` → **0 échec**.
- [ ] `npm run build:check` compile (**`build:check`**, pas `build`, si le serveur de
      développement tourne).
- [ ] `prisma migrate diff` confirme une migration **purement additive** (aucun `DROP`).
- [ ] Saisir trois juges sur un arrêt, enregistrer, **recharger** : les trois sont là, dans
      l'ordre, avec leur rôle.
- [ ] Chercher un magistrat **en navigation** puis **avec un mot-clé en plus** : le filtre
      tient dans les deux cas (c'est le défaut du §7 qui ne se voit qu'au second geste).
- [ ] Cliquer un nom depuis une fiche mène à ses décisions, **avec la ventilation présidées
      / siégées visible avant la liste**.
- [ ] Prendre un magistrat qui a les deux qualités et vérifier que les deux ensembles sont
      complets et disjoints — leur somme doit égaler le total annoncé.
- [ ] Saisir les quatre rubriques sur un arrêt, recharger, et vérifier qu'elles s'affichent
      dans l'ordre AVANT le texte ; en vider une et vérifier que sa ligne disparaît.
- [ ] Chercher une expression qui n'existe que dans la règle de droit : la décision sort.
- [ ] Vérifier qu'un arrêt sans composition saisie n'affiche pas de bloc vide et reste
      atteignable.
- [ ] Supprimer les données d'essai — la base est celle de **production**.

---

## §12 — Ce qui reste à la rédaction

- Le **rôle** est-il attendu dès maintenant, ou le nom suffit-il ? Le §4 le prévoit
  facultatif ; c'est votre décision de le rendre obligatoire.
- Les quatre rubriques du §6 sont-elles toutes attendues dès la première saisie, ou
  certaines peuvent-elles rester vides le temps que la rédaction avance ? Le prompt les
  traite comme facultatives et indépendantes.
- ~~Le ministère public et le greffe doivent-ils être cherchables par nom ?~~
  **TRANCHÉ : oui.** Voir §7 — ils sont cherchables comme les juges, mais restent hors du
  décompte de la facette « juge ».
- Les **33 décisions reçues** (1re Section n° 35-52, 2e Section n° 1 et 16-29) doivent-elles
  être versées dans le même mouvement, ou après la livraison des champs ? Les verser avant
  obligerait à ressaisir la composition à la main.
