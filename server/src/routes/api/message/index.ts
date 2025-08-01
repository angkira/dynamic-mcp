import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { FromSchema } from 'json-schema-to-ts';
import { llmServices } from '../../../services/llm/index';
import { LlmProvider } from '../../../services/llm/interface';
import { MessageRole } from '@prisma/client';

const sendMessageBodySchema = {
  type: 'object',
  properties: {
    content: { type: 'string' },
    userId: { type: 'number' },
  },
  required: ['content', 'userId'],
} as const;

const sendMessageParamsSchema = {
  type: 'object',
  properties: {
    chatId: { type: 'number' },
  },
} as const;

export default async function (fastify: FastifyInstance) {
  const provider = process.env.LLM_PROVIDER as LlmProvider;
  const llmService = llmServices.get(provider);
  if (!llmService) {
    throw new Error('Invalid LLM provider specified in environment variables.');
  }

  fastify.post(
    '/:chatId?',
    {
      schema: {
        body: sendMessageBodySchema,
        params: sendMessageParamsSchema,
      },
    },
    async (
      request: FastifyRequest<{
        Body: FromSchema<typeof sendMessageBodySchema>;
        Params: FromSchema<typeof sendMessageParamsSchema>;
      }>,
      reply,
    ) => {
      const { content, userId } = request.body;
      let { chatId } = request.params;

      if (!chatId) {
        const chat = await fastify.prisma.chat.create({
          data: {
            userId,
          },
        });
        chatId = chat.id;
      }

      await fastify.prisma.message.create({
        data: {
          content,
          chatId,
          role: MessageRole.USER,
        },
      });

      const aiResponse = await llmService.sendMessage(content);

      const aiMessage = await fastify.prisma.message.create({
        data: {
          content: aiResponse,
          chatId,
          role: MessageRole.AI,
        },
      });

      return reply.send(aiMessage);
    },
  );
}
