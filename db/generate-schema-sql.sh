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

pushd "$REPO_ROOT/server" > /dev/null

# Ensure prisma is available via server workspace
npm exec --yes prisma migrate diff \
  --from-empty \
  --to-schema-datamodel "$PRISMA_SCHEMA" \
  --script > "$OUTPUT_SQL"

popd > /dev/null

echo "Done. Wrote: $OUTPUT_SQL"


