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

### Register a New MCP Server

```
User: "I want to add a new MCP server for file operations. It's a local server that I can run with 'npx @modelcontextprotocol/server-filesystem' and it should connect to my documents folder."
```

### Test Server Connections

```
User: "Test the connection to the memory server"
```

### Manage Server Status

```
User: "Disable the filesystem server temporarily"
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

Test the HTTP daemon services:

```bash
# Test memory MCP daemon
curl http://localhost:3001/health

# Test API MCP daemon
curl http://localhost:3002/health

# Test main server
curl http://localhost:3000/api/health
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
