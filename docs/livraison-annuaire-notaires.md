# Livraison — « Carte judiciaire et notaires » : l'annuaire des notaires (17 oct. 2026)

Rien n'est déployé ni poussé. Captures : `docs/livraison-annuaire-notaires/` (banc local `lam_banc`,
copie conforme de la base : 422 notaires actifs, 5 fiches de coordonnées, 149 communes).

## Décisions de Me Vaval (17 oct. 2026)

- **L'adresse de l'étude figure dans l'annuaire** quand elle est exacte. Téléphones et courriels
  restent sur la seule page du notaire. (Règle antérieure, 9 oct. : coordonnées sur la page du
  notaire seulement.)
- **La page du notaire est indexée** par les moteurs de recherche (`noindex` retiré).
- **Un clic sur l'adresse montre où elle se trouve sur la carte** — dans la limite des données :
  aucune étude n'a de coordonnées géographiques, la carte situe donc la COMMUNE de commission, et
  le lien le dit (« l'étude n'est pas géolocalisée »).

## Routes

| Route | Rôle |
|---|---|
| `/{locale}/juridictions` | onglet « Juridictions » (inchangé dans ses fonctions) |
| `/{locale}/juridictions?vue=notaires` | onglet « Notaires » : carte + « Annuaire des notaires » (URL canonique propre, indexable) |
| `…?vue=notaires&q=…&juridiction=…&commune=…&page=…` | recherche, filtre de juridiction, commune choisie sur la carte, page |
| `…&carte=1` | sur téléphone, la carte s'ouvre d'office (lien « Situer la commune sur la carte ») |
| `/{locale}/juridictions/notaires` | « Notaires par juridiction » : page **préservée**, même source de données |
| `/{locale}/juridictions/notaires/{id}?retour=…` | page du notaire ; `retour` ramène à l'annuaire tel qu'on l'a quitté |

Aucune API publique ajoutée ni modifiée : l'annuaire est rendu côté serveur. L'API
`communes/[id]`, les points de la carte et les suggestions ne portent toujours aucune coordonnée.

## Règles exactes

**Classement par défaut** (`src/lib/jurisdictions/annuaire-notaires.ts`, appliqué à toute la liste
AVANT la pagination, 30 par page) :

1. par juridiction — le TPI compétent de la commune, affiché sans « TPI » — dans l'ordre
   alphabétique de son nom (il n'existe pas d'ordre éditorial des juridictions) ; « Juridiction non
   déterminée » en dernier ;
2. dans chaque juridiction, les notaires dont l'adresse exacte est connue, puis les autres ;
3. dans chaque groupe : nom de famille, prénoms, puis identifiant (classement stable entre pages).

**Nom de famille** — aucun champ structuré en base (`fullName`, `displayName`). Convention constante
de la liste du MJSP, vérifiée sur les 422 noms : prénoms en minuscules capitalisées, nom de famille
en MAJUSCULES à la fin. Règle : le nom de famille est la suite FINALE de mots entièrement en
capitales (deux lettres au moins ; accents, tirets et apostrophes admis ; une initiale « B. »
l'interrompt) — « Garry BRISSON CASSAGNOL » → « BRISSON CASSAGNOL », « Mrie Lourdes B. BAUDIN
FRANCILLON » → « BAUDIN FRANCILLON ». **Repli** quand aucun mot final n'est en capitales (« Jean
Fitzner ») : rien n'est deviné, la clé de tri est le nom entier. Clés comparées sans casse, accents,
tirets ni apostrophes. Le nom affiché n'est jamais modifié.

**Adresse exacte** — aucun statut de qualité en base (`NotaryContact.address` est une ligne libre).
Règle conservatrice : fiche de coordonnées ACTIVE, adresse non vide, différente du nom de la
commune ou du département, et porteuse d'un élément de voie — un numéro (« 14 », « #52 ») ou un mot
de voie (rue, avenue, route, impasse…). « Bourdon » ou « Pétion-Ville » seuls ne sont pas une
adresse exacte. Une adresse exacte n'est PAS une position : aucune n'est géolocalisée, aucune n'est
envoyée à un service tiers. La mention « Adresse vérifiée » n'est utilisée nulle part.

**Recherche** — le moteur existant (`searchNotaries`), avec l'option `avecCommune` : les mots de la
commune de commission comptent aussi (« petion ville » trouve Pétion-Ville). Casse et accents
neutralisés, nom affiché intact. Sans l'option, la recherche reste celle du nom seul (suggestions,
liste par juridiction).

## Carte

La carte de la plateforme (`JudicialMap`) : même fond (OSM local), mêmes limites, mêmes couches,
même légende. Nouveau mode `vue="notaires"` : choisir une commune filtre l'annuaire (l'URL garde
l'onglet), la bulle du 👤 mène à l'annuaire filtré sans démonter la carte. Couche « notaires »
allumée d'office dans l'onglet (`NOTARY_VIEW_LAYERS`) ; le défaut du registre s'écrit en clair
dans l'URL pour ne pas être relu comme le défaut de l'onglet.

## Vérifications

- `vitest --dir src` : 112 fichiers, 1 827 tests, tous verts. Nouveaux : `annuaire-notaires.test.ts`
  (34 : noms, adresses, classement, pagination, filtres, URL, retour), `annuaire-ui.test.tsx`
  (12 : rendu, données privées absentes, panne ≠ liste vide, inscriptions multiples), ajouts à
  `search-notaries.test.ts` et `layers.test.ts`. Un test adapté (`notary-profile.test.tsx` : la
  cible du lien d'adresse a changé, par décision).
- `tsc`, ESLint : propres. `npm run build:check` : voir le compte rendu de session.
- Navigateur (banc local) : ordinateur 1440 × 900 et téléphone 375 × 812 ; recherche, commune
  choisie au clic sur la carte, bulle, pagination (« suite »), fiche et retour, clavier (anneau terre
  cuite 3 px, `aria-current`), anglais et créole, aucun `tel:` ni courriel d'étude dans la page.

## Limites liées aux données

- **5 adresses sur 422** : seuls ces notaires (tous à Port-au-Prince) passent en tête de leur
  juridiction ; les 417 autres portent « Adresse de l'étude non renseignée ».
- **Aucune coordonnée géographique d'étude** : un repère précis exigerait de les enregistrer (champ
  à créer, saisi par la rédaction). La carte montre la commune.
- **Noms non structurés** : la règle des capitales finales tient sur toute la liste actuelle ; une
  source qui ne la suivrait pas tomberait sur le repli (nom entier).
- **Libellés anglais et créoles à valider** par la cliente (créole avec accents, comme `ht.ts`).
