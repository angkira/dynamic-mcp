#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

steps=(
  01-enable-apis.sh
  02-networking.sh
  03-firewall.sh
  04-cloudsql.sh
  05-secrets.sh
  06-artifact-registry.sh
  07-iam.sh
  00-staging-bucket.sh
  08-build-and-deploy.sh
)

for step in "${steps[@]}"; do
  echo "\n==> Running $step"
  bash "$SCRIPT_DIR/$step"
done

if [[ "${WITH_LB:-false}" == "true" ]]; then
  echo "\n==> Running optional 09-load-balancer.sh"
  bash "$SCRIPT_DIR/09-load-balancer.sh"
fi

if [[ "${WITH_REDIS:-false}" == "true" ]]; then
  echo "\n==> Running optional 10-memorystore.sh"
  bash "$SCRIPT_DIR/10-memorystore.sh"
fi

echo "\n✅ All steps completed"

