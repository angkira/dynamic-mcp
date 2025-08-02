import { join } from 'node:path';
import AutoLoad from '@fastify/autoload';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import root from './routes/root'; // Import the root route handler
import modelsRoute from './routes/api/models'; // Import models route handler
import chatsRoute from './routes/api/chats'; // Import chats route handler
import configRoute from './routes/api/config'; // Import config route handler
import messageRoute from './routes/api/message'; // Import message route handler
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// __dirname is available in CommonJS modules
export const options = {};

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Place here your custom code!

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: { ...opts },
    encapsulate: false,
    maxDepth: 1,
  });

  // Register the root route separately
  await fastify.register(root, { prefix: '/' });

  // Register specific API routes
  await fastify.register(modelsRoute, { prefix: '/api/models' });
  await fastify.register(chatsRoute, { prefix: '/api/chats' });
  await fastify.register(configRoute, { prefix: '/api/config' });
  await fastify.register(messageRoute, { prefix: '/api/message' });
  
  // Import and register settings route
  const settingsRoute = await import('./routes/api/settings');
  await fastify.register(settingsRoute.default, { prefix: '/api/settings' });
}