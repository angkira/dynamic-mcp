#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud openssl jq
gcloud_configure_project

REGION="${REGION:-us-central1}"
VPC_NAME="${VPC_NAME:-chat-vpc}"
DB_INSTANCE_NAME="${DB_INSTANCE_NAME:-chat-pg}"
DB_VERSION="${DB_VERSION:-POSTGRES_17}"
DB_TIER="${DB_TIER:-db-custom-1-3840}"
DB_NAME="${DB_NAME:-appdb}"
DB_USER="${DB_USER:-appuser}"

echo "🗄️  Creating Cloud SQL instance ${DB_INSTANCE_NAME} (private IP only) if missing..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
NETWORK_URI="projects/${PROJECT_ID}/global/networks/${VPC_NAME}"

if ! gcloud sql instances describe "$DB_INSTANCE_NAME" >/dev/null 2>&1; then
  gcloud sql instances create "$DB_INSTANCE_NAME" \
    --database-version "$DB_VERSION" \
    --cpu 1 --memory 3840MiB \
    --region "$REGION" \
    --network "$NETWORK_URI" \
    --no-assign-ip \
    --availability-type=ZONAL \
    --storage-auto-increase
fi

DB_CONN_NAME=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format='value(connectionName)')
DB_PRIVATE_IP=$(gcloud sql instances describe "$DB_INSTANCE_NAME" --format='value(ipAddresses[0].ipAddress)' 2>/dev/null || true)
echo "🔐 Cloud SQL connection: ${DB_CONN_NAME} (private IP: ${DB_PRIVATE_IP:-n/a})"

echo "👤 Ensuring database, users, and passwords..."
# Root password secret
if ! gcloud secrets describe POSTGRES_PASSWORD >/dev/null 2>&1; then
  gcloud secrets create POSTGRES_PASSWORD --replication-policy=automatic >/dev/null
fi
POSTGRES_VER=$(gcloud secrets versions list POSTGRES_PASSWORD --format='value(name)' --limit=1 --filter='state=ENABLED' 2>/dev/null || true)
if [[ -z "$POSTGRES_VER" ]]; then
  DB_ROOT_PASS=$(openssl rand -base64 32 | tr -d '\n')
  printf "%s" "$DB_ROOT_PASS" | gcloud secrets versions add POSTGRES_PASSWORD --data-file=- >/dev/null
else
  DB_ROOT_PASS=$(gcloud secrets versions access latest --secret=POSTGRES_PASSWORD)
fi

gcloud sql users set-password postgres --instance="$DB_INSTANCE_NAME" --password="$DB_ROOT_PASS" >/dev/null

# App DB and user
gcloud sql databases describe "$DB_NAME" --instance="$DB_INSTANCE_NAME" >/dev/null 2>&1 || \
  gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE_NAME" >/dev/null

APP_PASS_SECRET="APP_DB_PASSWORD"
if ! gcloud secrets describe "$APP_PASS_SECRET" >/dev/null 2>&1; then
  gcloud secrets create "$APP_PASS_SECRET" --replication-policy=automatic >/dev/null
fi
APP_PASS_VER=$(gcloud secrets versions list "$APP_PASS_SECRET" --format='value(name)' --limit=1 --filter='state=ENABLED' 2>/dev/null || true)
if [[ -z "$APP_PASS_VER" ]]; then
  APP_DB_PASS=$(openssl rand -base64 24 | tr -d '\n')
  printf "%s" "$APP_DB_PASS" | gcloud secrets versions add "$APP_PASS_SECRET" --data-file=- >/dev/null
else
  APP_DB_PASS=$(gcloud secrets versions access latest --secret="$APP_PASS_SECRET")
fi

gcloud sql users list --instance="$DB_INSTANCE_NAME" --format='value(name)' | grep -q "^${DB_USER}$" || \
  gcloud sql users create "$DB_USER" --instance="$DB_INSTANCE_NAME" --password="$APP_DB_PASS" >/dev/null

echo "DB_CONN_NAME=$DB_CONN_NAME"
export DB_CONN_NAME
export_vars_file DB_CONN_NAME

echo "✅ Cloud SQL configured"

