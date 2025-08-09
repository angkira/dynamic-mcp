#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud
gcloud_configure_project

REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-chat-docker}"

echo "📦 Ensuring Artifact Registry repo ${AR_REPO} in ${REGION}..."
gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker --location="$REGION" --description="Chat images"

echo "✅ Artifact Registry ready"

