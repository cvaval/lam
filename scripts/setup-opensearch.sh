#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lam Veritab — installation et activation d'OpenSearch en local (§09)
#
#   ./scripts/setup-opensearch.sh            installe/démarre, configure, réindexe
#   ./scripts/setup-opensearch.sh --revert   revient au moteur intégré (fts)
#   ./scripts/setup-opensearch.sh --no-reindex   sans réindexation
#
# Stratégie (dans l'ordre) :
#   1. Une instance OpenSearch répond déjà sur :9200  → on la configure
#   2. Docker disponible                              → docker compose up -d opensearch
#   3. Homebrew disponible (macOS)                    → brew install opensearch
#   4. Sinon : instructions d'installation du prérequis, sans rien casser.
#
# Idempotent : ré-exécutable sans danger. Sauvegarde .env → .env.bak avant toute
# modification. Après bascule, REDÉMARRER le serveur dev (le provider est mis en
# cache au démarrage).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
PORT=9200
NODE_URL=""
REINDEX=1

say()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✖\033[0m %s\n' "$*" >&2; exit 1; }

# ── Mise à jour de .env : remplace la ligne si présente, sinon l'ajoute ──
set_env() {
  local key="$1" value="$2"
  [ -f "$ENV_FILE" ] || cp "$ROOT/.env.example" "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # sed BSD (macOS) et GNU compatibles
    sed -i.tmp "s|^${key}=.*|${key}=\"${value}\"|" "$ENV_FILE" && rm -f "$ENV_FILE.tmp"
  else
    printf '%s="%s"\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

backup_env() {
  [ -f "$ENV_FILE" ] && cp "$ENV_FILE" "$ENV_FILE.bak" && say "Sauvegarde : .env → .env.bak"
}

# ── --revert : retour au moteur intégré ──
if [ "${1:-}" = "--revert" ]; then
  backup_env
  set_env SEARCH_PROVIDER "fts"
  ok "SEARCH_PROVIDER=fts — moteur intégré réactivé."
  warn "Redémarrez le serveur dev pour appliquer (npm run dev)."
  exit 0
fi
[ "${1:-}" = "--no-reindex" ] && REINDEX=0

# ── 0) Une instance répond-elle déjà ? (http puis https auto-signé) ──
detect_running() {
  if curl -fsS -m 3 "http://localhost:$PORT" >/dev/null 2>&1; then
    NODE_URL="http://localhost:$PORT"; return 0
  fi
  if curl -fsSk -m 3 -u admin:admin "https://localhost:$PORT" >/dev/null 2>&1; then
    NODE_URL="https://localhost:$PORT"; return 0
  fi
  return 1
}

wait_ready() {
  local url="$1" tries="${2:-90}"
  say "Attente de la disponibilité d'OpenSearch ($url)…"
  for i in $(seq 1 "$tries"); do
    if curl -fsSk -m 3 -u admin:admin "$url/_cluster/health" 2>/dev/null | grep -qE '"status":"(green|yellow)"'; then
      ok "Cluster prêt (${i}s)."
      return 0
    fi
    sleep 1
  done
  return 1
}

if detect_running; then
  ok "OpenSearch répond déjà sur $NODE_URL"
else
  # ── 1) Docker ──
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    say "Docker détecté — démarrage du conteneur (docker-compose.yml)…"
    if docker compose version >/dev/null 2>&1; then
      (cd "$ROOT" && docker compose up -d opensearch)
    elif command -v docker-compose >/dev/null 2>&1; then
      (cd "$ROOT" && docker-compose up -d opensearch)
    else
      die "Docker présent mais ni « docker compose » ni « docker-compose » disponibles."
    fi
    NODE_URL="http://localhost:$PORT"   # compose dev : security plugin désactivé → http
    wait_ready "$NODE_URL" 120 || die "Le conteneur n'est pas devenu disponible (docker compose logs opensearch)."

  # ── 2) Homebrew (build macOS natif, sans plugin de sécurité → http) ──
  elif command -v brew >/dev/null 2>&1; then
    if ! brew list opensearch >/dev/null 2>&1; then
      say "Installation via Homebrew (peut prendre plusieurs minutes)…"
      brew install opensearch
    else
      ok "Formule opensearch déjà installée."
    fi
    say "Démarrage du service (brew services start opensearch)…"
    brew services start opensearch >/dev/null
    NODE_URL="http://localhost:$PORT"
    wait_ready "$NODE_URL" 120 || die "OpenSearch (brew) n'a pas démarré — voir : brew services info opensearch ; tail -50 \$(brew --prefix)/var/log/opensearch.log"

  # ── 3) Aucun prérequis : guider sans rien casser ──
  else
    warn "Ni instance active, ni Docker, ni Homebrew détectés."
    cat <<'EOF'

  OpenSearch n'a pas de distribution macOS officielle : il faut l'un des deux
  prérequis ci-dessous (au choix), puis relancer ce script.

  Option A — Homebrew (recommandée, légère, sans Docker) :
    1. Installer Homebrew :
       /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
       (mot de passe administrateur requis, ~5 min)
    2. Relancer :  npm run setup:opensearch

  Option B — Docker Desktop (ou colima) :
    1. Installer https://www.docker.com/products/docker-desktop/  (ou : brew install colima docker && colima start)
    2. Relancer :  npm run setup:opensearch

  Rien n'a été modifié : la plateforme continue de fonctionner avec le moteur
  intégré (SEARCH_PROVIDER=fts), pleinement opérationnel.
EOF
    exit 2
  fi
fi

# ── Bascule de configuration ──
backup_env
set_env SEARCH_PROVIDER "opensearch"
set_env OPENSEARCH_NODE "$NODE_URL"
case "$NODE_URL" in
  https*) set_env OPENSEARCH_INSECURE "true" ;;   # certificat auto-signé en local
  *)      set_env OPENSEARCH_INSECURE "false" ;;
esac
ok "Configuration .env : SEARCH_PROVIDER=opensearch · OPENSEARCH_NODE=$NODE_URL"

# ── Réindexation (index par type + index sociétés, analyseur FR + synonymes) ──
if [ "$REINDEX" = "1" ]; then
  say "Réindexation du corpus vers OpenSearch…"
  (cd "$ROOT" && SEARCH_PROVIDER=opensearch OPENSEARCH_NODE="$NODE_URL" \
    OPENSEARCH_INSECURE="$([[ "$NODE_URL" == https* ]] && echo true || echo false)" \
    npm run --silent search:reindex)
  ok "Réindexation terminée."
else
  warn "Réindexation sautée (--no-reindex) : lancez « npm run search:reindex » plus tard."
fi

echo
ok  "OpenSearch est actif et configuré."
warn "REDÉMARREZ le serveur dev pour basculer le moteur :  npm run dev"
say "Retour au moteur intégré à tout moment :  ./scripts/setup-opensearch.sh --revert"
