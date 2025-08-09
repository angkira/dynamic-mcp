#!/usr/bin/env bash
set -Eeuo pipefail

# Apply generated schema.sql to a target Postgres instance
# Usage: DATABASE_URL=postgres://user:pass@host:port/db ./db/apply-schema-sql.sh [path/to/schema.sql]

SCHEMA_SQL="${1:-docker/db/schema.sql}"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL env var is required (e.g., postgres://user:pass@host:5432/db)" >&2
  exit 1
fi

if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "schema SQL not found: $SCHEMA_SQL" >&2
  exit 1
fi

echo "Applying schema to: $DATABASE_URL"
echo "Using file: $SCHEMA_SQL"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$SCHEMA_SQL"

echo "Schema applied successfully"


