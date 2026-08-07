# Code d'instruction criminelle — livraison

**En ligne** : `cmsiblo5n000181wacroipmcn` · `type=LEGISLATION` · `source=CODE_INSTRUCTION_CRIMINELLE`
· statut `EN_VIGUEUR` · thème **« Droit pénal → Procédure pénale »** — la branche sœur de celle
du Code pénal, créée et jusqu'ici vide.

| | |
|---|---|
| corps | 946 lignes · 189 552 caractères |
| articles ancrés | **462** (numérotés 1 à 472) |
| divisions | **67 / 67** appariées au corps · menu à 10 racines, **0 ancre morte** |
| index | **558 entrées · 1 224 renvois · 0 mort** |
| lois intercalées | 2, **25 blocs muets**, zéro ancre en double |

Les dix numéros absents — 109 à 111 et 202 à 208 — sont supprimés par la loi du 12 juillet 1920.
Le corps le déclare lui-même, et l'index le confirme en n'en citant aucun.

## Les deux pièges, et ce qui a été fait

**Les lois intercalées.** La loi du 20 juillet 1929 (son seul article 2) et celle du 26 juillet
1979 sur l'appel pénal (articles 1 à 24) sont insérées **au milieu** du corps, avec une
numérotation qui repart. Le réflexe — les marquer `kind: 'connexe'` — est un piège mesuré :
`inAnnexe` est un verrou à sens unique, et les marquer ferait perdre son ancre à **159 articles du
Code, du 314 au 472**. Elles restent donc en `kind: 'code'` : le déduplicateur pose `noAnchors` sur
les 25 répétitions, et le Code garde ses 462 ancres.

*(Défaut d'invariant corrigé en route : `segmentAnnotated` ne retire pas l'ancre d'une répétition,
il pose `noAnchors`. Mon premier contrôle comptait donc 24 faux doublons.)*

**Les libellés de la table.** 45 des 67 joignent deux ou trois lignes du corps par un tiret ; mis
tels quels en `toc.label`, **aucune** division ne s'apparie. La table porte donc la ligne du corps,
le menu latéral le libellé composé.

**Le menu ne suit pas l'indentation.** Les SECTIONS I-III qui suivent le TITRE IV de la loi de
1979 appartiennent au Code, non à cette loi : le constructeur mémorise la branche du Code à
l'entrée d'une annexe et la restaure à sa sortie. Sans quoi elles remontaient en racines au lieu
de revenir sous la LOI Nº 5, chapitre Ier.

## Les renvois du corpus vers ce code

Le sigle n'a que **deux graphies** dans les 29 227 documents : « C. i. c. » (26 renvois du Code
civil) et « C.I.C. » (3 du Code de procédure civile et de son appendice). Le Code pénal, lui, ne le
cite jamais.

La clé `cic` est ajoutée à `src/lib/doc/coderefs.ts`, avec `CIC_MISSING_ARTICLES` : le Code civil
cite « C. i. c., 108, **110** » et l'article 110 n'existe pas — sans cette liste, ce serait un lien
mort. Vérifié au rendu : 108 devient un lien, 110 reste en texte.

Trois sentinelles, chacune payée par un faux positif mesuré : le lookbehind (sans lui,
« celui-**ci. C**. civ., 1767 » vole au Code civil son propre renvoi), le point final obligatoire
(sinon entrent la société « CIC », « **Cic**éron » et les codes pays des circulaires — 33 faux
positifs), et la négation du troisième terme. Éprouvées par `src/lib/doc/coderefs-cic.test.ts`.

`doc/[id]/page.tsx` résout désormais les codes cités par une table explicite : le Code civil cite
les trois autres, le Code de procédure civile et son appendice citent celui-ci, et réciproquement.

## Limite connue

`segmentCodeRefs` n'attache pas un numéro qui **précède** le sigle sans le mot « article » :
« …et 443 C.I.C. que… » donne le lien vers le code, pas vers son article 443. Comportement
antérieur, commun aux trois codes ; une occurrence concernée.

## Restent ouverts

- **69 renvois de l'index visent les articles des lois intercalées**, sur des numéros qui existent
  tous aussi dans le Code. Le constructeur les **écarte** — le contexte de loi se réinitialise au
  point-virgule — plutôt que d'envoyer le lecteur au mauvais article. Ils n'ont donc pas de lien.
- La **note orpheline** du ¶197 (« Les articles 109, 110, 111 ont été supprimés… ») reste au corps,
  sur décision de la cliente : placée entre un en-tête de chapitre et l'article 112, elle ne se
  rattache à aucun article et le pliable ne peut pas la recevoir.

Scripts : `scripts/data/code-instruction-criminelle/build_cic.py` (extraction et construction) et
`scripts/import-code-instruction-criminelle.ts` (simulation par défaut, `--apply`, `--voir=N`).
