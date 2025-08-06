-- Data initialization script for Docker containers
-- Contains demo data and MCP server configurations

-- Insert demo user - only if not exists
INSERT INTO "public"."User" ("email", "name", "password", "updatedAt")
SELECT 'demo@example.com', 'Demo User', null, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "public"."User" WHERE "email" = 'demo@example.com');

-- Create default settings for demo user - only if not exists
INSERT INTO "public"."Settings" (
  "userId",
  "defaultProvider",
  "defaultModel", 
  "thinkingBudget",
  "responseBudget",
  "mcpAutoDiscovery",
  "mcpDefaultTimeout",
  "mcpEnableDebugLogging",
  "mcpMaxConcurrentConnections",
  "updatedAt"
)
SELECT 
  u.id,
  'google',
  'gemini-2.5-flash',
  2048,
  8192,
  true,
  10000,
  false,
  5,
  CURRENT_TIMESTAMP
FROM "public"."User" u 
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."Settings" s WHERE s."userId" = u.id);

-- Create memory daemon MCP server (WORKING) - only if not exists
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
  "capabilities",
  "updatedAt"
)
SELECT 
  u.id,
  'memory-daemon',
  '1.0.0',
  'Persistent memory management for conversations and user data',
  true,
  'CONNECTED',
  'STREAMABLE_HTTP',
  'http://mcp-memory:3001',
  'NONE',
  true,
  '{"tools": [{"name": "store_memory", "description": "Store important information for later retrieval"}, {"name": "recall_memory", "description": "Search and retrieve stored memories"}, {"name": "update_memory", "description": "Update existing memory with new information"}, {"name": "delete_memory", "description": "Remove specific memory entries"}, {"name": "list_memories", "description": "List all stored memories with optional filtering"}], "resources": [{"uri": "memory://", "name": "Memory Store", "description": "Persistent memory storage", "mimeType": "application/json"}], "prompts": []}'::jsonb,
  CURRENT_TIMESTAMP
FROM "public"."User" u 
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'memory-daemon' AND s."userId" = u.id);

-- Create dynamic MCP API daemon (WORKING) - only if not exists
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
  "capabilities",
  "updatedAt"
)
SELECT 
  u.id,
  'dynamic-mcp-api-daemon',
  '1.0.0',
  'Dynamic MCP server management and API integration tools',
  true,
  'CONNECTED',
  'STREAMABLE_HTTP',
  'http://mcp-api:3002',
  'NONE',
  true,
  '{"tools": [{"name": "mcp_list_servers", "description": "📋 List all registered MCP servers with their connection status, capabilities, and configuration details"}, {"name": "mcp_create_server", "description": "➕ Register a new MCP server with connection configuration and capabilities"}, {"name": "mcp_update_server", "description": "✏️ Update an existing MCP server configuration, connection settings, or capabilities"}, {"name": "mcp_delete_server", "description": "🗑️ Permanently remove an MCP server and all its associated data"}, {"name": "mcp_toggle_server", "description": "🔄 Enable or disable an MCP server to control its availability for tool calls"}, {"name": "mcp_connect_server", "description": "🔌 Establish connection to an MCP server and test its availability"}, {"name": "mcp_disconnect_server", "description": "🔌 Disconnect from an MCP server while keeping its configuration"}, {"name": "mcp_get_server_tools", "description": "🛠️ Get all available tools from a specific MCP server with their schemas"}], "resources": [{"uri": "mcp://servers", "name": "MCP Server Registry", "description": "Dynamic MCP server management", "mimeType": "application/json"}], "prompts": []}'::jsonb,
  CURRENT_TIMESTAMP
FROM "public"."User" u 
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'dynamic-mcp-api-daemon' AND s."userId" = u.id);

-- Create mock filesystem MCP server (NON-WORKING DEMO) - only if not exists
INSERT INTO "public"."MCPServer" (
  "userId",
  "name",
  "version",
  "description",
  "isEnabled",
  "status",
  "transportType",
  "transportCommand",
  "transportArgs",
  "authType",
  "configAutoConnect",
  "capabilities",
  "updatedAt"
)
SELECT 
  u.id,
  'filesystem-manager',
  '1.2.0',
  'File system operations and directory management tools - DEMO (NON-FUNCTIONAL)',
  false,
  'ERROR',
  'STDIO',
  'npx',
  '["@modelcontextprotocol/server-filesystem", "/tmp"]'::jsonb,
  'NONE',
  false,
  '{"tools": [{"name": "read_file", "description": "📖 Read contents of a file from the file system"}, {"name": "write_file", "description": "✏️ Write content to a file on the file system"}, {"name": "list_directory", "description": "📂 List contents of a directory"}, {"name": "create_directory", "description": "📁 Create a new directory"}, {"name": "delete_file", "description": "🗑️ Delete a file from the file system"}, {"name": "move_file", "description": "📦 Move or rename a file"}, {"name": "search_files", "description": "🔍 Search for files matching patterns"}], "resources": [{"uri": "file://", "name": "File System", "description": "Access to local file system operations", "mimeType": "application/octet-stream"}], "prompts": []}'::jsonb,
  CURRENT_TIMESTAMP
FROM "public"."User" u 
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'filesystem-manager' AND s."userId" = u.id);

-- Create mock weather API MCP server (NON-WORKING DEMO) - only if not exists
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
  "authApiKey",
  "authHeaderName",
  "configAutoConnect",
  "capabilities",
  "updatedAt"
)
SELECT 
  u.id,
  'weather-api',
  '2.1.5',
  'Real-time weather data and forecasts via OpenWeatherMap API - DEMO (NON-FUNCTIONAL)',
  false,
  'DISCONNECTED',
  'STREAMABLE_HTTP',
  'http://weather-service:8080',
  'APIKEY',
  'demo_api_key_12345',
  'X-API-Key',
  false,
  '{"tools": [{"name": "get_current_weather", "description": "🌤️ Get current weather conditions for a specific location"}, {"name": "get_weather_forecast", "description": "📅 Get weather forecast for next 7 days"}, {"name": "get_weather_alerts", "description": "⚠️ Get active weather alerts and warnings"}, {"name": "search_locations", "description": "🗺️ Search for locations by name or coordinates"}, {"name": "get_air_quality", "description": "💨 Get current air quality index and pollutant levels"}], "resources": [{"uri": "weather://current", "name": "Current Weather", "description": "Real-time weather data", "mimeType": "application/json"}, {"uri": "weather://forecast", "name": "Weather Forecast", "description": "7-day weather forecast data", "mimeType": "application/json"}], "prompts": [{"name": "weather_report", "description": "Generate a comprehensive weather report for a location"}]}'::jsonb,
  CURRENT_TIMESTAMP
FROM "public"."User" u 
WHERE u.email = 'demo@example.com'
AND NOT EXISTS (SELECT 1 FROM "public"."MCPServer" s WHERE s."name" = 'weather-api' AND s."userId" = u.id);

-- Success message
DO $$ BEGIN
  RAISE NOTICE 'Demo data initialization completed successfully!';
  RAISE NOTICE 'Demo user: demo@example.com';
  RAISE NOTICE 'MCP Servers: 2 working (memory-daemon, dynamic-mcp-api-daemon) + 2 demo (filesystem-manager, weather-api)';
END $$;
