#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud jq
gcloud_configure_project

REGION="${REGION:-us-central1}"
# Default to a stable, project-scoped bucket so org policies can be satisfied explicitly
STAGING_BUCKET="${STAGING_BUCKET:-gs://${PROJECT_ID}-build-staging}"
BUCKET_LOCATION="${BUCKET_LOCATION:-US}"

# Normalize bucket value if user passed without gs://
if [[ "$STAGING_BUCKET" != gs://* ]]; then
  STAGING_BUCKET="gs://${STAGING_BUCKET}"
fi

BUCKET_NAME="${STAGING_BUCKET#gs://}"

echo "🪣 Ensuring staging bucket ${STAGING_BUCKET} in ${BUCKET_LOCATION}..."
if ! gcloud storage buckets describe "$STAGING_BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "$STAGING_BUCKET" \
    --project "$PROJECT_ID" \
    --location "$BUCKET_LOCATION"
  # Add helpful labels for traceability
  gcloud storage buckets update "$STAGING_BUCKET" \
    --update-labels "purpose=cloud-build-staging,owner=github-actions" >/dev/null 2>&1 || true
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
DEPLOY_SA="${DEPLOY_SA:-${SERVICE_ACCOUNT_EMAIL:-deploy-sa@${PROJECT_ID}.iam.gserviceaccount.com}}"
CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "🔐 Granting bucket IAM bindings (roles/storage.objectAdmin) to deploy SA and Cloud Build SA..."
gcloud storage buckets add-iam-policy-binding "$STAGING_BUCKET" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOY_SA}" \
  --role="roles/storage.objectAdmin" >/dev/null 2>&1 || true

gcloud storage buckets add-iam-policy-binding "$STAGING_BUCKET" \
  --project "$PROJECT_ID" \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/storage.objectAdmin" >/dev/null 2>&1 || true

echo "✅ Staging bucket ready: ${STAGING_BUCKET}"


