import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { PrismaClient, type MCPServer, type MCPServerStatus } from '@shared-prisma'
import type { FastifyInstance } from 'fastify'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { Prisma } from '@shared-prisma'
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
  private enabledCache: Map<number, number[]> = new Map()
  private globalSettings: {
    mcpEnableDebugLogging: boolean
    mcpDefaultTimeout: number
    mcpMaxConcurrentConnections: number
    mcpAutoDiscovery: boolean
  } | null = null

  private pollingTimer: NodeJS.Timeout | null = null
  private readonly POLLING_INTERVAL_MS = 20000 // 20 seconds

  constructor(_fastify?: FastifyInstance) {
    this.prisma = new PrismaClient()
  }

  private async getEnabledServerIds(userId: number): Promise<number[]> {
    const settings = await this.prisma.settings.findUnique({ where: { userId } })
    const ids = settings?.mcpEnabledServerIds || []
    this.enabledCache.set(userId, ids)
    return ids
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

    // Get enabled LOCAL + COMMON servers for this user
    const enabledIds = await this.getEnabledServerIds(userId)
    const enabledServers = await this.prisma.mCPServer.findMany({
      where: {
        isEnabled: true,
        OR: [
          { scope: 'COMMON' },
          { scope: 'LOCAL', id: { in: enabledIds } }
        ]
      }
    })

    console.log(`📡 Found ${enabledServers.length} enabled MCP servers`)

    // Connect to servers with autoConnect enabled
    const autoConnectServers = enabledServers.filter((s) => s.configAutoConnect)

    for (const server of autoConnectServers) {
      try {
        await this.connectToServer(server)
        console.log(`✅ Auto-connected to MCP server: ${server.name}`)
      } catch (error) {
        console.error(`❌ Failed to auto-connect to ${server.name}:`, error)
        await this.updateServerStatus(server.id, 'ERROR')
      }
    }

    // Start polling for disconnected servers
    this.startPolling(userId)
  }

  /**
   * Start polling for disconnected enabled servers
   */
  private startPolling(userId: number = 1) {
    if (this.pollingTimer) {
      return // Already polling
    }

    console.log(`🔄 Starting MCP server polling every ${this.POLLING_INTERVAL_MS / 1000} seconds`)

    this.pollingTimer = setInterval(async () => {
      try {
        await this.checkAndReconnectServers(userId)
      } catch (error) {
        console.error('❌ Error during MCP server polling:', error)
      }
    }, this.POLLING_INTERVAL_MS)
  }

  /**
   * Stop polling for disconnected servers
   */
  private stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
      console.log('⏹️ Stopped MCP server polling')
    }
  }

  /**
   * Manually trigger a check for disconnected servers (public method)
   */
  async triggerReconnectionCheck(userId: number = 1) {
    console.log('🔄 Manually triggered reconnection check...')
    await this.checkAndReconnectServers(userId)
  }

  /**
   * Get the current polling status
   */
  getPollingStatus() {
    return {
      isPolling: this.pollingTimer !== null,
      intervalMs: this.POLLING_INTERVAL_MS,
      intervalSeconds: this.POLLING_INTERVAL_MS / 1000
    }
  }

  /**
   * Check for enabled servers that are not connected and attempt to reconnect
   */
  private async checkAndReconnectServers(userId: number = 1) {
    try {
      // Get all enabled LOCAL + COMMON servers for this user that are not currently connected
      const enabledIds = await this.getEnabledServerIds(userId)
      const disconnectedServers = await this.prisma.mCPServer.findMany({
        where: {
          isEnabled: true,
          status: { in: ['DISCONNECTED', 'ERROR', 'CONNECTING'] },
          OR: [
            { scope: 'COMMON' },
            { scope: 'LOCAL', id: { in: enabledIds } }
          ]
        }
      })

      if (disconnectedServers.length === 0) {
        return
      }

      if (this.globalSettings?.mcpEnableDebugLogging) {
        console.log(`🔄 Polling check: Found ${disconnectedServers.length} disconnected enabled servers`)
      }

      for (const server of disconnectedServers) {
        try {
          // Skip if we've reached max connections
          if (this.globalSettings && this.connections.size >= this.globalSettings.mcpMaxConcurrentConnections) {
            if (this.globalSettings.mcpEnableDebugLogging) {
              console.log(`⚠️ Max connections reached, skipping reconnection attempt for ${server.name}`)
            }
            continue
          }

          // Skip if already in connections map (shouldn't happen, but safety check)
          if (this.connections.has(server.id)) {
            continue
          }

          // Check if server has been stuck in CONNECTING state for too long (more than 2 minutes)
          if (server.status === 'CONNECTING' && server.updatedAt) {
            const timeSinceConnecting = Date.now() - server.updatedAt.getTime()
            const maxConnectingTime = 2 * 60 * 1000 // 2 minutes

            if (timeSinceConnecting < maxConnectingTime) {
              // Still within reasonable connecting time, skip this iteration
              if (this.globalSettings?.mcpEnableDebugLogging) {
                console.log(`⏳ Server ${server.name} still connecting, waiting...`)
              }
              continue
            } else {
              // Been connecting too long, reset to ERROR state
              if (this.globalSettings?.mcpEnableDebugLogging) {
                console.log(`⚠️ Server ${server.name} stuck in CONNECTING state, resetting to ERROR`)
              }
              await this.updateServerStatus(server.id, 'ERROR')
            }
          }

          if (this.globalSettings?.mcpEnableDebugLogging) {
            console.log(`🔄 Attempting to reconnect to ${server.name} (${server.transportType})`)
          }

          const connected = await this.connectToServer(server)
          if (connected) {
            console.log(`✅ Successfully reconnected to MCP server: ${server.name}`)
          }
        } catch (error) {
          if (this.globalSettings?.mcpEnableDebugLogging) {
            console.error(`❌ Failed to reconnect to ${server.name}:`, error)
          }
          // Don't spam logs for failed reconnections, just update status
          await this.updateServerStatus(server.id, 'ERROR')
        }
      }
    } catch (error) {
      console.error('❌ Error checking and reconnecting servers:', error)
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
      type MCPToolsList = { tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; parameters?: Record<string, unknown> }> }
      type MCPResourcesList = { resources?: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> }
      type MCPPromptsList = { prompts?: Array<{ name: string; description?: string; arguments?: unknown[] }> }

      const tools = await client.listTools() as unknown as MCPToolsList;
      const resources = await client.listResources() as unknown as MCPResourcesList;
      const prompts = await client.listPrompts() as unknown as MCPPromptsList;

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

    // Get enabled AND connected servers: COMMON + enabled LOCAL
    const enabledIds = await this.getEnabledServerIds(userId)
    const enabledServers = await this.prisma.mCPServer.findMany({
      where: {
        isEnabled: true,
        status: 'CONNECTED',
        OR: [
          { scope: 'COMMON' },
          { scope: 'LOCAL', id: { in: enabledIds } }
        ]
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
        const capabilities = server.capabilities as unknown as {
          tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; parameters?: Record<string, unknown> }>
        }
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
  async getAllAvailableResources(userId: number = 1): Promise<MCPResourceForLLM[]> {
    const allResources: MCPResourceForLLM[] = []

    // Get enabled AND connected internal servers: COMMON + enabled LOCAL
    const enabledIds = await this.getEnabledServerIds(userId)
    {
      const internalServers = await this.prisma.mCPServer.findMany({
        where: {
          isEnabled: true,
          status: 'CONNECTED',
          transportCommand: 'internal',
          OR: [
            { scope: 'COMMON' },
            { scope: 'LOCAL', id: { in: enabledIds } }
          ]
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

    }

    // Add resources from connected external servers (only those with active connections)
    const enabledIdsForResources = await this.getEnabledServerIds(userId)
    for (const [serverId, connection] of this.connections) {
      // Allow if server is COMMON or in enabled LOCAL list
      const server = await this.prisma.mCPServer.findUnique({ where: { id: serverId } })
      if (!server) continue
      const isAllowed = server.scope === 'COMMON' || enabledIdsForResources.includes(serverId)
      if (!isAllowed) continue
      try {
        // Verify server is still enabled and connected
        if (!server.isEnabled || server.status !== 'CONNECTED') {
          console.warn(`⚠️ Server ${serverId} (${connection.server.name}) is no longer enabled or connected, skipping resources`)
          continue
        }

        // Double-check connectivity using our verification method
        const isConnected = await this.verifyServerConnectivity(server)
        if (!isConnected) {
          console.warn(`⚠️ Server ${connection.server.name} connectivity verification failed, skipping resources`)
          continue
        }

        const resources = await connection.client.listResources() as unknown as {
          resources?: Array<{ uri: string; name?: string; description?: string; mimeType?: string }>
        };

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
  async callTool(userId: number, serverId: number, toolName: string, arguments_: unknown): Promise<CallToolResult> {
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

    // Verify the server is visible to this user: COMMON or enabled LOCAL
    const enabledIds = await this.getEnabledServerIds(userId)
    const serverMeta = await this.prisma.mCPServer.findUnique({ where: { id: serverId } })
    if (!serverMeta || !serverMeta.isEnabled || !(serverMeta.scope === 'COMMON' || enabledIds.includes(serverId))) {
      throw new Error(`Server ${serverId} is not available for user ${userId}`)
    }

    // Load server
    const server = await this.prisma.mCPServer.findUnique({ where: { id: serverId } });

    if (!server) {
      throw new Error(`Server ${serverId} not found for user ${userId}`);
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
        if (!result || typeof result !== 'object') {
          return errorResult({
            error: 'Daemon returned malformed CallToolResult',
            toolName,
            arguments: payload.arguments,
            stdout: '',
            stderr: 'Daemon returned malformed CallToolResult',
            daemonResponse: result
          });
        }

        // Handle MCP standard response format with content array
        if (typeof result === 'object' && result !== null && 'content' in result && Array.isArray((result as { content?: unknown[] }).content)) {
          const mcpResult = result as { content: Array<{ type: string; text?: string }> };
          if (mcpResult.content.length > 0 && mcpResult.content[0].type === 'text') {
            try {
              // Parse the JSON content from the MCP response
              const actualData = JSON.parse(mcpResult.content[0].text || '{}');

              return {
                stdout: mcpResult.content[0].text || '',
                stderr: '',
                success: true,
                ...(actualData as Record<string, unknown>)
              } as CallToolResult;
            } catch (parseError) {
              // If JSON parsing fails, treat the text as raw output
              return {
                stdout: mcpResult.content[0].text || '',
                stderr: '',
                success: true,
                content: mcpResult.content
              } as CallToolResult;
            }
          }
        }

        // Handle direct JSON response format (legacy daemon format)
        if (typeof result === 'object' && result !== null && 'success' in result && typeof (result as { success: unknown }).success === 'boolean') {
          const daemonResult = result as { success: boolean; error?: string } & Record<string, unknown>;
          if (daemonResult.success) {
            // Success case - return the data as stdout in JSON format
            const base: CallToolResult = {
              stdout: JSON.stringify(daemonResult),
              stderr: '',
              success: true
            };
            return Object.assign({}, daemonResult, base) as CallToolResult;
          } else {
            // Error case from daemon
            return errorResult({
              error: daemonResult.error || 'Tool execution failed',
              toolName,
              arguments: payload.arguments,
              stdout: '',
              stderr: daemonResult.error || 'Tool execution failed',
              daemonResponse: result
            });
          }
        }

        // If it doesn't match any known format, assume it's raw result data
        const base: CallToolResult = {
          stdout: JSON.stringify(result),
          stderr: '',
          success: true
        };
        return Object.assign({}, result as Record<string, unknown>, base) as CallToolResult;
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
          if (typeof (result as Record<string, unknown>)[field] !== 'object' || (result as Record<string, unknown>)[field] === null) {
            malformedReason = `Field ${field} is not a valid object`;
            break;
          }
        } else {
          if (typeof (result as Record<string, unknown>)[field] !== type) {
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
  async readResource(userId: number, serverId: number, uri: string): Promise<ReadResourceResult> {
    // Verify server is visible to user: COMMON or enabled LOCAL
    const enabledIds = await this.getEnabledServerIds(userId)
    const serverMeta = await this.prisma.mCPServer.findUnique({ where: { id: serverId } })
    if (!serverMeta || !serverMeta.isEnabled || !(serverMeta.scope === 'COMMON' || enabledIds.includes(serverId))) {
      throw new Error(`Server ${serverId} is not available for user ${userId}`)
    }

    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new Error(`No connection to server ${serverId}`)
    }

    try {
      const result = await connection.client.readResource({ uri })
      return result as unknown as ReadResourceResult;
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

      return result as unknown as GetPromptResult;
    } catch (error) {
      console.error(`Error getting prompt ${promptName} from server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Get connection status for all connected servers for a specific user
   */
  getConnectionStatus(userId: number): MCPConnectionInfo[] {
    const status: MCPConnectionInfo[] = []
    const enabledIds: number[] = this.enabledCache.get(userId) || []
    for (const [serverId, connection] of this.connections) {
      if (enabledIds.length === 0 || enabledIds.includes(serverId)) {
        status.push({
          serverId,
          serverName: connection.server.name,
          isConnected: true,
          lastConnected: connection.lastConnected
        })
      }
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
        data: (updateData as unknown) as Prisma.MCPServerUpdateInput
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
        data: { capabilities: capabilities as unknown as Prisma.InputJsonValue }
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

    // Stop polling first
    this.stopPolling()

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
  async refreshConnections(userId: number = 1) {
    console.log('🔄 Refreshing MCP connections...')

    // Stop polling temporarily
    this.stopPolling()

    // Close existing connections
    for (const [serverId] of this.connections) {
      await this.disconnectFromServer(serverId)
    }

    // Reinitialize (this will restart polling)
    await this.initialize(userId)
  }

  /**
   * Health check for all connections for a specific user
   */
  async healthCheck(userId: number): Promise<MCPHealthCheckResult[]> {
    const results: MCPHealthCheckResult[] = []
    const enabledIds = await this.getEnabledServerIds(userId)
    for (const [serverId, connection] of this.connections) {
      // Only check health for servers that are enabled for this user
      if (enabledIds.includes(serverId)) {
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
    }

    return results
  }
}

export default McpConnectionManager
