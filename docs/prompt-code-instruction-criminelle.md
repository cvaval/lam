# Prompt — téléverser le Code d'instruction criminelle

> À donner tel quel à une session de travail sur le dépôt `lam-veritab`.
> Tout ce qui suit a été **mesuré** sur les fichiers fournis et sur la base de production ;
> les chiffres sont des faits, pas des estimations.

---

Téléverse le **Code d'instruction criminelle d'Haïti** dans la même section que le Code pénal,
avec sa table des matières et son index, et rends cliquables les renvois que le reste du corpus
lui adresse.

## Les fichiers

- `~/Downloads/Code_instruction_criminelle.docx` — le Code, **946 ¶ · 188 607 caractères**
- `~/Downloads/Code instruction criminelle_ TABLE DES MATIÈRES.docx` — **68 ¶** (1 titre + 67 rubriques)
- `~/Downloads/Index_Code_instruction_criminelle.docx` — **671 ¶**

⚠️ **Piège d'extraction déjà payé sur ce corpus** : convertis `<w:tab/>` en `<w:t> </w:t>`, et
retire `<w:pPr>…</w:pPr>` **avant** de lire les `<w:t>` (le `pPr` porte ses propres `<w:tabs>`).
Une espace nue tombe hors des balises et disparaît.

## Où le ranger

Le Code pénal (`cmrhdnzvm0000ywp2v4amq505`, `CODE_PENAL_ANNOTE`) est sous **« Droit pénal » →
« Droit pénal général »** (`penal-general`). Le même arbre porte **`procedure-penale`
« Procédure pénale »**, créé et **vide** : c'est la place de ce code — même section, branche sœur.

`type=LEGISLATION`, `source=CODE_INSTRUCTION_CRIMINELLE`, `status=EN_VIGUEUR`, thème
`procedure-penale` en principal. Prends `scripts/_import-decret-minier.ts` ou le patron du Code
pénal pour gabarit.

## La colonne vertébrale — mesurée, à ne pas redécouvrir

**462 articles**, numérotés de 1 à 472, strictement croissants, aucun doublon. Dix numéros
manquent : **109-111** et **202-208**, tous supprimés par la loi du 12 juillet 1920 — et le corps
le déclare lui-même (¶197 et ¶360). Deux sources concordantes : l'index client, qui cite 456
numéros distincts, n'en cite aucun de ces dix.

487 têtes d'article au total = 462 du Code + 1 (loi de 1929) + 24 (loi de 1979).

## ⚠️ Les deux lois intercalées — le point le plus délicat

Deux textes sont insérés **au milieu** du Code, avec une numérotation qui repart :

- **Loi du 20 juillet 1929** — ¶594 à ¶598, **un seul article, le 2**. Son article 1er n'est pas
  reproduit ; ¶593 dit pourquoi (« Article 313.- Cet article a été abrogé… ce sont les
  dispositions de l'article 2 de la loi du 20 juillet 1929 qui doivent être appliquées »).
- **Loi du 26 juillet 1979 sur l'appel pénal** — ¶604 à ¶656, **24 articles, 1 à 24**, avec ses
  TITRE I à IV. Elle se referme sur la formule « Donné à la Chambre législative… ». Le Code
  reprend exactement à ¶657 (`SECTION I - MATIÈRES CRIMINELLES`), puis ¶658 `Article 315.-`.

**N'emploie PAS `toc.kind === 'connexe'` sur ces deux entrées.** Mesuré sur le vrai
`segmentAnnotated` : `inAnnexe` (`src/lib/legislation/annotated.ts:244`) est un **verrou à sens
unique** — il passe à `true` et n'est jamais remis à `false`. Les marquer `connexe` ferait perdre
son ancre à **159 articles du Code, du 314 au 472** ; l'index deviendrait mort et
`code-search.ts:58` les exclurait.

**Laisse-les en `kind: 'code'`.** Le déduplicateur `seenArt` déjà présent règle la collision seul,
parce que les numéros 1-24 et 2 ont déjà été vus plus haut : **462 ancres (= les 462 articles du
Code), 25 blocs muets (= les articles des deux lois), zéro ancre en double.** Vérifié en exécutant
la fonction réelle sur le corps reconstitué.

*(Un correctif d'une ligne — `inAnnexe = toc[tocPtr].kind === 'connexe'` — a été éprouvé et donne
le même résultat, mais il change le comportement de tous les codes déjà en base : décision à
prendre séparément, hors de ce téléversement.)*

## Table des matières — bijection stricte, mais les libellés ne sont pas les lignes

Les 67 rubriques et les 67 en-têtes du corps **coïncident une à une, dans l'ordre** (59 stylés
Heading1-3 + 8 paragraphes gras non stylés que la table reprend). Aucune orpheline, d'aucun côté.
L'ordre inhabituel — la loi de 1979 s'intercale entre `CHAPITRE Ier — DES NULLITÉS` et les
SECTIONS I-III de ce même chapitre — est celui du recueil : **ne le « corrige » pas**.

Mais **45 libellés sur 67 joignent deux ou trois lignes du corps par un tiret** (`CHAPITRE Ier —
DE LA POLICE JUDICIAIRE` = ¶17 + ¶18). Or un `toc.label` n'est valide que s'il est **exactement**
une ligne du corps. Mesuré :

| `toc.label` | sections appariées | articles sans ancre |
|---|---|---|
| libellés de la table | **0 / 67** | — |
| ligne du corps, `kind:'code'` | **67 / 67** | **0** |

Donc : `toc.label` = la ligne du corps (le paragraphe stylé seul) ; le libellé composé va dans
`navToc`. Deux entrées seulement demandent un niveau différent de leur style : les deux lois
intercalées sont au fer de la table (niveau loi) alors qu'elles sont stylées Heading2 — **suis la
table**, sinon la loi de 1979 devient sœur des TITRE qu'elle contient.

⚠️ **Ne construis pas `navToc` par l'indentation.** Les rubriques 46-48 (`SECTION I - MATIÈRES
CRIMINELLES`, II, III) suivent le `TITRE IV` de la loi de 1979 mais appartiennent au Code
(LOI Nº 5, chapitre Ier, articles 315-322). Il faut une règle explicite de fermeture d'annexe.

⚠️ `SECTION 1 : DU JURY` (¶371) est la seule section numérotée en chiffre arabe : si le pointeur
de la table se désaligne, `articleAnchorFromHeading` lui donnerait l'ancre `art-1`.

## Index — 759 renvois, aucun mort

Structure : **sujet et renvois sur des lignes séparées**. 671 ¶ = 3 lignes de titre et note + 20
séparateurs de lettre + **101 sujets** (fer à gauche, gras) + **547 lignes de détail** (en retrait,
italiques, préfixées « – ») + **10 renvois « X — voir Y »**.

Formes de renvoi : `N` (645), plage `N-N` (76), `1er` (2), et `L. 20 juill. 1929 / L. 26 juill.
1979, art. N`. **Aucun « et s. »** — la note liminaire énonce la convention.

**759 renvois atomiques, 1 276 couples (sujet, article) distincts, zéro hors 1..472, zéro mort.**
Couverture 457 / 462. Non indexés : 156, 321, 322 (supprimés), 472 (formule finale) et **314**,
seule vraie omission. **Aucun doublon fautif** : 0 sujet en double ; les 7 lignes au texte
identique le sont sous deux sujets différents (renvoi croisé normal) ; les 18 couples répétés
naissent de deux descriptions distinctes du même sujet.

Conversion recommandée : **557 entrées** (547 lignes + 10 « voir »), `subject` = « SUJET —
description », `ctRefs` extraits en coupant au **dernier** « : » puis en balayant la queue —
mesuré : aucune des 547 lignes n'a de chiffre avant le dernier deux-points.

**Trois écueils à ne pas ignorer :**

1. **69 renvois visent les lois intercalées**, sur 23 numéros (1 à 23) qui **existent tous comme
   articles du Code**. Rendus en `#art-N`, ils enverraient le lecteur au mauvais article —
   silencieusement, pas en lien mort. 13 sujets touchés. **À trancher avec la cliente** : libellé
   en clair sans lien, ou les deux lois téléversées à part avec `docRefs`.
2. **Le contexte de loi doit se réinitialiser au « ; »** — ¶394 : « … : 313 ; L. 20 juill. 1929,
   art. 2 ; 371, 398, 408. » Un automate qui garde le contexte jusqu'au bout attribuerait 371,
   398 et 408 à une loi qui n'a qu'un article. Seule ligne concernée.
3. ¶74 porte du texte **après** le dernier deux-points ; ¶440 a 14 renvois **entre parenthèses**
   collés à leur motif ; ¶422 n'a ni deux-points ni chiffre et doit rendre `ctRefs: []` sans
   planter. Et `Art 271.-` (¶509), sans point après « Art », échappe à un filtre naïf.

Un défaut isolé : `DÉBATS — voir Tribunal criminel — Examen.` ne vise aucun sujet existant
(l'index a `TRIBUNAUX CRIMINELS` au pluriel). À signaler, pas à corriger d'office.

## Notes éditoriales dans le corps — inventaire clos

**Quatre notes autonomes**, dont trois relèvent du pliable « Textes connexes » comme sur le
Code civil :

| ¶ | texte | traitement |
|---|---|---|
| 197 | « Les articles 109, 110, 111 ont été supprimés par la loi du 12 Juillet 1920. » | **orpheline** — entre l'en-tête du CHAPITRE IX et l'art. 112, elle ne se rattache à aucun article, donc `connexe` (clé `art-N`) ne peut pas la recevoir. Laisser au corps ou poser un `crossRefs` sur la section |
| 356 | « Les trois derniers alinéas sont ajoutés par la même loi. » | à replier — `connexe['art-201']` |
| 360 | « Les articles 202 à 208 sont supprimés par la loi du 12 Juillet 1920. » | à replier — concerne 202-208, pas l'art. 201 qui l'héberge |
| 939 | « Voir Article 1 du Décret du 4 juillet 1988 abolissant la peine de mort. » | cas d'école du pliable, avec `docId` si ce décret est en base |

**Deux queues éditoriales soudées à une disposition — NE PAS les détacher** : ¶355 (« Cet alinéa
est ainsi modifié par la Loi du 12 Juillet 1920 », dernière phrase d'un alinéa authentique de
l'art. 201) et ¶419 (« (Ainsi modifié par la Loi du 14 Septembre 1953) », art. 231).

**Sept têtes d'article dont tout le contenu est un constat d'abrogation — elles RESTENT au corps** :
articles 156, 313, 321, 322, 328, 333, 389. Elles portent le numéro, donc l'ancre : les replier
créerait sept trous. Candidates au badge par `status: { 'art-321': 'abrogé' }`.

**147 articles portent une parenthèse de tête**, dont 142 de provenance (« (Loi du 29 mars
1928).- »). Le texte n'a **aucun appareil typographique** : contrairement au Code civil, rien à
séparer entre dispositif et jurisprudence.

## Les renvois du corpus vers ce code — la partie que la cliente a demandée

Mesuré sur les **29 227 documents** de la base : le sigle n'a que **trois graphies**, pas onze
comme le Code de procédure civile.

| graphie | occurrences | où |
|---|---|---|
| `C. i. c.` | **26** | Code civil (corps) |
| `C.I.C.` | **3** | Code de procédure civile (appareil) et son appendice |
| « Code d'instruction criminelle » (8 variantes de casse) | **39** | 19 documents, dont 12 entrées de l'Index du Moniteur |

Zéro occurrence de `C. inst. crim.`, `instr. crim.`, `C. crim.`, `C. cr.`, `Ci. c.`, `C. pr. pén.`
— toutes sondées. **Le Code pénal ne cite jamais ce code**, ni par sigle ni par nom : les deux
voisineront sans un renvoi réciproque.

33 numéros distincts sont cités, tous dans 1..472 — **sauf l'article 110**, que le Code civil
appelle (« C. i. c., 108, 110 ») et qui n'existe pas. `isCicArticle` doit donc exclure les dix
absents, sinon c'est un lien mort.

**Une grammaire est déjà écrite et éprouvée** :
`…/scratchpad/cic/coderefs-cic.ts` (copie de `src/lib/doc/coderefs.ts` avec la clé `'cic'`), plus
`07-grammaire.ts` (11 témoins positifs, 16 négatifs, 4 lignes croisées, 0 échec) et
`09-integration.ts` (`segmentCodeRefs` réel). Reprends-la, ne la réinvente pas — **et relis les
trois sentinelles avant d'y toucher, chacune a été payée par un faux positif mesuré** :

1. le lookbehind `(?<![\p{L}\d\-–'’])` — sans lui, « notifiée à celui-**ci. C**. civ., 1767 » est
   lu comme le sigle et **vole au Code civil son renvoi** (2 cas dans le Code civil, 4 dans les
   circulaires BRH) ;
2. **le point final obligatoire** — sans lui entrent « CIC » (une société), « **Cic**éron » et les
   codes pays « CI » / « CL » des circulaires : 62 correspondances contre 29, soit 33 faux
   positifs ;
3. la négation `(?![\s.]*(?:civ|com|p[ée]n|proc|pr…))` — le troisième terme ne peut ouvrir
   l'abréviation d'un autre code.

**Ne reprends pas** la première version, qui exigeait qu'aucune lettre ne suive : elle tuait deux
des trois `C.I.C.` (« 443 C.I.C. **que** la communication… »).

Vérifié : aucun vol dans les deux sens avec `CIV_RE` d'`OfficialText` — le sigle ne contient jamais
la sous-chaîne `civ.`. Éprouve-le quand même sur la ligne authentique
`« C. civ., 1168.- C. p. c. 215 et s;- C. i. c. 350 et s; C. pén., 107 et s, 192 et s. »`, où les
quatre grammaires doivent se partager la ligne sans se marcher dessus.

Enfin, câble `codeHrefs` : `src/app/[locale]/(app)/doc/[id]/page.tsx` ne résout aujourd'hui les
codes cités que pour `CODE_CIVIL_ANNOTE`. Étends-le pour que le Code civil, le Code de procédure
civile et son appendice pointent vers ce nouveau code.

## Exécution

Un script re-jouable dans `scripts/`, **simulation par défaut**, `--apply` pour écrire, `--voir`
pour prévisualiser. Données parsées versionnées sous `scripts/data/code-instruction-criminelle/`.
Avant d'écrire, il doit vérifier :

- que le document n'existe pas déjà (idempotence) ;
- **462 ancres d'article, 25 blocs muets, zéro ancre en double** ;
- que les 67 entrées de table s'apparient toutes au corps ;
- que toute ancre du `navToc` existe dans la page — le contrôle qui manquait au Code civil et y
  avait laissé un lien mort ;
- qu'aucun `ctRefs` de l'index ne vise un article inexistant ;
- que les renvois sortants sont résolus **par `source`**, jamais par le titre : « signature
  électronique » ramène cinq documents, dont des fiches d'Index du Moniteur qui n'en portent que
  l'intitulé, et un `findFirst` sur le titre en avait lié une par erreur.

Écriture en transaction avec `audit()`, et **`searchText` recalculé** par `buildSearchText` : il
n'est reconstruit que par les routes d'administration, une écriture directe le laisserait en
arrière et la recherche resterait sur l'ancien texte.

## Vérification

Éprouve par le **chemin de rendu réel** — un test `vitest` `.tsx` rendant `<AnnotatedText>` avec
les props que `doc/[id]/page.tsx` passe pour cette source. Contrôle que les 462 articles portent
leur ancre, que les articles des deux lois intercalées n'en volent aucune, que le sommaire latéral
ne produit aucun lien mort, et — depuis le Code civil — qu'un « C. i. c., 350 » est devenu un lien
vers ce code tandis que « C. i. c., 110 » reste en texte.

Puis consigne la livraison (`docs/livraison-…md`), commite, pousse, et rapporte : ce qui est en
ligne, les décisions que tu as prises, et les deux points laissés ouverts (les 69 renvois d'index
vers les lois intercalées, la note orpheline ¶197).
