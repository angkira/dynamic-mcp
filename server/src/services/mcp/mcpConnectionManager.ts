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
import InternalMCPConfigLoader from './internalMCPConfigLoader'


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
   * Check if an HTTP daemon server is healthy and reachable
   */
  private async checkHttpDaemonHealth(server: MCPServer, timeoutMs: number = 5000): Promise<boolean> {
    if (server.transportType !== 'STREAMABLE_HTTP' || !server.transportBaseUrl) {
      return false
    }

    try {
      const healthUrl = `${server.transportBaseUrl}/health`
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Type': 'application/json' }
      })

      return response.ok
    } catch (error) {
      return false
    }
  }

  /**
   * Verify server connectivity based on transport type
   */
  private async verifyServerConnectivity(server: MCPServer, timeoutMs: number = 2000): Promise<boolean> {
    // For HTTP daemon servers, check health endpoint
    if (server.transportType === 'STREAMABLE_HTTP' && server.transportBaseUrl) {
      return await this.checkHttpDaemonHealth(server, timeoutMs)
    }
    
    // For STDIO servers, verify connection exists in our connections map
    if (server.transportType === 'STDIO') {
      return this.connections.has(server.id)
    }
    
    // For internal servers, assume they're always available
    if (server.transportCommand === 'internal') {
      return true
    }
    
    return false
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
  async initialize(userId: number = 1) {
    console.log('🔌 Initializing MCP Connection Manager...')
    
    // Get all enabled servers for this user
    const enabledServers = await this.prisma.mCPServer.findMany({
      where: { 
        isEnabled: true,
        userId: userId
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

      // For HTTP daemon services, just check health endpoint instead of creating MCP client connection
      if (server.transportType === 'STREAMABLE_HTTP' && server.transportBaseUrl) {
        console.log(`🔌 Testing HTTP daemon health: ${server.name} at ${server.transportBaseUrl}`)
        
        const isHealthy = await this.checkHttpDaemonHealth(server, 5000)
        if (isHealthy) {
          console.log(`✅ HTTP daemon ${server.name} is healthy`)
          await this.updateServerStatus(server.id, 'CONNECTED')
          return true
        } else {
          console.error(`❌ HTTP daemon ${server.name} health check failed`)
          await this.updateServerStatus(server.id, 'ERROR')
          return false
        }
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
  async getAllAvailableTools(userId: number = 1): Promise<MCPToolForLLM[]> {
    const allTools: MCPToolForLLM[] = []
    
    // Get enabled AND connected servers from database for this user
    const enabledServers = await this.prisma.mCPServer.findMany({
      where: { 
        isEnabled: true,
        status: 'CONNECTED',  // Only include connected servers
        userId: userId
      }
    })
    
    for (const server of enabledServers) {
      try {
        // Verify server is actually reachable before including its tools
        const isConnected = await this.verifyServerConnectivity(server, 2000)
        if (!isConnected) {
          console.warn(`⚠️ Server ${server.name} (${server.transportType}) is not reachable, skipping tools`)
          continue
        }
        
        // Get tools from server capabilities stored in database
        const capabilities = server.capabilities as any
        const tools = capabilities?.tools || []
        
        // Convert each tool to the LLM format
        for (const tool of tools) {
          allTools.push({
            name: `${server.name}__${tool.name}`,
            description: tool.description || '',
            parameters: tool.inputSchema || tool.parameters || {},
            metadata: {
              serverId: server.id,
              serverName: server.name,
              originalName: tool.name,
              transportType: server.transportType,
              transportCommand: server.transportCommand || undefined
            }
          })
        }
        
        console.log(`📋 Loaded ${tools.length} tools from connected ${server.name} (${server.transportCommand})`)
      } catch (error) {
        console.error(`❌ Error getting tools from server ${server.name}:`, error)
      }
    }
    
    console.log(`🔧 Total tools available for LLM: ${allTools.length} from ${enabledServers.length} connected servers`)
    return allTools
  }

  /**
   * Get all available resources from connected MCP servers
   */
  async getAllAvailableResources(): Promise<MCPResourceForLLM[]> {
    const allResources: MCPResourceForLLM[] = []
    
    // Get enabled AND connected internal servers that have resources
    const internalServers = await this.prisma.mCPServer.findMany({
      where: { 
        name: { in: ['dynamic-mcp-api', 'memory'] },
        isEnabled: true,
        status: 'CONNECTED',  // Only include connected servers
        transportCommand: 'internal'
      }
    })
    
    for (const internalServer of internalServers) {
      try {
        // Verify internal server connectivity
        const isConnected = await this.verifyServerConnectivity(internalServer)
        if (!isConnected) {
          console.warn(`⚠️ Internal server ${internalServer.name} is not available, skipping resources`)
          continue
        }
        
        // Load internal resources from JSON configuration
        const configLoader = InternalMCPConfigLoader.getInstance()
        const internalResourceConfigs = await configLoader.getResourcesForServer(internalServer.name)
        
        for (const resourceConfig of internalResourceConfigs) {
          allResources.push({
            uri: resourceConfig.uri,
            name: resourceConfig.name,
            description: resourceConfig.description,
            mimeType: resourceConfig.mimeType,
            serverName: internalServer.name,
            serverId: internalServer.id
          })
        }
        
        console.log(`📋 Loaded ${internalResourceConfigs.length} resources from connected internal server ${internalServer.name}`)
      } catch (error) {
        console.error(`❌ Error loading resources from internal server ${internalServer.name}:`, error)
      }
    }
    
    // Add resources from connected external servers (only those with active connections)
    for (const [serverId, connection] of this.connections) {
      try {
        // Verify server is still enabled and connected
        const server = await this.prisma.mCPServer.findUnique({
          where: { id: serverId }
        })
        
        if (!server?.isEnabled || server.status !== 'CONNECTED') {
          console.warn(`⚠️ Server ${serverId} (${connection.server.name}) is no longer enabled or connected, skipping resources`)
          continue
        }
        
        // Double-check connectivity using our verification method
        const isConnected = await this.verifyServerConnectivity(server)
        if (!isConnected) {
          console.warn(`⚠️ Server ${connection.server.name} connectivity verification failed, skipping resources`)
          continue
        }
        
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
        
        console.log(`📋 Loaded ${resources.resources?.length || 0} resources from connected external server ${connection.server.name}`)
      } catch (error) {
        console.error(`Error getting resources from server ${serverId}:`, error)
      }
    }
    
    console.log(`🔧 Total resources available for LLM: ${allResources.length} from connected servers`)
    return allResources
  }

  /**
   * Call a tool on a specific MCP server
   */
  async callTool(serverId: number, toolName: string, arguments_: unknown): Promise<CallToolResult> {
    // Helper for error result
    function errorResult(params: {
      error: string;
      toolName: string;
      arguments: unknown;
      stdout?: string;
      stderr?: string;
      daemonResponse?: unknown;
      stack?: string;
    }): CallToolResult {
      return {
        success: false,
        error: params.error,
        toolName: params.toolName,
        arguments: params.arguments,
        stdout: params.stdout ?? '',
        stderr: params.stderr ?? params.error,
        daemonResponse: params.daemonResponse,
        stack: params.stack
      };
    }

    // First check if this is an HTTP daemon server
    const server = await this.prisma.mCPServer.findUnique({
      where: { id: serverId }
    });

    if (!server) {
      throw new Error(`Server ${serverId} not found`);
    }

    // Handle HTTP daemon servers
    if (server.transportType === 'STREAMABLE_HTTP' && server.transportBaseUrl) {
      const toolUrl = `${server.transportBaseUrl}/call-tool`;
      const payload = {
        name: toolName,
        arguments: (arguments_ as Record<string, unknown>) || {}
      };
      try {
        if (this.globalSettings?.mcpEnableDebugLogging) {
          console.log(`[MCP] HTTP Tool Call Request`, { serverId, toolName, payload });
        }
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json' 
        };
        
        // Add JWT token if available
        if (server.authToken) {
          headers['Authorization'] = `Bearer ${server.authToken}`;
        }
        
        const response = await fetch(toolUrl, {
          method: 'POST',
          headers,
          signal: AbortSignal.timeout(30000),
          body: JSON.stringify(payload)
        });

        let result: unknown;
        try {
          result = await response.json();
        } catch (jsonErr) {
          const rawText = await response.text();
          console.error(`[MCP] HTTP Tool Call Response not JSON`, { serverId, toolName, rawText });
          return errorResult({
            error: `Daemon returned non-JSON response: ${rawText}`,
            toolName,
            arguments: payload.arguments,
            stdout: '',
            stderr: rawText
          });
        }

        if (this.globalSettings?.mcpEnableDebugLogging) {
          console.log(`[MCP] HTTP Tool Call Response`, { serverId, toolName, result });
        }

        // Type guard for daemon error
        if (!response.ok || (typeof result === 'object' && result !== null && 'error' in result)) {
          const errorMsg = typeof result === 'object' && result !== null && 'error' in result ? (result as { error: string }).error : `${response.status} ${response.statusText}`;
          console.error(`[MCP] Tool call failed`, { toolName, errorMsg, daemonResponse: result });
          return errorResult({
            error: errorMsg,
            toolName,
            arguments: payload.arguments,
            stdout: '',
            stderr: errorMsg,
            daemonResponse: result
          });
        }

        // Validate result structure
        if (!result || typeof result !== 'object') {
          return errorResult({
            error: 'Daemon returned invalid response',
            toolName,
            arguments: payload.arguments,
            stdout: '',
            stderr: 'Daemon returned invalid response',
            daemonResponse: result
          });
        }

        // Strictly require a valid CallToolResult from daemon
        if (!result || typeof result !== 'object' || !('success' in result) || typeof (result as any).success !== 'boolean') {
          return errorResult({
            error: 'Daemon returned malformed CallToolResult',
            toolName,
            arguments: payload.arguments,
            stdout: '',
            stderr: 'Daemon returned malformed CallToolResult',
            daemonResponse: result
          });
        }

        // Only return if success is boolean and all required fields exist
        return result as unknown as CallToolResult;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[MCP] Exception in tool call`, { toolName, errorMsg, stack: error instanceof Error ? error.stack : undefined });
        return errorResult({
          error: errorMsg,
          toolName,
          arguments: payload.arguments,
          stdout: '',
          stderr: errorMsg,
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }

    // Handle internal/STDIO servers with MCP client connections
    const connection = this.connections.get(serverId);
    if (!connection) {
      return errorResult({
        error: `No connection to server ${serverId}`,
        toolName,
        arguments: arguments_,
        stdout: '',
        stderr: `No connection to server ${serverId}`
      });
    }

    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: arguments_ as Record<string, unknown>
      });
      // Robust type guard for CallToolResult
      const requiredFields = [
        ['success', 'boolean'],
        ['toolName', 'string'],
        ['arguments', 'object'],
        ['stdout', 'string'],
        ['stderr', 'string']
      ];
      let malformedReason = '';
      for (const [field, type] of requiredFields) {
        if (!(field in result)) {
          malformedReason = `Missing field: ${field}`;
          break;
        }
        if (type === 'object') {
          if (typeof (result as any)[field] !== 'object' || (result as any)[field] === null) {
            malformedReason = `Field ${field} is not a valid object`;
            break;
          }
        } else {
          if (typeof (result as any)[field] !== type) {
            malformedReason = `Field ${field} is not of type ${type}`;
            break;
          }
        }
      }
      if (malformedReason) {
        return errorResult({
          error: `Internal tool call returned malformed CallToolResult: ${malformedReason}`,
          toolName,
          arguments: arguments_,
          stdout: '',
          stderr: `Internal tool call returned malformed CallToolResult: ${malformedReason}`,
          daemonResponse: result
        });
      }
      // All required fields exist and are valid
      return result as unknown as CallToolResult;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[MCP] Exception in STDIO/internal tool call`, { toolName, errorMsg, stack: error instanceof Error ? error.stack : undefined });
      return errorResult({
        error: errorMsg,
        toolName,
        arguments: arguments_,
        stdout: '',
        stderr: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });
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
