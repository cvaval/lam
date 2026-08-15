# Prompt — Verser l'année 1991 du Moniteur (124 fascicules scannés)

## Ce qui est demandé

Cataloguer dans la section **Éditions Le Moniteur** les 124 fascicules du journal officiel
pour l'année 1991, tels qu'ils se trouvent dans

```
/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/1991-2000/1991 par numéro/
```

---

## §1 — L'état des lieux, mesuré

| | |
| --- | --- |
| Fichiers | **124 PDF**, 74 Mo, **1 312 pages** |
| Période | du **3 janvier** au **23 décembre 1991** |
| Numéros | de **1 à 100**, 98 distincts |
| Nommage | `AAAAMMJJ No N[-X].pdf` — **124 / 124 conformes**, aucune exception |
| Éditions suffixées | 28 en `-A`, 2 en `-B` — **26 numéros portent plus d'un fascicule** |
| Fascicules doubles | 2 : `No 76+77`, `No 78+79` |
| Déjà en base | **0** — 1991 est vierge (`MONITEUR_PDF_1991` n'existe pas) |
| Années déjà versées | 2016 (210) · 2019 (245) · 2021 (264) · 2024 (275) · 2025 (375) · 2026 (216) — **1 585 fascicules** |

La numérotation suit les dates sans rupture, à un croisement près (`No 24` du 14 mars
précède `No 23-A` du même jour — l'ordre du dossier, pas une anomalie du recueil).

---

## §2 — LA COUCHE TEXTE EXISTE DÉJÀ

> ⚠️ **LE SCRIPT ACTUEL AFFIRME LE CONTRAIRE, ET IL A TORT POUR CETTE COLLECTION.**
> `scripts/import-moniteur-pdf.ts` porte en tête : « Les PDF sont des SCANS (pas de couche
> texte) », et écrit dans chaque fiche « Texte intégral non encore océrisé ». C'était vrai
> des fascicules 2016-2026. **Ce ne l'est pas ici** : les 124 PDF de 1991 ont été passés au
> *Paper Capture* d'Acrobat et portent **3 847 502 caractères** de texte, soit 2 636
> caractères par page en médiane. **Aucun** fascicule n'a une couche maigre.

Conséquence : le texte de 1991 est récupérable par un simple `pdftotext`, **sans un centime
d'OCR**. Verser les fiches en les déclarant « non océrisées » reviendrait à jeter un travail
déjà fait, puis à le refaire plus tard à prix d'or.

Le texte est **bruité** — c'est de l'OCR sur microfilm : `« JOU.RNAL OFFICJEL »`,
`« No. 30047l »` pour un n° 1. Il est bon pour la RECHERCHE, pas pour la citation. Il faut
donc l'indexer **sans le présenter comme le texte officiel** : le fac-similé fait foi.

**Décision demandée à la rédaction** : verser le texte extrait dans `bodyOriginal` (et donc
dans la recherche), en le signalant comme transcription automatique non vérifiée ? Ou le
réserver à `searchText` seul, la fiche continuant de renvoyer au PDF ? *Recommandation :
`searchText` seul dans un premier temps — un texte affiché est un texte qu'on cite.*

---

## §3 — Trois pièges du script, à traiter AVANT de lancer

### a) Le dossier à plat le rend aveugle

`collectEditions()` parcourt `--dir` en n'ouvrant que les **sous-dossiers** ; un PDF posé
directement dans `--dir` est ignoré. Or « 1991 par numéro » est un dossier **plat**.

```
--dir ".../1991 par numéro"   → 0 édition détectée, sans erreur
--dir ".../1991-2000"          → les DIX années avalées sous --year 1991
```

> ⚠️ **LE SECOND CAS EST LE PLUS DANGEREUX : IL RÉUSSIT.** Le dossier parent contient
> `1991 par numéro` … `2000 par numéro`. Le script lirait les ~1 200 PDF des dix années,
> les daterait tous en 1991 et les cataloguerait sous `MONITEUR_PDF_1991`. Rien dans la
> sortie ne dirait que neuf années viennent d'être écrasées dans une seule.

**À faire** : accepter un `--dir` qui désigne directement un dossier plat (si aucun
sous-dossier n'est trouvé, lire les PDF de `--dir` lui-même). Et **refuser** un dossier qui
contient plus d'un millésime — un garde-fou explicite vaut mieux qu'une réussite trompeuse.

### b) Les fascicules doubles perdent leur second numéro

`parseEditionName()` lit `/No\.?\s*(\d+)/` : sur `19910923 No 76+77.pdf` il retient **76**
et jette **77**, en silence.

> ⚠️ **LE N° 77 N'EXISTERAIT PAS, ET RIEN NE LE SIGNALERAIT.** Un juriste qui cherche
> « Moniteur n° 77 de 1991 » ne trouverait rien, alors que le fascicule est en base sous un
> autre numéro. Même chose pour le n° 79.

**À faire** : reconnaître `N+M`, cataloguer **une** fiche (c'est un seul fascicule) dont la
référence porte les deux numéros — `LM1991-76+77` — et dont le titre les nomme tous deux.
Prévoir que la recherche par numéro trouve la fiche par 76 **comme** par 77.

### c) `--commit` purge la source entière

```ts
await prisma.document.deleteMany({ where: { source: SOURCE } })
```

Idempotent pour un premier versement, destructeur au second : toute correction éditoriale
faite sur une fiche 1991 — date rectifiée, titre amendé, rattachement thématique — serait
emportée par un ré-import lancé pour « ne rien changer ».

**À faire** : au minimum, annoncer le nombre de fiches à supprimer et **exiger une
confirmation** quand la source existe déjà. (Le même défaut a été corrigé le 15 août dans
`scripts/classer-jurisprudence-themes.ts` : n'effacer que ce que le script a lui-même écrit.)

---

## §4 — Les suffixes : ce ne sont PAS des éditions spéciales

30 fascicules portent `-A` ou `-B`. Le script les traiterait en **régulières**, faute du mot
« spécial » dans le nom de fichier. **C'est correct, et c'est vérifié** : la première page
de `No 1-A`, `No 28-A`, `No 40-B` et `No 91-A` porte « **No. 1-A** », « **No. 28-A** »… et
**aucune ne dit « Spécial »**. En 1991, le suffixe désigne une seconde parution du même
numéro, non une édition spéciale.

> ⚠️ **LE SUFFIXE DOIT FIGURER DANS LA RÉFÉRENCE.** Sans lui, `No 28`, `No 28-A` et
> `No 28-B` se collisionnent toutes sur `LM1991-28`. Le correctif existe déjà (`04fd98f`) —
> `editionRef()` rend `LM1991-28-A` — mais c'est précisément le défaut qui a produit
> **22 numéros dupliqués en 2025**, encore à corriger. Vérifier sur la table d'inventaire
> que les 124 références sont distinctes AVANT d'écrire.

Le n° 28 porte trois fascicules le même jour (28, 28-A, 28-B), le n° 40 également.

---

## §5 — Les manques, à signaler et non à combler

| | |
| --- | --- |
| **n° 29** | absent du dossier |
| **n° 93** | absent du dossier |
| **n° 91** | n'existe **qu'en `-A`** — le fascicule ordinaire manque |
| **n° 94** | n'existe **qu'en `-A`** — idem |

> ⚠️ **NE RIEN INVENTER POUR BOUCHER LES TROUS.** Pas de fiche vide « n° 29 — manquant » :
> une fiche en base est une fiche que la recherche rend, et un lecteur y verrait un
> fascicule que nous n'avons pas. Le manque se consigne dans le rapport de versement, à
> l'intention de la rédaction, qui saura chercher ces quatre numéros à la source.

Six fascicules paraissent **hors lundi et jeudi** — jours ordinaires du Moniteur :
11 (mer. 6 fév.), 15 (mar. 19 fév.), 22 (mar. 12 mars), 74 (mar. 17 sept.),
83 (mer. 16 oct.), 95 (mer. 4 déc.). Rien à corriger : la date du nom de fichier fait foi.

---

## §6 — Ce qu'il faut écrire

Une fiche par fascicule, sur le patron des 1 585 déjà en base :

| Champ | Valeur |
| --- | --- |
| `type` | `LEGISLATION` |
| `source` | `MONITEUR_PDF_1991` |
| `number` | `LM1991-{n}` · `LM1991-{n}-A` · `LM1991-76+77` |
| `titleFr` | `Le Moniteur n° 28-A — Avril 1991` |
| `moniteurRef` | `Le Moniteur n° 28-A de Avril 1991` |
| `publicationDate` | **la date exacte du nom de fichier** (`dateSource: 'filename'`) |
| `editionType` | `REGULIERE` pour les 124 (cf. §4) |
| `sourcePdfUrl` | chemin local, puis URL Blob après migration (§7) |
| `sealed` | `true` |
| `metaJson` | `anneeParution: 146` (1991 − 1845), `pages`, `parts`, `dateSource` |

---

## §7 — Après le catalogage

1. **`npx tsx scripts/migrate-pdfs-to-blob.ts`** — les 74 Mo partent sur Vercel Blob privé
   et `sourcePdfUrl` passe du chemin local à l'URL. Tant que ce n'est pas fait, **aucun
   lecteur ne peut ouvrir un PDF** : le chemin pointe sur le Dropbox de la rédaction.
   ⚠️ Piège connu : passer `BLOB_READ_WRITE_TOKEN` explicitement (le jeton OIDC échoue).
2. **Réindexer** — `searchText` doit porter le texte de §2 si la rédaction le décide.
3. **Vérifier à l'écran** une fiche de chaque forme : ordinaire, `-A`, `-B`, double.

---

## §8 — Contrôles avant de considérer 1991 versé

- [ ] **124 fiches** créées sous `MONITEUR_PDF_1991`, pas une de plus.
- [ ] **124 références distinctes** — aucune collision de suffixe (§4).
- [ ] Les **124 dates** sont celles des noms de fichiers, aucune approximation au 1er du mois.
- [ ] `LM1991-76+77` et `LM1991-78+79` existent, et **la recherche « n° 77 » les trouve**.
- [ ] Les **quatre manques** (29, 93, 91 ordinaire, 94 ordinaire) figurent au rapport et
      **aucune fiche fantôme** ne les représente en base.
- [ ] Aucun PDF d'une autre année n'est entré (§3a) : `publicationDate` tous en 1991.
- [ ] Les PDF s'ouvrent depuis la fiche après migration Blob.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` propres ; `npm run build:check` compile.

---

## §9 — Ce qui vient après

Le dossier parent porte **dix années** — 1991 à 2000, toutes nommées « AAAA par numéro ».
1991 est le banc d'essai : ce qui est corrigé au §3 servira aux neuf autres. Compter, à vue
de 1991, de l'ordre de **1 200 fascicules et 750 Mo** pour la décennie.

> ⚠️ **UNE ANNÉE À LA FOIS, ET UN INVENTAIRE AVANT CHAQUE ÉCRITURE.** Le script tourne à
> blanc par défaut et rend une table de relecture : elle n'est pas une formalité. C'est là
> qu'on voit un numéro dupliqué, une date aberrante ou une année qui a débordé sur l'autre —
> après écriture, il faut une purge pour le corriger.
