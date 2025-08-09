#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

ensure_tools gcloud
gcloud_configure_project

REGION="${REGION:-us-central1}"
LB_IP_NAME="${LB_IP_NAME:-chat-static-ip}"
NEG_NAME="${NEG_NAME:-chat-cr-neg}"
BACKEND_NAME="${BACKEND_NAME:-chat-backend-svc}"
URL_MAP_NAME="${URL_MAP_NAME:-chat-url-map}"
HTTP_PROXY_NAME="${HTTP_PROXY_NAME:-chat-http-proxy}"
HTTPS_PROXY_NAME="${HTTPS_PROXY_NAME:-chat-https-proxy}"
CERT_NAME="${CERT_NAME:-chat-managed-cert}"
HTTP_RULE_NAME="${HTTP_RULE_NAME:-chat-http-fr}"
HTTPS_RULE_NAME="${HTTPS_RULE_NAME:-chat-https-fr}"
SERVICE_NAME="${SERVICE_NAME:-chat-backend}"
DOMAIN_NAME="${DOMAIN_NAME:-}"

echo "📡 Ensuring global static IP (${LB_IP_NAME})..."
gcloud compute addresses describe "$LB_IP_NAME" --global >/dev/null 2>&1 || \
  gcloud compute addresses create "$LB_IP_NAME" --ip-version=IPV4 --global

STATIC_IP=$(gcloud compute addresses describe "$LB_IP_NAME" --global --format='value(address)')
echo "🔢 Reserved static IP: ${STATIC_IP}"

echo "🧩 Ensuring serverless NEG for Cloud Run service ${SERVICE_NAME}..."
gcloud compute network-endpoint-groups describe "$NEG_NAME" --region="$REGION" >/dev/null 2>&1 || \
  gcloud compute network-endpoint-groups create "$NEG_NAME" \
    --region="$REGION" \
    --network-endpoint-type=SERVERLESS \
    --cloud-run-service="$SERVICE_NAME"

echo "🧰 Ensuring backend service and URL map..."
gcloud compute backend-services describe "$BACKEND_NAME" --global >/dev/null 2>&1 || \
  gcloud compute backend-services create "$BACKEND_NAME" \
    --global --load-balancing-scheme=EXTERNAL_MANAGED --protocol=HTTP

gcloud compute backend-services add-backend "$BACKEND_NAME" \
  --global --network-endpoint-group="$NEG_NAME" --network-endpoint-group-region="$REGION" >/dev/null 2>&1 || true

gcloud compute url-maps describe "$URL_MAP_NAME" >/dev/null 2>&1 || \
  gcloud compute url-maps create "$URL_MAP_NAME" --default-service="$BACKEND_NAME"

echo "➡️  Ensuring HTTP proxy + forwarding rule on static IP..."
gcloud compute target-http-proxies describe "$HTTP_PROXY_NAME" >/dev/null 2>&1 || \
  gcloud compute target-http-proxies create "$HTTP_PROXY_NAME" --url-map="$URL_MAP_NAME"

gcloud compute forwarding-rules describe "$HTTP_RULE_NAME" --global >/dev/null 2>&1 || \
  gcloud compute forwarding-rules create "$HTTP_RULE_NAME" \
    --address="$LB_IP_NAME" --global --target-http-proxy="$HTTP_PROXY_NAME" --ports=80

if [[ -n "$DOMAIN_NAME" ]]; then
  echo "🔐 Ensuring managed SSL certificate for domain: ${DOMAIN_NAME}"
  gcloud compute ssl-certificates describe "$CERT_NAME" --global >/dev/null 2>&1 || \
    gcloud compute ssl-certificates create "$CERT_NAME" --domains="$DOMAIN_NAME" --global

  echo "🔒 Ensuring HTTPS proxy + forwarding rule..."
  gcloud compute target-https-proxies describe "$HTTPS_PROXY_NAME" >/dev/null 2>&1 || \
    gcloud compute target-https-proxies create "$HTTPS_PROXY_NAME" \
      --url-map="$URL_MAP_NAME" --ssl-certificates="$CERT_NAME"

  gcloud compute forwarding-rules describe "$HTTPS_RULE_NAME" --global >/dev/null 2>&1 || \
    gcloud compute forwarding-rules create "$HTTPS_RULE_NAME" \
      --address="$LB_IP_NAME" --global --target-https-proxy="$HTTPS_PROXY_NAME" --ports=443

  echo "📣 Point ${DOMAIN_NAME} A record to ${STATIC_IP}. Managed cert will provision automatically."
fi

SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')
echo "🎉 Done. Static IP: ${STATIC_IP} | Cloud Run: ${SERVICE_URL}"

