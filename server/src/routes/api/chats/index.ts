import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { FromSchema } from 'json-schema-to-ts';

const getChatsQuerySchema = {
  type: 'object',
  properties: {
    userId: { type: 'number' },
    page: { type: 'number', minimum: 1 },
    limit: { type: 'number', minimum: 1 },
  },
  required: ['userId'],
} as const;

const deleteChatParamsSchema = {
  type: 'object',
  properties: {
    chatId: { type: 'number', minimum: 1 },
  },
  required: ['chatId'],
} as const;

export default async function (fastify: FastifyInstance) {
  fastify.get('/',
    {
      schema: {
        querystring: getChatsQuerySchema,
      },
    },
    async (
      request: FastifyRequest<{ Querystring: FromSchema<typeof getChatsQuerySchema> }>
    ) => {
      const { userId, page = 1, limit = 10 } = request.query;
      const skip = (page - 1) * limit;

      const [total, chats] = await Promise.all([
        fastify.prisma.chat.count({ where: { userId } }),
        fastify.prisma.chat.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          skip,
          take: limit,
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
        }),
      ]);

      const formattedChats = chats.map(chat => {
        const lastMsg = chat.messages[0];
        const messageText = lastMsg ? (lastMsg.content as any).text : null;
        return {
          id: chat.id,
          title: messageText ?? '',
          userId: chat.userId,
          createdAt: chat.createdAt.toISOString(),
          updatedAt: chat.updatedAt.toISOString(),
          lastMessage: messageText,
          lastMessageAt: lastMsg ? lastMsg.createdAt.toISOString() : null,
        };
      });

      return {
        chats: formattedChats,
        total,
        page,
        limit,
      };
    }
  );

  // DELETE /api/chats/:chatId - Delete a chat by ID
  fastify.delete('/:chatId',
    {
      schema: {
        params: deleteChatParamsSchema,
      },
    },
    async (
      request: FastifyRequest<{ Params: FromSchema<typeof deleteChatParamsSchema> }>,
      reply
    ) => {
      const { chatId } = request.params;

      try {
        // First check if the chat exists
        const existingChat = await fastify.prisma.chat.findUnique({
          where: { id: chatId },
          include: { _count: { select: { messages: true } } }
        });

        if (!existingChat) {
          return reply.code(404).send({
            error: 'Chat not found',
            message: `Chat with ID ${chatId} does not exist`,
            statusCode: 404
          });
        }

        // Delete all messages first, then delete the chat
        await fastify.prisma.message.deleteMany({
          where: { chatId: chatId }
        });

        // Now delete the chat
        await fastify.prisma.chat.delete({
          where: { id: chatId }
        });

        return reply.send({
          success: true,
          message: `Chat ${chatId} deleted successfully`,
          deletedChat: {
            id: existingChat.id,
            userId: existingChat.userId,
            messagesCount: existingChat._count.messages
          }
        });

      } catch (error) {
        console.error('Delete chat error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete chat';
        return reply.code(500).send({
          error: errorMessage,
          message: 'Internal server error while deleting chat',
          statusCode: 500
        });
      }
    }
  );
}