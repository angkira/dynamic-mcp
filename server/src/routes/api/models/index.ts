import type { FastifyInstance } from 'fastify';
import { llmServices } from '../../../services/llm/index';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', async () => {
    const result: { provider: string; models: { provider: string; model: string }[] }[] = [];
    for (const [provider, service] of llmServices.entries()) {
      const models = await service.getModels();
      result.push({ provider, models });
    }
    return result;
  });
}
