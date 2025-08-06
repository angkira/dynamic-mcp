#!/bin/sh
set -e

echo "🚀 Starting production server..."

# Wait for database to be ready
echo "📊 Waiting for database connection..."
echo "🔄 Applying database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Now that migrations are applied, seed the database
echo "🌱 Seeding database..."
node dist/seed.js

echo "🚀 Starting application..."
exec node dist/app.js
