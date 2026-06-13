# Lam Veritab — Architecture

Document technique. Pour le démarrage et les fonctionnalités, voir [README.md](README.md).
Les références `§NN` renvoient au *Plan de plateforme UI/UX v1.0*.

## 1. Vue d'ensemble

Application **Next.js 14 (App Router)** mono-déployable. Le rendu des écrans
authentifiés est *server-side* (React Server Components) ; les interactions (formulaires,
saisie 2FA, actions admin) sont des composants clients minces. Les API sont des Route
Handlers Node.

```
Navigateur ──┬─ Server Components (pages, gating session)
             ├─ Route Handlers /api/* (auth, search, export, admin)
             ├─ Prisma ─────────► SQLite (dev) / PostgreSQL (prod)
             └─ SearchProvider ─► FTS intégré (dev) / OpenSearch (prod)
```

Décision structurante : **deux providers derrière une seule interface** afin de
démarrer sans infrastructure tout en respectant la spécification OpenSearch (§09).

## 2. Modèle de données (`prisma/schema.prisma`)

- **Comptes** : `User` (role, status, locale, TOTP, quota, verrouillage, traçabilité
  d'activation), `Organization` (sièges Enstitisyon), `Session`, `TrustedDevice`.
- **Corpus** : `Document` (cœur commun + champs filtrables par type + `metaJson` pour
  le long terme), `DocumentVersion` (consolidations/historique, type 1), `Citation`
  (graphe de citations croisées).
- **Index transversal** : `Company`, `CompanyPublication` (statuts, modif. capital,
  marques) — agrégées sur la fiche société.
- **Usage** : `Favorite`, `SearchLog` (KPI), `Alert` (veille), `ExportRecord`
  (filigrane), `AuditLog` (journal de sécurité).

SQLite ne supportant pas les `enum` Prisma, les valeurs énumérées sont des `String`
validées au niveau applicatif (`src/lib/types.ts`). Passage à PostgreSQL = changement
du `provider` + `DATABASE_URL`, sans autre modification.

## 3. Système trilingue (§02)

- **Interface** : catalogue FR/EN/HT typé (`src/lib/i18n/dictionaries.ts`, le FR est la
  forme canonique). Routage par segment `/fr` `/en` `/ht` via `middleware.ts` ;
  sélecteur persistant (cookie + `User.locale`).
- **Texte officiel** : `Document.bodyOriginal` reste dans sa langue de publication —
  **jamais traduit**. Bandeau « *Lam Veritab never translates the law* ».
- **Couches éditoriales** : titres, résumés et encadrés « *Sa sa vle di / What it
  means* » disponibles en FR/EN/HT, balisés « Éditorial ».

## 4. Recherche (§09)

Interface `SearchProvider` (`src/lib/search/`) :

- **`FtsProvider`** (défaut) — préfiltre structurel via Prisma (type, statut,
  exercice…), puis score en mémoire avec repli accentué, pondération par champ et
  **expansion translingue EN→FR** (`synonyms.ts`). Surlignage via `highlight.ts`.
- **`OpenSearchProvider`** — index par type (1–6) + index transversal sociétés ;
  **analyseur FR** (élision, asciifolding, stemming) + **`synonym_graph` EN→FR** en
  *search analyzer* ; surlignage Sitwon. Mappings dans `mappings.ts`, chargement par
  `scripts/reindex.ts`. Activé par `SEARCH_PROVIDER=opensearch`.

Les deux partagent le **même jeu de synonymes**, garantissant un comportement
identique. L'omnibox interroge les 6 services, l'Index du Moniteur **et** l'index
transversal sociétés simultanément.

**Recherche dynamique (2 temps).** (1) correspondances **exactes** (sous-chaîne +
synonymie) ; (2) correspondances **approchantes** — orthographe proche via distance
d'édition ≤ 2 sur un vocabulaire du corpus mis en cache (`fuzzy.ts`), affichées sous un
séparateur « Résultats approchants ». OpenSearch : `fuzziness: AUTO`.

**Référence unique par société.** Les avis-sociétés groupés (catégorie `SOCIETE`) sont
masqués de la recherche ; chaque société extraite devient une **fiche distincte** (nom +
référence Moniteur unique, ex. *Société Agricole de Soisson de Nippes S.A.* → LM2018-35),
fortement priorisée. Résultats dédupliqués par titre.

**Cache mémoire** (`cache.ts`) : requêtes identiques resservies (TTL 90 s) — mémoire de
la recherche précédente, pagination instantanée. Côté client, la dernière recherche est
restaurée (localStorage) et une croix « × » vide le champ.

**Anti-scraping** (`security/ratelimit.ts`, §09) : limitation de débit par compte/IP
(recherche 80/min, documents 150/min, exports 20/min). Au-delà : blocage (429) +
événement `SCRAPING_ALERT` journalisé (KPI admin), throttlé. Tout le corpus est derrière
l'authentification ; chaque export PDF est tatoué (filigrane dynamique).

## 5. Authentification & sécurité (§04)

| Brique | Mise en œuvre |
| --- | --- |
| Mot de passe | bcrypt (`password.ts`) |
| 2FA | TOTP (otplib) + QR d'enrôlement ; repli e-mail prévu |
| Session | cookie opaque httpOnly + table `Session` ; `twoFactorVerified` |
| Appareil de confiance | cookie **signé HMAC** + empreinte UA, 30 jours, table `TrustedDevice` |
| Comptes sensibles | Éditeur & Master Admin : **2FA à chaque session**, pas de fenêtre 30 j |
| Rappel J-3 | bandeau si l'appareil de confiance expire sous 3 jours |
| Anti-bruteforce | 5 échecs → verrouillage 15 min + e-mail + `AuditLog` |
| RBAC | matrice `src/lib/rbac.ts` appliquée dans chaque page/route serveur |
| Audit | `AuditLog` : login, 2FA, activation, publication, export, scraping… |

L'enrôlement TOTP est **forcé à la première connexion** après activation (le master
admin réinitialise `totpEnabled`). En production, désactiver l'endpoint dev
`/api/auth/devcode` (déjà bloqué hors développement).

## 6. Matrice d'accès (§03)

`src/lib/rbac.ts` encode la matrice du plan. Exemples d'application : lecture intégrale
vs *extraits* (paywall Sitwayen sur le visualiseur), index sociétés réservé Pro/Inst,
export scellé, alertes, multi-utilisateurs/API, téléverser/publier, administration.

## 7. CMS / OCR & sceau (§08)

`UploadStudio` : dépôt PDF, **OCR (Tesseract FR en prod) validé en écran scindé**
(PDF source ↔ texte océrisé), champ **« Type de document (1–6) » obligatoire**, puis
**`[Publier]` ⇒ `sealed=true`** (apposition du sceau) + `AuditLog DOC_PUBLISHED`.

## 8. Export & anti-scraping (§09)

`src/lib/pdf/seal.ts` (pdf-lib) génère un PDF scellé avec **filigrane dynamique
embarquant l'e-mail du compte + un identifiant d'export unique**, répété en diagonale.
Chaque export crée un `ExportRecord` et une entrée d'audit. Combiné au *rate limiting*,
dissuade le partage massif.

## 9. Paiement — double rail (§09)

Modèle de paliers porté par les rôles. Intégrations à brancher : **Stripe** (cartes /
diaspora USD) et **MonCash / NatCash** (HTG local). Clés vides en dev → paliers simulés.

## 10. Feuille de route (§09)

- **P0** — PI (dépôt BHDA *Lam Veritab*) + domaines + entité.
- **P1** — Bêta : types **1, 2, 6** + admin *(socle livré ici)*.
- **P2** — Lancement Pro : types **3, 4, 5** + alertes de veille.
- **P3** — Grand public + EN + **API Enstitisyon**.

Le modèle de données et l'interface couvrent déjà les 6 types ; l'ordre de
*remplissage du corpus* suit la feuille de route.

## 11. Activer OpenSearch en local

`npm run setup:opensearch` (script `scripts/setup-opensearch.sh`) automatise tout :
détection d'une instance déjà active sur :9200, sinon démarrage via **Docker**
(`docker-compose.yml`), sinon installation via **Homebrew** (macOS) ; puis bascule de
`.env` (`SEARCH_PROVIDER=opensearch`, sauvegarde `.env.bak`) et réindexation complète
(index par type + sociétés, analyseur FR + synonymie EN→FR + `fuzziness: AUTO`).
Sans prérequis installé, le script guide l'installation **sans rien modifier**.
Retour arrière : `npm run setup:opensearch:revert`. Dans les deux sens, **redémarrer
le serveur dev** (le provider est mis en cache au démarrage).

## 12. Production — points à durcir

1. PostgreSQL + OpenSearch (voir `docker-compose.yml`), `SEARCH_PROVIDER=opensearch`,
   `npm run search:reindex` — ou `npm run setup:opensearch`.
2. Secrets forts (`SESSION_SECRET`, `TRUSTED_DEVICE_SECRET`), cookies `secure`.
3. *Rate limiting* en passerelle + WAF ; rotation des journaux d'audit.
4. SMTP réel (bienvenue bilingue, alertes de sécurité, 2FA repli).
5. Stockage objet pour les PDF source ; sauvegardes chiffrées.
6. Conformité : secret bancaire (loi du 14 mai 2012), LBC/FT (UCREF), normes de
   protection des données (à défaut de loi générale haïtienne, standards internationaux).
