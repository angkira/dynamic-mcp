import type { 
  MCPServer, 
  MCPSettings, 
  MCPServerStatus,
  MCPTransportTypeDB,
  MCPAuthTypeDB,
  ApiResponse 
} from '@/types'
import { httpClient } from '../api'

export interface CreateMCPServerRequest {
  name: string
  version: string
  description?: string
  isEnabled?: boolean
  
  // Transport configuration
  transportType: MCPTransportTypeDB
  transportCommand?: string
  transportArgs?: string[]
  transportEnv?: Record<string, string>
  transportBaseUrl?: string
  transportTimeout?: number
  transportRetryAttempts?: number
  transportSessionId?: string
  
  // Authentication configuration
  authType?: MCPAuthTypeDB
  authClientId?: string
  authClientSecret?: string
  authAuthUrl?: string
  authTokenUrl?: string
  authScopes?: string[]
  authApiKey?: string
  authHeaderName?: string
  authToken?: string
  
  // Server configuration
  configAutoConnect?: boolean
  configConnectionTimeout?: number
  configMaxRetries?: number
  configRetryDelay?: number
  configValidateCertificates?: boolean
  configDebug?: boolean
  
  // Capabilities
  capabilities?: {
    tools: Array<{
      name: string
      description: string
      schema: Record<string, unknown>
      category?: string
    }>
    resources: Array<{
      uri: string
      name: string
      description?: string
      mimeType?: string
      isTemplate?: boolean
    }>
    prompts: Array<{
      name: string
      description: string
      arguments?: Array<{
        name: string
        description: string
        required: boolean
        type: string
      }>
    }>
    supportsElicitation?: boolean
    supportsRoots?: boolean
    supportsProgress?: boolean
  }
}

export interface UpdateMCPServerRequest extends Partial<CreateMCPServerRequest> {}

export interface UpdateMCPServerStatusRequest {
  status: MCPServerStatus
  lastConnected?: string
}

export interface MCPTestConnectionResponse {
  success: boolean
  message: string
}

// Transform frontend MCPServer to backend format
const transformToBackendFormat = (server: Partial<MCPServer>): Partial<CreateMCPServerRequest> => {
  const result: Partial<CreateMCPServerRequest> = {
    name: server.name,
    version: server.version,
    description: server.description,
    isEnabled: server.isEnabled,
    
    // Transform transport
    transportType: server.transport?.type
      ? (server.transport.type.toUpperCase().replace('-', '_') as MCPTransportTypeDB)
      : ('STDIO' as MCPTransportTypeDB),
    transportCommand: server.transport?.config?.command,
    transportArgs: server.transport?.config?.args,
    transportEnv: server.transport?.config?.env,
    transportBaseUrl: server.transport?.config?.baseUrl,
    transportTimeout: server.transport?.config?.timeout,
    transportRetryAttempts: server.transport?.config?.retryAttempts,
    transportSessionId: server.transport?.config?.sessionId,
    
    // Transform authentication
    authType: server.authentication?.type
      ? (server.authentication.type.toUpperCase() as MCPAuthTypeDB)
      : ('NONE' as MCPAuthTypeDB),
    authClientId: server.authentication?.config?.clientId,
    authClientSecret: server.authentication?.config?.clientSecret,
    authAuthUrl: server.authentication?.config?.authUrl,
    authTokenUrl: server.authentication?.config?.tokenUrl,
    authScopes: server.authentication?.config?.scopes,
    authApiKey: server.authentication?.config?.apiKey,
    authHeaderName: server.authentication?.config?.headerName,
    authToken: server.authentication?.config?.token,
    
    // Transform config
    configAutoConnect: server.config?.autoConnect,
    configConnectionTimeout: server.config?.connectionTimeout,
    configMaxRetries: server.config?.maxRetries,
    configRetryDelay: server.config?.retryDelay,
    configValidateCertificates: server.config?.validateCertificates,
    configDebug: server.config?.debug,
    
    // Capabilities
    capabilities: server.capabilities
  }
  
  return result
}

export const mcpApi = {
  // Get all MCP servers
  async getServers(): Promise<MCPServer[]> {
    const result: ApiResponse<MCPServer[]> = await httpClient.get('/mcp')
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch MCP servers')
    }
    
    return result.data || []
  },

  // Get a specific MCP server
  async getServer(id: string): Promise<MCPServer> {
    const result: ApiResponse<MCPServer> = await httpClient.get(`/mcp/${id}`)
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch MCP server')
    }
    
    return result.data!
  },

  // Create a new MCP server
  async createServer(serverData: Partial<MCPServer>): Promise<{ id: string }> {
    const transformedData = transformToBackendFormat(serverData)
    
    const result: ApiResponse<{ id: string }> = await httpClient.post('/mcp', transformedData)
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to create MCP server')
    }
    
    return result.data!
  },

  // Update an existing MCP server
  async updateServer(id: string, serverData: Partial<MCPServer>): Promise<void> {
    const transformedData = transformToBackendFormat(serverData)
    
    const result: ApiResponse = await httpClient.put(`/mcp/${id}`, transformedData)
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to update MCP server')
    }
  },

  // Update server status
  async updateServerStatus(id: string, status: MCPServerStatus, lastConnected?: Date): Promise<void> {
    const statusData: UpdateMCPServerStatusRequest = {
      status,
      lastConnected: lastConnected?.toISOString()
    }
    
    const result: ApiResponse = await httpClient.patch(`/mcp/${id}/status`, statusData)
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to update MCP server status')
    }
  },

  // Delete an MCP server
  async deleteServer(id: string): Promise<void> {
    const result: ApiResponse = await httpClient.delete(`/mcp/${id}`)
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to delete MCP server')
    }
  },

  // Test MCP server connection
  async testConnection(id: string): Promise<MCPTestConnectionResponse> {
    const result: ApiResponse<MCPTestConnectionResponse> = await httpClient.post(`/mcp/${id}/test`)
    
    return {
      success: result.success,
      message: result.message || 'Unknown error'
    }
  }
}