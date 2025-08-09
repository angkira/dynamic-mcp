#!/usr/bin/env bash
set -Eeuo pipefail

# Show SQL diff between an EXISTING Postgres DB and the Prisma schema
# Usage: DATABASE_URL=postgres://user:pass@host:port/db ./db/diff-db-vs-prisma.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PRISMA_SCHEMA="$REPO_ROOT/prisma/schema.prisma"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL env var is required (e.g., postgres://user:pass@host:5432/db)" >&2
  exit 1
fi

if [[ ! -f "$PRISMA_SCHEMA" ]]; then
  echo "Prisma schema not found: $PRISMA_SCHEMA" >&2
  exit 1
fi

pushd "$REPO_ROOT/server" > /dev/null

npm exec --yes prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel "$PRISMA_SCHEMA" \
  --script | sed 's/^/  /'

popd > /dev/null


