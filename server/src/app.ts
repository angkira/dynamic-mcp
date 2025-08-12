// Ensure runtime module aliases resolve correctly when launched from monorepo root
// Configure aliases programmatically instead of relying on package.json autodetect
// which may read the root package.json without _moduleAliases.
// This must run before other imports.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const moduleAlias = require('module-alias');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('node:path');
moduleAlias.addAliases({
  // At runtime __dirname === /app/dist → one level up is repo root (/app)
  '@shared-prisma': path.join(__dirname, '..', 'shared', 'prisma-client'),
  '@shared': path.join(__dirname, '..', 'shared', 'dist')
});

import { join } from 'node:path';
import { existsSync } from 'node:fs';
import autoload from '@fastify/autoload'
import type { FastifyPluginAsync, FastifyInstance, FastifyPluginOptions } from 'fastify'
import root from './routes/root'; // Import the root route handler
import modelsRoute from './routes/api/models'; // Import models route handler
import chatsRoute from './routes/api/chats'; // Import chats route handler
import configRoute from './routes/api/config'; // Import config route handler
import messageRoute from './routes/api/message'; // Import message route handler
import settingsRoute from './routes/api/settings'; // Import settings route handler
import mcpRoute from './routes/api/mcp'; // Import MCP route handler
import memoryRoute from './routes/api/memory'; // Import Memory route handler
import authRoute from './routes/api/auth'; // Import Auth route handler
import { loggerConfig } from './config/logger';
import JWTMiddleware from './middleware/jwtMiddleware';
import { createAuthService } from './services/auth/authService';
import InitializationService from './services/initializationService';
import * as dotenv from 'dotenv';

// Load environment variables
// Priority: ENV_FILE if provided (e.g., ".env.dev" via nodemon) → development default .env.dev → fallback .env
const providedEnv = process.env.ENV_FILE;
if (providedEnv) {
  dotenv.config({ path: join(process.cwd(), providedEnv) });
} else if (process.env.NODE_ENV === 'development') {
  const devEnvPath = join(__dirname, '..', '.env.dev');
  if (existsSync(devEnvPath)) {
    dotenv.config({ path: devEnvPath });
  } else {
    dotenv.config();
  }
} else {
  dotenv.config();
}

declare module 'fastify' {
  interface FastifyInstance {
    jwtService: InstanceType<typeof import('./services/auth/jwtService').default>;
    jwtMiddleware: InstanceType<typeof import('./middleware/jwtMiddleware').default>;
    authService: InstanceType<typeof import('./services/auth/authService').AuthService>;
  }
}

// __dirname is available in CommonJS modules
export const options = {
  logger: loggerConfig,
};

export default (async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Defer DB-heavy initialization to after server starts listening
  fastify.addHook('onReady', async () => {
    setTimeout(async () => {
      try {
        const initService = new InitializationService();
        const { token, user } = await initService.initialize();
        fastify.log.info(`🔐 Demo user auto-authenticated: ${user.email}`);
        fastify.log.info(`🎟️ Demo token: ${token.substring(0, 20)}...`);
      } catch (err) {
        fastify.log.error({ err }, 'Initialization failed; continuing without demo bootstrap');
      }
    }, 0);
  });

  // Create JWT middleware instance
  const jwtMiddleware = new JWTMiddleware();

  // Store JWT service on fastify instance for use in routes
  const jwtService = jwtMiddleware.getJWTService();
  fastify.decorate('jwtService', jwtService);
  fastify.decorate('jwtMiddleware', jwtMiddleware);
  // Expose high-level authService
  fastify.decorate('authService', createAuthService(jwtService));

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  await fastify.register(autoload, {
    dir: join(__dirname, 'plugins'),
    options: { ...opts },
    encapsulate: false,
    maxDepth: 1,
  });

  // Register auth routes (no JWT required)
  await fastify.register(authRoute, { prefix: '/api/auth' });

  // Register the root route separately (no JWT required)
  await fastify.register(root, { prefix: '/' });

  // JWT-protected routes
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip JWT for certain routes
    const url = request.url.split('?')[0]; // Remove query parameters for matching
    const publicRoutes = ['/api/auth', '/health', '/docs'];
    const isRootRoute = url === '/';
    const isPublicRoute = publicRoutes.some(route => url.startsWith(route)) || isRootRoute;

    if (!isPublicRoute) {
      await jwtMiddleware.authenticate(request, reply);
    }
  });

  // Register specific API routes (JWT protected)
  await fastify.register(modelsRoute, { prefix: '/api/models' });
  await fastify.register(chatsRoute, { prefix: '/api/chats' });
  await fastify.register(configRoute, { prefix: '/api/config' });
  await fastify.register(messageRoute, { prefix: '/api/message' });
  const userRoute = (await import('./routes/api/user')).default
  await fastify.register(userRoute, { prefix: '/api/user' });

  await fastify.register(settingsRoute, { prefix: '/api/settings' });

  await fastify.register(mcpRoute, { prefix: '/api/mcp' });

  // Memory API removed in favor of Redis-backed MCP memory server
}) satisfies FastifyPluginAsync

// Start the server if this file is run directly
if (require.main === module) {
  const start = async () => {
    try {
      const fastify = (await import('fastify')).default;
      const app = fastify(options);

      // Apply the app configuration
      await exports.default(app, {});

      const port = parseInt(process.env.PORT || '8080');
      const host = process.env.HOST || '0.0.0.0';

      await app.listen({ port, host });
      console.log(`🚀 Main server listening on http://${host}:${port}`);
    } catch (err) {
      console.error('Error starting server:', err);
      process.exit(1);
    }
  };

  start();
}