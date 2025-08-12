# GCP Deployment Guide

This folder contains scripts to provision infra, build the server image, and deploy to Cloud Run.

## Prerequisites

- `gcloud` CLI installed and authenticated
- `server.env` present in repo root or export env vars before running scripts
  - Required: `PROJECT_ID`, optional: `REGION` (default `us-central1`)

## Build and Deploy (Cloud Run)

Single command:

```bash
PROJECT_ID=your-project \
REGION=europe-west3 \
SERVICE_NAME=dynamic-mcp-server \
bash server/gcp/08-build-and-deploy.sh
```

What it does:
- Builds container with Cloud Build using `server/Dockerfile.gcp` (single-stage; builds `shared` then compiles `server` to `/app/dist`)
- Pushes to Artifact Registry
- Deploys to Cloud Run (port 8080, min-instances=1, 2Gi RAM)
- Sets secrets if present (Secret Manager) and DB envs (if Cloud SQL is attached)

## HTTPS Load Balancer + Custom Domain

Provision a global external HTTPS LB in front of Cloud Run:

```bash
PROJECT_ID=your-project \
REGION=europe-west3 \
SERVICE_NAME=dynamic-mcp-server \
DOMAIN_NAME=api.mcp-test.dev \
bash server/gcp/09-load-balancer.sh
```

Then:
- In Cloudflare (or your DNS): create an A record `api` → the static IP printed by the script
- Wait for the managed certificate to become `ACTIVE`:

```bash
gcloud compute ssl-certificates describe chat-managed-cert --global \
  --format='get(managed.status,managed.domainStatus)'
```

If you accidentally issued the cert for the wrong host, create a new one and switch the proxy:

```bash
gcloud compute ssl-certificates create chat-managed-cert-mcp \
  --domains=api.mcp-test.dev --global
gcloud compute target-https-proxies update chat-https-proxy \
  --ssl-certificates=chat-managed-cert-mcp
```

Tip: Set DNS to "DNS only" (grey cloud) while the cert provisions, then re-enable proxy and use SSL mode "Full (strict)".

## Workload Identity Federation (GitHub Actions)

Create a pool and provider for GitHub OIDC:

```bash
PROJECT_ID=your-project
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

# Pool (skip if exists)
gcloud iam workload-identity-pools create github-pool \
  --location=global --display-name="GitHub Actions"

# Provider with claim mappings and repo/branch condition
gcloud iam workload-identity-pools providers create-oidc github-actions \
  --location=global --workload-identity-pool=github-pool \
  --display-name="GitHub Actions OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref,attribute.actor=assertion.actor" \
  --attribute-condition="attribute.repository=='OWNER/REPO' && attribute.ref=='refs/heads/main'"

# Copy this into GitHub secret GCP_WIF_PROVIDER
gcloud iam workload-identity-pools providers describe github-actions \
  --location=global --workload-identity-pool=github-pool \
  --format='value(name)'

# Allow the GitHub principal set to impersonate the deploy SA
DEPLOY_SA=deploy-sa@$PROJECT_ID.iam.gserviceaccount.com
gcloud iam service-accounts add-iam-policy-binding "$DEPLOY_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/OWNER/REPO"
```

Required GitHub repo secrets for `.github/workflows/deploy-gcp.yml`:

- `GCP_WIF_PROVIDER`: projects/…/workloadIdentityPools/github-pool/providers/github-actions
- `GCP_DEPLOY_SA`: deploy-sa@PROJECT_ID.iam.gserviceaccount.com
- `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`, `GCP_RUN_SERVICE`

## Redis (Memory MCP)

- Memory MCP uses Redis with password auth
- In compose files we set `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

## CORS

- Set `CORS_ORIGINS` on deploy to allow your site and Worker hosts, e.g.:
  - `CORS_ORIGINS=https://mcp-test.dev,https://www.mcp-test.dev,https://api.mcp-test.dev`


