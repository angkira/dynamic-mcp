import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { PrismaClient } from '@prisma/client'
import type { MCPServer, MCPServerStatus } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { 
  MCPCapabilities, 
  MCPToolForLLM, 
  MCPResourceForLLM, 
  MCPConnectionInfo,
  MCPHealthCheckResult,
  MCPServerStatusUpdateData,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult
} from '../../types/mcp.types'


/**
 * MCP Connection Manager
 * 
 * Manages connections to multiple MCP servers, handles discovery, and provides
 * a unified interface for interacting with all connected MCP servers.
 */
export class McpConnectionManager {
  private connections: Map<number, {
    client: Client,
    server: MCPServer,
    lastConnected: Date
  }> = new Map()
  
  private prisma: PrismaClient
  private globalSettings: {
    mcpEnableDebugLogging: boolean
    mcpDefaultTimeout: number
    mcpMaxConcurrentConnections: number
    mcpAutoDiscovery: boolean
  } | null = null

  constructor(_fastify?: FastifyInstance) {
    this.prisma = new PrismaClient()
  }

  /**
   * Update global MCP settings
   */
  updateGlobalSettings(settings: {
    mcpEnableDebugLogging: boolean
    mcpDefaultTimeout: number
    mcpMaxConcurrentConnections: number
    mcpAutoDiscovery: boolean
  }) {
    this.globalSettings = settings
    
    if (settings.mcpEnableDebugLogging) {
      console.log('🔧 MCP Debug logging enabled')
    }
    
    console.log(`🔧 MCP Settings updated:`, {
      debugLogging: settings.mcpEnableDebugLogging,
      defaultTimeout: settings.mcpDefaultTimeout,
      maxConnections: settings.mcpMaxConcurrentConnections,
      autoDiscovery: settings.mcpAutoDiscovery
    })
  }

  /**
   * Initialize the connection manager and auto-connect to enabled servers
   */
  async initialize() {
    console.log('🔌 Initializing MCP Connection Manager...')
    
    // Get all enabled servers
    const enabledServers = await this.prisma.mCPServer.findMany({
      where: { 
        isEnabled: true,
        userId: 1 // TODO: Support multiple users
      }
    })

    console.log(`📡 Found ${enabledServers.length} enabled MCP servers`)

    // Connect to servers with autoConnect enabled
    const autoConnectServers = enabledServers.filter(s => s.configAutoConnect)
    
    for (const server of autoConnectServers) {
      try {
        await this.connectToServer(server)
        console.log(`✅ Auto-connected to MCP server: ${server.name}`)
      } catch (error) {
        console.error(`❌ Failed to auto-connect to ${server.name}:`, error)
        await this.updateServerStatus(server.id, 'ERROR')
      }
    }
  }

  /**
   * Connect to a specific MCP server
   */
  async connectToServer(server: MCPServer): Promise<boolean> {
    try {
      // Check max concurrent connections limit
      if (this.globalSettings && this.connections.size >= this.globalSettings.mcpMaxConcurrentConnections) {
        console.warn(`⚠️ Maximum concurrent connections (${this.globalSettings.mcpMaxConcurrentConnections}) reached. Cannot connect to ${server.name}`)
        return false
      }

      console.log(`🔌 Connecting to MCP server: ${server.name} (${server.transportType})`)
      
      // Skip connection for internal server
      if (server.transportCommand === 'internal') {
        console.log(`⚡ Internal server ${server.name} - marking as connected`)
        await this.updateServerStatus(server.id, 'CONNECTED')
        return true
      }
      
      // Update status to connecting
      await this.updateServerStatus(server.id, 'CONNECTING')

      // Create client
      const client = new Client({
        name: "dynamic-mcp-client",
        version: "1.0.0"
      })

      // Create transport based on server configuration
      let transport: Transport
      
      switch (server.transportType) {
        case 'STDIO':
          if (!server.transportCommand) {
            throw new Error('STDIO transport requires a command')
          }
          transport = new StdioClientTransport({
            command: server.transportCommand,
            args: (server.transportArgs as string[]) || [],
            env: (server.transportEnv as Record<string, string>) || {}
          })
          break
          
        case 'STREAMABLE_HTTP':
          if (!server.transportBaseUrl) {
            throw new Error('Streamable HTTP transport requires a base URL')
          }
          transport = new StreamableHTTPClientTransport(
            new URL(server.transportBaseUrl)
          ) as Transport
          break
          
        default:
          throw new Error(`Unsupported transport type: ${server.transportType}`)
      }

      // Connect with timeout
      const connectPromise = client.connect(transport)
      const timeoutPromise = new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), server.configConnectionTimeout)
      )

      await Promise.race([connectPromise, timeoutPromise])

      // Test the connection by listing capabilities
      const tools = await client.listTools() as any;
      const resources = await client.listResources() as any;
      const prompts = await client.listPrompts() as any;

      // Update server capabilities in database
      await this.updateServerCapabilities(server.id, {
        tools: tools.tools || [],
        resources: resources.resources || [],
        prompts: prompts.prompts || []
      })

      // Store the connection
      this.connections.set(server.id, {
        client,
        server,
        lastConnected: new Date()
      })

      // Update status to connected
      await this.updateServerStatus(server.id, 'CONNECTED')

      console.log(`✅ Successfully connected to ${server.name}`)
      return true

    } catch (error) {
      console.error(`❌ Failed to connect to ${server.name}:`, error)
      await this.updateServerStatus(server.id, 'ERROR')
      return false
    }
  }

  /**
   * Check if a server is currently connected
   */
  isConnected(serverId: number): boolean {
    return this.connections.has(serverId)
  }

  /**
   * Disconnect from a specific MCP server
   */
  async disconnectFromServer(serverId: number): Promise<boolean> {
    try {
      const connection = this.connections.get(serverId)
      if (!connection) {
        return false
      }

      // Close the client connection
      await connection.client.close()
      
      // Remove from connections map
      this.connections.delete(serverId)
      
      // Update status
      await this.updateServerStatus(serverId, 'DISCONNECTED')
      
      console.log(`🔌 Disconnected from MCP server: ${connection.server.name}`)
      return true

    } catch (error) {
      console.error(`❌ Error disconnecting from server ${serverId}:`, error)
      return false
    }
  }

  /**
   * Get all available tools from connected MCP servers
   */
  async getAllAvailableTools(): Promise<MCPToolForLLM[]> {
    const allTools: MCPToolForLLM[] = []
    
    // Check if internal server tools should be included
    const internalServer = await this.prisma.mCPServer.findFirst({
      where: { 
        name: 'dynamic-mcp-api',
        isEnabled: true
      }
    })
    
    if (internalServer) {
      // Add internal server tools
      const internalTools: MCPToolForLLM[] = [
        {
          name: `${internalServer.name}__mcp_list_servers`,
          description: '📋 List all registered MCP servers with their connection status, capabilities, and configuration details',
          parameters: { userId: { type: 'number', optional: true } },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_list_servers'
          }
        },
        {
          name: `${internalServer.name}__mcp_create_server`,
          description: '➕ Register a new MCP server with connection configuration and capabilities',
          parameters: {
            name: { type: 'string' },
            version: { type: 'string', optional: true },
            description: { type: 'string', optional: true },
            transportType: { type: 'string', enum: ['STDIO', 'SSE', 'STREAMABLE_HTTP'] },
            transportCommand: { type: 'string' },
            transportArgs: { type: 'array', items: { type: 'string' }, optional: true },
            transportBaseUrl: { type: 'string', optional: true },
            authType: { type: 'string', enum: ['NONE', 'OAUTH', 'APIKEY', 'BEARER'], optional: true },
            authApiKey: { type: 'string', optional: true },
            isEnabled: { type: 'boolean', optional: true },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_create_server'
          }
        },
        {
          name: `${internalServer.name}__mcp_update_server`,
          description: '✏️ Update an existing MCP server configuration, connection settings, or capabilities',
          parameters: {
            id: { type: 'number', optional: true },
            name: { type: 'string', optional: true },
            version: { type: 'string', optional: true },
            description: { type: 'string', optional: true },
            isEnabled: { type: 'boolean', optional: true },
            transportCommand: { type: 'string', optional: true },
            transportArgs: { type: 'array', items: { type: 'string' }, optional: true },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_update_server'
          }
        },
        {
          name: `${internalServer.name}__mcp_delete_server`,
          description: '🗑️ Permanently remove an MCP server and all its associated data',
          parameters: {
            id: { type: 'number', optional: true },
            name: { type: 'string', optional: true },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_delete_server'
          }
        },
        {
          name: `${internalServer.name}__mcp_toggle_server`,
          description: '🔄 Enable or disable an MCP server to control its availability for tool calls',
          parameters: {
            id: { type: 'number', optional: true },
            name: { type: 'string', optional: true },
            enabled: { type: 'boolean' },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_toggle_server'
          }
        },
        {
          name: `${internalServer.name}__mcp_connect_server`,
          description: '🔌 Establish connection to an MCP server and test its availability',
          parameters: {
            id: { type: 'number', optional: true },
            name: { type: 'string', optional: true },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_connect_server'
          }
        },
        {
          name: `${internalServer.name}__mcp_disconnect_server`,
          description: '🔌 Disconnect from an MCP server while keeping its configuration',
          parameters: {
            id: { type: 'number', optional: true },
            name: { type: 'string', optional: true },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_disconnect_server'
          }
        },
        {
          name: `${internalServer.name}__mcp_get_server_tools`,
          description: '🛠️ Get all available tools from a specific MCP server with their schemas',
          parameters: {
            id: { type: 'number', optional: true },
            name: { type: 'string', optional: true },
            userId: { type: 'number', optional: true }
          },
          metadata: {
            serverId: internalServer.id,
            serverName: internalServer.name,
            originalName: 'mcp_get_server_tools'
          }
        }
      ]
      allTools.push(...internalTools)
    }
    
    // Add tools from connected external servers
    for (const [serverId, connection] of this.connections) {
      try {
        const tools = await connection.client.listTools() as any;
        
        for (const tool of tools.tools || []) {
          allTools.push({
            name: `${connection.server.name}__${tool.name}`,
            description: tool.description || '',
            parameters: tool.inputSchema,
            metadata: {
              serverId,
              serverName: connection.server.name,
              originalName: tool.name
            }
          })
        }
      } catch (error) {
        console.error(`Error getting tools from server ${serverId}:`, error)
      }
    }
    
    return allTools
  }

  /**
   * Get all available resources from connected MCP servers
   */
  async getAllAvailableResources(): Promise<MCPResourceForLLM[]> {
    const allResources: MCPResourceForLLM[] = []
    
    // Check if internal server resources should be included
    const internalServer = await this.prisma.mCPServer.findFirst({
      where: { 
        name: 'dynamic-mcp-api',
        isEnabled: true
      }
    })
    
    if (internalServer) {
      // Add internal server resources
      allResources.push({
        uri: 'mcp://config',
        name: 'MCP Configuration',
        description: 'Current MCP system configuration',
        mimeType: 'application/json',
        serverName: internalServer.name,
        serverId: internalServer.id
      })
    }
    
    // Add resources from connected external servers
    for (const [serverId, connection] of this.connections) {
      try {
        const resources = await connection.client.listResources() as any;
        
        for (const resource of resources.resources || []) {
          allResources.push({
            serverId,
            serverName: connection.server.name,
            uri: resource.uri,
            name: resource.name || undefined,
            description: resource.description || undefined,
            mimeType: resource.mimeType || undefined
          })
        }
      } catch (error) {
        console.error(`Error getting resources from server ${serverId}:`, error)
      }
    }
    
    return allResources
  }

  /**
   * Call a tool on a specific MCP server
   */
  async callTool(serverId: number, toolName: string, arguments_: unknown): Promise<CallToolResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`No connection to server ${serverId}`)
    }

    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: arguments_ as Record<string, unknown>
      })
      
      return result as CallToolResult
    } catch (error) {
      console.error(`Error calling tool ${toolName} on server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Read a resource from a specific MCP server
   */
  async readResource(serverId: number, uri: string): Promise<ReadResourceResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`No connection to server ${serverId}`)
    }

    try {
      const result = await connection.client.readResource({ uri })
      return result as any;
    } catch (error) {
      console.error(`Error reading resource ${uri} from server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Get a prompt from a specific MCP server
   */
  async getPrompt(serverId: number, promptName: string, arguments_?: unknown): Promise<GetPromptResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`No connection to server ${serverId}`)
    }

    try {
      const result = await connection.client.getPrompt({
        name: promptName,
        arguments: arguments_ as Record<string, string>
      })
      
      return result as any;
    } catch (error) {
      console.error(`Error getting prompt ${promptName} from server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): MCPConnectionInfo[] {
    const status: MCPConnectionInfo[] = []
    
    for (const [serverId, connection] of this.connections) {
      status.push({
        serverId,
        serverName: connection.server.name,
        isConnected: true,
        lastConnected: connection.lastConnected
      })
    }
    
    return status
  }

  /**
   * Update server status in database
   */
  private async updateServerStatus(serverId: number, status: MCPServerStatus) {
    try {
      const updateData: MCPServerStatusUpdateData = { status }
      if (status === 'CONNECTED') {
        updateData.lastConnected = new Date()
      }
      
      await this.prisma.mCPServer.update({
        where: { id: serverId },
        data: updateData
      })
    } catch (error) {
      console.error(`Error updating server status for ${serverId}:`, error)
    }
  }

  /**
   * Update server capabilities in database
   */
  private async updateServerCapabilities(serverId: number, capabilities: MCPCapabilities) {
    try {
      await this.prisma.mCPServer.update({
        where: { id: serverId },
        data: { capabilities: capabilities as any }
      })
    } catch (error) {
      console.error(`Error updating server capabilities for ${serverId}:`, error)
    }
  }

  /**
   * Cleanup all connections
   */
  async cleanup() {
    console.log('🧹 Cleaning up MCP connections...')
    
    for (const [serverId, connection] of this.connections) {
      try {
        await connection.client.close()
        console.log(`🔌 Closed connection to ${connection.server.name}`)
      } catch (error) {
        console.error(`Error closing connection to server ${serverId}:`, error)
      }
    }
    
    this.connections.clear()
    await this.prisma.$disconnect()
  }

  /**
   * Refresh connections - reconnect to all enabled servers
   */
  async refreshConnections() {
    console.log('🔄 Refreshing MCP connections...')
    
    // Close existing connections
    for (const [serverId] of this.connections) {
      await this.disconnectFromServer(serverId)
    }
    
    // Reinitialize
    await this.initialize()
  }

  /**
   * Health check for all connections
   */
  async healthCheck(): Promise<MCPHealthCheckResult[]> {
    const results: MCPHealthCheckResult[] = []
    
    for (const [serverId, connection] of this.connections) {
      try {
        // Test connection by making a simple call
        await connection.client.ping()
        results.push({
          serverId,
          serverName: connection.server.name,
          healthy: true
        })
      } catch (error) {
        results.push({
          serverId,
          serverName: connection.server.name,
          healthy: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        
        // Update status to error
        await this.updateServerStatus(serverId, 'ERROR')
      }
    }
    
    return results
  }
}

export default McpConnectionManager
