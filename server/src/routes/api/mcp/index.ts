import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type, Static } from '@sinclair/typebox'
import {
  CreateMCPServerSchema,
  UpdateMCPServerSchema,
  UpdateMCPServerStatusSchema,
  MCPServerParamsSchema,
  MCPServerResponseSchema,
  ApiResponseSchema,
  type CreateMCPServerType,
  type UpdateMCPServerType,
  type UpdateMCPServerStatusType,

} from '../../../schemas/mcp.schema'
import McpService from '../../../services/mcp/mcpService'

// Global MCP service instance
let mcpService: McpService

export default async function mcpRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  
  // Use TypeBox type provider for automatic validation and type inference
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>()
  
  // Initialize MCP service
  if (!mcpService) {
    mcpService = new McpService(fastify)
    await mcpService.initialize()
    
    // Make MCP service available globally on the fastify instance
    fastify.decorate('mcpService', mcpService)
  }
  
  // GET /api/mcp - Get all MCP servers for the current user
  server.get('/', {
    schema: {
      response: {
        200: ApiResponseSchema(Type.Array(MCPServerResponseSchema))
      }
    }
  }, async (_request, reply) => {
    try {
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      const servers = await mcpService.getServers(userId)

      return reply.code(200).send({ 
        success: true, 
        data: servers
      })
    } catch (error) {
      console.error('Error fetching MCP servers:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to fetch MCP servers' 
      })
    }
  })

  // POST /api/mcp - Create a new MCP server
  server.post('/', {
    schema: {
      body: CreateMCPServerSchema,
      response: {
        201: ApiResponseSchema(Type.Object({ id: Type.String() }))
      }
    }
  }, async (request, reply) => {
    try {
      const validatedData = request.body as CreateMCPServerType
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      const createdServer = await mcpService.createServer(validatedData, userId)

      return reply.code(201).send({ 
        success: true, 
        data: { id: createdServer.id },
        message: 'MCP server created successfully' 
      })
    } catch (error) {
      console.error('Error creating MCP server:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to create MCP server' 
      })
    }
  })

  // GET /api/mcp/:id - Get a specific MCP server
  server.get('/:id', {
    schema: {
      params: MCPServerParamsSchema,
      response: {
        200: ApiResponseSchema(MCPServerResponseSchema)
      }
    }
  }, async (request: FastifyRequest<{ Params: Static<typeof MCPServerParamsSchema> }>, reply) => {
    try {
      const serverId = parseInt(request.params.id)
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      const server = await mcpService.getServer(serverId, userId)

      if (!server) {
        return reply.code(404).send({ 
          success: false,
          data: null,
          message: 'MCP server not found' 
        })
      }

      return reply.code(200).send({ 
        success: true, 
        data: server
      })
    } catch (error) {
      console.error('Error fetching MCP server:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to fetch MCP server' 
      })
    }
  })

  // PUT /api/mcp/:id - Update an MCP server
  server.put('/:id', {
    schema: {
      params: MCPServerParamsSchema,
      body: UpdateMCPServerSchema,
      response: {
        200: ApiResponseSchema(Type.Object({ message: Type.String() }))
      }
    }
  }, async (request: FastifyRequest<{ Params: Static<typeof MCPServerParamsSchema>, Body: UpdateMCPServerType }>, reply) => {
    try {
      const serverId = parseInt(request.params.id)
      const validatedData = request.body
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      await mcpService.updateServer(serverId, validatedData, userId)

      return reply.code(200).send({ 
        success: true,
        data: null,
        message: 'MCP server updated successfully' 
      })
    } catch (error) {
      console.error('Error updating MCP server:', error)
      
      const statusCode = error instanceof Error && error.message === 'MCP server not found' ? 404 : 500
      const message = statusCode === 404 ? 'MCP server not found' : 'Failed to update MCP server'
      
      return reply.code(statusCode).send({ 
        success: false,
        data: null,
        message 
      })
    }
  })

  // PATCH /api/mcp/:id/status - Update server status
  server.patch('/:id/status', {
    schema: {
      params: MCPServerParamsSchema,
      body: UpdateMCPServerStatusSchema,
      response: {
        200: ApiResponseSchema(Type.Object({ message: Type.String() }))
      }
    }
  }, async (request: FastifyRequest<{ Params: Static<typeof MCPServerParamsSchema>, Body: UpdateMCPServerStatusType }>, reply) => {
    try {
      const serverId = parseInt(request.params.id)
      const validatedData = request.body
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      const lastConnected = validatedData.lastConnected ? new Date(validatedData.lastConnected) : undefined

      await mcpService.updateServerStatus(serverId, validatedData.status, lastConnected, userId)

      return reply.code(200).send({ 
        success: true,
        data: null,
        message: 'MCP server status updated successfully' 
      })
    } catch (error) {
      console.error('Error updating MCP server status:', error)
      
      const statusCode = error instanceof Error && error.message === 'MCP server not found' ? 404 : 500
      const message = statusCode === 404 ? 'MCP server not found' : 'Failed to update MCP server status'
      
      return reply.code(statusCode).send({ 
        success: false,
        data: null,
        message 
      })
    }
  })

  // DELETE /api/mcp/:id - Delete an MCP server
  server.delete('/:id', {
    schema: {
      params: MCPServerParamsSchema,
      response: {
        200: ApiResponseSchema(Type.Object({ message: Type.String() }))
      }
    }
  }, async (request: FastifyRequest<{ Params: Static<typeof MCPServerParamsSchema> }>, reply) => {
    try {
      const serverId = parseInt(request.params.id)
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      await mcpService.deleteServer(serverId, userId)

      return reply.code(200).send({ 
        success: true,
        data: null,
        message: 'MCP server deleted successfully' 
      })
    } catch (error) {
      console.error('Error deleting MCP server:', error)
      
      const statusCode = error instanceof Error && error.message === 'MCP server not found' ? 404 : 500
      const message = statusCode === 404 ? 'MCP server not found' : 'Failed to delete MCP server'
      
      return reply.code(statusCode).send({ 
        success: false,
        data: null,
        message 
      })
    }
  })

  // POST /api/mcp/:id/test - Test MCP server connection
  server.post('/:id/test', {
    schema: {
      params: MCPServerParamsSchema,
      response: {
        200: ApiResponseSchema(Type.Object({ 
          success: Type.Boolean(),
          message: Type.String() 
        }))
      }
    }
  }, async (request: FastifyRequest<{ Params: Static<typeof MCPServerParamsSchema> }>, reply) => {
    try {
      const serverId = parseInt(request.params.id)
      // TODO: Get userId from authentication middleware
      const userId = 1 // Hardcoded for now

      const result = await mcpService.testConnection(serverId, userId)

      return reply.code(200).send({ 
        success: true,
        data: result,
        message: result.message
      })
    } catch (error) {
      console.error('Error testing MCP server connection:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to test MCP server connection' 
      })
    }
  })

  // GET /api/mcp/tools - Get all available tools from connected MCP servers
  server.get('/tools', {
    schema: {
      response: {
        200: ApiResponseSchema(Type.Array(Type.Object({
          name: Type.String(),
          description: Type.String(),
          serverName: Type.String(),
          serverId: Type.Number(),
          inputSchema: Type.Any()
        })))
      }
    }
  }, async (_request, reply) => {
    try {
      const tools = await mcpService.getAvailableToolsForLLM()

      return reply.code(200).send({ 
        success: true,
        data: tools
      })
    } catch (error) {
      console.error('Error fetching MCP tools:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to fetch MCP tools' 
      })
    }
  })

  // GET /api/mcp/resources - Get all available resources from connected MCP servers
  server.get('/resources', {
    schema: {
      response: {
        200: ApiResponseSchema(Type.Array(Type.Object({
          uri: Type.String(),
          name: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          mimeType: Type.Optional(Type.String()),
          serverName: Type.String(),
          serverId: Type.Number()
        })))
      }
    }
  }, async (_request, reply) => {
    try {
      const resources = await mcpService.getAvailableResourcesForLLM()

      return reply.code(200).send({ 
        success: true,
        data: resources
      })
    } catch (error) {
      console.error('Error fetching MCP resources:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to fetch MCP resources' 
      })
    }
  })

  // GET /api/mcp/status - Get connection status for all servers
  server.get('/status', {
    schema: {
      response: {
        200: ApiResponseSchema(Type.Array(Type.Object({
          serverId: Type.Number(),
          serverName: Type.String(),
          isConnected: Type.Boolean(),
          lastConnected: Type.Optional(Type.String())
        })))
      }
    }
  }, async (_request, reply) => {
    try {
      const status = mcpService.getConnectionStatus()

      return reply.code(200).send({ 
        success: true,
        data: status
      })
    } catch (error) {
      console.error('Error fetching MCP status:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to fetch MCP status' 
      })
    }
  })

  // POST /api/mcp/refresh - Refresh all MCP connections
  server.post('/refresh', {
    schema: {
      response: {
        200: ApiResponseSchema(Type.Object({ message: Type.String() }))
      }
    }
  }, async (_request, reply) => {
    try {
      await mcpService.refreshConnections()

      return reply.code(200).send({ 
        success: true,
        data: null,
        message: 'MCP connections refreshed successfully' 
      })
    } catch (error) {
      console.error('Error refreshing MCP connections:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to refresh MCP connections' 
      })
    }
  })

  // GET /api/mcp/health - Health check for all MCP connections
  server.get('/health', {
    schema: {
      response: {
        200: ApiResponseSchema(Type.Array(Type.Object({
          serverId: Type.Number(),
          serverName: Type.String(),
          healthy: Type.Boolean(),
          error: Type.Optional(Type.String())
        })))
      }
    }
  }, async (_request, reply) => {
    try {
      const healthStatus = await mcpService.healthCheck()

      return reply.code(200).send({ 
        success: true,
        data: healthStatus
      })
    } catch (error) {
      console.error('Error checking MCP health:', error)
      return reply.code(500).send({ 
        success: false,
        data: null,
        message: 'Failed to check MCP health' 
      })
    }
  })
}

// Export the MCP service for use in other parts of the application
export { mcpService }