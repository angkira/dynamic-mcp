/**
 * Shared MCP types
 */

import type { MCPAuthType, MCPTransportType, MCPServerStatus } from './enums'

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
  globalConfig: MCPGlobalConfig
}

export interface MCPGlobalConfig {
  enableDebugLogging: boolean
  defaultTimeout: number
  maxConcurrentConnections: number
  autoDiscovery: boolean
}
