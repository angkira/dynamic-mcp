import type { FastifyInstance, FastifyRequest } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.options('/', async (request, reply) => {
    const origin = request.headers.origin || 'http://localhost:5173';
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name, X-API-Key');
    reply.header('Access-Control-Max-Age', '3600');
    reply.code(200).send();
  });

  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          chatId: { type: 'number', minimum: 1 },
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 }
        },
        required: ['chatId']
      }
    }
  }, async (
    request: FastifyRequest<{
      Querystring: { chatId: number; page?: number; limit?: number };
    }>,
    reply
  ) => {
    const { chatId, page = 1, limit = 50 } = request.query;
    const skip = (page - 1) * limit;

    try {
      const chat = await fastify.prisma.chat.findUnique({
        where: { id: chatId }
      });

      if (!chat) {
        return reply.code(404).send({
          error: 'Chat not found',
          message: `Chat with ID ${chatId} does not exist`,
          statusCode: 404
        });
      }

      const [total, messages] = await Promise.all([
        fastify.prisma.message.count({ where: { chatId } }),
        fastify.prisma.message.findMany({
          where: { chatId },
          orderBy: { createdAt: 'asc' },
          skip,
          take: limit
        })
      ]);

      return reply.send({
        messages,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });

    } catch (error) {
      console.error('Get messages error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to get messages';
      return reply.code(500).send({
        error: errorMessage,
        message: 'Internal server error while fetching messages',
        statusCode: 500
      });
    }
  });
}
