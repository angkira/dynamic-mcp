#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

REGION="${REGION:-us-central1}"
NETWORK="${VPC_NAME:-chat-vpc}"
REDIS_INSTANCE_NAME="${REDIS_INSTANCE_NAME:-chat-redis}"
REDIS_TIER="${REDIS_TIER:-BASIC}"
REDIS_SIZE_GB="${REDIS_SIZE_GB:-1}"

echo "🧠 Ensuring Memorystore (Redis) instance ${REDIS_INSTANCE_NAME}..."
if ! gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" >/dev/null 2>&1; then
  gcloud redis instances create "$REDIS_INSTANCE_NAME" \
    --region "$REGION" \
    --tier "$REDIS_TIER" \
    --size "$REDIS_SIZE_GB" \
    --transit-encryption-mode DISABLED \
    --network "$NETWORK" >/dev/null
fi

REDIS_HOST=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" --format='value(host)')
REDIS_PORT=$(gcloud redis instances describe "$REDIS_INSTANCE_NAME" --region "$REGION" --format='value(port)')
echo "REDIS_HOST=$REDIS_HOST"
echo "REDIS_PORT=$REDIS_PORT"
export REDIS_HOST REDIS_PORT
export_vars_file REDIS_HOST REDIS_PORT

echo "✅ Memorystore ready: ${REDIS_HOST}:${REDIS_PORT}"


