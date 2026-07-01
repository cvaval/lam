# Architecture en base — Code du travail annoté

> Extraction de l'état réel en base de production (Supabase Postgres + OpenSearch),
> document `source = CODE_TRAVAIL_ANNOTE`. Généré le 30 juin 2026.

## 1. Principe

**Un seul `Document`** contient tout le Code du travail haïtien *et* ses lois connexes
(sections internes) ; les lois connexes ne sont **pas** des documents séparés. Les
annotations (jurisprudence, table des matières, index, renvois croisés) vivent **hors** du
texte officiel, dans une colonne JSON dédiée — `bodyOriginal` reste le texte légal intact (§02).

```
Postgres
 ├─ Document (1 ligne)  ── source=CODE_TRAVAIL_ANNOTE
 │    ├─ bodyOriginal      texte officiel (429 Ko)         ← §02, jamais altéré
 │    ├─ annotationsJson   structure d'affichage (316 Ko)  ← TOC, jurisprudence, index, renvois
 │    ├─ searchText        texte folé (430 Ko)             ← recherche (FTS + OpenSearch)
 │    └─ themeLabels       libellés de thèmes dénormalisés ← recherche par thème
 ├─ Theme  ── Social › Droit du travail › Code du travail › {9 chapitres, 9 connexes}
 └─ DocumentTheme (19)  ── rattachements, dont 18 ancrés (#sec-N)
OpenSearch
 └─ index lam_doctrine  ── le doc (type DOCTRINE) indexé pour la recherche prod
```

## 2. Le `Document`

| Champ | Valeur | Rôle |
|---|---|---|
| `id` | `cmr102ish0012ttoijkh8f31e` (cuid, **change à chaque ré-import**) | clé primaire |
| `source` | `CODE_TRAVAIL_ANNOTE` | **clé d'idempotence** (purge/recrée à l'import) |
| `type` | `DOCTRINE` | gouverne l'accès (§03) + l'index OpenSearch (`lam_doctrine`) |
| `status` | `EN_VIGUEUR` | statut affiché |
| `titleFr` | `Code du Travail` | — |
| `number` | `Décret du 24 février 1984` | — |
| `author` | `Jean-Frédéric Salès` | annotateur (jurisprudence) |
| `matiere` | `social` | — |
| `bodyOriginal` | **429 Ko** | texte officiel structuré (titres, chapitres, articles) — **sans** jurisprudence |
| `annotationsJson` | **316 Ko** | structure d'affichage (cf. §3) |
| `searchText` | **430 Ko** | `bodyOriginal` folé, recalculé par `reindexDocument` |
| `themeLabels` | libellés des thèmes | dénormalisé pour la recherche par thème |
| `sealed` | `false` | — |

`richBlocksJson`, `themeIndexJson` : **null** (non utilisés pour ce document).

## 3. `annotationsJson` — structure d'affichage

Produite par le parseur (`parse_ct.py`), lue par `parseAnnotations` (coercition défensive),
consommée par le lecteur (`AnnotatedText`, `CodeSidebar`) et l'API de recherche.

| Clé | Contenu actuel | Usage |
|---|---|---|
| `title`, `annotationAuthor` | « Code du Travail », « Jean-Frédéric Salès » | en-tête |
| `navToc` | **arbre à 3 niveaux** : 2 groupes → *Code* (9 livres → chapitres) + *Lois connexes* (9 annexes → divisions) | sommaire (`CodeSidebar`) |
| `toc` | **206 entrées** `{level, label, anchor: sec-N, kind}` — kinds : `title` 5, `code` 140, `chapter` 41, `section` 11, `connexe` 9 | découpage du corps + ancres `#sec-N` |
| `connexes` | **9** `{title, anchor}` | sous-thèmes connexes + deep-links |
| `jurisprudence` | **82 articles / 286 arrêts**, clés **`sec-K\|art-N`** (qualifiées par section, anti-collision Code↔annexes) | blocs repliables sous les articles |
| `indexEntries` | **652** `{subject, ctRefs:[n]}` (ex. `{"Accident du travail",[451,452,453,454]}`) | index alphabétique + renvois cliquables |
| `crossRefs` | **1** : `{anchor:"sec-93", articles:[225]}` (Liberté syndicale → art. 225) | renvois croisés éditoriaux |

**Le corps n'est pas dupliqué** dans `annotationsJson` : le lecteur re-segmente `bodyOriginal`
à l'affichage (`segmentAnnotated`), en appariant chaque en-tête à son libellé `toc` (dans
l'ordre) pour poser les ancres `#sec-N`, et détecte les articles (`#art-N`) pour la jurisprudence.

## 4. Colonnes de schéma (additives)

Deux colonnes ajoutées (via `prisma db push`, sans migration destructrice) :

- `Document.annotationsJson  String?` (text) — structure d'affichage ci-dessus.
- `DocumentTheme.anchor      String?` — ancre `sec-N` d'un sous-thème vers **sa** section interne
  (deep-link `/doc/[id]#sec-N`).

## 5. Arbre de thèmes

```
Social
└─ Droit du travail & sécurité sociale
   └─ Code du travail            slug=code-du-travail, couleur #F4A823 (soley)
      ├─ [9 chapitres/livres]    « Du contrat individuel de travail », « Des conflits… »…
      └─ [9 lois connexes]       « ANNEXE I — … », « ANNEXE II — Code de procédure civile »…
```

**`DocumentTheme` : 19 rattachements** (`assignedBy = IMPORT`) :
- **1 principal** → `code-du-travail` (sans ancre : ouvre le doc en tête) ;
- **18 ancrés** → chaque chapitre / loi connexe porte son `anchor = sec-N`, résolu en
  `/doc/[id]#sec-N` par `documentsInTheme` → API `theme-docs` → `ThemeBrowser`.

## 6. Recherche

- **Postgres FTS** : index trigram sur `searchText` (repli).
- **OpenSearch (prod)** : le doc indexé dans **`lam_doctrine`** (par type). `reindexDocument`
  recalcule `searchText` + `themeLabels` et pousse vers OpenSearch.
  ⚠ La suppression d'un doc **ne le désindexe pas** automatiquement d'OpenSearch (lacune
  plateforme) — l'import purge donc explicitement l'ancien id de `lam_doctrine`.
- **Recherche *dans* le Code** (au fil de la frappe) : `/api/legislation/code-search`
  segmente le doc (cache LRU), apparie par mots (débit 90/min) et, en option, étend aux
  thèmes proches via **Gemini** (repli Claude, 15/min, timeout 7 s).

## 7. Reproduction (hors dépôt)

Le parseur `parse_ct.py` et l'import `scripts/_import-code-travail.ts` **ne sont pas versionnés**
(chemin scratchpad éphémère). Sources : `Code_du_travail_annote_RECONSTITUE_2.docx` +
`INDEX ALPHABÉTIQUE DES MATIÈRES.docx`. Ré-import = purge (base + OpenSearch) puis recrée par
`source=CODE_TRAVAIL_ANNOTE` ; **l'`id` change** (mettre à jour les liens via la navigation
par thème, pas par id figé). Les renvois croisés éditoriaux (`CROSSREFS`) sont résolus par
libellé de section à l'import.
