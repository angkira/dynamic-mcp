#!/bin/sh
set -e

echo "🚀 Starting production server..."

# Ensure DATABASE_URL is usable. If missing Cloud SQL host, repair using DB_CONN_NAME if available.
CONN_NAME="${DB_CONN_NAME:-${INSTANCE_CONNECTION_NAME:-}}"
if [ -z "${DATABASE_URL:-}" ]; then
  if [ -n "${DB_USER:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ] && [ -n "${DB_NAME:-}" ] && [ -n "$CONN_NAME" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${APP_DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CONN_NAME}&connection_limit=5"
    echo "🔗 DATABASE_URL constructed for Cloud SQL Unix socket"
  else
    echo "⚠️  DATABASE_URL not set and cannot be constructed (need DB_USER, APP_DB_PASSWORD, DB_NAME, DB_CONN_NAME). Skipping migrations."
    SKIP_MIGRATIONS=1
  fi
else
  case "$DATABASE_URL" in
    *"host=/cloudsql/"*) : ;; # already contains socket host
    *)
      if [ -n "$CONN_NAME" ]; then
        if printf '%s' "$DATABASE_URL" | grep -q '\?'; then
          export DATABASE_URL="${DATABASE_URL}&host=/cloudsql/${CONN_NAME}"
        else
          export DATABASE_URL="${DATABASE_URL}?host=/cloudsql/${CONN_NAME}"
        fi
        echo "🔧 Augmented DATABASE_URL with Cloud SQL socket host"
      else
        echo "⚠️  DATABASE_URL lacks Cloud SQL host and DB_CONN_NAME unavailable."
      fi
      ;;
  esac
fi

# Start migrations in background (best-effort) to avoid delaying port binding
if [ -z "${SKIP_MIGRATIONS:-}" ] && [ -n "${DATABASE_URL:-}" ]; then
  (
    echo "📊 Applying database migrations in background..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "⚠️  Migrations failed or already applied; continuing"
  ) &
fi

echo "🚀 Starting application on PORT=${PORT:-8080}..."
exec node -r ./dist/register-aliases.js ./dist/app.js
