#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud
gcloud_configure_project

echo "🔏 Ensuring application secrets..."

# Create or update from env if provided, else ensure placeholder
for s in JWT_SIGNING_KEY GEMINI_API_KEY CHATGPT_API_KEY MCP_API_KEY \
         GOOGLE_OAUTH_CLIENT_ID GOOGLE_OAUTH_CLIENT_SECRET GOOGLE_OAUTH_REDIRECT_URI \
         GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET APP_DB_PASSWORD DATABASE_URL; do
  create_or_update_secret_from_env "$s"
done

# If DATABASE_URL not provided, compose it from DB envs + APP_DB_PASSWORD (if present)
if ! gcloud secrets describe DATABASE_URL >/dev/null 2>&1; then
  DB_PASSWORD="${APP_DB_PASSWORD:-${DB_PASS:-}}"
  DB_USER_VAL="${DB_USER:-appuser}"
  DB_NAME_VAL="${DB_NAME:-appdb}"
  if [[ -n "$DB_PASSWORD" ]]; then
    DB_URL="postgresql://${DB_USER_VAL}:${DB_PASSWORD}@localhost:5432/${DB_NAME_VAL}"
    gcloud secrets create DATABASE_URL --replication-policy=automatic >/dev/null 2>&1 || true
    printf "%s" "$DB_URL" | gcloud secrets versions add DATABASE_URL --data-file=- >/dev/null
    echo "🔐 Derived DATABASE_URL secret from DB_USER/APP_DB_PASSWORD/DB_NAME"
  fi
fi

echo "✅ Secrets provisioned"

