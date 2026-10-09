# Prompt : production des coordonnées des notaires, puis fond de rues hébergé par Agora

> À donner tel quel à une session de travail sur le dépôt `lam-veritab` (plateforme **Agora**,
> agora.ht). Rédigé le 9 octobre 2026 à la demande de Me Vaval, qui a choisi l'**option A** pour
> les noms de rues : fond de rues extrait d'OpenStreetMap et **hébergé par Agora**, sans
> fournisseur tiers.
>
> - Fait suite à `docs/prompt-coordonnees-notaires.md`.
> - Note de livraison à jour : `docs/livraison-notaires-carte.md`.

---

Deux parties, dans cet ordre :

1. **Mettre en production** les coordonnées des notaires, qui sont prêtes et commitées.
2. **Ajouter le fond de rues** : en zoomant, on voit les routes et leurs noms.

Elles sont indépendantes. La partie 1 ne demande aucun code nouveau : seulement des écritures en
production, dans un ordre strict.

## Ce que tu dois savoir avant de commencer

- **`.env` pointe sur la base de PRODUCTION** (Supabase).
  - Chaque écriture en base, chaque `--apply`, chaque `git push` (qui déploie aussitôt sur
    Vercel, donc sur agora.ht) attend une **instruction explicite de Me Vaval**, donnée
    **pendant ta session**.
  - Ce prompt ne vaut pas autorisation : demande-la avant chaque étape marquée ⛔.
- **Le dépôt est partagé** avec d'autres sessions :
  - `git add` fichier par fichier, jamais `-A` ;
  - relis le diff complet de tout fichier partagé (`src/components/agora-portal.css` est
    modifié en parallèle par un outil de maquette) ;
  - **jamais `npm run build`**, qui corrompt le `.next` du serveur de développement :
    utilise `npm run build:check`.
- **Une base locale de test existe** : `lam_banc` (PostgreSQL sur localhost). Elle porte le
  référentiel de la carte, les 423 notaires et les 5 fiches de coordonnées.
  - Configuration de lancement : `lam-banc`, port 3100.
  - Pour y pousser un schéma : une **copie** de `prisma/schema.prisma` aux URL écrites **en
    dur** vers localhost, lancée depuis un dossier sans `.env`. Jamais via le `.env` du dépôt.
- **Avant tout `prisma db push`**, calcule en lecture seule ce qui partirait :
  ```bash
  set -a; . ./.env; set +a
  npx prisma migrate diff --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma --script
  ```
  Tout ce qui n'est pas attendu t'arrête.

---

## Partie 1 : mise en production des coordonnées des notaires

### L'état exact (vérifié le 9 octobre au soir)

- **En production depuis le 9 octobre** :
  - registre des couches ;
  - couche « Notaires » : table `Notary`, 423 entrées dont 422 actives placées ;
  - juridictions affichées sans « TPI » ;
  - Petit-Bourg rattaché à Port-Margot ;
  - **RLS active sur les 37 tables**.
- **Commité, PAS poussé** (dans cet ordre au-dessus de `origin/main`) :

  | commit | contenu |
  |---|---|
  | `6f0245e` | coordonnées au clic : `Notary.displayName` (n° 9 « Gemma »), table `NotaryContact`, page `/{locale}/juridictions/notaires/{id}`, recherche par nom (carte et liste), import `scripts/import-coordonnees-notaires.ts` |
  | `39cd714` | page du notaire : boutons d'appel (`tel:`), de courriel et d'adresse alignés ; mise en page mobile |
  | `8ad68bd` | l'adresse mène à la **carte judiciaire d'Agora** (commune du notaire, couche notaires allumée), plus à Google Maps |

  Vérifie avec `git log --oneline origin/main..HEAD`. Si d'autres commits s'y trouvent, ne
  pousse rien et demande.
- **⚠️ L'ordre est imposé.** Ce code lit `Notary.displayName` et la table `NotaryContact`.
  - Déployé avant la migration, il ne casse rien grâce au repli `lectureNotairesImpossible`
    (`P2022` / `P2021`).
  - Mais **les notaires disparaîtraient** du site jusqu'à la migration : la section de la fiche,
    la liste et les points.
  - Donc : base d'abord, déploiement ensuite.

### Les étapes

| # | étape | commande | résultat attendu |
|---|---|---|---|
| 1 | diff de schéma (lecture seule) | `migrate diff` ci-dessus | **exactement** : `ALTER TABLE "Notary" ADD COLUMN "displayName" TEXT` ; `CREATE TABLE "NotaryContact"`, son index unique sur `notaryId`, sa clé vers `Notary`. Rien d'autre. |
| 2 ⛔ | créer colonne et table | `npx prisma db push --skip-generate` | « Your database is now in sync » |
| 3 ⛔ | sécurité par ligne | `set -a; . ./.env; set +a; npm run db:rls` | « RLS actif sur 38/38 tables » |
| 4 | simulation notaires | `npx tsx scripts/import-notaires-mjsp.ts` | 0 création, **1 modification** (n° 9, `displayName`), 422 inchangées, 0 anomalie |
| 5 ⛔ | import notaires | `… --apply` | « 423 entrées, 422 actives placées ; audit tracé » |
| 6 | simulation coordonnées | `npx tsx scripts/import-coordonnees-notaires.ts` | 5 créations ; RLS « active » ; les 5 lignes affichées (n° 9, 11, 13, 17, 21) |
| 7 ⛔ | import coordonnées | `… --apply` | « 5 fiche(s) active(s) en base ; audit tracé » |
| 8 | second passage (simulation) | les deux scripts | 0 création, 0 modification |
| 9 ⛔ | déploiement | `git fetch origin && git log --oneline origin/main..HEAD`, puis `git push origin main` | les trois commits, et eux seuls |
| 10 | suivi | `vercel ls` (projet `agora`) | déploiement « Ready » en production |

Le rôle `postgres` de l'application contourne la RLS (`bypassrls`), et aucune table n'est en
RLS forcée : l'étape 3 ne change rien pour le site. Revérifie-le par une requête en lecture
seule (`pg_roles`, `pg_class.relforcerowsecurity`) si le rôle a pu changer.

### Vérification sur agora.ht, après déploiement

- `https://agora.ht/api/public/jurisdictions/search?q=Gemma` renvoie une suggestion `kind:
  'notaire'`, « Gemma ANGLADE GILLES », **sans aucune coordonnée**.
- `/fr/juridictions/notaires/mjsp-2026-09-08-9` :
  - deux boutons `tel:` (« +509 2998-4747 », « +509 4643-0503 ») et le courriel ;
  - l'adresse mène à `/fr/juridictions?commune=commune-ouest-port-au-prince&layers=…notaires` ;
  - la mention « Gamma » sur la liste du MJSP ;
  - `<meta name="robots" content="noindex, follow">`.
- `/fr/juridictions/notaires/mjsp-2026-09-08-21` : pas de ligne Téléphone ;
  « #3, rue Théodule… ».
- `/fr/juridictions/notaires/mjsp-2026-09-08-37` : **404**.
- La fiche de Port-au-Prince : 21 noms en liens, 5 mentions « coordonnées », **aucun** `tel:` ni
  courriel en clair.
- `/fr/juridictions/notaires?q=victor` : 1 résultat, sans JavaScript.
- Les trois langues.

En cas de problème après le déploiement, la base n'a pas besoin d'être défaite : les ajouts sont
additifs. On revient au code précédent par un `git revert`, sur instruction.

---

## Partie 2 : le fond de rues (option A)

### Ce qui est demandé

Quand on zoome sur la carte judiciaire (`/{locale}/juridictions`), on voit **les routes et leurs
noms**. Aujourd'hui, le fond ne montre que les limites administratives COD-AB sur un fond uni.
Aucune route, aucune police sur la carte (`JudicialMap.tsx`) : c'était voulu.

### Les règles qui ne bougent pas

- **Aucune origine externe.** La CSP reste `connect-src 'self'` (`src/middleware.ts`). Les
  tuiles, les polices de la carte et toute donnée sont **servies par agora.ht**.
  - Aucun fournisseur de tuiles, aucun serveur de polices tiers.
  - Le visiteur ne contacte que le site.
- **MapLibre reste épinglé en 5.24.0.**
- **Toute URL chargée par le worker est ABSOLUE.** MapLibre parse dans un worker `blob:` : une
  URL relative y échoue **sans erreur**. Utilise le `asset()` de `JudicialMap.tsx`.
  - ⚠️ Pour le gabarit des polices (`glyphs`), n'emploie **pas** `new URL()` : il encode `{` en
    `%7B`. Écris `${window.location.origin}/maps/fonts/{fontstack}/{range}.pbf`.
- **La vue d'ouverture ne change pas.** Au zoom d'ouverture (tout le pays), aucune tuile de
  rues ne se charge et rien ne se dessine. Capture avant/après identique, comme pour le
  registre des couches (`docs/livraison-notaires-carte.md`).
- **Les marqueurs restent au-dessus** : tribunaux, 👤, agrégats dénombrés. Les rues et leurs
  noms passent dessous ; l'aplat de la commune sélectionnée aussi.
- **Les 👤 ne bougent pas** : ils restent au centroïde de la commune. Des rues visibles ne
  doivent pas laisser croire qu'un 👤 marque une étude (question 6).

### La donnée : les routes seules, pas un fond complet

On n'a besoin que des **routes et de leurs noms** : les limites, les communes et les marqueurs
existent déjà. Un fond OSM complet (bâtiments, occupation du sol) pèserait des centaines de Mo
pour Haïti, et le pays est très cartographié en bâtiments depuis 2010. Construis donc des tuiles
vectorielles **de routes seulement**.

1. **Source** : l'extrait Geofabrik « Haiti and Dominican Republic »
   (`https://download.geofabrik.de/central-america/haiti-and-domrep-latest.osm.pbf`).
   - Télécharge-le dans un dossier de travail **hors du dépôt**.
   - Consigne l'URL, la date de l'extrait et son **SHA-256** dans `public/maps/hti/metadata.json`,
     comme pour COD-AB.
2. **Outils** : `brew install osmium-tool tippecanoe pmtiles`. `ogr2ogr` et `shapely` sont déjà
   installés.
3. **Filtrer et découper** :
   - ne garder que les voies (`osmium tags-filter … w/highway`) ;
   - les découper sur **Haïti seule**, d'après l'union des départements COD-AB
     (`public/maps/hti/hti-adm1-departments.geojson`) : la République dominicaine sort ;
   - ne garder que `name`, `ref` et une **classe** dérivée de `highway` : `majeure` (`trunk`,
     `primary`), `secondaire` (`secondary`, `tertiary`), `locale` (`residential`,
     `unclassified`, `living_street`), `service` (`service`, `track` nommées seulement).
4. **Tuiler** avec `tippecanoe`, en un seul fichier **PMTiles** :
   - zooms 11 à 15 ;
   - les classes `locale` et `service` à partir du zoom 13 ;
   - simplification raisonnable.
   - Écris la chaîne complète dans un script rejouable,
     `scripts/build-routes-haiti.sh` (ou `.py`), qui imprime la taille et les comptes.
5. **Budget de taille** : vise **≤ 15 Mo**. Le fichier va dans `public/maps/hti/routes-hti.pmtiles`
   et sera versionné.
   - Au-delà : descends d'abord le zoom maximal à 14, retire les voies `service` et les voies
     sans nom aux petits zooms.
   - Héberger ailleurs (Vercel Blob) ajouterait une origine à la CSP : c'est une décision de la
     cliente, pas la tienne.
6. **Licence** : OpenStreetMap est sous **ODbL**. La mention « © contributeurs OpenStreetMap »
   est **obligatoire** partout où la carte s'affiche.

### Les polices de la carte (pour écrire les noms)

Un texte MapLibre exige des polices au format **PBF de glyphes**, que le style ne déclare pas
aujourd'hui.

- **Par défaut : Inter**, la police du site (licence OFL, `src/app/fonts/Inter-OFL.txt`).
  - Génère les PBF à partir d'une instance **statique** Regular, depuis la publication officielle
    d'Inter. La version et le SHA-256 de la source sont consignés.
  - Outil, au choix : `fontnik` / `build-glyphs`, ou `maplibre/font-maker`.
- **Plages à produire** : `0-255`, `256-511` (accents, « è », « ô », « ç ») et `8192-8447`
  (« ’ », « – »).
- **Emplacement** : `public/maps/fonts/Inter Regular/{range}.pbf`.
- **Repli acceptable** : les PBF Noto Sans des *basemaps-assets* de Protomaps (OFL), **copiés**
  dans le dépôt, jamais appelés en ligne.

### L'intégration à la carte

- **Dépendance** : `pmtiles`, la bibliothèque officielle de Protomaps, **version épinglée**.
  - Protocole enregistré **une seule fois** : `maplibregl.addProtocol('pmtiles', new
    Protocol().tile)`.
  - Source vectorielle `pmtiles://` + `asset('/maps/hti/routes-hti.pmtiles')`, `minzoom: 11`.
  - Vérifie que le serveur répond aux **requêtes partielles** (`Range`) :
    - en local avec `npm run build:check` puis `npm run start:check`, et
      `curl -r 0-99 -I http://localhost:3000/maps/hti/routes-hti.pmtiles` (206 attendu) ;
    - sur agora.ht après déploiement.
- **Style** : ajoute `glyphs` au style construit dans `JudicialMap.tsx` (voir le piège de
  `new URL()` plus haut).
- **Couches, posées au `load`** juste après les limites et la sélection, donc **sous** toutes les
  couches de points du registre, qui s'installent ensuite au-dessus :
  - lignes par classe : `grafit` (#52656B) à opacité réduite, largeurs interpolées selon le
    zoom. Elles restent discrètes devant les filets d'encre des départements. Pas `adwaz`, qui
    est une surface sombre ;
  - noms le long des routes :
    - `symbol-placement: 'line'`, `text-field: ['get', 'name']`, police `Inter Regular` ;
    - à partir du **zoom 14** (question 2), taille 11 à 13 ;
    - couleur `ank`, halo blanc ;
    - aucun nom ne doit masquer un marqueur.
  - Isole la construction de ces couches dans un module **pur et testé**
    (`src/lib/jurisdictions/fond-de-rues.ts`) : identifiants, zooms minimaux, ordre.
- **Attribution** :
  - ajoute « © contributeurs OpenStreetMap » au contrôle d'attribution **et** à la ligne
    « Données cartographiques » sous la carte ;
  - ⚠️ la page lit `NEXT_PUBLIC_MAP_ATTRIBUTION` : si la production définit cette variable, la
    mention OSM serait perdue. Ajoute-la donc **séparément**, jamais par cette variable.
- **Zoom maximal** : il reste 15 (question 3).
- **Le registre des couches** (`layers.ts`) **n'est pas touché**. Le fond de rues n'est pas une
  couche au choix, mais un élément du fond, visible au-delà du zoom 11 (question 4).
- **Documentation** : `docs/carte-judiciaire.md` gagne une section « Fond de rues
  (OpenStreetMap) » : source épinglée, script, budget, licence, procédure de mise à jour.

### Ce que la cliente doit trancher (défauts appliqués et signalés)

| # | question | défaut proposé |
|---|---|---|
| 1 | Police des noms de rues | Inter, celle du site |
| 2 | À partir de quel zoom les noms apparaissent | 14 (lignes dès 11) |
| 3 | Autoriser un zoom plus fort (16) pour lire les ruelles ? | non, 15 comme aujourd'hui |
| 4 | Un bouton pour masquer les rues ? | non |
| 5 | Les noms d'OSM sont collaboratifs, parfois absents ou mal orthographiés hors de Port-au-Prince : faut-il le dire ? | la mention de source et l'avertissement déjà présent sous la carte suffisent |
| 6 | Placer chaque notaire à son étude (position vérifiée par fiche), maintenant que les rues se voient ? | hors de ce prompt ; à décider |

### Vérification

**Tests `vitest`** (`npx vitest run --dir src`) :

- le module `fond-de-rues.ts` :
  - zooms minimaux (aucune couche sous 11, aucun nom sous 14) ;
  - ordre, toutes les couches de rues sous la première couche de points du registre ;
  - polices déclarées ;
- l'URL de la source et le gabarit `glyphs` sont **absolus**, et le gabarit garde ses `{` `}` ;
- la mention OSM est présente même quand `NEXT_PUBLIC_MAP_ATTRIBUTION` est définie ;
- la taille du fichier `.pmtiles` versionné respecte le budget.

Puis `npm run typecheck && npm run lint` et **`npm run build:check`**.

**À l'écran, sur le banc local** (ordinateur et mobile) :

- **ouverture** de `/fr/juridictions` : capture identique à avant, aucune requête de tuile de
  rues ;
- **Port-au-Prince au zoom 14-15** : routes et noms lisibles (Route de Delmas, Avenue John
  Brown…), sous les tribunaux et les 👤 ;
- **une ville de province** (Jacmel, Les Cayes) : ce qu'OSM y fournit, sans erreur ;
- **aucune requête vers une autre origine** (onglet réseau) ;
- **les requêtes partielles servies (206)**.

### Livraison de la partie 2

- Commit fichier par fichier. **Ne pousse pas** sans instruction de Me Vaval : le fichier
  `.pmtiles` et les polices partent avec le déploiement.
- Note `docs/livraison-fond-de-rues.md` :
  - source et SHA-256 ;
  - taille finale ;
  - captures avant/après (ouverture inchangée ; Port-au-Prince zoomé) ;
  - les six questions ;
  - ce que tu as décidé seul.

## Hors de ce prompt

Les chantiers **C** (saisie des coordonnées par la rédaction) et **D** (demandes des tiers, file
du master admin, notification à legal@agora.ht) de `docs/prompt-coordonnees-notaires.md` restent
à faire. Ils ont leur propre prompt.
