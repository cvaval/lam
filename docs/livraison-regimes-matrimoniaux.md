# Note de livraison — Décret sur les régimes matrimoniaux → Code civil annoté

**Date** : 14 juillet 2026 · **Référence** : Décret sur les régimes matrimoniaux, *Le Moniteur*, Spécial n° 6 du 13 mai 2020 (fournie par la cliente ; absente de la table de concordance).
**Source** : « Regime matrimoniaux.docx » — 1 tableau, 175 lignes (1 en-tête + **174 données**), extraction fidèle en `scripts/data/code-civil/regimes-matrimoniaux/concordance.json`.
**Application** : `scripts/_apply-decret-regimes-matrimoniaux.ts` (idempotent ; sauvegarde intégrale préalable `backup-before.json`).

## a) Opérations effectuées

| Opération | Nombre | Détail |
|---|---|---|
| Articles **amendés** (pastille « modifié », nouvelle version affichée, ancienne version repliable) | **93** | 1174, 1181, 1186–1211, 1213–1248, 1282–1309, 1888 |
| Articles **abrogés** (pastille « abrogé », « Article N.- [Abrogé — …] », ancien texte intégral repliable) | **58** | 1249–1281, **1310**–1324, 1902, 1903, 1905, 1906, 1909, 1912, 1920, 1960–1962 |
| Article **inchangé** (consigne cliente du 14 juillet 2026) | **1** | **1212** — ni pastille, ni overlay, ni repliable |
| Intitulés remplacés (corps + sommaire) | 5 | § II passif ; SECTION II administration ; SECTION III dissolution (déplacée avant 1216) ; DEUXIÈME PARTIE (fusion de 2 lignes) ; + retraits ci-dessous |
| Intitulés **ajoutés** (corps + sommaire, ancres sec-334 à sec-342) | 12 | Paragraphes 1–3 (dissolution) ; SECTIONS I, II, III, IV, V, VI conventionnelles ; DISPOSITIONS COMMUNES AUX CINQ SECTIONS ; « Dispositions communes aux huit sections » promue au sommaire |
| Intitulés retirés (leur objet disparaît ou est remplacé) | 11 lignes | ancien SECTION III (déplacé), SECTION IV acceptation, SECTION VII (« Eliminé »), SECTION VIII, 6 lignes nues conventionnelles, sous-titre DEUXIÈME PARTIE (fusionné) |
| Intitulés **conservés** au-dessus des blocs abrogés (pas de trou muet) | — | SECTION V + § 1er + § II, SECTION VI (légale) ; SECTION IX + § 1er + § II (conventionnelle) |
| Index alphabétique | **16 créés + 3 enrichis** | logement familial, acquêts, récompenses, dissolution, liquidation et partage, recel, préciput, parts inégales, séparation de biens, mandat entre époux… (1 454 → 1 470 sujets) |
| Jurisprudence d'époque **repliée avec l'ancien texte** (§10 bis — aucune migration) | 10 clés | anciens 1187 (4 arrêts), 1193 (note table), 1194, 1199 (commentaire), 1222, 1226, 1255, 1262 (Cass. 14 déc. 1944), 1282, 1321 (3 annotations), 1920 |
| Renvois du corpus vers des articles abrogés (recensés, **non réécrits**) | 11 | `annexe_renvois.csv` |

Mentions de la colonne 2 reproduites **verbatim** dans la note repliable de chaque article (« Législation connexe »), suivies de « — Le Moniteur, Spécial n° 6 du 13 mai 2020. » ; elles alimentent aussi `ArticleVersion.amendedByNumber` (affiché dans « [Abrogé — …] »).

## b) Corrections silencieuses (journal §10 — nouvelles versions uniquement)

1. **449 apostrophes droites `'` → `’`** dans 87 des 93 nouvelles versions (héritées du docx).
2. Guillemet ouvrant isolé « ` devant le nouvel intitulé de la DEUXIÈME PARTIE : retiré.
3. Intitulés multi-lignes du tableau joints en une ligne au style du Code (« SECTION II — DE L'ADMINISTRATION… ») — nécessaire à l'appariement sommaire↔corps du lecteur.

Les textes **anciens** (repliables) sont reproduits tels quels, scories d'OCR comprises (« bypothéquer », « renonçanite », « Leffet », « C. dv »…).

## c) Anomalies de source préservées

- Graphies des mentions : « **Amandé** par » × 97, « Amendé par » × 2, « Modifié par » × 1 (art. 1186), « Eliminé par » × 1 (ancienne SECTION VII), « Abrogé par » × 65 — reproduites verbatim.
- **Ligne 144 (art. 1310)** : libellé « Amandé par l'article 5 » **sans nouvelle version** — traité en **abrogation** (conforme au périmètre de l'article 5 du Décret : arts. 1310–1324) ; le libellé source est conservé dans la note avec la mention explicite de l'écart.
- **Art. 1194, col. 4** : « Il n'y a pas de note corriger le contenu de l'article amendé. » — préservée en réserve, non affichée.
- « § II — Du passif de la communauté » (ligne 145, art. 5) : intitulé sans équivalent dans le corps en base entre 1310 et 1311 — **sans objet**, consigné.

## d) Réserves ouvertes

1. **Article 6 du Décret** : aucune ligne rattachée (dispositions transitoires probables) — rien inféré.
2. **« SECTION IV — Des clauses par lesquelles on assigne… parts inégales »** : intitulé **absent de la table** ; libellé repris du prompt §6 (identique à l'ancienne SECTION VII, verbatim du Code). À confirmer à réception du texte officiel.
3. Écarts de comptage du prompt vs fichier réel : 175 lignes de données annoncées (réel : 174), 2 lignes sans mention (réel : 1 — l'art. 1212 seul), « Abrogé par » × 69 (réel : 65). Sans effet sur l'application (173 mentions et la répartition par article du Décret concordent exactement).
4. L'entrée d'index historique (« puissance maritale », « deuil de la veuve »…) n'a pas de champ « statut » dans le modèle : les anciens sujets continuent de pointer vers les fiches, qui portent désormais la pastille « abrogé ». Marquage dédié = évolution de modèle à trancher.

## e) Contrôles (§11) — tous exécutés le 14 juillet 2026

| Contrôle | Résultat |
|---|---|
| Conformité textuelle : nouvelle version retrouvée dans le corps effectif | **93/93** ✓ |
| Rendu des abrogés « Article N.- [Abrogé — réf.] » | **58/58** ✓ |
| Repliables « ancienne version » non vides | **151/151** ✓ |
| Pastilles : modifié **113** (93 + 20 antérieures) · abrogé **76** (58 + 18 antérieures) | ✓ |
| Art. 1212 : aucun statut, aucun overlay, aucun repliable | ✓ |
| Segmentation : **342/342** en-têtes · **2047** articles, 0 doublon, 0 lacune | ✓ |
| Clés orphelines (juris/comm/connexe/oldVersions/status/labels) | **0** ✓ |
| Index : 1 470 sujets, **0 renvoi mort** | ✓ |
| Typographie : 0 apostrophe droite dans les 93 nouvelles versions | ✓ |
| Nouveaux en-têtes visibles dans le corps effectif (12/12) | ✓ |

Audit structurel complet rejouable : `npx tsx scripts/_audit-code-civil.ts`.
**Réversibilité** : `backup-before.json` (corps + annotations + versions d'articles antérieurs) ; suppression ciblée possible par `ArticleVersion.amendedByNumber` = référence du Décret.

## f) Pièces

- `scripts/data/code-civil/regimes-matrimoniaux/concordance.json` — extraction structurée (174 opérations classées).
- `scripts/data/code-civil/regimes-matrimoniaux/annexe_renvois.csv` — renvois du corpus vers les articles abrogés.
- `scripts/data/code-civil/regimes-matrimoniaux/backup-before.json` — état antérieur intégral.
- `scripts/_apply-decret-regimes-matrimoniaux.ts` — application idempotente.

*Rappel du disclaimer Lam : reproduction fidèle, non officielle ; en cas de divergence, la version publiée au Moniteur prévaut.*

---

## Addendum du 14 juillet 2026 — texte officiel du Décret reçu et téléversé

Le texte intégral du Décret (docx du Moniteur, Spécial n° 6 du 13 mai 2020) a été téléversé en
« Législation annotée » → Personne et Famille (source `DECRET_REGIMES_MATRIMONIAUX`, lecteur annoté,
sommaire 18 en-têtes, index 29 sujets, renvois inline). Sa lecture **tranche des réserves** et **révèle
des écarts entre la table de concordance et le décret réel** :

**Réserves résolues**
- **Article 6 du Décret** (réserve d.1) : il modifie l'**article 1888** (hypothèque légale) — la table
  attribuait cette modification à l'article 5. Le décret réel compte **11 articles** : 5 = abrogation
  1310–1324 seule ; 7 = hypothèque légale (Code civil) ; 8 = Loi du 27 août 1913 ; 9 = abrogation du
  Décret-loi du 11 janvier 1944 (biens réservés) ; 10 = transitoire ; 11 = clause abrogatoire.
- **« SECTION IV — parts inégales »** (réserve d.2) : le décret la contient **verbatim** — le libellé
  dérivé du prompt est confirmé, la réserve est levée.
- **Art. 1212** : le décret **saute** effectivement 1211 → 1213 ; la consigne cliente (1212 inchangé)
  est confirmée par le texte officiel.

**Écarts découverts — TRAITÉS le 14 juillet 2026 sur instruction cliente** (« 1. oui insérer ;
2. oui traiter ; 3. appliquer ce que dit le décret, replier uniquement la partie abrogée ») —
script `_apply-decret-rm-complements.ts`, commit `90396d4` :
1. ✅ **Articles 1181-1, 1184-1, 1184-2 INSÉRÉS** au Code civil (pastille « nouveau », texte
   verbatim du décret, note connexe cliquable → décret). Le Code passe de 2047 à **2050 articles**.
2. ✅ **1907 et 1911 abrogés en entier** (art. 7 al. 2), pastille « abrogé », ancien texte replié.
3. ✅ **Abrogation partielle appliquée** pour 1902, 1903, 1905, 1906, 1909, 1912, 1920, 1960,
   1961, 1962 : le texte affiché est le texte demeuré en vigueur (27 retranchements codés
   explicitement — lignes « Au profit des femmes… » de 1902, membres de phrase « les maris et »,
   « du chef des femmes », etc.) ; **seule la partie abrogée est repliée**, sous une nouvelle
   pastille **« partiellement abrogé »**. Un seul ajustement grammatical journalisé
   (« desdites » → « desdits » après retrait de « femmes », art. 1962). La jurisprudence d'époque
   de 1920 est préservée dans le repli. Réversibilité : texte intégral dans ArticleVersion (MODIFIE).
4. Les mentions verbatim de la table attribuent 1888 et 1310–1324 à l'« article 5 » et les
   hypothèques à l'« article 7 » : partiellement inexactes au vu du texte réel (6 ≠ 5 ; 7 et 8
   distincts). Conservées verbatim (doctrine) ; les liens cliquables et les nouvelles notes des
   articles 1902–1962, 1907 et 1911 citent, eux, l'énoncé réel du décret.

Contrôles après compléments : segmentation **342/342**, **2050 ancres**, 0 orphelin, 0 renvoi
d'index mort ; pastilles : modifié 113 · abrogé 68 · **partiellement abrogé 10** · **nouveau 3**.
