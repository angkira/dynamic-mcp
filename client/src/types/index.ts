/**
 * Centralized type exports
 */

// Import enums as regular imports (they're used as runtime values)
import {
  MCPAuthType,
  MCPTransportType,
  MCPServerStatus,
} from '@dynamic-mcp/shared'

// Import types that exist in shared
import type {
  MCPServer,
} from '@dynamic-mcp/shared'

// Re-export shared types for local use
export {
  MCPAuthType,
  MCPTransportType,
  MCPServerStatus,
}

export type {
  MCPServer,
}

// Local MCP type definitions (should eventually move to shared)
export interface MCPTransport {
  type: MCPTransportType
  config: MCPTransportConfig
}

export interface MCPTransportConfig {
  command?: string
  args?: string[]
  env?: Record<string, string>
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  sessionId?: string
}

export interface MCPAuthentication {
  type: MCPAuthType
  config: MCPAuthConfig
}

export interface MCPAuthConfig {
  clientId?: string
  clientSecret?: string
  authUrl?: string
  tokenUrl?: string
  scopes?: string[]
  apiKey?: string
  headerName?: string
  token?: string
}

export interface MCPCapabilities {
  tools: MCPTool[]
  resources: MCPResource[]
  prompts: MCPPrompt[]
  supportsElicitation?: boolean
  supportsRoots?: boolean
  supportsProgress?: boolean
}

export interface MCPTool {
  name: string
  description: string
  schema: Record<string, unknown>
  category?: string
}

export interface MCPResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
  isTemplate?: boolean
}

export interface MCPPrompt {
  name: string
  description: string
  arguments?: MCPPromptArgument[]
}

export interface MCPPromptArgument {
  name: string
  description: string
  required: boolean
  type: string
}

export interface MCPServerConfig {
  autoConnect: boolean
  connectionTimeout: number
  maxRetries: number
  retryDelay: number
  validateCertificates: boolean
  debug: boolean
}

// Database enums (matching Prisma schema)
export enum MCPTransportTypeDB {
  STDIO = 'STDIO',
  SSE = 'SSE',
  STREAMABLE_HTTP = 'STREAMABLE_HTTP'
}

export enum MCPAuthTypeDB {
  NONE = 'NONE',
  OAUTH = 'OAUTH',
  APIKEY = 'APIKEY',
  BEARER = 'BEARER'
}

// Message types
export * from './message'

// Chat types  
export * from './chat'

// WebSocket types
export * from './websocket'

// Model types
export * from './model'

// UI types
export * from './ui'

// Common utility types
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}

export class ApiError extends Error {
  code?: string | number
  details?: unknown
  constructor(message: string, code?: string | number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc'
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: SortOrder
}

// Settings types
export interface Settings {
  defaultProvider: string
  defaultModel: string
  thinkingBudget: number
  responseBudget: number
  mcpEnableDebugLogging: boolean
  mcpDefaultTimeout: number
  mcpMaxConcurrentConnections: number
  mcpAutoDiscovery: boolean
}

export interface GetSettingsResponse extends Settings {}

export interface UpdateSettingsRequest extends Partial<Settings> {}

export interface UpdateSettingsResponse extends Settings {}

// Client-specific MCP types
export interface MCPSettings {
  servers: MCPServer[]
  globalConfig: MCPGlobalConfig
}

export interface MCPGlobalConfig {
  enableDebugLogging: boolean
  defaultTimeout: number
  maxConcurrentConnections: number
  autoDiscovery: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export enum SSEEventType {
  ChatId = 'chatId',
  UserMessage = 'userMessage',
  Chunk = 'chunk',
  Complete = 'complete',
  Error = 'error'
}

// Event types for SSE
export interface SSEEvent {
  type: SSEEventType
  data: unknown
}