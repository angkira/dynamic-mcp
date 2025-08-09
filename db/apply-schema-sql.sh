#!/usr/bin/env bash
set -Eeuo pipefail

# Apply generated schema.sql to a target Postgres instance
# Usage: ENV_FILE=server/.env ./db/apply-schema-sql.sh [path/to/schema.sql]

SCHEMA_SQL="${1:-docker/db/schema.sql}"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

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

if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "schema SQL not found: $SCHEMA_SQL" >&2
  exit 1
fi

echo "📄 Loading environment from: $ENV_PATH"
set -o allexport
# shellcheck disable=SC1090
source "$ENV_PATH"
set +o allexport

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set in $ENV_PATH" >&2
  exit 1
fi

echo "Applying schema to: $DATABASE_URL"
echo "Using file: $SCHEMA_SQL"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL"

echo "✅ Schema applied successfully"


