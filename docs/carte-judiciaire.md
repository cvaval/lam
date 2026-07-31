# Carte judiciaire d'Haïti — installation, données, maintenance

**Page publique** : `/{locale}/juridictions` (hors groupe authentifié — aucune connexion
requise, aucune indication tarifaire). **Console** : `/{locale}/admin/juridictions`
(MASTER_ADMIN). **Hero** : carrousel à deux diapositives sur `/{locale}` (visiteurs).

## Architecture

| Élément | Emplacement |
|---|---|
| Référentiel d'amorçage (source de vérité) | `data/judicial-map/seed-v1.json` |
| Modèles | `prisma/schema.prisma` → `JudicialDepartment/Arrondissement/Commune/PostalCode`, `Court`, `CourtCommuneJurisdiction` |
| Import | `scripts/import-judicial-map.ts` |
| Prétraitement cartographique | `scripts/build-judicial-map-geo.py` (shapely) |
| Limites administratives servies | `public/maps/hti/*.geojson` + `metadata.json` |
| Bibliothèques | `src/lib/jurisdictions/` (constants, normalize-place, search-places, seed-schema, import-plan, data) |
| API publiques | `/api/public/jurisdictions/{search, communes/[id], map-points}` |
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
glyphes) ; les grappes de tribunaux de paix n'affichent pas de compte numérique (pas de
police sur la carte) — le panneau textuel fait foi.

Pour brancher un fournisseur approuvé : renseigner `NEXT_PUBLIC_MAP_STYLE_URL` (+
attribution), puis ajouter les origines EXACTES du style/tuiles/sprites à `connect-src`
et `img-src` dans `src/middleware.ts` — jamais de joker. Documenter chaque domaine.

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
npm run typecheck && npm run lint && npm run test && npm run build
```

Unitaires : `src/lib/jurisdictions/*.test.ts` (normalisation, classement, distance bornée,
schéma du fichier réel, plan d'import — dont « Port-au-Prince = 3 tribunaux distincts »,
« décompte falsifié refusé », « aucune coordonnée inventée »). Le fuzzing des API et le
parcours navigateur sont consignés dans `docs/carte-judiciaire-recette.md`.
