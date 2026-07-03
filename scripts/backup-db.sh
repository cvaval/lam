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

# Charge DIRECT_URL depuis .env si absent de l'environnement.
if [ -z "${DIRECT_URL:-}" ] && [ -f .env ]; then
  DIRECT_URL="$(grep -E '^DIRECT_URL=' .env | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
: "${DIRECT_URL:?DIRECT_URL manquant (défini dans .env)}"

if [ "${1:-}" = "--restore-into" ]; then
  TARGET="${2:?URL cible de restauration manquante}"
  echo "⚠  Restauration de ${RESTORE:?Définir RESTORE=chemin/vers/dump} → $TARGET"
  pg_restore --clean --if-exists --no-owner --no-privileges -d "$TARGET" "$RESTORE"
  echo "✓ Restauration terminée."
  exit 0
fi

mkdir -p backups
OUT="backups/lam-$(date +%F).dump"
echo "→ Sauvegarde vers $OUT …"
pg_dump "$DIRECT_URL" -Fc --no-owner --no-privileges -f "$OUT"
echo "✓ $(du -h "$OUT" | cut -f1) — $OUT"

# Rotation : ne garder que les 14 dumps les plus récents.
ls -1t backups/lam-*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "✓ Rotation : $(ls -1 backups/lam-*.dump 2>/dev/null | wc -l | tr -d ' ') sauvegardes conservées."
