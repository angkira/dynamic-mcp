import { FastifyInstance } from 'fastify';

export default async function configRoutes(fastify: FastifyInstance) {
  // GET /api/config/default - Get default provider and model configuration
  fastify.get('/default', async () => {
    const defaultProvider = process.env.LLM_PROVIDER || 'google';
    const defaultModel = process.env.DEFAULT_MODEL || 'gemini-2.5-flash';

    return {
      provider: defaultProvider,
      model: defaultModel
    };
  });

  fastify.put('/default', async (request) => {
    const { provider, model } = request.body as { provider: string; model: string };

    process.env.LLM_PROVIDER = provider;
    process.env.DEFAULT_MODEL = model;

    return {
      provider: process.env.LLM_PROVIDER,
      model: process.env.DEFAULT_MODEL
    };
  });
}