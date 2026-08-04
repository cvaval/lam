# Prompt — téléverser l'Arrêté du 30 avril 2018 sur la protection des données personnelles

> À donner tel quel à une session de travail sur le dépôt `lam-veritab`.

---

Téléverse dans Lam Veritab l'**Arrêté du 30 avril 2018 fixant les règles relatives à la
protection des données à caractère personnel** (Le Moniteur, 173ᵉ année, n° 87, mardi 15 mai
2018), avec son sommaire et son index alphabétique, dans la section **Droit privé**.

## Les fichiers

- `~/Downloads/Arrete_Protection_Donnees_Personnelles_2018_RECONSTITUE_1.docx` — le texte
  (68 paragraphes : bandeau du Moniteur, titre, 16 visas, 3 considérants, « ARRÊTE », 5 articles,
  formule de promulgation, 20 signataires).
- `~/Downloads/Arrete_PDP_2018_Sommaire.docx` — le sommaire (rubriques Visas / Considérants /
  Dispositif / Signatures, plus le détail des neuf exigences de l'article 3).
- `~/Downloads/Arrete_PDP_2018_Index_alphabetique.docx` — l'index alphabétique, **37 entrées**
  (paragraphes 4 à 40).

⚠️ **Piège d'extraction, déjà payé sur ce corpus.** Dans ces `.docx`, le titre du signataire et
son nom sont deux runs séparés par un `<w:tab/>` : « Le Président ⇥ Jovenel MOÏSE ». Si tu
remplaces `<w:tab/>` par une espace **nue**, celle-ci tombe HORS des balises `<w:t>` et
l'extraction la perd — tu obtiens « Le PrésidentJovenel MOÏSE ». Convertis-le en run de texte
(`<w:tab/>` → `<w:t> </w:t>`), et retire `<w:pPr>…</w:pPr>` **avant** de lire les `<w:t>` (le
`pPr` contient ses propres `<w:tabs>`, qui pollueraient).

## Ce qui existe déjà en base — ne pas dupliquer

L'arrêté figure **déjà** au catalogue sous une fiche d'Index du Moniteur :
`ffe67f8e-6a11-4e23-9591-448fffc3ac41`, `type=INDEX`, `source=MONITEUR`, `number=LM2018-87`,
corps de 85 caractères (le titre seul). Ce n'est pas un doublon du texte intégral : les deux
doivent coexister. Relie-les — la fiche d'index doit mener au texte.

Textes cités par les visas et présents sur la plateforme, à rendre cliquables :

| texte | id |
|---|---|
| Constitution de 1987 (visa : art. 10, 11, 11-1, 12, 16, 16-2, 17, 18) | `cmr1it23a0000b4r0l6r1xp5l` |
| Code civil d'Haïti | `cmr4b6f3v0000iz56asjmwrlg` |
| Code pénal d'Haïti | `cmrhdnzvm0000ywp2v4amq505` |
| Loi du 14 février 2017 sur la signature électronique | `cms6bgx48000011j6a5wcb1ru` |

Les autres visas (lois de 1958, 1974, 1976, 2013 ; décrets de 1987, 2005, 2015 ; conventions et
pactes internationaux) ne sont pas au corpus : laisse-les en texte, ne fabrique pas de lien mort.

## Le document à créer

`type=LEGISLATION`, `source=ARRETE_PDP_2018`, thème **`droit-prive`** (racine, il existe), avec
`number` et `moniteurRef` cohérents avec la fiche d'index (`LM2018-87`, « Le Moniteur · LM2018-87
· Mardi 15 mai 2018 »). Lecteur annoté, comme les décrets déjà livrés — prends
`scripts/_import-decret-imf.ts` ou `_import-loi-ucref.ts` pour gabarit : ce sont les plus proches
(texte court, sommaire et index fournis).

**Corps** — le texte tel que le Moniteur l'imprime, une ligne par paragraphe, du bandeau aux
signatures. Ne réécris rien, n'ajoute aucun intertitre qui ne soit pas dans le document.

**Sommaire (`toc`) et menu (`navToc`)** — attention, ils obéissent à deux contraintes opposées
qui viennent de coûter cher sur le Code civil :

- une entrée de `toc` ne vaut que si son `label` est **exactement** une ligne du corps
  (`segmentAnnotated` apparie la table au corps DANS L'ORDRE) ;
- un nœud de `navToc` ne vaut que si son ancre **existe** dans la page rendue, sinon le sommaire
  latéral renvoie dans le vide.

Or les rubriques du sommaire fourni — « Visas », « Considérants », « Dispositif », « Signatures »
— **ne sont pas des lignes du corps**. Deux voies, à toi de trancher et de dire laquelle tu as
prise :

1. `toc` réduite aux lignes réellement présentes (« ARRÊTE » ouvre le dispositif, « Par : » ouvre
   les signatures), et `navToc` listant les cinq articles par leurs ancres `art-1` … `art-5` ;
2. `toc` vide et `navToc` sur les seuls articles — les cinq articles reçoivent de toute façon
   leur ancre par `articleAnchorFromHeading`.

Dans les deux cas, **vérifie avant d'écrire que l'ensemble des ancres du `navToc` est égal à
l'ensemble des ancres du `toc` augmenté des ancres d'article réellement émises**. C'est le
contrôle qui manquait et qui a laissé passer, dans le Code civil, un lien mort et trois entrées
invisibles.

**Index (`indexEntries`)** — 37 entrées, de la forme `{ subject: string, ctRefs: (number|string)[] }`.
Les renvois du document sont de la forme « art. 3, 8) » : porte le numéro d'article dans `ctRefs`
(soit `3`) et garde la précision de l'item dans le `subject`, comme le fait déjà l'index du Code
civil. Vérifie qu'aucun `ctRefs` ne vise un article inexistant (il n'y en a que cinq).

## Trois points à trancher, et à me rapporter — n'en corrige aucun en silence

1. **Dix-huit ministres signent le texte, le sommaire en annonce dix-neuf.** Compte-les toi-même
   pour confirmer. Il manque probablement un signataire à la reconstitution — un ministre délégué,
   typiquement. Le Moniteur de 2018 **n'est pas** au corpus (années présentes : 2016, 2019, 2021,
   2024, 2025, 2026), il n'y a donc pas de fac-similé pour trancher : signale l'écart, ne comble
   pas le trou de mémoire.
2. **« pr Antonio RODRIGUE » et « pr Hervé DENIS »** — ce « pr » est dans le `.docx` source, ce
   n'est pas un artefact d'extraction. C'est vraisemblablement un « Me » (maître) mal transcrit,
   mais rien ne l'établit. Reproduis tel quel et signale.
3. **L'index porte un doublon** : l'entrée 6 (« Restriction - consultation réservée aux services
   habilités… ») répète la seconde moitié de l'entrée 5 (« Accès (restriction d'—) »), et se
   termine sur « art. 3, 6 » sans la parenthèse fermante. Avant de retrancher quoi que ce soit,
   **établis le doublon par une mesure** — comparaison exacte des chaînes, longueurs — et non à
   l'impression de similitude. Propose, n'exécute pas : c'est une décision éditoriale.

## Exécution

Un script re-jouable dans `scripts/`, **simulation par défaut**, `--apply` pour écrire, une
option `--voir` pour prévisualiser le rendu. Avant d'écrire, il doit vérifier :

- que le document n'existe pas déjà en `LEGISLATION` (l'idempotence, pas le doublon) ;
- qu'aucun renvoi sortant ne pointe vers une ancre inexistante dans le document cible ;
- que `toc` et `navToc` coïncident (cf. ci-dessus) ;
- que chaque `ctRefs` de l'index vise un article réel.

Écriture en transaction, avec `audit()`. **Recalcule `searchText`** par `buildSearchText` :
il n'est reconstruit que par les routes d'administration, et une écriture directe le laisserait en
arrière — la recherche resterait sur l'ancien texte. C'est l'oubli qui a rendu l'index du Code
civil périmé pendant une journée.

## Vérification

Éprouve par le **chemin de rendu réel** — un test `vitest` `.tsx` qui rend `<AnnotatedText>` avec
les props que `src/app/[locale]/(app)/doc/[id]/page.tsx` passe réellement pour cette source — et
non par inspection de la donnée brute. Contrôle que les cinq articles portent leur ancre, que les
neuf items de l'article 3 sont bien dans le **dispositif** et non dans un pliable, que les renvois
sortants s'affichent, et que l'index latéral ne produit aucun lien mort.

Puis consigne la livraison (un `docs/livraison-…md` bref), commite, pousse, et rapporte : ce qui
est en ligne, les trois points ci-dessus, et tout ce que tu as dû décider.
