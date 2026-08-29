# Corpus des marchés publics — pièces sécurisées (§ 8.1 à 8.3)

Ce dossier rend durables les pièces du corpus des marchés publics, jusqu’ici dans un
répertoire de séance **volatile**. Tout ce qui suit lit le dépôt, jamais le scratchpad.

## Ce qu’il contient

| Chemin | Rôle |
|---|---|
| `piece-NN-*.txt` | Les **24 pièces retenues** — 24 textes du corpus + la loi-mère et sa table des matières. Ré-extractions des `.docx` d’origine de `~/Downloads/` avec l’extracteur canonique de la maison (tabulations `<w:tab/>` et runs barrés préservés). |
| `ecartees/ecartee-[a-f]-*.txt` | Les **six écartés** du § 4.1-4.2 — pièces de contrôle, **jamais versées, jamais fusionnées**. |
| `hors-liste/` | Une **trouvaille** : un `.docx` absent des 28 du § 4, transcription rivale du texte n° 18. **Non arbitrée** — question ouverte à Me Vaval. |
| `divergences/` | La preuve d’une divergence mesurée entre l’extraction de séance et la ré-extraction (voir le manifeste, § 4). |
| `decoupe/texte-NN-*.txt` | Les **cinq segments** issus de la découpe des trois fascicules multi-actes (§ 8.3). |
| `manifeste-empreintes.json` / `.md` | Le **manifeste** : md5 des `.docx` d’origine ET des extractions, étiquetés séparément ; comptes de têtes ; typographie mesurée par corps ; notes d’éditeur repérées. |
| `table-decoupe.json` / `.md` | La **table de découpe** : la règle appliquée, les frontières mesurées, l’identification de chaque acte, et les contrôles. |
| `releve-identification.json`, `releve-graphe.json`, `releve-base.json`, `avenant-loi-mere-2009.md` | Les relevés de séance, copiés tels quels. |

Le script de création du thème est `scripts/prepare-theme-marches-publics.ts`
(simulation par défaut ; `--apply` par Me Vaval seule).

## Les trois choses à savoir avant de s’en servir

1. **Les `piece-*.txt` ne sont pas les copies des `.txt` de séance : ce sont des
   ré-extractions.** Une seule pièce en diffère par son contenu —
   `piece-14` (Spécial n° 35 de 2017) : le `.docx` porte **188 éléments `<w:tab/>`** que
   l’extraction de séance avait perdus. C’est le bug `<w:tab/>` connu de la maison, et
   c’est la seule pièce du lot concernée. Les vingt autres divergences ne portent que sur
   des paragraphes vides.
2. **`ecartee-f` a le même md5 que la pièce retenue `piece-19-20`** — doublon à l’octet du
   Spécial n° 8. Il s’exclut **par son nom**, jamais par son md5 (§ 11.2).
3. **La découpe se fait sur l’en-tête de l’acte, jamais sur le bloc « Donné »** — l’annexe
   sanctionnée est transcrite APRÈS le « Donné » de son arrêté-chapeau. Voir
   `table-decoupe.md`.

## ⚠️ Deux jeux coexistent dans ce dossier — à arbitrer avant l’étape 8.4

Une **autre session** a travaillé ici en parallèle le 27 août 2026 à partir de 23 h 22 et y a
déposé sa propre série : `prep-sources/txt-NN-*.txt` (les extractions de séance copiées
telles quelles), `prep-NN-*-corps.txt` + `prep-NN-*.json` (son découpage et son appareil),
`prep-controles.json`, `releves/`, ses scripts `prep_*.py` / `graphe-construire.py`, et des
copies des écartés sous leurs noms de séance dans `ecartees/`. **Rien de tout cela n’a été
touché.** Trois écarts ont été MESURÉS entre les deux jeux ; ce sont des points à trancher,
pas des fautes constatées :

1. **Les tabulations du Spécial n° 35.** `prep-sources/txt-14-arr-alleges-fournitures-2017.txt`
   (114 941 octets) est la copie de l’extraction de séance : elle a perdu les 188 `<w:tab/>`
   du `.docx`. La ré-extraction `piece-14-arrete-2017-08-30-allege-fournitures.txt`
   (115 169 octets) les porte. Une seule des deux est fidèle au `.docx` d’origine.
2. **Le périmètre des segments découpés.** Les segments `decoupe/texte-NN-*.txt` s’arrêtent à
   l’acte : ils excluent le bandeau de fascicule, le sommaire et le colophon, qui sont
   matière de fascicule et non d’acte. Les `prep-NN-*-corps.txt` les incluent — et, pour le
   Spécial 52, chacun des deux documents reprend le sommaire annonçant **l’autre** acte
   ainsi que le colophon.
3. **Les intitulés de division.** Au J.O., le numéro de division et son intitulé occupent
   **deux paragraphes distincts** (`piece-19-20`, l. 125 « CHAPITRE II » / l. 126 son
   intitulé ; l. 127 « Section 1re » / l. 128 « Composition »). Les `prep-NN-*-corps.txt`
   les **joignent en une seule ligne** séparée d’un tiret cadratin
   (« CHAPITRE II — COMPOSITION… », « Section 1re — Composition »). Utile comme libellé de
   `toc` ; à décider s’il en va de même du CORPS, que la règle de la maison veut verbatim.

Tant que l’arbitrage n’est pas fait, `ecartees/` compte douze fichiers pour six écartés — la
vérification bloquante n° 2 du § 11 doit donc porter sur les six `ecartee-[a-f]-*.txt` nommés
au manifeste, pas sur le contenu du répertoire.
