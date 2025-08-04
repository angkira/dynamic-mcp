/**
 * Re-export chat types from shared
 * This file maintains backward compatibility for existing client imports
 * 
 * Note: For build compatibility, we import specific types and re-declare enums
 */

// Import types that work in the build
export type {
  Chat,
  User,
  Settings,
  MCPServer,
} from '@dynamic-mcp/shared/types/chat';

export type {
  CreateChatRequest,
  CreateChatResponse,
  GetChatsResponse,
  DeleteChatResponse,
} from '@dynamic-mcp/shared/types/api';

// Re-declare enums locally to avoid build issues with shared enums
export enum MCPServerStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN',
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