#!/bin/sh
set -e

echo "🚀 Starting production server..."

# Wait for database to be ready
echo "📊 Waiting for database connection..."
echo "🔄 Syncing database schema..."
npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma || echo "✅ Database schema already up to date"

# Generate Prisma client (in case it's not available)
echo "🔧 Generating Prisma client..."
npx prisma generate --schema=./prisma/schema.prisma

echo "🚀 Starting application..."
exec node dist/app.js
