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

interface RememberArgs {
  content: string;
  key?: string;
  metadata?: any;
}

interface RecallArgs {
  key?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface ResetArgs {
  key?: string;
}

class MemoryMCPServer {
  private server: Server;
  private prisma: PrismaClient;
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'demo-secret-key-for-mvp';
    this.server = new Server(
      {
        name: "memory-server",
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

  /**
   * Create JWT middleware for HTTP requests
   */
  private createJWTMiddleware() {
    return async (request: any, reply: any) => {
      const authHeader = request.headers.authorization;
      const user = this.verifyJWT(authHeader);
      
      if (!user) {
        return reply.status(401).send({ 
          success: false,
          error: 'Unauthorized: Invalid or missing JWT token' 
        });
      }
      
      request.user = user;
    };
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "memory_remember",
            description: "💾 REMEMBER information that should be recalled later. Use this to store facts, preferences, context, or any important information. Example: memory_remember with content='User lives in Berlin' and key='location'",
            inputSchema: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: "The information to remember. Be specific and detailed. Examples: 'User prefers dark mode', 'User lives in Berlin', 'Project uses React and TypeScript'",
                },
                key: {
                  type: "string",
                  description: "Category or tag for organizing memories. Examples: 'user-preferences', 'location', 'project-info', 'personal-facts'",
                },
                metadata: {
                  type: "object",
                  description: "Additional context like importance level, tags, expiration date, etc.",
                },
              },
              required: ["content"],
            },
          },
          {
            name: "memory_recall",
            description: "🧠 RECALL previously stored memories. Use this to retrieve information that was stored earlier. Search by content text or filter by key category.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Find memories with specific category/tag. Examples: 'location', 'user-preferences', 'project-info'",
                },
                search: {
                  type: "string",
                  description: "Search for memories containing specific text. Examples: 'Berlin', 'dark mode', 'React', 'favorite color'",
                },
                limit: {
                  type: "number",
                  description: "Maximum number of memories to return (1-100, default 50)",
                  minimum: 1,
                  maximum: 100,
                },
                offset: {
                  type: "number",
                  description: "Number of memories to skip (for pagination, default 0)",
                  minimum: 0,
                },
              },
            },
          },
          {
            name: "memory_reset",
            description: "🗑️ DELETE stored memories. Use with caution! Can delete all memories or just those with a specific key.",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Only delete memories with this specific key/category. If not provided, deletes ALL memories for the user!",
                },
              },
            },
          },
        ] satisfies Tool[],
      };
    });

    // Handle tool calls (STDIO mode - use demo user)
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // For STDIO mode, use demo user ID (1)
        const userId = 1;
        
        switch (name) {
          case "memory_remember":
            return await this.handleRemember(args as unknown as RememberArgs, userId);
          case "memory_recall":
            return await this.handleRecall(args as unknown as RecallArgs, userId);
          case "memory_reset":
            return await this.handleReset(args as unknown as ResetArgs, userId);
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

  private async handleRemember(args: RememberArgs, userId: number) {
    const { content, key, metadata } = args;

    if (!content) {
      throw new Error("Content is required");
    }

    const memory = await this.prisma.memory.create({
      data: {
        userId,
        content,
        key: key || null,
        metadata: metadata || null,
      },
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            memory: {
              id: memory.id,
              content: memory.content,
              key: memory.key,
              createdAt: memory.createdAt,
            },
            message: "Memory stored successfully",
          }, null, 2),
        },
      ],
    };
  }

  private async handleRecall(args: RecallArgs, userId: number) {
    const { key, search, limit = 50, offset = 0 } = args;

    const where: any = { userId };
    if (key) where.key = key;
    if (search) {
      where.content = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const [memories, total] = await Promise.all([
      this.prisma.memory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.memory.count({ where }),
    ]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            memories,
            total,
            hasMore: offset + limit < total,
            message: `Retrieved ${memories.length} memories`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleReset(args: ResetArgs, userId: number) {
    const { key } = args;

    const where: any = { userId };
    if (key) where.key = key;

    const result = await this.prisma.memory.deleteMany({ where });

    const message = key
      ? `Deleted ${result.count} memories with key '${key}' for user ${userId}`
      : `Deleted all ${result.count} memories for user ${userId}`;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            deletedCount: result.count,
            message,
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

    // Health check endpoint
    app.get('/health', async (request, reply) => {
      return { status: 'ok', service: 'memory-mcp-server' };
    });

    // MCP-compatible /call-tool endpoint (JWT protected)
    app.post('/call-tool', { preHandler: [this.createJWTMiddleware()] }, async (request: any, reply) => {
      try {
        const { name, arguments: args } = request.body as { name: string; arguments: any };
        const userId = request.user.userId;
        
        let result;
        switch (name) {
          case 'memory_remember':
            result = await this.handleRemember(args as RememberArgs, userId);
            break;
          case 'memory_recall':
            result = await this.handleRecall(args as RecallArgs, userId);
            break;
          case 'memory_reset':
            result = await this.handleReset(args as ResetArgs, userId);
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

    // MCP Tools endpoint - expose memory tools as HTTP API (JWT protected)
    app.post('/tools/memory_remember', { preHandler: [this.createJWTMiddleware()] }, async (request: any, reply) => {
      try {
        const args = request.body as RememberArgs;
        const userId = request.user.userId;
        const result = await this.handleRemember(args, userId);
        return {
          success: true,
          toolName: "memory_remember",
          arguments: args,
          stdout: typeof result === 'string' ? result : JSON.stringify(result),
          stderr: "",
          result
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          toolName: "memory_remember",
          arguments: request.body,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    app.post('/tools/memory_recall', { preHandler: [this.createJWTMiddleware()] }, async (request: any, reply) => {
      try {
        const args = request.body as RecallArgs;
        const userId = request.user.userId;
        const result = await this.handleRecall(args, userId);
        return {
          success: true,
          toolName: "memory_recall",
          arguments: args,
          stdout: typeof result === 'string' ? result : JSON.stringify(result),
          stderr: "",
          result
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          toolName: "memory_recall",
          arguments: request.body,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    app.post('/tools/memory_reset', { preHandler: [this.createJWTMiddleware()] }, async (request: any, reply) => {
      try {
        const args = request.body as ResetArgs;
        const userId = request.user.userId;
        const result = await this.handleReset(args, userId);
        return {
          success: true,
          toolName: "memory_reset",
          arguments: args,
          stdout: typeof result === 'string' ? result : JSON.stringify(result),
          stderr: "",
          result
        };
      } catch (error) {
        reply.code(500);
        return {
          success: false,
          toolName: "memory_reset",
          arguments: request.body,
          stdout: "",
          stderr: error instanceof Error ? error.message : String(error),
          error: error instanceof Error ? error.message : String(error)
        };
      }
    });

    // List available tools
    app.get('/tools', async (request, reply) => {
      return {
        tools: [
          {
            name: "memory_remember",
            description: "💾 REMEMBER information that should be recalled later",
            inputSchema: {
              type: "object",
              properties: {
                content: { type: "string", description: "The information to remember" },
                key: { type: "string", description: "Category or tag for organizing memories" },
                metadata: { type: "object", description: "Additional context" },
                userId: { type: "number", description: "User ID" }
              },
              required: ["content"]
            }
          },
          {
            name: "memory_recall",
            description: "🧠 RECALL previously stored memories",
            inputSchema: {
              type: "object",
              properties: {
                key: { type: "string", description: "Find memories with specific category/tag" },
                search: { type: "string", description: "Search for memories containing specific text" },
                limit: { type: "number", description: "Maximum number of memories to return" },
                offset: { type: "number", description: "Number of memories to skip" },
                userId: { type: "number", description: "User ID" }
              }
            }
          },
          {
            name: "memory_reset",
            description: "🗑️ DELETE stored memories",
            inputSchema: {
              type: "object", 
              properties: {
                key: { type: "string", description: "Delete memories with specific key" },
                userId: { type: "number", description: "User ID" }
              }
            }
          }
        ]
      };
    });

    const PORT = parseInt(process.env.MCP_MEMORY_PORT || '3001');
    
    try {
      await app.listen({ port: PORT, host: '0.0.0.0' });
      console.log(`🚀 Memory MCP Server daemon running on http://0.0.0.0:${PORT}`);
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
const server = new MemoryMCPServer();

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
