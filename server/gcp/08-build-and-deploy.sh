#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

REGION="${REGION:-us-central1}"
AR_REPO="${AR_REPO:-dynamic-mcp}"
SERVICE_NAME="${SERVICE_NAME:-dynamic-mcp-server}"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_EMAIL:-}"

echo "🏗️  Building container image with Cloud Build..."
TAG=$(date -u +%Y%m%d-%H%M%S)
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$SERVICE_NAME:$TAG"

# Prefer a dedicated, pre-created staging bucket to avoid default bucket/org policy issues
# IMPORTANT: we do not create the bucket in CI. We test object-level access instead of buckets.get
STAGING_BUCKET="${STAGING_BUCKET:-gs://${PROJECT_ID}-build-staging}"
TMP_OBJ="${STAGING_BUCKET}/_ci_perm_check_${TAG}.txt"
if ! printf "ok" | gcloud storage cp - "$TMP_OBJ" >/dev/null 2>&1; then
  echo "❌ Cannot write to $STAGING_BUCKET. Ensure the bucket exists and grant objectAdmin to the deploy SA." >&2
  echo "   Bucket suggestion: gs://${PROJECT_ID}-build-staging (pre-create and set repo secret STAGING_BUCKET)." >&2
  exit 1
fi
# best-effort cleanup
gcloud storage rm "$TMP_OBJ" >/dev/null 2>&1 || true

gcloud builds submit --quiet \
  --gcs-source-staging-dir="${STAGING_BUCKET}/sources" \
  --config="$SCRIPT_DIR/../cloudbuild-server.yaml" \
  --substitutions=_IMAGE="$IMAGE" "$REPO_ROOT"

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

SECRET_BINDINGS=""
maybe_add_secret() {
  local key="$1"
  if gcloud secrets describe "$key" >/dev/null 2>&1; then
    if [[ -n "$SECRET_BINDINGS" ]]; then SECRET_BINDINGS+=","; fi
    SECRET_BINDINGS+="${key}=${key}:latest"
  fi
}

for key in JWT_SIGNING_KEY GEMINI_API_KEY CHATGPT_API_KEY MCP_API_KEY APP_DB_PASSWORD \
           GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET GOOGLE_OAUTH_REDIRECT_URI \
           GH_OAUTH_CLIENT_ID GH_OAUTH_CLIENT_SECRET \
           GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET; do
  maybe_add_secret "$key"
done

# If DATABASE_URL secret exists, bind it; else compose from DB envs + APP_DB_PASSWORD
if gcloud secrets describe DATABASE_URL >/dev/null 2>&1; then
  maybe_add_secret DATABASE_URL
else
  DB_PASSWORD=""
  if gcloud secrets describe APP_DB_PASSWORD >/dev/null 2>&1; then
    DB_PASSWORD=$(gcloud secrets versions access latest --secret=APP_DB_PASSWORD 2>/dev/null || true)
  fi
  if [[ -n "$DB_PASSWORD" ]]; then
    DB_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
    if [[ -n "$DB_CONN_NAME" ]]; then
      DB_URL+="?host=/cloudsql/${DB_CONN_NAME}"
    fi
    gcloud secrets create DATABASE_URL --replication-policy=automatic >/dev/null 2>&1 || true
    printf "%s" "$DB_URL" | gcloud secrets versions add DATABASE_URL --data-file=- >/dev/null
    maybe_add_secret DATABASE_URL
  fi
fi

RUN_ARGS=(
  --image "$IMAGE"
  --region "$REGION"
  --port 8080
  --min-instances=1
  --timeout=3600
  --concurrency=50
  --cpu=1
  --memory=2Gi
  --cpu-boost
)

if [[ -n "$SECRET_BINDINGS" ]]; then
  RUN_ARGS+=(--set-secrets "$SECRET_BINDINGS")
fi

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
  RUN_ARGS+=(--vpc-connector "$CONNECTOR_NAME" --vpc-egress=all-traffic)
fi

# Provide DB defaults; do NOT set PORT (reserved by Cloud Run). Use --port flag instead.
if [[ -n "$SET_ENV_VARS" ]]; then
  SET_ENV_VARS+="," 
fi
SET_ENV_VARS+="DB_USER=$DB_USER,DB_NAME=$DB_NAME,NODE_ENV=production,NODE_OPTIONS=--max-old-space-size=1536"

# Optionally propagate client origin settings for CORS and OAuth redirects
if [[ -n "${CLIENT_URL:-}" ]]; then
  SET_ENV_VARS+=",CLIENT_URL=$CLIENT_URL"
fi
if [[ -n "${CORS_ORIGINS:-}" ]]; then
  SET_ENV_VARS+=",CORS_ORIGINS=$CORS_ORIGINS"
fi
if [[ -n "${CORS_ORIGIN:-}" ]]; then
  SET_ENV_VARS+=",CORS_ORIGIN=$CORS_ORIGIN"
fi

# Optional: attach dedicated service account if provided
if [[ -n "$SERVICE_ACCOUNT_EMAIL" ]]; then
  RUN_ARGS+=(--service-account "$SERVICE_ACCOUNT_EMAIL")
fi

# Optional: enable session affinity to help WebSocket reconnect stickiness (best-effort)
if [[ "${SESSION_AFFINITY:-true}" == "true" ]]; then
  RUN_ARGS+=(--session-affinity)
fi

# Apply all non-secret env vars in a single flag to satisfy gcloud constraints
RUN_ARGS+=(--set-env-vars "$SET_ENV_VARS")

gcloud run deploy "$SERVICE_NAME" "${RUN_ARGS[@]}"

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo "✅ Cloud Run URL: ${SERVICE_URL}"

