# Environment Configuration Guide

This guide explains how to set up environment variables for the Dynamic MCP application with MCP daemon services.

## Quick Setup

**For most users**: Copy the example file and edit it:

```bash
cp .env.example .env
# Edit .env and add your API keys
```

## Environment Files Structure

The application uses a single `.env` file that works for both development and production:

- **Development**: Uses Docker service names for internal networking
- **Production**: Same configuration with production optimizations

## Required Environment Variables

### Core Configuration

#### `.env` (Main Configuration)

```bash
# Database Configuration
DATABASE_URL="postgresql://postgres:yourpassword@db:5432/agentdb"
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=agentdb

# AI Provider APIs (required - get from respective providers)
OPENAI_API_KEY="sk-proj-YOUR_OPENAI_API_KEY_HERE"
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

# AI Model Configuration
DEFAULT_MODEL=gemini-2.5-flash
LLM_PROVIDER=google

# Application URLs
VUE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
CLIENT_URL=http://localhost:5173

# MCP Daemon Ports (for HTTP-based MCP services)
MCP_MEMORY_PORT=3001
MCP_API_PORT=3002
```

### 2. Client Environment Files

Create these files in the `client/` directory:

#### `client/.env` (Production)

```bash
# Production Environment
# API Configuration
VUE_API_URL=http://server:3000/api

# Build Configuration
NODE_ENV=production
```

#### `client/.env.dev` (Development)

```bash
# Development Environment
# API Configuration
VUE_API_URL=http://localhost:3000/api

# Build Configuration
NODE_ENV=development
```

## Running the Application

### Development Mode

```bash
# Use development environment
cp .env.dev .env
cp client/.env.dev client/.env

# Start with development docker-compose
docker-compose -f docker-compose.dev.yml up --build
```

### Production Mode

```bash
# Use production environment (or create .env files as shown above)
# .env and client/.env should already be configured for production

# Start with production docker-compose
docker-compose up --build
```

### Local Development (Non-Docker)

```bash
# Server (from root directory)
cp .env.dev .env
cd server
npm run dev

# Client (from client directory)
cp .env.dev .env
cd client
npm run dev
```

## Environment Variable Details

### `VUE_API_URL`

- **Purpose**: Base URL for API calls from the client
- **Development**: `http://localhost:3000/api` (direct connection)
- **Production**: `http://server:3000/api` (Docker service name)
- **Format**: `{protocol}://{host}:{port}/api`

### API Configuration Features

The new configuration system provides:

1. **Automatic Environment Detection**: Fallback to appropriate defaults based on environment
2. **Centralized Configuration**: All API settings in one place
3. **Type Safety**: Full TypeScript support for all API calls
4. **Error Handling**: Comprehensive error handling with timeout support
5. **Flexibility**: Easy to switch between environments

## File Structure

```
project-root/
├── .env                    # Production environment variables
├── .env.dev               # Development environment variables
├── docker-compose.yml     # Production Docker configuration
├── docker-compose.dev.yml # Development Docker configuration
├── client/
│   ├── .env              # Client production environment
│   ├── .env.dev          # Client development environment
│   ├── src/
│   │   ├── config/
│   │   │   └── api.ts    # API configuration
│   │   ├── services/
│   │   │   └── api.ts    # API service layer
│   │   ├── types/        # Organized type definitions
│   │   └── stores/       # Updated Pinia stores
│   └── Dockerfile        # Client Docker configuration
└── server/               # Server configuration (unchanged)
```

## Troubleshooting

### Common Issues

1. **API calls failing**: Verify `VUE_API_URL` matches your server configuration
2. **Environment not loading**: Ensure `.env` files are in correct directories
3. **Docker networking**: In production, use service names, not `localhost`
4. **CORS issues**: The API configuration includes appropriate headers

### Verification

To verify your configuration is working:

1. Check the browser's Network tab for API calls
2. Look for requests going to the correct base URL
3. Verify environment variables in the browser console:
   ```javascript
   console.log('API URL:', import.meta.env.VITE_API_URL);
   ```

## Security Notes

- Never commit `.env` files to version control
- Use strong passwords for database credentials
- Keep API keys secure and rotate them regularly
- Use HTTPS in production environments
