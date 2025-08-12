import { PrismaClient } from '@shared-prisma';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

async function prismaPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  // Do not block startup on DB connection; Prisma lazily connects on first query
  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    await server.prisma.$disconnect().catch(() => undefined);
  });
}

export default fp(prismaPlugin);