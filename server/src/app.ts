import { join } from 'node:path';
import AutoLoad from '@fastify/autoload';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
// __dirname is available in CommonJS modules
export const options = {};

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Place here your custom code!

  // Do not touch the following lines

  // This loads all plugins defined in plugins
  // those should be support plugins that are reused
  // through your application
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'plugins'),
    options: { ...opts },
    encapsulate: false,
    maxDepth: 1,
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  await fastify.register(AutoLoad, {
    dir: join(__dirname, 'routes'),
    options: { ...opts },
  });
}