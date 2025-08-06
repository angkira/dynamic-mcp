#!/bin/bash

# Build optimization script for dynamic-mcp
set -e

# Parse arguments
CLEAN_MODE="selective"  # default to selective cleaning
TAG_IMAGES=false
PLATFORM="prod"  # default to production

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
    --cloudflare)
      PLATFORM="cloudflare"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--clean-all|--no-clean] [--tag] [--cloudflare]"
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

# Choose configuration based on platform
if [ "$PLATFORM" = "cloudflare" ]; then
  COMPOSE_FILE="docker-compose.cloudflare.yml"
  SERVER_DOCKERFILE="server/Dockerfile.cloudflare"
  CLIENT_DOCKERFILE="client/Dockerfile.cloudflare"
  TAG_SUFFIX="cloudflare"
  echo "🌐 Building for Cloudflare deployment..."
else
  COMPOSE_FILE="docker-compose.prod.yml"
  SERVER_DOCKERFILE="server/Dockerfile.prod"
  CLIENT_DOCKERFILE="client/Dockerfile.prod"
  TAG_SUFFIX="latest"
  echo "🏭 Building for production deployment..."
fi

# Pre-build base images for better caching
echo "📦 Pre-building base dependencies..."
docker build \
  --target deps \
  --tag dynamic-mcp-deps:${TAG_SUFFIX} \
  --file ${SERVER_DOCKERFILE} \
  .

docker build \
  --target deps \
  --tag dynamic-mcp-client-deps:${TAG_SUFFIX} \
  --file ${CLIENT_DOCKERFILE} \
  .

# Build with parallel processing and cache
echo "🔨 Building ${PLATFORM} images with cache..."
docker compose -f ${COMPOSE_FILE} build \
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
echo "   ./scripts/build-optimized.sh                    # Production build (recommended)"
echo "   ./scripts/build-optimized.sh --cloudflare       # Cloudflare-optimized build"
echo "   ./scripts/build-optimized.sh --no-clean         # Keep all cache"
echo "   ./scripts/build-optimized.sh --clean-all        # Full cleanup"
echo "   ./scripts/build-optimized.sh --tag              # Also tag for registry"
echo "   ./scripts/build-optimized.sh --cloudflare --tag # Cloudflare build + registry tags"
