# Prompt — Législation annotée : harmoniser les replis, pastilles et bandeaux (un code couleur par situation)

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (Agora, agora.ht).
> Rédigé le 17 octobre 2026 après un audit du code et de la base de production (lecture seule).
> **Refais chaque mesure avant d'écrire** : un écart t'arrête.

## La demande de Me Vaval

> « Auditer les différents textes qui se trouvent dans la législation annotée. Rédiger un prompt pour
> harmoniser tous les replis qui se trouvent dans l'ensemble des textes ; les codes couleurs doivent être
> identiques pour le même type de situation : amendement, nouveau texte, radier, jurisprudence, etc. »

Ce qui est demandé : **une situation = une couleur, un libellé, un pictogramme, un gabarit**, sur toutes les
fiches de la rubrique et à tous les niveaux (article, fiche, liste, historique).

⚠️ **Cette demande revient sur une règle antérieure.** Le 27 août 2026, sous la charte Klinik, toutes les pastilles
d'état avaient été rendues **neutres** (« aucune pastille n'emprunte d'accent de marque » : fond sauge, filet,
texte encre). Elles ne se distinguent donc aujourd'hui que par leur mot. La nouvelle consigne de Me Vaval prévaut ;
la règle de la charte qui SURVIT est la règle 1 de `src/lib/brand-colors.ts` : **aucune information portée par la
couleur seule** — la couleur s'ajoute au libellé, elle ne le remplace jamais.

---

## § 1 — Le corpus audité (mesuré le 17 oct. 2026)

325 fiches dans la rubrique (types `LEGISLATION` hors fascicules `MONITEUR_PDF_*`, et `DOCTRINE`), dont **308 au
lecteur annoté** (`annotationsJson`). Script de mesure : à refaire (§ 7.1).

| Mécanisme | Données | Fiches | Volume |
| --- | --- | --- | --- |
| Pastille d'état d'article (`annotations.status`) | `modifié` 496 · `nouveau` 535 · `abrogé` 296 · `partiellement abrogé` 15 · `errata` 0 | 47 | 1 342 articles |
| Acte d'origine de la rédaction (`annotations.statusActe`) | libellé + lien | 3 (C. com. 455, TCA 3, CPC App. IV.16.1 3) | 461 |
| Ancienne rédaction repliable (`annotations.oldVersions`) | texte | 11 | 326 |
| Législation connexe (`annotations.connexe`) | blocs, 556 liés à une fiche | 30 | 710 articles |
| Jurisprudence (`annotations.jurisprudence`) | arrêts | 6 | 951 articles, 4 700 décisions |
| Commentaires éditoriaux (`annotations.commentaires`) | notes | 22 | 1 072 articles |
| Concordance (`annotations.concordance`) | « Anc. art. 42 fr. » | 1 (C. com.) | 45 |
| Bandeau de section (`annotations.crossRefs`) | note ± liens | 21 | 30 bandeaux |
| Réserve de couverture (`annotations.reserve`) | — | 0 | — |
| Versions d'article (`ArticleVersion`) | `MODIFIE` 155 · `EN_VIGUEUR` 156 · `ABROGE` 98 · `AJOUTE` 64 | 9 (dont 6 annotées) | — |
| Statut de FICHE ≠ en vigueur | `ABROGE` 5 · `PUBLIE` 4 (dont les 2 codes pénaux 2025, pas encore en vigueur) | 9 | — |

---

## § 2 — Les rendus actuels : sept gabarits pour une douzaine de situations

| Situation | Où | Composant · fichier | Rendu actuel |
| --- | --- | --- | --- |
| Modifié / Nouveau / Abrogé / Partiellement abrogé / Errata | tête d'article, texte annoté | `AnnotatedText` · `STATUS_BADGE` ([AnnotatedText.tsx:38](src/components/AnnotatedText.tsx:38)) | pastille NEUTRE identique pour les cinq (`border-liy-fonse bg-pil text-chabon`), libellé **français seulement** (`badge.fr`) |
| Modifié / Texte abrogé / Ajout — acte | tête d'article, texte NON annoté | `OfficialText` · `CHIP_ETAT` ([OfficialText.tsx:178](src/components/OfficialText.tsx:178)), construit dans [page.tsx:289](src/app/[locale]/(app)/doc/[id]/page.tsx:289) | même pastille neutre, cliquable, cible 40 px, fr/en/ht |
| Article abrogé (version) | corps | `applyAmendments` ([segment.ts](src/lib/legislation/segment.ts)) | ligne « Article N.- [Abrogé — acte] » |
| Ancienne rédaction (version d'article) | bas de page | `AmendmentHistory` ([page.tsx:901](src/app/[locale]/(app)/doc/[id]/page.tsx:901)) | section séparée, cartes `border-chabon/10`, pastille neutre |
| Ancienne rédaction (appareil) | sous l'article | `OldVersion` ([OldVersion.tsx:8](src/components/OldVersion.tsx:8)) | pliable sauge, chevron ▸/▾, titre **« Ancienne version (1987) » EN DUR** |
| Ancienne rédaction + législation connexe | sous l'article | `RelatedLaw` ([RelatedLaw.tsx:11](src/components/RelatedLaw.tsx:11)) | même gabarit + compteur, titre « Ancienne version & législation connexe » |
| Jurisprudence / Annotations | sous l'article | `Jurisprudence` ([Jurisprudence.tsx:43](src/components/Jurisprudence.tsx:43)) | carte ⚖, chevron ▾/▴, compteur plein, **dégradé `from-chabon/70`** |
| Note de section | sous l'intitulé | `AnnotatedText`, bandeau ([AnnotatedText.tsx:279](src/components/AnnotatedText.tsx:279)) | « ↪ Renvoi : » pour TOUT (français seulement) |
| Concordance | tête d'article | `CONCORDANCE_CLS` | italique ardoise « concordance : … » (français seulement) |
| Acte d'origine | tête d'article | `statusActe` | lien encre 11 px |
| Statut de fiche | en-tête de fiche, listes (`ThemeBrowser`, `ResultCard`) | `StatusChip` ([StatusChip.tsx:13](src/components/StatusChip.tsx:13)) | `ABROGE` = **fond attention (sitwon)** ; les autres sauge |
| Fiche abrogée / remplacée | en-tête de fiche | bandeau `bg-pil` | « Ce texte est abrogé et remplacé par : … » |
| Réserve de couverture | tête du texte | bandeau filet terre cuite | libellé « Transcription partielle » (inutilisé : 0 fiche) |

---

## § 3 — Les défauts (chacun mesuré)

**D1. Deux systèmes d'état pour la même situation, avec deux vocabulaires.** `annotations.status` dit « Nouveau » /
« Abrogé » ; `ArticleVersion` dit « Ajout — acte » / « Texte abrogé ». Sur les 6 fiches annotées qui ont des
`ArticleVersion` (Code civil, Code de commerce, Code pénal de 1835, Arrêté marchés 2009, Loi fondations 1934,
Décret SA 1979), `AnnotatedText` reçoit le corps amendé mais **pas** `articleMarks` : la pastille vient de
`annotations.status`, la mention du corps de `applyAmendments`, l'historique de `AmendmentHistory`.

**D2. Double et triple signal.** Sur ces 6 fiches : **137 articles** montrent leur ancienne rédaction **deux fois**
(pliable de l'article + historique en bas de page) ; **80 articles abrogés** portent trois signaux (pastille
« Abrogé », « [Abrogé — acte] » dans le corps, entrée d'historique).

**D3. Toutes les situations ont la même couleur.** Modifié, nouveau, abrogé, partiellement abrogé : même pastille
neutre. C'est l'objet de la demande.

**D4. « Abrogé » a deux couleurs.** Fond attention (sitwon) au niveau de la FICHE (`StatusChip`), neutre au niveau
de l'ARTICLE. Les deux commentaires de code se contredisent (Klinik : « aucune n'est en Sitwon » ; Agora :
« sitwon = pastille Abrogé »).

**D5. « Ancienne version (1987) » s'affiche sur des textes qui n'ont rien à voir avec 1987.** Le libellé, propre à
la Constitution, est en dur dans `OldVersion`, utilisé dès que la variante n'est pas « annotations » :

| Fiche | Articles |
| --- | --- |
| `CONSTITUTION_1987` (seul cas juste) | 85 |
| `LOI_TCA_2002` | 3 |
| `CODE_PENAL_ANNOTE` (1835) | 6 |
| `MARCHES_ARR_MODALITES_2009` | 2 |
| `OBNL_LOI_FONDATIONS_1934` | 3 |
| `LOI_SIGNATURE_ELECTRONIQUE_2017` | 9 |

**D6. Le titre « Ancienne version & législation connexe » ment quand il n'y a pas d'ancienne version.** C'est le cas
de presque toutes les fiches à `connexe` (Décret sur les sûretés : 84 articles ; appendices du CPC ; Loi filiation
2014…). Et une même fiche rend l'ancienne rédaction tantôt par `OldVersion`, tantôt par `RelatedLaw` (Code pénal de
1835, Signature électronique 2017, Arrêté marchés 2009) : **trois rendus** pour la même situation, avec
`AmendmentHistory`.

**D7. Le pliable Jurisprudence/Annotations est illisible.** Le passage à la charte Klinik v3 (`b627df4`, 11 août) a
changé `from-lagon-50/70` (teinte très claire) en `from-chabon/70` (encre à 70 %) : le titre en encre se lit sur un
fond sombre, **contraste ≈ 2,6:1** (minimum AA : 4,5:1). Touche **25 fiches, environ 2 400 articles**. Et arrêts et
commentaires doctrinaux partagent la même carte, la même couleur.

**D8. « ↪ Renvoi : » pour six sortes de notes.** Les 30 bandeaux de section :

| Nature réelle | Bandeaux | Fiches |
| --- | --- | --- |
| Irrégularité du J.O. (« sic ») | 9 | `CODE_FISCAL_2026` ×3, `CODE_PENAL_2025` ×2, `DECRET_MINIER_2026` ×2, `DECRET_IMF_2020`, `DECRET_IMPOT_REVENU_2005` (visa) |
| Texte consolidé (note de consolidation) | 5 | `LOI_PATENTE_1996_CONSOLIDE`, `DECRET_TIMBRE_1978_CONSOLIDE`, `DECRET_CFPB_1979_CONSOLIDE`, `DECRET_IMPOT_REVENU_2005`, `DECRET_ENREGISTREMENT_1977` (périmètre) |
| Modification par un acte (lien vers l'acte) | 6 | `CODE_PENAL_ANNOTE` ×3, `CODE_CIVIL_ANNOTE` ×2 (dont 2 articles insérés), `CODE_PROCEDURE_CIVILE` (Livre IX) |
| Provenance (votes, signature, publication) | 3 | `DECRET_FETES_LEGALES_2024`, `LOI_UCREF_2017`, `DECRET_IMF_2020` |
| Annexes éditoriales (sommaire, index) | 5 | `DECRET_TNT_2026`, `CODE_INVESTISSEMENTS_2002`, `DECRET_DENREES_ALIMENTAIRES_2020`, `DECRET_GESTION_ENVIRONNEMENT_2005`, `DECRET_EDH_2016` |
| Rectification éditoriale | 2 | `DECRET_ENERGIE_ELECTRIQUE_2016`, `CC_VANDAL_IV-A-5` |

Aucun n'est un renvoi à un article (`articles` vide partout). Relis chaque note avant de la classer : ce tableau
est une proposition.

**D9. Sept gabarits de repli.** Rayons (`rounded-lg` / `rounded-xl`), chevrons (▸/▾ contre ▾/▴), casse
(« afficher » / « Afficher »), compteurs (`bg-chabon/15` / `bg-chabon` plein), icônes (⚖ ou rien), positions
(sous l'article / bas de page).

**D10. Libellés en français seulement** sur /en et /ht : pastilles d'`AnnotatedText` (`badge.fr`), « ↪ Renvoi »,
« concordance : », « article N » des bandeaux.

**D11. « Pas encore en vigueur » ne se voit pas.** Les deux codes pénaux de 2025 (statut `PUBLIE`, entrée en vigueur
1er janvier 2027) ont la même pastille « Publié » que n'importe quel texte publié ; seule la ligne « Entrée en
vigueur : 1er janvier 2027 » le dit.

---

## § 4 — La cible : un registre UNIQUE des situations

Crée `src/lib/legislation/situations.ts`, **seule source** des libellés, pictogrammes et couleurs. Liste FERMÉE :

| Clé | Libellé fr / en / ht (à valider) | Picto | Gamme | Où |
| --- | --- | --- | --- | --- |
| `modifie` | Modifié / Amended / Modifye | ✎ | amendement | pastille d'article ; repli « ancienne rédaction » |
| `nouveau` | Nouveau / New / Nouvo | ＋ | nouveau | pastille d'article (+ acte) |
| `abroge` | Abrogé / Repealed / Abwoje | ⊘ | radié | pastille d'article ET de fiche ; ligne « [Abrogé — acte] » |
| `partiellement_abroge` | Partiellement abrogé / Partly repealed / Abwoje an pati | ⊘ | radié (filet pointillé) | pastille d'article |
| `errata` | Errata / Errata / Errata | ✎ | amendement | pastille d'article |
| `ancienne_redaction` | Ancienne rédaction / Previous wording / Ansyen redaksyon | ↺ | **celle de l'état qui l'a produite** (amendement ou radié) | repli |
| `connexe` | Législation connexe / Related legislation / Lejislasyon ki gen rapò | ⇄ | connexe | repli |
| `jurisprudence` | Jurisprudence / Case law / Jurisprudans | ⚖ | jurisprudence | repli |
| `annotations` | Annotations / Annotations / Anotasyon | ✍ | annotations | repli (commentaires de l'auteur ; sous-titre « Jurisprudence » s'il y en a) |
| `note_sic` | Note — texte du J.O. / Note — Official Journal text / Nòt | ⚑ | note de l'éditeur | bandeau |
| `note_consolidation` | Texte consolidé / Consolidated text / Tèks konsolide | ⚑ | note de l'éditeur | bandeau |
| `note_provenance` | Provenance / Source / Orijin | ⚑ | note de l'éditeur | bandeau |
| `note_annexe` | Annexes éditoriales / Editorial annexes / Anèks editoryal | ⚑ | note de l'éditeur | bandeau |
| `note_rectification` | Rectification / Correction / Koreksyon | ⚑ | note de l'éditeur | bandeau |
| `modification_section` | Modifié par / Amended by / Modifye pa | ✎ | amendement | bandeau de section (lien vers l'acte) |
| `renvoi` | Renvoi / See / Gade | ↪ | neutre | bandeau (vrai renvoi à des articles) |
| `concordance` | Concordance / Concordance / Konkòdans | — | neutre (italique) | tête d'article |
| `a_venir` | Pas encore en vigueur / Not yet in force / Poko an vigè | ◷ | à venir | pastille de fiche + bandeau « Entrée en vigueur le … » |
| `reserve` | Transcription partielle / Partial transcript / Transkripsyon pasyèl | ⚑ | note de l'éditeur | bandeau |

### La gamme des états juridiques (PROPOSITION — à valider par Me Vaval, § 8)

Comme la gamme cartographique (avenant AV-02), une gamme **réservée** au signalement des situations, jamais à une
action (CTA, lien de navigation). Jetons à ajouter à `src/lib/brand-colors.ts` et `tailwind.config.ts`
(`etat-<gamme>-fond`, `etat-<gamme>-filet`). Texte toujours en encre `#152E38`. Contrastes calculés (WCAG 2.1) :

| Gamme | Fond | Filet | Encre / fond | Filet / blanc | Filet / fond |
| --- | --- | --- | --- | --- | --- |
| amendement (ocre) | `#FBF0DC` | `#9A6510` | 12,57 | 4,95 | 4,38 |
| nouveau (vert) | `#E2EFEA` | `#23665D` (= `vet`) | 12,01 | 6,71 | 5,68 |
| radié (terre cuite) | `#F1E2DA` (= `woujPal`) | `#9B422C` (= `wouj`) | 11,24 | 6,54 | 5,18 |
| jurisprudence (bleu ardoise) | `#E4ECF1` | `#2E5C73` | 11,87 | 7,25 | 6,07 |
| annotations (ardoise) | `#F7F5EF` (= `koton`) | `#52656B` (= `grafit`) | 13,02 | 6,12 | 5,61 |
| connexe (violet gris) | `#ECEAF3` | `#5A4E86` | 11,91 | 7,32 | 6,15 |
| note de l'éditeur (ambre) | `#FFF4DB` (= `sitwon`) | `#8A6A12` | 12,99 | 5,06 | 4,63 |
| à venir (gris) | `#EEF0F2` | `#52656B` | 12,42 | 6,12 | 5,36 |

Tous au-dessus de 4,5:1 pour le texte et de 3:1 pour le filet (critère des éléments non textuels). À comparer avec
le pliable Jurisprudence d'aujourd'hui : 2,6:1.

**Règles :**
1. **Un état, une gamme, partout** : la pastille d'un article abrogé, celle d'une fiche abrogée, sa ligne dans les
   listes (`ThemeBrowser`, `ResultCard`) et son entrée d'historique sont de la même gamme.
2. **Le libellé est toujours là** (règle 1 de la charte) ; le pictogramme est `aria-hidden`.
3. **Les replis ont UN gabarit** : `src/components/Repli.tsx` — fermé par défaut, `data-nocopy`, chevron ▸/▾, titre
   + compteur, « afficher / masquer » traduits, filet gauche de 3 px de la gamme, fond de la gamme à l'en-tête,
   contenu sur blanc (charte : « tout texte juridique se lit sur blanc »). `Jurisprudence`, `OldVersion` et
   `RelatedLaw` gardent leur LOGIQUE de contenu et passent par ce gabarit.
4. **Les pastilles ont UN composant** : `src/components/PastilleEtat.tsx`, utilisé par `AnnotatedText`, `OfficialText`
   (`articleMarks`), `AmendmentHistory` et `StatusChip` (statuts de fiche). Cible tactile ~40 px et anneau de focus
   d'`OfficialText` conservés.
5. **Les bandeaux ont UN composant** : `src/components/BandeauSection.tsx`, libellé et gamme selon la nature.

---

## § 5 — Le mécanisme

### 5.1 Fusionner les deux systèmes d'état (D1, D2)

- **`ArticleVersion` prévaut** quand il existe pour une ancre : c'est la donnée datée et liée à l'acte. Passe
  `articleMarks` à `AnnotatedText` (et de là à `OfficialText`) ; `annotations.status` ne sert plus, pour cette ancre,
  qu'en repli d'absence.
- **Une ancienne rédaction se montre une fois.** Si une ancre a une `ArticleVersion` `MODIFIE`, son repli d'article
  pointe vers l'historique (ou l'historique ne la répète pas) — choisis UN lieu, et dis lequel. Proposition : le
  repli sous l'article (le lecteur y est déjà), l'historique de bas de page devenant un index des articles modifiés.
- **Un article abrogé dit son état une fois** : la ligne « [Abrogé — acte] » du corps + la pastille ; l'historique
  porte le texte abrogé, sans pastille supplémentaire.
- **Vocabulaire unique** (à valider, § 8) : « Nouveau » ou « Ajout » ; « Abrogé » ou « Texte abrogé ».

### 5.2 Le libellé de l'ancienne rédaction (D5, D6)

- `OldVersion` ne porte plus de date en dur. Libellé par défaut : « Ancienne rédaction » ; la Constitution garde
  « (1987) » par une donnée de la fiche (`annotations.oldVersionsLabel`, ou libellé par ancre si besoin), jamais par
  une constante.
- `RelatedLaw` calcule son titre : « Ancienne rédaction » s'il n'y a qu'elle, « Législation connexe » s'il n'y a
  qu'elle, les deux sinon. Ou deux replis distincts, chacun dans sa gamme : à trancher (§ 8).
- ⚠️ `parseAnnotations` est une **liste blanche** : un champ ajouté sans y passer disparaît sans erreur.

### 5.3 Les bandeaux de section (D8)

- Ajoute `kind` à `CrossRefEntry` (`src/lib/legislation/annotated.ts`) : `renvoi` (défaut, rétrocompatible) ·
  `sic` · `consolidation` · `provenance` · `annexe` · `rectification` · `modification`.
- Migre les 30 bandeaux (§ 3, D8) par un script rejouable, à blanc puis `--commit`, qui **ne touche qu'à `kind`**
  (même note, mêmes liens), recompte, et écrit l'état antérieur.

### 5.4 Le pliable Jurisprudence (D7)

- Retire le dégradé ; gamme jurisprudence pour les arrêts. Variante « annotations » : gamme annotations, et si la
  fiche porte aussi des arrêts, deux sous-parties titrées (comme aujourd'hui) — ou deux replis : à trancher (§ 8).

### 5.5 Statuts de fiche (D4, D11)

- `StatusChip` passe par `PastilleEtat` : `ABROGE` → gamme radié (fin du fond attention propre à la fiche) ;
  `PUBLIE` avec `effectiveDate` future → `a_venir`, et un bandeau en tête du texte : « Pas encore en vigueur —
  entrée en vigueur le 1er janvier 2027 » (fr/en/ht), alimenté par `effectiveDate`, sans donnée nouvelle.
- Le bandeau « abrogé et remplacé par » prend la gamme radié.

### 5.6 i18n (D10)

Tous les libellés du registre en fr/en/ht ; plus aucun `.fr` en dur dans `AnnotatedText`. Le créole : **la
graphie que Me Vaval écrit**, et toute forme neuve lui est soumise (règle du 17 oct. 2026 : « Dekrè … Kòd »).

---

## § 6 — Ce qui ne change pas

- **Aucun texte officiel** : `bodyOriginal`, `bodyClean`, `ArticleVersion.body` restent intacts (§02). Seuls le
  rendu et, pour `crossRefs`, le champ `kind` changent.
- Les ancres (`#art-N`, `#hist-art-N`, `#sec-N`) : un lien existant ne doit pas mourir.
- Le contenu des replis (arrêts, commentaires, blocs connexes, anciennes rédactions) et leur ordre.
- La règle « la version en vigueur s'affiche, l'ancienne se replie » (26 août 2026).

---

## § 7 — Contrôles avant de déclarer le travail fini

1. **Remesure** (script en lecture seule, à verser dans `scripts/`) : le tableau du § 1 et les défauts D2, D5, D6, D8
   avant et après ; après : D2 = 0 double signal, D5 = « (1987) » sur la seule Constitution, D6 = 0 titre mensonger,
   D8 = 0 bandeau « Renvoi » sans article.
2. **Contraste** (vitest, sur le modèle de `src/lib/brand-accents.test.ts`) : chaque gamme, encre/fond ≥ 4,5:1,
   filet/blanc et filet/fond ≥ 3:1 ; aucune gamme d'état employée par un bouton ou un lien de navigation.
3. **Une situation, une gamme** (vitest) : pour chaque clé du registre, le HTML rendu par `AnnotatedText`,
   `OfficialText`, `AmendmentHistory` et `StatusChip` porte les MÊMES classes de gamme.
4. **Rendu sur les données réelles** (comme `AnnotatedTextCodeFiscal.test.tsx`) : Code civil (pastilles, connexe,
   annotations), Constitution (« Ancienne version (1987) » seulement là), Code pénal de 1835 (OldVersion/RelatedLaw
   unifiés), Code de procédure civile (annotations + jurisprudence), Code du travail (jurisprudence), un code pénal
   2025 (« Pas encore en vigueur »). En fr, en, ht.
5. **Planche de validation** : une page de démonstration qui montre toutes les situations côte à côte (pastilles,
   replis ouverts/fermés, bandeaux), rendue avant tout déploiement et soumise à Me Vaval.
6. **Fin de chaîne** : `npm run typecheck && npm run lint && npx vitest run --dir src` ; `npm run build:check` (jamais
   `npm run build`) ; après déploiement, contrôle visuel de 5 fiches connectées en fr/en/ht.

## § 8 — Questions à Me Vaval (à poser AVANT d'écrire)

1. **La gamme** : valider les huit couleurs du § 4 (une planche visuelle les montre), ou en choisir d'autres.
2. **Vocabulaire** : « Nouveau » ou « Ajout — <acte> » ? « Abrogé » ou « Texte abrogé » ? Le verbe « radier »
   doit-il apparaître (« Radié ») ?
3. **Ancienne rédaction** : de la couleur de l'état qui l'a produite (amendement, radié), ou neutre ?
4. **Jurisprudence et commentaires** : deux couleurs (proposé) ou une ; un repli ou deux quand une fiche a les deux ?
5. **Ancienne rédaction et législation connexe** : un repli commun (titre calculé) ou deux replis ?
6. **Historique de bas de page** : le garder (index des articles modifiés) ou le retirer au profit des replis ?
7. **Fiche abrogée** : gamme radié au lieu du fond attention actuel ?
8. **« Pas encore en vigueur »** : libellé et bandeau pour les codes pénaux 2025.

## § 9 — Contraintes du dépôt

- **`.env` = base de PRODUCTION.** Tout script s'exécute à blanc par défaut ; `--commit` sur instruction explicite.
  Pooler : `connection_limit=1..2&connect_timeout=30`.
- **Contrôle d'empreintes** : `npx tsx scripts/verifier-empreintes-donnees.ts` lancé SEUL, verdict lu, avant tout
  commit et tout `--commit` (un `| tail` masque le code de sortie).
- **Git** : `git add` fichier par fichier ; diff complet de tout fichier partagé (une autre session écrit dans les
  feuilles de style) ; pas de push sans instruction.
- **Charte** : les jetons gardent leurs noms Klinik (seules les valeurs ont été ré-pointées) ; noir pur interdit ;
  la terre cuite ne fait pas de grande surface ; tout texte juridique sur blanc.
- **Note de livraison** : `docs/livraison-harmonisation-replis.md` — tableau avant/après, décisions de Me Vaval,
  captures de la planche.
