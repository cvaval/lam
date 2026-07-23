# Sauvegardes de la base de production

Le corpus juridique est l'actif le plus précieux de la plateforme. Trois filets de
sécurité se cumulent :

| Filet | Où | Fréquence | Hors-site ? | Dépend du Mac ? |
|-------|----|-----------|-------------|-----------------|
| **Sauvegardes managées Supabase** | tableau de bord Supabase | selon le forfait | oui | non |
| **Workflow GitHub Actions** (ci-dessous) | Cloudflare R2 + artefact GitHub | quotidien 07:00 UTC | oui | non |
| **Script local** `scripts/backup-db.sh` | `backups/` (dans Dropbox) | à la demande | oui (Dropbox) | oui |

Ce document décrit le **workflow GitHub Actions** — la sauvegarde automatique
indépendante du Mac. Le fichier est [`.github/workflows/backup-db.yml`](../.github/workflows/backup-db.yml).

## Ce que fait le workflow

Chaque jour (et sur demande via le bouton *Run workflow*) :

1. exécute `pg_dump` 17 depuis l'image officielle PostgreSQL (conteneur Docker — le serveur
   Supabase est en 17.x, pas d'installation de client à maintenir) ;
2. dump la base via l'URL du **pooler en mode session** (port 5432, IPv4 — joignable
   depuis les runners GitHub, contrairement à la connexion directe IPv6) ;
3. **contrôle l'intégrité** : l'archive doit être lisible et contenir la table `Document` ;
4. **chiffre** le dump en AES-256 (`gpg -c`) — le dump contient des données sensibles
   (mots de passe hachés, secrets 2FA) et ne doit jamais être stocké en clair ;
5. dépose le `.gpg` sur **Cloudflare R2** (hors-site) *et* le conserve comme **artefact
   GitHub chiffré** (secours, rétention 30 jours) ;
6. **rotation** : ne garde que les 30 dumps les plus récents sur R2.

Si les secrets R2 ne sont pas configurés, seul l'artefact GitHub est produit — le
workflow reste fonctionnel.

## Mise en route (une seule fois)

### 1. Secrets obligatoires

Dans GitHub → le dépôt → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
|--------|--------|
| `DATABASE_BACKUP_URL` | la valeur de `DIRECT_URL` du `.env` (pooler port 5432) |
| `BACKUP_PASSPHRASE` | la phrase de passe de chiffrement (voir ci-dessous) |

> ⚠️ **La phrase de passe est la seule clé de déchiffrement.** Perdue, aucune sauvegarde
> n'est récupérable. Conservez-la dans votre gestionnaire de mots de passe.

### 2. Secrets Cloudflare R2 (optionnels mais recommandés — hors-site réel)

Dans le tableau de bord Cloudflare :

1. **R2 → Create bucket** → nommez-le p. ex. `lam-backups` (région : Automatic).
2. **R2 → Manage R2 API Tokens → Create API token** → permission **Object Read & Write**,
   restreint au bucket `lam-backups`. Notez l'**Access Key ID** et le **Secret Access Key**
   (le secret n'est affiché qu'une fois).
3. L'**Account ID** figure en haut à droite de la page R2.

Puis ajoutez ces secrets GitHub :

| Secret | Valeur |
|--------|--------|
| `R2_ACCOUNT_ID` | l'Account ID Cloudflare |
| `R2_BUCKET` | `lam-backups` |
| `R2_ACCESS_KEY_ID` | l'Access Key ID du jeton R2 |
| `R2_SECRET_ACCESS_KEY` | le Secret Access Key du jeton R2 |

### 3. Premier test

GitHub → **Actions → « Sauvegarde de la base » → Run workflow**. Vérifiez que le job
passe au vert et qu'un artefact `lam-AAAA-MM-JJ` apparaît (et l'objet sur R2 si configuré).

## Restaurer une sauvegarde

```bash
# 1. Récupérer le .gpg (artefact GitHub, ou depuis R2)
# 2. Déchiffrer :
gpg --batch --passphrase 'VOTRE_PHRASE_DE_PASSE' -o lam.dump -d lam-AAAA-MM-JJ.dump.gpg
# 3. Restaurer dans une base cible :
pg_restore --clean --if-exists --no-owner --no-privileges -d "$URL_CIBLE" lam.dump
```

> Testez la restauration dans une base **de test** avant toute restauration en production —
> `pg_restore --clean` efface les tables cibles avant de les recréer.
