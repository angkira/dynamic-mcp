/**
 * Centralized type exports
 */

import type { MCPAuthType, MCPTransportType } from '@dynamic-mcp/shared'

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

// Note: User types from './user' are commented out to avoid conflict with shared User type
// Client-specific user types can be imported directly from './user' when needed

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
  // MCP Global Settings
  mcpEnableDebugLogging: boolean
  mcpDefaultTimeout: number
  mcpMaxConcurrentConnections: number
  mcpAutoDiscovery: boolean
}

export interface GetSettingsResponse extends Settings {}

export interface UpdateSettingsRequest extends Partial<Settings> {}

export interface UpdateSettingsResponse extends Settings {}

// MCP (Model Context Protocol) types
export interface MCPServer {
  id: string
  name: string
  version: string
  description?: string
  transport: MCPTransport
  authentication?: MCPAuthentication
  capabilities: MCPCapabilities
  status: MCPServerStatus
  config: MCPServerConfig
  lastConnected?: Date
  isEnabled: boolean
}

export interface MCPTransport {
  type: MCPTransportType
  config: MCPTransportConfig
}

export interface MCPTransportConfig {
  // For stdio transport
  command?: string
  args?: string[]
  env?: Record<string, string>
  
  // For HTTP transports
  baseUrl?: string
  timeout?: number
  retryAttempts?: number
  
  // For streamable HTTP
  sessionId?: string
}

export interface MCPAuthentication {
  type: MCPAuthType
  config: MCPAuthConfig
}

export interface MCPAuthConfig {
  // OAuth config
  clientId?: string
  clientSecret?: string
  authUrl?: string
  tokenUrl?: string
  scopes?: string[]
  
  // API Key config
  apiKey?: string
  headerName?: string
  
  // Bearer token config
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

export enum MCPServerStatus {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Error = 'error',
  Unknown = 'unknown'
}

// Database enums (matching Prisma schema)
export enum MCPServerStatusDB {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED', 
  CONNECTING = 'CONNECTING',
  ERROR = 'ERROR',
  UNKNOWN = 'UNKNOWN'
}

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

export interface MCPServerConfig {
  autoConnect: boolean
  connectionTimeout: number
  maxRetries: number
  retryDelay: number
  validateCertificates: boolean
  debug: boolean
}

export interface MCPSettings {
  servers: MCPServer[]
  globalConfig: {
    enableDebugLogging: boolean
    defaultTimeout: number
    maxConcurrentConnections: number
    autoDiscovery: boolean
  }
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