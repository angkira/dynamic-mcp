import { PrismaClient } from '@prisma/client'
import type { MCPServer, MCPServerStatus } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import McpConnectionManager from './mcpConnectionManager'
import type { 
  MCPServerUpdateData,
  MCPToolForLLM,
  MCPResourceForLLM,
  MCPConnectionInfo,
  MCPHealthCheckResult,
  CallToolResult,
  ReadResourceResult
} from '../../types/mcp.types'

/**
 * MCP Service
 * 
 * Main service layer for MCP operations. Provides CRUD operations, connection management,
 * and integration with the LLM system.
 */
export class McpService {
  private prisma: PrismaClient
  private connectionManager: McpConnectionManager

  constructor(fastify?: FastifyInstance) {
    this.prisma = new PrismaClient()
    this.connectionManager = new McpConnectionManager(fastify)
  }

  /**
   * Initialize the service and connection manager
   */
  async initialize() {
    // Ensure the default internal servers exist in the database
    await this.ensureDefaultServers()
    
    // Load global settings and pass them to connection manager
    const settings = await this.getUserSettings()
    this.connectionManager.updateGlobalSettings({
      mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
      mcpDefaultTimeout: settings.mcpDefaultTimeout,
      mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
      mcpAutoDiscovery: settings.mcpAutoDiscovery
    })
    
    await this.connectionManager.initialize()
  }

  /**
   * Get user settings (including MCP global settings)
   */
  private async getUserSettings(userId: number = 1) {
    let settings = await this.prisma.settings.findUnique({
      where: { userId }
    })

    // If no settings exist, create default ones
    if (!settings) {
      // Ensure user exists
      let user = await this.prisma.user.findUnique({
        where: { id: userId }
      })

      if (!user) {
        user = await this.prisma.user.create({
          data: {
            email: 'user@example.com',
            name: 'Default User'
          }
        })
      }

      settings = await this.prisma.settings.create({
        data: {
          userId: user.id,
          defaultProvider: 'google',
          defaultModel: 'gemini-2.5-flash-lite',
          thinkingBudget: 2048,
          responseBudget: 8192,
          mcpEnableDebugLogging: false,
          mcpDefaultTimeout: 10000,
          mcpMaxConcurrentConnections: 5,
          mcpAutoDiscovery: true
        }
      })
    }

    return settings
  }

  /**
   * Update global settings (call this when settings change)
   */
  async updateGlobalSettings(userId: number = 1) {
    const settings = await this.getUserSettings(userId)
    this.connectionManager.updateGlobalSettings({
      mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
      mcpDefaultTimeout: settings.mcpDefaultTimeout,
      mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
      mcpAutoDiscovery: settings.mcpAutoDiscovery
    })
  }

  // CRUD Operations

  /**
   * Get all MCP servers for a user
   */
  async getServers(userId: number = 1) {
    const servers = await this.prisma.mCPServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    })

    return servers.map(server => this.transformServerForResponse(server))
  }

  /**
   * Get a specific MCP server
   */
  async getServer(id: number, userId: number = 1) {
    const server = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!server) {
      return null
    }

    return this.transformServerForResponse(server)
  }

  /**
   * Create a new MCP server
   */
  async createServer(serverData: Record<string, unknown>, userId: number = 1) {
    const server = await this.prisma.mCPServer.create({
      data: {
        userId,
        name: serverData.name as string,
        version: (serverData.version as string) || '1.0.0',
        description: serverData.description as string | null,
        isEnabled: (serverData.isEnabled as boolean) ?? true,
        status: 'DISCONNECTED',
        
        // Transport configuration
        transportType: serverData.transportType as any,
        transportCommand: serverData.transportCommand as string | null,
        transportArgs: (serverData.transportArgs as string[]) || [],
        transportEnv: (serverData.transportEnv as Record<string, string>) || {},
        transportBaseUrl: serverData.transportBaseUrl as string | null,
        transportTimeout: serverData.transportTimeout as number | null,
        transportRetryAttempts: serverData.transportRetryAttempts as number | null,
        transportSessionId: serverData.transportSessionId as string | null,
        
        // Authentication configuration
        authType: (serverData.authType as any) || 'NONE',
        authClientId: serverData.authClientId as string | null,
        authClientSecret: serverData.authClientSecret as string | null,
        authAuthUrl: serverData.authAuthUrl as string | null,
        authTokenUrl: serverData.authTokenUrl as string | null,
        authScopes: (serverData.authScopes as string[]) || [],
        authApiKey: serverData.authApiKey as string | null,
        authHeaderName: serverData.authHeaderName as string | null,
        authToken: serverData.authToken as string | null,
        
        // Server configuration
        configAutoConnect: (serverData.configAutoConnect as boolean) ?? false,
        configConnectionTimeout: (serverData.configConnectionTimeout as number) ?? 10000,
        configMaxRetries: (serverData.configMaxRetries as number) ?? 3,
        configRetryDelay: (serverData.configRetryDelay as number) ?? 2000,
        configValidateCertificates: (serverData.configValidateCertificates as boolean) ?? true,
        configDebug: (serverData.configDebug as boolean) ?? false,
        
        // Capabilities
        capabilities: serverData.capabilities || {
          tools: [],
          resources: [],
          prompts: []
        }
      }
    })

    // If server is enabled and autoConnect is true, attempt to connect
    if (server.isEnabled && server.configAutoConnect) {
      await this.connectionManager.connectToServer(server)
    }

    return this.transformServerForResponse(server)
  }

  /**
   * Update an MCP server
   */
  async updateServer(id: number, updateData: Record<string, unknown>, userId: number = 1) {
    const existingServer = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!existingServer) {
      throw new Error('MCP server not found')
    }

    // Build update object with only provided fields
    const updateObj: MCPServerUpdateData = {}
    
    if (updateData.name !== undefined) updateObj.name = updateData.name as string
    if (updateData.version !== undefined) updateObj.version = updateData.version as string
    if (updateData.description !== undefined) updateObj.description = updateData.description as string | null
    if (updateData.isEnabled !== undefined) updateObj.isEnabled = updateData.isEnabled as boolean
    
    if (updateData.transportType !== undefined) updateObj.transportType = updateData.transportType as string
    if (updateData.transportCommand !== undefined) updateObj.transportCommand = updateData.transportCommand as string | null
    if (updateData.transportArgs !== undefined) updateObj.transportArgs = updateData.transportArgs
    if (updateData.transportEnv !== undefined) updateObj.transportEnv = updateData.transportEnv
    if (updateData.transportBaseUrl !== undefined) updateObj.transportBaseUrl = updateData.transportBaseUrl as string | null
    if (updateData.transportTimeout !== undefined) updateObj.transportTimeout = updateData.transportTimeout as number | null
    if (updateData.transportRetryAttempts !== undefined) updateObj.transportRetryAttempts = updateData.transportRetryAttempts as number | null
    if (updateData.transportSessionId !== undefined) updateObj.transportSessionId = updateData.transportSessionId as string | null
    
    if (updateData.authType !== undefined) updateObj.authType = updateData.authType as string
    if (updateData.authClientId !== undefined) updateObj.authClientId = updateData.authClientId as string | null
    if (updateData.authClientSecret !== undefined) updateObj.authClientSecret = updateData.authClientSecret as string | null
    if (updateData.authAuthUrl !== undefined) updateObj.authAuthUrl = updateData.authAuthUrl as string | null
    if (updateData.authTokenUrl !== undefined) updateObj.authTokenUrl = updateData.authTokenUrl as string | null
    if (updateData.authScopes !== undefined) updateObj.authScopes = updateData.authScopes
    if (updateData.authApiKey !== undefined) updateObj.authApiKey = updateData.authApiKey as string | null
    if (updateData.authHeaderName !== undefined) updateObj.authHeaderName = updateData.authHeaderName as string | null
    if (updateData.authToken !== undefined) updateObj.authToken = updateData.authToken as string | null
    
    if (updateData.configAutoConnect !== undefined) updateObj.configAutoConnect = updateData.configAutoConnect as boolean
    if (updateData.configConnectionTimeout !== undefined) updateObj.configConnectionTimeout = updateData.configConnectionTimeout as number
    if (updateData.configMaxRetries !== undefined) updateObj.configMaxRetries = updateData.configMaxRetries as number
    if (updateData.configRetryDelay !== undefined) updateObj.configRetryDelay = updateData.configRetryDelay as number
    if (updateData.configValidateCertificates !== undefined) updateObj.configValidateCertificates = updateData.configValidateCertificates as boolean
    if (updateData.configDebug !== undefined) updateObj.configDebug = updateData.configDebug as boolean
    
    if (updateData.capabilities !== undefined) updateObj.capabilities = updateData.capabilities

    const updatedServer = await this.prisma.mCPServer.update({
      where: { id },
      data: updateObj as any
    })

    // Handle enable/disable state changes
    if (updateData.isEnabled !== undefined) {
      if (updateData.isEnabled && updatedServer.configAutoConnect) {
        // Server was enabled and has autoConnect - attempt to connect
        await this.connectionManager.connectToServer(updatedServer)
      } else if (!updateData.isEnabled) {
        // Server was disabled - disconnect if connected
        await this.connectionManager.disconnectFromServer(id)
      }
    }

    return this.transformServerForResponse(updatedServer)
  }

  /**
   * Update server status
   */
  async updateServerStatus(id: number, status: MCPServerStatus, lastConnected?: Date, userId: number = 1) {
    const existingServer = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!existingServer) {
      throw new Error('MCP server not found')
    }

    const updateData: { status: MCPServerStatus; lastConnected?: Date } = { status }
    
    if (lastConnected) {
      updateData.lastConnected = lastConnected
    } else if (status === 'CONNECTED') {
      updateData.lastConnected = new Date()
    }

    await this.prisma.mCPServer.update({
      where: { id },
      data: updateData
    })
  }

  /**
   * Delete an MCP server
   */
  async deleteServer(id: number, userId: number = 1) {
    const existingServer = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!existingServer) {
      throw new Error('MCP server not found')
    }

    // Disconnect if connected
    await this.connectionManager.disconnectFromServer(id)

    // Delete from database
    await this.prisma.mCPServer.delete({
      where: { id }
    })
  }

  /**
   * Test connection to an MCP server
   * If already connected, performs a ping test
   * If not connected, attempts a quick connection test
   */
  async testConnection(id: number, userId: number = 1) {
    const server = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!server) {
      return { success: false, message: 'MCP server not found' }
    }

    try {
      // Check if server is already connected
      const isConnected = this.connectionManager.isConnected(id)
      
      if (isConnected) {
        // Server is connected, perform a ping test
        const healthResults = await this.connectionManager.healthCheck()
        const serverHealth = healthResults.find(h => h.serverId === id)
        
        if (serverHealth) {
          return {
            success: serverHealth.healthy,
            message: serverHealth.healthy 
              ? 'Connection test successful (ping)' 
              : `Connection test failed: ${serverHealth.error || 'Ping failed'}`
          }
        } else {
          return { success: false, message: 'Server health status not available' }
        }
      } else {
        // Server is not connected, attempt a quick connection test
        const success = await this.connectionManager.connectToServer(server)
        
        if (success) {
          // Optionally disconnect after successful test to avoid keeping unnecessary connections
          // await this.connectionManager.disconnectFromServer(id)
          return { 
            success: true, 
            message: 'Connection test successful (connected)' 
          }
        } else {
          return { 
            success: false, 
            message: 'Failed to establish connection' 
          }
        }
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      }
    }
  }

  // Integration with LLM system

  /**
   * Get all available tools from enabled MCP servers for LLM integration
   */
  async getAvailableToolsForLLM(): Promise<MCPToolForLLM[]> {
    return await this.connectionManager.getAllAvailableTools()
  }

  /**
   * Get all available resources from enabled MCP servers for LLM integration
   */
  async getAvailableResourcesForLLM(): Promise<MCPResourceForLLM[]> {
    return await this.connectionManager.getAllAvailableResources()
  }

  /**
   * Execute an MCP tool call from LLM
   */
  async executeMCPTool(toolName: string, arguments_: unknown): Promise<CallToolResult> {
    // Parse server and tool name from format "serverName__toolName"
    let serverName: string;
    let originalToolName: string;
    
    if (toolName.includes('__')) {
      const parts = toolName.split('__');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new Error('Invalid tool name format. Expected "serverName__toolName"');
      }
      serverName = parts[0];
      originalToolName = parts[1];
    } else {
      // Legacy format - try to find which server has this tool
      throw new Error('Legacy tool format not supported. Use "serverName__toolName" format.');
    }

    // Find the server by name
    const server = await this.prisma.mCPServer.findFirst({
      where: { 
        name: serverName,
        isEnabled: true,
        userId: 1 // TODO: Support multiple users
      }
    })

    if (!server) {
      throw new Error(`MCP server "${serverName}" not found or not enabled`)
    }

    // All tools now go through the connection manager - no more internal handling
    return await this.connectionManager.callTool(server.id, originalToolName, arguments_)
  }

  /**
   * Read an MCP resource for LLM
   */
  async readMCPResource(serverId: number, uri: string): Promise<ReadResourceResult> {
    return await this.connectionManager.readResource(serverId, uri)
  }

  // Utility methods

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): MCPConnectionInfo[] {
    return this.connectionManager.getConnectionStatus()
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<MCPHealthCheckResult[]> {
    return await this.connectionManager.healthCheck()
  }

  /**
   * Refresh all connections
   */
  async refreshConnections() {
    await this.connectionManager.refreshConnections()
  }

  /**
   * Ensure the default servers exist in the database
   */
  private async ensureDefaultServers() {
    await this.ensureMemoryServer()
    await this.ensureDynamicMCPAPIServer()
  }

  /**
   * Ensure the memory server exists in the database
   */
  private async ensureMemoryServer() {
    const existingMemory = await this.prisma.mCPServer.findFirst({
      where: { 
        name: 'memory',
        userId: 1
      }
    })

    if (!existingMemory) {
      console.log('🔧 Creating memory MCP server entry...')
      
      await this.prisma.mCPServer.create({
        data: {
          userId: 1,
          name: 'memory',
          version: '1.0.0',
          description: 'Persistent memory system that allows AI to remember and recall information across conversations',
          isEnabled: true,
          status: 'DISCONNECTED',
          transportType: 'STDIO',
          transportCommand: 'node',
          transportArgs: [
            'dist/mcp-servers/memory-server.js'
          ],
          transportEnv: {},
          authType: 'NONE',
          configAutoConnect: true,
          configConnectionTimeout: 10000,
          configMaxRetries: 3,
          configRetryDelay: 2000,
          configValidateCertificates: true,
          configDebug: false,
          capabilities: {
            tools: [
              {
                name: 'memory_remember',
                description: '💾 REMEMBER information that should be recalled later. Use this to store facts, preferences, context, or any important information.',
                labels: ['memory', 'storage', 'persistence']
              },
              {
                name: 'memory_recall',
                description: '🧠 RECALL previously stored memories. Use this to retrieve information that was stored earlier.',
                labels: ['memory', 'retrieval', 'search']
              },
              {
                name: 'memory_reset',
                description: '🗑️ DELETE stored memories. Use with caution! Can delete all memories or just those with a specific key.',
                labels: ['memory', 'cleanup', 'deletion']
              }
            ],
            resources: [],
            prompts: []
          },
          lastConnected: null
        }
      })
      
      console.log('✅ Memory MCP server created')
    }
  }

  /**
   * Ensure the dynamic MCP API server exists in the database  
   */
  private async ensureDynamicMCPAPIServer() {
    const existingAPI = await this.prisma.mCPServer.findFirst({
      where: { 
        name: 'dynamic-mcp-api',
        userId: 1
      }
    })

    if (!existingAPI) {
      console.log('🔧 Creating dynamic MCP API server entry...')
      
      await this.prisma.mCPServer.create({
        data: {
          userId: 1,
          name: 'dynamic-mcp-api',
          version: '1.0.0',
          description: 'Internal MCP server for managing the Dynamic MCP system via chat',
          isEnabled: true,
          status: 'DISCONNECTED',
          transportType: 'STDIO',
          transportCommand: 'node',
          transportArgs: [
            'dist/mcp-servers/dynamic-mcp-api-server.js'
          ],
          transportEnv: {},
          authType: 'NONE',
          configAutoConnect: true,
          configConnectionTimeout: 10000,
          configMaxRetries: 3,
          configRetryDelay: 2000,
          configValidateCertificates: true,
          configDebug: false,
          capabilities: {
            tools: [
              { 
                name: 'mcp_list_servers', 
                description: '📋 List all registered MCP servers with their connection status, capabilities, and configuration details',
                labels: ['management', 'read', 'servers']
              },
              { 
                name: 'mcp_create_server', 
                description: '➕ Register a new MCP server with connection configuration and capabilities',
                labels: ['management', 'create', 'servers'] 
              },
              { 
                name: 'mcp_update_server', 
                description: '✏️ Update an existing MCP server configuration, connection settings, or capabilities',
                labels: ['management', 'update', 'servers']
              },
              { 
                name: 'mcp_delete_server', 
                description: '🗑️ Permanently remove an MCP server and all its associated data',
                labels: ['management', 'delete', 'servers']
              },
              { 
                name: 'mcp_toggle_server', 
                description: '🔄 Enable or disable an MCP server to control its availability for tool calls',
                labels: ['management', 'update', 'servers', 'status']
              },
              {
                name: 'mcp_connect_server',
                description: '🔌 Establish connection to an MCP server and test its availability',
                labels: ['management', 'connection', 'servers']
              },
              {
                name: 'mcp_disconnect_server', 
                description: '🔌 Disconnect from an MCP server while keeping its configuration',
                labels: ['management', 'connection', 'servers']
              },
              {
                name: 'mcp_get_server_tools',
                description: '🛠️ Get all available tools from a specific MCP server with their schemas',
                labels: ['management', 'read', 'tools']
              }
            ],
            resources: [
              { 
                uri: 'mcp://config', 
                name: 'MCP System Configuration', 
                description: 'Complete Dynamic MCP system configuration including servers, connections, and global settings' 
              },
              {
                uri: 'mcp://status',
                name: 'MCP System Status',
                description: 'Real-time status of all MCP servers, connections, and system health'
              }
            ],
            prompts: [
              { 
                name: 'mcp-management-help', 
                description: '💡 Get comprehensive help and examples for managing MCP servers through chat commands' 
              }
            ]
          },
          lastConnected: null
        }
      })
      
      console.log('✅ Dynamic MCP API server created')
    }
  }

  /**
   * Transform server data for API response
   */
  private transformServerForResponse(server: MCPServer): Record<string, unknown> {
    return {
      id: server.id.toString(),
      name: server.name,
      version: server.version,
      description: server.description,
      isEnabled: server.isEnabled,
      status: server.status.toLowerCase(),
      lastConnected: server.lastConnected,
      
      transport: {
        type: server.transportType.toLowerCase().replace('_', '-'),
        config: {
          command: server.transportCommand,
          args: (server.transportArgs as string[]) || [],
          env: (server.transportEnv as Record<string, string>) || {},
          baseUrl: server.transportBaseUrl,
          timeout: server.transportTimeout,
          retryAttempts: server.transportRetryAttempts,
          sessionId: server.transportSessionId
        }
      },
      
      authentication: {
        type: server.authType.toLowerCase(),
        config: {
          clientId: server.authClientId,
          clientSecret: server.authClientSecret,
          authUrl: server.authAuthUrl,
          tokenUrl: server.authTokenUrl,
          scopes: (server.authScopes as string[]) || [],
          apiKey: server.authApiKey,
          headerName: server.authHeaderName,
          token: server.authToken
        }
      },
      
      config: {
        autoConnect: server.configAutoConnect,
        connectionTimeout: server.configConnectionTimeout,
        maxRetries: server.configMaxRetries,
        retryDelay: server.configRetryDelay,
        validateCertificates: server.configValidateCertificates,
        debug: server.configDebug
      },
      
      capabilities: server.capabilities || {
        tools: [],
        resources: [],
        prompts: []
      }
    }
  }

  async cleanup() {
    console.log('🧹 Cleaning up MCP Service...')
    await this.connectionManager.cleanup()
    await this.prisma.$disconnect()
  }
}

export default McpService
