# Dynamic MCP - Model Context Protocol Management System

Dynamic MCP is an innovative system that allows you to **register and manage MCP (Model Context Protocol) servers directly through chat conversations**. This revolutionary approach eliminates the need for complex configuration files or manual server setup.

## 🚀 Key Features

### 🎯 **Chat-Based MCP Registration**

**Automatic polling for enabled MCP servers**: The system periodically checks and reconnects to enabled MCP servers that are not yet connected or healthy, ensuring late-starting daemons are detected and connected automatically.

### 🏗️ **Dual Architecture Support**

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

## 🔐 Authentication System

Dynamic MCP uses **JWT (JSON Web Token) authentication** to secure all API endpoints and MCP server communications. The system provides both demo access for quick testing and full authentication capabilities.

### 🎭 Demo User Access

For immediate testing and demonstration purposes, the system provides **one-click demo authentication**:

```typescript
// Demo login - no credentials required
const response = await authService.getDemoToken();
// Returns: { token: "jwt-token", user: { id: "demo", email: "demo@example.com", ... } }
```

**Demo User Features:**

- **Auto-creation**: Demo user is automatically created on first request
- **Persistent**: Demo user and data persist across sessions
- **Full Access**: Complete access to all MCP functionality
- **JWT Integration**: Uses the same JWT system as regular users

### 🛡️ JWT Token System

**Token Management:**

- **Storage**: Tokens stored in browser `sessionStorage` for security
- **Expiration**: Automatic token validation with expiry checking
- **Auto-refresh**: Seamless token verification on API requests
- **Logout Cleanup**: Complete token removal on logout

**Security Features:**

- **Bearer Authentication**: All API requests use `Authorization: Bearer <token>`
- **Middleware Protection**: Server-side JWT verification on protected routes
- **MCP Integration**: JWT authentication extends to all MCP server communications
- **CORS Security**: Proper CORS configuration for cross-origin requests

### 🔑 Authentication Flow

```typescript
// 1. Demo Authentication (Quick Start)
const demoAuth = await authService.getDemoToken();

// 2. Regular Login (Full Implementation)
const loginAuth = await authService.login({
  email: 'user@example.com',
  password: 'password',
});

// 3. Token Verification
const user = await authService.verifyToken();

// 4. Authenticated API Requests
const data = await authService.authenticatedRequest('/api/mcp-servers');
```

### 🏗️ MCP Server Authentication

All MCP servers in the system are **JWT-aware**:

**Database Configuration:**

```sql
-- MCPServer model with authentication type
CREATE TABLE "MCPServer" (
  "authType" "MCPAuthType" DEFAULT 'BEARER'  -- JWT Bearer token auth
  -- ... other fields
);
```

**Server Integration:**

- **Dynamic MCP API Server**: JWT-protected endpoints with user context
- **Memory Daemon**: JWT verification for memory operations
- **External Servers**: Configurable authentication per server
- **User Context**: JWT payload provides user ID for data isolation

### 🔧 Implementation Details

**Client-Side (`/client/src/services/auth.ts`):**

- `AuthService` class with comprehensive token management
- Automatic URL construction with environment variable support
- Error handling with custom `AuthError` class
- Session storage integration for token persistence

**Server-Side (`/server/src/services/auth/jwtService.ts`):**

- `JWTService` with token generation and verification
- User management with automatic demo user creation
- JWT middleware for route protection
- Integration with Prisma for user persistence

**MCP Integration (`/server/src/mcp-servers/`):**

- JWT-aware MCP server implementations
- User context extraction from JWT tokens
- Protected MCP tool execution
- Database queries scoped to authenticated user

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
│                 │    │                  │    │                 │
│ JWT Auth Store  │    │ JWT Middleware   │    │ Users & Tokens  │
│ AuthService     │    │ Auth Routes      │    │ MCP Servers     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                        JWT Protected WebSocket + HTTP
                                │
                    ┌───────────┼───────────┐
                    │                       │
            ┌───────▼────────┐    ┌────────▼────────┐
            │ Memory Daemon  │    │  API Daemon     │
            │  (Port 3001)   │    │  (Port 3002)    │
            │                │    │                 │
            │ JWT Verified   │    │ JWT Verified    │
            │ User Context   │    │ User Context    │
            └────────────────┘    └─────────────────┘
```

### Core Components:

1. **Client (Vue.js + TypeScript)**
   - Chat interface for MCP management
   - **JWT Authentication**: Token-based auth with session storage
   - **Auth Service**: Comprehensive authentication management
   - **Demo Login**: One-click demo access for testing
   - Real-time server status monitoring
   - WebSocket communication for live updates

2. **Server (Fastify + TypeScript)**
   - RESTful API for application logic
   - **JWT Service**: Token generation, verification, and user management
   - **Auth Middleware**: Route protection with Bearer token validation
   - **Demo User System**: Automatic demo user creation and management
   - WebSocket server for real-time communication
   - MCP connection management and health checking
   - Database integration with Prisma ORM

3. **Database (PostgreSQL)**
   - **User Management**: JWT-authenticated user accounts
   - **Token Persistence**: Session and refresh token storage
   - MCP server configurations and metadata with user isolation
   - User settings and chat history
   - Memory storage for persistent AI memory

4. **MCP Daemon Services**
   - **Memory Daemon**: HTTP-based memory management with JWT protection
   - **API Daemon**: HTTP-based MCP server administration with user context
   - **JWT Integration**: All daemons verify JWT tokens for user isolation
   - Health endpoints for monitoring
   - Containerized for scalability

## 🔧 Development

### Project Structure

```
dynamic-mcp/
├── client/                 # Vue.js frontend
│   ├── src/
│   │   ├── services/
│   │   │   └── auth.ts    # JWT authentication service
│   │   ├── stores/
│   │   │   ├── mcp.ts     # MCP management store
│   │   │   └── user.ts    # User authentication store
│   │   ├── components/
│   │   │   └── auth/      # Authentication UI components
│   │   └── router/        # Route guards and navigation
│   └── package.json
├── server/                 # Fastify backend
│   ├── src/
│   │   ├── services/
│   │   │   └── auth/
│   │   │       └── jwtService.ts  # JWT token management
│   │   ├── routes/
│   │   │   └── api/
│   │   │       └── auth.ts        # Authentication endpoints
│   │   ├── middleware/
│   │   │   └── auth.ts            # JWT middleware
│   │   ├── services/mcp/          # MCP connection management
│   │   ├── mcp-servers/           # Built-in MCP servers (JWT-enabled)
│   │   └── plugins/               # WebSocket and other plugins
│   └── package.json
├── shared/                 # Shared TypeScript types
│   └── types/
│       └── auth.ts         # Authentication type definitions
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # User and MCP server models
│   └── migrations/         # Database migration history
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
| `JWT_SECRET`     | JWT signing secret (auto-generated)     | `your-256-bit-secret`                 |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI)        | `sk-proj-...`                         |
| `GEMINI_API_KEY` | Google Gemini API key (if using Gemini) | `AIzaSy...`                           |

### Optional Configuration

| Variable          | Description                        | Default                 |
| ----------------- | ---------------------------------- | ----------------------- |
| `JWT_EXPIRES_IN`  | JWT token expiration time          | `24h`                   |
| `DEFAULT_MODEL`   | AI model to use                    | `gemini-2.5-flash`      |
| `LLM_PROVIDER`    | AI provider (`openai` or `google`) | `google`                |
| `MCP_MEMORY_PORT` | Memory daemon port                 | `3001`                  |
| `MCP_API_PORT`    | API daemon port                    | `3002`                  |
| `VITE_API_URL`    | Client API base URL                | `http://localhost:3000` |

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

## TODO

- **Interactive tools** - interactive tools widgets - from regular confirmation to the data collection
- **Internet access** - live chat retrieving the data from the real world, helping you to generate your MCP

## 📝 License

[Add your license information here]

## 🆘 Troubleshooting

### Common Issues

**Authentication failures:**

- **Demo login not working**: Check client logs for URL construction issues
- **Token expired errors**: Tokens expire after 24h, use demo login to get fresh token
- **CORS errors on auth**: Verify `VITE_API_URL` matches server address in client environment
- **JWT secret missing**: Server auto-generates JWT_SECRET if not provided

**MCP servers showing as disconnected:**

- Check that daemon containers are running: `docker-compose ps`
- Verify health endpoints are responding
- Check container logs for connection errors
- Ensure JWT tokens are valid for MCP daemon authentication

**Database connection issues:**

- Ensure PostgreSQL container is running
- Verify DATABASE_URL in .env file
- Check database initialization logs
- Verify user table exists for JWT authentication

**WebSocket connection failures:**

- Verify VITE_SOCKET_URL matches server address
- Check for CORS configuration issues
- Ensure server WebSocket plugin is loaded
- Confirm JWT token is valid for WebSocket connections

For more help, check the logs or open an issue in the repository.
