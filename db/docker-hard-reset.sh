#!/usr/bin/env bash
set -Eeuo pipefail

# Hard reset Postgres running via Docker Compose by nuking the volume,
# recreating the container, applying latest Prisma-generated schema, and seeding defaults.
#
# Usage:
#   ENV_FILE=.env ./db/docker-hard-reset.sh [COMPOSE_FILE] [DB_SERVICE]
# Defaults:
#   COMPOSE_FILE=docker-compose.dev.yml
#   DB_SERVICE=db

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

COMPOSE_FILE_PATH="${1:-$REPO_ROOT/docker-compose.dev.yml}"
DB_SERVICE="${2:-db}"

if [[ ! -f "$COMPOSE_FILE_PATH" ]]; then
  echo "❌ Compose file not found: $COMPOSE_FILE_PATH" >&2
  exit 1
fi

# Resolve env file: ENV_FILE (relative to repo root or absolute) → fallback to server/.env → .env
ENV_PATH_INPUT="${ENV_FILE:-}"
if [[ -n "$ENV_PATH_INPUT" && ! "$ENV_PATH_INPUT" = /* ]]; then
  ENV_PATH="$REPO_ROOT/$ENV_PATH_INPUT"
else
  ENV_PATH="${ENV_PATH_INPUT:-}"
fi

if [[ -z "$ENV_PATH" || ! -f "$ENV_PATH" ]]; then
  if [[ -f "$REPO_ROOT/server/.env" ]]; then
    ENV_PATH="$REPO_ROOT/server/.env"
  elif [[ -f "$REPO_ROOT/.env" ]]; then
    ENV_PATH="$REPO_ROOT/.env"
  else
    echo "❌ Could not find an env file. Set ENV_FILE or create server/.env or .env" >&2
    exit 1
  fi
fi

echo "📄 Loading environment from: $ENV_PATH"
set -o allexport
# shellcheck disable=SC1090
source "$ENV_PATH"
set +o allexport

# Compose parses the entire file and expects a project .env due to env_file entries.
# Create a temporary project .env if missing to satisfy Compose and silence missing var warnings.
DOTENV_PATH="$REPO_ROOT/.env"
CLEANUP_DOTENV=0
if [[ ! -f "$DOTENV_PATH" ]]; then
  cp "$ENV_PATH" "$DOTENV_PATH"
  # Ensure compose build args used by client have defaults to avoid warnings
  grep -q '^VUE_API_URL=' "$DOTENV_PATH" || echo 'VUE_API_URL=' >> "$DOTENV_PATH"
  grep -q '^VITE_SOCKET_URL=' "$DOTENV_PATH" || echo 'VITE_SOCKET_URL=' >> "$DOTENV_PATH"
  CLEANUP_DOTENV=1
fi

DB_USER_REQUIRED="${DB_USER:-}"
DB_PASSWORD_REQUIRED="${DB_PASSWORD:-}"
DB_NAME_REQUIRED="${DB_NAME:-}"

if [[ -z "$DB_USER_REQUIRED" || -z "$DB_PASSWORD_REQUIRED" || -z "$DB_NAME_REQUIRED" ]]; then
  echo "❌ DB_USER, DB_PASSWORD, and DB_NAME must be set in $ENV_PATH (used by the Postgres container)" >&2
  exit 1
fi

echo "🧨 docker compose down -v (removing volumes)"
docker compose -f "$COMPOSE_FILE_PATH" down -v --remove-orphans

echo "🚀 Starting database service: $DB_SERVICE"
docker compose -f "$COMPOSE_FILE_PATH" up -d "$DB_SERVICE"

echo "⏳ Waiting for database to become healthy..."
ATTEMPTS=60
SLEEP=2
for ((i=1; i<=ATTEMPTS; i++)); do
  if docker compose -f "$COMPOSE_FILE_PATH" exec -T "$DB_SERVICE" pg_isready -U "$DB_USER_REQUIRED" >/dev/null 2>&1; then
    READY=1; break
  fi
  sleep "$SLEEP"
done
if [[ -z "${READY:-}" ]]; then
  echo "❌ Database did not become ready in time" >&2
  exit 1
fi
echo "✅ Database is ready"

echo "🛠 Generating latest Prisma schema SQL"
ENV_FILE_REL="$(realpath --relative-to="$REPO_ROOT" "$ENV_PATH" 2>/dev/null || echo "$ENV_PATH")"
ENV_FILE="$ENV_FILE_REL" "$REPO_ROOT/db/generate-schema-sql.sh"

SCHEMA_SQL="$REPO_ROOT/docker/db/schema.sql"
FILL_SQL="$REPO_ROOT/docker/db/fill.sql"

if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "❌ Schema SQL not found: $SCHEMA_SQL" >&2
  exit 1
fi
if [[ ! -f "$FILL_SQL" ]]; then
  echo "❌ Seed SQL not found: $FILL_SQL" >&2
  exit 1
fi

echo "📜 Applying schema inside container"
# Ensure a clean schema before applying generated DDL to avoid duplicate CREATE errors
docker compose -f "$COMPOSE_FILE_PATH" exec -T "$DB_SERVICE" bash -lc \
  "psql -U '$DB_USER' -d '${DB_NAME}' -v ON_ERROR_STOP=1 -c \"DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;\""

docker compose -f "$COMPOSE_FILE_PATH" exec -T "$DB_SERVICE" bash -lc \
  "psql -U '$DB_USER' -d '${DB_NAME}' -v ON_ERROR_STOP=1 -f -" < "$SCHEMA_SQL"

echo "🌱 Seeding defaults inside container"
docker compose -f "$COMPOSE_FILE_PATH" exec -T "$DB_SERVICE" bash -lc \
  "psql -U '$DB_USER' -d '${DB_NAME}' -v ON_ERROR_STOP=1 -f -" < "$FILL_SQL"

echo "🎉 Docker hard reset complete"

# Cleanup temporary project .env if we created it
if [[ "$CLEANUP_DOTENV" -eq 1 ]]; then
  rm -f "$DOTENV_PATH"
fi


