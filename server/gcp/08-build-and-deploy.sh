#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-chat-docker}"
SERVICE_NAME="${SERVICE_NAME:-chat-backend}"

echo "🏗️  Building container image with Cloud Build..."
TAG=$(date -u +%Y%m%d-%H%M%S)
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$SERVICE_NAME:$TAG"
gcloud builds submit --config="$SCRIPT_DIR/../cloudbuild-server.yaml" --substitutions=_IMAGE="$IMAGE" "$REPO_ROOT"

echo "🚢 Deploying Cloud Run service ${SERVICE_NAME}..."
# Read DB_CONN_NAME exported by 04-cloudsql.sh if available
if [[ -f "$SCRIPT_DIR/.out.env" ]]; then
  # shellcheck disable=SC1090
  source "$SCRIPT_DIR/.out.env"
fi
DB_CONN_NAME="${DB_CONN_NAME:-}"

# Database-related envs for app startup (used to construct DATABASE_URL if not provided)
DB_USER="${DB_USER:-appuser}"
DB_NAME="${DB_NAME:-appdb}"

SECRET_BINDINGS="JWT_SIGNING_KEY=JWT_SIGNING_KEY:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,CHATGPT_API_KEY=CHATGPT_API_KEY:latest,MCP_API_KEY=MCP_API_KEY:latest,APP_DB_PASSWORD=APP_DB_PASSWORD:latest"
# Include OAuth secrets if present
SECRET_BINDINGS+="$(gcloud secrets describe GOOGLE_OAUTH_CLIENT_ID >/dev/null 2>&1 && echo ",GOOGLE_OAUTH_CLIENT_ID=GOOGLE_OAUTH_CLIENT_ID:latest" || true)"
SECRET_BINDINGS+="$(gcloud secrets describe GOOGLE_OAUTH_CLIENT_SECRET >/dev/null 2>&1 && echo ",GOOGLE_OAUTH_CLIENT_SECRET=GOOGLE_OAUTH_CLIENT_SECRET:latest" || true)"
SECRET_BINDINGS+="$(gcloud secrets describe GOOGLE_OAUTH_REDIRECT_URI >/dev/null 2>&1 && echo ",GOOGLE_OAUTH_REDIRECT_URI=GOOGLE_OAUTH_REDIRECT_URI:latest" || true)"
SECRET_BINDINGS+="$(gcloud secrets describe GITHUB_OAUTH_CLIENT_ID >/dev/null 2>&1 && echo ",GITHUB_OAUTH_CLIENT_ID=GITHUB_OAUTH_CLIENT_ID:latest" || true)"
SECRET_BINDINGS+="$(gcloud secrets describe GITHUB_OAUTH_CLIENT_SECRET >/dev/null 2>&1 && echo ",GITHUB_OAUTH_CLIENT_SECRET=GITHUB_OAUTH_CLIENT_SECRET:latest" || true)"

RUN_ARGS=(
  --image "$IMAGE"
  --region "$REGION"
  --min-instances=1
  --timeout=3600
  --concurrency=250
  --cpu=1
  --memory=2Gi
  --set-secrets "$SECRET_BINDINGS"
)

if [[ -z "$DB_CONN_NAME" && -n "${DB_INSTANCE_NAME:-}" ]]; then
  # Resolve connectionName from instance if not provided in .out.env
  DB_CONN_NAME=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format='value(connectionName)' || true)
fi

SET_ENV_VARS=""
if [[ -n "$DB_CONN_NAME" ]]; then
  RUN_ARGS+=(--add-cloudsql-instances="$DB_CONN_NAME")
  SET_ENV_VARS+="DB_CONN_NAME=$DB_CONN_NAME"
fi

if [[ -n "${CONNECTOR_NAME:-}" ]]; then
  RUN_ARGS+=(--vpc-connector "$CONNECTOR_NAME" --vpc-egress=private-ranges-only)
fi

# Provide DB_USER/DB_NAME defaults so start script can construct DATABASE_URL when not supplied
if [[ -n "$SET_ENV_VARS" ]]; then
  SET_ENV_VARS+="," 
fi
SET_ENV_VARS+="DB_USER=$DB_USER,DB_NAME=$DB_NAME"

# Apply all non-secret env vars in a single flag to satisfy gcloud constraints
RUN_ARGS+=(--set-env-vars "$SET_ENV_VARS")

gcloud run deploy "$SERVICE_NAME" "${RUN_ARGS[@]}"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo "✅ Cloud Run URL: ${SERVICE_URL}"

