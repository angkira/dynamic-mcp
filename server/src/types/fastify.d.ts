import { PrismaClient } from '@prisma/client';
import type McpService from '../services/mcp/mcpService';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    mcpService?: McpService;
  }
}
