# Carte judiciaire — recette, fuzzing et matrice d'acceptation

**31 juillet 2026.** Validation exécutée sur le dépôt, la base de production (lecture) et
un serveur local (dev + build de production).

## 1. Commandes de validation

| Commande | Résultat |
|---|---|
| `npm run typecheck` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 avertissement |
| `npm run test` | ✅ **66 tests** (9 fichiers) |
| `npm run build` | ✅ compilé ; `/[locale]/juridictions` **101 kB** de JS initial (MapLibre chargé à part, hors bundle d'entrée) |
| `npx tsx scripts/import-judicial-map.ts --dry-run` | ✅ 1 210 enregistrements, 0 anomalie |
| `npx tsx scripts/import-judicial-map.ts --apply` (2ᵉ passage) | ✅ **créations 0 · inchangés 1 210** (idempotence prouvée) |
| `npx tsx scripts/_fuzz-jurisdictions.ts` | ✅ **129 contrôles, 0 échec** |

## 2. Fuzzing des entrées (sécurité)

29 charges hostiles — XSS (`<script>`, `"><img src=x onerror=…`, `javascript:`),
injection SQL (`' OR '1'='1`, `UNION SELECT`, `DROP TABLE`), NoSQL/pollution de
prototype (`{"$ne":null}`, `{"__proto__":…}`), traversée (`../../etc/passwd`, encodée),
octet nul, renversement bidirectionnel, hors-BMP, 5 000 caractères, `${jndi:…}`, `{{7*7}}`,
SSI, découpe d'en-tête — croisées avec 5 surfaces :

| Surface | Attendu | Résultat |
|---|---|---|
| `/api/public/jurisdictions/search` | 200 ou 400, jamais 500 | ✅ |
| `…/search?limit=` hors bornes / non numérique | 400 ou clamp | ✅ |
| `/api/public/jurisdictions/communes/{id}` | 400 / 404 | ✅ |
| `/api/public/jurisdictions/map-points?types=` | liste blanche stricte | ✅ |
| `/api/admin/jurisdictions` (GET + PATCH) sans session | **403 systématique** | ✅ |
| Page `/fr/juridictions?commune=&layers=` | 200, aucune charge réfléchie | ✅ |

Contrôles appliqués à chaque réponse : pas de statut ≥ 500, pas de charge brute réfléchie,
pas de fuite d'implémentation (`PrismaClient`, `DATABASE_URL`, chemins, erreurs Postgres),
`Content-Type: application/json`, réponse < 3 s.

**Un durcissement réel en est sorti** : `/search` renvoyait la saisie brute dans `query`.
Elle est désormais **normalisée** avant renvoi — la réponse ne peut plus contenir que
`[a-z0-9 ]`, donc plus aucun écho d'une charge, même échappé en JSON.

**Deux faux positifs de mon propre détecteur ont été corrigés** — un détecteur qui crie au
loup masque les vrais défauts :
- la page contenait `<img` et `onerror` : ils venaient du **flux Next.js**, où les chevrons
  sont encodés `<` (inerte). Le seul test juste est la présence de la **charge brute** ;
- la charge vide donne `/communes/` → route inexistante → page 404 **HTML de Next**,
  signalée à tort comme « fuite » et « content-type ». Ce n'est pas l'API.

## 3. Défauts trouvés par la vérification navigateur

Ni les 66 tests ni le fuzzing n'auraient pu les voir.

1. **La carte ne peignait rien (bloquant).** Les sources GeoJSON restaient éternellement
   non chargées, **sans aucune erreur** — ni console, ni canal `error` de MapLibre, ni
   violation CSP. Diagnostic : MapLibre parse le GeoJSON dans un Web Worker créé depuis un
   `blob:` ; la base du worker est donc `blob:…` et une **URL relative y est irrésolvable**
   (`Failed to parse URL from /maps/…`). Les URL sont désormais **absolues**.
2. **MapLibre 6.1.0 ne rendait rien**, même avec les données passées en objet et en build
   de production (WebGL2 pourtant opérationnel, aucun worker instancié). Rétrogradé vers la
   ligne stable **5.24.0** : la carte s'affiche, se sélectionne et se filtre correctement.
3. **Cibles tactiles sous 44 px** : champ de recherche (42 px) et boutons de zoom natifs de
   MapLibre (29 px) — corrigés (CSS, sans toucher à la bibliothèque).
4. **Libellé impropre** : un tribunal de paix siège dans une *section*, pas dans une ville ;
   « Ville-siège : SECTION EST » devient « Siège » pour les seuls tribunaux de paix.

Un incident de méthode à signaler : un test au clavier a d'abord échoué à cause d'un
**cache webpack mêlant deux versions de MapLibre** pendant le changement de dépendance.
Après purge de `.next`, la touche Entrée navigue correctement. Aucun code n'était en cause.

## 4. Parcours vérifiés dans le navigateur

| Étape | Résultat |
|---|---|
| `/fr` — carrousel 2 diapositives, `role=region`, `aria-roledescription=carousel` | ✅ |
| Diapositive 1 → `/fr/login` · Diapositive 2 → `/fr/juridictions` | ✅ |
| Commandes du carrousel **hors** des liens de diapositive | ✅ (`boutonsHorsLien: true`) |
| Hauteur du carrousel constante (671 px) — pas de déplacement cumulatif | ✅ |
| `/fr/juridictions` — Haïti, limites communales, grappes, TPI, appel, cassation | ✅ |
| Sélection d'une commune : surlignage + recentrage | ✅ |
| Recherche « mole saint nicolas » → **Môle-Saint-Nicolas** (accents restitués) | ✅ |
| Combobox ARIA : `aria-expanded`, `aria-activedescendant`, `aria-selected` | ✅ |
| Entrée et clic sélectionnent la commune ; l'URL porte l'état | ✅ |
| Port-au-Prince : **3 tribunaux de paix distincts**, HT6110 dominant, 9 zones | ✅ |
| Bloc **« Recours national »** séparé, avec sa mention explicite | ✅ |
| Plus Code `GMV6+X9W` affiché « repère distinct du code postal » | ✅ |
| Itinéraire proposé **uniquement** pour l'adresse vérifiée (cassation) | ✅ |
| « Position indicative dans la commune » sur tous les centroïdes | ✅ |
| 320 px : **aucun débordement horizontal** (`scrollWidth == clientWidth == 320`) | ✅ |
| Liste textuelle complète des 149 communes, avec codes postaux | ✅ |

## 5. Matrice d'acceptation (§ 20 du cahier des charges)

| # | Critère | État | Preuve |
|---|---|---|---|
| 1 | Carrousel : deux destinations correctes | **RÉUSSI** | liens `/fr/login` et `/fr/juridictions` lus dans le DOM |
| 2 | Le hero n'effectue pas la recherche | **RÉUSSI** | aucun champ dans le hero ; illustration vectorielle |
| 3 | Page de carte publique | **RÉUSSI** | route hors `(app)` ; 200 sans session |
| 4 | 149 communes recherchables | **RÉUSSI** | `getCommuneDirectory` = 149 ; liste rendue |
| 5 | 149 fiches avec code postal principal | **RÉUSSI** | test `primaries).toHaveLength(149)` |
| 6 | Chaque commune : TPI + cour d'appel | **RÉUSSI** | test sur les 149 communes du plan |
| 7 | Tribunaux multiples tous listés | **RÉUSSI** | test + rendu (3 cartes distinctes) |
| 8 | Port-au-Prince : 3 tribunaux de paix | **RÉUSSI** | test + capture |
| 9 | HT6110 principal pour Port-au-Prince | **RÉUSSI** | test + rendu (typographie dominante) |
| 10 | Plus Code séparé du code postal | **RÉUSSI** | champs distincts + mention explicite |
| 11 | Cour de cassation rue Mgr Guilloux | **RÉUSSI** | test + fiche |
| 12 | 10 sièges sans commune non attribués | **RÉUSSI** | test (aucun rattachement) + exclus de la publication |
| 13 | Positions par centroïde signalées | **RÉUSSI** | badge « Position indicative » ; pas d'itinéraire |
| 14 | Limites manquantes signalées | **RÉUSSI** | 9 communes « Limite cartographique à confirmer » + rapport |
| 15 | Carte et liste synchronisées | **RÉUSSI** | URL comme source de vérité, vérifié dans les deux sens |
| 16 | Utilisable sans souris | **RÉUSSI** | combobox ARIA, filtres = liens, Entrée/Échap |
| 17 | Trois langues | **RÉUSSI** | fr/en/ht typés `Dictionary` (erreur de compilation si clé manquante) |
| 18 | Attributions visibles | **RÉUSSI** | sous la carte + contrôle MapLibre |
| 19 | CSP de production fonctionne | **RÉUSSI** | CSP **inchangée** : tout est auto-hébergé, 0 violation observée |
| 20 | Aucun secret exposé | **RÉUSSI** | aucune clé ; `.env.example` documenté ; seed sans chemin local |
| 21 | Import idempotent | **RÉUSSI** | 2ᵉ passage : 0 création, 1 210 inchangés |
| 22 | Tests et build réussissent | **RÉUSSI** | 66 tests, lint, build |
| 23 | Documentation de mise à jour | **RÉUSSI** | `docs/carte-judiciaire.md` |

**PARTIEL / BLOQUÉ** — à signaler franchement :

| Point | État | Motif |
|---|---|---|
| Tests de parcours **Playwright** | **PARTIEL** | Aucun outil E2E n'existait dans le projet ; l'ajouter (navigateurs, CI) dépasse cette livraison. Les 20 étapes du § 19.3 ont été exécutées **manuellement dans le navigateur** et sont consignées au § 4 ci-dessus. Reste à automatiser si vous le souhaitez. |
| Couche **arrondissements** complète | **PARTIEL** | 42 arrondissements dissous ; 13 le sont sur géométrie **incomplète** (9 communes sans polygone COD-AB) et sont marqués `complete: false`. Documenté dans `rapport-jointure.md`. |
| Coordonnées exactes des tribunaux | **PARTIEL** | Seule la Cour de cassation en a (source citée). Les 213 autres sont au centroïde, signalé « position indicative ». **Aucune n'a été inventée** — c'est un travail de vérification éditoriale, pas de code. |
| Fond de carte d'un fournisseur | **NON REQUIS** | Le style auto-hébergé évite toute dépendance externe et laisse la CSP intacte. `NEXT_PUBLIC_MAP_STYLE_URL` est prêt si vous approuvez un fournisseur. |

## 6. Refonte du héros d'après la maquette (31 juillet 2026)

La diapositive 2 a été redessinée sur la maquette fournie : titre coupé (« … Partout en
**Haïti.** »), grand bouton Sitwon, puces de fonctionnalités,
fiche blanche de Port-au-Prince en aperçu. La carte du héros est un **SVG statique**
(9 Ko) — le héros ne charge toujours pas MapLibre — mais sa géométrie vient du **même
COD-AB** que la carte interactive : `scripts/build-hero-map-svg.py` régénère
`src/components/home/hero-map-data.ts`. Les points sont les centroïdes documentés des
communes-sièges ; aucune position dessinée à la main.

**Défauts trouvés à la mesure, pas à l'œil** (rectangles relevés dans le navigateur) :

| Constat | Correction |
|---|---|
| Douglas-Peucker appliqué aux anneaux **fermés** : la distance point→*droite* dégénère quand le premier et le dernier point coïncident — les 10 départements s'effondraient en deux points | distance point→**segment** |
| La fiche blanche recouvrait exactement Port-au-Prince (commune mise en avant, son marqueur et la moitié de son étiquette) | carte décalée à gauche + largeurs par palier ; **écart mesuré 46 px à 1024, 68 px à 1280, 77 px à 1366** |
| Étiquette « Port-au-Prince » posée à l'œil (`left-[54%]`) | position **calculée** depuis `HERO_MAP_FOCUS` : elle suivra la géométrie si on la régénère |
| Sous `lg`, la fiche empilée allongeait la diapositive de 550 px de plus que la diapositive 1 — les deux partagent une cellule de grille, donc ce surplus devenait du **vide sous la diapositive 1** | fiche à partir de `lg` ; carte à partir de `sm` (comme le visuel de la diapositive 1). Écart résiduel : 42 px à 768, 129 px à 375 |
| **Débordement horizontal de la page d'accueil** : 5 px à 1024 (fiche décorative de la diapositive 1) et 16 px à 320 (langues + bouton Connexion de l'en-tête) — antérieurs à ce chantier | `overflow-x-clip` sur la section du héros ; gap et rembourrage resserrés sous 360 px. **Mesuré à 0 aux deux largeurs** |

Incident de méthode : le carrousel ne réagissait plus au clic. Cause réelle — le cache
`.next` du serveur de développement était corrompu (`Cannot find module './7787.js'`,
`main-app.js` en 404) : **la page n'était pas hydratée du tout**. Aucun code en cause ;
purge de `.next` et redémarrage. C'est la deuxième fois dans ce chantier : avant de
diagnostiquer un composant client « inerte », vérifier qu'il porte bien une clé
`__react*` dans le DOM.

Contrôles rejoués : `tsc --noEmit`, `next lint` (0), **66 tests**, `next build`.

## 7. Revue du héros — contrastes mesurés, kreyòl, repli sans JS

Contrastes calculés sur les couleurs réelles de la charte (lank `#1C1B3A`, cream
`#F6F4EE`, sitwon `#BEF264`), pas estimés à l'œil. Quatre textes étaient **sous le
seuil WCAG AA** (4,5:1 pour du texte courant) :

| Texte | Avant | Après |
|---|---|---|
| Note « Cliquez pour ouvrir la recherche » (11 px) | cream/45 → **4,09:1** ❌ | cream/60 → **6,20:1** ✅ |
| Puces de fonctionnalités (11 px) | cream/45 → **4,09:1** ❌ | cream/60 → **6,20:1** ✅ |
| Fiche — « Ouest · Arrondissement… » (11 px) | lank/50 → **3,26:1** ❌ | lank/65 → **5,21:1** ✅ |
| Fiche — adresse de la cassation (10,5 px) | lank/45 → **2,83:1** ❌ | lank/65 → **5,21:1** ✅ |

Conformes sans retouche : description (7,96:1), étiquette Port-au-Prince (13,0:1),
pastille du code postal (5,51:1), bouton et noms de tribunaux (12,7:1 et 16,6:1).

**Kreyòl incohérent.** Le titre entier disait « Toupatou **ann** Ayiti » — c'est lui
qui sert de nom accessible au lien — tandis que le titre coupé affichait « Toupatou
**nan** Ayiti ». Une personne au lecteur d'écran entendait donc une phrase que
personne ne voyait. Corrigé, et l'invariant `titleLead + ' ' + titleAccent === title`
est désormais **testé pour les trois langues** (`src/lib/i18n/hero-map.test.ts`,
9 assertions).

**Repli sans JavaScript.** Le petit lien « Explorer la carte judiciaire → » sous les
indicateurs doublait mot pour mot le bouton de la diapositive. Il n'existe que pour
le cas sans JS (où la seconde diapositive reste `opacity-0 pointer-events-none`) :
il est passé dans un `<noscript>`.

Robustesse : la fiche blanche porte maintenant `text-lank` sur son conteneur — elle
vit dans une section `text-cream`, donc tout texte oubliant sa couleur serait devenu
invisible sur blanc.

**Incident, deuxième occurrence.** La page est apparue **sans aucune feuille de
style** : le serveur de développement était resté bloqué sur « Starting… » après que
`npm run build` a écrasé le `.next` partagé. Ce n'est pas un défaut du code — mais
c'est le troisième accident `.next` du chantier. Le réflexe : arrêter le serveur
avant tout `build`, ou purger `.next` et redémarrer.

Contrôles : `tsc`, `lint` (0), **75 tests** (10 fichiers), `next build`.
