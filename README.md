# Dynamic MCP - Model Context Protocol Management System
[![Deploy server to Cloud Run](https://github.com/angkira/dynamic-mcp/actions/workflows/deploy-gcp.yml/badge.svg?branch=main)](https://github.com/angkira/dynamic-mcp/actions/workflows/deploy-gcp.yml)
[![Deploy server to Cloud Run](https://github.com/angkira/dynamic-mcp/actions/workflows/deploy-gcp.yml/badge.svg)](https://github.com/angkira/dynamic-mcp/actions/workflows/deploy-gcp.yml)

Dynamic MCP is an innovative system that allows you to **register and manage MCP (Model Context Protocol) servers directly through chat conversations**. This revolutionary approach eliminates the need for complex configuration files or manual server setup.

## 🚀 Key Features

### 🎯 **Chat-Based MCP Registration**

**Automatic polling for enabled MCP servers**: The system periodically checks and reconnects to enabled MCP servers that are not yet connected or healthy, ensuring late-starting daemons are detected and connected automatically.

### 🏗️ **Dual Architecture Support**

- **Performance comparison** capabilities between transport types

### 🧩 **MCP Architecture**

- **Global MCP Registry + Per-User Enablement**: MCP servers are defined globally and referenced per user via `Settings.mcpEnabledServerIds`. Ownership is tracked with `MCPServer.createdBy`.
- **Ownership Semantics**: If a user owns a server (`createdBy === userId`), delete removes it globally; non-owners only remove it from their enabled list.
- **User-Aware Connections**: Connection manager connects only to servers enabled for the current user and honors per-user limits and auto-connect.

### 🛠️ **Built-in MCP Servers**

- **Memory System**: Persistent memory across conversations with categorization
- **Dynamic MCP API**: Self-managing MCP server registration and administration
- **HTTP Daemon Versions**: High-performance containerized variants of internal servers

### 🔧 **Advanced Management**

- **WebSocket-based health checking** for real-time status updates
- **Database-driven configuration** with PostgreSQL persistence
- **Provider-driven models**: Providers and models are dynamically listed based on saved API keys.
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

### 🔗 OAuth (Google & GitHub)

Dynamic MCP supports OAuth login with Google and GitHub. The flow is fully server-initiated and redirects back to the client with a one-time JWT.

Server endpoints:

- Start flow
  - `GET /api/auth/oauth/google` → returns `{ url }` (Google consent URL)
  - `GET /api/auth/oauth/github` → returns `{ url }` (GitHub consent URL)
- Callback (server exchanges code → creates/links user → issues JWT)
  - `GET /api/auth/oauth/google/callback?code=...&state=...`
  - `GET /api/auth/oauth/github/callback?code=...&state=...`
- On success, server redirects to client: `/login?token=<JWT>`

Client handling:

- `useUserStore.loginWithOAuth(provider)` fetches the provider URL and navigates the browser to it
- On client `/login`, we read the `token` query param and call `applyTokenFromUrl(token)` to store JWT and load the user

Environment variables:

- Google
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_OAUTH_REDIRECT_URI` (e.g., `http://localhost:3000/api/auth/oauth/google/callback`)
- GitHub
  - `GITHUB_OAUTH_CLIENT_ID`
  - `GITHUB_OAUTH_CLIENT_SECRET`

User linking rules:

- On first OAuth login, we create a user with the provider email. Subsequent logins link via provider user id (stored internally).
- If a user later sets a password, email/password login is also available.

Profile & password endpoints (JWT required):

- `GET /api/auth/me` → `{ user, hasPassword }`
- `PATCH /api/user/profile` → update `name`, `email`
- `PATCH /api/user/password` → set/change password (requires current password if one exists)

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
- Global MCP servers with per-user enablement (no per-row user scoping)

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
   - MCP connection management and health checking (per-user enablement)
   - Database integration with Prisma ORM

3. **Database (PostgreSQL)**
   - **User Management**: JWT-authenticated user accounts
   - **Settings**: Per-user preferences and secrets (provider API keys). New fields:
     - `mcpEnabledServerIds Int[]`: list of enabled MCP server IDs for this user
   - **MCP Servers**: Globally defined; ownership tracked via `createdBy` (nullable for system/core servers)
   - Chat history and persistent memory storage

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
| `VITE_SOCKET_URL` | Socket URL (falls back to API URL) | `http://localhost:3000` |

## 🚀 Production Deployment
There are two supported ways to run in production:

- Local docker-compose (single host)
  ```bash
  docker-compose -f docker-compose.prod.yml up -d
  ```

- Cloud Run (recommended)
  - Single-stage image (`server/Dockerfile.gcp`) builds shared + server and runs from `/app/dist`
  - Build + deploy with:
    ```bash
    PROJECT_ID=... REGION=europe-west3 SERVICE_NAME=dynamic-mcp-server \
    bash server/gcp/08-build-and-deploy.sh
    ```
  - Optional HTTPS LB + custom domain: see `server/gcp/README.md`

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
## 🧭 Provider & Models

- Providers are discovered from server configuration (`/api/models/providers`).
- Provider API keys are saved in `Settings` per user and masked in responses.
- `GET /api/models` lists models only for providers with valid API keys.
- After saving API keys, the client refreshes models and ensures the default provider points to one with available models.

## 🔗 MCP Ownership & Enablement

- MCP servers are global. Users enable/disable by ID via `Settings.mcpEnabledServerIds`.
- Create: `createdBy` is set to the current user; server ID is appended to their enabled list.
- Delete:
  - If `createdBy === userId`: disconnect, delete globally, and remove from all users’ enabled lists.
  - Else: only remove the ID from the caller’s enabled list.
- Connection manager connects only to enabled servers for the active user and auto-reconnects per user.

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
- **Welcome message** - instructions, guide, tools and capabilities overview
- **Fastify:5 migration** - usage of up-to-date libs is important
- **Google / GitHub sign up** - must have in 2025

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

---

## ⚙️ CI/CD (GitHub → Cloud Run)

- Workflow: `.github/workflows/deploy-gcp.yml`
- Auth: Google Workload Identity Federation (WIF)
  - GitHub secret `GCP_WIF_PROVIDER` must be set to the provider resource, e.g.:
    `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-pool/providers/github-actions`
  - GitHub secret `GCP_DEPLOY_SA` is the deploy service account email that has `roles/run.admin`, `roles/cloudbuild.builds.editor`, `roles/artifactregistry.writer`, `roles/secretmanager.secretAccessor` (and `roles/cloudsql.client` if needed)
- Required repo secrets: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ARTIFACT_REPO`, `GCP_RUN_SERVICE`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`

## 🌐 Cloudflare Worker proxy (client)

- Worker proxies `/api` and `/socket.io` to `env.BACKEND_URL` (see `client/src/worker.ts`)
- Set Worker secret `BACKEND_URL` to your origin:
  - Temporary: Cloud Run URL (e.g., `https://...run.app`)
  - Final: your LB domain (e.g., `https://api.mcp-test.dev`) once the GCP managed cert is ACTIVE
- Client build should use `VITE_API_URL=/api` so the browser talks only to the Worker

## 🧠 Memory storage

- Memory MCP server now uses Redis (with password auth) via envs: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- Docker compose includes a Redis service in both dev and prod files

