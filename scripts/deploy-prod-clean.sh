#!/bin/bash
set -e

echo "🚀 Production deployment with database reset..."

echo "🔄 Stopping containers and removing volumes..."
docker compose -f docker-compose.prod.yml down -v

echo "🔧 Removing database volume to force re-initialization..."
docker volume rm dynamic-mcp_db-data 2>/dev/null || echo "Volume already removed or doesn't exist"

echo "🏗️  Building and starting production environment..."
docker compose -f docker-compose.prod.yml up --build

echo "✅ Production deployment complete!"
