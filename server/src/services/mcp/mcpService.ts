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
   * Initialize the MCP service
   */
  async initialize() {
    console.log('🚀 Initializing MCP Service...')
    
    // Ensure default server exists in database
    await this.ensureDefaultServer()
    
    // Initialize connection manager
    await this.connectionManager.initialize()
    
    console.log('✅ MCP Service initialized successfully')
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
   */
  async testConnection(id: number, userId: number = 1) {
    const server = await this.prisma.mCPServer.findFirst({
      where: { id, userId }
    })

    if (!server) {
      return { success: false, message: 'MCP server not found' }
    }

    try {
      const success = await this.connectionManager.connectToServer(server)
      return { 
        success, 
        message: success ? 'Connection successful' : 'Connection failed' 
      }
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
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
    // Also handle legacy format for internal tools
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
      // Handle legacy internal tool names without prefix
      serverName = 'dynamic-mcp-api';
      originalToolName = toolName;
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

    // If this is an internal server, handle it directly
    if (server.transportCommand === 'internal') {
      return await this.executeInternalTool(originalToolName, arguments_)
    }

    // Execute the tool
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
   * Ensure the default server exists in the database
   */
  private async ensureDefaultServer() {
    const existingDefault = await this.prisma.mCPServer.findFirst({
      where: { 
        name: 'dynamic-mcp-api',
        userId: 1
      }
    })

    if (!existingDefault) {
      console.log('🔧 Creating default MCP server entry...')
      
      await this.prisma.mCPServer.create({
        data: {
          userId: 1,
          name: 'dynamic-mcp-api',
          version: '1.0.0',
          description: 'Internal MCP server for managing the Dynamic MCP system via chat',
          isEnabled: true,
          status: 'CONNECTED',
          transportType: 'STDIO',
          transportCommand: 'internal',
          authType: 'NONE',
          configAutoConnect: false, // Don't auto-connect the internal server
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
          lastConnected: new Date()
        }
      })
      
      console.log('✅ Default MCP server created')
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

  /**
   * Cleanup resources
   */
  /**
   * Execute internal MCP management tools
   */
  private async executeInternalTool(toolName: string, arguments_: unknown): Promise<CallToolResult> {
    const args = arguments_ as Record<string, any> || {};
    
    try {
      switch (toolName) {
        // Unified internal tool name
        case 'mcp_list_servers':
        // Legacy alias kept for backward compatibility
        case 'list_mcp_servers':
          return await this.handleListServers();
          
        case 'mcp_create_server':
          return await this.handleCreateServer(args);
          
        case 'mcp_update_server':
          return await this.handleUpdateServer(args);
          
        case 'mcp_delete_server':
          return await this.handleDeleteServer(args);
          
        case 'mcp_toggle_server':
          return await this.handleToggleServer(args);
          
        case 'mcp_connect_server':
          return await this.handleConnectServer(args);
          
        case 'mcp_disconnect_server':
          return await this.handleDisconnectServer(args);
          
        case 'mcp_get_server_tools':
          return await this.handleGetServerTools(args);
          
        case 'list_mcp_servers':
          return await this.handleListServers();
          
        default:
          throw new Error(`Unknown internal tool: ${toolName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        stdout: '',
        stderr: `Error executing ${toolName}: ${errorMessage}`,
        success: false,
        error: errorMessage
      };
    }
  }

  private async handleListServers(): Promise<CallToolResult> {
    const servers = await this.getServers();
    const serverList = servers.map((server: any) => ({
      id: server.id,
      name: server.name,
      description: server.description,
      status: server.status,
      isEnabled: server.isEnabled,
      transportType: server.transportType,
      lastConnected: server.lastConnected,
      capabilities: server.capabilities
    }));

    return {
      stdout: JSON.stringify({
        success: true,
        servers: serverList,
        total: serverList.length
      }, null, 2),
      stderr: '',
      success: true
    };
  }

  private async handleCreateServer(args: Record<string, any>): Promise<CallToolResult> {
    const required = ['name', 'transportType', 'transportCommand'];
    for (const field of required) {
      if (!args[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    const server = await this.prisma.mCPServer.create({
      data: {
        userId: args.userId || 1,
        name: args.name,
        version: args.version || '1.0.0',
        description: args.description || '',
        isEnabled: args.isEnabled ?? true,
        status: 'DISCONNECTED',
        transportType: args.transportType,
        transportCommand: args.transportCommand,
        transportArgs: args.transportArgs || [],
        transportEnv: args.transportEnv || {},
        authType: args.authType || 'NONE',
        configAutoConnect: args.configAutoConnect ?? true,
        configConnectionTimeout: args.configConnectionTimeout || 10000,
        configMaxRetries: args.configMaxRetries || 3,
        configRetryDelay: args.configRetryDelay || 2000,
        configValidateCertificates: args.configValidateCertificates ?? true,
        configDebug: args.configDebug ?? false,
        capabilities: args.capabilities || { tools: [], resources: [], prompts: [] }
      }
    });

    return {
      stdout: JSON.stringify({
        success: true,
        message: `MCP server '${server.name}' created successfully`,
        server: {
          id: server.id,
          name: server.name,
          status: server.status,
          isEnabled: server.isEnabled
        }
      }, null, 2),
      stderr: '',
      success: true
    };
  }

  private async handleUpdateServer(args: Record<string, any>): Promise<CallToolResult> {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    let whereClause: any;
    if (args.id) {
      whereClause = { id: Number(args.id) };
    } else {
      whereClause = { name: String(args.name) };
    }
    
    const updateData: any = {};

    // Build update data from provided args
    const updateableFields = [
      'name', 'version', 'description', 'isEnabled', 'transportType', 
      'transportCommand', 'transportArgs', 'transportEnv', 'authType',
      'configAutoConnect', 'configConnectionTimeout', 'configMaxRetries',
      'configRetryDelay', 'configValidateCertificates', 'configDebug', 'capabilities'
    ];

    for (const field of updateableFields) {
      if (args[field] !== undefined) {
        updateData[field] = args[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No update fields provided');
    }

    const server = await this.prisma.mCPServer.update({
      where: whereClause,
      data: updateData
    });

    return {
      stdout: JSON.stringify({
        success: true,
        message: `MCP server '${server.name}' updated successfully`,
        server: {
          id: server.id,
          name: server.name,
          status: server.status,
          isEnabled: server.isEnabled
        }
      }, null, 2),
      stderr: '',
      success: true
    };
  }

  private async handleDeleteServer(args: Record<string, any>): Promise<CallToolResult> {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    const whereClause = args.id ? { id: Number(args.id) } : { name: String(args.name) };
    
    // Check if server exists and get its name
    const server = await this.prisma.mCPServer.findFirst({ where: whereClause });
    if (!server) {
      throw new Error('Server not found');
    }

    // Don't allow deletion of the internal server
    if (server.transportCommand === 'internal') {
      throw new Error('Cannot delete the internal MCP management server');
    }

    await this.prisma.mCPServer.delete({ where: { id: server.id } });

    return {
      stdout: JSON.stringify({
        success: true,
        message: `MCP server '${server.name}' deleted successfully`
      }, null, 2),
      stderr: '',
      success: true
    };
  }

  private async handleToggleServer(args: Record<string, any>): Promise<CallToolResult> {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    let whereClause: any;
    if (args.id) {
      whereClause = { id: Number(args.id) };
    } else {
      whereClause = { name: String(args.name) };
    }
    
    const enabled = args.enabled;

    if (typeof enabled !== 'boolean') {
      throw new Error('enabled field must be a boolean value');
    }

    const server = await this.prisma.mCPServer.update({
      where: whereClause,
      data: { isEnabled: enabled }
    });

    return {
      stdout: JSON.stringify({
        success: true,
        message: `MCP server '${server.name}' ${enabled ? 'enabled' : 'disabled'} successfully`,
        server: {
          id: server.id,
          name: server.name,
          isEnabled: server.isEnabled
        }
      }, null, 2),
      stderr: '',
      success: true
    };
  }

  private async handleConnectServer(args: Record<string, any>): Promise<CallToolResult> {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    const whereClause = args.id ? { id: Number(args.id) } : { name: String(args.name) };
    const server = await this.prisma.mCPServer.findFirst({ where: whereClause });
    
    if (!server) {
      throw new Error('Server not found');
    }

    const connectionResult = await this.connectionManager.connectToServer(server);
    const result = {
      success: connectionResult !== null,
      message: connectionResult ? 'Connected successfully' : 'Connection failed'
    };

    return {
      stdout: JSON.stringify({
        success: result.success,
        message: result.success ? 
          `Successfully connected to MCP server '${server.name}'` :
          `Failed to connect to MCP server '${server.name}': ${result.message}`,
        server: {
          id: server.id,
          name: server.name,
          connected: result.success
        }
      }, null, 2),
      stderr: result.success ? '' : result.message || '',
      success: result.success
    };
  }

  private async handleDisconnectServer(args: Record<string, any>): Promise<CallToolResult> {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    const whereClause = args.id ? { id: Number(args.id) } : { name: String(args.name) };
    const server = await this.prisma.mCPServer.findFirst({ where: whereClause });
    
    if (!server) {
      throw new Error('Server not found');
    }

    await this.connectionManager.disconnectFromServer(server.id);
    const result = {
      success: true,
      message: 'Disconnected successfully'
    };

    return {
      stdout: JSON.stringify({
        success: result.success,
        message: result.success ? 
          `Successfully disconnected from MCP server '${server.name}'` :
          `Failed to disconnect from MCP server '${server.name}': ${result.message}`,
        server: {
          id: server.id,
          name: server.name,
          connected: false
        }
      }, null, 2),
      stderr: result.success ? '' : result.message || '',
      success: result.success
    };
  }

  private async handleGetServerTools(args: Record<string, any>): Promise<CallToolResult> {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    const whereClause = args.id ? { id: Number(args.id) } : { name: String(args.name) };
    const server = await this.prisma.mCPServer.findFirst({ where: whereClause });
    
    if (!server) {
      throw new Error('Server not found');
    }

    // Get tools from the server's capabilities or connection manager
    const capabilities = server.capabilities as any;
    const tools = capabilities?.tools || [];

    return {
      stdout: JSON.stringify({
        success: true,
        server: {
          id: server.id,
          name: server.name
        },
        tools: tools,
        totalTools: tools.length
      }, null, 2),
      stderr: '',
      success: true
    };
  }

  async cleanup() {
    console.log('🧹 Cleaning up MCP Service...')
    await this.connectionManager.cleanup()
    await this.prisma.$disconnect()
  }
}

export default McpService
