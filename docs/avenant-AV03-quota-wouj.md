# AVENANT AV-03 — Quota Wouj : arbitrage et règle générale

| | |
|---|---|
| **Référence** | `LAM-BRAND-2026-08-V3-AV03` |
| **Charte de rattachement** | Klinik v3.0 — `LAM-BRAND-2026-08-V3` (GELÉE) |
| **Objet** | Arbitrage des conflits de quota Wouj ; règle générale de rationnement |
| **Date** | 16 août 2026 |
| **Statut** | **VALIDÉ** pour la règle et les arbitrages ; **§6 soumis à décision** |
| **Portée** | 26 écrans — interface publique et back-office |
| **Antériorité** | Point 3 des « restant à trancher » de la charte v3.0 |

---

## 1. Constat — le périmètre annoncé était trop étroit

L'avenant devait arbitrer **quatre écrans d'administration**. Le relevé exhaustif en trouve
**vingt-six sur vingt-six** en dépassement, écrans publics compris.

Il établit surtout que le dépassement n'est **pas un problème d'écran**. Il vient de trois
composants partagés et de deux emplois de Wouj contraires à des règles écrites. Arbitrer quatre
écrans aurait laissé la cause intacte et le conflit serait revenu au premier écran neuf.

### Mesure au 16 août 2026 — 223 occurrences sur 47 fichiers

| Motif | Occurrences | Fichiers | Au regard de la charte |
|---|---:|---:|---|
| `bg-wouj` | **32** | 24 | ⛔ **interdit** — « Wouj jamais en fond » |
| `ring-wouj` | **55** | 26 | ⛔ contredit `globals.css:44-49`, qui fixe le focus en Chabon 2 px |
| `hover:text-wouj` | **36** | 14 | ⛔ Wouj en texte, à fin décorative |
| `border-wouj` | 44 | 22 | ⚠ admis en filet d'état, décoratif sinon |
| `text-wouj` | 53 | 29 | ✔ admis — erreur, abrogation, alerte |
| `bg-wouj/5`, `/20` | 2 | 2 | ⚠ teintes de fond, à qualifier |

**Cent vingt-trois occurrences contreviennent à une règle écrite de la charte.**

### Un contrôle de la charte v3.0 était faux

Les « contrôles finaux » de la v3.0 déclarent : *« Wouj en fond : **0** (interdit) »*. Il y en a
**trente-deux**, dont les boutons de soumission de `LoginForm`, `RegisterForm`, `ResetForm`,
`ForgotForm`, `VerifyForm`, `SearchBox`, `PublicHeader` et huit écrans d'administration.

Le contrôle a probablement porté sur les seuls **aplats décoratifs** et non sur les boutons. Le
présent avenant le rectifie : il ne s'agit pas d'une dérive postérieure au gel, mais d'un écart
présent au moment du gel et non détecté.

### Ce que le rationnement recouvrait en réalité

Trois composants partagés posent du Wouj sur presque tout écran, avant même son contenu propre :

| Composant | Emploi | Doctrine v3.0 |
|---|---|---|
| `AdminNav.tsx:65` | `border-l-2 border-wouj` sur l'entrée active | La navigation active se marque en **Sitwon** |
| `LocaleSwitcher.tsx:41` | `bg-wouj text-white` sur la langue active | Wouj **jamais en fond** ; état actif = Sitwon |
| `LocaleSwitcher.tsx:41` | `hover:text-wouj` sur les langues inactives | Wouj **jamais en texte** décoratif |
| `LocaleSwitcher.tsx:40` + 25 autres | `ring-wouj` | Le focus est **Chabon**, et `globals.css` le dit |

Ces quatre lignes suffisent à mettre **les seize écrans d'administration** en dépassement
permanent, indépendamment de leur contenu.

---

## 2. Arbitrage — les quatre écrans les plus chargés

Les quatre écrans d'administration portant le plus d'éléments Wouj **permanents** d'interface,
hors logotype. Le même arbitrage vaut pour les vingt-deux autres.

### 2.1 `/admin/jurisprudence` — 7 éléments permanents

Éditeur de décisions et éditeur de corpus. Les éléments en conflit : badge « texte intégral
absent » par décision, badge de champs manquants par ligne analysée, bouton de téléversement en
fond Wouj, bouton d'enregistrement en fond Wouj, filet de navigation, pastille de langue, anneau
de focus.

**Conserve Wouj** : le badge « texte intégral absent ». C'est une **alerte de certification** —
il dit qu'une décision publiée n'est pas complète, ce qui est exactement l'office du
certificateur.
**Basculent** : les deux boutons → **Sitwon en fond, texte Chabon** (CTA principal, doctrine
v3.0). Le badge de champs manquants → **Grafit**, avec son libellé conservé : c'est une
information de saisie, non une alerte publiée. Filet de navigation, pastille de langue et anneau
de focus → traités au §3, ils ne relèvent pas de cet écran.

### 2.2 `/admin/index-moniteur` — 6 éléments permanents

Saisie manuelle d'éditions et de titres. En conflit : détection de doublon, bouton d'ajout,
bouton d'enregistrement, bandeau de section teinté `bg-wouj/5`, onglet actif en `bg-wouj`, plus
le socle partagé.

**Conserve Wouj** : la **détection de doublon**. C'est une alerte de certification — publier deux
fois la même entrée d'index atteint l'intégrité du catalogue.
**Basculent** : les deux boutons → **Sitwon**. L'onglet actif → **Sitwon en soulignement** (et
non en fond : Wouj comme Sitwon sont proscrits en fond pour un onglet). Le bandeau `bg-wouj/5` →
**Pil**, la teinte de surface neutre.

### 2.3 `/admin/notes` — 4 éléments permanents

Modération des notes de lecteurs. En conflit : bouton « refuser » en fond Wouj, compteur de notes
en attente, bouton de soumission, socle partagé.

**Conserve Wouj** : **aucun élément permanent**. Cet écran n'émet aucune alerte de certification ;
il administre une file d'attente.
**Basculent** : « refuser » → **Chabon** (bouton secondaire) avec son libellé, qui dit
l'action ; le rejet d'une note n'est pas une alerte, c'est une décision de modération. Le
compteur → **Grafit**. Le bouton de soumission → **Sitwon**.
Wouj reste disponible sur cet écran pour un **état conditionnel** : l'échec d'une action.

### 2.4 `/admin/users` — 3 éléments permanents

Habilitations et demandes en attente. En conflit : bouton « suspendre », bouton de création,
socle partagé.

**Conserve Wouj** : **aucun élément permanent**. La pastille de statut « Suspendu », en revanche,
garde Wouj : c'est un **état**, conditionnel, et il porte son libellé.
**Basculent** : « suspendre » → **Chabon**, libellé explicite ; « créer » → **Sitwon**.

> **Motif commun aux quatre.** Aucun bouton d'action ne conserve Wouj. Un bouton est un geste
> d'**usage** ; Wouj est la marque du **certificateur**. Un bouton rouge dit « attention » à
> chaque écran et, à force, ne dit plus rien — le rationnement n'a pas d'autre raison d'être.

---

## 3. Correction des trois composants partagés

Elle précède les arbitrages d'écran : sans elle, aucun écran ne peut passer sous le quota.

| Composant | Aujourd'hui | Après |
|---|---|---|
| `AdminNav.tsx:65` | `border-l-2 border-wouj` | `border-l-2 border-sitwon` — la navigation active se marque en Sitwon |
| `LocaleSwitcher.tsx:41` | `bg-wouj text-white` | `bg-sitwon text-chabon` — CTA/état actif, fond Sitwon, texte Chabon |
| `LocaleSwitcher.tsx:41` | `hover:text-wouj` | `hover:text-chabon` — un survol n'est pas un état de certification |
| 26 fichiers | `ring-wouj` + `focus-visible:ring-2` | **supprimé** — `globals.css` fixe déjà `outline: 2px solid #414042` |

La suppression des 55 `ring-wouj` n'appauvrit rien : elle retire un second traitement de focus qui
**contredisait** le premier. Le commentaire de `globals.css:44-45` l'énonce déjà — *« Il ne peut
être ni Wouj ni Sitwon : le focus se déplace partout, les deux accents sont rationnés. »*

Après cette correction, les vingt-six écrans retombent à **zéro Wouj permanent de socle**, et
chacun retrouve son quota entier pour son contenu propre.

---

## 4. Règle générale

> **Article 1 — Emplois admis.** Wouj n'est employé que pour : le **logotype**, le statut
> **« Abrogé »**, une **erreur**, une **alerte de certification**. Tout autre emploi est un
> défaut, quel qu'en soit le rendu.
>
> **Article 2 — Assiette du quota.** Le quota d'**une occurrence par écran** porte sur les
> éléments **permanents** d'interface : ceux qui sont à l'écran quoi que fasse l'utilisateur. Il
> se compte en **éléments simultanément visibles**, non en occurrences de code — les branches
> d'un même ternaire ne comptent qu'une fois.
>
> **Article 3 — Les états échappent au quota.** Un état conditionnel — erreur de saisie,
> abrogation, échec d'une action — n'entre pas dans le quota, **à la condition** de porter son
> libellé textuel. Un formulaire dont cinq champs échouent affiche cinq erreurs : masquer les
> quatre dernières pour tenir un quota esthétique serait un défaut d'utilisabilité. Le
> rationnement protège l'attention, il n'ampute pas l'information.
>
> **Article 4 — Actions destructives.** Une action destructive ne mérite pas Wouj. Son
> irréversibilité se dit par son **libellé** et par une **confirmation**, non par sa couleur. Le
> bouton est **Chabon**. Wouj reste disponible pour le message d'échec.
>
> **Article 5 — Le logotype est hors quota**, en toutes ses variantes. Une seule est visible à la
> fois : la barre latérale est `hidden md:flex`, l'en-tête mobile `md:hidden`.
>
> **Article 6 — Fond et texte.** Wouj n'est **jamais** un fond, **jamais** une couleur de texte
> décorative, **jamais** un anneau de focus. Sitwon n'est **jamais** une couleur de texte.
>
> **Article 7 — La couleur ne porte jamais seule.** Reprise du critère bloquant v3.0 : la
> luminance Vèt/Wouj est de **1,05:1**. Tout état porte son libellé ou son pictogramme.

### Table de bascule

| Ce que l'élément fait | Couleur |
|---|---|
| Alerte de certification, erreur, abrogation | **Wouj**, avec libellé |
| Succès | **Vèt**, **libellé textuel obligatoire** (1,05:1 avec Wouj) |
| Action principale (CTA) | **Sitwon en fond, texte Chabon** — jamais Sitwon en texte |
| Action secondaire, action destructive | **Chabon**, libellé explicite |
| Navigation active, onglet actif | **Sitwon**, en soulignement ou filet |
| Information neutre, compteur, métadonnée | **Grafit** (interface) ou **Ank** (corpus) |
| Focus | **Chabon**, outline 2 px, offset 2 px — jamais autre chose |

---

## 5. Contrôles vérifiables

À ajouter à la suite de tests, au même titre que les contrôles existants de la charte :

1. `bg-wouj` — **0** hors `public/brand/*.svg` ;
2. `ring-wouj` — **0** ;
3. `hover:text-wouj` — **0** ;
4. `text-sitwon` — **0** (déjà en vigueur) ;
5. **au plus un élément Wouj permanent par route** : pour chaque page, parcourir la clôture de
   ses imports et compter les occurrences de Wouj **hors** branche conditionnelle et hors
   logotype. C'est le seul contrôle qui exige de suivre l'arbre des composants ; c'est aussi
   celui qui aurait détecté le socle partagé du §3.

Les quatre premiers sont de simples relevés. Le cinquième est le contrôle réel du quota, et il
n'existait pas — d'où le conflit.

---

## 6. Coût et point soumis à décision

**Correction des composants partagés (§3)** : 4 lignes dans 2 fichiers, plus la suppression de 55
`ring-wouj` dans 26 fichiers. Aucune régression d'accessibilité — le focus global demeure et
reste conforme AA. **Recommandé sans réserve.**

**Arbitrages d'écran (§2)** : de l'ordre de 20 lignes sur 8 fichiers.

**⚠️ Point qui excède le mandat du présent avenant.** Les 32 `bg-wouj` sont, pour l'essentiel,
les **boutons principaux de toute la plateforme** — connexion, inscription, réinitialisation,
recherche, en-tête public, et huit écrans d'administration. Les porter en Sitwon est conforme à
la doctrine v3.0 et c'est ce que l'article 6 impose, mais c'est un **changement visuel majeur** :
le bouton le plus vu de la plateforme passe du rouge au jaune.

Ce n'est pas un arbitrage de quota, c'est une **mise en conformité v3.0** qui aurait dû être
faite au gel et ne l'a pas été. Il est soumis comme **lot distinct**, à ordonner avant le build
front-end du prototype v4 — le construire sur des boutons rouges serait bâtir sur un écart connu.

**Mesure qui confirme le diagnostic.** La charte v3.0 déclare avoir porté « 15 CTA en Sitwon
(3 héros + 12 boutons de soumission) ». Le dépôt en compte **5** (`bg-sitwon`), contre 32
`bg-wouj`. Le jeton est pourtant bien déclaré — `tailwind.config.ts:29`, `#FDD228` — et
`text-sitwon` est à 0, conformément à l'interdiction. `sitwon-pal` (`#FFF3C6`), déclaré lui
aussi, n'est employé **nulle part** : le surlignage étendu et la sélection, prévus par la v3.0,
n'ont pas été implantés.

La bascule des CTA n'est donc pas une régression postérieure au gel : elle n'a été faite qu'au
tiers.

---

*Avenant établi sur relevé exhaustif du dépôt au 16 août 2026 — 26 routes, clôture d'imports
suivie, 223 occurrences qualifiées — puis contre-épreuve adversariale. Le relevé automatisé
initial a été partiellement rectifié : deux comptages faux d'un ordre de grandeur sur la carte
judiciaire, une qualification contradictoire d'une même ligne partagée selon la route, et un SVG
déclaré absent alors qu'il est le seul du périmètre administratif. Les chiffres agrégés du §1 ont
été remesurés directement.*
