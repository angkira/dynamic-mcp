import type { FastifyInstance } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async () => ({ root: true }));
  
  // Health check endpoint for Docker health checks
  fastify.get('/health', async () => ({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'dynamic-mcp-server'
  }));
}