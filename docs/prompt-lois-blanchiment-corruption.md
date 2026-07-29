# Prompt d'exécution — Loi sur le blanchiment (2013) & Loi sur la corruption (2014)

> Spécification d'autorité, écrite APRÈS lecture intégrale des deux textes et
> analyse des deux sommaires : tous les chiffres sont mesurés. **Les index sont
> déjà construits et vérifiés** (`scripts/data/*/build_index.py` → `_index.json`) ;
> il reste à écrire les parseurs de corps, les imports et à exécuter.

## 1. Les deux textes

| | Blanchiment | Corruption |
|---|---|---|
| Titre | Loi sanctionnant le blanchiment de capitaux et le financement du terrorisme | Loi portant prévention et répression de la corruption |
| Date de la loi | **11 novembre 2013** (cf. §2) | **12 mars 2014** |
| Publication | Le Moniteur **n° 212 du 14 novembre 2013** | Le Moniteur **n° 87 du 9 mai 2014** |
| Source docx | `~/Downloads/loi blanchiment 2013.docx` (293 ¶) | `~/Downloads/loi corruption 2014.docx` (129 ¶) |
| Articles | **88 unités** : 1 à 86 + 82.1 + 82.2 | **41 unités** : 1 à 26 + 5.1 à 5.14 + 22.1 |
| En-têtes | **24** : 6 TITRES, 12 Chapitres, 6 Sections | **9** : 3 TITRES, 6 Chapitres |
| `source` | `LOI_BLANCHIMENT_2013` | `LOI_CORRUPTION_2014` |
| Index fourni | **150 sujets**, couverture 88/88 | **81 sujets**, couverture 41/41 |

**Emplacement** : Législation annotée → Droit économique & des affaires →
**Banques & institutions financières** (`droit-bancaire`) pour le blanchiment
(24ᵉ document) ; pour la corruption, voir §7 — un arbitrage est requis.

Les deux textes proviennent du **même recueil** (numérotés « 11. » et « 12. » en
tête) : leurs premières lignes portent ce numéro d'ordre du recueil, à conserver ou
non selon le §5.

## 2. La date du texte sur le blanchiment — tranché

Le document fourni porte « Loi du jeudi **14** novembre 2013 (Moniteur n° 212) ».
Vérification faite :

- l'**Index du Moniteur** (en base) enregistre la publication au **14 novembre 2013** ;
- mais **onze textes du corpus** citent « la loi du **11** novembre 2013 » : la Loi
  UCREF, le Décret IMF 2020, huit circulaires BRH, et surtout **la loi modificative
  de 2016 elle-même**, dont l'intitulé officiel est « Loi modifiant la loi du
  11 novembre 2013 sanctionnant le Blanchiment de Capitaux… ».

**Décision** : `number = "Loi du 11 novembre 2013"` (date de la loi, citation
universelle) et `publicationDate = 2013-11-14` (parution du Moniteur n° 212). Les
deux dates figurent dans le résumé et les mots-clés. La mention « jeudi 14 novembre »
du document est la date de **parution**, non celle de la loi — à signaler à la
cliente.

## 3. Réserve MAJEURE — le texte n'est pas consolidé

L'Index du Moniteur contient une entrée du **13 octobre 2016** : « **Loi modifiant la
loi du 11 novembre 2013** sanctionnant le Blanchiment de Capitaux et le Financement
du Terrorisme » (adoptée le 28 septembre 2016 selon le visa du Décret IMF). Le texte
fourni est donc la version **2013 d'origine**, non consolidée.

→ La note de tête doit le dire clairement au lecteur : « Texte tel que publié en
2013 ; une loi modificative du 28 septembre 2016 (Le Moniteur du 13 octobre 2016)
n'est pas intégrée à cette version. » Et la loi de 2016 devient la prochaine
acquisition prioritaire de la section.

## 4. Lacunes et anomalies de la source (constatées, à conserver et signaler)

**Blanchiment :**
1. **Article 61 tronqué** — il annonce « Sont punis d'un emprisonnement de trois (3)
   à quinze (15) ans ou d'une amende de deux millions à cent millions de gourdes,
   selon la gravité du cas **:** » puis **l'énumération est absente** ; l'article 62
   suit immédiatement. Conserver verbatim + note sous l'article. Sans le fac-similé
   du Moniteur n° 212, impossible de savoir si la lacune est du J.O. ou de la
   transcription — **ne pas trancher** (leçon Décret minier).
2. **TITRE 1er sans Chapitre I** : le texte passe du TITRE 1er directement aux
   articles, puis « Chapitre II — Définitions ». Le sommaire client présente la même
   structure. Conserver, noter.
3. **Numérotation des sections mêlée** : « Section I : Dispositions générales » puis
   « Section 2 », « Section 3 », « Section 4 » ; idem « Section I : Gel » / « Section
   2 : Saisie » ; et « Section 1 : Sanctions » / « Section 2 : Confiscation ».
   Verbatim.
4. **Article 40** : ses alinéas sont lettrés « g. h. i. » au lieu de « a. b. c. ».
5. Articles **82.1 et 82.2** : deux articles décimaux insérés entre 82 et 83
   (ancres `art-82-1`, `art-82-2`, affichage « 82.1 » par `prettyRef`).

**Corruption :**
6. **Renvoi mort dans le texte** : l'article 9 réprime « les pratiques commerciales
   ou comptables énumérées à **l'article 32** de la présente loi » — or la loi
   compte 26 articles ; la liste visée est manifestement celle de **l'article 25**.
   L'anti-lien-mort empêchera tout faux lien ; ajouter une note sous l'article 9.
7. **Chapitre IV de 188 caractères** (« De la modification de certains articles du
   point IV de la section II du Code Pénal traitant "de la Forfaiture…" ») :
   **aucun filtre de longueur sur les en-têtes** — c'est exactement ce qui avait fait
   disparaître le TITRE IV de l'Enregistrement (audit vague 2). Limite ≥ 200.
8. **Deux « Chapitre V »** : l'un dans le TITRE I (« Règles communes aux
   infractions »), l'autre dans le TITRE II (« Des mesures préventives contre la
   corruption ») ; et **pas de Chapitre IV dans le TITRE II**. Verbatim + note.
9. **Articles 5.1 à 5.14** : une infraction par article décimal (concussion,
   enrichissement illicite, blanchiment, détournement, abus de fonction, pot-de-vin,
   commissions illicites, surfacturation, trafic d'influence, favoritisme, délit
   d'initié, passation illégale de marché, prise illégale d'intérêts, abus de biens
   sociaux) ; **22.1** pour les peines complémentaires des personnes morales.
   Chaque article décimal porte un intitulé sur sa ligne de tête (« Article 5.1.- De
   la concussion »), à conserver tel quel.

## 5. Pièges d'extraction

- **Aucune tabulation** dans ces deux docx (0 `<w:tab/>`) et **aucun tableau** :
  le piège des colonnes aplaties (leçon UCREF) ne s'applique pas ici. Utiliser
  malgré tout l'extracteur corrigé (`<w:tab/>` → `<w:t> </w:t>`).
- **Aucun passage barré**.
- Têtes d'articles : forme `Article N.- ` (espacée) pour les articles entiers ;
  forme `Article N.M.- Intitulé` pour les décimaux. Le point après le numéro
  décimal ne doit pas être pris pour la ponctuation de tête.
- Les **trois premières lignes** de chaque fichier sont le front matter du recueil
  (numéro d'ordre « 11. »/« 12. », date, référence Moniteur, et pour le blanchiment
  la mention « Modifiant la Loi du 18 février 2001… »). **Les écarter du corps** mais
  **reverser leurs références dans la note de tête** (leçon IR 2005 : une coupe de
  front matter doit toujours reverser ses références d'autorité).
- Le blanchiment vise « la Loi du **18 février** 2001 » ; la Loi UCREF vise « la Loi
  du **21 février** 2001 » et l'Index du Moniteur enregistre deux publications (5 avril
  et 3 décembre 2001). Divergence à consigner en réserve, sans trancher.

## 6. Index — déjà construits

`scripts/data/loi-blanchiment-2013/build_index.py` → `_index.json` (**150 sujets**,
88/88) et `scripts/data/loi-corruption-2014/build_index.py` → `_index.json`
(**81 sujets**, 41/41). Rédigés après lecture intégrale de chaque article ; les
assertions (renvoi mort, couverture) sont dans les scripts. À l'import, joindre le
JSON et re-vérifier la couverture contre les ancres réellement produites.

## 7. Placement de la loi sur la corruption — arbitrage requis

Trois options, à soumettre à la cliente :

1. **Banques & institutions financières** (`droit-bancaire`) — cohérent avec le
   blanchiment, mais la corruption n'est pas une matière bancaire ;
2. **Droit pénal → Droit pénal général** (`penal-general`) — la loi crée des
   infractions et **modifie cinq articles du Code pénal** (137, 138, 139, 140, 144) ;
3. **les deux** (copie, règle « déplacer = copier »).

**Recommandation : option 3** — principal en `penal-general` (nature pénale du
texte, modification du Code pénal), copie en `droit-bancaire` (voisinage immédiat du
blanchiment). Le blanchiment, lui, est sans ambiguïté en `droit-bancaire`, avec une
copie possible en `penal-general` pour les mêmes raisons.

## 8. Renvois croisés

1. **Inline** « article N » : ajouter les deux sources à `ART_REFS_SOURCES` et
   `HIDE_INLINE_INDEX_SOURCES`. Vérifier que les renvois externes restent en texte —
   « article 323 du Code pénal » (blanchiment art. 45), « articles 895 et suivants du
   Code de Procédure Civile » (art. 69), « articles 24 à 27 de la Constitution »
   (art. 82.2), « articles 91 à 94 de la loi fixant les règles générales relatives
   aux marchés publics » (corruption art. 5.12), « article 254 / 249 du Code Pénal »
   (corruption art. 18) — le garde élargi aux codes couvre ces cas depuis le Décret
   IMF ; **tester les cinq**.
2. **Textes cités** (`crossRefs.docs`) — vérifiés en base :
   - blanchiment : Code pénal (`cmrhdnzvm0000ywp2v4amq505`) ; **Loi UCREF 2017**
     (`cms5hgrnl0000h5t2ihfy2d37`) — l'UCREF est l'autorité centrale du dispositif,
     citée dans ~15 articles ;
   - corruption : Code pénal (les 5 articles modifiés) ; **loi sur le blanchiment**
     (renvois exprès des art. 5.3 et 19) → lien vers le document importé au même
     passage.
3. **Liens RÉCIPROQUES à poser dans le même passage** (patron UCREF → IMF) :
   - la table des textes cités de la **Loi UCREF** et du **Décret IMF** mentionne la
     loi de 2013 comme absente : y ajouter le lien une fois importée ;
   - la loi sur la corruption et celle sur le blanchiment se citent mutuellement.

## 9. Livrables

```
scripts/data/loi-blanchiment-2013/{parse_bl.py,bodyOriginal.txt,annotations.json,_index.json,build_index.py}
scripts/data/loi-corruption-2014/{parse_cor.py,bodyOriginal.txt,annotations.json,_index.json,build_index.py}
scripts/_import-lois-lbc-corruption.ts     # import des deux + liens réciproques
docs/livraison-lois-blanchiment-corruption.md
```

## 10. Vérifications bloquantes

1. **Parseurs** : blanchiment 24 en-têtes / 88 ancres (1-86 + 82.1 + 82.2) ;
   corruption 9 en-têtes / 41 ancres (1-26 + 5.1-5.14 + 22.1) ; zéro doublon
   d'ancre ; sentinelles verbatim (dont l'article 61 tronqué, le Chapitre IV de
   188 caractères, les deux « Chapitre V », l'article 40 lettré g/h/i) ; front
   matter écarté mais reversé en note.
2. **Index** : 150 et 81 sujets, 0 renvoi mort, couverture intégrale.
3. **Import** : segmentation N/N, `crossRefs`/`connexe` sur ancres existantes, liens
   résolus, thèmes conformes au §7.
4. **Rendu** : chaque article → unités `parseOfficialText`, **aucune ligne perdue** ;
   les énumérations `a)`, `1)`, `i.` rendues en listes.
5. **Réciprocité** : UCREF et IMF pointent vers la loi de 2013 ; les deux nouvelles
   lois se citent mutuellement.
6. `typecheck` · `lint` · `test` · `build` verts.

## 11. Contre-audit

Trois lentilles : fidélité (ré-extraction indépendante, diff caractère par
caractère) ; index et sommaires contre les fichiers clients avec **sondage de fond
≥ 12 sujets par loi** (lire l'article entier avant de juger le sujet) ; plateforme
et réciprocité. **Si le contre-audit multi-agents est indisponible (limite de
dépense), conduire les trois lentilles dans la boucle principale** — jamais de
livraison sans vérification indépendante du parseur.

## 12. Réserves à consigner

- **Blanchiment non consolidé** : loi modificative du 28 septembre 2016 (Moniteur du
  13 octobre 2016) non intégrée — acquisition prioritaire.
- **Article 61 tronqué** dans la source (énumération absente) — non arbitrable sans
  le fac-similé du Moniteur n° 212.
- **Renvoi mort de l'article 9** de la loi sur la corruption (« article 32 »).
- **Aucun fac-similé** fourni pour l'une ou l'autre loi.
- Divergence sur la date de la loi de 2001 visée (18 vs 21 février).
- Les deux sommaires fournis sont des **reconstitutions éditoriales** ; celui de la
  corruption est le document maître (il couvre les deux lois) et renvoie à une
  « Note de reconstitution et d'audit » (p. 39 du recueil) **non fournie** — à
  demander à la cliente, elle documente probablement les anomalies du §4.
