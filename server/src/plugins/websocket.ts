import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server, Socket } from 'socket.io';
import { WebSocketMessageHandlerService } from '../services/websocket/messageHandler';
import { LlmProvider, ClientWebSocketEvent } from '@dynamic-mcp/shared';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function websocketPlugin(fastify: FastifyInstance) {
  const messageHandler = new WebSocketMessageHandlerService(fastify);

  // Register fastify-socket.io plugin
  await fastify.register(require('fastify-socket.io'), {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  fastify.ready((err) => {
    if (err) throw err;

    fastify.io.on('connection', (socket: Socket) => {
      fastify.log.info(`Socket connected: ${socket.id}`);

      // TODO: Add authentication logic here

      socket.on(ClientWebSocketEvent.SendMessage, (payload: { content: string; userId: number; chatId?: number; provider?: LlmProvider; model?: string; stream: boolean; isThinking?: boolean }) => {
        messageHandler.handleSendMessage(socket, payload);
      });

      // MCP test connection events
      socket.on('mcp:test:request', async (payload: { serverId: string }) => {
        fastify.log.info(`MCP test request for server ${payload.serverId} from socket ${socket.id}`);
        
        try {
          // Get the MCP service instance from fastify decorators
          const mcpService = (fastify as any).mcpService;
          if (!mcpService) {
            socket.emit('mcp:test:error', {
              serverId: payload.serverId,
              error: 'MCP service not available'
            });
            return;
          }

          // Emit test start to all clients for real-time updates
          fastify.io.emit('mcp:test:start', { serverId: payload.serverId });

          // Perform the actual test
          const result = await mcpService.testConnection(parseInt(payload.serverId));

          // Emit result to all clients
          if (result.success) {
            fastify.io.emit('mcp:test:complete', {
              serverId: payload.serverId,
              success: result.success,
              message: result.message
            });
          } else {
            fastify.io.emit('mcp:test:error', {
              serverId: payload.serverId,
              error: result.message
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error during test';
          fastify.log.error(`MCP test error for server ${payload.serverId}:`, error);
          
          fastify.io.emit('mcp:test:error', {
            serverId: payload.serverId,
            error: errorMessage
          });
        }
      });

      socket.on('mcp:test:start', (payload: { serverId: string }) => {
        fastify.log.info(`MCP test started for server ${payload.serverId} by socket ${socket.id}`);
        // Broadcast to all connected clients for real-time updates
        fastify.io.emit('mcp:test:start', payload);
      });

      socket.on('mcp:test:complete', (payload: { serverId: string; success: boolean; message: string }) => {
        fastify.log.info(`MCP test completed for server ${payload.serverId}: ${payload.success ? 'SUCCESS' : 'FAILED'}`);
        // Broadcast to all connected clients
        fastify.io.emit('mcp:test:complete', payload);
      });

      socket.on('mcp:test:error', (payload: { serverId: string; error: string }) => {
        fastify.log.info(`MCP test error for server ${payload.serverId}: ${payload.error}`);
        // Broadcast to all connected clients
        fastify.io.emit('mcp:test:error', payload);
      });

      socket.on('disconnect', () => {
        fastify.log.info(`Socket disconnected: ${socket.id}`);
      });
    });
  });
}

export default fp(websocketPlugin);