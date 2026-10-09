# Carte judiciaire d'Haïti — installation, données, maintenance

**Page publique** : `/{locale}/juridictions` (hors groupe authentifié — aucune connexion
requise, aucune indication tarifaire). **Console** : `/{locale}/admin/juridictions`
(MASTER_ADMIN). **Hero** : carrousel à deux diapositives sur `/{locale}` (visiteurs).

## Architecture

| Élément | Emplacement |
|---|---|
| Référentiel d'amorçage (source de vérité) | `data/judicial-map/seed-v1.json` |
| Modèles | `prisma/schema.prisma` → `JudicialDepartment/Arrondissement/Commune/PostalCode`, `Court`, `CourtCommuneJurisdiction`, `Notary` |
| Import | `scripts/import-judicial-map.ts` ; notaires : `scripts/import-notaires-mjsp.ts` |
| Registre des couches de la carte | `src/lib/jurisdictions/layers.ts` (voir « Couches de la carte ») |
| Notaires (liste du MJSP) | amorçage `data/judicial-map/notaires-mjsp-v1.json`, extraction `scripts/data/notaires-mjsp/`, plan `src/lib/jurisdictions/notaires-plan.ts` |
| Prétraitement cartographique | `scripts/build-judicial-map-geo.py` (shapely) |
| Limites administratives servies | `public/maps/hti/*.geojson` + `metadata.json` |
| Bibliothèques | `src/lib/jurisdictions/` (constants, normalize-place, search-places, seed-schema, import-plan, data) |
| API publiques | `/api/public/jurisdictions/{search, communes/[id], map-points, notaires/map-points}` |
| Pages publiques | `/{locale}/juridictions` (carte + fiche) ; `/{locale}/juridictions/notaires` (notaires par juridiction) |
| API admin | `/api/admin/jurisdictions` (GET, PATCH — audit `JUDICIAL_UPDATED`) |
| Composants | `src/components/jurisdictions/`, `src/components/home/` |

## Installation

```bash
npm install                 # inclut maplibre-gl
npx prisma db push          # modèles additifs
npx tsx scripts/import-judicial-map.ts --file data/judicial-map/seed-v1.json --dry-run
npx tsx scripts/import-judicial-map.ts --file data/judicial-map/seed-v1.json --apply
```

L'import est **idempotent** (upsert par identifiant stable), refuse tout fichier dont les
comptes de référence divergent (10/149/149/23/149/185/5/1), ne supprime **jamais**
implicitement, et trace `JUDICIAL_IMPORT` dans l'AuditLog. Deux passages successifs :
`créations : 0 · inchangés : 1210`.

## Mise à jour du référentiel

1. Produire un nouveau `seed-vN.json` (mêmes identifiants stables pour ce qui perdure).
2. `--dry-run` : lire le rapport (créations/modifications/inchangés/anomalies/orphelins).
3. `--apply`. Les enregistrements retirés du fichier sont **signalés et conservés** ;
   une éventuelle suppression est une décision éditoriale séparée (console admin →
   désactiver, jamais supprimer).

## Mise à jour du fond de carte (COD-AB)

Source épinglée : **COD-AB HTI** (CNIGS, diffusé par OCHA/ITOS via HDX), licence
**CC BY-IGO** — URL et empreinte SHA-256 dans `public/maps/hti/metadata.json`.
Le service HDX n'est **jamais** appelé par les visiteurs : la copie transformée est
versionnée dans le dépôt et servie par `/maps/hti/*` (immuable côté CDN).

```bash
curl -L -o /tmp/hti.zip "<sourceUrl de metadata.json>"
python3 -m pip install --user shapely
python3 scripts/build-judicial-map-geo.py --zip /tmp/hti.zip
```

Le script : joint les 140 communes COD-AB aux 149 communes légales (table EN→FR des
départements + 7 correspondances d'orthographe justifiées), simplifie (Douglas-Peucker,
5 décimales), calcule les **centroïdes documentés** (points représentatifs de la géométrie
officielle), dissout les **42 arrondissements** (jamais sur géométrie partielle sans le
signaler), et écrit `data/judicial-map/rapport-jointure.md`. Relancer ensuite l'import
(`--apply`) pour propager centroïdes et clés de géométrie.

### Limite connue (assumée, jamais fabriquée)

**9 communes récentes sans polygone COD-AB** : Grand-Bassin, Liancourt, Montrouis,
Baptiste, Ducis, Fonds-des-Blancs, Marfranc, Île Cayémites, La Pointe-des-Palmistes.
Elles restent pleinement recherchables et documentées (fiche complète) ; la carte affiche
« Limite cartographique à confirmer », aucun marqueur n'est posé sans centroïde documenté,
et le territoire d'une voisine n'est jamais coloré à leur place.

## Fond de carte et CSP

Par défaut la carte est **auto-hébergée de bout en bout** : style construit localement
(fond uni + couches GeoJSON locales + points de l'API) — aucune origine externe, la CSP
`connect-src 'self'` reste inchangée, aucun serveur de tuiles tiers (la politique d'usage
des tuiles OSM n'est donc pas en cause). Icônes dessinées sur canvas (pas de serveur de
glyphes ; le 👤 des notaires est lui aussi PEINT sur canvas, voir plus bas). Les agrégats de
tribunaux de paix AFFICHENT leur compte : faute de police sur la carte (aucune couche
`text-field` possible), le nombre est un petit nœud DOM `aria-hidden` posé sur chaque agrégat
visible (`syncClusterLabels` dans `JudicialMap.tsx`) — seule exception au « zéro DOM » de la
carte. La donnée accessible reste le panneau textuel et la liste des communes.

## Couches de la carte : le registre

Toutes les couches affichables sont déclarées dans **`src/lib/jurisdictions/layers.ts`**
(`MAP_LAYERS`) : slug d'URL, groupe (`juridictions` | `professions`), `defaultOn`, marqueur,
libellés i18n, identifiants MapLibre gouvernés, source de points, décalage et plan
d'empilement. Boutons (`JudicialFilters`), légende (`MapLegend`), visibilité, couches
cliquables, agrégats dénombrés et URL **lisent le registre et rien d'autre**.

Contrat de `?layers=` (seuls `parseLayers` / `serializeLayers` le lisent et l'écrivent) :

| URL | couches |
|---|---|
| paramètre absent | `DEFAULT_LAYERS` (les quatre juridictions) |
| `?layers=paix,tpi` | paix + tpi (sans notaires) |
| `?layers=notaires` | notaires seuls |
| `?layers=tpi,tpi` / `?layers=paix,xyz` | dédoublonné / slug inconnu ignoré |
| `?layers=xyz` | rien de valide ⇒ `DEFAULT_LAYERS` |
| `?layers=` (vide) | aucune couche : fond de carte et communes |
| plus de 80 caractères | `DEFAULT_LAYERS` |

Le paramètre est omis quand la sélection égale le défaut ; l'ordre écrit est celui du registre
(`tpi,paix` ≡ `paix,tpi`). Décocher la dernière couche donne une carte vide ; « Réinitialiser »
ramène au défaut. Une couche masquée par défaut ne charge ses points qu'à sa première
activation. La fiche de la commune n'est **pas** filtrée par les couches.

**Ajouter une couche** (huissiers, barreaux, parquets…) :

1. une entrée dans `MAP_LAYERS` (marqueur `court` — forme et teinte de `COURT_STYLE` — ou
   `emoji` peint sur une pastille blanche, avec `sizeBy` pour trois tailles nettes) ;
2. une source de points : une route GeoJSON publique (calquer
   `api/public/jurisdictions/notaires/map-points`), ou une source existante filtrée par `where` ;
3. ses libellés fr/en/ht (`labelKey`, `legendKey`).

Rien d'autre : un test déclare une couche fictive et vérifie boutons, légende, URL et
visibilité (`layers.test.ts`, `layers-ui.test.tsx`). Le registre refuse au chargement un slug
dupliqué ou mal formé, un identifiant MapLibre partagé, un groupe inconnu.

## Couche « notaires » (liste du MJSP)

Source : « Liste des Notaires de la République d'Haïti » du ministère de la Justice et de la
Sécurité publique (page `mjsp.gouv.ht/page/notaires`, export PDF), consultée le 8 sept. et le
9 oct. 2026 — texte identique. Empreintes et procédure de réextraction :
`scripts/data/notaires-mjsp/EMPREINTES.txt`.

- **Le notaire est rattaché à une commune** (décret-loi du 27 nov. 1969, art. 3 et 47) ; son
  **TPI se déduit** du rattachement `TPI_COMPETENT` de cette commune — jamais stocké.
- **Deux autorités** : la liste dit qui et où, le référentiel dit où est où. Commune appariée
  par son nom sur **liste fermée** (nom, alias du référentiel, ou alias DÉCLARÉ dans
  l'amorçage) ; département déduit ; colonne imprimée conservée (`sourceDepartment`) et chaque
  désaccord consigné (33). Petit-Bourg-de-Port-Margot (n° 154) est rattaché à Port-Margot
  (décision de la cliente du 9 oct. 2026, source citée, corroborée par le référentiel).
- Rien n'est corrigé ni fusionné : marqueurs « (PDD) » / « PD/CMM » dans `mention`, affichés
  tels quels ; doublons gardés ; n° 37 (Cité Soleil) `active: false` sur décision de la cliente.
- Publication : un point par commune (125, total 422), JAMAIS de nom dans les points ; liste
  nominative dans la fiche (« Notaires (N) ») et dans `/{locale}/juridictions/notaires` (par
  TPI, puis commune, puis numéro). Provenance dite **en clair** — ni URL brute, ni fichier, ni
  empreinte sur une page publique.
- Marqueur 👤 (choix de la cliente) : peint sur canvas (`marker-canvas.ts`) au centre d'une
  pastille blanche cernée d'encre, trois tailles (1-2, 3-6, 7 et plus), décalé de 14 px en haut
  à droite et **peint sous les tribunaux**. Sans police emoji (rendu vide ou indiscernable d'un
  caractère absent), silhouette tête-épaules en encre. Aucune image externe.

Installation (⚠️ `.env` = base de PRODUCTION : chaque étape d'écriture sur instruction
explicite de Me Vaval) :

```bash
npx prisma db push                           # crée la table Notary (additif)
npm run db:rls                               # RLS sur toutes les tables, dont Notary
npx tsx scripts/import-notaires-mjsp.ts      # simulation (défaut) — rapport, totaux par TPI recomptés en base
npx tsx scripts/import-notaires-mjsp.ts --apply
```

L'import refuse d'écrire si un contrôle tombe faux (423 entrées, 1 inactive, 126 communes
dont 125 appariées, 16 alias tous consommés, 33 désaccords, 0 commune sans centroïde, totaux
des 23 TPI), si la table n'existe pas, ou si elle n'a pas la RLS. Tant que la table n'existe
pas, la carte, la fiche et la liste se dégradent proprement (route 503, section absente, page
« liste pas encore disponible »).

Pour brancher un fournisseur approuvé : renseigner `NEXT_PUBLIC_MAP_STYLE_URL` (+
attribution), puis ajouter les origines EXACTES du style/tuiles/sprites à `connect-src`
et `img-src` dans `src/middleware.ts` — jamais de joker. Documenter chaque domaine.

## Coordonnées des notaires et recherche par nom

Seconde source, distincte de la liste du MJSP : `NotaryContact` (une fiche par entrée), amorçage
`data/judicial-map/notaires-coordonnees-v1.json`, import `scripts/import-coordonnees-notaires.ts`
(simulation par défaut ; `--apply` refusé sans RLS ; verrou : le nom imprimé en base doit égaler
`expectedName`, l'entrée doit être active). Module pur : `src/lib/jurisdictions/coordonnees.ts`
(téléphones en E.164, affichés « +509 XXXX-XXXX » ; adresse et courriel tels que communiqués).

- **Où elles s'affichent** : sur la SEULE page du notaire, `/{locale}/juridictions/notaires/{id}`
  (`noindex`, 404 pour une entrée retirée). Ailleurs (fiche de la commune, liste), le nom est un
  lien et une mention discrète « coordonnées » signale la fiche ; jamais dans les points de la
  carte, les suggestions de recherche ni l'API `communes/[id]`.
- **Recherche par nom** : `src/lib/jurisdictions/search-notaries.ts` (accents et casse
  neutralisés, tous les mots, dernier mot en début de mot, une lettre de tolérance au-delà de
  5 lettres ; la mention n'est pas cherchable). Barre de la carte : suggestions typées
  `commune` / `notaire`, 5 places au plus par sorte, 8 en tout. Liste : `?q=` côté serveur.
- **Nom affiché** : `Notary.displayName` porte une décision de la cliente sur une coquille de la
  source (n° 9 : « Gemma », la liste imprime « Gamma » — `nameDecisions` de l'amorçage) ; le
  nom imprimé reste dans `fullName` et s'affiche en mention sur la page du notaire.
- **Ajouter une fiche** : une entrée dans l'amorçage, puis simulation et `--apply`.

## Variables d'environnement (`.env.example`)

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_MAP_STYLE_URL` | vide = style auto-hébergé (défaut) ; sinon URL de style MapLibre d'un fournisseur approuvé |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | attribution affichée (défaut : CNIGS / OCHA, CC BY-IGO) |
| `NEXT_PUBLIC_MAP_REPORT_ISSUE_URL` | lien « Signaler une erreur de carte » |

Aucune clé secrète : si un fournisseur exige une clé publique, elle doit être restreinte
par domaine, ses quotas surveillés, sa rotation documentée — jamais une clé serveur.

## Règles produit non négociables (rappel)

- tribunaux multiples TOUJOURS listés séparément (Port-au-Prince : Sections Est, Nord, Sud) ;
- Cour de cassation dans le bloc « Recours national », jamais tribunal local ;
- Plus Code ≠ code postal (champs et libellés distincts) ;
- aucune adresse/coordonnée/ressort inventé ; `null` reste `null` jusqu'à vérification ;
- position au centroïde = « Position indicative », jamais d'itinéraire dessus ;
- sièges `UNMAPPED` : en base, hors publication (voir `data/judicial-map/rapport-unmapped.md`) ;
- la liste textuelle complète (149) accompagne toujours la carte ; page utilisable sans JS.

## Tests et validation

```bash
npm run typecheck && npm run lint && npx vitest run --dir src && npm run build:check
```

⚠️ Jamais `npm run build` quand le serveur de développement tourne : il corrompt son `.next`.
`build:check` construit dans `.next-verify`. `--dir src` écarte les copies de
`.claude/worktrees`.

Unitaires : `src/lib/jurisdictions/*.test.ts` (normalisation, classement, distance bornée,
schéma du fichier réel, plan d'import — dont « Port-au-Prince = 3 tribunaux distincts »,
« décompte falsifié refusé », « aucune coordonnée inventée » ; registre et contrat d'URL ;
liste du MJSP de bout en bout ; marqueur 👤 et son repli), `src/components/jurisdictions/*.test.tsx`
(boutons, légende, fiche, liste par TPI) et la route `notaires/map-points`. Le fuzzing des API et le
parcours navigateur sont consignés dans `docs/carte-judiciaire-recette.md`.
