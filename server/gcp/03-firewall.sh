#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud
gcloud_configure_project

VPC_NAME="${VPC_NAME:-chat-vpc}"
PSA_RANGE_CIDR="${PSA_RANGE_CIDR:-10.10.0.0/24}"
FW_RULE_SQL="${FW_RULE_SQL:-chat-allow-svpc-to-sql}"

echo "🛡️  Ensuring firewall rule to allow egress to Cloud SQL private range..."
gcloud compute firewall-rules describe "$FW_RULE_SQL" >/dev/null 2>&1 || \
  gcloud compute firewall-rules create "$FW_RULE_SQL" \
    --network="$VPC_NAME" \
    --direction=EGRESS \
    --priority=1000 \
    --action=ALLOW \
    --rules=tcp:5432 \
    --destination-ranges="$PSA_RANGE_CIDR"

echo "✅ Firewall configured"

