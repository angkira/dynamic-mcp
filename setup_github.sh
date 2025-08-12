#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# GitHub Actions → GCP Cloud Run WIF bootstrapper (idempotent + recreate)
# - Cleans up any existing provider with the same id
# - Creates/ensures pool + provider (proper attribute mapping + condition)
# - Creates/ensures deploy service account
# - Re-binds principalSet for your GitHub repo
# - Grants minimal roles for Cloud Run deploy
# - Optionally writes GitHub repo secrets via gh CLI
###############################################################################

usage() {
  cat <<EOF
Usage: $(basename "$0") [flags]

Flags:
  --env-file PATH                Optional. Load env from file (defaults server/server.env or ./server.env)
  --project-id, -p ID            Required. GCP project id
  --repo, -r OWNER/REPO          Optional. GitHub repo (owner/name). If omitted, inferred from git remote
  --pool-id ID                   Optional. Workload Identity Pool id (default: github-pool)
  --provider-id ID               Optional. Provider id 4-32 chars [a-z0-9-] (default: github-provider)
  --sa-name NAME                 Optional. Service account name (default: deploy-sa)
  --no-condition                 Optional. Do NOT set provider attribute-condition (still safe via SA binding)
  --force-recreate              Optional. Force delete + recreate provider instead of in-place update
  --set-github-secrets           Optional. If gh CLI is installed, set Actions secrets in the repo
  --fresh                        Optional. Create a brand-new pool/provider/SA with a unique suffix (no deletes)
  --suffix STR                   Optional. Suffix to append in --fresh mode (default: yyyymmddHHMMSS)
  --new-pool-id ID               Optional. Explicit pool id to use in --fresh mode
  --new-provider-id ID           Optional. Explicit provider id to use in --fresh mode
  --new-sa-name NAME             Optional. Explicit service account name to use in --fresh mode
  --help                         Show this help

Environment variables (can also be set in env-file):
  PROJECT_ID, REPO, POOL_ID, PROVIDER_ID, DEPLOY_SA_NAME

Outputs (echo):
  GCP_WIF_PROVIDER  provider full resource name (use in workload_identity_provider)
  GCP_DEPLOY_SA     service account email (use in service_account)

Examples:
  $(basename "$0") -p my-proj --repo my-org/my-repo --provider-id gha-oidc --sa-name run-deployer
  $(basename "$0") --env-file server/server.env --set-github-secrets
EOF
}

# Default config
POOL_ID_DEFAULT="github-pool"
PROVIDER_ID_DEFAULT="github-provider"
DEPLOY_SA_NAME_DEFAULT="deploy-sa"

# Load env from server/server.env if present, else from ./server.env (unless --env-file is passed)
ENV_FILE="${ENV_FILE:-}"
if [[ -z "${ENV_FILE}" ]]; then
  if [[ -f "server/server.env" ]]; then
    ENV_FILE="server/server.env"
  elif [[ -f "server.env" ]]; then
    ENV_FILE="server.env"
  fi
fi
if [[ -n "${ENV_FILE}" ]] && [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a; source "${ENV_FILE}"; set +a
fi

# Inputs (env defaults)
PROJECT_ID="${PROJECT_ID:-}"
POOL_ID="${POOL_ID:-${POOL_ID_DEFAULT}}"
PROVIDER_ID="${PROVIDER_ID:-${PROVIDER_ID_DEFAULT}}"
DEPLOY_SA_NAME="${DEPLOY_SA_NAME:-${DEPLOY_SA_NAME_DEFAULT}}"
REPO="${REPO:-}"
SET_GH_SECRETS=false
SET_CONDITION=true
FORCE_RECREATE=false
FRESH=false
SUFFIX=""
NEW_POOL_ID=""
NEW_PROVIDER_ID=""
NEW_SA_NAME=""

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) ENV_FILE="$2"; shift 2;;
    --project-id|-p) PROJECT_ID="$2"; shift 2;;
    --repo|-r) REPO="$2"; shift 2;;
    --pool-id) POOL_ID="$2"; shift 2;;
    --provider-id) PROVIDER_ID="$2"; shift 2;;
    --sa-name) DEPLOY_SA_NAME="$2"; shift 2;;
    --set-github-secrets) SET_GH_SECRETS=true; shift;;
    --no-condition) SET_CONDITION=false; shift;;
    --force-recreate) FORCE_RECREATE=true; shift;;
    --fresh) FRESH=true; shift;;
    --suffix) SUFFIX="$2"; shift 2;;
    --new-pool-id) NEW_POOL_ID="$2"; shift 2;;
    --new-provider-id) NEW_PROVIDER_ID="$2"; shift 2;;
    --new-sa-name) NEW_SA_NAME="$2"; shift 2;;
    --help|-h) usage; exit 0;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2;;
  esac
done

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is required (set in env or pass --project-id)" >&2
  exit 2
fi

# Derive REPO from git remote if not provided (expects GitHub origin)
if [[ -z "${REPO}" ]]; then
  origin_url=$(git config --get remote.origin.url || true)
  if [[ "$origin_url" =~ github.com[:/]{1,2}([^/]+)/([^/.]+) ]]; then
    REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  else
    echo "Unable to infer REPO from git remote. Pass --repo owner/name." >&2
    exit 2
  fi
fi

sanitize_id() {
  local raw="$1"; local maxlen="$2"
  local s
  s="${raw,,}"
  s="${s//[^a-z0-9-]/-}"
  if (( ${#s} > maxlen )); then s="${s:0:maxlen}"; fi
  echo "$s"
}

if [[ "${FRESH}" == "true" ]]; then
  # Derive unique suffix and compute effective ids
  [[ -z "${SUFFIX}" ]] && SUFFIX="$(date -u +%Y%m%d%H%M%S)"
  EFFECTIVE_POOL_ID="${NEW_POOL_ID:-${POOL_ID}-${SUFFIX}}"
  EFFECTIVE_PROVIDER_ID="${NEW_PROVIDER_ID:-${PROVIDER_ID}-${SUFFIX}}"
  EFFECTIVE_SA_NAME="${NEW_SA_NAME:-${DEPLOY_SA_NAME}-${SUFFIX}}"
  # Sanitize and enforce limits (provider max 32, SA id max 30)
  POOL_ID="$(sanitize_id "${EFFECTIVE_POOL_ID}" 32)"
  PROVIDER_ID="$(sanitize_id "${EFFECTIVE_PROVIDER_ID}" 32)"
  DEPLOY_SA_NAME="$(sanitize_id "${EFFECTIVE_SA_NAME}" 30)"
  FORCE_RECREATE=false
fi

# Validate provider id format (lowercase, digits, dashes, 4-32)
if [[ ! "$PROVIDER_ID" =~ ^[a-z0-9-]{4,32}$ ]]; then
  echo "Invalid provider id: $PROVIDER_ID (must be 4-32 chars: lowercase, digits, dashes)" >&2
  exit 2
fi

echo "Config: PROJECT_ID=${PROJECT_ID} REPO=${REPO} POOL_ID=${POOL_ID} PROVIDER_ID=${PROVIDER_ID} SA_NAME=${DEPLOY_SA_NAME}"

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Missing command: $1" >&2; exit 2; }
}

require_cmd gcloud

# Ensure gcloud authenticated and project set
gcloud config set project "${PROJECT_ID}" 1>/dev/null
PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
if [[ -z "${PROJECT_NUMBER}" ]]; then
  echo "Failed to resolve PROJECT_NUMBER for ${PROJECT_ID}" >&2
  exit 2
fi

# Enable core APIs (idempotent)
enable_api() { gcloud services enable "$1" --project="${PROJECT_ID}" --quiet >/dev/null; }
enable_api iam.googleapis.com
enable_api iamcredentials.googleapis.com
enable_api run.googleapis.com
enable_api artifactregistry.googleapis.com
enable_api cloudbuild.googleapis.com
enable_api secretmanager.googleapis.com

# Helpers for provider lifecycle
wait_for_provider_absence() {
  local max_attempts=${WIF_DELETE_MAX_ATTEMPTS:-60}
  local sleep_secs=${WIF_DELETE_SLEEP_SECS:-5}
  local attempt=1
  while (( attempt <= max_attempts )); do
    # "describe" returns non-zero when absent
    if ! gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
      --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep "${sleep_secs}"
    ((attempt++))
  done
  echo "Timed out waiting for provider ${PROVIDER_ID} to be fully deleted" >&2
  return 1
}

# Runs create-oidc and interprets ALREADY_EXISTS for retry
try_create_provider() {
  set +e
  local out
  out=$(gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" \
    --display-name="GitHub OIDC" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="${ATTRIBUTE_MAPPING}" \
    ${CREATE_CONDITION_FLAG:-} 2>&1 >/dev/null)
  local status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    return 0
  fi
  if echo "$out" | grep -q "ALREADY_EXISTS"; then
    return 2
  fi
  echo "$out" >&2
  return 1
}

# Runs update-oidc and interprets NOT_FOUND for fallback
try_update_provider() {
  set +e
  local out
  out=$(gcloud iam workload-identity-pools providers update-oidc "${PROVIDER_ID}" \
    --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" \
    --display-name="GitHub OIDC" \
    --attribute-mapping="${ATTRIBUTE_MAPPING}" \
    ${CREATE_CONDITION_FLAG:-} 2>&1 >/dev/null)
  local status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    return 0
  fi
  if echo "$out" | grep -q "NOT_FOUND"; then
    return 3
  fi
  echo "$out" >&2
  return 1
}

# Ensure pool exists
if ! gcloud iam workload-identity-pools describe "${POOL_ID}" --project="${PROJECT_ID}" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${POOL_ID}" \
    --project="${PROJECT_ID}" --location=global \
    --display-name="GitHub Actions" >/dev/null
fi

# No pre-checks: handle both create/update paths deterministically

# Desired mapping and optional condition
ATTRIBUTE_MAPPING="google.subject=assertion.sub,attribute.repository=assertion.repository"
if [[ "${SET_CONDITION}" == "true" ]]; then
  CREATE_CONDITION_FLAG="--attribute-condition=attribute.repository=='${REPO}'"
else
  CREATE_CONDITION_FLAG=""
fi

if [[ "${FORCE_RECREATE}" == "true" ]]; then
  if provider_exists; then
    gcloud iam workload-identity-pools providers delete "${PROVIDER_ID}" \
      --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" --quiet >/dev/null 2>&1 || true
    if ! wait_for_provider_absence; then
      echo "Delete did not fully propagate; falling back to in-place update approach." >&2
    fi
  fi
  # Create with retries to handle eventual consistency after delete
  create_attempts=20
  attempt=1
  while (( attempt <= create_attempts )); do
    if try_create_provider; then
      break
    fi
    sleep $(( attempt < 5 ? 2 : (attempt < 12 ? 5 : 10) ))
    ((attempt++))
  done
  if (( attempt > create_attempts )); then
    echo "Failed to create provider ${PROVIDER_ID}: still exists after retries" >&2
    exit 1
  fi
else
  # Idempotent: try create first, then update if it already exists; loop for races
  attempts=20
  attempt=1
  while (( attempt <= attempts )); do
    rc=0
    if try_create_provider; then
      break
    else
      rc=$?
    fi
    if [[ $rc -eq 2 ]]; then
      # Exists → update in place
      if try_update_provider; then
        break
      else
        rc=$?
        if [[ $rc -eq 3 ]]; then
          # NOT_FOUND after ALREADY_EXISTS: race; retry
          sleep $(( attempt < 5 ? 2 : 5 ))
        else
          exit 1
        fi
      fi
    else
      # unexpected create error (already printed)
      exit 1
    fi
    ((attempt++))
  done
  if (( attempt > attempts )); then
    echo "Failed to converge provider ${PROVIDER_ID} via create/update after retries" >&2
    exit 1
  fi
fi

# Provider resource names (compute deterministically; best-effort describe with retry, non-fatal)
PROVIDER_RESOURCE_FULL="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
{
  set +e
  for i in {1..30}; do
    PROVIDER_RESOURCE_API="$(gcloud iam workload-identity-pools providers describe "${PROVIDER_ID}" \
      --project="${PROJECT_ID}" --location=global --workload-identity-pool="${POOL_ID}" \
      --format='value(name)' 2>/dev/null)"
    if [[ -n "${PROVIDER_RESOURCE_API}" ]]; then break; fi
    sleep 2
  done
  set -e
} || true

# Create SA if missing
DEPLOY_SA="${DEPLOY_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "${DEPLOY_SA}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${DEPLOY_SA_NAME}" \
    --project="${PROJECT_ID}" --display-name="GitHub Deploy SA" >/dev/null
fi

# Rebind principalSet for this repo
PRINCIPAL_SET_MEMBER="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${REPO}"
gcloud iam service-accounts remove-iam-policy-binding "${DEPLOY_SA}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${PRINCIPAL_SET_MEMBER}" >/dev/null 2>&1 || true
gcloud iam service-accounts add-iam-policy-binding "${DEPLOY_SA}" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --member="${PRINCIPAL_SET_MEMBER}" >/dev/null

# Minimal roles to deploy Cloud Run (idempotent)
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${DEPLOY_SA}" --role="roles/run.admin" --quiet >/dev/null || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${DEPLOY_SA}" --role="roles/iam.serviceAccountUser" --quiet >/dev/null || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${DEPLOY_SA}" --role="roles/artifactregistry.writer" --quiet >/dev/null || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${DEPLOY_SA}" --role="roles/cloudbuild.builds.editor" --quiet >/dev/null || true
gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${DEPLOY_SA}" --role="roles/secretmanager.admin" --quiet >/dev/null || true

echo
echo "Created/updated Workload Identity Federation for GitHub Actions."
echo "Use these in .github/workflows:"
echo "  GCP_WIF_PROVIDER=${PROVIDER_RESOURCE_FULL}"
echo "  GCP_DEPLOY_SA=${DEPLOY_SA}"

# Optionally set GitHub repo secrets using gh CLI
if [[ "${SET_GH_SECRETS}" == "true" ]]; then
  if command -v gh >/dev/null 2>&1; then
    echo "Setting GitHub Actions secrets in ${REPO} via gh..."
    gh secret set GCP_WIF_PROVIDER --repo "${REPO}" --app actions --body "${PROVIDER_RESOURCE_FULL}" >/dev/null
    gh secret set GCP_DEPLOY_SA --repo "${REPO}" --app actions --body "${DEPLOY_SA}" >/dev/null
    # Optional convenience if present in environment
    [[ -n "${PROJECT_ID}" ]] && gh secret set GCP_PROJECT_ID --repo "${REPO}" --app actions --body "${PROJECT_ID}" >/dev/null || true
    [[ -n "${REGION:-}" ]] && gh secret set GCP_REGION --repo "${REPO}" --app actions --body "${REGION}" >/dev/null || true
    [[ -n "${AR_REPO:-}" ]] && gh secret set GCP_ARTIFACT_REPO --repo "${REPO}" --app actions --body "${AR_REPO}" >/dev/null || true
    [[ -n "${SERVICE_NAME:-}" ]] && gh secret set GCP_RUN_SERVICE --repo "${REPO}" --app actions --body "${SERVICE_NAME}" >/dev/null || true
    echo "GitHub secrets set."
  else
    echo "gh CLI not found; skipping secret creation."
  fi
fi

echo
echo "Done."