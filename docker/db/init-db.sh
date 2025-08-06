#!/bin/bash
set -e

# This script will be automatically executed by PostgreSQL container
# when the database is first initialized

echo "Initializing database with schema and data..."

# First run schema
echo "Running schema.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/schema.sql

# Then run data fill
echo "Running fill.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" < /docker-entrypoint-initdb.d/fill.sql

echo "Database initialization completed successfully!"
