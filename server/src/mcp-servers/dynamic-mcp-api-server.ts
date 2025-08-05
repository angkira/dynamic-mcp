#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { PrismaClient } from '@prisma/client';
import fastify from 'fastify';
import cors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';

interface JWTPayload {
  userId: number;
  email: string;
  name?: string;
}

interface MCPServerArgs {
  id?: number;
  name?: string;
}

interface CreateServerArgs {
  name: string;
  version?: string;
  description?: string;
  transportType: string;
  transportCommand: string;
  transportArgs?: string[];
  transportBaseUrl?: string;
  authType?: string;
  authApiKey?: string;
  isEnabled?: boolean;
}

interface UpdateServerArgs extends MCPServerArgs {
  version?: string;
  description?: string;
  isEnabled?: boolean;
  transportCommand?: string;
  transportArgs?: string[];
}

interface ToggleServerArgs extends MCPServerArgs {
  enabled: boolean;
}

class DynamicMCPAPIServer {
  private server: Server;
  private prisma: PrismaClient;
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'demo-secret-key-for-mvp';
    this.server = new Server(
      {
        name: "dynamic-mcp-api",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.prisma = new PrismaClient();
    this.setupToolHandlers();
  }

  /**
   * Extract and verify JWT token from Authorization header
   */
  private verifyJWT(authHeader?: string): JWTPayload | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "mcp_list_servers",
            description: "📋 List all registered MCP servers with their connection status, capabilities, and configuration details",
            inputSchema: {
              type: "object",
              properties: {
                userId: {
                  type: "number",
                  description: "User ID to filter servers for",
                },
              },
            },
          },
          {
            name: "mcp_create_server",
            description: "➕ Register a new MCP server with connection configuration and capabilities",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Name of the MCP server" },
                version: { type: "string", description: "Version of the MCP server" },
                description: { type: "string", description: "Description of the MCP server" },
                transportType: {
                  type: "string",
                  enum: ["STDIO", "SSE", "STREAMABLE_HTTP"],
                  description: "Transport type for the MCP server",
                },
                transportCommand: { type: "string", description: "Command to run the MCP server" },
                transportArgs: {
                  type: "array",
                  items: { type: "string" },
                  description: "Arguments for the transport command",
                },
                transportBaseUrl: { type: "string", description: "Base URL for HTTP-based transports" },
                authType: {
                  type: "string",
                  enum: ["NONE", "OAUTH", "APIKEY", "BEARER"],
                  description: "Authentication type",
                },
                authApiKey: { type: "string", description: "API key for authentication" },
                isEnabled: { type: "boolean", description: "Whether the server is enabled" },
              },
              required: ["name", "transportType", "transportCommand"],
            },
          },
          {
            name: "mcp_update_server",
            description: "✏️ Update an existing MCP server configuration, connection settings, or capabilities",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Server ID to update" },
                name: { type: "string", description: "Name of the server to update" },
                version: { type: "string", description: "New version" },
                description: { type: "string", description: "New description" },
                isEnabled: { type: "boolean", description: "Enable/disable the server" },
                transportCommand: { type: "string", description: "New transport command" },
                transportArgs: {
                  type: "array",
                  items: { type: "string" },
                  description: "New transport arguments",
                },
                userId: { type: "number", description: "User ID for authorization" },
              },
            },
          },
          {
            name: "mcp_delete_server",
            description: "🗑️ Permanently remove an MCP server and all its associated data",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Server ID to delete" },
                name: { type: "string", description: "Name of the server to delete" },
              },
            },
          },
          {
            name: "mcp_toggle_server",
            description: "🔄 Enable or disable an MCP server to control its availability for tool calls",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Server ID to toggle" },
                name: { type: "string", description: "Name of the server to toggle" },
                enabled: { type: "boolean", description: "Whether to enable or disable the server" },
              },
              required: ["enabled"],
            },
          },
          {
            name: "mcp_connect_server",
            description: "🔌 Establish connection to an MCP server and test its availability",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Server ID to connect" },
                name: { type: "string", description: "Name of the server to connect" },
              },
            },
          },
          {
            name: "mcp_disconnect_server",
            description: "🔌 Disconnect from an MCP server while keeping its configuration",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Server ID to disconnect" },
                name: { type: "string", description: "Name of the server to disconnect" },
              },
            },
          },
          {
            name: "mcp_get_server_tools",
            description: "🛠️ Get all available tools from a specific MCP server with their schemas",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Server ID to get tools from" },
                name: { type: "string", description: "Name of the server to get tools from" },
              },
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // For STDIO mode, use default user ID (in production, this should be handled differently)
        const userId = 1; // Default demo user

        switch (name) {
          case "mcp_list_servers":
            return await this.handleListServers(userId, args as unknown as MCPServerArgs);
          case "mcp_create_server":
            return await this.handleCreateServer(userId, args as unknown as CreateServerArgs);
          case "mcp_update_server":
            return await this.handleUpdateServer(userId, args as unknown as UpdateServerArgs);
          case "mcp_delete_server":
            return await this.handleDeleteServer(userId, args as unknown as MCPServerArgs);
          case "mcp_toggle_server":
            return await this.handleToggleServer(userId, args as unknown as ToggleServerArgs);
          case "mcp_connect_server":
            return await this.handleConnectServer(userId, args as unknown as MCPServerArgs);
          case "mcp_disconnect_server":
            return await this.handleDisconnectServer(userId, args as unknown as MCPServerArgs);
          case "mcp_get_server_tools":
            return await this.handleGetServerTools(userId, args as unknown as MCPServerArgs);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    });
  }

  private async handleListServers(userId: number, args: MCPServerArgs = {}) {
    const servers = await this.prisma.mCPServer.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            servers: servers.map(server => ({
              id: server.id,
              name: server.name,
              description: server.description,
              status: server.status,
              isEnabled: server.isEnabled,
              transportType: server.transportType,
              lastConnected: server.lastConnected,
              capabilities: server.capabilities,
            })),
            total: servers.length,
          }, null, 2),
        },
      ],
    };
  }

  private async handleCreateServer(userId: number, args: CreateServerArgs) {
    const server = await this.prisma.mCPServer.create({
      data: {
        userId: userId,
        name: args.name,
        version: args.version || '1.0.0',
        description: args.description || '',
        isEnabled: args.isEnabled ?? true,
        status: 'DISCONNECTED',
        transportType: args.transportType as any,
        transportCommand: args.transportCommand,
        transportArgs: args.transportArgs || [],
        transportEnv: {},
        authType: args.authType as any || 'NONE',
        authApiKey: args.authApiKey,
        configAutoConnect: true,
        configConnectionTimeout: 10000,
        configMaxRetries: 3,
        configRetryDelay: 2000,
        configValidateCertificates: true,
        configDebug: false,
        capabilities: { tools: [], resources: [], prompts: [] },
      },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `MCP server '${server.name}' created successfully`,
            server: {
              id: server.id,
              name: server.name,
              status: server.status,
              isEnabled: server.isEnabled,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleUpdateServer(userId: number, args: UpdateServerArgs) {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    // First find the server to get its ID if searching by name
    let serverId: number;
    if (args.id) {
      serverId = args.id;
    } else {
      const existingServer = await this.prisma.mCPServer.findFirst({
        where: { name: args.name! },
        select: { id: true }
      });
      if (!existingServer) {
        throw new Error(`MCP server with name '${args.name}' not found`);
      }
      serverId = existingServer.id;
    }

    const updateData: any = {};
    if (args.version !== undefined) updateData.version = args.version;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.isEnabled !== undefined) updateData.isEnabled = args.isEnabled;
    if (args.transportCommand !== undefined) updateData.transportCommand = args.transportCommand;
    if (args.transportArgs !== undefined) updateData.transportArgs = args.transportArgs;

    if (Object.keys(updateData).length === 0) {
      throw new Error('No update fields provided');
    }

    const server = await this.prisma.mCPServer.update({
      where: { id: serverId },
      data: updateData,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `MCP server '${server.name}' updated successfully`,
            server: {
              id: server.id,
              name: server.name,
              status: server.status,
              isEnabled: server.isEnabled,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleDeleteServer(userId: number, args: MCPServerArgs) {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    const whereClause = args.id ? { id: args.id } : { name: args.name };
    const server = await this.prisma.mCPServer.findFirst({ where: whereClause });
    
    if (!server) {
      throw new Error('Server not found');
    }

    // Don't allow deletion of core servers
    if (['dynamic-mcp-api', 'memory'].includes(server.name)) {
      throw new Error('Cannot delete core MCP servers');
    }

    await this.prisma.mCPServer.delete({ where: { id: server.id } });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `MCP server '${server.name}' deleted successfully`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleToggleServer(userId: number, args: ToggleServerArgs) {
    if (!args.id && !args.name) {
      throw new Error('Either id or name must be provided to identify the server');
    }

    // First find the server to get its ID if searching by name
    let serverId: number;
    if (args.id) {
      serverId = args.id;
    } else {
      const existingServer = await this.prisma.mCPServer.findFirst({
        where: { name: args.name! },
        select: { id: true }
      });
      if (!existingServer) {
        throw new Error(`MCP server with name '${args.name}' not found`);
      }
      serverId = existingServer.id;
    }

    const server = await this.prisma.mCPServer.update({
      where: { id: serverId },
      data: { isEnabled: args.enabled },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `MCP server '${server.name}' ${args.enabled ? 'enabled' : 'disabled'} successfully`,
            server: {
              id: server.id,
              name: server.name,
              isEnabled: server.isEnabled,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleConnectServer(userId: number, args: MCPServerArgs) {
    // This would trigger the connection manager to connect to the server
    // For now, just return a placeholder response
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Connect server functionality needs to be implemented with connection manager integration",
          }, null, 2),
        },
      ],
    };
  }

  private async handleDisconnectServer(userId: number, args: MCPServerArgs) {
    // This would trigger the connection manager to disconnect from the server
    // For now, just return a placeholder response
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: "Disconnect server functionality needs to be implemented with connection manager integration",
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetServerTools(userId: number, args: MCPServerArgs | any) {
    // Handle different parameter formats that LLMs might use
    let serverId: number | undefined;
    let serverName: string | undefined;
    
    // Try to extract server identifier from various possible parameter names
    if (args.id) {
      serverId = typeof args.id === 'string' ? parseInt(args.id) : args.id;
    } else if (args.server_id) {
      // Handle cases where LLM uses server_id instead of id
      const serverIdStr = args.server_id;
      if (typeof serverIdStr === 'string') {
        // Try to extract numeric ID from strings like 'mcp-server-003'
        const match = serverIdStr.match(/(\d+)$/);
        if (match) {
          serverId = parseInt(match[1]);
        } else {
          // If no number found, treat it as a server name
          serverName = serverIdStr;
        }
      } else {
        serverId = serverIdStr;
      }
    } else if (args.name) {
      serverName = args.name;
    }

    if (!serverId && !serverName) {
      throw new Error('Either id or name must be provided to identify the server. Received: ' + JSON.stringify(args));
    }

    const whereClause = serverId ? { id: serverId } : { name: serverName };
    const server = await this.prisma.mCPServer.findFirst({ where: whereClause });
    
    if (!server) {
      throw new Error(`Server not found with ${serverId ? `id: ${serverId}` : `name: ${serverName}`}`);
    }

    const capabilities = server.capabilities as any;
    const tools = capabilities?.tools || [];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            server: {
              id: server.id,
              name: server.name,
            },
            tools,
            totalTools: tools.length,
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    // Create HTTP server daemon
    const app = fastify({ logger: true });
    
    // Register CORS
    await app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    // JWT middleware for all endpoints except health
    app.addHook('preHandler', async (request, reply) => {
      // Skip JWT for health check
      if (request.url === '/health') {
        return;
      }

      const authHeader = request.headers.authorization;
      const user = this.verifyJWT(authHeader);
      
      if (!user) {
        return reply.status(401).send({ 
          success: false,
          error: 'Unauthorized: Invalid or missing JWT token' 
        });
      }
      
      (request as any).user = user;
    });

    // Health check endpoint
    app.get('/health', async (request, reply) => {
      return { status: 'ok', service: 'dynamic-mcp-api-server' };
    });

    // MCP-compatible /call-tool endpoint
    app.post('/call-tool', async (request, reply) => {
      try {
        const { name, arguments: args } = request.body as { name: string; arguments: any };
        const userId = (request as any).user.userId;
        
        let result;
        switch (name) {
          case 'mcp_list_servers':
            result = await this.handleListServers(userId, args as MCPServerArgs);
            break;
          case 'mcp_create_server':
            result = await this.handleCreateServer(userId, args as CreateServerArgs);
            break;
          case 'mcp_update_server':
            result = await this.handleUpdateServer(userId, args as UpdateServerArgs);
            break;
          case 'mcp_delete_server':
            result = await this.handleDeleteServer(userId, args as MCPServerArgs);
            break;
          case 'mcp_toggle_server':
            result = await this.handleToggleServer(userId, args as ToggleServerArgs);
            break;
          case 'mcp_connect_server':
            result = await this.handleConnectServer(userId, args as MCPServerArgs);
            break;
          case 'mcp_disconnect_server':
            result = await this.handleDisconnectServer(userId, args as MCPServerArgs);
            break;
          case 'mcp_get_server_tools':
            result = await this.handleGetServerTools(userId, args as MCPServerArgs);
            break;
          default:
            reply.code(400);
            return { error: `Unknown tool: ${name}` };
        }
        
        return result;
      } catch (error) {
        reply.code(500);
        return { error: (error as Error).message };
      }
    });

    // MCP Server management endpoints
    app.get('/servers', async (request, reply) => {
      try {
        const userId = (request as any).user.userId;
        const args = request.query as MCPServerArgs;
        const result = await this.handleListServers(userId, args);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { success: false, error: (error as Error).message };
      }
    });

    app.post('/servers', async (request, reply) => {
      try {
        const userId = (request as any).user.userId;
        const args = request.body as CreateServerArgs;
        const result = await this.handleCreateServer(userId, args);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { success: false, error: (error as Error).message };
      }
    });

    app.put('/servers/:id', async (request, reply) => {
      try {
        const userId = (request as any).user.userId;
        const id = parseInt((request.params as any).id);
        const args = { ...request.body as Partial<CreateServerArgs>, id };
        const result = await this.handleUpdateServer(userId, args);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { success: false, error: (error as Error).message };
      }
    });

    app.delete('/servers/:id', async (request, reply) => {
      try {
        const userId = (request as any).user.userId;
        const id = parseInt((request.params as any).id);
        const args = { id };
        const result = await this.handleDeleteServer(userId, args);
        return { success: true, result };
      } catch (error) {
        reply.code(500);
        return { success: false, error: (error as Error).message };
      }
    });

    // List available tools
    app.get('/tools', async (request, reply) => {
      return {
        tools: [
          {
            name: "list_mcp_servers",
            description: "📋 LIST all registered MCP servers with their status and configuration",
            inputSchema: {
              type: "object",
              properties: {
                id: { type: "number", description: "Filter by server ID" },
                name: { type: "string", description: "Filter by server name" }
              }
            }
          },
          {
            name: "create_mcp_server",
            description: "➕ CREATE a new MCP server configuration",
            inputSchema: {
              type: "object",
              properties: {
                name: { type: "string", description: "Server name" },
                version: { type: "string", description: "Server version" },
                description: { type: "string", description: "Server description" },
                transportType: { type: "string", description: "Transport type (stdio, sse, etc.)" },
                transportCommand: { type: "string", description: "Command to run the server" },
                transportArgs: { type: "array", items: { type: "string" }, description: "Command arguments" },
                transportBaseUrl: { type: "string", description: "Base URL for HTTP transport" },
                authType: { type: "string", description: "Authentication type" },
                authApiKey: { type: "string", description: "API key for authentication" },
                isEnabled: { type: "boolean", description: "Whether server is enabled" }
              },
              required: ["name", "transportType", "transportCommand"]
            }
          }
        ]
      };
    });

    const PORT = parseInt(process.env.MCP_API_PORT || '3002');
    
    try {
      await app.listen({ port: PORT, host: '0.0.0.0' });
      console.log(`🚀 Dynamic MCP API Server daemon running on http://0.0.0.0:${PORT}`);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  }

  async cleanup() {
    await this.prisma.$disconnect();
  }
}

// Run the server
const server = new DynamicMCPAPIServer();

process.on('SIGINT', async () => {
  await server.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.cleanup();
  process.exit(0);
});

server.run().catch((error) => {
  console.error("Failed to run server:", error);
  process.exit(1);
});
