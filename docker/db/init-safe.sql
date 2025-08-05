-- Safe database initialization script for Docker containers
-- Only inserts default data if not present, avoids creating types/tables/indexes that already exist

-- Create enum types only if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'messagerole') THEN
    CREATE TYPE "public"."MessageRole" AS ENUM ('USER', 'AI');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mcpserverstatus') THEN
    CREATE TYPE "public"."MCPServerStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mcptransporttype') THEN
    CREATE TYPE "public"."MCPTransportType" AS ENUM ('STDIO', 'SSE', 'STREAMABLE_HTTP');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mcpauthtype') THEN
    CREATE TYPE "public"."MCPAuthType" AS ENUM ('NONE', 'OAUTH', 'APIKEY', 'BEARER');
  END IF;
END $$;

-- Only create tables if not exists
CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Chat" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Message" (
    "id" SERIAL NOT NULL,
    "content" JSONB NOT NULL,
    "thoughts" JSONB,
    "role" "public"."MessageRole" NOT NULL DEFAULT 'USER',
    "chatId" INTEGER NOT NULL,
    "responseToId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Settings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "defaultProvider" TEXT NOT NULL DEFAULT 'openai',
    "defaultModel" TEXT NOT NULL DEFAULT 'o3-mini',
    "thinkingBudget" INTEGER NOT NULL DEFAULT 2048,
    "responseBudget" INTEGER NOT NULL DEFAULT 8192,
    "mcpEnableDebugLogging" BOOLEAN NOT NULL DEFAULT false,
    "mcpDefaultTimeout" INTEGER NOT NULL DEFAULT 10000,
    "mcpMaxConcurrentConnections" INTEGER NOT NULL DEFAULT 5,
    "mcpAutoDiscovery" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."MCPServer" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" "public"."MCPServerStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastConnected" TIMESTAMP(3),
    "transportType" "public"."MCPTransportType" NOT NULL,
    "transportCommand" TEXT,
    "transportArgs" JSONB,
    "transportEnv" JSONB,
    "transportBaseUrl" TEXT,
    "transportTimeout" INTEGER,
    "transportRetryAttempts" INTEGER,
    "transportSessionId" TEXT,
    "authType" "public"."MCPAuthType" NOT NULL DEFAULT 'NONE',
    "authClientId" TEXT,
    "authClientSecret" TEXT,
    "authAuthUrl" TEXT,
    "authTokenUrl" TEXT,
    "authScopes" JSONB,
    "authApiKey" TEXT,
    "authHeaderName" TEXT,
    "authToken" TEXT,
    "configAutoConnect" BOOLEAN NOT NULL DEFAULT false,
    "configConnectionTimeout" INTEGER NOT NULL DEFAULT 10000,
    "configMaxRetries" INTEGER NOT NULL DEFAULT 3,
    "configRetryDelay" INTEGER NOT NULL DEFAULT 2000,
    "configValidateCertificates" BOOLEAN NOT NULL DEFAULT true,
    "configDebug" BOOLEAN NOT NULL DEFAULT false,
    "capabilities" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MCPServer_pkey" PRIMARY KEY ("id")
);
CREATE TABLE IF NOT EXISTS "public"."Memory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "key" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- Create indexes only if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'User_email_key') THEN
    CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Settings_userId_key') THEN
    CREATE UNIQUE INDEX "Settings_userId_key" ON "public"."Settings"("userId");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'MCPServer_userId_idx') THEN
    CREATE INDEX "MCPServer_userId_idx" ON "public"."MCPServer"("userId");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Memory_userId_idx') THEN
    CREATE INDEX "Memory_userId_idx" ON "public"."Memory"("userId");
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'Memory_userId_key_idx') THEN
    CREATE INDEX "Memory_userId_key_idx" ON "public"."Memory"("userId", "key");
  END IF;
END $$;

-- Add foreign key constraints only if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Chat_userId_fkey') THEN
    ALTER TABLE "public"."Chat" ADD CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Message_chatId_fkey') THEN
    ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Message_responseToId_fkey') THEN
    ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_responseToId_fkey" FOREIGN KEY ("responseToId") REFERENCES "public"."Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Settings_userId_fkey') THEN
    ALTER TABLE "public"."Settings" ADD CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'MCPServer_userId_fkey') THEN
    ALTER TABLE "public"."MCPServer" ADD CONSTRAINT "MCPServer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'Memory_userId_fkey') THEN
    ALTER TABLE "public"."Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Insert default data only if not present
-- Create default user
INSERT INTO "public"."User" (email, name, updatedAt) 
VALUES ('user@example.com', 'Default User', NOW())
ON CONFLICT (email) DO NOTHING;

-- Create default settings for the user
INSERT INTO "public"."Settings" (
  "userId", 
  "defaultProvider", 
  "defaultModel", 
  "thinkingBudget", 
  "responseBudget",
  "mcpEnableDebugLogging",
  "mcpDefaultTimeout",
  "mcpMaxConcurrentConnections",
  "mcpAutoDiscovery"
)
SELECT 
  u.id,
  'openai',
  'o3-mini',
  2048,
  8192,
  false,
  10000,
  5,
  true
FROM "public"."User" u 
WHERE u.email = 'user@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."Settings" s WHERE s."userId" = u.id);

-- Create internal MCP API server for managing MCP servers
INSERT INTO "public"."MCPServer" (
  "userId",
  "name",
  "version",
  "description",
  "isEnabled",
  "status",
  "transportType",
  "transportCommand",
  "authType",
  "configAutoConnect",
  "capabilities"
)
SELECT 
  u.id,
  'dynamic-mcp-api',
  '1.0.0',
  'Internal MCP API for managing MCP servers and connections',
  true,
  'CONNECTED',
  'STDIO',
  'internal',
  'NONE',
  true,
  '{"tools": [{"name": "mcp_list_servers", "description": "📋 List all registered MCP servers with their connection status, capabilities, and configuration details"}, {"name": "mcp_create_server", "description": "➕ Register a new MCP server with connection configuration and capabilities"}, {"name": "mcp_update_server", "description": "✏️ Update an existing MCP server configuration, connection settings, or capabilities"}, {"name": "mcp_delete_server", "description": "🗑️ Permanently remove an MCP server and all its associated data"}, {"name": "mcp_toggle_server", "description": "🔄 Enable or disable an MCP server to control its availability for tool calls"}, {"name": "mcp_connect_server", "description": "🔌 Establish connection to an MCP server and test its availability"}, {"name": "mcp_disconnect_server", "description": "🔌 Disconnect from an MCP server while keeping its configuration"}, {"name": "mcp_get_server_tools", "description": "🛠️ Get all available tools from a specific MCP server with their schemas"}], "resources": [{"uri": "mcp://config", "name": "MCP Configuration", "description": "Current MCP system configuration", "mimeType": "application/json"}], "prompts": []}'::jsonb
FROM "public"."User" u 
WHERE u.email = 'user@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'dynamic-mcp-api' AND s."userId" = u.id);

-- Create internal Memory MCP server for memory management
INSERT INTO "public"."MCPServer" (
  "userId",
  "name",
  "version",
  "description",
  "isEnabled",
  "status",
  "transportType",
  "transportCommand",
  "authType",
  "configAutoConnect",
  "capabilities"
)
SELECT 
  u.id,
  'memory',
  '1.0.0',
  'Memory management system for storing and retrieving important information',
  true,
  'CONNECTED',
  'STDIO',
  'internal',
  'NONE',
  true,
  '{"tools": [{"name": "memory_remember", "description": "💾 Store a new memory or important information for future reference"}, {"name": "memory_recall", "description": "🧠 Retrieve stored memories with optional filtering and search"}, {"name": "memory_reset", "description": "🗑️ Delete stored memories, optionally filtered by key"}], "resources": [{"uri": "memory://stats", "name": "Memory Statistics", "description": "Current memory usage statistics and metadata", "mimeType": "application/json"}], "prompts": []}'::jsonb
FROM "public"."User" u 
WHERE u.email = 'user@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'memory' AND s."userId" = u.id);

-- Create HTTP daemon version of Memory MCP server
INSERT INTO "public"."MCPServer" (
  "userId",
  "name",
  "version",
  "description",
  "isEnabled",
  "status",
  "transportType",
  "transportBaseUrl",
  "authType",
  "configAutoConnect",
  "capabilities"
)
SELECT 
  u.id,
  'memory-daemon',
  '1.0.0',
  'Memory management HTTP daemon service for storing and retrieving important information',
  true,
  'DISCONNECTED',
  'STREAMABLE_HTTP',
  'http://mcp-memory:3001',
  'NONE',
  true,
  '{"tools": [{"name": "memory_remember", "description": "💾 REMEMBER information that should be recalled later. Use this to store facts, preferences, context, or any important information. Example: memory_remember with content=''User lives in Berlin'' and key=''location''"}, {"name": "memory_recall", "description": "🧠 RECALL previously stored memories. Use this to retrieve information that was stored earlier. Search by content text or filter by key category."}, {"name": "memory_reset", "description": "🗑️ DELETE stored memories. Use with caution! Can delete all memories or just those with a specific key."}], "resources": [{"uri": "memory://stats", "name": "Memory Statistics", "description": "Current memory usage statistics, categories, and stored information overview", "mimeType": "application/json"}], "prompts": []}'::jsonb
FROM "public"."User" u 
WHERE u.email = 'user@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'memory-daemon' AND s."userId" = u.id);

-- Create HTTP daemon version of Dynamic MCP API server
INSERT INTO "public"."MCPServer" (
  "userId",
  "name",
  "version",
  "description",
  "isEnabled",
  "status",
  "transportType",
  "transportBaseUrl",
  "authType",
  "configAutoConnect",
  "capabilities"
)
SELECT 
  u.id,
  'dynamic-mcp-api-daemon',
  '1.0.0',
  'Dynamic MCP API HTTP daemon service for managing MCP servers and connections',
  true,
  'DISCONNECTED',
  'STREAMABLE_HTTP',
  'http://mcp-api:3002',
  'NONE',
  true,
  '{"tools": [{"name": "mcp_list_servers", "description": "📋 List all registered MCP servers with their connection status, capabilities, and configuration details"}, {"name": "mcp_create_server", "description": "➕ Register a new MCP server with connection configuration and capabilities"}, {"name": "mcp_update_server", "description": "✏️ Update an existing MCP server configuration, connection settings, or capabilities"}, {"name": "mcp_delete_server", "description": "🗑️ Permanently remove an MCP server and all its associated data"}, {"name": "mcp_toggle_server", "description": "🔄 Enable or disable an MCP server to control its availability for tool calls"}, {"name": "mcp_connect_server", "description": "🔌 Establish connection to an MCP server and test its availability"}, {"name": "mcp_disconnect_server", "description": "🔌 Disconnect from an MCP server while keeping its configuration"}, {"name": "mcp_get_server_tools", "description": "🛠️ Get all available tools from a specific MCP server with their schemas"}], "resources": [{"uri": "mcp://config", "name": "MCP Configuration", "description": "Current MCP system configuration", "mimeType": "application/json"}], "prompts": []}'::jsonb
FROM "public"."User" u 
WHERE u.email = 'user@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'dynamic-mcp-api-daemon' AND s."userId" = u.id);
