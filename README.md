# Lam Veritab — *le fruit du savoir*

Plateforme SaaS **trilingue (français · anglais · kreyòl)** de recherche juridique
haïtienne, pour les spécialistes du droit et le grand public. Référence :
LexisNexis / Thomson Reuters / vLex, appliquée au corpus du **Moniteur**.

> Réalisation du *Plan de plateforme UI/UX v1.0* préparé pour Me Christelle Vaval.
> Couvre les 6 types de documents, l'index transversal sociétés/marques, l'interface
> utilisateur + master admin, le login en page d'accueil, la 2FA reconfirmée tous les
> 30 jours et l'activation des accès par le master admin.

---

## Démarrage rapide (zéro infrastructure)

```bash
cd lam-veritab
cp .env.example .env
npm install
npm run setup     # prisma generate + db push + seed (corpus de démonstration)
npm run dev       # http://localhost:3000
```

L'application tourne **sans Docker ni base externe** : SQLite + moteur de recherche
intégré. Pour la pile de production (PostgreSQL + OpenSearch), voir
[ARCHITECTURE.md](ARCHITECTURE.md).

### Comptes de démonstration

Mot de passe commun : **`Demo1234!`** — en mode dev, le **code 2FA courant est affiché
sur l'écran de vérification** (bouton « Code de démo »), aucune application
d'authentification requise.

| Compte | Type | Accès |
| --- | --- | --- |
| `admin@lam.ht` | Master Admin | Tout — console d'administration |
| `pro@cabinet.ht` | Pwofesyonèl | Lecture intégrale, export scellé, alertes |
| `inst@banque.ht` | Enstitisyon | + multi-utilisateurs / API, alertes sectorielles |
| `editeur@lam.ht` | Éditeur | Téléverser / OCR / publier |
| `sitwayen@exemple.ht` | Sitwayen (gratuit) | Extraits + quota mensuel de recherche |

Plus 4 comptes **en attente d'activation** visibles dans la console Master Admin.

---

## Les 6 types de documents (§01)

La navigation par couleur traverse toute la plateforme (pastilles, badges, filtres).

| # | Type | Pastille | Badge | Particularités |
| --- | --- | --- | --- | --- |
| 1 | Index de la législation | **Lank** | `LÉGISLATION` | Versions consolidées + historique ; *En vigueur / Abrogé* |
| 2 | Circulaires de la BRH | **Solèy** | `BRH` | Tri par n° de circulaire ; alertes (Pro) |
| 3 | Recueil de jurisprudence | **Brim** | `JURISPRUDENCE` | Filtres juridiction (Cassation/Appel) & matière |
| 4 | Doctrine haïtienne | **Lagon** `#9ADCDC` | `DOCTRINE` | Auteur, revue, année ; citations croisées |
| 5 | Lois de finances | **Fèy** `#3a5505` | `FINANCES` | Navigation par exercice fiscal |
| 6 | Marques de commerce | **Sitwon** | `MARQUES` | Antériorité : nom, classe de Nice, titulaire, n° BHDA |

L'**index transversal** (sociétés · textes · marques) n'est pas un 7ᵉ type : c'est la
couche d'indexation que l'omnibox traverse, et chaque fiche société agrège ses
publications au Moniteur.

### 7ᵉ service — Index du Moniteur (1900-2023)

En plus des 6 services à texte intégral, la plateforme expose l'**Index du Moniteur** :
**27 708 entrées** (Index des Lois 1900-1944 + Index Annoté du Moniteur 1969-2023),
plus l'extraction de **~8 800 sociétés** et **~10 600 publications** vers l'index
transversal. L'Index ne contient que des **références** (référence de publication + date ;
**pas de texte intégral**) — signalées par un bandeau dédié. Les 6 autres onglets donnent
accès aux textes intégraux. Le master admin peut restreindre un compte à l'**accès Index
seulement**. Le fichier source est détecté automatiquement dans `DATA ACEVIEWER/` (ou via
`MONITEUR_INDEX_PATH`). Le moteur FTS intégré préfiltre au niveau SQL (`searchText`
accent-folé) pour rester rapide à cette échelle ; au-delà, OpenSearch prend le relais.

---

## Fonctionnalités livrées

- **Trilingue FR / EN / HT** — interface entièrement traduite ; sélecteur persistant
  par compte ; **le texte officiel n'est jamais traduit** (§02), bandeau dédié.
- **Recherche translingue** — une requête EN retrouve les documents FR via synonymie
  indexée (`trademark` → `marque de commerce`). Surlignage Sitwon des termes.
- **Authentification 2FA / 30 jours** (§04) — mot de passe + TOTP ; appareil de
  confiance 30 jours (cookie signé + empreinte) ; rappel J-3 ; **2FA à chaque session
  pour Éditeur & Master Admin** ; verrouillage 5 essais → 15 min ; journal d'accès.
- **5 types d'utilisateurs** avec matrice d'accès appliquée côté serveur (§03).
- **Master Admin** (§08) — KPIs, activation des comptes (+ attribution du type),
  suspension, changement de type, réinitialisation 2FA, logs de sécurité.
- **Création de comptes & codes promo** — le master admin crée un compte directement
  (mot de passe temporaire + enrôlement 2FA forcé) et **génère des codes promo**
  octroyant un palier payant gratuitement pour une durée donnée ; un code peut être
  appliqué à la création, attribué à un compte, ou activé par l'utilisateur depuis son
  espace. Le palier promo échu **retombe automatiquement** en Sitwayen à la connexion.
- **CMS / Pipeline OCR** — dépôt PDF, validation en écran scindé, **`[Publier]` =
  apposition du sceau**, champ « Type de document (1–6) » obligatoire à l'indexation.
- **Export PDF scellé + filigrane dynamique** (§09) — chaque PDF embarque
  l'identifiant du compte exportateur (anti-scraping).
- **Double rail de paiement** — abstraction Stripe (USD diaspora) + MonCash/NatCash
  (HTG) ; paliers simulés en dev.

---

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run setup` | generate + db push + seed |
| `npm run db:reset` | Réinitialise la base et re-seed |
| `npm run db:seed` | (Re)charge le corpus de démonstration + l'Index du Moniteur |
| `npm run import:index` | Importe/ré-importe l'Index du Moniteur 1900-2023 (idempotent) |
| `npm run setup:opensearch` | Installe/démarre OpenSearch en local, bascule la config et réindexe |
| `npm run setup:opensearch:revert` | Revient au moteur de recherche intégré (`fts`) |
| `npm run search:reindex` | Réindexe vers OpenSearch (si `SEARCH_PROVIDER=opensearch`) |
| `npm run typecheck` | Vérification TypeScript |

---

## Pile technique

Next.js 14 (App Router, RSC) · TypeScript · Tailwind CSS · Prisma · SQLite (dev) /
PostgreSQL (prod) · OpenSearch/Elasticsearch (prod) · otplib (TOTP) · pdf-lib (sceau).

Détails d'architecture, modèle de données, sécurité et feuille de route :
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

> ⚠️ Le corpus livré est **illustratif** (données de démonstration ancrées dans les
> structures réelles du droit haïtien). Il ne constitue pas une source juridique
> authentique : la production se nourrit du Moniteur via le pipeline OCR éditorial.

> 💡 Si ce dossier est synchronisé par Dropbox, excluez `node_modules/`, `.next/` et
> `prisma/*.db` de la synchronisation (très nombreux fichiers).
