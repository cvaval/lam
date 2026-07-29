# Prompt d'exécution — Loi UCREF (2017)

> Spécification d'autorité, écrite APRÈS analyse des trois fichiers : tous les
> chiffres sont mesurés. Toute divergence à l'exécution est un défaut à investiguer.

## 1. Objet

**Loi portant organisation et fonctionnement de l'Unité Centrale de Renseignements
Financiers (UCREF)** — votée par la Chambre des Députés le **4 mai 2017**, par le
Sénat le **8 mai 2017**, promulguée le **12 mai 2017**, publiée au **Moniteur,
172ᵉ Année, Spécial N° 16 du jeudi 25 mai 2017**.

- **Emplacement** : Législation annotée → Droit économique & des affaires →
  **Banques & institutions financières** (`droit-bancaire`, 23ᵉ document) —
  l'UCREF est la cellule de renseignement financier (LBC/FT), citée au préambule du
  Décret IMF 2020 et mentionnée dans le corps de la Loi banques 2012 (art. 179) et
  du Code des douanes.
- `source = LOI_UCREF_2017` · type `LEGISLATION` · statut `EN_VIGUEUR`.
- `publicationDate` **2017-05-25** — date confirmée de façon INDÉPENDANTE par
  l'Index du Moniteur déjà en base (entrée du 25 mai 2017, même intitulé).

### Question de date — à trancher explicitement

Trois dates coexistent et les sources divergent :

| Source | Nom employé |
|---|---|
| Sommaire et index fournis | « Loi du **4 mai** 2017 » (vote de la Chambre) |
| Décret IMF 2020, visa (texte officiel en ligne) | « Loi du **8 mai** 2017 » (vote du Sénat) |
| Index du Moniteur (en base) et titre du texte | sans date |

**Décision** : `number = "Loi du 8 mai 2017"` — c'est la citation officielle retenue
par le Décret IMF 2020 et elle suit le précédent de la plateforme (Loi banques 2012 =
date du **second** vote, celui du Sénat). Les quatre dates figurent dans le résumé,
les mots-clés et une note de tête, pour que toute forme de citation soit trouvable.
À signaler à la cliente : ses deux documents portent « 4 mai ».

## 2. Sources fournies

| Fichier (~/Downloads) | Rôle |
|---|---|
| `Loi_UCREF_2017_Le_Moniteur_Special_16.docx` | **texte officiel** — 168 ¶, aucun tableau, aucun passage barré |
| `Sommaire_Loi_UCREF_2017.docx` | **sommaire analytique** — 50 lignes, autorité de structure **et** source de 32 descriptions d'articles |
| `Index_Loi_UCREF_2017.docx` | **index alphabétique** — 116 lignes, autorité de l'index |

⚠️ Les deux derniers portent chacun une note explicite : « sommaire / index
analytique **reconstitué par l'éditeur** ; il ne figure pas dans le texte officiel
publié au Moniteur ». Ce sont donc des apparats éditoriaux, non des pièces du J.O. —
à mentionner dans la note de tête (transparence), comme pour les index Vandal.
**Aucun fac-similé n'a été fourni** pour cette loi : les divergences ne pourront pas
être arbitrées sur le Journal officiel (réserve, cf. §8).

## 3. Structure mesurée

- **32 articles**, numérotés 1 à 32, **sans trou ni doublon** ;
- **10 en-têtes** : 4 CHAPITRES (intitulé sur la ligne suivante → jointure « — ») et
  6 Sections (déjà sur une seule ligne, `Section I.- Du Conseil d'Administration`) ;
- ordre : préambule (titre, 13 visas, considérants, « Le Pouvoir Exécutif a proposé
  et le Pouvoir Législatif a voté la loi suivante : »), CHAPITRE Ier (art. 1-4),
  CHAPITRE II (art. 5-26, six Sections), CHAPITRE III (art. 27-30), CHAPITRE IV
  (art. 31-32), puis **formules d'adoption** (Chambre 4 mai + signatures, Sénat
  8 mai + signatures) et **promulgation** (12 mai, Jovenel Moïse).

## 4. Pièges du docx (tous constatés)

1. **Têtes d'articles COLLÉES** : `Article 1.-Il est créé…` — les 32 têtes.
   Normaliser en `Article 1.- Il est créé…`.
2. **Marqueurs d'énumération COLLÉS** : `a)Un Président désigné…`, `1)…` —
   ~60 occurrences (a→l). Normaliser par une espace après le marqueur.
3. **Colonnes du J.O. aplaties par des TABULATIONS** (97 `<w:tab/>`) : sans
   conversion, on obtient `Jean Willer JEANHermano EXINORD`,
   `Premier SecrétaireDeuxième Secrétaire`, `LIBERTÉÉGALITÉFRATERNITÉ`.
   → remplacer `<w:tab/>` par une espace AVANT d'extraire les `<w:t>` (convention de
   tous les parseurs de la plateforme). Sentinelles obligatoires sur ces trois cas.
4. **`CHAPITRE Ier`** (ordinal romain) : la jointure doit produire
   `CHAPITRE Ier — DE LA DÉNOMINATION - DE LA MISSION ET DU SIÈGE…` ; attention,
   `articleAnchorFromHeading` ne doit pas transformer une ligne `Section I.- …` en
   ancre d'article (elle est consommée comme libellé de sommaire — assertion : ancres
   == exactement les 32 numéros, zéro doublon).
5. Aucun tableau, aucun passage barré : rien à annoter de ce côté.

## 5. Index — 2 apports combinés

**(a) Index alphabétique fourni** (~93 entrées porteuses de renvois, 20 lettres).
Grammaire, à parser en balayage arrière depuis `Art.` :

| Forme | Exemple | Traitement |
|---|---|---|
| simple | `Absences consécutives … Art. 6` | `ctRefs: ["6"]` |
| liste | `Attributions de l'UCREF Art. 2, 3` | 2 renvois |
| sous-item lettré | `Acquisitions et aliénations immobilières Art. 8 f)` | renvoi `8`, lettre reportée dans le libellé « (f) » |
| combiné | `Association Professionnelle des Banques Art. 5 e), 19 e)` | renvois `5` et `19`, libellé « (e) » |

Les lettres ne doivent JAMAIS entrer dans `ctRefs`. Couverture mesurée : **32/32**.

**(b) Descriptions d'articles du sommaire analytique** — 32 lignes du type
« Composition et nomination **Article 5** ». Elles ne peuvent pas devenir des entrées
de sommaire (les libellés du `toc` doivent être des lignes VERBATIM du corps), mais
elles font d'excellentes entrées d'index, une par article. Les ajouter avec un
libellé propre (sans le « Article N » final). Total attendu : **~125 entrées**,
couverture 32/32, zéro renvoi mort.

## 6. Renvois croisés (comme au Code civil) — quatre niveaux

1. **Inline** « article N » : ajouter `LOI_UCREF_2017` à `ART_REFS_SOURCES` ;
   vérifier que « l'article **323 du Code pénal** » (art. 24) reste en texte — le
   garde élargi aux codes couvre ce cas depuis le Décret IMF.
2. **Index latéral + rebonds** : ajouter la source à `HIDE_INLINE_INDEX_SOURCES`.
3. **Textes visés au préambule** (13 visas) → `crossRefs.docs` en tête. Vérifié :
   seuls **trois** sont en ligne — Constitution (`cmr1it23a0000b4r0l6r1xp5l`),
   Code pénal (`cmrhdnzvm0000ywp2v4amq505`), Loi du 17 août 1979 créant la BRH
   (`cmrtiw94r0001ue7edw6au9ca`). Les dix autres (blanchiment 2001 et 2013, drogue
   2001, CSCCA 2005, administration centrale 2005, fonction publique 2005, marchés
   publics 2009, décrets 1984/1985/1987) sont cités sans lien → réserve.
4. **Lien RÉCIPROQUE (à faire dans le même passage)** : le Décret IMF 2020
   (`cms5d6tp200002695mv8c5bdb`) cite la loi UCREF dans sa table des textes cités,
   où elle figurait comme « absente de la plateforme ». Une fois l'UCREF importée,
   **ajouter son lien** dans les `crossRefs.docs` du Décret IMF et retirer la
   mention d'absence. C'est la fermeture de boucle promise à la cliente.

## 7. Livrables

```
scripts/data/loi-ucref-2017/parse_ucref.py        # corps + toc + sentinelles
scripts/data/loi-ucref-2017/parse_ucref_index.py  # index (a) + (b), assertions
scripts/data/loi-ucref-2017/{bodyOriginal.txt,annotations.json,_ucref_index.json}
scripts/_import-loi-ucref.ts                      # import idempotent + lien réciproque IMF
docs/livraison-loi-ucref.md
```
`page.tsx` : `LOI_UCREF_2017` dans les deux ensembles. Mémoire : `project-decret-imf.md`
(réserve « 5 textes manquants » → 4) + nouvelle fiche ou mise à jour bancaire.

## 8. Vérifications bloquantes

1. **Parseur** : 10 en-têtes ; 32 ancres 1→32 sans trou ; zéro doublon ; sentinelles
   verbatim (titre, 1ᵉʳ visa, « Le Pouvoir Exécutif a proposé… », art. 1/24/32,
   « Donnée à la Chambre des Députés, le jeudi 4 mai 2017 », « Donnée au Sénat …
   le lundi 8 mai 2017 », « Donné au Palais National … le 12 mai 2017 »,
   `LIBERTÉ ÉGALITÉ FRATERNITÉ` **décollé**, `Jean Willer JEAN Hermano EXINORD`
   **décollé**) ; aucune note éditoriale dans le corps.
2. **Index** : ~125 entrées, 0 renvoi mort, couverture 32/32, aucune lettre de
   sous-item dans `ctRefs`.
3. **Import** : `segmentAnnotated` → 10 sections, 32 ancres ; `crossRefs`/`connexe`
   sur ancres existantes ; liens résolus ; thème `droit-bancaire` `isPrimary`.
4. **Rendu** : 32 articles → unités `parseOfficialText`, **aucune ligne perdue** ;
   les énumérations `a)` rendues en listes.
5. **Réciprocité** : le Décret IMF pointe désormais vers l'UCREF (lien vérifié).
6. `typecheck` · `lint` · `test` · `build` verts.

## 9. Contre-audit

Trois lentilles (fidélité par ré-extraction indépendante ; index + sommaire contre
les fichiers clients avec sondage de fond ≥ 10 sujets ; plateforme et réciprocité).
Si le contre-audit multi-agents est indisponible (limite de dépense), **conduire les
trois lentilles dans la boucle principale** — ne jamais livrer sans vérification
indépendante du parseur (leçon vague 2 : ne pas relire sa propre sortie).

## 10. Réserves à consigner

- **Aucun fac-similé** fourni : fidélité vérifiable seulement docx ↔ produit ; la
  cliente peut fournir le scan du Spécial N° 16 pour un contrôle complet.
- **Sommaire et index sont des reconstitutions éditoriales** (leurs propres notes le
  disent) — à énoncer dans la note de tête.
- **Dix textes visés absents** du corpus (§6.3) — candidats d'acquisition, dont la
  Loi du 11 novembre 2013 sur le blanchiment, pièce maîtresse du dispositif LBC/FT.
- Divergence de nommage « 4 mai » (documents clients) / « 8 mai » (citation
  officielle retenue) — arbitrage §1.
