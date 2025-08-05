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
  HTTP = 'HTTP',
  STREAMABLE_HTTP = 'STREAMABLE_HTTP',
  WEBSOCKET = 'WEBSOCKET',
}

export enum MCPAuthType {
  NONE = 'NONE',
  API_KEY = 'API_KEY',
  BEARER = 'BEARER',
  OAUTH2 = 'OAUTH2',
}
