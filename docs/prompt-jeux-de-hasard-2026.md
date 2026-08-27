# Prompt — Verser le corpus des jeux de hasard et d'argent (2026), sommaires et index

## Ce qui est demandé

Verser en **Législation annotée** les trois décrets du **11 août 2026** sur les jeux de
hasard et d'argent, avec leurs sommaires et leurs index de mots-clés.

Huit fichiers dans `~/Downloads/` :

| Décret | Texte | Sommaire | Index |
| --- | --- | --- | --- |
| **Spécial 43** — ANJHA | `Le_Moniteur_Special_No_43_21_aout_2026_ANJHA.docx` | `Sommaire_Decret_ANJHA_11_aout_2026.docx` | `Index_Mots_Cles_Decret_ANJHA.docx` |
| **Spécial 43-A** — réglementation | `Le_Moniteur_Special_43-A_Decret_Jeux_de_Hasard.docx` | `Sommaire_Decret_Jeux_de_Hasard_43-A.docx` | `Index_Mots-Cles_Decret_Jeux_de_Hasard_43-A.docx` |
| **Spécial 43-B** — imposition | `Le_Moniteur_Special_43-B_21_aout_2026.docx` | `Sommaire_Decret_11_aout_2026_Jeux_de_hasard.docx` | ⚠️ **AUCUN** |

> ⚠️ **HUIT FICHIERS, PAS NEUF : le décret 43-B n'a pas d'index.** Ce n'est pas un oubli de
> lecture — il n'y en a pas dans la livraison. Le signaler à la rédaction ; ne pas en
> fabriquer un d'office.

---

## §1 — L'état des lieux, mesuré

| | Spécial 43 | Spécial 43-A | Spécial 43-B |
| --- | --- | --- | --- |
| Objet | Création, organisation et fonctionnement de l'**ANJHA** | **Réglementation** des jeux de hasard et d'argent | **Régime d'imposition** applicable à ces jeux |
| **Articles** | **33** | **75** | **23** |
| dont entiers | 25 (1ᵉʳ → 25, sans trou) | 69 (1ᵉʳ → 69, sans trou) | 14 (1ᵉʳ → 14, sans trou) |
| dont décimaux | 8 | 6 | 9 |
| Doublons | aucun | aucun | aucun |
| Divisions | 6 CHAPITRE · 4 SECTION | 12 CHAPITRE · 6 SECTION | **aucune** |
| Visas | 15 | 18 | 13 |
| Lignes / caractères | 302 · 22 704 | 362 · 29 840 | 180 · 13 584 |

**131 articles au total.** Une seule convention de numérotation — entiers et décimaux
(`6.1`, `16.2`, `47.1`…), **aucun article à tiret**. Rien de comparable au piège du décret
sur l'Administration Centrale.

---

## §2 — ⚠️ LES TROIS SONT DÉJÀ EN BASE, EN ÉDITIONS LE MONITEUR

Versés le 26 août comme **fascicules** : `LM2026-SP43`, `LM2026-SP43-A`, `LM2026-SP43-B`.
Chacun porte son fac-similé sur Blob et sa transcription affichée.

> ⚠️ **CE N'EST PAS UN DOUBLON, ET IL NE FAUT PAS LES CONFONDRE.** Une fiche d'Éditions est
> un **fascicule du journal officiel** — son fac-similé fait foi. Une fiche de Législation
> annotée est un **texte de loi** — articles, sommaire, index, renvois. Le même décret vit
> légitimement dans les deux, comme le Code des Douanes vit en Législation et en Doctrine.

⚠️ **ET LA VERSION DE LÉGISLATION SERA MEILLEURE.** Le scanner du fascicule (Hewlett-Packard)
rend « D£CRET £TABLISSANT LE R£GIME D'IMPOSITION » : une recherche « décret » ne trouve
**aucun** des trois en Éditions. Les `.docx` fournis sont propres. Poser un renvoi entre les
deux fiches, et ne PAS remplacer la transcription du fascicule par le texte propre : le
fac-similé et sa transcription doivent rester ce qu'ils sont.

---

## §3 — Dates : signature le 11 août, parution le 21

Les trois décrets sont **donnés au Palais National le 11 août 2026, An 223ᵉ de
l'Indépendance**, et publiés au Moniteur du **vendredi 21 août 2026**. Dix jours d'écart.

| Champ | Valeur |
| --- | --- |
| Titre | « Décret du **11 août 2026** … » |
| `publicationDate` | **2026-08-21** |
| `moniteurRef` | Le Moniteur, 181ᵉ Année – Spécial N° 43[-A/-B], vendredi 21 août 2026 |

⚠️ Le millésime `181e Année` est cohérent : 2026 − 1845 = 181.

---

## §4 — ⚠️ TROIS SOMMAIRES, TROIS FORMATS

Un seul analyseur ne les lira pas.

**Spécial 43 — liste hiérarchique**, comme le décret de 2005 : intitulé, tabulation, plage.
```
CHAPITRE II — Dispositions organiques        Art. 5 à 21
Section III — Direction Générale             Art. 7 à 18.1
```
Il compte aussi ses visas et considérants (`Visas (15)`, `Considérants (6)`).

**Spécial 43-A — TABLEAU à trois colonnes** : `Division | Intitulé | Articles`, la plage
écrite « 1er – 4 » (tiret demi-cadratin, pas « à »).

**Spécial 43-B — SOMMAIRE ANALYTIQUE, article par article** : `Article | Objet`. Ce n'est
pas un sommaire de divisions — le décret n'en a aucune. Chaque ligne résume un article :
« Article 2 — Frais d'étude de dossier non-remboursables de 50.000 Gourdes… ».

> ⚠️ Le sommaire de 43-B est donc plus proche d'un **index analytique** que d'une table des
> matières. Décider s'il alimente le sommaire (`toc`) ou une colonne « objet » par article.

---

## §5 — Les index

**Deux index, en tableau à deux colonnes** (`Mot-clé | Références`), avec lettres-vedettes.

⚠️ **LES RENVOIS DESCENDENT SOUS L'ARTICLE.** L'index de l'ANJHA écrit `Art. 4, 9°` et
`Art. 17, 3°` — l'article ET le point de l'énumération. Un analyseur qui ne lit que le
numéro d'article perdra cette précision ; une ancre qui ne descend pas au point la rendra
inutilisable. Décider : ancrer à l'article et afficher le point en texte, ou créer des
ancres de point.

⚠️ Les deux index renvoient aussi au **« Préambule »** et au **« Visa »** — qui ne sont pas
des articles. Prévoir une ancre pour le préambule, sinon ces renvois sont morts.

---

## §6 — Les visas : douze textes cités, dont NEUF déjà dans le corpus

C'est ce qui rend les renvois croisés possibles. Vérifié en base le 26 août :

| Texte visé | En base |
| --- | --- |
| Code pénal | ✔ `CODE_PENAL_ANNOTE` |
| Code d'instruction criminelle | ✔ `CODE_INSTRUCTION_CRIMINELLE` |
| Décret du 17 mai 2005, Administration Centrale, **amendé par celui du 6 janvier 2016** | ⏳ **objet de l'autre prompt** |
| Décret du 6 janvier 2016, administration électronique | ✔ `DECRET_ADMINISTRATION_ELECTRONIQUE_2016` |
| Loi du 14 février 2017, signature électronique | ✔ `LOI_SIGNATURE_ELECTRONIQUE_2017` |
| Loi du 17 août 1979 créant la BRH | ✔ `CC_VANDAL_II-B-1` |
| Décret du 30 avril 2023, blanchiment | ✔ `DECRET_BLANCHIMENT_2023` |
| Décret du 29 septembre 2005, impôt sur le revenu | ✔ `DECRET_IMPOT_REVENU_2005` |
| Décret du 23 novembre 2005, CSCCA | ✔ (appendice du CPC) |
| Loi organique du 21 mars 1958, Loterie de l'État | ✗ absent |
| Décret du 20 octobre 1960, casinos | ✗ absent |
| Loi du 10 juin 2009, marchés publics · Loi du 4 mai 2016, lois de finances | ✗ absents |

> ⚠️ **LE VISA DU DÉCRET DE 2005 DIT « AMENDÉ PAR CELUI DU 6 JANVIER 2016 ».** Les trois
> décrets de 2026 confirment donc, de leur propre autorité, l'amendement que l'autre prompt
> doit verser. Les deux chantiers se répondent : verser celui-ci d'abord laisse un renvoi en
> attente, ce qui est acceptable — l'anti-lien-mort ne relie que ce qui existe.

⚠️ **LA LOTERIE DE L'ÉTAT (1958) ET LES CASINOS (1960) SONT VISÉS MAIS ABSENTS DU CORPUS.**
Ce sont les textes que la réforme de 2026 remplace en fait. Les signaler à la rédaction
comme lacune à combler ; ne pas inventer de fiche.

---

## §7 — Abrogations : aucune n'est nommée

Les trois décrets se terminent par la **même clause balai** :

> « … abroge toutes Lois ou dispositions de Lois, tous Décrets-Lois ou dispositions de
> Décrets-Lois, tous Décrets ou dispositions de Décrets qui lui sont contraires… »

> ⚠️ **UNE CLAUSE BALAI N'ABROGE AUCUN ARTICLE EN PARTICULIER.** Elle se cite dans la note
> d'édition ; elle ne produit **aucun** statut « Abrogé », **aucune** `ArticleVersion`,
> **aucun** `CrossRef` de type `ABROGE`. Le `kind` d'un renvoi affirme quelque chose : tout
> renvoi issu d'un visa est `CITE`.

Ces trois décrets sont des textes **neufs** : ils n'amendent rien. La règle du corpus — la
version en vigueur s'affiche, l'ancienne se replie — n'a donc rien à produire ici. Elle
vaudra le jour où ils seront amendés à leur tour.

---

## §8 — Ce qu'il faut écrire

| Champ | 43 | 43-A | 43-B |
| --- | --- | --- | --- |
| `source` | `DECRET_ANJHA_2026` | `DECRET_JEUX_HASARD_2026` | `DECRET_JEUX_HASARD_IMPOSITION_2026` |
| `number` | **le titre complet** (§9) | idem | idem |
| `publicationDate` | 2026-08-21 | 2026-08-21 | 2026-08-21 |
| `status` | `EN_VIGUEUR` | `EN_VIGUEUR` | `EN_VIGUEUR` |

### ⚠️ §9 — La référence est le TITRE COMPLET

Règle de corpus du 26 août : `number` = `titleFr`, en entier.

```
Décret du 11 août 2026 portant création, organisation et fonctionnement de
l'Autorité Nationale des Jeux de Hasard et d'Argent (ANJHA)

Décret du 11 août 2026 portant réglementation des jeux de hasard et d'argent

Décret du 11 août 2026 établissant le régime d'imposition applicable aux jeux
de hasard et d'argent
```

⚠️ **Sans cela, les trois se présenteraient sous « Décret du 11 août 2026 »** — exactement
le défaut qui a fait partager une même référence à trois réformes du 9 avril 2020 et à onze
conventions internationales, corrigé le 26 août sur 110 textes.

---

## §10 — Thèmes : il n'y en a aucun pour les jeux

Vérifié : ni « jeux », ni « hasard », ni « loterie » n'existent dans la taxonomie.

Racines disponibles : `Droit économique & des affaires`, `Droit fiscal & douanier`,
`Droit public & administratif`, `Social`.

**Proposition** — un thème « Jeux de hasard et d'argent » sous `Droit économique & des
affaires`, où vivent déjà `Fiscalité` (29 textes) et les activités réglementées ; le décret
d'imposition (43-B) portant EN PLUS `Droit fiscal & douanier › Fiscalité / impôts (DGI)`
(18 textes). **À valider par la rédaction avant création** : un thème se crée par son
libellé, et l'arbre est une frontière éditoriale.

---

## §11 — Le lecteur annoté

Inscrire les trois sources dans `HIDE_INLINE_INDEX_SOURCES` et `ART_REFS_SOURCES`
(`src/app/[locale]/(app)/doc/[id]/page.tsx`) : index au panneau latéral, renvois « l'article
N » cliquables.

Les trois se renvoient l'un à l'autre par le sujet plus que par la lettre — le 43 est cité
45 fois sous « ANJHA » dans son propre texte, et le 43-B mentionne l'« Autorité Nationale »
une fois. **Poser les `CrossRef` réciproques entre les trois** : ils forment un ensemble,
et un lecteur du régime d'imposition doit atteindre l'autorité qui délivre les licences.

---

## §12 — Contrôles avant de déclarer le travail fini

1. **33 + 75 + 23 = 131 articles** en base, dont **23 décimaux** — recompter par forme.
2. Aucun trou : 1ᵉʳ → 25, 1ᵉʳ → 69, 1ᵉʳ → 14.
3. Les trois sommaires rendent leurs divisions — **et celui de 43-B, qui n'en a pas**.
4. Les renvois d'index `Art. 4, 9°` atteignent au moins l'article ; aucun lien mort.
5. Les renvois « Préambule » et « Visa » atteignent une ancre réelle.
6. Les trois références sont **distinctes** et portent le titre complet.
7. Un renvoi relie chaque texte à son **fascicule** en Éditions Le Moniteur.
8. **Aucun** `CrossRef` de type `ABROGE` : les clauses sont des balais (§7).
9. La transcription des trois fascicules en Éditions est **inchangée**.
10. `npm test` vert, et le contrôle visuel fait sur les trois fiches.

---

## §13 — Ce que ce prompt ne tranche pas

1. **Le thème** — création de « Jeux de hasard et d'argent » et son rattachement (§10).
2. **Le sommaire analytique de 43-B** — table des matières ou colonne « objet » (§4).
3. **Les renvois d'index au point d'énumération** — ancre d'article ou ancre de point (§5).
4. **L'index manquant du 43-B** — en commander un, ou verser le décret sans (§ en-tête).
5. **Les deux textes fondateurs absents** — Loterie de l'État (1958), casinos (1960) : à
   verser pour que les visas cessent d'être des renvois morts (§6).
