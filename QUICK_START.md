# Quick Start Guide

## 🚀 Automated Setup (Recommended)

Use our quick start script for automatic setup:

```bash
./quick-start.sh
```

This script will:

1. Create `.env` file from template (if needed)
2. Build all Docker containers
3. Start the complete system
4. Provide access URLs and monitoring commands

## 🚀 Manual Docker Setup

Start everything with separated MCP daemon services:

```bash
# Copy environment template
cp .env.example .env
# Edit .env and add your API keys

# Start all services
docker-compose -f docker-compose.dev.yml up -d
```

This starts:

- **PostgreSQL database** (port 5432) - Data persistence
- **Main Fastify server** (port 3000) - API and WebSocket server
- **Memory MCP daemon** (port 3001) - HTTP-based memory service
- **API MCP daemon** (port 3002) - HTTP-based MCP management service
- **Vue.js client** (port 5173) - Chat interface for MCP management

## 🎯 First Steps: Register MCP Servers via Chat

Once the system is running, visit http://localhost:5173 and try these conversations:

### View Current Servers

```
User: "Show me all my MCP servers and their status"
```

### Register a New MCP Server with Default Endpoints

```
User: "I want to add a new MCP server for file operations. It's a local server that I can run with 'npx @modelcontextprotocol/server-filesystem' and it should connect to my documents folder."
```

### Register with Custom Endpoints

```
User: "Add a weather API server at https://weather-mcp.api.com with custom endpoints: use /api/call for tool execution, /status for health checks, and /capabilities for tool discovery."
```

### Update Endpoint Configuration

```
User: "Change the filesystem server to use /fs/health for health checks instead of /health"
```

### Test Server Connections

```
User: "Test the connection to the memory server and verify all endpoints are working"
```

### Advanced Configuration

```
User: "Create a database server with these endpoints: /db/execute for tools, /db/ping for health, /db/schema for discovery, and /db/tables for resources"
```

## 🔧 Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Start main server
npm run dev:server

# Start MCP servers (separate terminal)
npm run mcp:start

# Start client (separate terminal)
npm run dev:client
```

## 📦 MCP Daemon Management

```bash
# Start all MCP daemon services
npm run mcp:start

# Stop all MCP daemon services
npm run mcp:stop

# Restart MCP daemon services
npm run mcp:restart

# Check daemon status
npm run mcp:status

# Test daemon health endpoints
npm run mcp:test
```

## 🔍 Service Testing

Test the HTTP daemon services and their configurable endpoints:

```bash
# Test memory MCP daemon (default endpoints)
curl http://localhost:3001/health          # Health check
curl http://localhost:3001/tools           # Tool discovery
curl -X POST http://localhost:3001/call-tool \
  -H "Content-Type: application/json" \
  -d '{"name": "memory_recall", "arguments": {"search": "test"}}'

# Test API MCP daemon (default endpoints)  
curl http://localhost:3002/health          # Health check
curl http://localhost:3002/tools           # Tool discovery

# Test main server
curl http://localhost:3000/api/health      # Main API health

# Test custom endpoint configurations (after setup)
curl http://your-server:port/custom/health  # Custom health endpoint
curl http://your-server:port/custom/tools   # Custom discovery endpoint
```

## 🏗️ Production

```bash
npm run docker:prod
```

## 🧹 Cleanup

```bash
# Stop containers
npm run docker:down

# Clean everything (containers, volumes, images)
npm run docker:clean
```

## 📁 Project Structure

```
dynamic-mcp/
├── client/           # Vue.js frontend
├── server/           # Main Fastify server + MCP servers
├── shared/           # Shared TypeScript types
├── prisma/           # Database schema
└── scripts/          # Management scripts
```

The setup is now clean, with proper monorepo handling and separated MCP daemon services running as HTTP proxies!
