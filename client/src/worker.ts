export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  BACKEND_URL: string;
}

function buildBackendUrl(request: Request, backendBaseUrl: string): string {
  const incomingUrl = new URL(request.url);
  const base = backendBaseUrl.replace(/\/$/, "");
  const pathAndQuery = incomingUrl.pathname + (incomingUrl.search || "");
  return `${base}${pathAndQuery}`;
}

async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  const targetUrl = buildBackendUrl(request, env.BACKEND_URL);
  const proxyRequest = new Request(targetUrl, request);
  return fetch(proxyRequest);
}

async function serveAssetOrSpa(request: Request, env: Env): Promise<Response> {
  // Try the static asset first
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) {
    return assetResponse;
  }
  // SPA fallback to index.html
  const url = new URL(request.url);
  url.pathname = "/index.html";
  return env.ASSETS.fetch(new Request(url.toString(), request));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Proxy API and Socket.IO to external backend (GCP)
    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/socket.io")) {
      return proxyToBackend(request, env);
    }

    // Static assets + SPA fallback
    return serveAssetOrSpa(request, env);
  },
};


