#!/usr/bin/env bash
# Sauvegarde de la base de production (audit 2 juil. 2026).
# Le corpus juridique est l'actif le plus précieux : un dump régulier + un test de
# restauration protègent contre l'effacement accidentel (cf. garde-fous seed / db:reset).
#
#   bash scripts/backup-db.sh            # dump horodaté dans backups/, rotation 14 jours
#   RESTORE=backups/lam-2026-07-02.dump bash scripts/backup-db.sh --restore-into "$LOCAL_URL"
#
# Prérequis : pg_dump/pg_restore (postgresql-client). DIRECT_URL doit être défini (.env).
set -euo pipefail
cd "$(dirname "$0")/.."

# libpq (pg_dump) n'est pas dans le PATH par défaut d'une tâche planifiée (launchd) :
# on l'ajoute explicitement s'il est installé par Homebrew.
[ -d /opt/homebrew/opt/libpq/bin ] && PATH="/opt/homebrew/opt/libpq/bin:$PATH"

# Charge DIRECT_URL depuis .env si absent de l'environnement.
if [ -z "${DIRECT_URL:-}" ] && [ -f .env ]; then
  DIRECT_URL="$(grep -E '^DIRECT_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
: "${DIRECT_URL:?DIRECT_URL manquant (défini dans .env)}"

# TCP keepalives : sans eux, le pooler Supabase coupe la connexion SSL en cours de
# route sur une grosse table (« SSL connection has been closed unexpectedly ») et le
# dump échoue à mi-parcours. Ajoutés à la chaîne de connexion (paramètres libpq).
_sep=$([[ "$DIRECT_URL" == *\?* ]] && echo '&' || echo '?')
DIRECT_URL="${DIRECT_URL}${_sep}keepalives=1&keepalives_idle=20&keepalives_interval=10&keepalives_count=15"

if [ "${1:-}" = "--restore-into" ]; then
  TARGET="${2:?URL cible de restauration manquante}"
  echo "⚠  Restauration de ${RESTORE:?Définir RESTORE=chemin/vers/dump} → $TARGET"
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET" "$RESTORE"
  echo "✓ Restauration terminée."
  exit 0
fi

mkdir -p backups
OUT="backups/lam-$(date +%F).dump"
echo "→ $(date '+%F %T') — Sauvegarde vers $OUT …"
# Dump vers un fichier TEMPORAIRE : un dump interrompu ne remplace jamais un bon.
pg_dump "$DIRECT_URL" -Fc --no-owner --no-privileges -f "$OUT.part"

# Contrôle d'intégrité : l'archive doit être LISIBLE et contenir la table Document
# (une tâche planifiée non surveillée doit échouer bruyamment si le dump est tronqué).
if ! pg_restore --list "$OUT.part" >/dev/null 2>&1; then
  echo "✗ ÉCHEC : archive illisible — dump abandonné (l'ancien dump est conservé)." >&2
  rm -f "$OUT.part"; exit 1
fi
if ! pg_restore --list "$OUT.part" 2>/dev/null | grep -q 'TABLE DATA public Document '; then
  echo "✗ ÉCHEC : table Document absente du dump — abandon." >&2
  rm -f "$OUT.part"; exit 1
fi
mv -f "$OUT.part" "$OUT"
echo "✓ $(du -h "$OUT" | cut -f1) — $OUT (intégrité vérifiée)"

# Rotation : ne garder que les 14 dumps les plus récents.
ls -1t backups/lam-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "✓ Rotation : $(ls -1 backups/lam-*.dump 2>/dev/null | wc -l | tr -d ' ') sauvegardes conservées."
