#!/bin/bash

# Build optimization script for dynamic-mcp
set -e

# Parse arguments
CLEAN_MODE="selective"  # default to selective cleaning
TAG_IMAGES=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean-all)
      CLEAN_MODE="all"
      shift
      ;;
    --no-clean)
      CLEAN_MODE="none"
      shift
      ;;
    --tag)
      TAG_IMAGES=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--clean-all|--no-clean] [--tag]"
      exit 1
      ;;
  esac
done

echo "🚀 Starting optimized Docker build..."

# Enable BuildKit for better performance
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Selective cleanup based on mode
if [ "$CLEAN_MODE" = "all" ]; then
  echo "🧹 Cleaning up all unused Docker resources..."
  docker builder prune -f
  docker image prune -f
elif [ "$CLEAN_MODE" = "selective" ]; then
  echo "🧹 Cleaning up previous dynamic-mcp builds only..."
  # Remove only dynamic-mcp related images
  docker images | grep "dynamic-mcp" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
  # Remove dangling images (but keep other cached layers)
  docker images | grep "<none>" | awk '{print $3}' | xargs -r docker rmi -f 2>/dev/null || true
  echo "   (Keeping other Docker cache for faster builds)"
else
  echo "⚡ Skipping cleanup - using existing cache..."
fi

# Pre-build base images for better caching
echo "📦 Pre-building base dependencies..."
docker build \
  --target deps \
  --tag dynamic-mcp-deps:latest \
  --file server/Dockerfile.prod \
  .

docker build \
  --target deps \
  --tag dynamic-mcp-client-deps:latest \
  --file client/Dockerfile.prod \
  .

# Build with parallel processing and cache
echo "🔨 Building production images with cache..."
docker compose -f docker-compose.prod.yml build \
  --parallel \
  --build-arg BUILDKIT_INLINE_CACHE=1

echo "✅ Build completed successfully!"

# Optional: Tag images for registry
if [ "$TAG_IMAGES" = true ]; then
  echo "🏷️  Tagging images for registry..."
  docker tag dynamic-mcp-server:latest your-registry/dynamic-mcp-server:latest
  docker tag dynamic-mcp-client:latest your-registry/dynamic-mcp-client:latest
fi

echo "📊 Build summary:"
docker images | grep dynamic-mcp

echo ""
echo "💡 Usage tips:"
echo "   ./scripts/build-optimized.sh              # Selective cleanup (recommended)"
echo "   ./scripts/build-optimized.sh --no-clean   # Keep all cache"
echo "   ./scripts/build-optimized.sh --clean-all  # Full cleanup"
echo "   ./scripts/build-optimized.sh --tag        # Also tag for registry"
