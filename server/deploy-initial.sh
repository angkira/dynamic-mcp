#!/usr/bin/env bash

set -euo pipefail

# Resolve repo root regardless of where this script is called from
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Helpers
port_ready() {
  local host="$1"; local port="$2"; local retries="${3:-30}"; local wait="${4:-1}"
  for _ in $(seq 1 "$retries"); do
    (echo > "/dev/tcp/${host}/${port}") >/dev/null 2>&1 && return 0 || true
    sleep "$wait"
  done
  return 1
}

apply_sql_via_proxy() {
  local schema_path="$REPO_ROOT/docker/db/schema.sql"
  local seed_path="$REPO_ROOT/docker/db/fill.sql"

  if ! command -v psql >/dev/null 2>&1; then
    echo "psql client not found. Please install PostgreSQL client (psql) and re-run." >&2
    return 2
  fi

  # Download Cloud SQL Auth Proxy if missing
  local PROXY_BIN="$SCRIPT_DIR/cloud-sql-proxy"
  if [[ ! -x "$PROXY_BIN" ]]; then
    echo "Downloading Cloud SQL Auth Proxy..."
    curl -sSL -o "$PROXY_BIN" https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.4/cloud-sql-proxy.linux.amd64
    chmod +x "$PROXY_BIN"
  fi

  local PROXY_PORT=6543
  echo "Starting Cloud SQL Auth Proxy on port $PROXY_PORT..."
  "$PROXY_BIN" --quiet --terminate-timeout=10s \
    --address=127.0.0.1 \
    --port=$PROXY_PORT \
    "$INSTANCE_CONNECTION_NAME" &
  local PROXY_PID=$!
  trap 'kill $PROXY_PID >/dev/null 2>&1 || true' EXIT

  if ! port_ready 127.0.0.1 "$PROXY_PORT" 60 1; then
    echo "Cloud SQL Proxy failed to start on port $PROXY_PORT" >&2
    kill $PROXY_PID >/dev/null 2>&1 || true
    return 3
  fi

  echo "Applying schema via psql..."
  PGPASSWORD="$DB_ROOT_PASS" psql -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p "$PROXY_PORT" -U postgres -d "$DB_NAME" -f "$schema_path"

  if [[ -f "$seed_path" ]]; then
    echo "Applying seed data via psql..."
    PGPASSWORD="$DB_ROOT_PASS" psql -v ON_ERROR_STOP=1 \
      -h 127.0.0.1 -p "$PROXY_PORT" -U postgres -d "$DB_NAME" -f "$seed_path"
  else
    echo "No seed file found; skipping."
  fi

  kill $PROXY_PID >/dev/null 2>&1 || true
  trap - EXIT
}
# Load .env
ENV_FILE="$SCRIPT_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE. Copy server/.env.example to server/.env and fill values." >&2
  exit 1
fi
set -o allexport
source "$ENV_FILE"
set +o allexport

# Validate required vars
require() {
  local name="$1"; local val="${!1-}"
  if [[ -z "${val}" ]]; then echo "Missing required env: $name" >&2; exit 2; fi
}

require PROJECT_ID
require REGION
require AR_REPO
require SERVICE_NAME
require INSTANCE
require DB_NAME
require DB_USER
require DB_PASS
require DB_ROOT_PASS
require CORS_ORIGIN

DATABASE_URL_DOCKER="postgresql://$DB_USER:$DB_PASS@localhost/$DB_NAME"


echo "Using project: $PROJECT_ID, region: $REGION"

# Ensure gcloud is authenticated
if ! gcloud auth list --format='value(account)' | grep -q '@'; then
  echo "You are not authenticated. Run: gcloud auth login" >&2
  exit 3
fi

gcloud config set project "$PROJECT_ID" 1>/dev/null

echo "Enabling required APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  aiplatform.googleapis.com \
  generativelanguage.googleapis.com \
  customsearch.googleapis.com \
  bigquery.googleapis.com 1>/dev/null

echo "Creating Artifact Registry repo if missing..."
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker \
    --location="$REGION" \
    --description="Dynamic MCP images"
else
  echo "Artifact Registry $AR_REPO already exists in $REGION"
fi

echo "Creating Cloud SQL instance if missing..."
if ! gcloud sql instances describe "$INSTANCE" >/dev/null 2>&1; then
  gcloud sql instances create "$INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-custom-1-3840 \
    --region="$REGION" \
    --storage-size=20 --availability-type=ZONAL
  gcloud sql users set-password postgres --instance="$INSTANCE" --password="$DB_ROOT_PASS"
  gcloud sql databases create "$DB_NAME" --instance="$INSTANCE"
  gcloud sql users create "$DB_USER" --instance="$INSTANCE" --password="$DB_PASS"
else
  echo "Cloud SQL instance $INSTANCE already exists"
fi

INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE" --format='value(connectionName)')
echo "Cloud SQL connection: $INSTANCE_CONNECTION_NAME"

echo "Creating SQL import bucket if missing..."
BUCKET="gs://$PROJECT_ID-sql-import"
if ! gsutil ls -b "$BUCKET" >/dev/null 2>&1; then
  gsutil mb -l "$REGION" "$BUCKET"
else
  echo "Bucket $BUCKET already exists"
fi
# Always enforce uniform bucket-level access for consistent IAM behavior
gsutil uniformbucketlevelaccess set on "$BUCKET" || true

echo "Uploading SQL files..."
gsutil cp "$REPO_ROOT/docker/db/schema.sql" "$BUCKET/schema.sql"
if [[ -f "$REPO_ROOT/docker/db/fill.sql" ]]; then
  gsutil cp "$REPO_ROOT/docker/db/fill.sql" "$BUCKET/fill.sql"
else
  echo "No fill.sql found, skipping seed upload"
fi

echo "Ensuring Cloud SQL service agent exists and has access to import bucket..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
# Force-create service agent for Cloud SQL (if not provisioned yet)
gcloud beta services identity create \
  --service=sqladmin.googleapis.com \
  --project="$PROJECT_ID" >/dev/null 2>&1 || true

# Cloud SQL service agent principal
SQL_SA="service-$PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com"

# Grant viewer on bucket objects to the service agent
gsutil iam ch "serviceAccount:${SQL_SA}:roles/storage.objectViewer" "$BUCKET" 1>/dev/null || true
gsutil iam ch "serviceAccount:${SQL_SA}:roles/storage.legacyBucketReader" "$BUCKET" 1>/dev/null || true
gsutil iam ch "serviceAccount:${SQL_SA}:roles/storage.legacyObjectReader" "$BUCKET" 1>/dev/null || true

# Give IAM time to propagate to avoid import 412s
sleep 5

echo "Importing SQL into Cloud SQL (GCS import)..."
set +e
gcloud -q sql import sql "$INSTANCE" "$BUCKET/schema.sql" --database="$DB_NAME"
IMPORT_SCHEMA_RC=$?
if gsutil -q stat "$BUCKET/fill.sql"; then
  gcloud -q sql import sql "$INSTANCE" "$BUCKET/fill.sql" --database="$DB_NAME"
  IMPORT_FILL_RC=$?
else
  IMPORT_FILL_RC=0
fi
set -e

if [[ "$IMPORT_SCHEMA_RC" -ne 0 || "$IMPORT_FILL_RC" -ne 0 ]]; then
  echo "GCS import failed (schema_rc=$IMPORT_SCHEMA_RC, fill_rc=$IMPORT_FILL_RC). Falling back to Cloud SQL Proxy + psql..."
  apply_sql_via_proxy || {
    echo "Fallback apply via proxy failed." >&2
    exit 10
  }
fi

echo "Creating/updating secrets..."
create_secret_if_missing() {
  local name="$1"
  if ! gcloud secrets describe "$name" >/dev/null 2>&1; then
    gcloud secrets create "$name" --replication-policy=automatic
  fi
}

add_secret_version_if_value() {
  local name="$1"; local value="$2"
  if [[ -n "$value" ]]; then
    printf "%s" "$value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  else
    echo "Skipping $name (no value in .env)"
  fi
}

create_secret_if_missing OPENAI_API_KEY
create_secret_if_missing GOOGLE_API_KEY
create_secret_if_missing JWT_SECRET
create_secret_if_missing GOOGLE_CSE_CX
create_secret_if_missing DATABASE_URL_DOCKER

add_secret_version_if_value OPENAI_API_KEY "${OPENAI_API_KEY-}"
add_secret_version_if_value GOOGLE_API_KEY "${GOOGLE_API_KEY-}"
add_secret_version_if_value JWT_SECRET "${JWT_SECRET-}"
add_secret_version_if_value GOOGLE_CSE_CX "${GOOGLE_CSE_CX-}"
add_secret_version_if_value DATABASE_URL_DOCKER "${DATABASE_URL_DOCKER-${DATABASE_URL-}}"

echo "Ensuring Cloud Run service account and IAM bindings..."
# Create a dedicated runtime service account
RUN_SA_EMAIL="${SERVICE_NAME}-sa@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$RUN_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_NAME}-sa" \
    --description="Runtime SA for Cloud Run service ${SERVICE_NAME}" \
    --display-name="${SERVICE_NAME}-sa"
fi

# Bind roles required for runtime
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA_EMAIL}" \
  --role="roles/cloudsql.client" 1>/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" 1>/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA_EMAIL}" \
  --role="roles/aiplatform.user" 1>/dev/null

# Additional recommended runtime roles
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA_EMAIL}" \
  --role="roles/logging.logWriter" 1>/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUN_SA_EMAIL}" \
  --role="roles/monitoring.metricWriter" 1>/dev/null

# Ensure Cloud Run service agent can pull from Artifact Registry
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CR_AGENT_SA="service-$PROJECT_NUMBER@serverless-robot-prod.iam.gserviceaccount.com"
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$REGION" \
  --member="serviceAccount:${CR_AGENT_SA}" \
  --role="roles/artifactregistry.reader" 1>/dev/null || true
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$REGION" \
  --member="serviceAccount:${RUN_SA_EMAIL}" \
  --role="roles/artifactregistry.reader" 1>/dev/null || true

# Ensure Cloud Build service account can push to Artifact Registry
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
  --location="$REGION" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/artifactregistry.writer" 1>/dev/null || true

echo "Creating application files bucket (regional) if missing..."
# Default bucket name if not provided in .env
APP_BUCKET_NAME="${APP_BUCKET_NAME:-$PROJECT_ID-app-files}"
APP_BUCKET_URI="gs://$APP_BUCKET_NAME"
if ! gsutil ls -b "$APP_BUCKET_URI" >/dev/null 2>&1; then
  gsutil mb -l "$REGION" "$APP_BUCKET_URI"
  # Enforce uniform bucket-level access
  gsutil uniformbucketlevelaccess set on "$APP_BUCKET_URI"
  # Optional lifecycle: delete tmp objects after 7 days
  LC_FILE="$(mktemp)"
  cat > "$LC_FILE" <<'JSON'
{
  "rule": [
    {
      "action": {"type": "Delete"},
      "condition": {"age": 7, "matchesPrefix": ["tmp/"]}
    }
  ]
}
JSON
  gsutil lifecycle set "$LC_FILE" "$APP_BUCKET_URI"
  rm -f "$LC_FILE"
else
  echo "Bucket $APP_BUCKET_URI already exists"
fi

# Grant the Cloud Run service account access to the bucket
gsutil iam ch "serviceAccount:${RUN_SA_EMAIL}:roles/storage.objectAdmin" "$APP_BUCKET_URI" 1>/dev/null || true

echo "Setting up BigQuery dataset for logs analytics (optional best practice)..."
# Configure BQ dataset name and location from REGION heuristically
BQ_DATASET_NAME="${BQ_DATASET_NAME:-logs_app}"
if [[ -z "${BQ_LOCATION-}" ]]; then
  if [[ "$REGION" == europe-* ]]; then BQ_LOCATION="EU"; else BQ_LOCATION="US"; fi
fi

# Create dataset if missing
if ! bq --project_id="$PROJECT_ID" --location="$BQ_LOCATION" ls -d | grep -q "\b$BQ_DATASET_NAME\b"; then
  bq --project_id="$PROJECT_ID" --location="$BQ_LOCATION" mk -d "$BQ_DATASET_NAME"
else
  echo "BigQuery dataset $BQ_DATASET_NAME already exists in $BQ_LOCATION"
fi

# Create a log sink for Cloud Run service logs into BigQuery
SINK_NAME="run-${SERVICE_NAME}-logs-bq"
if ! gcloud logging sinks describe "$SINK_NAME" >/dev/null 2>&1; then
  gcloud logging sinks create "$SINK_NAME" \
    "bigquery.googleapis.com/projects/$PROJECT_ID/datasets/$BQ_DATASET_NAME" \
    --log-filter="resource.type=cloud_run_revision AND resource.labels.service_name=\"$SERVICE_NAME\""
  WRITER_IDENTITY=$(gcloud logging sinks describe "$SINK_NAME" --format='value(writerIdentity)')
  # Grant sink SA permission to write into dataset
  # Use bq CLI to grant dataset IAM to the log sink writer
  bq add-iam-policy-binding "${PROJECT_ID}:${BQ_DATASET_NAME}" \
    --member="$WRITER_IDENTITY" \
    --role="roles/bigquery.dataEditor"
else
  echo "Log sink $SINK_NAME already exists"
fi

echo "Building and pushing server image via Cloud Build..."
TAG=$(date -u +%Y%m%d-%H%M%S)
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/$SERVICE_NAME:$TAG"
echo "IMAGE=$IMAGE"

gcloud builds submit \
  --config="$SCRIPT_DIR/cloudbuild-server.yaml" \
  --substitutions=_IMAGE="$IMAGE" \
  "$REPO_ROOT"

echo "Building secret bindings for Cloud Run..."
SECRET_BINDS=()
have_secret() { gcloud secrets versions list "$1" --format='value(name)' --filter='state=enabled' --limit=1 >/dev/null 2>&1; }
if have_secret OPENAI_API_KEY; then SECRET_BINDS+=("OPENAI_API_KEY=OPENAI_API_KEY:latest"); fi
if have_secret GOOGLE_API_KEY; then SECRET_BINDS+=("GOOGLE_API_KEY=GOOGLE_API_KEY:latest"); fi
if have_secret JWT_SECRET; then SECRET_BINDS+=("JWT_SECRET=JWT_SECRET:latest"); fi
if have_secret GOOGLE_CSE_CX; then SECRET_BINDS+=("GOOGLE_CSE_CX=GOOGLE_CSE_CX:latest"); fi
if have_secret DATABASE_URL_DOCKER; then SECRET_BINDS+=("DATABASE_URL_DOCKER=DATABASE_URL_DOCKER:latest"); fi

SET_SECRETS_FLAG=()
if (( ${#SECRET_BINDS[@]} > 0 )); then
  SECRETS_SPEC=$(IFS=, ; echo "${SECRET_BINDS[*]}")
  SET_SECRETS_FLAG=(--set-secrets "$SECRETS_SPEC")
fi

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "$RUN_SA_EMAIL" \
  --port 3000 \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars NODE_ENV=production \
  --set-env-vars DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost/$DB_NAME?host=/cloudsql/$INSTANCE_CONNECTION_NAME&connection_limit=5" \
  --set-env-vars CORS_ORIGIN="$CORS_ORIGIN" \
  --set-env-vars GOOGLE_PROJECT_ID="$PROJECT_ID" \
  --set-env-vars GOOGLE_VERTEX_REGION="${GOOGLE_VERTEX_REGION:-$REGION}" \
  --set-env-vars USE_VERTEX_AI="${USE_VERTEX_AI:-false}" \
  --set-env-vars APP_BUCKET_NAME="$APP_BUCKET_NAME" \
  "${SET_SECRETS_FLAG[@]}" \
  --memory 1Gi --cpu 1 --max-instances 10 --min-instances 0 --timeout 3600

echo "Done. Cloud Run URL:"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)'


