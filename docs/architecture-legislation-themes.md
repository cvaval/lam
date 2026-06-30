# Législation annotée — Thématisation & références croisées

Plan d'architecture pour répertorier les textes de la **Législation annotée** (lois,
arrêtés, décrets, codes) **par thèmes**, avec des **références croisées dynamiques** vers
les autres textes de toutes les sections, et un **back-office d'ajout simple** pour le
master admin.

Document de conception. Il complète [ARCHITECTURE.md](../ARCHITECTURE.md). Les
références `§NN` renvoient au *Plan de plateforme UI/UX v1.0*. Statut : **proposé, audité,
corrigé, prototypé et testé** (voir §8) — pas encore implémenté dans le schéma de
production. Les corrections d'audit sont marquées « (post-audit) » dans le texte.

---

## 1. État des lieux (existant)

Lu dans [prisma/schema.prisma](../prisma/schema.prisma) et le code applicatif :

| Élément existant | Rôle | Limite pour la thématisation |
|---|---|---|
| `Document.type = 'LEGISLATION'` | une fiche par texte | aucun classement par thème |
| `Document.matiere` | thème grossier **texte libre** (`civil`, `fiscal`…) | non normalisé, plat, non hiérarchique, non trilingue |
| `Document.keywords` | mots-clés FR libres (`« kw1; kw2 »`), extraits par IA, éditables | tags fins, pas une taxonomie navigable |
| `Document.themeIndexJson` | index thématique **par article** d'UN code : `[{num, heading, themes[], summary}]` | intra-document, vocabulaire libre, ne classe pas le corpus |
| `Citation` (`fromId→toId`, `kind`) | renvois **document→document** | exige une cible déjà en base ; pas de renvoi vers un **article** ; **aucune UI d'édition** (scripts seulement) ; cassé par ré-import |
| `Document.abrogatedByNumber` | renvoi « abrogé par n° … » résolu par numéro | **codé en dur sur `type='CIRCULAIRE_BRH'`** — inutilisable pour la Législation |

**Manque central** : aucune **taxonomie de thèmes normalisée et hiérarchique au niveau
du corpus**. La taxonomie douanière (27 thèmes de `themeIndexJson`) est fixe, en JSON,
spécifique à un seul document, non extensible.

Cette proposition comble ce manque **sans casser l'existant** : `matiere`/`keywords`
restent (tags fins + compat), `themeIndexJson` reste (index par article), et l'on ajoute
une couche normalisée par-dessus.

---

## 2. Modèle de données proposé

Trois tables, branchées sur le `Document` existant. **Schéma validé par `prisma validate`.**

```
        ┌────────────┐      ┌──────────────────┐      ┌────────────┐
        │  Document  │◄────►│  DocumentTheme   │◄────►│   Theme    │──┐ parentId
        │ (existant) │ 1   N│  isPrimary       │N    1│ (taxonomie)│◄─┘ (auto-réf.)
        └─────┬──────┘      └──────────────────┘      └────────────┘
              │  N    ┌──────────────┐
              └──────►│   CrossRef   │  cible résolue (toId) OU par désignation
              ◄───────│ (renvois)    │  (toType+toNumber) + ancre article (toAnchor)
                 N    └──────────────┘
```

### 2.1 `Theme` — taxonomie hiérarchique, trilingue (corpus)

```prisma
model Theme {
  id       String  @id @default(cuid())
  slug     String  @unique           // stable & IMMUABLE : "droit-du-travail"
  labelFr  String
  labelEn  String?
  labelHt  String?
  parentId String?                   // liste d'adjacence (Droit social › Droit du travail › …)
  parent   Theme?  @relation("ThemeTree", fields: [parentId], references: [id], onDelete: Restrict)
  children Theme[] @relation("ThemeTree")
  position Int     @default(0)        // ordre entre frères (réordonnable à l'admin)
  color    String?                    // pastille (charte Lam)
  icon     String?
  active   Boolean @default(true)
  documents DocumentTheme[]
  @@index([parentId])
}
```

- **Liste d'adjacence** (`parentId`) → arbre à profondeur libre, **aucun champ dérivé à
  maintenir** (post-audit : on a retiré le `path`/`depth` matérialisé, qui cassait au
  renommage d'un slug et imposait un recalcul en cascade au déplacement).
- **Sous-arbre via CTE récursive** (cf. §4) — trivial pour une taxonomie de quelques
  dizaines/centaines de thèmes. *Option Postgres native : `ltree` (extension Supabase) si
  l'on veut une indexation hiérarchique ; non requis à cette échelle.*
- **`slug` immuable** : clé stable pour les URLs et le mapping `themeIndexJson` ; on
  renomme les libellés, jamais le slug.
- **Trilingue** (FR officiel + EN/HT éditoriaux, §02).
- `onDelete: Restrict` → interdit de supprimer un thème ayant des enfants.

### 2.2 `DocumentTheme` — rattachement multi-thèmes, un principal

```prisma
model DocumentTheme {
  documentId String
  document   Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  themeId    String
  theme      Theme    @relation(fields: [themeId], references: [id], onDelete: Cascade)
  isPrimary  Boolean  @default(false) // thème de tête (fil d'Ariane) — ≤ 1 par doc
  assignedBy String?                  // "ADMIN" | "AI" | userId
  createdAt  DateTime @default(now())
  @@id([documentId, themeId])
  @@index([themeId])
}
```

- **M:N** → un texte peut vivre dans **plusieurs thèmes**. Cohérent avec la règle
  **« reclasser = copier, pas déplacer »** (double-listage par défaut) : on *rattache*
  sans retirer de l'autre thème.
- **Un seul thème principal** par document, garanti **au niveau applicatif** (post-audit) :
  poser un principal débascule les autres dans la **même transaction** —
  `updateMany(… isPrimary=false)` puis `update(… isPrimary=true)`. C'est plus robuste que
  de dépendre d'un index Prisma ne gère pas (voir ci-dessous).

  ```sql
  -- Défense en profondeur OPTIONNELLE. Prisma ne génère pas l'index partiel et un
  -- `db push`/`migrate` ultérieur pourrait le supprimer : à porter dans un fichier de
  -- migration GÉRÉ si on le conserve.
  CREATE UNIQUE INDEX "DocumentTheme_one_primary"
    ON "DocumentTheme"("documentId") WHERE "isPrimary" = true;
  ```

### 2.3 `CrossRef` — référence croisée dynamique, inter-sections

Généralise `Citation` **et** `abrogatedByNumber` en un seul mécanisme :

```prisma
model CrossRef {
  id       String    @id @default(cuid())
  fromId   String
  from     Document  @relation("RefFrom", fields: [fromId], references: [id], onDelete: Cascade)
  toId     String?                          // cible RÉSOLUE si le doc existe…
  to       Document? @relation("RefTo", fields: [toId], references: [id], onDelete: SetNull)
  toType   String?                          // …sinon cible par DÉSIGNATION (robuste au ré-import)
  toNumber String?                          //   ex. "Loi du 10 septembre 2009"
  toAnchor String?                          // renvoi vers un article : "art-12"
  toLabel  String?                          // libellé affiché tant que non résolu
  kind     String    @default("CITE")       // CITE|COMMENTE|MODIFIE|ABROGE|APPLIQUE|VOIR
  note     String?
  source   String    @default("EDITORIAL")  // EDITORIAL | AUTO (extrait IA)
  position Int       @default(0)
  createdAt DateTime @default(now())
  @@index([fromId])
  @@index([toId])
  @@index([toType, toNumber])               // résolution dynamique par désignation
}
```

Le « **convivial et dynamique** » tient ici :

- **Renvoi vers un article précis** (`toAnchor = "art-12"`) — réutilise les ancres
  `#art-N` unifiées dans [src/lib/doc/anchors.ts](../src/lib/doc/anchors.ts).
- **Renvoi « pendant »** : on peut citer un texte **pas encore importé** (`toType +
  toNumber`). Dès que l'admin l'importe avec la même désignation, **le lien se résout
  seul, sans ré-édition**.
- **Rétroliens** trans-sections (« quels textes citent celui-ci ? ») : une jurisprudence
  ou une doctrine qui cite une loi apparaît automatiquement sur la fiche de la loi.
- **Robuste au ré-import** : la résolution par numéro survit au changement d'`id`.
- **Lève une limite réelle** : la résolution de `abrogatedByNumber` est aujourd'hui
  codée en dur sur les circulaires BRH ; `CrossRef` l'étend à toutes les sections.

**Résolution — DÉTERMINISTE (post-audit).** `Document.number` **n'est pas unique** (des
doublons existent réellement dans le corpus) : une jointure naïve sur `(type, number)`
pourrait pointer le mauvais texte. On privilégie donc `toId`, et en mode désignation on
résout vers **un seul** texte — en vigueur d'abord, puis le plus récent :

```sql
SELECT COALESCE(
  r."toId",
  ( SELECT d.id FROM "Document" d
    WHERE d.type = r."toType" AND d.number = r."toNumber"
    ORDER BY (d.status = 'EN_VIGUEUR') DESC, d."publicationDate" DESC NULLS LAST
    LIMIT 1 )
) AS "resolvedId"
FROM "CrossRef" r WHERE r.id = $1;     -- NULL = renvoi encore pendant
```

Si plusieurs textes partagent la désignation, le **sélecteur de renvois avertit l'admin**
(badge « cible ambiguë ») qui peut figer la cible via `toId`. Au rendu d'une fiche, les
renvois se **résolvent en lot** (une requête, pas de N+1).

**Rétroliens d'un document X** :

```sql
SELECT DISTINCT r."fromId" FROM "CrossRef" r
WHERE r."toId" = $X
   OR (r."toId" IS NULL AND r."toType" = $type AND r."toNumber" = $number);
```

### 2.4 Contrôle d'accès §03 — à appliquer partout (post-audit)

La recherche borne déjà ses résultats par `accessibleTypes(user)`
([search/route.ts](../src/app/api/search/route.ts)). **La couche thématique doit faire de
même**, sinon elle fuite des titres de documents hors-service et crée des liens morts :

- **Navigation par thème** : la liste des documents d'un thème est filtrée par
  `accessibleTypes(user)` (l'Index toujours ; le staff voit tout). Un thème dont aucun
  texte n'est accessible n'apparaît pas pour ce compte.
- **Renvois (`CrossRef`)** : un renvoi vers un type non accordé est rendu **sans lien**
  (libellé seul). La fiche document gate déjà l'ouverture
  ([page.tsx:57](../src/app/[locale]/(app)/doc/[id]/page.tsx)) — donc pas de fuite de
  *contenu* —, mais on évite ainsi les liens qui retombent en redirection.

---

## 3. Taxonomie de thèmes (graine initiale)

Arbre éditable au back-office, **dérivé de `secteurs.docx`** (structure sectorielle
haïtienne fournie par la cliente) — orthographe corrigée et regroupements mineurs. Trois
niveaux : **Domaine** (profondeur 0) › **Secteur / thème** (1) › **sous-thème** (2,
optionnel). Les libellés entre parenthèses sont des **textes d'exemple** (des `Document`
rattachés au thème), **pas** des nœuds de l'arbre.

```
Constitution & droits fondamentaux                        [constitution]
   ( Constitution )
Droit privé                                               [droit-prive]
  ├─ Droit civil                                          ( Code civil )
  ├─ Signature & échange électronique
  └─ Obligations · biens · sûretés
Droit économique & des affaires                           [economique]
  ├─ Commerce & industrie        ( Code de commerce · Décret sur les sociétés anonymes · Code des investissements )
  │     └─ Propriété intellectuelle   ( Marques de fabrique · Brevets · Droit d'auteur )
  ├─ Agriculture, ressources naturelles & développement rural   ( Code rural )
  ├─ Aménagement du territoire
  ├─ Travaux publics, transports & communications         ( Mines & carrières · CONATEL )
  ├─ Environnement                                        ( Code de l'environnement )
  └─ Tourisme
Droit fiscal & douanier                                   [fiscal-douanier]
  ├─ Fiscalité / impôts (DGI)     ( Décret 2005 sur l'impôt sur le revenu · Code fiscal Paillant )
  ├─ Lois de finances
  └─ Tarifs douaniers
Social                                                    [social]
  ├─ Droit du travail & sécurité sociale
  ├─ Santé publique
  ├─ Éducation
  └─ Jeunesse & sport
Droit public & administratif                              [droit-public]
  ├─ Justice
  ├─ Élections                                            ( Décret électoral )
  ├─ Finances publiques & contrôle   ( Cour supérieure des comptes et du contentieux administratif )
  ├─ Administration centrale de l'État
  ├─ Affaires étrangères
  └─ Intérieur & collectivités territoriales
Droit pénal                                               [penal]
  ├─ Droit pénal général                                  ( Code pénal )
  └─ Procédure pénale                                     ( Code d'instruction criminelle )
```

> Cette graine n'est qu'un **point de départ** : le master admin **ajoute, renomme,
> déplace ou retire** des thèmes à volonté (§5.4) — la taxonomie n'est jamais figée dans
> le code.

Le domaine **« Droit fiscal & douanier »** est volontairement **transversal aux
sections** : comme `Theme`/`DocumentTheme` opèrent sur tout le corpus (pas seulement la
Législation), il regroupe sous un même fil les textes de Législation, les **Lois de
finances** (section §5) et les **Tarifs douaniers** (section §8) — illustration directe
de la navigation thématique inter-sections.

**Deux axes orthogonaux**, tous deux navigables, à ne pas confondre :

- **Nature de l'instrument** : loi / décret / arrêté / code (réutilise `Document.category`,
  déjà `LOI | DECRET | ARRETE`).
- **Thème** : la taxonomie ci-dessus (`Theme`).

> Un texte = (nature : Décret) × (thème principal : Sociétés anonymes) × (thèmes
> secondaires : Droit économique).

---

## 4. Recherche & navigation (l'« index » convivial)

- **Page « Législation par thèmes »** : arbre pliable ; un clic descend dans le
  sous-arbre (**CTE récursive**) et liste les textes **héritage compris** (cliquer
  « Économique » montre aussi sociétés anonymes et marques), **filtrés par accès (§2.4)**.
  S'insère sous le slug `legislation` du registre [src/lib/brand.ts](../src/lib/brand.ts)
  (`DOC_TYPE_META`).
- **Filtre thème sur la recherche** : facette « Thème » ajoutée au moteur. Concrètement :
  - injecter les **libellés de thèmes dans `Document.searchText`** (préfiltrage SQL) ;
  - ajouter un **champ `themes` pondéré** au barème
    [src/lib/search/fields.ts](../src/lib/search/fields.ts) (`SEARCH_FIELD_WEIGHTS` :
    `keywords^4`, `matiere^3`, `bodyOriginal^1`) ;
  - propager aussi vers le **document OpenSearch** (la recherche utilise Postgres FTS
    *et* OpenSearch — indexation incrémentale best-effort à l'upload).
- **Réindexation (post-audit)** : les thèmes sont posés **après** la publication, dans une
  action séparée — toute écriture `DocumentTheme` doit donc déclencher un
  **`reindexDocument(id)` partagé** qui recalcule `searchText` ET ré-indexe le document
  dans OpenSearch. Sans ce hook, la recherche par thème serait incohérente.
- **Autocomplétion** : `/api/search/suggest` (titres/numéros/sociétés) + **thèmes**.
- **« Thèmes proches »** sur une fiche : thèmes frères/voisins dans l'arbre.
- **Articulation avec `themeIndexJson`** (post-audit : couplage **lâche**) :
  `DocumentTheme` est la **source de vérité** du classement ; l'index par article reste
  **en affichage seul** dans le [CodeThemeBrowser.tsx](../src/components/CodeThemeBrowser.tsx).
  Un mapping **best-effort** des `themes[]` d'article vers les slugs de la taxonomie est
  proposé à l'admin (pas forcé), pour éviter toute perte sémantique.

---

## 5. Back-office master admin — ajout simple & convivial

L'écran d'ajout existant est [UploadStudio.tsx](../src/components/UploadStudio.tsx) +
[/api/admin/upload](../src/app/api/admin/upload/route.ts) ; l'admin y édite déjà
`keywords` et `matiere`. On y greffe trois blocs :

1. **Sélecteur de thèmes** — arbre à cases (logique de
   [CodeThemeBrowser.tsx](../src/components/CodeThemeBrowser.tsx)) : multi-sélection +
   bouton « principal ». Écrit des `DocumentTheme`.
2. **Sélecteur de renvois** — champ type-ahead cherchant **dans toutes les sections**
   (titre/numéro) ; on choisit la cible, puis éventuellement **l'article** (liste des
   `art-N` détectés via `anchors.ts`), le **type de lien** et une note. Onglet « par
   numéro » pour référencer un texte **pas encore en base** (renvoi pendant).
   > Première UI d'édition de liens : aujourd'hui `Citation` n'est peuplé que par scripts.
3. **Assistance IA (optionnelle)** — réutilise [src/lib/ai/keywords.ts](../src/lib/ai/keywords.ts)
   / [src/lib/ai/extract.ts](../src/lib/ai/extract.ts) pour **suggérer les thèmes** et
   **détecter les citations dans le corps** (« Décret du 9 avril 2020 », « art. 1110
   C. civ. ») → l'admin **confirme d'un clic** (`source: AUTO` → `EDITORIAL`).

### 5.4 Gestion de la taxonomie — ajouter / retirer des thèmes

Le master admin **gère librement l'arbre** depuis le back-office (exigence explicite : la
liste des thèmes doit pouvoir grandir et se réduire dans le temps) :

- **Ajouter** un thème : nom trilingue + parent + couleur (la profondeur découle de
  l'arbre — aucun champ dérivé à calculer).
- **Renommer / recolorer / réordonner**, et **déplacer** sous un autre parent
  (glisser-déposer) avec **garde anti-cycle** (un thème ne peut pas devenir l'enfant de
  son propre descendant) — en liste d'adjacence, le déplacement est atomique : un seul
  `parentId` à changer, rien à recalculer.
- **Retirer** un thème, selon une politique sûre (deux modes) :
  - **Archiver** (`active = false`) — *recommandé par défaut* : le thème disparaît de la
    navigation et des filtres, mais ses rattachements et l'historique sont **préservés**
    (geste réversible).
  - **Supprimer définitivement** — autorisé seulement si le thème **n'a pas d'enfant**
    (`onDelete: Restrict`). S'il porte des documents, l'admin choisit de **réaffecter**
    les `DocumentTheme` au thème parent (`?reassignTo=`) ou de simplement les **détacher**
    (`onDelete: Cascade` nettoie les liens — **les documents eux-mêmes ne sont jamais
    touchés**).

API alignée sur les conventions, protégée par `requireAdminApi`, journalisée en
`AuditLog` :

| Route | Action | Audit |
|---|---|---|
| `POST /api/admin/themes` | créer | `THEME_CREATED` |
| `PATCH /api/admin/themes/:id` | renommer · recolorer · déplacer · archiver | `THEME_UPDATED` / `THEME_ARCHIVED` |
| `DELETE /api/admin/themes/:id?reassignTo=` | supprimer (avec réaffectation) | `THEME_DELETED` |
| `POST /api/admin/themes/reorder` | réordonner entre frères | `THEME_UPDATED` |

Le rattachement des documents et les renvois se journalisent de même (`DOC_THEMED`,
`CROSSREF_ADDED`) via l'extension de la route d'édition de document.

---

## 6. Plan de migration & déploiement

1. `prisma migrate` pour les 3 tables. L'unicité du thème principal est assurée **au
   niveau applicatif** (§2.2) ; si l'on garde l'index partiel en défense, le poser dans un
   **fichier de migration géré** (sinon un `db push` ultérieur le supprime).
2. **Backfill** (scripts idempotents) :
   - `Citation` → `CrossRef` (1:1 sur `kind`, `toId` renseigné, dériver `toType/toNumber`) ;
   - `abrogatedByNumber` → `CrossRef` (`kind: ABROGE`, par désignation) ;
   - `matiere` / `keywords` / `themeIndexJson` → `DocumentTheme` initiaux (heuristique +
     IA), **revus par l'admin**. Ensuite `matiere` devient un **cache du thème principal**
     (ou est déprécié) pour ne pas entretenir deux vocabulaires concurrents en recherche.
3. **Pièges connus à intégrer** :
   - régénérer le **client Prisma après `db push`** (sinon client périmé) ;
   - index `pg_trgm` posés en `CREATE INDEX CONCURRENTLY` côté Supabase ; si l'on opte
     pour `ltree`, activer l'extension et la déclarer `Unsupported` côté Prisma ;
   - **ré-import** = ne pas écraser les `DocumentTheme`/`CrossRef` éditoriaux (les
     renvois par désignation y survivent justement) ;
   - propager les thèmes **dans les deux moteurs** via `reindexDocument(id)` (§4) :
     `searchText` *et* OpenSearch.

---

## 7. Garanties d'intégrité

- `Theme.parentId` FK + `onDelete: Restrict` → pas de thème orphelin, pas de suppression
  d'un thème ayant des enfants.
- `DocumentTheme` PK composite `(documentId, themeId)` → pas de doublon de rattachement.
- **Au plus un** thème principal par document — garanti côté applicatif (transaction),
  + index partiel optionnel en défense en profondeur (§2.2).
- **Filtrage d'accès §03** appliqué à la navigation par thème et au rendu des renvois (§2.4).
- Garde applicative **anti-cycle** sur le déplacement d'un thème.
- Garde applicative **anti auto-référence** sur les renvois (`fromId ≠ toId`).
- `CrossRef.to` `onDelete: SetNull` → la suppression d'une cible ne casse pas le renvoi
  (il retombe en mode « par désignation », résolu si la cible revient).

---

## 8. Tests effectués

Architecture **prototypée et exécutée en isolation** — re-testée après audit sur la
**version corrigée** :

- **`prisma validate`** sur le schéma corrigé → **valide** (relations, auto-référence,
  contraintes, index corrects).
- **Test fonctionnel** des requêtes réelles sur SQLite (taxonomie Économique/Social/Pénal
  + documents trans-sections + renvois + amendements) → **35/35 assertions** :
  - navigation hiérarchique par **CTE récursive** (plus de `path`) ;
  - documents d'un thème, héritage compris, **filtrés par accès §03** ;
  - **thème principal au niveau applicatif** (`setPrimary` transactionnel) + index partiel
    en défense (2ᵉ direct refusé) ;
  - renvois inter-sections résolus + rétroliens ;
  - renvoi pendant résolu dynamiquement à l'import ; **résolution DÉTERMINISTE quand le
    numéro est dupliqué** (→ version en vigueur la plus récente, un seul id) ;
  - **ajout / archivage / suppression de thèmes** (réaffectation au parent ; refus si
    enfants) ;
  - **amendements au niveau article** (§9) : version en vigueur, historique conservé,
    **≤ 1 version en vigueur**, **chaîne** d'amendements, article abrogé masqué en vue
    allégée, instrument modificateur résolu ;
  - garde-fous : FK, `RESTRICT`, dédup, anti-cycle, anti auto-référence.
- **Limite honnête** : le prototype tourne sur **SQLite** ; `ltree`, le comportement de
  l'index partiel sous `prisma migrate` et `pg_trgm` (Postgres) ne sont pas exercés — le
  test prouve la **logique relationnelle**, pas le comportement Postgres exact.

---

## 9. Amendements au niveau article (versions & lecture allégée)

Besoin : indiquer (automatiquement **ou** manuellement, au back-office) qu'un **article**
a été **amendé**, ajouter sa **nouvelle version**, puis permettre au lecteur de **déplier
l'ancienne version** ou de la **masquer** pour ne lire que les articles **en vigueur**.

Principe directeur : **`bodyOriginal` reste canonique et intouché (§02)**. Les amendements
sont une **couche overlay par article**, fusionnée au rendu. Un article jamais amendé n'a
aucune ligne d'overlay — il se lit directement depuis `bodyOriginal`. Granularité
**article**, complémentaire du `DocumentVersion` (instantané du texte entier) existant.

### 9.1 Modèle — `ArticleVersion`

```prisma
model ArticleVersion {
  id            String    @id @default(cuid())
  documentId    String
  document      Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  anchor        String    // "art-95-bis" — clé de l'article (src/lib/doc/anchors.ts)
  label         String?   // "Article 95 bis" (affichage)
  body          String    // texte officiel de CETTE version
  status        String    @default("EN_VIGUEUR") // EN_VIGUEUR | MODIFIE | ABROGE
  effectiveDate DateTime?
  amendedByDocId  String?  // instrument modificateur (résolu)…
  amendedByNumber String?  // …ou par désignation (robuste au ré-import, comme CrossRef)
  supersedesId  String?    // version précédente remplacée (chaîne)
  note          String?    // "Modifié par la loi du … art. 4"
  origin        String     @default("MANUAL") // MANUAL | AUTO (détecté par IA)
  seq           Int        @default(0)
  createdAt     DateTime   @default(now())
  @@index([documentId, anchor])
  @@index([amendedByDocId])
}
```

- **Version en vigueur** d'un article = la ligne `status = EN_VIGUEUR` (≤ 1 par
  `(documentId, anchor)`, garanti **côté applicatif** dans une transaction + index partiel
  en défense — même pattern que le thème principal).
- **Historique** = les lignes `MODIFIE`/`ABROGE`, ordonnées par `seq`/`effectiveDate`.
- **Original matérialisé paresseusement** : au **1ᵉʳ** amendement, on *snapshote* le texte
  d'origine (depuis `bodyOriginal`) en une ligne `MODIFIE`, puis on ajoute la nouvelle
  version `EN_VIGUEUR`. Les articles non amendés n'occupent rien.
- **Lien modificateur** résolu comme un `CrossRef` (déterministe, par désignation si le
  texte modificateur n'est pas encore importé).

### 9.2 Back-office — automatique **et** manuel

- **Manuel** : dans l'éditeur, l'admin choisit un article (liste détectée via
  `anchors.ts`), clique **« Marquer comme amendé »**, colle le **nouveau texte officiel**,
  saisit la date d'entrée en vigueur, **lie l'instrument modificateur** (réutilise le
  sélecteur de renvois `CrossRef`), ajoute une note → crée une `ArticleVersion`.
- **Automatique** : à l'ajout d'un texte **modificateur**, l'IA
  ([extract.ts](../src/lib/ai/extract.ts)) détecte les formules « *modifie l'article 95 de
  [loi Y]* », « *l'article 12 est abrogé* » → **propose** la cible (document + article), le
  nouveau texte et la date → l'admin **confirme d'un clic** (`origin: AUTO`).
- Les deux chemins produisent la même `ArticleVersion`, **audités** (`ARTICLE_AMENDED`,
  `ARTICLE_ABROGATED`).

### 9.3 Lecture — déplier / replier l'ancienne version, ou « en vigueur seulement »

`OfficialText` reçoit les amendements **indexés par ancre** et fusionne au rendu :

- Par défaut : chaque article amendé affiche sa **version en vigueur** + une petite
  **icône « modifié »** près de l'en-tête.
- **Clic sur l'icône** → **déplie** l'ancienne version (repliée par défaut) sous l'article
  (« voir l'ancienne version ») ; **re-clic** → la **replie**.
- **Bascule globale « Version allégée / en vigueur seulement »** : masque toutes les
  anciennes versions **et** les articles abrogés → lecture épurée des seuls articles en
  vigueur.
- `bodyOriginal` n'est jamais modifié : l'overlay est purement à l'affichage (§02).

### 9.4 Tests

`prisma validate` → **valide** ; assertions fonctionnelles **incluses dans les 35/35**
(§8) : version en vigueur après amendement, historique conservé, **≤ 1 version en vigueur**
(index partiel), **chaîne** d'amendements (en vigueur = la plus récente, historique = N),
article **abrogé** sans version en vigueur, **vue allégée** (abrogés masqués), résolution
**déterministe** de l'instrument modificateur.

---

## 10. Résumé

On ajoute **`Theme`** (arbre trilingue) + **`DocumentTheme`** (multi-rattachement, un
principal) + **`CrossRef`** (renvois résolus *ou* par désignation, vers le texte ou
l'article) + **`ArticleVersion`** (amendements au niveau article, lecture allégée) ; on
généralise `Citation`/`abrogatedByNumber` dedans ; on branche l'arbre sur la recherche
(FTS + OpenSearch) et sur un back-office qui prolonge `UploadStudio`. Après audit, la
hiérarchie passe en **liste d'adjacence + CTE** (le `path` matérialisé est retiré), la
résolution des renvois devient **déterministe**, le **filtrage d'accès §03** est appliqué à
la navigation thématique, l'unicité du thème principal passe **côté applicatif** et un
**`reindexDocument`** garde la recherche cohérente. Le tout re-testé (**35/35**) et
compatible avec le corpus actuel.
