import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server, Socket } from 'socket.io';
import { WebSocketMessageHandlerService } from '../services/websocket/messageHandler';
import { LlmProvider, ClientWebSocketEvent } from '@dynamic-mcp/shared';

interface AuthenticatedSocket extends Socket {
  userId: number;
  userEmail: string;
}

interface SendMessagePayload {
  content: string;
  chatId?: number;
  provider?: LlmProvider;
  model?: string;
  stream: boolean;
  isThinking?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function websocketPlugin(fastify: FastifyInstance): Promise<void> {
  const messageHandler = new WebSocketMessageHandlerService(fastify);

  // Build CORS origins list from environment and defaults
  const defaultOrigins = [
    process.env.CLIENT_URL || "http://localhost:5173",  // Development
    "http://localhost",      // Production client (nginx)
    "http://localhost:80",   // Production client (nginx) with port
    "http://localhost:5173", // Development fallback
    "http://127.0.0.1",      // Alternative localhost
    "http://127.0.0.1:80"    // Alternative with port
  ];

  // Parse additional origins from environment
  const envOrigins = process.env.CORS_ORIGINS || '';
  const additionalOrigins = envOrigins
    .split(',')
    .map(origin => origin.trim())
    .filter(origin => origin.length > 0);

  const allowedOrigins = [...defaultOrigins, ...additionalOrigins];

  fastify.log.info('WebSocket CORS allowed origins:', allowedOrigins);

  // Create Socket.IO server manually and attach to Fastify's underlying server
  const io = new Server(fastify.server, {
    path: '/socket.io/',
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  })

  // Decorate instance
  fastify.decorate('io', io)

  io.on('connection', (socket: Socket) => {
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

      // Join a user-specific room for targeted events (utility only, no business logic)
      try {
        const userRoom = `user:${authResult.userId}`;
        authenticatedSocket.join(userRoom);
        fastify.log.debug(`Socket ${socket.id} joined room ${userRoom}`);
      } catch (e) {
        fastify.log.warn(`Failed to join user room for socket ${socket.id}:`, e);
      }

      // Register authenticated event handlers
      registerSocketHandlers(authenticatedSocket, messageHandler, fastify);
    }).catch((error) => {
      fastify.log.error(`Socket authentication error for ${socket.id}:`, error);
      socket.emit('error', { message: 'Authentication error' });
      socket.disconnect(true);
    });
  })

  fastify.addHook('onClose', async () => {
    await io.close()
  })
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

  socket.on('disconnect', () => {
    fastify.log.info(`Authenticated socket disconnected: ${socket.id} (user ${socket.userId})`);
  });
}

export default fp(websocketPlugin);