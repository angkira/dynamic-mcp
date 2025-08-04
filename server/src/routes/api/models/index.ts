import type { FastifyInstance } from 'fastify';
import { llmServices } from '../../../services/llm/index';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async (request, reply) => {
    const result: { provider: string; models: { provider: string; model: string }[] }[] = [];
    for (const [provider, service] of llmServices.entries()) {
      try {
        const models = await service.getModels();
        result.push({ provider, models });
      } catch (error) {
        request.log.error(`Failed to get models for provider ${provider}:`, error);
        // Optionally, you could add a placeholder to indicate the failure
        result.push({ provider, models: [] });
      }
    }
    reply.send(result);
  });
}
