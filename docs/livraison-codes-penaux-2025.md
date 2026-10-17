# Livraison — Code pénal et Code de procédure pénale révisés (2025)

> Décrets du 24 juin 2025 révisant ceux du 11 mars 2020 portant Code pénal et Code de procédure pénale
> (Le Moniteur, 180ᵉ Année, Spéciaux N° 44 et 44-A, mardi 24 juin 2025). Versés en Législation annotée le
> 17 octobre 2026, sur décision de Me Vaval : « nous devons les téléverser dans législation annotée avant de
> faire les cross reference » (préalable § 0.3 de `docs/prompt-code-fiscal-2026-renvois.md`).

## 1. Ce qui est versé

| | Code pénal | Code de procédure pénale |
| --- | --- | --- |
| Fiche | `cmvca7xta0001hyd6lalpffe9` | `cmvca9r4u0001efbcf2rog8o3` |
| `source` | `CODE_PENAL_2025` | `CODE_PROCEDURE_PENALE_2025` |
| Titre (tel que dans le texte) | Décret révisant celui du 11 mars 2020 portant Code pénal | Décret révisant celui du 11 mars 2020 portant Code de procédure pénale |
| Référence | Décret du 24 juin 2025 révisant celui du 11 mars 2020 portant Code pénal | Décret du 24 juin 2025 révisant celui du 11 mars 2020 portant Code de procédure pénale |
| Thème principal | `penal-general` | `procedure-penale` |
| Articles | 1 035 têtes (1 à 1035, voir § 3) | 1 386 têtes (1 à 1365 + 21 sous-articles) |
| Sommaire | 317 divisions, plages d'articles | 252 divisions, plages d'articles |
| Index | 2 203 sujets, 2 429 renvois | 2 992 sujets, 3 156 renvois |
| Fac-similé | Blob privé (`sourcePdfUrl`), 67,0 Mo | Blob privé, 94,7 Mo |
| Éditions | `LM2025-SP44` : transcription OCR écrite, index remplacé | `LM2025-SP44-A` : idem |

Les deux fiches ont le bouton « Version Word » (généré du texte officiel) et se renvoient l'une à l'autre.

**Pas encore en vigueur.** Le Décret du 24 décembre 2025 (Le Moniteur Spécial N° 5 du 16 février 2026, `LM2026-SP5`)
fixe l'« entrée en vigueur intégrale » des deux codes au **1er janvier 2027**, au terme de trois phases, après les
reports de 2022 (`LM2022-SP18`) et de 2024 (`LM2024-SP32`). D'où : statut **Publié** (jamais « En vigueur »),
`effectiveDate` = 1er janvier 2027 (affichée « Entrée en vigueur : 1er janvier 2027 »), et **aucun `ABROGE`** tiré
des articles d'abrogation (C. pén. art. 1035 : « le Code pénal en vigueur » et une quarantaine de textes ;
C. proc. pén. art. 1365 : la loi du 31 juillet 1835 portant Code d'instruction criminelle, etc.). Le Code pénal de
1835 (`CODE_PENAL_ANNOTE`) et le Code d'instruction criminelle restent tels quels. **Au 1er janvier 2027**, la chaîne
d'abrogation sera à poser.

Renvois (`CrossRef`) : un `MODIFIE` nominatif, non résolu, vers le décret du 11 mars 2020 que chacun révise (le titre
le dit ; le décret de 2020 n'a pas de fiche) ; des `VOIR` vers le fascicule, vers `LM2026-SP5`, vers l'entrée d'Index
`LM2020-SP10` « Décret - Code Pénal » (Code pénal seulement : le Code de procédure pénale de 2020 n'est pas à l'Index),
et vers l'autre code. Les visas des deux décrets ne sont pas encore reliés.

## 2. La transcription et sa collation

Aucune transcription Word n'existait. Chaque fascicule a été lu deux fois, indépendamment : **Opus 5.5** (image →
texte) et **Tesseract** (`fra`), par `scripts/ocr-combine-pdf.ts` (même chaîne que le Code fiscal 2026). Les deux
lectures ont été comparées mot à mot, page par page (`scripts/data/codes-penaux-2025/collation.py`), et chaque
divergence qui compte a été **tranchée sur l'image** (`planches.py`, `vignette.py`).

| | Code pénal | Code de procédure pénale |
| --- | --- | --- |
| Lieux de divergence | 469 | 540 |
| Fautes de Tesseract (mot déformé, colonne des têtes ou des puces, bruit) | 386 | 379 |
| Leçon d'Opus vérifiée sur l'image | 71 | 141 |
| **Corrections** (`corrections-jo.json`) | **12** | **20** |

Tables complètes : `docs/livraison-codes-penaux-2025/collation-cp.csv` et `collation-cpp.csv`. Les p. 199-200 du Code
de procédure pénale (défaut d'impression, illisibles pour Tesseract) et les pages de signatures ont été relues
intégralement sur l'image.

⚠️ **Leçon : Opus « corrige » le Journal officiel.** Les 32 corrections vont toutes dans le même sens : rétablir ce
que le J.O. imprime, là où Opus avait normalisé. Il a ajouté un mot (« fixées par le tribunal, *à* l'indemnisation »),
remplacé des coquilles par la bonne leçon (« par le par que tout » → « par le parquet ou », « leur mises ou scellés »
→ « leur mise sous scellés », « le pourvoi » → « le pouvoir », « la loi martiale » → « martial »), et surtout accentué
ce que le J.O. n'accentue pas (« A l'issue », « Etat », « entrainer », « connaitre »). Le J.O. faisant foi à la lettre,
ces coquilles sont **reproduites**. Une lecture par un modèle seul n'aurait pas suffi.

Le J.O. alterne « État » et « Etat » dans une même page : seule l'image tranche, occurrence par occurrence (l'art. 840 C. pén.
porte « l'État », « dudit État » puis « par un Etat » ; l'art. 955 C. proc. pén., « un Etat livre à un autre État »). La p. 76 du Code de procédure pénale imprime « connaitre » puis
« connaître » dans deux alinéas jumeaux : la correction vise la 1re occurrence (`occurrence` dans `corrections-jo.json`).

Normalisations de mise en forme, sans effet sur la lettre : le titre courant de chaque page est coupé ; un paragraphe
coupé par un saut de page est recollé (69 et 122 recollages, tous listés dans `rapport.txt`) ; l'apostrophe est « ’ »,
celle que le J.O. imprime ; l'intervalle entre « Article N.- » et le texte est une espace ; le titre du décret, sur deux
lignes, tient sur une ligne.

## 3. Irrégularités du J.O., reproduites

- **Code pénal — deux « Article 562 », aucun 563.** Le second (« Les personnes morales peuvent être déclarées
  pénalement responsables… ») est l'article 563 du Code de 2020. Ancre `art-562-2`, affiché « 562 (2ᵉ) » dans l'index.
  Note à la division.
- **Code pénal — pas d'article 698.** L'alinéa « Le fait, par un agent de l'administration pénitentiaire, de recevoir ou
  retenir une personne… », imprimé à la suite de l'art. 697, est l'article 698 du Code de 2020. Note à la division.
- **Code pénal — « Article 704- » et « Article 752- »**, sans point : reproduits.
- **Sous-articles composés** : C. pén. 649.1 ; C. proc. pén. 30-1 à 30-4, 305-1, 513.1, 751.1 à 751.9, 818-1, 1006-1,
  1128.1 à 1128.4 (le titre de l'habeas corpus). Chacun a son ancre (`art-30-1`, `art-1128-1`…).

Le témoin de 2020 est le Décret du 11 mars 2020 portant Code pénal (Dropbox `Moniteur/Code_Penal_2020.docx`).

## 4. L'index, éditorial

Aucune cliente n'a fourni d'index. Celui-ci est **proposé par Opus 5.5 article par article** (`indexer.ts`), puis
**filtré** par `parse.py` : une entrée vise un article de son lot, et chaque mot de sa vedette se lit dans l'article ou
dans l'intitulé de sa division. Rejetées : 56 (C. pén.) et 101 (C. proc. pén.), listées dans `index-rejets.txt`. Les
réponses brutes sont versionnées (`index-ia.jsonl`) : l'index se reconstruit sans l'API. Couverture : 1 024 articles sur
1 035 et 1 362 sur 1 386. Il se dit éditorial dans le résumé de chaque fiche.

**À valider** : `docs/livraison-codes-penaux-2025/index-a-valider-cp.csv` et `index-a-valider-cpp.csv` (colonne
« décision » : vide = garder, « RETIRER », ou une nouvelle formulation).

## 5. Questions à Me Vaval

1. **Notes « sic »** : faut-il signaler en note, comme les deux irrégularités du Code pénal, les coquilles de sens du
   Code de procédure pénale : « mise en mouvement par le par que tout en citant » (art. 160), « leur mises ou scellés »
   (art. 120), « le pourvoi, sous peine de nullité » (art. 840, où le sens appelle « le pouvoir ») ? Par défaut : non, comme au Code fiscal
   (« inhalationautres »).
2. **Index** : validation des deux CSV.
3. ~~**Titres créoles**~~ : réglé le 17 oct. — dicté par Me Vaval : « Dekrè ki revize Dekrè 11 mas 2020 sou Kòd Penal
   la » ; le Code de procédure pénale suit : « Dekrè ki revize Dekrè 11 mas 2020 sou Kòd Pwosedi Penal la »
   (`scripts/corriger-titres-creoles-codes-penaux-2025.ts`).
4. **Visa 10 du Code fiscal** : le `CITE` peut désormais être re-ciblé vers le Code pénal révisé (chantier des renvois).

## 6. Contrôles

`scripts/_import-codes-penaux-2025.ts` à blanc puis `--commit` : bornes du corps et 20 signataires chacun, têtes,
irrégularités, corrections présentes, segmentation complète (574/574, 483/483), sommaire sans ancre morte ni page, index
sans lien mort ; recompte après écriture. `src/components/AnnotatedTextCodesPenaux2025.test.tsx` (10 tests) rend les deux
fiches depuis les données versées. Suite complète : 1 731 tests verts ; typage et lint propres. Recherche plein-texte :
« habeas corpus », « garde à vue avocat », « légitime défense » trouvent les nouvelles fiches.

**Non fait** : contrôle visuel des fiches connectées en fr/en/ht (la page exige une connexion, que je ne fais pas à votre
place).
