# Prompt — jurisprudence de la Cour de cassation, exercice 1965-1966

> À donner tel quel à une session de travail sur le dépôt `lam-veritab`.
> Chaque chiffre a été **mesuré** sur les deux `.docx` et sur la base de production.

---

## ⚠️ Les deux fichiers ne relèvent pas du même exercice

C'est le premier constat, et il change la commande.

| Fichier | ¶ | Ce que c'est |
|---|---|---|
| `Sommaire_Analytique_2e_Section_Arrets_FULL.docx` | 1 707 | Sommaires analytiques, **2ᵉ Section**, n° 30 à 47, prononcés de **mai à juillet 1965** |
| `Cour_de_Cassation_1965-1966_FULL.docx` | 2 936 | **Textes intégraux**, « EXERCICE 1965---1966 », 1ʳᵉ **et** 2ᵉ Sections |

Le sommaire ne concerne **pas** 1965-1966 : ses dix-huit décisions appartiennent à l'exercice
1964-1965 et **sont déjà en base**. Vérifié nommément — le n° 30 « Sieur Benoit Juin c. sieur
Merlin Defay », 2ᵉ Section, y figure, comme le n° 31 « Roger Vil c. dame Jeanne Jn Louis ».

Il y a donc **deux travaux distincts**, à ne pas confondre :

1. **Enrichir** dix-huit décisions existantes de 1964-1965 avec leur sommaire analytique ;
2. **Téléverser** l'exercice 1965-1966, nouveau au corpus.

## L'état du corpus

**80 décisions** en base, `type = 'JURISPRUDENCE'`, source `CASSATION_1964_1965`,
`exerciceDebut/Fin = 1964/1965`, n° 1 à 52, réparties entre « Première Section » et
« Deuxième Section » (`chambre`). Le n° 47 existe **deux fois** — une par section : la
numérotation est propre à chaque section, jamais globale.

## L'outillage existe — ne le réécris pas

- `src/lib/jurisprudence/` — `parse.ts` (sommaire analytique), `full-text.ts` (textes
  intégraux), `composition.ts` (formation de jugement), `corps.ts`, `docx.ts`, avec leurs tests.
- `scripts/import-cassation-1964-1965-full.ts` · `import-jurisprudence.ts` ·
  `import-jurisprudence-integral.ts` · `import-cassation-juges.ts` ·
  `classer-jurisprudence-themes.ts`.
- Back-office `/[locale]/admin/jurisprudence` — `PUT` analyse un `.docx` et **n'écrit rien**,
  `POST` enregistre ce que l'opérateur a validé.

Lis ces fichiers avant d'écrire une ligne. Tout ce qui suit y a déjà été payé une fois.

---

## Les pièges, mesurés

### 1. Le sommaire contient SEPT passes du même travail

126 en-têtes `No N —` pour **18 numéros distincts** : chaque décision y figure **sept fois**.
Et les passes ne sont pas identiques — 46 intitulés distincts pour 18 décisions :

```
No 31 — Dr Roger Vil c. dame Jeanne Jn Louis
No 31 — Docteur Roger Vil c. dame Jeanne Jn Louis
No 31 — Sieur Roger Vil, docteur en médecine, c. dame Jeanne Jn Louis
```

Un import naïf créerait 126 fiches pour 18 décisions. **Choisis la passe qui fait foi et
dis laquelle** : la dernière est vraisemblablement la plus aboutie, mais vérifie-le en
comparant deux ou trois rubriques d'une même décision d'une passe à l'autre. Ne prends pas
la première par défaut.

### 2. La numérotation redémarre à chaque section

Le fichier de textes intégraux porte 70 en-têtes `No. n` seuls sur leur ligne, et la suite
repart de 1 : `1, 2, … 12, … 9, 10, 11`. C'est que **chaque section numérote pour elle-même**.
La clé est donc **(section, numéro)**, jamais le numéro seul — la base le confirme, où le n° 47
existe deux fois.

### 3. L'en-tête d'archive appartient à l'arrêt SUIVANT

`full-text.ts` le sait déjà : `EXERCICE 1965---1966`, `PREMIERE SECTION`, les mentions
manuscrites entre crochets précèdent l'arrêt qu'elles annoncent. Ne les rattache pas au
précédent.

### 4. Le découpage se fait sur `No. n` SEUL SUR SA LIGNE

Sinon « identifié au No. 6006-AA », en plein corps d'arrêt, fabrique un faux arrêt. C'est
déjà dans `full-text.ts` — ne réécris pas ce découpage, réemploie-le.

### 5. Quatre gabarits de ligne « Composition », pas trois

Le quatrième n'étiquette rien : ni « Ministère Public : » ni « Greffe : », mais « en présence
de M. X » / « avec l'assistance de M. Y », et sépare la présidence des juges par une simple
**virgule**. Le premier versement en avait tiré onze magistrats fantômes.
**C'est le RÔLE qui borne la présidence, jamais la ponctuation.**

Deux corollaires : la **2ᵉ Section est présidée par un VICE-PRÉSIDENT** — ne rabats pas ce rôle
sur « président » ; et la ligne **nomme des magistrats qui n'ont pas siégé** (celui qui a lu les
conclusions). Seul le nom en tête de segment fait membre de la formation ; la prose va dans
`compositionNote`.

### 6. L'apostrophe se normalise en ESPACE, et l'étiquette se compare seule

Piège payé deux fois : « Date de l'arrêt » et « DATE DE L ARRET » doivent se ramener à la même
clé, donc l'apostrophe devient une **espace** et non une apostrophe droite. Et l'on compare
l'étiquette **à gauche du premier deux-points**, sans inclure le « : » dans le motif — sans
quoi `SOLUTION:` échoue face à `solution :`. Les quinze premières dates étaient restées nulles
pour ces deux raisons successives.

---

## Ce qu'il faut faire

### Lot A — enrichir les dix-huit décisions de 1964-1965

Apparier sur **(chambre, number)**, jamais sur le titre : les sept passes en donnent des
graphies différentes. Remplir les rubriques du sommaire analytique — décision attaquée,
question de droit, règle de droit, solution et motifs, dispositif, domaines — **sans toucher
au texte intégral** déjà en base.

⚠️ **Garde anti-écrasement, elle existe déjà** : `compositionSommaire()` dans
`src/lib/jurisprudence/corps.ts` détecte qu'un corps est la simple composition résumé +
dispositif, c'est-à-dire une fiche *sans* texte intégral. Reverser un sommaire ne doit jamais
effacer un texte intégral. Vérifie que la garde joue avant d'écrire.

### Lot B — téléverser l'exercice 1965-1966

Nouvelle source — proposer `CASSATION_1965_1966` —, `exerciceDebut/Fin = 1965/1966`,
`type = 'JURISPRUDENCE'`. Pour chaque décision :

- `bodyOriginal` = le **texte intégral**, la parole du juge. Non nullable, jamais une chaîne
  vide « pour satisfaire la contrainte » ;
- `summaryFr` = le **résumé éditorial**, la parole de la rédaction. Les deux sont de natures
  opposées et ne se substituent pas l'un à l'autre ;
- `moniteurRef` porte la **référence de l'arrêt** (juridiction · n° · année), pas une citation
  du *Moniteur* — la fiche l'affiche nue, la préfixer donnait « Publié au Cour de Cassation… » ;
- `chambre` = la section ; `number` = le numéro **dans sa section**.

**Idempotence par `(type, source, number, chambre)`** : rejouer le recueil met à jour, ne
duplique pas. Garde-fou : si l'existant n'est pas de type `JURISPRUDENCE`, refuser — pour
qu'un identifiant erroné n'écrase pas le texte d'une loi.

**`reindexDocument()` à chaque création et à chaque mise à jour.** Sans lui la décision existe
en base et reste introuvable à la recherche — un défaut qu'on ne voit pas en relisant la fiche.

### Lot C — la formation de jugement

`Judge` + `DecisionJudge` existent (80 décisions, 545 participations, 21 magistrats).
Réemployer `scripts/import-cassation-juges.ts`, à blanc par défaut, `--apply` pour écrire.

✅ **Les trois rapprochements de graphies sont TRANCHÉS** — décision de la rédaction du
17 août 2026, appliquée par `scripts/arbitrer-graphies-magistrats.ts` :

| Cas | Décision |
|---|---|
| Jh. Marthyl SAINT-JULIEN / Jh. M. St Julien | **fusionnés**, sous « **Jh. Marthyle Saint-Julien** » |
| Max C. Duplessy / Max Duplessy | **« Max C. Duplessy »** — l'entrée était déjà unique, le nom est confirmé |
| Anthony Rivière / Antony Rivière | **maintenus DISTINCTS** — ne pas fusionner |

⚠️ Deux points à respecter pour l'exercice 1965-1966 :

- **« Marthyle » porte un E final qu'AUCUNE des huit graphies du recueil ne porte.** C'est une
  rectification de la rédaction, qui connaît le magistrat, non un choix entre formes attestées.
  Si le recueil de 1965-1966 écrit encore « Marthyl », c'est bien le même homme : rattache-le à
  l'entrée existante sans réécrire la graphie de l'arrêt.
- **Anthony et Antony Rivière restent deux entrées.** La clé de rapprochement les rapproche,
  la rédaction ne les confond pas. Ne les fusionne pas, et ne signale pas ce cas comme un
  doublon à traiter : il est tranché.

Pour tout NOUVEAU rapprochement suggéré par la clé, la règle demeure : elle suggère, elle ne
décide pas. Signale, ne fusionne pas.

---

## Règles d'affichage à respecter

- **Aucune pastille tant que l'éditeur ne s'est pas prononcé.** `traitement` et `portee` restent
  à `null` à l'import : un blanc n'est pas un « neutre », et une pastille par défaut ferait
  passer une absence d'évaluation pour une évaluation.
- Le glyphe ne voyage **jamais seul** : toujours accompagné de son libellé, glyphe en
  `aria-hidden`. Wouj et Vèt sont à 1,05:1 de luminance — en daltonisme, la couleur ne
  distingue rien.
- Les **notes de transcription** sont sorties du corps et rattachées par numéro — **jamais
  écrites par script** : ce serait les signer au nom d'un éditeur qui ne les a pas relues.
- Sur une décision, on n'amende pas un article mais la **note d'édition** — un arrêt n'a pas
  d'articles.

## Exécution

Script re-jouable par lot dans `scripts/`, **simulation par défaut**, `--apply`, `--voir=N`.
Données parsées versionnées sous `scripts/data/cassation-1965-1966/`. Avant d'écrire :

- résoudre les cibles **par `(source, chambre, number)`**, jamais par le titre ;
- refuser d'écraser un `bodyOriginal` de texte intégral par une composition de sommaire ;
- compter et rapporter : décisions appariées, créées, inchangées, et **tout numéro en double
  dans une même section** — c'est le signe que le découpage a dérivé ;
- écriture en transaction avec `audit()`, `reindexDocument()` systématique.

## Vérification

Par le **chemin de rendu réel** — un test `vitest` `.tsx` rendant la fiche avec les props que
`doc/[id]/page.tsx` passe pour une décision. Contrôle nommément : le sommaire analytique en
sept lignes s'affiche **avant** le texte ; la composition ne nomme que ceux qui ont siégé ; le
lien « Aller au texte de l'arrêt » (`#texte-officiel`) est présent ; aucune pastille sur une
décision non évaluée ; la référence d'arrêt s'affiche nue.

⚠️ **La fiche n° 29** (Compagnie d'Éclairage Électrique, 1ʳᵉ Section) compte 30 591 caractères
d'analyse, vingt à trente fois la moyenne. Elle **fausse toute moyenne** calculée sur le
corpus : mesurer sans elle. Ne la tronque pas — le lien d'ancre est la réponse.

Puis consigne la livraison, commite, pousse, et rapporte : ce qui a changé lot par lot, la
passe du sommaire que tu as retenue et pourquoi, et tout ce que tu as dû trancher.
