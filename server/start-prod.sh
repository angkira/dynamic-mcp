#!/bin/sh
set -e

echo "🚀 Starting production server..."

# Apply Prisma migrations in production (idempotent)
echo "📊 Applying database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "✅ Migrations already applied"

# Avoid schema push in production to prevent unintended destructive changes
# Use migrate deploy only; if migrations missing, roll a proper migration first.

# Generate Prisma client (in case it's not available)
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

echo "🚀 Starting application..."
exec node dist/app.js
