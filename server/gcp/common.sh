#!/usr/bin/env bash

set -euo pipefail

# Resolve repo directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SERVER_DIR/.." && pwd)"

# Load environment file and also import GitHub Actions env if present
# Priority: ENV_FILE env var -> repo root server.env -> server/.env -> GitHub Actions env (for secrets available as env)
ENV_FILE_DEFAULT="${REPO_ROOT}/server.env"
ALT_ENV_FILE="${SERVER_DIR}/.env"
ENV_FILE="${ENV_FILE:-$ENV_FILE_DEFAULT}"

if [[ -f "$ENV_FILE" ]]; then
  echo "📄 Loading environment from $ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
elif [[ -f "$ENV_FILE_DEFAULT" ]]; then
  echo "📄 Loading environment from $ENV_FILE_DEFAULT"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE_DEFAULT"
  set +o allexport
elif [[ -f "$ALT_ENV_FILE" ]]; then
  echo "📄 Loading environment from $ALT_ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ALT_ENV_FILE"
  set +o allexport
else
  echo "ℹ️ No env file found. You can create ${REPO_ROOT}/server.env or set ENV_FILE to a custom path."
fi

# In GitHub Actions, required inputs often come via env. Nothing to do here except ensure they are exported already.
:

ensure_tools() {
  local missing=()
  for bin in "$@"; do
    if ! command -v "$bin" >/dev/null 2>&1; then
      missing+=("$bin")
    fi
  done
  if ((${#missing[@]} > 0)); then
    echo "❌ Missing required tools: ${missing[*]}" >&2
    exit 1
  fi
}

gcloud_configure_project() {
  if [[ -z "${PROJECT_ID:-}" ]]; then
    echo "❌ PROJECT_ID is not set in env" >&2
    exit 1
  fi
  echo "🔧 Setting gcloud project: $PROJECT_ID"
  gcloud config set project "$PROJECT_ID" >/dev/null
}

create_placeholder_secret_if_missing() {
  local name="$1"
  gcloud secrets describe "$name" >/dev/null 2>&1 || gcloud secrets create "$name" --replication-policy=automatic >/dev/null
  local latest_version
  latest_version=$(gcloud secrets versions list "$name" --format='value(name)' --limit=1 --filter='state=ENABLED' 2>/dev/null || true)
  if [[ -z "$latest_version" ]]; then
    printf "%s" "PLEASE_UPDATE_ME" | gcloud secrets versions add "$name" --data-file=- >/dev/null
  fi
}

create_or_update_secret_from_env() {
  # If env var exists, add new version with its value; otherwise ensure placeholder secret exists
  local name="$1"
  local env_value="${!name-}"
  if [[ -n "$env_value" ]]; then
    gcloud secrets describe "$name" >/dev/null 2>&1 || gcloud secrets create "$name" --replication-policy=automatic >/dev/null
    printf "%s" "$env_value" | gcloud secrets versions add "$name" --data-file=- >/dev/null
    echo "🔐 Updated secret $name from env"
  else
    create_placeholder_secret_if_missing "$name"
    echo "🔐 Ensured placeholder secret $name (no env value present)"
  fi
}

export_vars_file() {
  # Persist variables across scripts if needed
  local outfile="$SCRIPT_DIR/.out.env"
  shift || true
  {
    for var in "$@"; do
      if [[ -n "${!var-}" ]]; then
        echo "export ${var}=\"${!var}\""
      fi
    done
  } >>"$outfile"
}


