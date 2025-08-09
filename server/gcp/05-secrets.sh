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
         GITHUB_OAUTH_CLIENT_ID GITHUB_OAUTH_CLIENT_SECRET; do
  create_or_update_secret_from_env "$s"
done

echo "✅ Secrets provisioned"

