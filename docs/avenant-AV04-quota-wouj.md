# AVENANT AV-04 — Rationnement des accents et mise en conformité AV-02

| | |
|---|---|
| **Référence** | `LAM-BRAND-2026-08-V3-AV04` |
| **Charte de rattachement** | Klinik v3.0 — `LAM-BRAND-2026-08-V3` (GELÉE) |
| **Avenants antérieurs** | AV-01 (huit types) · **AV-02 (inversion des accents)** · AV-02bis (trait Wouj du logotype) · AV-03 (bibliothèque d'icônes) |
| **Objet** | Application de l'AV-02 au code ; règle de rationnement de l'accent Sitwon |
| **Date** | 16 août 2026 |
| **Statut** | **VALIDÉ** — appliqué au dépôt · **article 6 ouvert** |
| **Portée** | 26 écrans — interface publique et back-office |

> **Historique.** Une première rédaction de cet avenant, du 16 août au matin, portait le
> numéro AV-03 et raisonnait sous le récit d'origine — Wouj au certificateur, Sitwon à l'usage.
> La découverte du dossier `Logo Aug 2026_v4` a révélé que l'AV-02 du concepteur, **daté du
> 11 août et non transmis**, inversait déjà les deux accents. Les mesures de cette première
> rédaction restaient exactes ; ses qualifications étaient à l'envers. Le présent document la
> remplace.

---

## 1. Constat de départ

Relevé du 16 août, avant correction : **223 occurrences des deux accents sur 47 fichiers**.

Sous le récit d'origine, 123 d'entre elles paraissaient fautives. Sous l'AV-02, la lecture
change du tout au tout :

| Motif | Occ. | Sous le récit d'origine | Sous l'AV-02 |
|---|---:|---|---|
| `bg-wouj` | 32 | ⛔ interdit — Wouj jamais en fond | ✔ **conforme** — c'est le CTA d'usage |
| `border-wouj` (nav active) | 44 | ⛔ la nav active se marque en Sitwon | ✔ **conforme** — AV-02 donne à Wouj le soulignement de navigation active |
| `bg-sitwon` (5) | 5 | ✔ CTA principal | ⛔ **non conforme** — Sitwon n'est plus le CTA |
| `ring-wouj` | 55 | ⛔ | ⛔ **fautif sous les deux récits** |
| `hover:text-wouj` | 36 | ⛔ | ⛔ **fautif sous les deux récits** |

Les deux seuls défauts qui survivent à l'inversion sont ceux qui ne relevaient d'aucun des deux
récits : un **anneau de focus coloré**, alors que `globals.css:44-49` fixe le focus en Chabon et
énonce que « il ne peut être ni Wouj ni Sitwon » ; et un **survol de lien coloré**, qui n'est ni
un usage ni une certification.

---

## 2. Corrections appliquées

| # | Correction | Portée |
|---|---|---|
| 1 | Jeton `sitwonPal #FFF3C6` → **`woujPal #FCE1E4`** (AV-02, art. 2) | `brand-colors.ts`, `tailwind.config.ts`, `JudicialMap.tsx`, `audit-contraste.ts` |
| 2 | Badge « Dokiman verifye » → **fond Wouj, texte Blan** (5,43:1) | `doc/[id]/page.tsx` |
| 3 | Statut « Abrogé » et « partiellement abrogé » → **pastille fond Sitwon, texte Chabon** (7,08:1) | `AnnotatedText.tsx` |
| 4 | Onglets actifs : le filet Wouj suffit, le fond redevient Pil | `JurisprudenceAdmin`, `NotesModeration` |
| 5 | Bascule d'aperçu active → fond Wouj, texte Blan | `DocumentNotes` |
| 6 | **55 anneaux `ring-wouj` supprimés** avec leur grappe (`outline-none`, `ring-offset-2`, `focus-visible:ring-2`) | 26 fichiers |
| 7 | **36 `hover:text-wouj`** et 6 `hover:border-wouj` → Chabon | 14 fichiers |

**33 fichiers, 87 lignes.** `tsc` passe, les **295 tests** passent, l'audit de contraste du dépôt
rend **0 échec sur 137 fichiers**.

**Un cas traité à part.** Sur un champ de fichier, le `<input>` est masqué et c'est le `<label>`
qui est visible : l'anneau `focus-within` y est le **seul** indicateur de focus. Il a été
conservé et recoloré en Chabon, non supprimé. Retirer la grappe sans distinction aurait rendu ce
contrôle inaccessible au clavier.

### Vérification au clavier

Le retrait des 55 anneaux repose sur le fait que la règle globale prend le relais. **Vérifié à
l'écran**, tabulation réelle sur le sélecteur de langue — celui-là même qui portait
`outline-none ring-wouj` : `:focus-visible` s'applique, contour **plein, 2 px, `rgb(65,64,66)`,
offset 2 px**. C'est exactement Chabon `#414042`. `globals.css` étant déclaré après
`@tailwind utilities`, sa règle l'emporte sur `outline-none`.

### État après correction

| | avant | après |
|---|---:|---:|
| `ring-wouj` | 55 | **0** |
| `hover:text-wouj` | 36 | **0** |
| `bg-sitwon` | 5 | **3** |
| `text-sitwon` | 0 | **0** (interdit) |
| `wouj-pal` | 0 | 2 |

Les trois Sitwon restants sont les deux pastilles « abrogé » et la pastille « modifiée » — trois
**statuts de certification**, tous à texte Chabon. C'est exactement l'emploi que l'AV-02 lui
assigne.

---

## 3. Règle de rationnement

L'accent rationné n'est plus Wouj, c'est **Sitwon**. Wouj, devenu la couleur de l'usage, est par
nature fréquent : chaque écran a son bouton principal.

> **Article 1 — Emplois admis.**
> **Sitwon** : statut « Abrogé », alerte de certification. Rien d'autre.
> **Wouj** : CTA principal (fond Wouj, **texte Blan**), badge « Dokiman verifye », surlignage du
> terme exact, soulignement de navigation active. Plus le logotype, hors quota (AV-02bis).
> **Wouj Pal** : surlignage étendu, fond de sélection, texte Ank.
>
> **Article 2 — Quota.** **Une occurrence de Sitwon d'interface par écran.** Le logotype n'entre
> pas au décompte : son trait Wouj est le sceau historique du certificateur (AV-02bis), et il ne
> porte pas Sitwon.
>
> **Article 3 — Assiette.** Le quota porte sur les éléments **permanents** et se compte en
> éléments **simultanément visibles**, non en occurrences de code. Trois branches d'un même
> ternaire ne comptent qu'une fois.
>
> **Article 4 — Les états échappent au quota.** Un état conditionnel — abrogation, erreur, échec
> — n'entre pas dans le décompte, **à la condition** de porter son libellé. Une liste de
> quarante articles dont douze sont abrogés affiche douze pastilles : masquer les onze dernières
> pour tenir un quota serait un défaut d'usage. Le rationnement protège l'attention, il n'ampute
> pas l'information.
>
> **Article 5 — Formes interdites.** Sitwon n'est **jamais** une couleur de texte, **jamais** un
> fond de page, **jamais** un trait. Sa seule forme lisible est la **pastille remplie à texte
> Chabon** — mesuré : Sitwon sur Blan donne **1,46:1**, très en deçà des 3:1 exigés d'un élément
> graphique ; en pastille sous texte Chabon il donne **7,08:1**. Wouj n'est jamais un anneau de
> focus ni un survol décoratif.
>
> **Article 6 — La couleur ne porte jamais seule.** Le couple à luminance quasi identique
> (1,05:1) est désormais **usage (Wouj) / succès (Vèt)**. Tout état porte son libellé ou son
> pictogramme. Critère **bloquant**.

### Table de bascule

| Ce que l'élément fait | Couleur |
|---|---|
| Statut « Abrogé », alerte de certification | **Sitwon** en pastille, texte Chabon |
| Action principale (CTA) | **Wouj** en fond, **texte Blan** |
| Navigation active, onglet actif | filet **Wouj** ; fond neutre (Pil) |
| Badge « Dokiman verifye », terme surligné | **Wouj** en fond, texte Blan |
| Surlignage étendu, fond de sélection | **Wouj Pal**, texte Ank |
| Succès | **Vèt**, libellé obligatoire |
| Action secondaire, action destructive | **Chabon**, libellé explicite |
| Neutre, compteur, métadonnée | **Grafit** (interface) ou **Ank** (corpus) |
| Focus | **Chabon**, outline 2 px, offset 2 px — jamais autre chose |

---

## 4. Contrôles automatisables

À ajouter à la suite de tests :

1. `text-sitwon` — **0** (Sitwon n'est jamais un texte) ;
2. `ring-wouj`, `ring-sitwon` — **0** (le focus est Chabon) ;
3. `hover:text-wouj`, `hover:border-wouj` — **0** ;
4. tout `bg-wouj` s'accompagne de `text-white` sur le même élément ;
5. tout `bg-sitwon` s'accompagne de `text-chabon` ;
6. **au plus une occurrence de Sitwon permanente par route** — en parcourant la clôture des
   imports de chaque page et en excluant les branches conditionnelles.

Les cinq premiers sont de simples relevés. Le sixième est le contrôle réel du quota ; il
n'existait pas, et c'est son absence qui avait laissé passer le socle partagé de trois composants.

---

## 5. Reste ouvert

**Article 6 — où va l'erreur ?** L'AV-02 attribue à Sitwon le statut « Abrogé » et l'alerte de
certification, à Wouj le CTA, le badge, le surlignage et la navigation active. **Il ne dit pas où
va l'erreur de saisie.** Cinquante et une occurrences de `text-wouj` subsistent, pour l'essentiel
des messages d'erreur de formulaire.

Recommandation : **les laisser en Wouj**, pour quatre raisons. L'AV-02 ne les déplace pas ; son
article 4 range explicitement Wouj au pôle opposé de Vèt, le succès ; le rouge d'erreur est une
convention que rien ne justifie de rompre ; et la forme distingue les deux emplois — le CTA est
un **fond** rouge à texte blanc, l'erreur est un **texte** rouge sur fond clair. Ils ne se
confondent pas.

**À confirmer par le concepteur** avant de figer AV-04.

---

## 6. Sans objet

Le lot soumis à décision par la rédaction précédente — porter les 32 boutons du rouge au jaune —
**est annulé**. Sous l'AV-02, ces boutons étaient conformes depuis le début.
