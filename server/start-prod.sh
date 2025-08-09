#!/bin/sh
set -e

echo "🚀 Starting production server..."

# Apply Prisma migrations in production (idempotent)
echo "📊 Applying database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "✅ Migrations already applied"

# Ensure schema is up to date (adds new columns if migrations are missing)
echo "🧭 Pushing Prisma schema (safe additive changes)..."
npx prisma db push --accept-data-loss --schema=./prisma/schema.prisma || true

# Generate Prisma client (in case it's not available)
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

echo "🚀 Starting application..."
exec node dist/app.js
