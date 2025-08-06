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
  private fastify: FastifyInstance
  private connectionManager: McpConnectionManager

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
    this.prisma = new PrismaClient()
    this.connectionManager = new McpConnectionManager(fastify)
  }

  /**
   * Initialize the service and connection manager
   * Note: This should be called once during server startup
   */
  async initialize() {
    // The service is now user-aware, so we don't initialize connections here
    // Connections will be managed per user when they make requests
    console.log('🔌 MCP Service initialized (user-aware mode)')
  }

  /**
   * Get user settings (including MCP global settings)
   */
  private async getUserSettings(userId: number = 1) {
    const settings = await this.prisma.settings.findUnique({
      where: { userId }
    })

    if (!settings) {
      throw new Error(`User settings not found for userId ${userId}. Please ensure database is properly initialized.`)
    }

    return settings
  }

  /**
   * Update global settings (call this when settings change)
   */
  async updateGlobalSettings(userId: number) {
    const settings = await this.getUserSettings(userId)
    this.connectionManager.updateGlobalSettings({
      mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
      mcpDefaultTimeout: settings.mcpDefaultTimeout,
      mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
      mcpAutoDiscovery: settings.mcpAutoDiscovery
    })
  }

  /**
   * Ensure user's MCP connections are initialized
   * This is called the first time a user makes an MCP-related request
   */
  private async ensureUserInitialized(userId: number) {
    // Update global settings for this user
    await this.updateGlobalSettings(userId)

    // Initialize connections for this user if not already done
    // The connection manager will handle checking if already initialized
    await this.connectionManager.initialize(userId)
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

    // Update with endpoint configuration using raw SQL since Prisma types aren't updated yet
    const endpointData = serverData as any;
    if (endpointData.transportToolEndpoint || endpointData.transportHealthEndpoint || endpointData.transportToolsEndpoint || endpointData.transportResourcesEndpoint) {
      await this.prisma.$executeRaw`
        UPDATE "MCPServer" 
        SET 
          "transportToolEndpoint" = ${endpointData.transportToolEndpoint || '/call-tool'},
          "transportHealthEndpoint" = ${endpointData.transportHealthEndpoint || '/health'},
          "transportToolsEndpoint" = ${endpointData.transportToolsEndpoint || '/tools'},
          "transportResourcesEndpoint" = ${endpointData.transportResourcesEndpoint || '/resources'}
        WHERE id = ${server.id}
      `;
    }

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

    // Handle endpoint configuration updates using raw SQL since Prisma types aren't updated yet
    const hasEndpointUpdates = updateData.transportToolEndpoint !== undefined ||
      updateData.transportHealthEndpoint !== undefined ||
      updateData.transportToolsEndpoint !== undefined ||
      updateData.transportResourcesEndpoint !== undefined;

    if (hasEndpointUpdates) {
      const endpointUpdates: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updateData.transportToolEndpoint !== undefined) {
        endpointUpdates.push(`"transportToolEndpoint" = $${paramIndex}`);
        params.push(updateData.transportToolEndpoint);
        paramIndex++;
      }
      if (updateData.transportHealthEndpoint !== undefined) {
        endpointUpdates.push(`"transportHealthEndpoint" = $${paramIndex}`);
        params.push(updateData.transportHealthEndpoint);
        paramIndex++;
      }
      if (updateData.transportToolsEndpoint !== undefined) {
        endpointUpdates.push(`"transportToolsEndpoint" = $${paramIndex}`);
        params.push(updateData.transportToolsEndpoint);
        paramIndex++;
      }
      if (updateData.transportResourcesEndpoint !== undefined) {
        endpointUpdates.push(`"transportResourcesEndpoint" = $${paramIndex}`);
        params.push(updateData.transportResourcesEndpoint);
        paramIndex++;
      }

      params.push(id); // Add server ID as last parameter
      const query = `UPDATE "MCPServer" SET ${endpointUpdates.join(', ')} WHERE id = $${paramIndex}`;

      await this.prisma.$executeRawUnsafe(query, ...params);
    }

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
   * For HTTP daemon services, tests the health endpoint directly
   * For STDIO/internal servers, uses the existing connection manager approach
   */
  async testConnection(id: number, userId: number = 1) {
    const server = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!server) {
      return { success: false, message: 'MCP server not found' }
    }

    try {
      let result: { success: boolean; message: string }

      // Handle HTTP daemon services (check health endpoint directly)
      if (server.transportType === 'STREAMABLE_HTTP' && server.transportBaseUrl) {
        result = await this.testHttpDaemonHealth(server)
      }
      // Handle internal servers
      else if (server.transportCommand === 'internal') {
        result = { success: true, message: 'Internal server is always available' }
      }
      // For STDIO servers, use the existing connection manager approach
      else {
        const isConnected = this.connectionManager.isConnected(id)

        if (isConnected) {
          // Server is connected, perform a ping test
          const healthResults = await this.connectionManager.healthCheck(userId)
          const serverHealth = healthResults.find(h => h.serverId === id)

          if (serverHealth) {
            result = {
              success: serverHealth.healthy,
              message: serverHealth.healthy
                ? 'Connection test successful (ping)'
                : `Connection test failed: ${serverHealth.error || 'Ping failed'}`
            }
          } else {
            result = { success: false, message: 'Server health status not available' }
          }
        } else {
          // Server is not connected, attempt a quick connection test
          const success = await this.connectionManager.connectToServer(server)

          if (success) {
            // Optionally disconnect after successful test to avoid keeping unnecessary connections
            // await this.connectionManager.disconnectFromServer(id)
            result = {
              success: true,
              message: 'Connection test successful (connected)'
            }
          } else {
            result = {
              success: false,
              message: 'Failed to establish connection'
            }
          }
        }
      }

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed'
      return { success: false, message: errorMessage }
    }
  }

  /**
   * Test HTTP daemon health endpoint directly
   */
  private async testHttpDaemonHealth(server: any) {
    try {
      const healthUrl = `${server.transportBaseUrl}/health`
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const healthData = await response.json() as { status?: string }
        return {
          success: true,
          message: `HTTP daemon health check successful - ${healthData.status || 'healthy'}`
        }
      } else {
        return {
          success: false,
          message: `HTTP daemon health check failed - HTTP ${response.status}: ${response.statusText}`
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return {
          success: false,
          message: 'HTTP daemon health check timeout (5s)'
        }
      }
      return {
        success: false,
        message: `HTTP daemon health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Integration with LLM system

  /**
   * Get all available tools from enabled MCP servers for LLM integration (user-aware)
   */
  async getAvailableToolsForUser(userId: number): Promise<MCPToolForLLM[]> {
    await this.ensureUserInitialized(userId)
    return await this.connectionManager.getAllAvailableTools(userId)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  async getAvailableToolsForLLM(): Promise<MCPToolForLLM[]> {
    const demoUser = await this.prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    })

    if (!demoUser) {
      throw new Error('Demo user not found')
    }

    return await this.getAvailableToolsForUser(demoUser.id)
  }

  /**
   * Get all available resources from enabled MCP servers for LLM integration (user-aware)
   */
  async getAvailableResourcesForUser(userId: number): Promise<MCPResourceForLLM[]> {
    await this.ensureUserInitialized(userId)
    return await this.connectionManager.getAllAvailableResources(userId)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  async getAvailableResourcesForLLM(): Promise<MCPResourceForLLM[]> {
    const demoUser = await this.prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    })

    if (!demoUser) {
      throw new Error('Demo user not found')
    }

    return await this.getAvailableResourcesForUser(demoUser.id)
  }

  /**
   * Execute an MCP tool call from LLM (user-aware)
   */
  async executeMCPToolForUser(userId: number, toolName: string, arguments_: unknown): Promise<CallToolResult> {
    await this.ensureUserInitialized(userId)

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
      // Legacy format - find which server has this tool
      console.log(`🔍 Legacy tool call detected: ${toolName}, searching for server...`);

      const servers = await this.prisma.mCPServer.findMany({
        where: {
          isEnabled: true,
          userId: userId
        }
      });

      let foundServer = null;
      for (const server of servers) {
        const capabilities = server.capabilities as any;
        if (capabilities?.tools) {
          const hasTool = capabilities.tools.some((tool: any) => tool.name === toolName);
          if (hasTool) {
            foundServer = server;
            break;
          }
        }
      }

      if (!foundServer) {
        throw new Error(`Tool "${toolName}" not found in any enabled MCP server`);
      }

      serverName = foundServer.name;
      originalToolName = toolName;
      console.log(`✅ Found tool "${toolName}" in server "${serverName}"`);
    }

    // Find the server by name
    const server = await this.prisma.mCPServer.findFirst({
      where: {
        name: serverName,
        isEnabled: true,
        userId: userId
      }
    })

    if (!server) {
      throw new Error(`MCP server "${serverName}" not found or not enabled`)
    }

    // All tools now go through the connection manager
    return await this.connectionManager.callTool(userId, server.id, originalToolName, arguments_)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  async executeMCPTool(toolName: string, arguments_: unknown): Promise<CallToolResult> {
    const demoUser = await this.prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    })

    if (!demoUser) {
      throw new Error('Demo user not found')
    }

    return await this.executeMCPToolForUser(demoUser.id, toolName, arguments_)
  }

  /**
   * Read an MCP resource for LLM (user-aware)
   */
  async readMCPResourceForUser(userId: number, serverId: number, uri: string): Promise<ReadResourceResult> {
    await this.ensureUserInitialized(userId)
    return await this.connectionManager.readResource(userId, serverId, uri)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  async readMCPResource(serverId: number, uri: string): Promise<ReadResourceResult> {
    const demoUser = await this.prisma.user.findUnique({
      where: { email: 'demo@example.com' }
    })

    if (!demoUser) {
      throw new Error('Demo user not found')
    }

    return await this.readMCPResourceForUser(demoUser.id, serverId, uri)
  }

  // Utility methods

  /**
   * Get connection status for all servers (user-aware)
   */
  getConnectionStatusForUser(userId: number): MCPConnectionInfo[] {
    return this.connectionManager.getConnectionStatus(userId)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  getConnectionStatus(): MCPConnectionInfo[] {
    // For legacy compatibility, return status for demo user or empty array
    try {
      return this.connectionManager.getConnectionStatus(1) // Fallback to userId 1 for legacy compatibility
    } catch {
      return []
    }
  }

  /**
   * Health check for all connections (user-aware)
   */
  async healthCheckForUser(userId: number): Promise<MCPHealthCheckResult[]> {
    await this.ensureUserInitialized(userId)
    return await this.connectionManager.healthCheck(userId)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  async healthCheck(): Promise<MCPHealthCheckResult[]> {
    try {
      return await this.connectionManager.healthCheck(1) // Fallback to userId 1 for legacy compatibility
    } catch {
      return []
    }
  }

  /**
   * Refresh all connections (user-aware)
   */
  async refreshConnectionsForUser(userId: number) {
    await this.ensureUserInitialized(userId)
    await this.connectionManager.refreshConnections(userId)
  }

  /**
   * Legacy method for backwards compatibility (uses demo user)
   */
  async refreshConnections() {
    try {
      await this.connectionManager.refreshConnections(1) // Fallback to userId 1 for legacy compatibility
    } catch (error) {
      console.error('Error refreshing connections for legacy call:', error)
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
      status: server.status, // Keep status in uppercase to match schema
      lastConnected: server.lastConnected,

      transport: {
        type: server.transportType, // Keep transport type in uppercase to match schema
        config: {
          command: server.transportCommand,
          args: (server.transportArgs as string[]) || [],
          env: (server.transportEnv as Record<string, string>) || {},
          baseUrl: server.transportBaseUrl,
          toolEndpoint: (server as any).transportToolEndpoint,
          healthEndpoint: (server as any).transportHealthEndpoint,
          toolsEndpoint: (server as any).transportToolsEndpoint,
          resourcesEndpoint: (server as any).transportResourcesEndpoint,
          timeout: server.transportTimeout,
          retryAttempts: server.transportRetryAttempts,
          sessionId: server.transportSessionId
        }
      },

      authentication: {
        type: server.authType, // Keep auth type in uppercase to match schema
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
