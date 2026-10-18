# Livraison — harmonisation des replis, pastilles et bandeaux de la Législation annotée

**Consigne de Me Vaval (17 oct. 2026)** : « harmoniser tous les replis qui se trouvent dans l'ensemble des textes ;
les codes couleurs doivent être identiques pour le même type de situation : amendement, nouveau texte, radier,
jurisprudence, etc. » — puis « Nouveau pour un texte nouveau et Abrogé pour une section éliminée. Amendé pour un
texte modifié. » — puis « lancer la production ».

Spécification : [prompt-harmonisation-replis-legislation-annotee.md](prompt-harmonisation-replis-legislation-annotee.md).

---

## 1. Ce qui a été décidé sur « lancer la production » — à confirmer

Trois questions du prompt (§ 8) étaient restées sans réponse écrite. « Lancer la production » a été lu comme
l'acceptation des propositions qui vous avaient été montrées ; chacune se défait en une ligne si vous en décidez
autrement :

| Question | Choix appliqué | Où le changer |
| --- | --- | --- |
| Les 9 couleurs | la palette montrée (ocre, vert, bordeaux, prune, bleu, ardoise, violet, sable, sarcelle) | `ETAT_COLORS`, `src/lib/brand-colors.ts` |
| Libellé des blocs « bail à usage professionnel » | **« Dérogation »** | `SITUATIONS.derogation`, `src/lib/legislation/situations.ts` |
| Les 298 marqueurs écrits en tête d'article (« (D. du 14 novembre 1988, art. 1) ») | **stylés** dans la couleur de leur situation, texte inchangé au caractère près | `marqueurTete` d'`OfficialText` |

Autres choix faits en cours de route :
- la pastille d'un article abrogé dit **« Abrogé »** (et non plus « Texte abrogé ») ; « Texte abrogé » ne reste que
  comme titre du repli qui montre le texte retiré ;
- un article inséré dit **« Nouveau — <acte> »** (et non plus « Ajout — <acte> ») ;
- l'historique de bas de page ne porte plus de pastille (un article abrogé avait trois signaux) ;
- au Code de commerce, le décret du 9 avril 2020 sur le bail professionnel est rangé en **acte modificatif** (il
  modifie ce Code) ; au Code civil, les 66 encadrés « Bail à usage professionnel » sont une **dérogation** (les
  articles 1484-1549 sont écartés pour ce bail, pas abrogés) ;
- « Texte SUPPLANTÉ … l'abrogation est tacite » (décret signature électronique 2015) reste en **législation
  connexe** : une abrogation tacite ne s'affirme pas de la couleur « Abrogé par » ;
- au Code civil, la note « Historique des amendements — article 1101 » accompagne la loi du 14 février 2017 dans le
  repli de l'acte modificatif.

## 2. Formes créoles nouvelles — à valider

Règle : votre graphie fait foi. Ces formes sont nouvelles ; elles s'affichent sur /ht en attendant votre décision :

**Amande** (amendé) · **Abwoje** (abrogé — l'interface écrivait « Abowje », coquille isolée ; « abwoje » est la
forme déjà employée ailleurs) · **Nouvo** · **Abwoje an pati** · **Derogasyon** · **Poko an vigè** · **Ansyen
vèsyon** · **Tèks abwoje** · **Amande pa** · **Abwoje pa** · **Tèks amande a ajou** · **Lejislasyon ki gen rapò** ·
**Jurisprudans** · **Anotasyon** · **Tèks Jounal ofisyèl la (sic)** · **Tèks konsolide** · **Orijin** · **Anèks
editoryal** · **Koreksyon** · **Transkripsyon pasyèl** · **Gade** · **Konkòdans**.

## 3. Ce qui change à l'écran

- **Un registre unique** (`src/lib/legislation/situations.ts`) : chaque situation a un libellé fr/en/ht, un
  pictogramme et une gamme. Aucun composant ne choisit plus sa couleur ni son mot.
- **Une pastille** (`PastilleEtat`) partout : tête d'article, statut de fiche (listes, recherche, thèmes, en-tête),
  bloc « Citations », administration. Un lien seulement s'il y a une destination ; sinon une étiquette dont
  l'infobulle dit « Ancienne rédaction non disponible au corpus ».
- **Un repli** (`Repli`) : jurisprudence, annotations, ancienne rédaction, texte abrogé, chaque nature de
  législation connexe, notes « sic », sommaire des tableaux. Fermé par défaut, même chevron, mêmes « Afficher /
  Masquer » traduits, focus clavier.
- **Un bandeau** (`BandeauSection`) sous les intitulés : il dit sa nature (« Texte du Journal officiel (sic) »,
  « Texte consolidé », « Provenance », « Annexes éditoriales », « Rectification », « Amendé par ») au lieu de
  « ↪ Renvoi » pour tout.
- **« Pas encore en vigueur »** : pastille et bandeau en tête des textes publiés dont l'entrée en vigueur est
  future (codes pénaux révisés de 2025 : 1er janvier 2027).
- **Une ancienne rédaction se montre une fois** : sous l'article, avec sa ligne datée ; le repli porte l'ancre
  `#hist-art-N`, les liens existants y mènent.
- **Le dégradé sombre de la jurisprudence** (2,6:1) est retiré.
- **« Ancienne version (1987) »** ne s'affiche plus que sur la Constitution (donnée de la fiche, plus une constante).
- **Citations** : « Amendé par », « Abroge », « Cité par »… traduits et orientés, au lieu des codes `MODIFIE`,
  `ABROGE`.
- **Version Word** : chaque note porte sa nature ; l'état de l'article s'écrit « [Amendé] », « [Abrogé] »,
  « [Nouveau] » dans sa couleur ; les marqueurs de tête sont colorés.
- **Administration** : types de renvoi traduits, pastilles du registre, aperçu de la pastille sous « Amender un
  article ».

## 4. Données (base de production)

`scripts/classer-replis-legislation-annotee.ts` — à blanc, vérificateur d'empreintes seul (« Rien à signaler »),
puis `--commit` : **761 champs sur 48 fiches**, écrits et recomptés.
- 30 bandeaux : sic 9 · consolidation 5 · modification 6 · provenance 3 · annexes 5 · rectification 2 ;
- 730 blocs connexes, **0 non classé** : acte modificatif 419 · législation connexe 115 · texte à jour 95 ·
  dérogation 66 · sic 24 · acte abrogatif 7 · ancienne rédaction 4 ;
- `oldVersionsLabel` sur la Constitution.

Le script ne touche qu'à `kind` et `oldVersionsLabel` (le reste du JSON est comparé avant/après). Journal :
`scripts/data/harmonisation-replis/journal-2026-10-18.json` (fiche, chemin, valeur antérieure) — il suffit à
défaire.

⚠️ **Défaut trouvé en classant** : les motifs `^Article modifié\b` et `^Article abrogé\b` ne valaient rien —
en JavaScript, `\b` ne mord pas après une lettre accentuée. 37 blocs « Article modifié — … » du Code de procédure
civile et de ses appendices tombaient au défaut. Corrigé, test de non-régression ajouté.

## 5. Remesure (après) — `scripts/remesurer-replis-legislation-annotee.tsx`, 79 fiches rendues en fr/en/ht

| Défaut | Avant | Après |
| --- | --- | --- |
| D2 ancienne rédaction montrée deux fois | 137 amendés (+ 72 abrogés) | **0** (209 désormais dans leur repli, une fois) |
| D2 article abrogé à plusieurs pastilles « Abrogé » | 80 à trois signaux | **0** |
| D5 « Ancienne version (1987) » | 6 fiches | **1** (Constitution) |
| D7 / D10 bloc ou bandeau sans nature | 730 / 30 | **0 / 0** |
| D10 bandeau « Renvoi » | 30 | **0** |
| D11 pastille cliquable sans destination | 249 | **0** (251 étiquettes, dites telles) |
| D15 libellé français sur /en et /ht | toutes les situations | **0** |

## 6. Contrôles

- `src/lib/legislation/situations.test.ts` (44) : contrastes (encre ≥ 4,5:1, filet ≥ 4,5:1 sur blanc et sur fond),
  ΔE (fonds ≥ 5 du surligneur et de la sélection ; filets ≥ 15 entre eux, ≥ 10 des couleurs réservées), aucun
  accent de marque, chaque statut, `kind` et champ d'annotations déclaré au registre ;
- `OfficialTextEtats.test.tsx` réécrit à la nouvelle règle (chaque état sa gamme) ;
- vitest 1 776/1 776 · typecheck · eslint · `npm run build:check` : verts.

## 7. Reste à faire

- **Contrôle visuel des fiches** connecté (Code civil, Constitution, Code de commerce, CPC, Code du travail, un code
  2025) et **aperçu avant impression** : non faits (connexion requise).
- Les **251 pastilles « Amendé » sans destination** restent des étiquettes : il faudrait verser la rédaction
  antérieure (C. pén. 1835, C. com., Livre IX du CPC, C. civ., appendices Vandal).
- Les formes créoles du § 2 et les trois choix du § 1.
