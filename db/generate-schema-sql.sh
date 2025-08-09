#!/usr/bin/env bash
set -Eeuo pipefail

# Generate a full SQL schema from Prisma datamodel for bootstrapping DBs (e.g., Docker init)

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PRISMA_SCHEMA="$REPO_ROOT/prisma/schema.prisma"
OUTPUT_SQL="$REPO_ROOT/docker/db/schema.sql"

if [[ ! -f "$PRISMA_SCHEMA" ]]; then
  echo "Prisma schema not found: $PRISMA_SCHEMA" >&2
  exit 1
fi

echo "Generating SQL schema from Prisma datamodel..."
echo "  Prisma schema: $PRISMA_SCHEMA"
echo "  Output       : $OUTPUT_SQL"

mkdir -p "$(dirname "$OUTPUT_SQL")"

pushd "$REPO_ROOT" > /dev/null

# Use repo-root context so paths in schema are resolved as in development
# Generate full SQL DDL from an empty baseline to the current Prisma datamodel
npx --yes prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "$PRISMA_SCHEMA" \
  --script > "$OUTPUT_SQL"

popd > /dev/null

# Sanity check: fail if output ended up empty
if [[ ! -s "$OUTPUT_SQL" ]]; then
  echo "❌ No SQL was generated. Please verify Prisma CLI and schema path." >&2
  exit 1
fi

echo "Done. Wrote: $OUTPUT_SQL"


