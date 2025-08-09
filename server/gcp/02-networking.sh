#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

VPC_NAME="${VPC_NAME:-chat-vpc}"
PSA_RANGE_NAME="${PSA_RANGE_NAME:-chat-psc-range}"
PSA_RANGE_CIDR="${PSA_RANGE_CIDR:-10.10.0.0/24}"
CONNECTOR_NAME="${CONNECTOR_NAME:-chat-serverless-conn}"
CONNECTOR_RANGE="${CONNECTOR_RANGE:-10.8.0.0/28}"
REGION="${REGION:-us-central1}"

echo "🌐 Ensuring VPC network ${VPC_NAME}..."
gcloud compute networks describe "$VPC_NAME" >/dev/null 2>&1 || \
  gcloud compute networks create "$VPC_NAME" --subnet-mode=custom

echo "📦 Reserving PSC range ${PSA_RANGE_NAME} (${PSA_RANGE_CIDR})..."
gcloud compute addresses describe "$PSA_RANGE_NAME" --global >/dev/null 2>&1 || \
  gcloud compute addresses create "$PSA_RANGE_NAME" \
    --global --purpose=VPC_PEERING \
    --addresses="$(echo "$PSA_RANGE_CIDR" | cut -d/ -f1)" \
    --prefix-length="$(echo "$PSA_RANGE_CIDR" | cut -d/ -f2)" \
    --network="$VPC_NAME"

echo "🔗 Establishing service networking peering..."
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --network="$VPC_NAME" \
  --ranges="$PSA_RANGE_NAME" >/dev/null || true

echo "🔌 Ensuring Serverless VPC Connector ${CONNECTOR_NAME}..."
gcloud compute networks vpc-access connectors describe "$CONNECTOR_NAME" --region="$REGION" >/dev/null 2>&1 || \
  gcloud compute networks vpc-access connectors create "$CONNECTOR_NAME" \
    --region "$REGION" --network "$VPC_NAME" --range "$CONNECTOR_RANGE"

echo "✅ Networking configured"

