# L'en-tête après l'article 15 (TITRE II) : « CHAPITRE II » ou « CHAPITRE III » ? — dossier § 13.2

**Préparé le 27 août 2026 (§ 7.7). AUCUNE écriture n'a été faite ni simulée : la décision
appartient à Me Vaval.** Le dossier apporte toutefois un fait nouveau, vérifié sur les trois
copies du scan, qui renverse la prémisse de la question telle qu'elle avait été posée.

## 1. Le fait nouveau : le fac-similé imprime « CHAPITRE III »

La page imprimée 6 du Moniteur n° 54 est PRÉSENTE au scan (pages 1-11 conservées). Sa
découpe, prise dans **chacune des trois copies** de la numérisation, montre, entre la fin de
l'article 15 et l'article 16, sous le bandeau « No. 54 - Mercredi 10 juillet 2002 » :

```
                    CHAPITRE III
    DE L’AUTORISATION DE FONCTIONNEMENT DES CEC
```

Pièces (dans `maj2026-verif-chapitre-facsimile/`) :

| Copie | Page | Découpe |
|---|---|---|
| PDF autonome (`Moniteur/Loi sur les cooperatives Epargne et credit.pdf`) | PDF 6 = imprimée 6 | `decoupe-autonome-p6-chapitre.png` (pleine page : `autonome-p6-06.png`) |
| `Moniteur/Lois_18_20/2002.pdf` | PDF 649 = imprimée 6 | `decoupe-lois1820-p649-chapitre.png` |
| `Moniteur/Patrick Tardieu/Moniteur 1915-x/2002.pdf` | PDF 649 = imprimée 6 | `decoupe-tardieu-p649-chapitre.png` |

Les trois découpes sont concordantes (autonome et Tardieu sont d'ailleurs le même flux
d'image à l'octet ; Lois_18_20 est une autre numérisation des mêmes planches — voir
`maj2026-facsimile-dossier.md`). **Le J.O. numérisé donne raison à la base.**

## 2. D'où venait la prémisse inverse — et ce qu'elle vaut

La feuille de route (§§ 3.6, 4.1, 7.7, 13.2) et le relevé `maj2026-releve-sommaire-index.json`
énonçaient : « le J.O. (lois_cec.pdf p. 6) porte bien ce second CHAPITRE II — c'est la base
qui a normalisé ». Cette lecture s'appuyait sur **`~/Downloads/lois_cec.pdf`** — la
REPRODUCTION à couche texte, d'autorité **subsidiaire** (« jamais contre le scan », § 2) et
de provenance non qualifiée. Vérifié le 27 août sur sa couche texte, p. 6 : elle imprime
bien « CHAPITRE II / DE L’AUTORISATION DE FONCTIONNEMENT DES CEC » au même endroit — en
divergence avec le scan sur une page où les deux existent. Au même endroit, elle porte à
l'article 18 « L’avis d’autorisation de fonctionnement accordé dans les soixante (60)
jours » là où le scan et la base écrivent « est accordé » : deuxième divergence, même page.

L'autre relevé, `maj2026-releve-confrontation.json`, avait déjà arbitré dans le bon sens
(« après art. 15 : J.O. p.6 = CHAPITRE III (la cliente écrit II — coquille, elle crée un
doublon) ») et compte « CHAPITRE II pour III » parmi les 75 fautes de la transcription
cliente. Les deux relevés se contredisaient ; l'ordre d'autorité du § 2 (scan = arbitrage
suprême sur les pages présentes) résout la contradiction en faveur du scan.

**Conséquence collatérale (§ 13.3)** : `lois_cec.pdf` diverge du scan sur une page présente —
premier élément matériel qui qualifie sa provenance : ce n'est pas une numérisation du même
tirage, mais vraisemblablement une recomposition (ou un autre état du texte). Son autorité
subsidiaire en sort affaiblie partout où elle est seule (pages 12-13 et 16-30) : c'est elle
qui avait « confirmé » le sic « article 146 » de l'art. 144 (§ 13.5).

## 3. L'état des pièces, au complet

| Pièce | Leçon à cet endroit |
|---|---|
| Scan du J.O., p. 6, trois copies (arbitrage suprême) | **CHAPITRE III** |
| Corps en base, l. 74 : « CHAPITRE III — DE L’AUTORISATION DE FONCTIONNEMENT DES CEC » ; `toc` ancre `sec-8`, même libellé | **CHAPITRE III** |
| `lois_cec.pdf` p. 6 (reproduction, subsidiaire) | CHAPITRE II |
| Transcription cliente, l. 102 | CHAPITRE II |
| Sommaire cliente, l. 14 (« CHAPITRE II — DE L'AUTORISATION DE FONCTIONNEMENT DES CEC → Articles 16 à 58 ») | CHAPITRE II |

Séquence des chapitres du TITRE II au corps en base : I (l. 50), II (l. 58), III (l. 74),
V (l. 221) — pas de chapitre IV ; cette absence, elle, est bien un sic conservé. Les autres
anomalies de structure (deux CHAPITRE II au TITRE IV, l. 342 et l. 359) ne sont pas en
cause ici.

## 4. Les deux issues, rédigées — à choisir par Me Vaval (§ 13.2)

### Variante A — écrire « CHAPITRE II » (rendre la leçon de lois_cec.pdf et des pièces clientes)

Elle n'est plus soutenable comme « retour au J.O. » : le scan, arbitre suprême, imprime
CHAPITRE III. Elle ne se justifierait que si la provenance de `lois_cec.pdf` était établie
comme un AUTRE tirage authentique du fascicule (deux états d'impression) — fait non établi.
Si elle était néanmoins retenue :

- corps l. 74 : « CHAPITRE III — DE L’AUTORISATION DE FONCTIONNEMENT DES CEC » →
  « CHAPITRE II — DE L’AUTORISATION DE FONCTIONNEMENT DES CEC » (1 caractère retiré) ;
- `toc[sec-8].label` réécrit à l'identique (l'appariement est à la lettre, § 6.1) ; l'ancre
  `sec-8` ne change pas ; `navToc` aligné ;
- note au lecteur, à l'ancre `sec-8` : « Le fascicule reproduit ici imprime « CHAPITRE III » ;
  une autre source du même texte porte « CHAPITRE II », qui rétablit la séquence des
  chapitres du titre. » — à réécrire selon la justification retenue ;
- s'il existe alors des `commentaires` sous ce chapitre, leurs clés `jurisKey` changent
  (§ 6.2 — aujourd'hui 0) ; le fichier d'assertions `maj2026-base-ranges.json` porte le
  libellé d'aujourd'hui : la jointure des plages se fait par ordre/ancre (§ 7.6), mais le
  fichier devrait être re-généré pour rester lisible.

### Variante B — conserver « CHAPITRE III » (conforme au scan)

Le corps ne bouge pas. Deux sous-options :

- **B1, sans note** : la base est conforme au J.O. numérisé ; il n'y a rien à documenter de
  plus que ce dossier d'archive.
- **B2, avec note** au lecteur, à l'ancre `sec-8` : « Certaines reproductions de cette loi
  numérotent ce chapitre « CHAPITRE II » ; le fascicule du Moniteur n° 54 imprime
  « CHAPITRE III ». » — utile parce que la transcription en circulation (celle de la
  cliente) porte l'autre numérotation.

Dans les deux sous-options, l'entrée « incohérence de la base » disparaît du dossier : la
conservation des autres sics (deux CHAPITRE II au TITRE IV, pas de IV aux TITRES II et V)
et « CHAPITRE III » ici sont, ensemble, fidèles au scan.

## 5. Ce que ce dossier ne fait pas

Il ne tranche pas (§ 12.7). Aucun script de ce lot ne touche à l'en-tête, au `toc` ni à une
note de lecteur sur ce point. Si Me Vaval retient une variante à écrire (A, ou B2), le geste
est à scripter séparément, avec les gardes du § 11 (segmentation, plages, sentinelles,
oracle) rejouées.
