#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

echo "🔧 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  containeranalysis.googleapis.com \
  servicenetworking.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  redis.googleapis.com >/dev/null

echo "✅ APIs enabled"

