# Dynamic MCP - Model Context Protocol Management System

Dynamic MCP is an innovative system that allows you to **register and manage MCP (Model Context Protocol) servers directly through chat conversations**. This revolutionary approach eliminates the need for complex configuration files or manual server setup.

## 🚀 Key Features

### 🎯 **Chat-Based MCP Registration**

- **Register MCP servers by simply talking to the AI** - no configuration files needed
- **Automatic server discovery and configuration** through conversational interface
- **Real-time connection testing** and health monitoring via WebSocket
- **Visual server management** with connection status indicators

### 🏗️ **Dual Architecture Support**

- **Legacy STDIO Transport**: Traditional process-based MCP servers
- **Modern HTTP Daemon Services**: Containerized HTTP-based MCP servers
- **Seamless coexistence** of both architectures for gradual migration
- **Performance comparison** capabilities between transport types

### 🛠️ **Built-in MCP Servers**

- **Memory System**: Persistent memory across conversations with categorization
- **Dynamic MCP API**: Self-managing MCP server registration and administration
- **HTTP Daemon Versions**: High-performance containerized variants of internal servers

### 🔧 **Advanced Management**

- **WebSocket-based health checking** for real-time status updates
- **Database-driven configuration** with PostgreSQL persistence
- **Docker containerization** for scalable deployment
- **Hot-reload capabilities** for development

## 🏃‍♂️ Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for development)
- Git

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd dynamic-mcp
```

### 2. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:yourpassword@db:5432/agentdb"
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=agentdb

# AI Provider APIs (choose one or both)
OPENAI_API_KEY="your-openai-api-key"
GEMINI_API_KEY="your-gemini-api-key"

# AI Model Configuration
DEFAULT_MODEL=gemini-2.5-flash
LLM_PROVIDER=google

# Application URLs
VUE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173

# MCP Daemon Ports
MCP_MEMORY_PORT=3001
MCP_API_PORT=3002
```

### 3. Launch the System

```bash
# Start all services (database, server, client, MCP daemons)
docker-compose -f docker-compose.dev.yml up -d

# Watch logs (optional)
docker-compose -f docker-compose.dev.yml logs -f
```

### 4. Access the Application

- **Web Interface**: http://localhost:5173
- **API Server**: http://localhost:3000
- **Memory Daemon**: http://localhost:3001/health
- **API Daemon**: http://localhost:3002/health

## 🎯 How to Register MCP Servers via Chat

This is the **core innovation** of Dynamic MCP - you can register and manage MCP servers simply by talking to the AI:

### Example Conversations:

**Register a new MCP server:**

```
User: "I want to add a new MCP server for weather data. It's located at https://api.weather.com/mcp and uses API key authentication."

AI: "I'll register a new weather MCP server for you. Let me set it up with STREAMABLE_HTTP transport and API key authentication..."
```

**Check server status:**

```
User: "Show me all my MCP servers and their connection status"

AI: "Here are your current MCP servers:
- memory: ✅ Connected (STDIO)
- dynamic-mcp-api: ✅ Connected (STDIO)
- memory-daemon: ✅ Connected (HTTP)
- weather-api: ❌ Disconnected (HTTP)"
```

**Manage servers:**

```
User: "Disable the weather server and test the memory daemon connection"

AI: "I've disabled the weather server and testing the memory daemon... ✅ Memory daemon is responding correctly."
```

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Vue.js Client │────│  Fastify Server  │────│   PostgreSQL    │
│   (Port 5173)   │    │   (Port 3000)    │    │   Database      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                │ WebSocket + HTTP
                                │
                    ┌───────────┼───────────┐
                    │                       │
            ┌───────▼────────┐    ┌────────▼────────┐
            │ Memory Daemon  │    │  API Daemon     │
            │  (Port 3001)   │    │  (Port 3002)    │
            └────────────────┘    └─────────────────┘
```

### Core Components:

1. **Client (Vue.js + TypeScript)**
   - Chat interface for MCP management
   - Real-time server status monitoring
   - WebSocket communication for live updates

2. **Server (Fastify + TypeScript)**
   - RESTful API for application logic
   - WebSocket server for real-time communication
   - MCP connection management and health checking
   - Database integration with Prisma ORM

3. **Database (PostgreSQL)**
   - MCP server configurations and metadata
   - User settings and chat history
   - Memory storage for persistent AI memory

4. **MCP Daemon Services**
   - **Memory Daemon**: HTTP-based memory management
   - **API Daemon**: HTTP-based MCP server administration
   - Health endpoints for monitoring
   - Containerized for scalability

## 🔧 Development

### Project Structure

```
dynamic-mcp/
├── client/                 # Vue.js frontend
│   ├── src/
│   │   ├── stores/mcp.ts  # MCP management store
│   │   └── services/      # API and WebSocket services
│   └── package.json
├── server/                 # Fastify backend
│   ├── src/
│   │   ├── services/mcp/  # MCP connection management
│   │   ├── mcp-servers/   # Built-in MCP servers
│   │   └── plugins/       # WebSocket and other plugins
│   └── package.json
├── shared/                 # Shared TypeScript types
├── prisma/                 # Database schema and migrations
└── docker/                 # Database initialization
```

### Development Commands

```bash
# Install dependencies for all packages
npm install

# Start development servers
npm run dev:client  # Vue.js dev server
npm run dev:server  # Fastify dev server with hot reload

# Database operations
npm run db:migrate  # Apply database migrations
npm run db:seed     # Seed database with default data

# Build for production
npm run build:client
npm run build:server
```

## 🌐 Environment Variables

### Required Variables

| Variable         | Description                             | Example                               |
| ---------------- | --------------------------------------- | ------------------------------------- |
| `DATABASE_URL`   | PostgreSQL connection string            | `postgresql://user:pass@host:port/db` |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI)        | `sk-proj-...`                         |
| `GEMINI_API_KEY` | Google Gemini API key (if using Gemini) | `AIzaSy...`                           |

### Optional Configuration

| Variable          | Description                        | Default            |
| ----------------- | ---------------------------------- | ------------------ |
| `DEFAULT_MODEL`   | AI model to use                    | `gemini-2.5-flash` |
| `LLM_PROVIDER`    | AI provider (`openai` or `google`) | `google`           |
| `MCP_MEMORY_PORT` | Memory daemon port                 | `3001`             |
| `MCP_API_PORT`    | API daemon port                    | `3002`             |

## 🚀 Production Deployment

```bash
# Build and start production containers
docker-compose -f docker-compose.prod.yml up -d

# Scale MCP daemons if needed
docker-compose -f docker-compose.prod.yml up -d --scale mcp-memory=2
```

## 🛠️ MCP Server Types

### Built-in Servers

1. **Memory System**
   - **STDIO Version**: `memory` - Traditional process-based
   - **HTTP Version**: `memory-daemon` - High-performance HTTP daemon
   - **Tools**: `memory_remember`, `memory_recall`, `memory_reset`

2. **Dynamic MCP API**
   - **STDIO Version**: `dynamic-mcp-api` - Traditional process-based
   - **HTTP Version**: `dynamic-mcp-api-daemon` - HTTP daemon
   - **Tools**: Server management, connection testing, configuration

### External Servers

Register any MCP-compatible server through chat:

- File system servers
- API integration servers
- Database connection servers
- Custom business logic servers

## 🔍 Monitoring and Debugging

### Health Checks

- **Memory Daemon**: `http://localhost:3001/health`
- **API Daemon**: `http://localhost:3002/health`
- **Main Server**: `http://localhost:3000/health`

### Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f server
docker-compose logs -f mcp-memory
docker-compose logs -f mcp-api
```

### Database Access

```bash
# Connect to database
docker-compose exec db psql -U postgres -d agentdb

# View MCP servers
SELECT name, status, "transportType", "transportBaseUrl" FROM "MCPServer";
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

[Add your license information here]

## 🆘 Troubleshooting

### Common Issues

**MCP servers showing as disconnected:**

- Check that daemon containers are running: `docker-compose ps`
- Verify health endpoints are responding
- Check container logs for connection errors

**Database connection issues:**

- Ensure PostgreSQL container is running
- Verify DATABASE_URL in .env file
- Check database initialization logs

**WebSocket connection failures:**

- Verify VITE_SOCKET_URL matches server address
- Check for CORS configuration issues
- Ensure server WebSocket plugin is loaded

For more help, check the logs or open an issue in the repository.
