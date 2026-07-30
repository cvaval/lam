# Prompt — Code de procédure civile d'Haïti

> Cahier des charges de téléversement. Rédigé après analyse des trois documents fournis et
> **audit du corpus en production** : qui cite le CPC, sous quelles formes, et combien de fois.

---

## 1. Le document — le plus volumineux du corpus

| | |
|---|---|
| Texte | **Voté par la Chambre Législative le 17 septembre 1963 · promulgué le 17 janvier 1964** |
| Transcription | `CPC_cumule_corrige.docx` — **1 634 642 caractères**, 10 839 paragraphes |
| Second témoin | `Code_procedure_civile-pdf.pdf` — scan de 567 pages, couche texte exploitable |
| Comparaison | Code civil 692 Ko · Code de commerce 289 Ko · **CPC 1,6 Mo** |

⚠️ **Ne pas faire figurer de mention d'édition, d'éditeur ni d'annotateur** dans les
métadonnées du document publié (`titleFr`, `summaryFr`, `moniteurRef`) : la plateforme
publie le TEXTE de loi, voté et promulgué aux dates ci-dessus, non une édition commerciale.

### Trois parties, à ne pas confondre

| Partie | Paragraphes | Contenu |
|---|---|---|
| **CODE** — Livres I à X | ¶0 → ¶5841 | **997 articles**, série 1 → 997 sans lacune |
| **APPENDICE** | ¶5842 → ¶10648 | **114 textes annexés** (92 rubriques), 1 678 têtes « Art. N.- » |
| **JURISPRUDENCE** | ¶10649 → fin | répertoire de vedettes, aucun article |

Charpente du Code : **10 Livres · 122 Titres · 89 Chapitres · 75 Sections**, sur
**7 niveaux** de subdivision (570 divisions au total, d'après le sommaire).

✅ **997 articles, série complète, sans lacune** — conforme au sommaire fourni. Les
14 articles qui semblaient manquer portent une mention de modification entre parenthèses
avant le tiret (§2 bis).

---

## 2. Audit du corpus — ce que le téléversement va débloquer

Mesuré sur les **1 874 documents** de la base (hors Index du Moniteur) :

**59 renvois au Code de procédure civile, dans 12 documents.**

| Document | Renvois |
|---|---|
| Code de commerce | 16 |
| Code du travail | 13 |
| Code des douanes | 18 (2 exemplaires) |
| Décret régimes matrimoniaux · Loi filiation 2014 · Loi sociétés anonymes étrangères 1975 · Loi du notariat 1919 | 2 chacun |
| Décret sûretés · Loi arbitrage 1935 · Décret-loi notariat 1969 · Code civil | 1 chacun |

**Sur ces 59 renvois : 23 nomment un article précis, 36 visent le Code en bloc.**
Articles nommés : **18, 61, 426, 465, 478, 546, 608, 649, 769, 919** — tous compris dans
la série 1 → 997, donc tous résolubles.
Subdivision citée : « Code de procédure civile, **Loi n° 6**, Titre VIII » — le CPC se cite
aussi par ses Lois internes, comme le Code civil.

### ⚠️ Rectification : l'abréviation « C.P.C. » n'existe pas dans le corpus

La demande évoquait « le CPC ou encore C.P.C. ». **Vérifié sur les 1 874 documents : aucune
occurrence** de `C.P.C.`, `CPC`, `C. pr. civ.` ni `Pr. civ.` La forme employée est
**toujours** « Code de procédure civile », en toutes lettres. La règle de liaison doit donc
viser cette forme — inutile de coder des abréviations qui ne sont jamais utilisées, et
risqué de le faire : « CPC » nu apparaîtrait dans des contextes étrangers.

---

## 2 bis. ⚠️ Deux points élucidés — et une règle arrêtée

### a) Les « 14 articles manquants » n'existent pas — le Code est complet

Le premier relevé n'en trouvait que 983 parce que ma recherche exigeait `.-` immédiatement
après le numéro. **Ces 14 articles portent une mention de modification entre parenthèses** :

```
Article 18 (Mod. L. 18 sept 1985 et D. 22 août 1995).- La compétence des juges de paix…
Article 717 (L. 12 sept 1966).- Les tribunaux ne pourront accorder aucun délai…
Article 813 (D. 29 mai 1968).- Toute personne qui, dans la vie publique ou privée…
```

Avec la tête `^Article N (…)?\.-`, le compte est de **997 / 997, sans lacune** — conforme au
sommaire fourni.

Mieux : ces 14 articles sont **exactement les articles amendés du Code**, et le texte les
désigne lui-même. Ils doivent recevoir la pastille « modifié », le texte modificateur nommé :

| Texte modificateur | Articles |
|---|---|
| Loi du 12 septembre 1966 | **717 à 728** (12 articles, saisie immobilière) |
| L. 18 sept. 1985 et D. 22 août 1995 | **18** (compétence des juges de paix) |
| D. 29 mai 1968 | **813** (changement de nom) |

⚠️ La rédaction ANTÉRIEURE de ces 14 articles n'est pas dans le document : seule la version
en vigueur y figure. Il n'y a donc rien à replier, et il ne faut rien inventer — la pastille
et le nom du texte modificateur suffisent.

### b) Les références au Code français sont RETIRÉES

La transcription porte deux appareils de concordance, mêlés dans les mêmes lignes :

| | Exemple | Sort |
|---|---|---|
| **Code français** | `Art. 7 fr` · `Conc. : Art 444, 445 fr` · `D. 22 déc. 1858 fr, art. 17` | **retiré** |
| **Ancienne numérotation haïtienne** | `Anc. art. 22` · `Anc art 631` | **conservé** |
| **Mixte** | `Art. 1 fr — Anc. art. 6` | nettoyé → `Anc. art. 6` |

Règle appliquée (mise au point et mesurée sur le document réel) :

```
NUM     = \d{1,4}[a-z]?(?:\s*(?:bis|ter|quater))?(?:,\s*\d+(?:er|e)\s*al)?
FR_SEUL = ^\[?(Conc\. :)?(D\. …,)? Art\.? NUM(, NUM)* (mod)? fr[\s.,]*\]?$   → ligne supprimée
FR_FRAG = même motif en fragment de ligne                                    → fragment retiré
```

**Résultat mesuré :** 298 lignes supprimées, 528 nettoyées, **772 renvois « Anc. art. »
conservés**, 997/997 articles intacts. Le Code passe de 5 842 à 5 544 lignes (–2 % de
caractères) : l'appareil français ne pesait presque rien, mais encombrait 17 % des lignes.

**Pourquoi conserver l'ancienne numérotation haïtienne** : elle n'est pas française, et elle
sert à retrouver un article cité sous son ancien numéro dans la doctrine et les arrêts
antérieurs à la renumérotation. La retirer aussi est un mot à changer dans la règle — dites-le
si vous le préférez.

### c) Le scan confirme la transcription — et sert de second témoin

Le PDF de 567 pages porte une couche texte exploitable. Confronté au `.docx` :

| | Résultat |
|---|---|
| Articles du Code repérés dans le scan | **996 / 997** au motif automatique |
| Article 726 | présent, mais imprimé `Article 726 L.12 sept 1966).-` — parenthèse ouvrante perdue par l'OCR |
| Article 10 | tête perdue au saut de colonne ; ses **six alinéas sont présents à 100 % des mots** |
| Articles 18, 266, 436, 585, 590 | présents ; artefacts d'OCR (mots collés `Article436.-Toutautre`, espace parasite `Article 266. - `) |

**Conclusion : rien ne manque, ni dans la transcription, ni dans le scan.**

Le scan est en **deux colonnes avec notes de marge** : `Art 7 fr` et `Anc art 6` figurent
dans la marge gauche, matériellement séparés du texte normatif. Cela **confirme** que ces
renvois sont un appareil de concordance et non du texte de loi — le retrait des références
françaises (§2 bis b) porte donc bien sur de l'apparat.

⚠️ **Garder le PDF comme second témoin** pour arbitrer les coquilles du `.docx` au moment
de l'import, comme la compilation notariale l'a permis pour le décret de 1969. Deux
transcriptions indépendantes du même texte valent mieux qu'une relecture à l'aveugle.

---

## 3. Travail demandé

### Lot A — Téléversement du Code

Source `CODE_PROCEDURE_CIVILE`, type `LEGISLATION`, format « lecteur annoté ».
Corps = les Livres I à X. L'**Appendice** et la **Jurisprudence** : voir §5.

Métadonnées : `titleFr` = « Code de procédure civile d'Haïti » ; `number` = « Code de
procédure civile » ; `publicationDate` = **1964-01-17** (promulgation) ; le vote du
**17 septembre 1963** est mentionné dans le résumé. **Aucune mention d'édition, d'éditeur
ni d'annotateur** (§1).

### Lot B — Renvois INTERNES au CPC ⚠️ *demande explicite*

Le CPC se cite abondamment lui-même (« conformément à l'article 470 », « dans les formes
prescrites au titre… »). Activer les renvois inline en ajoutant `CODE_PROCEDURE_CIVILE` à
`ART_REFS_SOURCES` dans `src/app/[locale]/(app)/doc/[id]/page.tsx`.

Le mécanisme est **anti-lien-mort** : il ne lie que si le numéro est réellement un article
du document. Deux gardes existantes protègent déjà des faux liens — un renvoi annoncé comme
externe (« article 5 **de la loi**… », « article 12 **du Code civil** ») n'est pas lié.

⚠️ **Piège propre à ce texte.** Les renvois au Code **français** sont retirés à l'extraction
(§2 bis b). Restent les **772 renvois « Anc. art. N »** à l'ancienne numérotation haïtienne,
conservés : ce sont des lignes d'apparat, **jamais** des articles du présent Code. Elles ne
doivent devenir ni ancres ni liens — sans quoi « Anc. art. 631 » créerait un faux lien vers
l'article 631 en vigueur, qui traite d'autre chose.

### Lot C — Sommaire

`CPC_cumule_sommaire_integral_1.docx` — 692 paragraphes, hiérarchie **intégrale à 7 niveaux**,
chaque division suivie de sa plage d'articles (« Titre III.- Des audiences du juge de paix
et de la comparution des parties — art. 12–17 »).

C'est le sommaire le plus riche reçu à ce jour : il donne à la fois la table des matières
(`toc`, `navToc`) **et** la plage d'articles de chaque division, qui permet de vérifier la
segmentation division par division. S'en servir comme **contrôle** : si une division annonce
« art. 28–34 » et que la segmentation n'y trouve pas ces sept articles, c'est un défaut
d'extraction.

### Lot D — Index

`CPC_cumule_index_alphabetique_1.docx` — **545 vedettes, 1 842 sous-entrées**.

⚠️ **Format inédit** : contrairement aux index précédents, il n'est **pas tabulé**. Les
renvois sont rédigés **en toutes lettres**, et de trois natures distinctes :

| Nature | Forme | Cible |
|---|---|---|
| au Code | « article 86 du Code », « articles 618 à 660 du Code » | `#art-86`, plage |
| à un texte annexé | « décret du 4 avril 1974 (Appendice IV.9) » | rubrique de l'Appendice |
| à la jurisprudence | « jurisprudence n° 18 (Nullités) » | vedette du répertoire |
| entre vedettes | « voir … » | autre entrée de l'index |

96 vedettes renvoient à l'Appendice. L'analyseur doit distinguer ces quatre natures : un
« article 86 » suivi de « du Code » est un lien interne ; le même numéro dans « (Appendice
IV.9) » ne l'est pas.

---

## 4. Place dans l'arborescence

**Aucun thème de procédure civile n'existe** (vérifié) : la taxonomie compte
`procedure-penale` sous `penal`, et le thème annexe du Code du travail
`ct-annexe-ii-code-de-procedure-civile-extraits`.

→ **Créer `procedure-civile` sous `justice`** (Droit public & administratif), en miroir de
`procedure-penale` sous `penal`. Thème secondaire `droit-civil` (Droit privé), la procédure
civile servant la matière civile — double rattachement conforme à l'usage de la maison.

---

## 5. Décisions à trancher

**a) L'Appendice : un document ou plusieurs ?** Il réunit **114 textes annexés** (loi sur le
Ministère de la Justice, décrets d'organisation judiciaire…), chacun avec sa **propre
numérotation d'articles repartant à 1**.
→ *Recommandation* : **un document par texte annexé**, comme pour la compilation notariale.
Les verser dans un seul corps créerait 1 678 ancres en collision (plusieurs « article 1 »).
Option intermédiaire : un seul document « Appendice » avec des ancres préfixées par rubrique
(`app-IV-9-art-1`), au prix d'un écart avec les conventions de la plateforme.

**b) Le répertoire de jurisprudence** (190 ¶, vedettes numérotées) : document autonome
rattaché au CPC, ou bloc `jurisprudence` de l'annotationsJson du Code ?
→ *Recommandation* : bloc `jurisprudence` du Code, clé `sec-K|art-N`, comme le Code du
travail et le Code civil — c'est ainsi que le lecteur l'affiche sous chaque article.

**c) Périmètre de la première livraison.** Le Code seul (983-997 articles) est déjà le plus
gros texte du corpus.
→ *Recommandation* : livrer **le Code d'abord**, vérifier, puis l'Appendice, puis la
jurisprudence. Trois lots successifs valent mieux qu'un import de 1,6 Mo non vérifiable.

---

## 6. Pièges — dont plusieurs déjà payés sur d'autres textes

1. **Concordance française `Art. N fr`** — 575 lignes. Ni ancre ni lien (cf. Lot B).
2. **L'Appendice renumérote** : 1 678 têtes `Art. N.-` réparties sur 114 textes, chacun
   repartant à 1. Sans séparation, collision d'ancres massive.
3. **Deux graphies de tête** : le Code emploie `Article N.-`, l'Appendice `Art. N.-`. Ne pas
   unifier à l'aveugle : c'est ce qui distingue les deux parties.
4. **Tête d'article avec mention de modification** : `Article 717 (L. 12 sept 1966).-`. Une
   tête exigeant `.-` juste après le numéro en manque 14 (§2 bis).
5. **Balayage séquentiel** pour les têtes incrustées, et **bornes de bloc incluant les
   en-têtes** de la table des matières : sans elles, remplacer le dernier article d'une
   section engloutit l'intitulé suivant (leçon du notariat et du décret sûretés).
6. **Alinéas** : un paragraphe du .docx = un alinéa, à conserver. Les recoller rendrait le
   texte illisible d'un bloc — défaut relevé par la cliente sur les textes électroniques.
7. **Apostrophes** à normaliser en typographiques dès l'extraction.
8. **`.env` pointe sur la base de PRODUCTION** — sauvegarder avant écriture.
9. **Volume** : 1,6 Mo dans `bodyOriginal`. Vérifier le temps de rendu de la page et le poids
   du `tsvector` (plafond PostgreSQL : 1 Mo par vecteur ; le plus gros document actuel pèse
   184 Ko de vecteur pour 1,2 Mo de texte — marge suffisante, mais à contrôler).

---

## 7. Recette

- [ ] Les 997 articles du Code sont présents, sans lacune, ancres `art-1` … `art-997`.
- [ ] Segmentation conforme au sommaire : chaque division retrouve la plage d'articles qu'il
      annonce (contrôle automatisable sur les 570 divisions).
- [ ] **Aucune référence au Code français ne subsiste** (`Art. N fr`, `Conc. : … fr`,
      `D. … fr`) ; les 772 renvois « Anc. art. N » à l'ancienne numérotation haïtienne sont
      conservés et ne produisent ni ancre ni lien.
- [ ] Les 14 articles amendés (18, 717–728, 813) portent la pastille « modifié » et le nom
      du texte modificateur.
- [ ] Index : 545 vedettes, 1 842 sous-entrées, **0 renvoi mort** ; les renvois à l'Appendice
      et à la jurisprudence ne pointent pas vers des articles du Code.
- [ ] Renvois internes cliquables et anti-lien-mort vérifiés sur les articles 18, 61, 426,
      465, 478, 546, 608, 649, 769 et 919 — ceux que le corpus cite.
- [ ] **Les 59 renvois des 12 autres documents** aboutissent : « Code de procédure civile »
      devient cliquable vers le CPC, et vers l'article nommé quand il y en a un.
- [ ] Thèmes : `procedure-civile` (principal) + `droit-civil`.
- [ ] Alinéas conservés ; moyenne de caractères par ligne comparable aux autres codes
      (Code civil ≈ 150, décret bail pro 134).
- [ ] Vocabulaire des statuts inchangé — `npx tsx scripts/_audit-statuts.ts` : 0 écart.
- [ ] Recherche : « saisie-arrêt », « juge de paix », « exploit », « péremption d'instance »
      remontent le CPC.
- [ ] Aucune mention d'édition, d'éditeur ou d'annotateur dans `titleFr`, `summaryFr`,
      `moniteurRef` ni dans le corps.
- [ ] Idempotence : chaque script relancé deux fois ne produit ni doublon ni écart.

---

## 8. Effet attendu au-delà du CPC

Une fois le Code en ligne, les **59 renvois** aujourd'hui inertes deviennent navigables — en
particulier depuis le **Code de commerce** (16), le **Code du travail** (13) et le **Code des
douanes** (18). C'est le premier texte du corpus dont l'arrivée enrichit rétroactivement
quatre codes déjà publiés.

Prévoir un lot final : **renvois réciproques**, du CPC vers les textes qui le citent, là où
la citation est bilatérale (procédure commerciale, procédure prud'homale, contentieux
douanier).
