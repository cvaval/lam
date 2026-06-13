#!/bin/zsh
# Tâche QUOTIDIENNE d'OCR des fascicules du Moniteur (planifiée via launchd —
# com.lamveritab.ocr-fascicules). Gratuite : force Gemini seul (repli Claude
# désactivé en vidant ANTHROPIC_API_KEY) — le script s'arrête dès que le quota
# Gemini du jour est épuisé et reprend le lendemain. Pour accélérer (payant via
# Claude), lancer manuellement : npx tsx scripts/ocr-fascicules.ts --limit N --commit
export PATH="/Users/cvaval/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
PROJ="/Users/cvaval/Library/CloudStorage/Dropbox/Lam Veritab/lam-veritab"
cd "$PROJ" || exit 1
export ANTHROPIC_API_KEY=""   # Gemini gratuit uniquement pour le run planifié
LOG="$PROJ/logs/ocr-fascicules.log"
mkdir -p "$PROJ/logs"
{
  echo "===== $(date '+%Y-%m-%d %H:%M:%S %Z') — OCR fascicules (Gemini gratuit) ====="
  npx tsx scripts/ocr-fascicules.ts --limit 200 --commit --chunk 8
  echo "--- réindexation ---"
  npm run search:reindex || echo "(réindexation ignorée — OpenSearch absent ; le moteur FTS lit la base)"
  echo ""
} >> "$LOG" 2>&1
