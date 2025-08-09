#!/usr/bin/env bash

set -e -o pipefail

# ==========================
# Load existing env (reuses server/.env if present)
# ==========================
ENV_FILE="${ENV_FILE:-server/.env}"
if [[ -f "$ENV_FILE" ]]; then
  echo "📄 Loading environment from $ENV_FILE"
  set -o allexport
  # shellcheck source=/dev/null
  source "$ENV_FILE"
  set +o allexport
fi

gcloud builds submit --config=server/cloudbuild-server.yaml \
      --substitutions=_IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$SERVICE_NAME:$(date -u +%Y%m%d-%H%M%S)" \
      .