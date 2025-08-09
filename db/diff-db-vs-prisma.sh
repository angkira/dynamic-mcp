#!/usr/bin/env bash
set -Eeuo pipefail

# Show SQL diff between an EXISTING Postgres DB and the Prisma schema
# Usage: ENV_FILE=server/.env ./db/diff-db-vs-prisma.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PRISMA_SCHEMA="$REPO_ROOT/prisma/schema.prisma"

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

if [[ ! -f "$PRISMA_SCHEMA" ]]; then
  echo "Prisma schema not found: $PRISMA_SCHEMA" >&2
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

pushd "$REPO_ROOT" > /dev/null

npx --yes prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel "$PRISMA_SCHEMA" \
  --script | sed 's/^/  /'

popd > /dev/null


