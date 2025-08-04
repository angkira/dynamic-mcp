# MCP Configuration Refactoring

This document describes the changes made to move the internal MCP server configuration from hardcoded values to JSON configuration and database initialization.

## Changes Made

### 1. JSON Configuration File

- **File**: `server/src/config/internal-mcp-tools.json`
- **Purpose**: Contains the definition of all internal MCP tools, resources, and server metadata
- **Structure**:
  ```json
  {
    "server": { "name", "version", "description" },
    "tools": [ { "name", "description", "parameters" } ],
    "resources": [ { "uri", "name", "description", "mimeType" } ]
  }
  ```

### 2. Database Initialization

- **File**: `server/src/services/database/databaseInitializer.ts`
- **Purpose**: Automatically runs `init.sql` on startup if database is not initialized
- **Features**:
  - Checks if database tables exist
  - Runs initialization SQL if needed
  - Handles errors gracefully

### 3. Internal MCP Configuration Loader

- **File**: `server/src/services/mcp/internalMCPConfigLoader.ts`
- **Purpose**: Loads and manages internal MCP configuration from JSON
- **Features**:
  - Singleton pattern for efficient loading
  - Type-safe configuration handling
  - Methods to get tools, resources, and capabilities

### 4. Updated Database Schema

- **File**: `docker/db/init.sql`
- **Changes**: Added creation of the internal MCP server record
- **Data**: Includes the `dynamic-mcp-api` server with proper capabilities JSON

### 5. Database Plugin

- **File**: `server/src/plugins/database.ts`
- **Purpose**: Fastify plugin to ensure database initialization on app startup
- **Integration**: Automatically loaded by Fastify's autoload system

### 6. Updated MCP Connection Manager

- **File**: `server/src/services/mcp/mcpConnectionManager.ts`
- **Changes**:
  - Removed hardcoded tool definitions
  - Uses `InternalMCPConfigLoader` to load tools dynamically
  - More maintainable and flexible architecture

## Benefits

1. **Maintainability**: Tool definitions are now in JSON, easier to modify
2. **Consistency**: Database always has the correct internal server configuration
3. **Deployment**: No manual database setup required
4. **Type Safety**: Strong typing for configuration structures
5. **Modularity**: Clear separation of concerns

## Usage

### Development

The database will be automatically initialized when the server starts. If you need to manually test the initialization:

```bash
cd server
npx ts-node test-db-init.ts
```

### Production

The database initialization runs automatically via the database plugin when the application starts.

### Adding New Tools

1. Update `server/src/config/internal-mcp-tools.json`
2. If needed, update the database to reflect new capabilities
3. Restart the application

## Files Structure

```
server/
├── src/
│   ├── config/
│   │   └── internal-mcp-tools.json      # Tool definitions
│   ├── plugins/
│   │   └── database.ts                  # DB initialization plugin
│   └── services/
│       ├── database/
│       │   └── databaseInitializer.ts   # DB init logic
│       └── mcp/
│           ├── internalMCPConfigLoader.ts  # Config loader
│           └── mcpConnectionManager.ts     # Updated manager
├── test-db-init.ts                      # Test script
└── ...
docker/
└── db/
    └── init.sql                         # Updated with internal server
```

## Testing

Run the test script to verify everything works:

```bash
npm run build
npx ts-node test-db-init.ts
```

This will verify:

- Database initialization works
- JSON configuration loads correctly
- Internal MCP server is created in database
- Capabilities are properly formatted
