#!/usr/bin/env bash

set -euo pipefail

# Delegate to modular GCP scripts under server/gcp
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GCP_DIR="$SCRIPT_DIR/server/gcp"

if [[ ! -d "$GCP_DIR" ]]; then
  echo "❌ Directory $GCP_DIR not found" >&2
  exit 1
fi

# Allow overriding ENV_FILE, WITH_LB, and other vars; run orchestrator
bash "$GCP_DIR/run-all.sh"


