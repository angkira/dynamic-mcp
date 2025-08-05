require('module-alias/register');

import { join } from 'node:path';
import AutoLoad from '@fastify/autoload';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
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
import InitializationService from './services/initializationService';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

declare module 'fastify' {
  interface FastifyInstance {
    jwtService: InstanceType<typeof import('./services/auth/jwtService').default>;
    jwtMiddleware: InstanceType<typeof import('./middleware/jwtMiddleware').default>;
  }
}

// __dirname is available in CommonJS modules
export const options = {
  logger: loggerConfig,
};

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Initialize JWT service and demo user
  const initService = new InitializationService();
  const { token, user } = await initService.initialize();
  
  console.log(`🔐 Demo user auto-authenticated: ${user.email}`);
  console.log(`🎟️ Demo token: ${token.substring(0, 20)}...`);

  // Create JWT middleware instance
  const jwtMiddleware = new JWTMiddleware();

  // Store JWT service on fastify instance for use in routes
  fastify.decorate('jwtService', jwtMiddleware.getJWTService());
  fastify.decorate('jwtMiddleware', jwtMiddleware);

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  await fastify.register(AutoLoad, {
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
    // Skip JWT for certain routes - need to be more specific with route matching
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
  
  await fastify.register(settingsRoute, { prefix: '/api/settings' });
  
  await fastify.register(mcpRoute, { prefix: '/api/mcp' });
  
  await fastify.register(memoryRoute, { prefix: '/api/memory' });
}

// Start the server if this file is run directly
if (require.main === module) {
  const start = async () => {
    try {
      const fastify = (await import('fastify')).default;
      const app = fastify(options);
      
      // Apply the app configuration
      await exports.default(app, {});
      
      const port = parseInt(process.env.PORT || '3000');
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