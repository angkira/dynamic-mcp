/**
 * Shared MCP enums
 */

export enum MCPServerStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR',
}

export enum MCPTransportType {
  STDIO = 'STDIO',
  SSE = 'SSE',
  STREAMABLE_HTTP = 'STREAMABLE_HTTP',
}

export enum MCPAuthType {
  NONE = 'NONE',
  OAUTH = 'OAUTH',
  APIKEY = 'APIKEY',
  BEARER = 'BEARER',
}
