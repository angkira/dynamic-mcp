#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

REGION="${REGION:-us-central1}"

echo "🔐 Granting IAM roles to Cloud Build and Cloud Run runtime service accounts..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
APP_SA_NAME="${APP_SA_NAME:-chat-app-sa}"
APP_SA_EMAIL="${APP_SA_EMAIL:-$APP_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com}"

# Ensure dedicated runtime service account exists
if ! gcloud iam service-accounts describe "$APP_SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$APP_SA_NAME" --display-name="Chat App Service Account" >/dev/null
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" --role="roles/run.admin" >/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" --role="roles/secretmanager.secretAccessor" >/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CB_SA}" --role="roles/artifactregistry.writer" >/dev/null || true

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor" >/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/cloudsql.client" >/dev/null || true

# Grant least-privilege roles to the dedicated app service account
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${APP_SA_EMAIL}" --role="roles/secretmanager.secretAccessor" >/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${APP_SA_EMAIL}" --role="roles/cloudsql.client" >/dev/null || true
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${APP_SA_EMAIL}" --role="roles/redis.client" >/dev/null || true

echo "🪪 Dedicated app service account: ${APP_SA_EMAIL}"

echo "✅ IAM configured"

