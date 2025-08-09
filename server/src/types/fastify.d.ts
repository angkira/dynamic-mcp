import { PrismaClient } from '@shared-prisma';
import type McpService from '../services/mcp/mcpService';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    mcpService?: McpService;
  }
}
