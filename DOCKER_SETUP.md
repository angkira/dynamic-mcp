# Clean Docker Setup for Monorepo

This project uses a clean, modern Docker setup that properly handles the monorepo structure with shared dependencies and separate MCP server processes.

## Key Improvements ✨

- **No unnecessary copying** - Uses volume mounts for development
- **Proper monorepo support** - Handles shared packages correctly
- **Separate MCP servers** - Each MCP server runs as its own service/process
- **No random users** - Removed the weird `expressjs` user nonsense
- **Clean builds** - Simple, understandable Dockerfiles

## Development Setup

Start everything with hot reloading:

```bash
# Start all services (includes separated MCP servers)
docker compose up --build

# Or use the specific dev compose file
docker compose -f docker-compose.dev.yml up --build
```

This setup:

- **Database**: PostgreSQL with health checks
- **Server**: Main API server with hot reload
- **MCP Memory**: Separate memory server process
- **MCP API**: Separate dynamic MCP API server process
- **Client**: Frontend with hot reload

All services have proper dependency management and health checks.

## Production Setup

For production deployment:

```bash
docker compose -f docker-compose.prod.yml up --build
```

This setup:

- Uses multi-stage builds for optimization
- Separate containers for each MCP server
- Nginx for client static file serving
- No development dependencies

## Local Development (No Docker)

You can still develop locally without Docker:

```bash
# Install dependencies
npm install

# Start database (you'll need PostgreSQL)
# Update your .env with local database URL

# Generate Prisma client
npx prisma generate

# Start main server
cd server && npm run dev

# Start MCP servers (separate terminals)
./scripts/mcp-manager.sh start

# Start client (separate terminal)
cd client && npm run dev
```

## MCP Server Management

Use the provided script to manage MCP servers locally:

```bash
# Start all MCP servers
./scripts/mcp-manager.sh start

# Stop all MCP servers
./scripts/mcp-manager.sh stop

# Restart all MCP servers
./scripts/mcp-manager.sh restart

# Check status
./scripts/mcp-manager.sh status

# Just build without starting
./scripts/mcp-manager.sh build
```

## Architecture

```
dynamic-mcp/
├── client/           # Vue.js frontend
├── server/           # Main Fastify API server
│   └── src/mcp-servers/  # MCP server implementations
├── shared/           # Shared TypeScript types/constants
├── prisma/           # Database schema
└── scripts/          # Management scripts
```

### Volume Mounts (Development)

- **Entire workspace** mounted to `/app` in containers
- **node_modules** preserved via anonymous volumes
- **Prisma client** generated at runtime
- **Hot reload** works for all services

### Separate Processes

Each MCP server runs as its own process/container:

- `mcp-memory`: Memory persistence server
- `mcp-api`: Dynamic MCP API server
- `server`: Main application server
- `client`: Frontend application

## Environment Variables

Create a `.env` file:

```env
# Database
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=dynamic_mcp

# API
VUE_API_URL=http://localhost:3000

# LLM (if needed)
OPENAI_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
LLM_PROVIDER=openai
```

## MCP Daemon Services 🚀

The MCP servers now run as **HTTP daemon services** for better containerized architecture:

### Service Ports:

- **Memory MCP Server** (`port 3001`): Memory persistence operations
- **Dynamic MCP API Server** (`port 3002`): MCP server management
- **Main Server** (`port 3000`): Main application API
- **Client** (`port 5173`): Frontend application

### Memory MCP Daemon (port 3001):

```bash
# Health check
curl http://localhost:3001/health

# Store memory
curl -X POST http://localhost:3001/tools/memory_remember \
  -H "Content-Type: application/json" \
  -d '{"content": "Test memory", "key": "test"}'

# Recall memory
curl -X POST http://localhost:3001/tools/memory_recall \
  -H "Content-Type: application/json" \
  -d '{"key": "test"}'
```

### Dynamic MCP API Daemon (port 3002):

```bash
# Health check
curl http://localhost:3002/health

# List MCP servers
curl http://localhost:3002/servers

# List available tools
curl http://localhost:3002/tools
```

### Testing All Daemons:

```bash
# Run comprehensive tests
npm run mcp:test

# Or test manually
./scripts/test-mcp-daemons.sh
```

## What Was Fixed

1. **Removed unnecessary file copying** - Now uses proper volume mounts
2. **Eliminated the random `expressjs` user** - No need for custom users in development
3. **Simplified Dockerfiles** - Clean, readable, and maintainable
4. **Proper monorepo handling** - Shared dependencies work correctly
5. **Converted MCP servers to HTTP daemons** - Each runs as independent HTTP service
6. **Added health checks** - Proper service orchestration
7. **Cleaned up builds** - No duplicate Prisma generation or shared copying
8. **Fixed Socket.IO** - Proper URL configuration and CORS setup
