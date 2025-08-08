import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create demo user
  const hashedPassword = await bcrypt.hash('demo', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo User',
      password: hashedPassword,
    },
  });

  console.log(`👤 Upserted demo user with id: ${user.id}`);

  // Create default settings for demo user
  await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      defaultProvider: 'google',
      defaultModel: 'gemini-2.5-flash',
    },
  });

  console.log('⚙️  Upserted default settings for demo user');

  // Create memory daemon MCP server
  await prisma.mCPServer.upsert({
    where: { name: 'memory-daemon' },
    update: {},
    create: {
      userId: user.id,
      name: 'memory-daemon',
      version: '1.0.0',
      description: 'Persistent memory management for conversations and user data',
      isEnabled: true,
      status: 'DISCONNECTED',
      transportType: 'STREAMABLE_HTTP',
      transportBaseUrl: 'http://mcp-memory:3001',
      transportToolEndpoint: '/call-tool',
      transportHealthEndpoint: '/health',
      transportToolsEndpoint: '/tools',
      transportResourcesEndpoint: '/resources',
      authType: 'NONE',
      configAutoConnect: true,
      capabilities: {
        "tools": [
          {
            "name": "memory_remember",
            "description": "💾 REMEMBER information that should be recalled later. Use this to store facts, preferences, context, or any important information. This is your long-term memory system that persists across conversations. ALWAYS use this when users share important personal information, preferences, project details, or any context that should be remembered for future interactions. Think of this as your persistent memory bank - store anything the user tells you that seems important for future reference.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "content": {
                  "type": "string",
                  "description": "The information to remember. Be specific and detailed. Examples: User prefers dark mode, User lives in Berlin, Project uses React and TypeScript, User favorite color is blue, User works at Microsoft, User has 2 cats named Whiskers and Mittens"
                },
                "key": {
                  "type": "string",
                  "description": "Category or tag for organizing memories. Use consistent categorization. Examples: user-preferences, location, project-info, personal-facts, work-details, hobbies, family, technical-skills"
                },
                "metadata": {
                  "type": "object",
                  "description": "Additional context like importance level, tags, expiration date, source, confidence level, etc. This helps with memory organization and retrieval"
                }
              },
              "required": ["content"]
            }
          },
          {
            "name": "memory_recall",
            "description": "🧠 RECALL previously stored memories. Use this to retrieve information that was stored earlier about the user, their preferences, projects, or any context. This helps maintain continuity across conversations and provide personalized responses based on what you know about the user. Search through your memory bank to find relevant information before responding to user queries.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "key": {
                  "type": "string",
                  "description": "Find memories with specific category/tag. Examples: location, user-preferences, project-info, personal-facts, work-details. Use this to filter by category"
                },
                "search": {
                  "type": "string",
                  "description": "Search for memories containing specific text. Examples: Berlin, dark mode, React, favorite color, cats, Microsoft. This performs full-text search across memory content"
                },
                "limit": {
                  "type": "number",
                  "description": "Maximum number of memories to return (1-100, default 50). Use smaller numbers for quick lookups, larger for comprehensive searches",
                  "minimum": 1,
                  "maximum": 100
                },
                "offset": {
                  "type": "number",
                  "description": "Number of memories to skip (for pagination, default 0). Use for browsing through large memory sets",
                  "minimum": 0
                }
              }
            }
          },
          {
            "name": "memory_reset",
            "description": "🗑️ DELETE stored memories. Use with EXTREME caution! Can delete all memories or just those with a specific key. This permanently removes information from the memory system. Only use when explicitly requested by the user or when you need to clear outdated/incorrect information. Always confirm before deleting user data.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "key": {
                  "type": "string",
                  "description": "Only delete memories with this specific key/category. If not provided, deletes ALL memories for the user! Use specific keys like user-preferences, location, etc. ALWAYS specify a key unless user explicitly wants to delete everything"
                }
              }
            }
          }
        ],
        "resources": [
          {
            "uri": "memory://",
            "name": "Memory Store",
            "description": "Persistent memory storage for user information, preferences, and conversational context. This resource provides access to the long-term memory system that maintains continuity across chat sessions.",
            "mimeType": "application/json"
          }
        ],
        "prompts": []
      }
    }
  });

  console.log('💾 Upserted memory-daemon MCP server');

  // Create dynamic MCP API daemon
  await prisma.mCPServer.upsert({
    where: { name: 'dynamic-mcp-api-daemon' },
    update: {},
    create: {
      userId: user.id,
      name: 'dynamic-mcp-api-daemon',
      version: '1.0.0',
      description: 'Dynamic MCP server management and API integration tools',
      isEnabled: true,
      status: 'DISCONNECTED',
      transportType: 'STREAMABLE_HTTP',
      transportBaseUrl: 'http://mcp-api:3002',
      transportToolEndpoint: '/call-tool',
      transportHealthEndpoint: '/health',
      transportToolsEndpoint: '/tools',
      transportResourcesEndpoint: '/resources',
      authType: 'NONE',
      configAutoConnect: true,
      capabilities: {
        "tools": [
          {
            "name": "mcp_list_servers",
            "description": "📋 List all registered MCP servers with their connection status, capabilities, and configuration details. Use this to inventory the MCP ecosystem, see which servers are available, connected, enabled, and what tools they provide. This gives you a complete overview of the current MCP infrastructure and helps you understand what capabilities are at your disposal for helping users.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "userId": {
                  "type": "number",
                  "description": "User ID to filter servers for (automatically handled, optional parameter)"
                }
              }
            }
          },
          {
            "name": "mcp_create_server",
            "description": "➕ Register a new MCP server with connection configuration and capabilities. Use this to extend the system with additional tools and services. You can create servers for file systems, APIs, databases, web scrapers, or any other functionality that follows the MCP protocol. This allows dynamic expansion of available tools without system restart.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "name": {
                  "type": "string",
                  "description": "Unique name for the MCP server (must be unique across all servers)"
                },
                "version": {
                  "type": "string",
                  "description": "Version of the MCP server (optional, defaults to 1.0.0 if not specified)"
                },
                "description": {
                  "type": "string",
                  "description": "Human-readable description of what this MCP server does and what tools it provides"
                },
                "transportType": {
                  "type": "string",
                  "enum": [
                    "STDIO",
                    "SSE",
                    "STREAMABLE_HTTP"
                  ],
                  "description": "Transport mechanism: STDIO for command-line programs, SSE for Server-Sent Events, STREAMABLE_HTTP for HTTP-based services"
                },
                "transportCommand": {
                  "type": "string",
                  "description": "Command to run the MCP server (for STDIO) or base URL (for HTTP services)"
                },
                "transportArgs": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "Arguments for the transport command (array of strings, optional)"
                },
                "transportBaseUrl": {
                  "type": "string",
                  "description": "Base URL for HTTP-based transports (required for STREAMABLE_HTTP)"
                },
                "authType": {
                  "type": "string",
                  "enum": [
                    "NONE",
                    "OAUTH",
                    "APIKEY",
                    "BEARER"
                  ],
                  "description": "Authentication method required by the server"
                },
                "authApiKey": {
                  "type": "string",
                  "description": "API key for authentication (required if authType is APIKEY)"
                },
                "isEnabled": {
                  "type": "boolean",
                  "description": "Whether to enable the server immediately after creation (defaults to true)"
                }
              },
              "required": [
                "name",
                "transportType",
                "transportCommand"
              ]
            }
          },
          {
            "name": "mcp_update_server",
            "description": "✏️ Update an existing MCP server configuration, connection settings, or capabilities. Use this to modify server properties, enable/disable servers, update connection details, or change authentication settings. Changes take effect immediately and may require reconnection.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "number",
                  "description": "Server ID to update (use either id or name to identify the server)"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the server to update (alternative to ID for identification)"
                },
                "version": {
                  "type": "string",
                  "description": "New version string for the server"
                },
                "description": {
                  "type": "string",
                  "description": "New description for the server"
                },
                "isEnabled": {
                  "type": "boolean",
                  "description": "Enable (true) or disable (false) the server"
                },
                "transportCommand": {
                  "type": "string",
                  "description": "New transport command or base URL"
                },
                "transportArgs": {
                  "type": "array",
                  "items": {
                    "type": "string"
                  },
                  "description": "New transport arguments array"
                },
                "userId": {
                  "type": "number",
                  "description": "User ID for authorization (automatically handled)"
                }
              }
            }
          },
          {
            "name": "mcp_delete_server",
            "description": "🗑️ Permanently remove an MCP server and all its associated data. WARNING: This action cannot be undone! The server configuration will be deleted, any active connections will be terminated, and the server will no longer be available for tool calls. Core system servers (memory-daemon, dynamic-mcp-api-daemon) cannot be deleted for system stability.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "number",
                  "description": "Server ID to delete (use either id or name to identify the server)"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the server to delete (alternative to ID for identification)"
                }
              }
            }
          },
          {
            "name": "mcp_toggle_server",
            "description": "🔄 Enable or disable an MCP server to control its availability for tool calls. Disabled servers remain configured in the system but their tools become unavailable until re-enabled. This is useful for temporarily disabling problematic servers, performing maintenance, or controlling resource usage without losing server configuration.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "number",
                  "description": "Server ID to toggle (use either id or name to identify the server)"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the server to toggle (alternative to ID for identification)"
                },
                "enabled": {
                  "type": "boolean",
                  "description": "Whether to enable (true) or disable (false) the server"
                }
              },
              "required": ["enabled"]
            }
          },
          {
            "name": "mcp_connect_server",
            "description": "🔌 Establish connection to an MCP server and test its availability. Use this to manually initiate a connection, verify server functionality, or reconnect after network issues. This tests the connection parameters and updates the server status in the database. Note: This is a placeholder implementation that needs integration with the connection manager.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "number",
                  "description": "Server ID to connect to (use either id or name to identify the server)"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the server to connect to (alternative to ID for identification)"
                }
              }
            }
          },
          {
            "name": "mcp_disconnect_server",
            "description": "🔌 Disconnect from an MCP server while keeping its configuration intact. The server remains configured in the system but becomes unavailable for tool calls until reconnected. Use this for graceful disconnection, troubleshooting, or resource management. Note: This is a placeholder implementation that needs integration with the connection manager.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "number",
                  "description": "Server ID to disconnect from (use either id or name to identify the server)"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the server to disconnect from (alternative to ID for identification)"
                }
              }
            }
          },
          {
            "name": "mcp_get_server_tools",
            "description": "🛠️ Get all available tools from a specific MCP server with their detailed schemas and descriptions. Use this to discover what capabilities a server provides, understand tool parameters and usage, and help users understand what actions are possible with each server. This returns the complete tool catalog for a server.",
            "inputSchema": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "number",
                  "description": "Server ID to get tools from (use either id or name to identify the server)"
                },
                "name": {
                  "type": "string",
                  "description": "Name of the server to get tools from (alternative to ID for identification)"
                }
              }
            }
          }
        ],
        "resources": [
          {
            "uri": "mcp://servers",
            "name": "MCP Server Registry",
            "description": "Dynamic MCP server management and configuration registry. This resource provides access to the centralized database of all registered MCP servers, their configurations, connection status, and capabilities.",
            "mimeType": "application/json"
          }
        ],
        "prompts": []
      }
    }
  });

  console.log('🚀 Upserted dynamic-mcp-api-daemon MCP server');
  console.log('✅ Database seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
