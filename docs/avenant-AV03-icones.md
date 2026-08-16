# AVENANT AV-03 — Bibliothèque d'icônes

| | |
|---|---|
| **Référence** | `LAM-BRAND-2026-08-V3-AV03` |
| **Charte de rattachement** | Klinik v3.0 — `LAM-BRAND-2026-08-V3` (GELÉE) |
| **Objet** | Arbitrage de la bibliothèque d'icônes ; inventaire par écran ; convention de nommage |
| **Date** | 16 août 2026 |
| **Statut** | **VALIDÉ** |
| **Portée** | Interface publique et back-office — 26 écrans |
| **Antériorité** | Point 2 des « restant à trancher » de la charte v3.0. ⚠️ Renuméroté le 16 août : le numéro AV-02 est occupé par l'avenant du concepteur du 11 août (inversion des accents), découvert dans le pack v4. |

---

## 1. Constat

La charte v3.0 avait relevé que le jeu d'icônes inline « était déjà dans l'idiome Lucide »
(`fill="none"`, `currentColor`, 24×24, traits 2 px, terminaisons rondes) et avait renoncé à
installer la dépendance, jugeant qu'ajouter une bibliothèque pour remplacer des icônes déjà
conformes ne s'imposait pas. Ce raisonnement portait sur la **forme**. Le relevé exhaustif
conduit pour le présent avenant établit un défaut de **cohérence** que la charte n'avait pas vu.

**État mesuré au 16 août 2026** : **20 balises `<svg>` inline**, réparties sur **13 fichiers**.
Aucune bibliothèque d'icônes n'est installée ; `package.json` ne déclare ni `lucide-react`, ni
`react-icons`, ni `@heroicons`, ni `@tabler/icons`.

Sur ces 20 balises :

- **17** sont de véritables icônes d'interface ;
- **3** n'en sont pas et **doivent rester hors du périmètre** — `HeroJudicialMapArt.tsx:35`
  (illustration vectorielle générée), `jurisdictions/CourtCard.tsx:38` (marqueur cartographique
  cercle/triangle/carré/losange, porteur d'une sémantique de légende) et le contrôle de zoom de
  MapLibre, qui appartient à la carte et non à l'interface.

### Le défaut qui emporte la décision

**Un même rôle est dessiné de plusieurs façons.** Mesuré sur les tracés :

| Rôle | Tracé A | Tracé B |
|---|---|---|
| Entonnoir (filtres) | `M4 6h16M7 12h10M10 18h4` — *AdvancedSearch:73, SearchBox:338* | `M3 6h11M3 12h8M3 18h5` — *ContextualFilters:76, ThemeBrowser:620* |
| Croix (fermer) | `M5 5l10 10M15 5L5 15` — *ChampRecherche:136* | `M6 6l12 12M18 6L6 18` — *SearchBox:275, :314* |
| Tri | `M3 6h12M3 12h9M3 18h6` — *BrhCirculaireList:109* | `M3 6h11M3 12h8M3 18h5` — *ContextualFilters:76* |

Trois rôles, sept implantations, cinq dessins distincts. Le défaut ne se voit ni au typecheck ni
au build : il faut comparer les tracés à la main. Il s'aggrave mécaniquement à chaque écran neuf.

### Le second constat : le back-office est nu

Sur les **16 écrans d'administration**, une seule icône vectorielle existe —
`BrhCirculaireList.tsx:109`. Tout le reste de l'iconographie y est **typographique** :
caractères détournés (`✔ ✓ × › → ↗ · — ★ ⠿ ⧉ ⎘`) et, dans un cas, un emoji. Construire le
back-office du prototype v4 à jeu constant reviendrait à dessiner une vingtaine de tracés
supplémentaires à la main, avec la même dérive.

---

## 2. Décision

> **La bibliothèque retenue est LUCIDE**, par le paquet `lucide-react`.

La recommandation en attente est **confirmée**, mais pour un motif différent de celui qui était
avancé. Ce n'est pas une question de forme — le jeu inline est déjà conforme — ni de poids : le
paquet est *tree-shakable*, seules les icônes importées entrent dans le lot final, et 30 icônes
représentent de l'ordre de 10 à 15 Ko avant compression. C'est une question de **source unique**.
Aujourd'hui, chaque icône est une décision de dessin prise dans un fichier ; demain, c'est un
import.

Motifs retenus :

1. **Cohérence** — un rôle, un nom, un dessin. Le défaut relevé au §1 disparaît par construction.
2. **Couverture** — le back-office est à équiper ; Lucide couvre les vingt rôles manquants sans
   dessiner un tracé.
3. **Idiome déjà en place** — la migration est une substitution, pas une refonte : les 17 icônes
   existantes sont déjà en `currentColor`, 24×24, traits 2 px, terminaisons rondes.
4. **Licence ISC**, compatible React 18 et Next 14 App Router, utilisable en composant serveur.

**Réserve d'exécution.** Les trois éléments écartés au §1 — illustration du héros, marqueur
cartographique, contrôle MapLibre — **ne sont pas substitués**. Le marqueur en particulier porte
une sémantique de légende (forme = degré de juridiction) qu'aucune icône générique ne rend.

---

## 3. Convention de nommage

**Module unique** : `src/components/icons.tsx`. Aucun import de `lucide-react` ailleurs dans
l'arborescence — le module est le seul point de contact avec la bibliothèque, ce qui rend un
changement ultérieur possible sans balayer le dépôt.

```tsx
// src/components/icons.tsx — point de contact UNIQUE avec lucide-react.
export { Search as IconRechercher, X as IconFermer, … } from 'lucide-react'
```

**Nommage** : `Icon` + rôle en français, en *PascalCase*. Le nom dit la **fonction**, jamais le
dessin — `IconSupprimer`, non `IconCorbeille` ; `IconTrier`, non `IconFleche`. Un dessin peut
changer, une fonction non. Le nom Lucide d'origine reste visible dans l'alias, ce qui permet de
retrouver la source.

**Taille** : 16 px dans un tableau ou une pastille, 20 px dans un bouton, 24 px dans un en-tête.
Exprimées en classes Tailwind (`h-4 w-4`, `h-5 w-5`, `h-6 w-6`), jamais en attribut `size`.

**Graisse** : `strokeWidth={2}` par défaut, conformément à la normalisation v3.0. Aucune icône
pleine (`fill`) hors état actif explicite — le cœur de `DocActions` est le seul cas admis.

**Couleur** : `currentColor` exclusivement. Une icône n'a jamais de couleur propre ; elle hérite
de son contexte. **Aucune icône ne porte Wouj ni Sitwon en propre** — voir AV-03.

**Accessibilité** — deux cas, sans troisième :

- icône **décorative**, doublée d'un texte visible → `aria-hidden="true"` et pas de nom
  accessible ;
- icône **seule** dans une cible cliquable → `aria-label` obligatoire sur la cible, pas sur le
  `<svg>`.

> **Règle bloquante, reprise de la v3.0** : une icône ne porte **jamais seule** un état. Tout
> état — succès, erreur, avertissement, abrogation — s'accompagne de son libellé textuel. La
> luminance Vèt/Wouj est de 1,05:1 : en daltonisme rouge-vert, une coche verte et une croix rouge
> sont le même signe gris.

**Ajouter une icône** : vérifier que le rôle n'existe pas déjà sous un autre nom, ajouter l'alias
au module, et rien d'autre. Un `<svg>` inline nouveau dans un composant est un défaut de revue.

---

## 4. Inventaire — l'existant

Dix-sept icônes, sept rôles dédoublés ramenés à un dessin unique.

| Rôle | Lucide | Emplacements actuels |
|---|---|---|
| Rechercher | `search` | `SearchBox:255`, `:349` |
| Rechercher dans le texte | `text-search` | `SearchBox:299` |
| Recherche récente | `history` | `SearchBox:308` |
| Fermer / effacer | `x` | `SearchBox:275`, `:314`, `ChampRecherche:136` |
| Filtrer | `list-filter` | `AdvancedSearch:73`, `SearchBox:338` |
| Trier | `arrow-up-wide-narrow` | `BrhCirculaireList:109`, `ContextualFilters:76`, `ThemeBrowser:620` |
| Chevron précédent | `chevron-left` | `ThemeBrowser:353` |
| Alerte de veille | `bell` | `AlertButton:42` |
| Favori | `heart` | `DocActions:36` |
| Imprimer | `printer` | `PrintButton:13` |
| Copier | `copy` | `TableActions:74` |
| Confirmation de copie | `check` | `TableActions:74` |
| Juridiction | `landmark` | `JudicialMapHeroSlide:55` |

⚠️ **`arrow-up-wide-narrow` est à confirmer à l'écran.** Les deux tracés existants dessinent des
lignes décroissantes surmontées d'une flèche montante ; Lucide distingue
`arrow-up-wide-narrow` de `arrow-up-narrow-wide` par le seul sens de la dégressivité. Le
rapprochement est fait sur le tracé, non sur le rendu : à vérifier au premier écran intégré.

### Caractères à substituer

| Caractère | Rôle | Lucide | Emplacements notables |
|---|---|---|---|
| `✔` `✓` | succès, validation | `check` | `UploadStudio`, `TableActions` |
| `×` | fermer, retirer | `x` | plusieurs |
| `›` `→` | poursuivre, lien | `chevron-right`, `arrow-right` | navigation |
| `↗` | ouvrir dans un nouvel onglet | `external-link` | liens PDF |
| `⠿` | poignée de glisser-déposer | `grip-vertical` | `SectionTiles:195` |
| `⧉` `⎘` | copier | `copy` | `CreateUserForm:57`, `TariffTable:226`, `CiteButton:119` |
| `★` | mise en avant | `star` | `LegislationAdminPanel:105` |

**Ne sont pas des icônes et ne doivent pas être substitués** : les pastilles de type (`LÉG`,
`BRH`, `JUR`, `DOC`, `FIN`, `MRK`, `IDX`, `TAR`) — la v3.0 a précisément **remplacé le codage
chromatique par un codage typographique**, y poser une icône reviendrait sur AV-01 ; les
pastilles de couleur de thème (`ThemeManager`) ; les tirets cadratins de valeur absente ; les
points médians de séparation ; le `placeholder` de champ de mot de passe.

### Collision sémantique à trancher à l'intégration

`x` est aujourd'hui employé pour deux gestes de portée opposée : **fermer ou effacer** (réversible)
et **supprimer définitivement** (irréversible, `MarqueEditor:153`, `IndexMoniteurEditor`). La
règle posée : `x` pour le premier, **`trash-2` pour le second**, sans exception. Une suppression
définitive porte en outre son libellé et une confirmation.

---

## 5. Inventaire — ce qu'il faut ajouter

Les seize écrans d'administration n'ont aujourd'hui qu'une icône vectorielle
(`BrhCirculaireList:109`). Liste par écran.

**Socle commun à tous les écrans d'administration** — rendu par `admin/layout.tsx` et
`AdminNav.tsx`, à équiper une seule fois : `arrow-left` (retour au tableau de bord), `menu`
(ouverture du menu sous le point de rupture `md`), `log-out` (déconnexion).

| Écran | Rôles propres | Lucide |
|---|---|---|
| `/admin` | indicateurs, alerte de moissonnage | `activity`, `circle-alert` |
| `/admin/users` | utilisateur, habilitation, suspendre, créer | `user`, `shield`, `user-x`, `user-plus` |
| `/admin/upload` | téléverser, fichier, succès d'extraction, retirer | `upload`, `file-text`, `check`, `x` |
| `/admin/document/[id]` | publier, dépublier, éditer, supprimer | `eye`, `eye-off`, `pencil`, `trash-2` |
| `/admin/logs` | journal, filtrer par date, exporter | `scroll-text`, `calendar`, `download` |
| `/admin/jurisprudence` | téléverser, valider, texte absent, magistrat | `upload`, `check`, `circle-alert`, `gavel` |
| `/admin/notes` | approuver, refuser, en attente | `check`, `x`, `clock` |
| `/admin/themes` | ajouter, réordonner, supprimer, replier | `plus`, `grip-vertical`, `trash-2`, `chevron-down` |
| `/admin/brh` | importer, trier, circulaire, abrogée | `download`, `arrow-up-wide-narrow`, `file-text`, `ban` |
| `/admin/moniteur` | édition, année, fac-similé | `book`, `calendar`, `file-scan` |
| `/admin/moniteur/manquants` | numéro manquant, rechercher | `circle-alert`, `search` |
| `/admin/index-moniteur` | ajouter une entrée, doublon, enregistrer | `plus`, `copy-x`, `save` |
| `/admin/marques` | ajouter, image, supprimer | `plus`, `image`, `trash-2` |
| `/admin/tarifs` | ligne tarifaire, importer, copier | `table`, `upload`, `copy` |
| `/admin/juridictions` | carte, localisation, vérifié, non localisé | `map`, `map-pin`, `badge-check`, `map-pin-off` |
| `/admin/promo` | code promotionnel, expiration, révoquer | `ticket`, `calendar-clock`, `ban` |

**Écrans publics** — déjà pourvus pour l'essentiel (§4). Restent à équiper : `/doc/[id]` →
`external-link` (ouvrir le PDF), `quote` (citer), `bookmark` (favori, en substitution du cœur si
la métaphore change) ; `/juridictions` → `map-pin`, `external-link` ; `/publications` →
`arrow-right`, `calendar` ; écrans d'authentification → `eye` / `eye-off` (afficher le mot de
passe, aujourd'hui absent).

**Total : 38 rôles distincts**, dont 13 déjà dessinés (§4) et 25 à ajouter.

Chacun est à confirmer à l'écran lors de l'intégration : cette liste est dressée sur la
plateforme **telle qu'elle existe au 16 août 2026**, et non sur le prototype homepage v4, qui n'a
pas été communiqué. Tout écran nouveau introduit par le prototype relève d'un
**addendum AV-03*bis***.

---

## 6. Exécution

1. `npm i lucide-react` — dépendance de production.
2. Créer `src/components/icons.tsx` et n'y exposer que les alias employés.
3. Substituer les 17 `<svg>` inline, en commençant par les sept rôles dédoublés — c'est là que
   le gain est immédiat.
4. Substituer les caractères détournés du tableau du §4.
5. Contrôle de non-régression, à ajouter à la suite de tests :
   - aucun `<svg` inline hors `src/components/icons.tsx`, `HeroJudicialMapArt.tsx`,
     `CourtCard.tsx` ;
   - aucun import de `lucide-react` hors `src/components/icons.tsx` ;
   - aucune icône sans `aria-hidden` ni cible portant `aria-label`.

Ces trois contrôles sont **vérifiables par script**, au même titre que « 0 Wouj en fond » et
« 0 Sitwon en texte » de la charte v3.0.

---

*Avenant établi sur relevé exhaustif du dépôt au 16 août 2026, après contre-épreuve
adversariale. Un premier relevé automatisé a été **écarté** : une citation sur dix y était
fausse, 27 balises `<svg>` y étaient revendiquées pour 20 réelles, et des éléments qui ne sont
pas des icônes — pastilles de type, tirets de valeur absente, points de séparation — y étaient
mappés sur des noms Lucide. Les chiffres du présent avenant sont issus d'un relevé refait à la
main sur les tracés.*
