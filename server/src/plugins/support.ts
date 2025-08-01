import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

async function supportPlugin(fastify: FastifyInstance) {
  fastify.decorate('someSupport', () => 'hugs');
}

export default fp(supportPlugin);