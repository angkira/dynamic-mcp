# Quick Start Guide

## 🚀 Development with Docker (Recommended)

Start everything with separated MCP servers:

```bash
npm run docker:dev
```

This starts:

- PostgreSQL database (port 5432)
- Main server (port 3000)
- Memory MCP daemon (port 3001)
- API MCP daemon (port 3002)
- Client frontend (port 5173)

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
