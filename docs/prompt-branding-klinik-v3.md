# Klinik v3.0 — prompt d'intégration, adapté à l'état réel de la plateforme

Réf. **LAM-BRAND-2026-08-V3** · **CHARTE GELÉE** (toute modification par avenant numéroté)
Sources : `Logo/Logo Aug 2026/` — charte HTML, tokens JSON/CSS/Tailwind, pack de marque v3.0,
et le prompt du concepteur `Officiel_Lam_Prompt-Claude-Code_Integration-Branding-Klinik.md`.

---

## 0. À lire avant tout : ce prompt n'est pas celui du concepteur

Le concepteur a livré son propre prompt d'intégration. **Il reste normatif sur la doctrine** —
tokens, typographie, règles d'usage, critères d'accessibilité — et doit être lu en entier.

Mais il décrit une migration **v1.0 → v3.0**. Or la plateforme a été migrée en **v2.0 le
11 août 2026** (1 891 remplacements, 99 fichiers — voir `docs/prompt-refonte-branding-klinik.md`
et le commit associé). Appliquer son prompt tel quel enverrait chercher des jetons qui
n'existent plus (`lank`, `soley`, `brim`, `lagon`, `fey`, `paper`, `cream` : **0 occurrence**)
et **manquerait ce qui a réellement changé**.

Ce document est donc le **delta v2.0 → v3.0**. Il dit ce qui est déjà fait, ce qui doit être
défait, et ce qui reste.

---

## 1. Ce qui est DÉJÀ conforme (ne pas y toucher)

| Acquis en v2.0 | État |
|---|---|
| Jetons `chabon` `adwaz` `koton` `blan` `grafit` `wouj` `ank` `liy` `pil` | posés dans `tailwind.config.ts`, source unique `src/lib/brand-colors.ts` |
| Anciens jetons v1 et hex v1 | **0 occurrence** (vérifié par grep) |
| Noir pur `#000000` | **0 occurrence** (hors commentaires énonçant la règle) |
| Pastilles de type typographiques | `TYPE_CHIP` dans `src/lib/brand.ts` — fond Pil, bordure `#C7C6C1`, texte Chabon, Plex Mono |
| Logotypes, favicons, manifeste, `theme-color` | pack installé ; **les fichiers du pack v3 sont identiques à ceux du v2** (tailles au bit près) — rien à réinstaller |
| IBM Plex Mono | embarquée via `next/font/google`, variable `--font-plex-mono` |
| Texte juridique sur Blan, en Ank | conforme (CGU vérifiées à l'écran) |
| Filigrane des documents générés | régénéré depuis `Lam_Logo_Monochrome.png` à 10 % |

---

## 2. Ce que la v3.0 CHANGE — le delta réel

### 2.1 Sitwon revient, et il est jaune

La v2.0 avait **supprimé** Sitwon. La v3.0 le **réintroduit** en `#FDD228` (jaune, teinte 48°,
et non l'ancien lime `#BEF264`) avec un rôle nommé : **la couleur de l'usage**.

> « Le trait rouge est la marque du certificateur ; le jaune Sitwon est la couleur de l'usage. »

Emplois **exclusifs**, à créer :

| Emploi | Rendu |
|---|---|
| **CTA principal** | fond Sitwon, texte Chabon — **jamais l'inverse** |
| **Badge « Dokiman verifye »** | fond Sitwon, texte Chabon |
| **Surlignage du terme exact** | fond Sitwon |
| **Soulignement de navigation active** | 2 px Sitwon |

Interdits : jamais en fond de page ni en grande surface, **jamais comme couleur de texte**,
absent du logotype.

**⚠️ Cela défait deux décisions de la v2.0 :**
- le CTA principal sur fond sombre avait été **inversé en Koton/Chabon** (héros d'accueil,
  héros carte, en-tête). Il passe en **Sitwon/Chabon** ;
- le surlignage de recherche avait été rendu en **Pil + trait Wouj de 2 px**, faute de couleur
  disponible dans la v2.0. La v3.0 tranche : **Sitwon** pour le terme exact, **Sitwon Pal**
  pour l'étendu. Retirer le trait Wouj de `mark.hl` (`src/app/globals.css`).

### 2.2 Sitwon Pal `#FFF3C6` — jeton nouveau

Seul dérivé admis. Surlignage **étendu** (ligne de résultat, passage cité) et **fonds de
sélection**, texte Ank (rapport 9,32:1).

### 2.3 Vèt change de valeur

`#3E5E46` → **`#347436`**. Les 14 états de succès déjà portés en Vèt (`text-vet`, `bg-vet/10`)
suivent automatiquement le jeton — mais voir §2.6, le critère bloquant.

### 2.4 Wouj : le logotype sort du quota

Le rationnement (une occurrence par écran) **ne s'applique qu'aux éléments d'INTERFACE**. Le
trait de la feuille du logotype en est **exempt**. Cela lève l'ambiguïté relevée à la livraison
v2.0 — mais **le problème de fond demeure** : `LegislationAdminPanel` et `admin/logs` comptent
4 occurrences d'interface chacun (états d'erreur). À traiter, voir §2.6.

### 2.5 Typographie — le plus gros chantier restant

La plateforme est aujourd'hui sur **la pile système** (`ui-sans-serif`) et **Georgia** pour le
texte juridique. La v3.0 impose trois familles et une échelle stricte.

| Rôle | Famille | État |
|---|---|---|
| Display & UI | **Libre Franklin** 300–700 + italique 400 | **à embarquer** |
| Texte juridique | **Source Serif 4** (axe optique) 400/600 + italique | **à embarquer** (remplace Georgia) |
| Métadonnées | IBM Plex Mono 400/500 | ✅ déjà en place |

Sous-ensembles **latin + latin-ext obligatoires** (diacritiques FR et créole).

Échelle — **aucune taille improvisée hors de celle-ci** :

```
display-1  500 44px/1.08  -0.02em   bas-de-casse
display-2  500 36px/1.10  -0.02em   bas-de-casse
display-3  500 28px/1.15  -0.015em  bas-de-casse
body       400 16px/1.6
body-sm    400 14px/1.55
label      600 12px       capitales, +0.14em à +0.26em
label-sm   600 11px       capitales, +0.14em
legal      400 17px/1.7   Source Serif 4, Ank, sur Blan
meta       400 12px       Plex Mono, chiffres tabulaires
```

**⚠️ INTERDICTION ABSOLUE, à traiter avec méthode.** Le bas-de-casse des titres est un geste
d'**interface**. Il ne touche **jamais** les intitulés officiels du corpus — titres de lois,
décrets, arrêtés, circulaires — dont la casse est celle du *Moniteur*.
La plateforme compte **97 occurrences** de `uppercase`/`lowercase`/`capitalize` : chacune doit
être classée « interface » ou « contenu » avant d'être touchée. Un `text-transform` appliqué à
un titre de document serait une altération du corpus certifié.

### 2.6 Accessibilité — un critère BLOQUANT nouveau

> Aucune information portée par la couleur seule. **Tout état succès (Vèt) ou erreur (Wouj)
> porte son libellé textuel ou son pictogramme.**

Motif : la luminance Vèt/Wouj est de **1,05:1** — les deux sont **indiscernables en daltonisme
rouge-vert**. C'est le critère le plus contraignant de la charte, et il porte sur du code déjà
écrit : les 14 états Vèt et les 42 occurrences Wouj doivent être audités un à un.

Ajouter aussi : focus **`outline` 2 px Chabon, offset 2 px** (la v2.0 avait posé un
`box-shadow` 3 px — à convertir).

### 2.7 Trois doctrines entièrement nouvelles

- **Surfaces — élévation zéro.** Hiérarchie par les fonds et les bordures Liy, rayons 8–12 px.
  Ombre douce **admise uniquement sur les modales et menus flottants**.
  ⚠️ **107 occurrences** de `shadow-*` dans le code, dont le `shadow-card` global : la quasi-
  totalité est à retirer.
- **Iconographie.** Filaire 2 px, terminaisons rondes, **bibliothèque unique : Lucide** ;
  remplissage réservé à l'état actif. ⚠️ **Lucide n'est pas installé** ; les pictogrammes sont
  aujourd'hui des glyphes textuels (`⚖`, `✔`, `⠿`, `→`). Chantier à part entière.
- **Motion.** 150–200 ms ease-out, sur **opacité / transformation / couleur uniquement** ;
  `prefers-reduced-motion` respecté ; aucune animation décorative.
  ⚠️ **64 transitions** pour **7 gardes** `motion-reduce` seulement.

---

## 3. Ordre d'exécution

Le concepteur impose : **chaque phase s'arrête sur sa note de livraison et attend validation
explicite.** Ne rien fusionner d'une traite.

**Phase A — Jetons et typographie**
1. Ajouter `sitwon #FDD228`, `sitwon-pal #FFF3C6` ; porter `vet` à `#347436`.
2. Embarquer Libre Franklin et Source Serif 4 (latin + latin-ext), retirer Georgia du
   `.official-text` et de `fontFamily.serif`.
3. Poser l'échelle typographique en jetons ; focus `outline` 2 px / offset 2 px.

**Phase B — Rendre à Sitwon ses quatre emplois**
4. CTA principal (défaire l'inversion Koton de la v2.0 — 3 emplacements identifiés).
5. Badge « Dokiman verifye ».
6. `mark.hl` → Sitwon ; surlignage étendu et sélection → Sitwon Pal, texte Ank.
7. Soulignement de navigation active, 2 px.

**Phase C — Critère bloquant d'accessibilité**
8. Audit des 14 états Vèt et des 42 occurrences Wouj : libellé ou pictogramme sur chacun.
9. Ramener Wouj à une occurrence d'interface par écran (`LegislationAdminPanel`, `admin/logs`).

**Phase D — Doctrines**
10. Élévation zéro : purge des 107 ombres, sauf modales et menus flottants.
11. Lucide : installation et remplacement des glyphes textuels.
12. Motion : bornes 150–200 ms, `prefers-reduced-motion` généralisé.

**Phase E — Casse**
13. Classer les 97 `uppercase`/`lowercase`/`capitalize` en « interface » ou « contenu ».
    Bas-de-casse sur les titres d'interface ; **rien** sur le corpus.

**Hors périmètre strict** (rappel du concepteur) : pipeline documentaire, DOCX/PDF du corpus,
contenus certifiés, rôles et permissions, 2FA. Le reçu PDF bilingue est hors mission : signaler
les incohérences, ne pas les corriger.

---

## 4. Contrôles de livraison

- [ ] `npm run build:check` (⚠️ **pas** `npm run build` si un serveur de dev tourne).
- [ ] Grep à zéro : jetons v1, hex v1, `#BEF264` (lime retiré), `#3E5E46` (ancien Vèt),
      `#000000`, familles Bricolage/Inter/Lora/JetBrains.
- [ ] Tableau des contrastes calculés sur les paires **réellement employées**, dont les
      nouvelles : **Chabon/Sitwon**, **Ank/Sitwon-Pal**, **Vèt/Blan**.
- [ ] Wouj : recensement écran par écran, **logotype exclu du quota**.
- [ ] Aucune information par la couleur seule (critère bloquant).
- [ ] Focus visible sur 100 % des éléments interactifs.
- [ ] Aucun `text-transform` sur un intitulé du corpus.
- [ ] Captures avant/après des écrans touchés.
- [ ] **Distinguer explicitement** les modifications de charte des corrections opportunistes :
      ces dernières se signalent, ne s'appliquent jamais en silence.

---

## 5. Questions ouvertes, à trancher par la cliente

1. **Les codes `IDX` et `TAR` restent non validés.** La charte v3.0 ne code toujours que
   **six** types ; la plateforme en sert **huit** (Index du Moniteur, Tarifs douaniers). Ces
   deux codes ont été forgés à la migration v2.0 et n'ont reçu aucun aval.
2. **La réserve du concepteur tient toujours** : le fruit recoloré en Koton disparaît sur le
   fond Koton de page. Le logotype doit être posé sur Blan ou en version FondFonce.
3. **Le rationnement de Wouj et les états d'erreur** sont en tension : un formulaire à
   plusieurs erreurs dépasse le quota. Soit les erreurs y échappent, soit il faut un autre
   traitement visuel.
