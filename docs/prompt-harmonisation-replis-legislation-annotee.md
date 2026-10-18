# Prompt — Législation annotée : harmoniser les replis, pastilles et bandeaux (un code couleur par situation)

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (Agora, agora.ht).
> Rédigé le 17 octobre 2026 après un audit du code et de la base de production (lecture seule), **puis
> contre-audité le même jour** : chiffres refaits, situations ajoutées (dérogation, notes « sic » rangées en
> législation connexe, bloc « Citations », replis de navigation, version Word, impression, administration),
> gamme recalculée (la première proposition reprenait les couleurs du surligneur et de la sélection).
> **Refais chaque mesure avant d'écrire** : un écart t'arrête.

## La demande de Me Vaval

> « Auditer les différents textes qui se trouvent dans la législation annotée. Rédiger un prompt pour
> harmoniser tous les replis qui se trouvent dans l'ensemble des textes ; les codes couleurs doivent être
> identiques pour le même type de situation : amendement, nouveau texte, radier, jurisprudence, etc. »

Ce qui est demandé : **une situation = une couleur, un libellé, un pictogramme, un gabarit**, sur toutes les
fiches de la rubrique et partout où la situation se montre (article, fiche, listes, historique, citations,
version Word, impression).

⚠️ **Cette demande revient sur une règle antérieure.** Le 27 août 2026, sous la charte Klinik, toutes les pastilles
d'état avaient été rendues **neutres** (fond sauge, filet, texte encre) : elles ne se distinguent aujourd'hui que par
leur mot. La consigne de Me Vaval prévaut. La règle de la charte qui SURVIT est la règle 1 de
`src/lib/brand-colors.ts` : **aucune information portée par la couleur seule** — la couleur s'ajoute au libellé et
au pictogramme, elle ne les remplace jamais.

**Périmètre** : les fiches de la rubrique « Législation annotée » (types `LEGISLATION` hors fascicules
`MONITEUR_PDF_*`, et `DOCTRINE`), annotées ou non, et les composants qu'elles partagent avec d'autres rubriques
(`StatusChip` dans les listes et la recherche). Vérifie par `grep` tout autre usage d'un composant modifié
(`Jurisprudence`, `OldVersion`, `RelatedLaw`, `StatusChip`, `AmendmentHistory`) avant de le changer.

---

## § 1 — Le corpus audité (mesuré le 17 oct. 2026)

325 fiches, dont **308 au lecteur annoté** (`annotationsJson`) et 17 au lecteur simple (`OfficialText`).

| Mécanisme | Données | Fiches | Volume |
| --- | --- | --- | --- |
| Pastille d'état d'article (`annotations.status`) | `modifié` 496 · `nouveau` 535 · `abrogé` 296 · `partiellement abrogé` 15 · `errata` 0 | 47 | 1 342 articles |
| — dont « modifié » sans rien à ouvrir (ni ancienne rédaction, ni connexe, ni acte, ni version) | | 31 (C. pén. 1835 : 63, C. com. : 62, CPC : 26, C. civ. : 15…) | **249** |
| Acte d'origine (`annotations.statusActe`) | libellé ± lien | 3 (C. com. 455, TCA 3, CPC App. IV.16.1 3) | 461 |
| Ancienne rédaction (`annotations.oldVersions`) | texte | 11 | 326 |
| Législation connexe (`annotations.connexe`) | blocs ; 567 liés à une fiche | 30 | 710 articles, 730 blocs |
| Jurisprudence (`annotations.jurisprudence`) | arrêts | 6 | 951 articles, 4 700 décisions |
| Commentaires (`annotations.commentaires`) | notes de l'auteur | 22 | 1 072 articles |
| — repli Jurisprudence/Annotations, au total | | 25 | **2 021 articles** |
| Concordance (`annotations.concordance`) | « Anc. art. 42 fr. » | 1 (C. com.) | 45 |
| Bandeau de section (`annotations.crossRefs`) | note ± liens (± articles insérés : 2) | 21 | 30 |
| Réserve de couverture (`annotations.reserve`) | — | 0 | — |
| Versions d'article (`ArticleVersion`) | `MODIFIE` 155 · `EN_VIGUEUR` 156 · `ABROGE` 98 · `AJOUTE` 64 | 9 (6 annotées) | — |
| Renvois entre fiches (`CrossRef`, bloc « Citations ») | `CITE` 155 · `VOIR` 95 · `MODIFIE` 23 · `ABROGE` 19 · `APPLIQUE` 6 | — | 298 |
| Statut de FICHE ≠ en vigueur | `ABROGE` 5 · `PUBLIE` 4 (dont les 2 codes pénaux 2025, en vigueur au 1er janv. 2027) | 9 | — |
| Marqueurs d'état écrits DANS le corps (texte de l'éditeur ou du J.O.) | `(Loi du …)` 171 · `(L. du …)` 66 · `(Décret du …)` 38 · `(D. du …)` 19 · `(Abrogé …)` 12 · `(Modifié …)` 3 · `[Abrogé …]` 1 · crochets éditoriaux 35 | 20 | 345 |

### La législation connexe est un fourre-tout

Ses 730 blocs recouvrent **huit natures**, toutes rendues dans le même pliable « Ancienne version & législation
connexe ». Volumes approchés, mesurés sur les libellés (le classement exact est l'objet du § 5.4) :

| Nature | Exemples (libellé du bloc) | Volume |
| --- | --- | --- |
| Acte qui MODIFIE l'article | C. civ. « Décret portant réforme des régimes matrimoniaux » 156, « … Droit des Sûretés » 80, « Loi sur la Paternité… » 13 ; C. com. « Loi portant Réforme du statut du commerçant » 73 ; C. pén. « Décret du 6 juillet 2005… » 12 ; CPC et appendices « Article modifié — D. … » ; Marchés « Modifié par l'Arrêté… » | ~360 |
| Acte qui ABROGE l'article | CPC App. III.3.1 « Article abrogé — D-L 23 juin 1942 » 6, App. III.4.1 1 | 7 |
| DÉROGATION, sans abrogation | C. civ. « Bail à usage professionnel — Code de commerce, art. 1729-3 » 66 ; C. com. « Décret du 9 avril 2020 sur le Bail à Usage Professionnel » 34 (à vérifier un par un) | ~100 |
| Lien vers le texte modifié, à jour | Sûretés « Code civil d'Haïti (texte à jour) » 80, « Code de commerce (texte à jour) » 8 ; Filiation 7 | 95 |
| Ancienne rédaction d'un AUTRE texte | Signature électronique 2017 « Article 1101 du Code civil — rédaction antérieure » | 2 |
| Source, texte rattaché | « Source — Const du 29 mars 1987 » 12 ; « Constitution de 1987, articles… » ; circulaires BRH sous le décret IMF | ~25 |
| **Note « sic » / sur la source** | CPC App. I.A.7.x « Anomalie du texte imprimé — conservée telle quelle » 17 ; App. I.E.1 « Lacune de la source » 3 ; C. com. (Vandal) « Note sur la source imprimée » 4 | **24** |
| Sans intitulé | C. civ. 67 blocs (« Décret du 30 août 1988, art. 1 La mort civile est abolie. ») — l'acte est dans le texte : surtout des actes modificatifs | 67 |

Le script du § 5.4 doit **classer les 730** et n'en laisser aucun « non classé ».

---

## § 2 — Les rendus actuels, point par point

| # | Situation | Où | Composant · fichier | Rendu actuel |
| --- | --- | --- | --- | --- |
| R1 | Modifié / Nouveau / Abrogé / Partiellement abrogé / Errata | tête d'article, lecteur annoté | `AnnotatedText` · `STATUS_BADGE` ([AnnotatedText.tsx:38](src/components/AnnotatedText.tsx:38)) | pastille NEUTRE identique pour les cinq, **français seulement** (`badge.fr`), non cliquable |
| R2 | Modifié / Texte abrogé / Ajout — acte | tête d'article, lecteur simple | `OfficialText` · `CHIP_ETAT` ([OfficialText.tsx:178](src/components/OfficialText.tsx:178)), libellés dans [page.tsx:289](src/app/[locale]/(app)/doc/[id]/page.tsx:289) | même pastille neutre, cliquable, cible 40 px, focus, fr/en/ht |
| R3 | Article abrogé (version) | corps | `applyAmendments` ([segment.ts](src/lib/legislation/segment.ts)) | ligne « Article N.- [Abrogé — acte] » |
| R4 | Ancienne rédaction (version) | bas de page | `AmendmentHistory` ([page.tsx:901](src/app/[locale]/(app)/doc/[id]/page.tsx:901)) | section séparée, pastille neutre, ancres `#hist-art-N` |
| R5 | Ancienne rédaction (appareil) | sous l'article | `OldVersion` ([OldVersion.tsx:8](src/components/OldVersion.tsx:8)) | pliable sauge, ▸/▾, titre **« Ancienne version (1987) » en dur**, bouton sans anneau de focus |
| R6 | Ancienne rédaction + connexe | sous l'article | `RelatedLaw` ([RelatedLaw.tsx:11](src/components/RelatedLaw.tsx:11)) | même gabarit + compteur, titre fixe « Ancienne version & législation connexe » |
| R7 | Jurisprudence / Annotations | sous l'article | `Jurisprudence` ([Jurisprudence.tsx:43](src/components/Jurisprudence.tsx:43)) | carte ⚖, ▾/▴, compteur plein, **dégradé `from-chabon/70`** |
| R8 | Note de section | sous l'intitulé | bandeau d'`AnnotatedText` ([AnnotatedText.tsx:279](src/components/AnnotatedText.tsx:279)) | « ↪ Renvoi : » pour tout, français seulement |
| R9 | Articles insérés sous un intitulé | sous l'intitulé | `crossRefs.insertedArticles` ([AnnotatedText.tsx:299](src/components/AnnotatedText.tsx:299)) | carte d'article **sans pastille** (ce sont des ajouts) |
| R10 | Concordance | tête d'article | `CONCORDANCE_CLS` | italique « concordance : … », français seulement |
| R11 | Acte d'origine | tête d'article | `statusActe` | lien encre 11 px, à côté de la pastille |
| R12 | Statut de fiche | en-tête, `ThemeBrowser`, `ResultCard` | `StatusChip` ([StatusChip.tsx:13](src/components/StatusChip.tsx:13)) | `ABROGE` = **fond attention (sitwon)**, les autres sauge ; `PUBLIE` identique pour un texte publié et un texte pas encore en vigueur |
| R13 | Fiche abrogée / remplacée | en-tête | bandeau `bg-pil` | « Ce texte est abrogé et remplacé par : … » |
| R14 | Renvois entre fiches | bloc « Citations », bas de page ([page.tsx:919](src/app/[locale]/(app)/doc/[id]/page.tsx:919)) | — | **codes bruts** « MODIFIE → », « ABROGE → », « CITE → », « ← VOIR », non traduits, sans couleur |
| R15 | Réserve de couverture | tête du texte | bandeau filet terre cuite | « Transcription partielle » (0 fiche aujourd'hui) |
| R16 | Replis de NAVIGATION | lecteur simple | `<details>` sommaire des tableaux (`bg-koton/40`), `CodeThemeBrowser` | autres gabarits encore |
| R17 | Version Word | `src/lib/legislation/word.ts` | — | toute note `crossRefs` → « Note de la rédaction — … » ; aucun état d'article |
| R18 | Impression | `globals.css` | — | non vérifié : les fonds peuvent disparaître à l'impression |
| R19 | Administration | `LegislationAdminPanel` (« amender », « abroger » créent des `ArticleVersion`) | — | ses propres libellés |

---

## § 3 — Les défauts (chacun mesuré)

**D1. Deux systèmes d'état pour la même situation, deux vocabulaires.** `annotations.status` (R1 : « Nouveau »,
« Abrogé ») et `ArticleVersion` (R2-R4 : « Ajout — acte », « Texte abrogé »). Sur les 6 fiches annotées qui ont des
versions (C. civ., C. com., C. pén. 1835, Arrêté marchés 2009, Loi fondations 1934, Décret SA 1979),
`AnnotatedText` reçoit le corps amendé **mais pas** `articleMarks`.

**D2. Double et triple signal.** Sur ces 6 fiches : **137 articles** montrent leur ancienne rédaction **deux fois**
(R5/R6 + R4) ; **80 articles abrogés** ont trois signaux (R1 + R3 + R4).

**D3. Toutes les situations ont la même couleur** (R1, R2, R4) : l'objet de la demande.

**D4. « Abrogé » a deux couleurs** : fond attention au niveau de la fiche (R12), neutre au niveau de l'article (R1).

**D5. « Ancienne version (1987) » s'affiche hors de la Constitution** (R5, libellé en dur) : TCA 2002 (3), C. pén.
1835 (6), Arrêté marchés 2009 (2), Loi fondations 1934 (3), Signature électronique 2017 (9). Seule la Constitution
(85) est juste.

**D6. « Ancienne version & législation connexe » ment** quand il n'y a pas d'ancienne version (presque toutes les
fiches à `connexe`) ; et une même fiche montre l'ancienne rédaction tantôt par R5, tantôt par R6, et encore par R4.

**D7. La législation connexe mêle huit situations** (§ 1) : un acte qui modifie, un acte qui abroge, une
dérogation, une note « sic » s'y lisent sous le même titre et la même couleur.

**D8. Les notes « sic » ont deux formes** : 9 bandeaux `crossRefs` (« ↪ Renvoi ») et 24 blocs `connexe` (pliable
« législation connexe »).

**D9. Le repli Jurisprudence/Annotations est illisible.** Le passage à la charte Klinik v3 (`b627df4`, 11 août) a
fait de `from-lagon-50/70` (très clair) `from-chabon/70` (encre à 70 %) : titre encre sur fond sombre, **≈ 2,6:1**
(AA : 4,5:1). **25 fiches, 2 021 articles.** Arrêts et commentaires partagent la même couleur.

**D10. « ↪ Renvoi : » pour six natures de notes** (R8). Les 30 bandeaux : irrégularité du J.O. 9 · texte consolidé 5 ·
modification par un acte 6 · provenance 3 · annexes éditoriales 5 · rectification 2. Aucun ne renvoie à un article.

| Nature | Fiches |
| --- | --- |
| sic (9) | `CODE_FISCAL_2026` ×3, `CODE_PENAL_2025` ×2, `DECRET_MINIER_2026` ×2, `DECRET_IMF_2020`, `DECRET_IMPOT_REVENU_2005` (visa) |
| consolidation (5) | `LOI_PATENTE_1996_CONSOLIDE`, `DECRET_TIMBRE_1978_CONSOLIDE`, `DECRET_CFPB_1979_CONSOLIDE`, `DECRET_IMPOT_REVENU_2005`, `DECRET_ENREGISTREMENT_1977` (périmètre) |
| modification (6) | `CODE_PENAL_ANNOTE` ×3, `CODE_CIVIL_ANNOTE` ×2 (dont les 2 articles insérés), `CODE_PROCEDURE_CIVILE` (Livre IX) |
| provenance (3) | `DECRET_FETES_LEGALES_2024`, `LOI_UCREF_2017`, `DECRET_IMF_2020` |
| annexe éditoriale (5) | `DECRET_TNT_2026`, `CODE_INVESTISSEMENTS_2002`, `DECRET_DENREES_ALIMENTAIRES_2020`, `DECRET_GESTION_ENVIRONNEMENT_2005`, `DECRET_EDH_2016` |
| rectification (2) | `DECRET_ENERGIE_ELECTRIQUE_2016`, `CC_VANDAL_IV-A-5` |

**D11. 249 pastilles « Modifié » ne mènent à rien** : aucune ancienne rédaction, ni connexe, ni acte, ni version
au corpus (C. pén. 1835 63, C. com. 62, CPC 26 — le Livre IX —, C. civ. 15, appendices Vandal…). Le lecteur ne sait
pas que la rédaction antérieure n'est pas disponible.

**D12. Le bloc « Citations » affiche des codes bruts** (R14) : 23 `MODIFIE` et 19 `ABROGE` s'y lisent sans couleur ni
traduction, alors que la même situation porte une pastille ailleurs.

**D13. Les articles insérés par une loi** (R9, Code civil sous la LOI Nº 8) n'ont pas de pastille « Nouveau ».

**D14. Sept gabarits de repli** (R5-R7, R16 + bandeaux) : rayons, chevrons (▸/▾, ▾/▴), casse (« afficher » /
« Afficher »), compteurs, icônes, positions, focus clavier (absent de R5-R6).

**D15. Libellés en français seulement** sur /en et /ht : R1, R8, R10, R14 (« article N » des bandeaux aussi).

**D16. « Pas encore en vigueur » ne se voit pas** (R12) : les codes pénaux 2025 ont la même pastille « Publié »
que n'importe quel texte.

**D17. La version Word et l'impression** ne suivent pas (R17, R18).

**D18. L'administration** (R19) parle son propre vocabulaire.

---

## § 4 — La cible : un registre UNIQUE des situations

Crée `src/lib/legislation/situations.ts`, **seule source** des libellés (fr/en/ht), pictogrammes et gammes, lu par
tous les points de rendu du § 2. Liste FERMÉE :

| Clé | Libellé fr (en / ht à valider) | Picto | Gamme | Points de rendu |
| --- | --- | --- | --- | --- |
| `modifie` | **Amendé** (décidé le 17 oct.) | ✎ | amendement | R1, R2, R4, R12 (`MODIFIE`), R14 |
| `nouveau` | **Nouveau** (décidé le 17 oct.) | ＋ | nouveau | R1, R2, R9 |
| `abroge` | **Abrogé** (décidé le 17 oct.) | ⊘ | radié | R1, R2, R3, R4, R12, R13, R14 |
| `partiellement_abroge` | Partiellement abrogé | ⊘ | radié, filet pointillé | R1 |
| `errata` | Errata | ✎ | amendement | R1 |
| `derogation` | **Dérogation** (proposé, § 8) + ligne de portée « Bail à usage professionnel — C. com., art. 1729-3 » | ⤳ | dérogation | blocs connexes « Bail à usage professionnel » |
| `ancienne_redaction` | Ancienne rédaction (repli d'un article amendé) · Texte abrogé (repli d'un article abrogé) | ↺ | celle de l'état qui l'a produite | R4, R5, R6 ; connexe « rédaction antérieure » |
| `acte_modificatif` | Modifié par | ✎ | amendement | connexe « acte qui modifie », bandeau « modification » |
| `acte_abrogatif` | Abrogé par | ⊘ | radié | connexe « Article abrogé — … » |
| `texte_a_jour` | Texte modifié, à jour | ⇄ | connexe | connexe « Code civil (texte à jour) » |
| `connexe` | Législation connexe | ⇄ | connexe | connexe « source », textes rattachés |
| `jurisprudence` | Jurisprudence | ⚖ | jurisprudence | R7 (arrêts) |
| `annotations` | Annotations | ✍ | annotations | R7 (commentaires de l'auteur) |
| `sic` | Texte du Journal officiel (sic) | ⚑ | note | bandeaux sic, connexe « Anomalie… », « Lacune… », « Note sur la source » |
| `consolidation` | Texte consolidé | ⚑ | note | bandeaux |
| `provenance` | Provenance | ⚑ | note | bandeaux |
| `annexe_editoriale` | Annexes éditoriales | ⚑ | note | bandeaux |
| `rectification` | Rectification | ⚑ | note | bandeaux |
| `renvoi` | Renvoi / Voir | ↪ | neutre | bandeaux à articles ; R14 `CITE` `VOIR` `APPLIQUE` `COMMENTE` |
| `concordance` | Concordance | — | neutre, italique | R10 |
| `a_venir` | Pas encore en vigueur | ◷ | à venir | R12 (`PUBLIE` + `effectiveDate` future), bandeau |
| `reserve` | Transcription partielle | ⚑ | note | R15 |
| `navigation` | (titre du repli) | ▸ | neutre | R16 |

### La gamme des états juridiques (PROPOSITION — à valider par Me Vaval, § 8)

Comme la gamme cartographique (avenant AV-02) : une gamme **réservée** au signalement, jamais à une action (bouton,
lien de navigation). Jetons à ajouter à `src/lib/brand-colors.ts` et `tailwind.config.ts`
(`etat-<gamme>-fond`, `etat-<gamme>-filet`). Texte toujours en encre `#152E38`.

| Gamme | Fond | Filet | Encre / fond | Filet / blanc | Filet / fond |
| --- | --- | --- | --- | --- | --- |
| amendement (ocre) | `#FBEBCB` | `#8C5A0B` | 12,06 | 5,86 | 4,98 |
| nouveau (vert) | `#DDF0E6` | `#1F6B4F` | 11,95 | 6,41 | 5,40 |
| radié (bordeaux) | `#F8E0E3` | `#8A2232` | 11,33 | 8,92 | 7,12 |
| dérogation (prune) | `#F2E2F0` | `#7A3B6E` | 11,43 | 7,84 | 6,31 |
| jurisprudence (bleu) | `#DCEAF5` | `#245E86` | 11,58 | 6,95 | 5,67 |
| annotations (ardoise) | `#ECEFF1` | `#4E6168` | 12,29 | 6,49 | 5,62 |
| connexe (violet) | `#E6E3F5` | `#55479A` | 11,27 | 7,62 | 6,05 |
| note de l'éditeur (sable) | `#F0ECDC` | `#6B5A1E` | 11,99 | 6,76 | 5,71 |
| à venir (sarcelle) | `#DFF1F3` | `#1B6A75` | 12,17 | 6,24 | 5,35 |
| neutre (navigation, renvoi) | `#E7ECE7` (`pil`) | `#C5CDC7` (`liy-fonse`) | — | — | — |

**Contraintes vérifiées sur cette proposition, et à tester (§ 7.2)** :
- texte encre sur fond ≥ 4,5:1 ; filet sur blanc et sur fond ≥ 3:1 (élément non textuel) ;
- **les fonds ne reprennent ni le surligneur de recherche** (`mark.hl`, `#FFF4DB`) **ni la sélection** (`#F1E2DA`,
  `globals.css`) — ΔE ≥ 5 (la première version de ce prompt les reprenait : à ne pas refaire) ;
- les filets se distinguent entre états (ΔE ≥ 15) et des couleurs réservées : terre cuite d'action `#9B422C`,
  succès `#23665D`, bleu cartographique `#00209F` (ΔE ≥ 10). D'où le bordeaux pour « radié » (ΔE 18,9 avec la terre
  cuite) ;
- les fonds pâles sont proches les uns des autres (ΔE 5 à 10) : **c'est le filet (3 px), le pictogramme et le
  libellé qui distinguent**, pas le fond.

**Règles :**
1. **Un état, une gamme, partout** : pastille d'article, pastille de fiche, listes, historique, citations, bandeau.
2. **Libellé toujours présent** ; pictogramme `aria-hidden` ; couleur jamais seule.
3. **Les replis ont UN gabarit** : `src/components/Repli.tsx` — fermé par défaut, `data-nocopy`, bouton avec
   `aria-expanded` et anneau de focus, chevron ▸/▾, titre + compteur, « afficher / masquer » traduits, filet gauche
   de 3 px et en-tête dans la gamme, contenu sur blanc (charte : « tout texte juridique se lit sur blanc »).
   `Jurisprudence`, `OldVersion`, `RelatedLaw`, le sommaire des tableaux et `CodeThemeBrowser` gardent leur logique
   de contenu et passent par ce gabarit (variante `navigation` pour les deux derniers).
4. **Les pastilles ont UN composant** : `src/components/PastilleEtat.tsx`, utilisé par `AnnotatedText`,
   `OfficialText` (`articleMarks`), `AmendmentHistory`, `StatusChip` et le bloc « Citations ». La cible tactile ~40 px
   et l'anneau de focus d'`OfficialText` sont conservés. **Une pastille n'est un lien que si elle a une destination**
   (D11) ; sinon son infobulle dit « Ancienne rédaction non disponible au corpus ».
5. **Les bandeaux ont UN composant** : `src/components/BandeauSection.tsx`, libellé et gamme selon la nature.

---

## § 5 — Le mécanisme

### 5.1 Fusionner les deux systèmes d'état (D1, D2)

- **`ArticleVersion` prévaut** quand il existe pour une ancre (donnée datée, liée à l'acte) : passe `articleMarks`
  à `AnnotatedText`, puis à `OfficialText` ; `annotations.status` ne sert plus, pour cette ancre, qu'en repli.
- **Une ancienne rédaction se montre une fois.** Proposition : sous l'article (le lecteur y est déjà) ; l'historique
  de bas de page devient un index des articles modifiés, sans répéter les textes. Les ancres `#hist-art-N` doivent
  continuer de mener quelque part.
- **Un article abrogé dit son état une fois** : la ligne « [Abrogé — acte] » du corps et la pastille ; l'historique
  porte le texte abrogé, sans pastille de plus.
- **Vocabulaire unique** : celui du registre (§ 8, question 2).

### 5.2 Le titre des replis d'ancienne rédaction (D5, D6)

- `OldVersion` ne porte plus de date en dur. Par défaut : « Ancienne rédaction ». La Constitution garde « (1987) »
  par une donnée de la fiche (ex. `annotations.oldVersionsLabel`), jamais par une constante.
- `RelatedLaw` ne regroupe plus que ce qui va ensemble (§ 8, question 5) ; son titre se calcule sur son contenu.
- ⚠️ `parseAnnotations` est une **liste blanche** : un champ ajouté sans y passer disparaît sans erreur.

### 5.3 Les bandeaux de section (D10)

Ajoute `kind` à `CrossRefEntry` (`src/lib/legislation/annotated.ts`) : `renvoi` (défaut, rétrocompatible) · `sic` ·
`consolidation` · `provenance` · `annexe` · `rectification` · `modification`. Migre les 30 bandeaux (tableau D10)
par un script rejouable — à blanc, puis `--commit` —, qui **ne touche qu'à `kind`**, écrit l'état antérieur et
recompte. Relis chaque note avant de la classer : le tableau est une proposition.

### 5.4 Les blocs connexes (D7, D8)

Ajoute `kind` à `ConnexeBlock` : `modificatif` · `abrogatif` · `derogation` · `texte_a_jour` ·
`ancienne_redaction` · `source` · `sic`. Script de classement sur le même modèle :
- une **table FERMÉE de motifs de libellé** (« Article modifié — », « Modifié par », « Article abrogé — »,
  « Bail à usage professionnel », « (texte à jour) », « rédaction antérieure », « Source — »,
  « Anomalie du texte imprimé », « Lacune de la source », « Note sur la source »…) et, pour les cas sans motif
  (dont les **67 blocs sans intitulé** du Code civil), une décision bloc par bloc dans un fichier versionné ;
- **0 bloc non classé** à la fin, sinon le script s'arrête ;
- les 34 blocs « Décret du 9 avril 2020 sur le Bail à Usage Professionnel » du Code de commerce : modification ou
  dérogation ? Le décret modifie le Code de commerce (mémoire `project-decret-bail-pro`) — à trancher bloc par bloc.

Le rendu suit `kind` : chaque nature dans son repli et sa gamme (une note `sic` prend la forme des autres notes
« sic », pas celle de la législation connexe).

### 5.5 Le repli Jurisprudence/Annotations (D9)

Retire le dégradé ; gamme jurisprudence pour les arrêts, gamme annotations pour les commentaires. Une fiche qui a
les deux : deux sous-parties titrées, ou deux replis (§ 8, question 4).

### 5.6 Statuts de fiche, Citations, articles insérés (D4, D12, D13, D16)

- `StatusChip` → `PastilleEtat` : `ABROGE` en gamme radié ; `PUBLIE` avec `effectiveDate` future → `a_venir`, et un
  bandeau en tête du texte « Pas encore en vigueur — entrée en vigueur le … » (fr/en/ht), alimenté par
  `effectiveDate`, sans donnée nouvelle.
- Le bandeau « abrogé et remplacé par » en gamme radié.
- Bloc « Citations » : chaque `kind` par le registre, traduit et orienté (sortant « modifie », entrant « modifié
  par »), `MODIFIE` en gamme amendement, `ABROGE` en gamme radié, les autres neutres.
- `crossRefs.insertedArticles` : pastille `nouveau` et l'acte (celui du bandeau).

### 5.7 Les marqueurs écrits dans le corps (§ 1, 345 marqueurs)

« (L. du 3 avril 2018) », « (D. du 14 novembre 1988, art. 1) », « (Abrogé par … ) » sont du TEXTE (de l'éditeur ou
du J.O.) : ils ne changent pas. Deux options (§ 8, question 9) : les laisser en texte (défaut) ; ou les **styler** au
rendu dans la gamme de leur situation, à condition qu'ils soient reconnus en tête d'article seulement (motif
`TETE_ART` d'`OfficialText`, qui les traite déjà) et que le texte affiché reste identique, octet pour octet.

### 5.8 i18n, Word, impression, administration (D15, D17, D18)

- Tous les libellés du registre en fr/en/ht ; plus aucun `.fr` en dur dans `AnnotatedText`. Créole : **la graphie
  que Me Vaval écrit** ; toute forme neuve lui est soumise (règle du 17 oct. 2026 : « Dekrè … Kòd »).
- `word.ts` : chaque note se titre par son `kind` (« Note — texte du Journal officiel », « Texte consolidé »…), pas
  « Note de la rédaction » pour tout ; les états d'article (pastilles) s'écrivent en tête d'article en texte
  (« [Modifié] »), dans la couleur du filet s'il est aisé de colorer un passage Word.
- Impression : la couleur ne doit pas être la seule porteuse (le libellé l'est déjà) ; `print-color-adjust: exact`
  sur les pastilles et filets, à vérifier en aperçu avant impression.
- `LegislationAdminPanel` : libellés et aperçu de la pastille par le registre.

---

## § 6 — Ce qui ne change pas

- **Aucun texte officiel** : `bodyOriginal`, `bodyClean`, `ArticleVersion.body` restent intacts (§02). Seuls changent
  le rendu et, en données, les champs `kind` des bandeaux et des blocs connexes.
- Les ancres `#art-N`, `#hist-art-N`, `#sec-N` : aucun lien existant ne meurt.
- Le contenu et l'ordre des replis.
- La règle « la version en vigueur s'affiche, l'ancienne se replie » (26 août 2026).

---

## § 7 — Contrôles avant de déclarer le travail fini

1. **Remesure** (script en lecture seule, versé dans `scripts/`) du § 1 et des défauts, avant et après. Après :
   D2 = 0 double signal ; D5 = « (1987) » sur la seule Constitution ; D6 = 0 titre mensonger ; D7 et D10 = 0 bloc
   ou bandeau non classé ; D11 = 0 pastille cliquable sans destination ; D12 = 0 code brut ; D15 = 0 libellé français
   sur /en et /ht.
2. **Gamme** (vitest, sur le modèle de `src/lib/brand-accents.test.ts`) : contrastes et ΔE du § 4 ; aucune gamme
   d'état sur un bouton ou un lien de navigation.
3. **Couverture** (vitest) : chaque champ de `Annotations` qui produit un rendu, chaque `kind` de `CrossRefEntry`,
   de `ConnexeBlock` et de `CrossRef`, chaque statut d'`ArticleVersion` et de fiche est **déclaré dans le
   registre**. Un champ nouveau non déclaré fait échouer le test.
4. **Une situation, une gamme** (vitest) : pour chaque clé, le HTML de `AnnotatedText`, `OfficialText`,
   `AmendmentHistory`, `StatusChip` et du bloc « Citations » porte les MÊMES classes.
5. **Rendu sur les données réelles** (comme `AnnotatedTextCodeFiscal.test.tsx`), en fr, en, ht : Code civil
   (versions + connexe de toutes natures + annotations), Constitution, Code pénal de 1835, Code de commerce
   (concordance, acte, dérogation), Code de procédure civile et un appendice à « Anomalie du texte imprimé », Code du
   travail, un code pénal 2025 (« Pas encore en vigueur »), une fiche du lecteur simple à versions (Décret
   Administration centrale 2005).
6. **Planche de validation** : une page de démonstration avec toutes les situations côte à côte (pastilles, replis
   ouverts/fermés, bandeaux, citations), soumise à Me Vaval AVANT le déploiement.
7. **Fin de chaîne** : `npm run typecheck && npm run lint && npx vitest run --dir src` ; `npm run build:check` (jamais
   `npm run build`) ; après déploiement, contrôle visuel de 5 fiches connectées en fr/en/ht, à l'écran et en aperçu
   d'impression, et d'une version Word.

## § 8 — Questions à Me Vaval (à poser AVANT d'écrire)

**Réponses du 17 octobre 2026** :
- **Vocabulaire (question 2) — DÉCIDÉ** : « **Nouveau** pour un texte nouveau et **Abrogé** pour une section éliminée.
  **Amendé** pour un texte modifié. » Le libellé « Modifié » disparaît partout (pastilles R1, R2, R4, statut de fiche
  R12, Citations R14, administration R19, Word) au profit d'« Amendé » ; « Ajout — <acte> » devient « Nouveau » suivi de
  l'acte ; « Texte abrogé » ne reste que comme TITRE du repli qui montre le texte retiré, la pastille disant « Abrogé ».
  Les formes anglaises et créoles sont à soumettre (« Amended / New / Repealed » ; créole : la graphie que Me Vaval
  écrira).
- **Gamme (question 1)** : planche montrée le 17 oct. ; validation en attente.
- **Dérogation (question 8)** : proposition — pastille « **Dérogation** », suivie d'une ligne de portée qui nomme le
  régime et sa source (« Bail à usage professionnel — C. com., art. 1729-3 ») ; infobulle « Ne s'applique pas au bail
  à usage professionnel ; demeure applicable aux autres baux ». « Abrogé » serait faux (l'article reste en vigueur
  pour les autres baux) ; « Non applicable » seul ne dit pas pour qui. Le mot vaut pour toute exclusion sectorielle
  future, la ligne de portée changeant seule. En attente de validation.
- **Marqueurs du corps (question 9)** : expliqués le 17 oct. ; mesure de position : sur 310 marqueurs d'acte ou
  d'abrogation, **298 suivent immédiatement le numéro d'article**, 3 terminent l'article, 9 sont en cours de phrase
  (les 35 crochets éditoriaux des arrêtés marchés 2017 sont d'une autre nature). En attente de décision.


1. **La gamme** : valider les neuf couleurs du § 4 sur la planche, ou en choisir d'autres.
2. ~~**Vocabulaire**~~ : décidé (Nouveau · Amendé · Abrogé), voir ci-dessus.
3. **Ancienne rédaction** : de la couleur de l'état qui l'a produite (amendement, radié), ou neutre ?
4. **Jurisprudence et commentaires** : deux couleurs (proposé) ; un repli ou deux quand une fiche a les deux ?
5. **Ancienne rédaction, acte modificatif, législation connexe** : un repli par nature, ou un repli commun à
   sous-parties ?
6. **Historique de bas de page** : le garder comme index des articles modifiés, ou le retirer au profit des replis ?
7. **Fiche abrogée** : gamme radié au lieu du fond attention actuel ?
8. **Dérogation** (bail professionnel) : libellé (« Non applicable au bail professionnel », « Dérogation »…) ?
9. **Marqueurs du corps** (« (L. du 3 avril 2018) ») : les laisser en texte, ou les styler (§ 5.7) ?
10. **« Pas encore en vigueur »** : libellé et bandeau pour les codes pénaux 2025.

## § 9 — Contraintes du dépôt

- **`.env` = base de PRODUCTION.** Tout script s'exécute à blanc par défaut ; `--commit` sur instruction explicite.
  Pooler : `connection_limit=1..2&connect_timeout=30`.
- **Contrôle d'empreintes** : `npx tsx scripts/verifier-empreintes-donnees.ts` lancé SEUL, verdict lu, avant tout
  commit et tout `--commit` (un `| tail` masque le code de sortie).
- **Git** : `git add` fichier par fichier ; diff complet de tout fichier partagé (une autre session écrit dans les
  feuilles de style) ; pas de push sans instruction.
- **Charte** : les jetons gardent leurs noms Klinik (seules les valeurs ont été ré-pointées) ; noir pur interdit ;
  la terre cuite ne fait pas de grande surface ; tout texte juridique sur blanc ; le surligneur et la sélection
  gardent leurs couleurs.
- **Note de livraison** : `docs/livraison-harmonisation-replis.md` — tableau avant/après, décisions de Me Vaval,
  captures de la planche.

## Annexe — Matrice de couverture

Chaque ligne doit être cochée à la livraison ; aucune ne peut rester sans clé du registre.

| Point de rendu | Fichier | Clés du registre |
| --- | --- | --- |
| R1 pastille d'article (annoté) | `AnnotatedText.tsx` | modifie, nouveau, abroge, partiellement_abroge, errata |
| R2 pastille d'article (simple) | `OfficialText.tsx`, `page.tsx` | modifie, nouveau, abroge |
| R3 ligne « [Abrogé — acte] » | `segment.ts` | abroge (texte inchangé, style seul) |
| R4 historique | `AmendmentHistory.tsx` | ancienne_redaction, modifie, abroge |
| R5 ancienne rédaction | `OldVersion.tsx` | ancienne_redaction |
| R6 connexe | `RelatedLaw.tsx` | acte_modificatif, acte_abrogatif, derogation, texte_a_jour, ancienne_redaction, connexe, sic |
| R7 jurisprudence/annotations | `Jurisprudence.tsx` | jurisprudence, annotations |
| R8 bandeau de section | `AnnotatedText.tsx` | sic, consolidation, provenance, annexe_editoriale, rectification, acte_modificatif, renvoi |
| R9 articles insérés | `AnnotatedText.tsx` | nouveau |
| R10 concordance | `AnnotatedText.tsx` | concordance |
| R11 acte d'origine | `AnnotatedText.tsx` | (accompagne modifie / nouveau, même gamme) |
| R12 statut de fiche | `StatusChip.tsx`, `ThemeBrowser.tsx`, `ResultCard.tsx` | abroge, modifie, a_venir |
| R13 bandeau de fiche abrogée | `page.tsx` | abroge |
| R14 Citations | `page.tsx` | modifie, abroge, renvoi |
| R15 réserve | `page.tsx` | reserve |
| R16 replis de navigation | `page.tsx`, `CodeThemeBrowser.tsx` | navigation |
| R17 Word | `word.ts` | toutes les notes ; états d'article en texte |
| R18 impression | `globals.css` | toutes |
| R19 administration | `LegislationAdminPanel.tsx` | modifie, abroge, nouveau |
