# Prompt — Réparer trois circulaires BRH dont le texte stocké est abîmé

## Ce qui est demandé

Trois fiches de circulaires BRH portent un texte dégradé. Des fichiers Word propres existent
et les répareraient. Il s'agit de **remplacer le texte**, sans rien perdre d'autre.

| Fiche | Défaut du texte stocké | Fichier de remplacement |
| --- | --- | --- |
| `Circulaire n° 131` (id `cmqbnm0ek001gsmfzqf4tbikg`) | 958 lignes sur 958 sans aucun accent **et chiffres mutilés** : « articles 83. I 92 et 193 de Ia Joi du I 4 mai 20 I 2 » pour « articles 83, 192 et 193 de la loi du 14 mai 2012 » | `CIRCULAIRES-BRH/Circulaire 131.docx` |
| `Circulaire n° 126` (id `cmqbnm0e9001asmfzluo36gfh`) | 111 lignes sur 111 sans aucun accent | `CIRCULAIRES-BRH/126_Circulaire_RECONSTITUE.docx` |
| `Circulaire n° 118-1` — **note additionnelle** (id `cmqbnm0dv0012smfzm1kkb09z`) | 14 caractères de remplacement : « applica�on », « Haï� », « fau�f » | `CIRCULAIRES-BRH/118-1_Circulaire_NA.docx` |

Répertoire des fichiers : `/Users/cvaval/Library/CloudStorage/Dropbox/Moniteur/CIRCULAIRES-BRH`.

> ⚠️ **NE PAS TOUCHER À LA CIRCULAIRE 118-1 ELLE-MÊME** (id `cmqbnm0dv0011smfz54w2xpzj`). Deux
> fiches portent le numéro « Circulaire n° 118-1 » : le texte du 23 août 2022, qui est SAIN,
> et la note additionnelle du 7 octobre 2022, qui est abîmée. Sélectionner par numéro
> attraperait la mauvaise. **Travailler par identifiant.**

---

## §1 — Le piège qui rend la réparation inutile si on l'ignore

La page de lecture affiche `doc.bodyClean ?? doc.bodyOriginal` — **`bodyClean` a la priorité**.

| Fiche | `bodyOriginal` | `bodyClean` |
| --- | --- | --- |
| n° 131 | 109 901 car. | **102 249 car.** |
| n° 126 | 11 108 car. | **11 098 car.** |
| n° 118-1 note add. | 2 553 car. | — |

Sur 131 et 126, `bodyClean` est dérivé du **même OCR abîmé**. Remplacer `bodyOriginal` seul
ne changerait **rien à l'écran** : la fiche continuerait d'afficher le texte sans accents,
et la réparation passerait pour faite alors qu'elle ne l'est pas.

**Écrire les deux champs**, ou mettre `bodyClean` à `null` et ne garder que `bodyOriginal`.
Trancher explicitement, et le dire dans le rapport final. La seconde option est la plus sûre
— un champ dérivé qu'on ne sait plus régénérer vaut moins que son absence — mais elle change
ce que voit le lecteur : vérifier à l'écran, pas seulement en base.

---

## §2 — Ce qui doit SURVIVRE au remplacement

Un ré-import écraserait tout. **Ce n'est pas un ré-import : c'est une écriture ciblée sur un
seul champ de trois fiches.** Ne jamais passer par `scripts/import-brh` — il purge et
réimporte, effaçant les enrichissements ET les statuts d'abrogation posés à la main.

À conserver intact, vérifié champ par champ avant et après :

- `status` (les trois sont `EN_VIGUEUR`) et `abrogatedByNumber` ;
- `publicationDate`, `effectiveDate`, `moniteurRef`, `number`, `titleFr`, `source` ;
- les **2 thèmes** de chacune (`DocumentTheme`, axe matière + axe assujetti — voir la
  taxonomie de la BRH elle-même) ;
- `sourcePdfUrl` : les trois ont leur fac-similé, qui reste la référence ;
- `keywords`, `summaryFr`, `metaJson` ;
- renvois (`CrossRef`), citations, versions d'article : zéro sur ces trois fiches
  aujourd'hui, mais le script ne doit pas y toucher pour autant.

---

## §3 — Les tableaux de la circulaire 131

La fiche 131 porte **9 blocs `richBlocksJson`** — des tableaux extraits du texte abîmé. Ils
ne se réparent pas tout seuls en remplaçant le corps.

Trois issues possibles, à trancher AVANT d'écrire :

1. **Régénérer** les blocs depuis le nouveau .docx avec l'extracteur existant, si le
   fichier porte bien ces tableaux ;
2. **Conserver** les blocs actuels — mais alors le texte est propre et ses tableaux ne le
   sont pas, incohérence visible à l'écran ;
3. **Mettre `richBlocksJson` à `null`** — la fiche perd ses tableaux, et le lecteur est
   renvoyé au PDF d'origine.

Choisir (1) si l'extraction rend le même nombre de tableaux ; sinon (3), et le **dire**.
Ne jamais choisir (2) en silence.

> ⚠️ **Un tableau qui ne correspond plus à son texte est pire qu'un tableau absent** : le
> lecteur croit lire les chiffres de la circulaire.

---

## §4 — Le cas 126 se décide séparément

Le fichier s'appelle `126_Circulaire_RECONSTITUE.docx` : c'est une **reconstitution**, pas
une transcription du fac-similé. Substituer une reconstitution à un OCR est un arbitrage
éditorial, pas une correction technique.

Le traiter comme une **étape distincte**, avec sa propre validation, et ne jamais la
regrouper avec 131 et la note additionnelle dans une seule exécution « tout ou rien ». Si
la rédaction ne tranche pas, livrer les deux autres et laisser 126 en l'état.

---

## §5 — Le script

`scripts/reparer-circulaires-brh.ts`, sur le modèle de `scripts/import-jurisprudence-integral.ts` :

- **à blanc par défaut**, `--apply` pour écrire ;
- travaille sur une **liste explicite d'identifiants**, jamais sur une recherche par numéro ;
- **garde-fou de type** : refuser d'écrire si `type !== 'CIRCULAIRE_BRH'` ;
- **sauvegarde les corps remplacés** dans un fichier horodaté avant écriture, et imprime son
  chemin. Sans lui, une erreur découverte trois semaines plus tard est irréparable ;
- affiche, pour chaque fiche : longueur avant/après, nombre de lignes sans accent avant et
  après, nombre de caractères `�` avant et après. **C'est la mesure du défaut corrigé, pas
  une déclaration de succès** ;
- appelle `reindexDocument(id)` après chaque écriture — sans quoi la recherche continue de
  répondre sur l'ancien texte ;
- écrit une entrée `audit()` par fiche, avec `actorId`, l'ancienne et la nouvelle longueur ;
- **idempotent** : rejoué, il annonce « inchangé » et n'écrit rien.

---

## §6 — Ce qu'il ne faut PAS faire

- Ne pas « corriger » le texte au passage : pas de réaccentuation automatique, pas de
  correcteur, pas d'IA sur le corps. On **substitue** un texte propre, on n'en fabrique pas.
- Ne pas retoucher les neuf autres circulaires du lot : elles sont saines, vérifié.
- Ne pas créer de nouvelle fiche, ni supprimer l'ancienne. C'est une mise à jour sur place :
  l'identifiant ne doit pas changer, les liens et favoris des abonnés y pointent.
- Ne pas importer les deux `CirculaireAuxBanques*.docx` : ce sont deux exemplaires du même
  recueil, et ses 23 circulaires de réserves obligatoires sont déjà en base une par une.
- Ne pas toucher au statut `ABROGE` de la circulaire 129 ni à la chaîne d'abrogation.

---

## §7 — Vérifications avant de rendre la main

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm test` propres.
- [ ] Exécution **à blanc** relue avant toute écriture.
- [ ] Après écriture : sur chaque fiche, **zéro ligne longue sans accent** et **zéro `�`**.
- [ ] Sur la 131, vérifier nommément que « articles 83, 192 et 193 de la loi du 14 mai 2012 »
      se lit correctement — c'est le défaut qui a motivé la réparation.
- [ ] Comparer champ par champ un instantané pris **avant** et **après** : seuls
      `bodyOriginal`, `bodyClean` et éventuellement `richBlocksJson` ont bougé.
- [ ] Recherche : une expression qui n'existe que dans le nouveau texte doit ramener la fiche.
- [ ] Ouvrir les trois fiches à l'écran et les lire — l'accentuation est précisément le genre
      de défaut qu'un test ne voit pas et qu'un œil voit tout de suite.
- [ ] Rejouer le script : « inchangé » sur les trois.
- [ ] Le fichier de sauvegarde des anciens corps existe et son chemin est dans le rapport.

---

## §8 — Après coup

Signaler à la rédaction, sans le corriger d'office : **`Circulaire n° 86-12-A` n'a pas de
date de publication** en base. Le recueil des réserves obligatoires ne donne que sa date
d'effet (« à compter du 16 juin 2001 »), ce qui n'est pas la même chose.

Mettre à jour la mémoire projet : le piège `bodyClean` du §1 vaut pour toute réparation de
corps à venir, pas seulement pour ces trois-ci.
