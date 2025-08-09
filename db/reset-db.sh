#!/usr/bin/env bash
set -Eeuo pipefail

# Reset a Postgres database to the latest schema and seed defaults
# - Creates the database if it doesn't exist
# - Drops all tables (via dropping the public schema) in the target DB
# - Applies docker/db/schema.sql
# - Applies docker/db/fill.sql
#
# Usage:
#   ENV_FILE=server/.env.dev ./db/reset-db.sh [schema_sql] [fill_sql]

SCHEMA_SQL="${1:-docker/db/schema.sql}"
FILL_SQL="${2:-docker/db/fill.sql}"

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

echo "📄 Loading environment from: $ENV_PATH"
set -o allexport
# shellcheck disable=SC1090
source "$ENV_PATH"
set +o allexport

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL not set in $ENV_PATH" >&2
  exit 1
fi

if [[ ! -f "$SCHEMA_SQL" ]]; then
  echo "Schema SQL not found: $SCHEMA_SQL" >&2
  exit 1
fi

if [[ ! -f "$FILL_SQL" ]]; then
  echo "Seed SQL not found: $FILL_SQL" >&2
  exit 1
fi

# Extract DB name from the DATABASE_URL (string after the last '/' and before optional '?')
DB_NAME=$(printf "%s" "$DATABASE_URL" | sed -E 's|.*/([^/?]+)(\?.*)?$|\1|')
if [[ -z "$DB_NAME" ]]; then
  echo "Failed to parse database name from DATABASE_URL" >&2
  exit 1
fi

# Build an admin URL by swapping the db name to 'postgres' so we can create the DB if missing
ADMIN_URL=$(printf "%s" "$DATABASE_URL" | sed -E "s|/(${DB_NAME})(\?.*)?$|/postgres\\2|")

#############################################
# Determine admin connection
#############################################
APP_URL="$DATABASE_URL"

# Extract parts from APP_URL for potential admin fallback
APP_USER=$(printf "%s" "$APP_URL" | sed -E 's|^[^:]+://([^:@/]+).*|\1|')
APP_PASS=$(printf "%s" "$APP_URL" | sed -E 's|^[^:]+://[^:]+:([^@/]+)@.*|\1|') || true
APP_HOST=$(printf "%s" "$APP_URL" | sed -E 's|^[^@]+@([^:/?#]+).*|\1|')
APP_PORT=$(printf "%s" "$APP_URL" | sed -E 's|^[^@]+@[^:/?#]+:([0-9]+).*|\1|') || true
APP_PORT=${APP_PORT:-5432}

ADMIN_URL="${ADMIN_DATABASE_URL:-}"
if [[ -z "$ADMIN_URL" && -n "${DB_ROOT_PASS:-}" ]]; then
  ADMIN_URL="postgres://postgres:${DB_ROOT_PASS}@${APP_HOST}:${APP_PORT}/postgres"
fi

if [[ -z "$ADMIN_URL" ]]; then
  echo "❌ ADMIN_DATABASE_URL not set and no DB_ROOT_PASS fallback available. Set ADMIN_DATABASE_URL in $ENV_PATH." >&2
  exit 1
fi

echo "🔐 Using admin connection: $ADMIN_URL"

#############################################
# Ensure role and database
#############################################
echo "👤 Ensuring role exists for app user: $APP_USER"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN CREATE ROLE \"$APP_USER\" LOGIN PASSWORD '$APP_PASS'; ELSE PERFORM 1; END IF; END $$;"

echo "🔧 Ensuring database exists: $DB_NAME (owner: $APP_USER)"
EXISTS=$(psql "$ADMIN_URL" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" || true)
if [[ "$EXISTS" != "1" ]]; then
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$APP_USER\""
  echo "✅ Created database: $DB_NAME"
else
  # Ensure ownership
  psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "ALTER DATABASE \"$DB_NAME\" OWNER TO \"$APP_USER\";"
  echo "✅ Database already exists: $DB_NAME (owner adjusted)"
fi

#############################################
# Reset schema, generate latest SQL, apply, seed
#############################################
echo "🧹 Dropping and recreating schema 'public' in $DB_NAME"
psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -c "REVOKE CONNECT ON DATABASE \"$DB_NAME\" FROM PUBLIC;" || true
psql "$APP_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION \"$APP_USER\";"
psql "$APP_URL" -v ON_ERROR_STOP=1 -c "GRANT ALL ON SCHEMA public TO \"$APP_USER\"; GRANT ALL ON SCHEMA public TO PUBLIC;"

echo "🛠 Generating latest Prisma schema SQL"
ENV_FILE_REL="$(realpath --relative-to="$REPO_ROOT" "$ENV_PATH" 2>/dev/null || echo "$ENV_PATH")"
ENV_FILE="$ENV_FILE_REL" "$REPO_ROOT/db/generate-schema-sql.sh"

echo "📜 Applying schema: $SCHEMA_SQL"
ENV_FILE="$ENV_FILE_REL" "$REPO_ROOT/db/apply-schema-sql.sh" "$SCHEMA_SQL"

echo "🌱 Seeding defaults: $FILL_SQL"
psql "$APP_URL" -v ON_ERROR_STOP=1 -f "$FILL_SQL"

echo "🎉 Reset complete for database: $DB_NAME"


