import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server, Socket } from 'socket.io';
import { WebSocketMessageHandlerService } from '../services/websocket/messageHandler';
import { LlmProvider, ClientWebSocketEvent } from '@dynamic-mcp/shared';

interface AuthenticatedSocket extends Socket {
  userId: number;
  userEmail: string;
}

interface McpTestPayload {
  serverId: string;
}

interface SendMessagePayload {
  content: string;
  chatId?: number;
  provider?: LlmProvider;
  model?: string;
  stream: boolean;
  isThinking?: boolean;
}

interface McpTestResult {
  success: boolean;
  message: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function websocketPlugin(fastify: FastifyInstance): Promise<void> {
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

      // JWT Authentication middleware for WebSocket
      const authenticateSocket = async (socket: Socket): Promise<{ userId: number; userEmail: string } | null> => {
        try {
          // Try to get token from auth handshake
          const token = socket.handshake.auth?.token || 
                       socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                       socket.handshake.query?.token;

          if (!token) {
            fastify.log.warn(`Socket ${socket.id} attempted connection without token`);
            return null;
          }

          // Verify token using JWT service
          const jwtService = fastify.jwtService;
          const decoded = jwtService.verifyToken(token);
          
          if (!decoded) {
            fastify.log.warn(`Socket ${socket.id} token verification failed`);
            return null;
          }
          
          fastify.log.info(`Socket ${socket.id} authenticated as user ${decoded.userId} (${decoded.email})`);
          return {
            userId: decoded.userId,
            userEmail: decoded.email
          };
        } catch (error) {
          fastify.log.error(`Socket ${socket.id} authentication failed:`, error);
          return null;
        }
      };

      // Authenticate the socket connection
      authenticateSocket(socket).then((authResult) => {
        if (!authResult) {
          // Authentication failed
          socket.emit('unauthorized', { message: 'Authentication failed' });
          socket.disconnect(true);
          return;
        }

        // Store user info on socket
        const authenticatedSocket = socket as AuthenticatedSocket;
        authenticatedSocket.userId = authResult.userId;
        authenticatedSocket.userEmail = authResult.userEmail;

        // Emit successful authentication
        socket.emit('authenticated', { 
          userId: authResult.userId,
          email: authResult.userEmail 
        });

        // Register authenticated event handlers
        registerSocketHandlers(authenticatedSocket, messageHandler, fastify);
      }).catch((error) => {
        fastify.log.error(`Socket authentication error for ${socket.id}:`, error);
        socket.emit('error', { message: 'Authentication error' });
        socket.disconnect(true);
      });
    });
  });
}

function registerSocketHandlers(
  socket: AuthenticatedSocket,
  messageHandler: WebSocketMessageHandlerService,
  fastify: FastifyInstance
): void {
  
  socket.on(ClientWebSocketEvent.SendMessage, (payload: SendMessagePayload) => {
    // Add userId from authenticated socket to payload
    const enrichedPayload = {
      ...payload,
      userId: socket.userId
    };
    messageHandler.handleSendMessage(socket, enrichedPayload);
  });

  // MCP test connection events
  socket.on('mcp:test:request', async (payload: McpTestPayload) => {
    fastify.log.info(`MCP test request for server ${payload.serverId} from authenticated user ${socket.userId} (socket ${socket.id})`);
    
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

      // Perform the actual test with user context
      const result: McpTestResult = await mcpService.testConnection(parseInt(payload.serverId), socket.userId);

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
      fastify.log.error(`MCP test error for server ${payload.serverId} by user ${socket.userId}:`, error);
      
      fastify.io.emit('mcp:test:error', {
        serverId: payload.serverId,
        error: errorMessage
      });
    }
  });

  socket.on('mcp:test:start', (payload: McpTestPayload) => {
    fastify.log.info(`MCP test started for server ${payload.serverId} by authenticated user ${socket.userId} (socket ${socket.id})`);
    // Broadcast to all connected clients for real-time updates
    fastify.io.emit('mcp:test:start', payload);
  });

  socket.on('mcp:test:complete', (payload: { serverId: string; success: boolean; message: string }) => {
    fastify.log.info(`MCP test completed for server ${payload.serverId} by user ${socket.userId}: ${payload.success ? 'SUCCESS' : 'FAILED'}`);
    // Broadcast to all connected clients
    fastify.io.emit('mcp:test:complete', payload);
  });

  socket.on('mcp:test:error', (payload: { serverId: string; error: string }) => {
    fastify.log.info(`MCP test error for server ${payload.serverId} by user ${socket.userId}: ${payload.error}`);
    // Broadcast to all connected clients
    fastify.io.emit('mcp:test:error', payload);
  });

  socket.on('disconnect', () => {
    fastify.log.info(`Authenticated socket disconnected: ${socket.id} (user ${socket.userId})`);
  });
}

export default fp(websocketPlugin);