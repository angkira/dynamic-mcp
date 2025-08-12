#!/bin/sh
set -e

echo "🚀 Starting production server..."

# Build DATABASE_URL from env if not provided (Cloud Run + Cloud SQL Unix socket)
if [ -z "${DATABASE_URL:-}" ]; then
  CONN_NAME="${DB_CONN_NAME:-${INSTANCE_CONNECTION_NAME:-}}"
  if [ -n "${DB_USER:-}" ] && [ -n "${APP_DB_PASSWORD:-}" ] && [ -n "${DB_NAME:-}" ] && [ -n "$CONN_NAME" ]; then
    export DATABASE_URL="postgresql://${DB_USER}:${APP_DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CONN_NAME}&connection_limit=5"
    echo "🔗 DATABASE_URL constructed for Cloud SQL Unix socket"
  else
    echo "⚠️  DATABASE_URL not set and cannot be constructed (need DB_USER, APP_DB_PASSWORD, DB_NAME, DB_CONN_NAME). Skipping migrations."
    SKIP_MIGRATIONS=1
  fi
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
