import type { FastifyInstance } from 'fastify';
import { SettingsService } from '../../../services/settingsService';
import { llmServiceFactories } from '../../../services/llm';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request: any, reply) => {
    const userId = request.user?.id as number | undefined
    if (!userId) {
      return reply.send([])
    }

    const service = new SettingsService(fastify.prisma as any)
    const result = await service.getAvailableModels(userId)
    reply.send(result)
  });

  // GET /api/models/providers - list available providers from server config
  fastify.get('/providers', async (_request: any, reply) => {
    const providers = Array.from(llmServiceFactories.keys())
    reply.send(providers)
  })
}
