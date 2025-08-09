import { FastifyInstance, FastifyPluginOptions } from 'fastify'
import {
  RememberRequestSchema,
  RecallRequestSchema,
  ResetRequestSchema,
  MemoryResponseSchema,
  RecallResponseSchema,
  ResetResponseSchema,
  ApiResponseSchema,
  type RememberRequestType,
  type RecallRequestType,
  type ResetRequestType
} from '../../../schemas/memory.schema'
import MemoryService from '../../../services/memory/memoryService'

export default async function memoryRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Use TypeBox type provider for automatic validation and type inference
  const server = fastify

  // Initialize Memory service
  const memoryService = new MemoryService()

  // POST /api/memory/remember - Store a new memory
  server.post('/remember', {
    schema: {
      body: RememberRequestSchema,
      response: {
        200: ApiResponseSchema(MemoryResponseSchema),
        400: ApiResponseSchema({}),
        500: ApiResponseSchema({})
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as RememberRequestType
      const memory = await memoryService.remember(data)

      return reply.code(200).send({
        success: true,
        data: memory,
        message: 'Memory stored successfully'
      })
    } catch (error) {
      console.error('❌ Remember endpoint error:', error)
      return reply.code(500).send({
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })

  // POST /api/memory/recall - Retrieve memories
  server.post('/recall', {
    schema: {
      body: RecallRequestSchema,
      response: {
        200: ApiResponseSchema(RecallResponseSchema),
        400: ApiResponseSchema({}),
        500: ApiResponseSchema({})
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as RecallRequestType
      const result = await memoryService.recall(data)

      return reply.code(200).send({
        success: true,
        data: result,
        message: `Retrieved ${result.memories.length} memories`
      })
    } catch (error) {
      console.error('❌ Recall endpoint error:', error)
      return reply.code(500).send({
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })

  // POST /api/memory/reset - Delete memories
  server.post('/reset', {
    schema: {
      body: ResetRequestSchema,
      response: {
        200: ApiResponseSchema(ResetResponseSchema),
        400: ApiResponseSchema({}),
        500: ApiResponseSchema({})
      }
    }
  }, async (request, reply) => {
    try {
      const data = request.body as ResetRequestType
      const result = await memoryService.reset(data)

      return reply.code(200).send({
        success: true,
        data: result,
        message: result.message
      })
    } catch (error) {
      console.error('❌ Reset endpoint error:', error)
      return reply.code(500).send({
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })

  // GET /api/memory/stats - Get memory statistics
  server.get('/stats', {
    schema: {
      response: {
        200: ApiResponseSchema({}),
        500: ApiResponseSchema({})
      }
    }
  }, async (_request, reply) => {
    try {
      const stats = await memoryService.getStats()

      return reply.code(200).send({
        success: true,
        data: stats,
        message: 'Memory statistics retrieved successfully'
      })
    } catch (error) {
      console.error('❌ Stats endpoint error:', error)
      return reply.code(500).send({
        success: false,
        data: {},
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })

  // GET /api/memory - Convenience endpoint for basic recall
  server.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          search: { type: 'string' },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 50 },
          offset: { type: 'number', minimum: 0, default: 0 }
        }
      },
      response: {
        200: ApiResponseSchema(RecallResponseSchema),
        500: ApiResponseSchema({})
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any
      const result = await memoryService.recall(query)

      return reply.code(200).send({
        success: true,
        data: result,
        message: `Retrieved ${result.memories.length} memories`
      })
    } catch (error) {
      console.error('❌ Get memories endpoint error:', error)
      return reply.code(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })

  // Cleanup on server close
  fastify.addHook('onClose', async () => {
    await memoryService.close()
  })
}
