import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { FromSchema } from 'json-schema-to-ts';
import { llmServices } from '../../../services/llm/index';
import { LlmProvider } from '../../../services/llm/interface';
import { MessageRole } from '@prisma/client';
import { LlmError, LlmAuthError, LlmBadRequestError, LlmRateLimitError, LlmInternalError } from '../../../utils/errors';

enum StreamingMessageType {
  ChatId = 'chatId',
  UserMessage = 'userMessage',
  Reasoning = 'reasoning',
  Code = 'code',
  Markdown = 'markdown',
  Content = 'content',
  Title = 'title',
  Complete = 'complete',
  Error = 'error',
}

const sendMessageBodySchema = {
  type: 'object',
  properties: {
    content: { type: 'string' },
    userId: { type: 'number' },
    provider: { type: 'string', enum: ['openai', 'google'] },
    model: { type: 'string' },
    stream: { type: 'boolean' },
  },
  required: ['content', 'userId'],
} as const;

const sendMessageQuerySchema = {
  type: 'object',
  properties: {
    chatId: { 
      type: 'number',
      minimum: 1
    },
  },
} as const;

export default async function (fastify: FastifyInstance) {
  // OPTIONS /api/message - Handle preflight requests for CORS
  fastify.options('/', async (request, reply) => {
    const origin = request.headers.origin || 'http://localhost:5173';
    reply.header('Access-Control-Allow-Origin', origin);
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name, X-API-Key');
    reply.header('Access-Control-Max-Age', '3600');
    reply.code(200).send();
  });

  // GET /api/message - Get messages for a chat
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
      // Check if chat exists
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

      // Get messages for the chat
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

  // POST /api/message - Send a message
  fastify.post(
    '/',
    {
      schema: {
        body: sendMessageBodySchema,
        querystring: sendMessageQuerySchema,
      },
    },
    async (
      request: FastifyRequest<{
        Body: FromSchema<typeof sendMessageBodySchema>;
        Querystring: FromSchema<typeof sendMessageQuerySchema>;
      }>,
      reply,
    ) => {
      const { content, userId, provider, model, stream = false } = request.body;
      let { chatId } = request.query; // chatId from query params (optional)

      // Get LLM service based on provider (fallback to env variable)
      const selectedProvider = (provider as LlmProvider) || (process.env.LLM_PROVIDER as LlmProvider);
      const llmService = llmServices.get(selectedProvider);
      if (!llmService) {
        return reply.code(400).send({ error: 'Invalid LLM provider specified.' });
      }

      // Fetch user settings for budgets (using userId = 1 for now)
      const settingsUserId = 1;
      let userSettings;
      try {
        userSettings = await fastify.prisma.settings.findUnique({
          where: { userId: settingsUserId }
        });
        
        // If no settings exist, create default ones
        if (!userSettings) {
          userSettings = await fastify.prisma.settings.create({
            data: {
              userId: settingsUserId,
              defaultProvider: 'openai',
              defaultModel: 'o3-mini',
              thinkingBudget: 2048,
              responseBudget: 8192
            }
          });
        }
      } catch (error) {
        fastify.log.error('Failed to fetch user settings:', error);
        // Use default budgets as fallback
        userSettings = {
          thinkingBudget: 2048,
          responseBudget: 8192
        };
      }

      // Set model if provided
      if (model) {
        llmService.setModel(model);
      }
      
      // Set user-specific budgets
      llmService.setBudgets(userSettings.thinkingBudget, userSettings.responseBudget);

      // Create or get chat
      if (!chatId) {
        const chat = await fastify.prisma.chat.create({
          data: {
            userId,
          },
        });
        chatId = chat.id;
      }

      // Handle streaming response
      if (stream) {
        // Prepare user message data but don't save to DB yet
        const userMessageData = {
          content: { text: content, metadata: { provider: selectedProvider, model: model || 'default' } },
          chatId,
          role: MessageRole.USER,
        };
        // Set CORS headers BEFORE starting the stream (critical for SSE)
        const origin = request.headers.origin || 'http://localhost:5173';
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name, X-API-Key');
        reply.header('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, X-Total-Count');
        
        // Set SSE-specific headers
        reply.type('text/event-stream');
        reply.header('Cache-Control', 'no-cache');
        reply.header('Connection', 'keep-alive');
        
        // Send status code and flush headers BEFORE starting to write data
        reply.status(200);
        reply.raw.writeHead(200, {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, X-File-Name, X-API-Key',
          'Access-Control-Expose-Headers': 'Content-Range, X-Content-Range, X-Total-Count',
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        });

        let fullResponse = '';
        let extractedTitle: string | undefined;
          let extractedThoughts: string[] = [];
          let inThought = false;
          let inTitle = false;
          let titleBuffer = '';
        try {
          // Send chat ID first
          reply.raw.write(`data: ${JSON.stringify({ type: StreamingMessageType.ChatId, chatId })}\n\n`);

          // Fetch conversation history from Chat's messages field for context
          const chat = await fastify.prisma.chat.findUnique({
            where: { id: chatId },
            include: { messages: { orderBy: { createdAt: 'asc' } } }
          });

          const conversationHistory = chat!.messages || [];

          // Stream AI response with conversation context
          for await (const chunk of llmService.sendMessageStreamWithHistory(content, conversationHistory)) {
            let contentChunk = chunk;

            // --- Title extraction supporting split chunks ---
              if (!extractedTitle) {
                const titleSegments = contentChunk.split(/(<\/?title>)/i);
                contentChunk = '';
                for (const seg of titleSegments) {
                  if (seg === '') continue;
                  const lower = seg.toLowerCase();
                  if (lower === '<title>') { inTitle = true; continue; }
                  if (lower === '</title>') {
                    inTitle = false;
                    if (titleBuffer.trim()) {
                      extractedTitle = titleBuffer.trim();
                      reply.raw.write(`data: ${JSON.stringify({ type: StreamingMessageType.Title, title: extractedTitle })}\n\n`);
                    }
                    titleBuffer = '';
                    continue;
                  }
                  if (inTitle) {
                    titleBuffer += seg;
                  } else {
                    contentChunk += seg;
                  }
                }
                // If we're still inside title, wait for closing tag (skip rest processing)
                if (inTitle) {
                  continue;
                }
              }

              // Robust reasoning parsing supporting <thought> or <thoughts> tags and mixed content
            // Split chunk by <thought> tags to handle mixed reasoning and answer in the *same* chunk
            const segments = contentChunk.split(/(<\/?thoughts?>)/i);
            for (const seg of segments) {
              if (seg === '') continue;
              const lower = seg.toLowerCase();
              if (lower === '<thought>' || lower === '<thoughts>') { inThought = true; continue; }
              if (lower === '</thought>' || lower === '</thoughts>') { inThought = false; continue; }

              if (inThought) {
                const reasoningText = seg.trim();
                if (reasoningText) {
                  extractedThoughts.push(reasoningText);
                  reply.raw.write(`data: ${JSON.stringify({ type: StreamingMessageType.Reasoning, content: reasoningText })}\n\n`);
                }
              } else {
                const normalText = seg;
                fullResponse += normalText;
                const chunkType = normalText.includes('```') ? StreamingMessageType.Code : StreamingMessageType.Markdown;
                if (normalText) {
                  reply.raw.write(`data: ${JSON.stringify({ type: chunkType, content: normalText })}\n\n`);
                }
              }
            }
            continue;
          }

          // Only save messages to DB after successful streaming completion
          const userMessage = await fastify.prisma.message.create({
            data: userMessageData,
          });

          // Save complete AI message
          const aiMessage = await fastify.prisma.message.create({
            data: {
              content: { text: fullResponse, metadata: { provider: selectedProvider, model: model || 'default' } },
              thoughts: extractedThoughts,
              chatId,
              role: MessageRole.AI,
            },
          });

          // Update chat title if we extracted one
          if (extractedTitle) {
            await fastify.prisma.chat.update({
              where: { id: chatId },
              data: { title: extractedTitle },
            });
          }
          
          // Send user message and completion signal
          reply.raw.write(`data: ${JSON.stringify({ type: StreamingMessageType.UserMessage, message: userMessage })}\n\n`);
          reply.raw.write(`data: ${JSON.stringify({ type: StreamingMessageType.Complete, aiMessage })}\n\n`);
          reply.raw.end();
        } catch (error: unknown) {
          console.error('Streaming LLM error:', error);
          
          let errorMessage = 'Failed to generate response';
          let errorCode: string | undefined = undefined;

          if (error instanceof LlmRateLimitError) {
            errorMessage = error.message;
            errorCode = error.code;
          } else if (error instanceof LlmAuthError) {
            errorMessage = error.message;
            errorCode = error.code;
          } else if (error instanceof LlmBadRequestError) {
            errorMessage = error.message;
            errorCode = error.code;
          } else if (error instanceof LlmInternalError) {
            errorMessage = error.message;
            errorCode = error.code;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }
          
          const errorDetails = {
            type: StreamingMessageType.Error,
            error: errorMessage,
            code: errorCode,
            details: error instanceof Error ? {
              name: error.name,
              stack: error.stack
            } : error
          };
          reply.raw.write(`data: ${JSON.stringify(errorDetails)}\n\n`);
          reply.raw.end();
        }
      } else {
        // Non-streaming response (legacy support)
        try {
          // Save user message first for non-streaming
          const userMessage = await fastify.prisma.message.create({
            data: {
              content: { text: content, metadata: { provider: selectedProvider, model: model || 'default' } },
              chatId,
              role: MessageRole.USER,
            },
          });

          const aiResponse = await llmService.sendMessage(content);

          await fastify.prisma.message.create({
            data: {
              content: { text: aiResponse, metadata: { provider: selectedProvider, model: model || 'default' } },
              chatId,
              role: MessageRole.AI,
            },
          });

          return reply.send({ chatId, userMessage, aiResponse });
        } catch (error: unknown) {
          console.error('Non-streaming LLM error:', error);

          let statusCode = 500;
          let errorMessage = 'Failed to generate response';
          let errorCode: string | undefined = undefined;

          if (error instanceof LlmError) {
            statusCode = error.statusCode;
            errorMessage = error.message;
            errorCode = error.code;
          } else if (error instanceof Error) {
            errorMessage = error.message;
          }

          const errorDetails = {
            error: errorMessage,
            code: errorCode,
            details: error instanceof Error ? {
              name: error.name,
              stack: error.stack
            } : error
          };
          return reply.code(statusCode).send(errorDetails);
        }
      }
    },
  );
}
