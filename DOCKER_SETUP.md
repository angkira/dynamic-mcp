# Docker Setup with Shared Volume

This project now uses Docker volumes to mount the `shared` directory instead of copying it, allowing both client and server to access shared TypeScript code directly.

## Development Setup

For development, use `docker-compose.dev.yml`:

```bash
docker compose -f docker-compose.dev.yml up --build
```

This setup:

- Mounts the `shared` directory as a volume at `/app/shared` in both containers
- Uses development Dockerfiles that don't build/copy source code
- Runs `npm run dev` in both client and server for hot reloading
- Client runs on port 5173, server on port 3000

## Production Setup

For production, use `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml up --build
```

This setup:

- Uses multi-stage production Dockerfiles that copy `shared` during build
- Client serves static files via nginx on port 80
- Server runs compiled JavaScript on port 3000

## Regular Development (no Docker)

You can still run development normally:

```bash
# Install dependencies in all workspaces
npm install

# Start server
cd server && npm run dev

# Start client (in another terminal)
cd client && npm run dev
```

## Shared Directory

The `shared` directory contains TypeScript types and constants used by both client and server:

- No need to build the shared directory separately
- Both client and server import directly from `@shared/*` TypeScript files
- TypeScript path aliases handle the module resolution

## Files Changed

- `client/Dockerfile` - Now development-focused, uses volumes
- `server/Dockerfile` - Now development-focused, uses volumes
- `client/Dockerfile.prod` - Production build with shared copying
- `server/Dockerfile.prod` - Production build with shared copying
- `docker-compose.yml` - Updated with volume mounts
- `docker-compose.dev.yml` - Updated with volume mounts
- `docker-compose.prod.yml` - New production compose file
- `client/tsconfig.app.json` - Updated shared path to `./shared/*`
- `server/tsconfig.json` - Updated shared path to `./shared/*`
- `client/vite.config.ts` - Updated shared alias to `./shared`
