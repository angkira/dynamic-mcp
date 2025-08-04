import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { WebSocketMessageHandlerService } from '../services/websocket/messageHandler';
import { LlmProvider, ClientWebSocketEvent } from '@dynamic-mcp/shared';

declare module 'fastify' {
  interface FastifyInstance {
    io: Server;
  }
}

async function websocketPlugin(fastify: FastifyInstance) {
  const messageHandler = new WebSocketMessageHandlerService(fastify);

  fastify.decorate('io', new Server(fastify.server, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  }));

  fastify.io.on('connection', (socket) => {
    fastify.log.info(`Socket connected: ${socket.id}`);

    // TODO: Add authentication logic here

    socket.on(ClientWebSocketEvent.SendMessage, (payload: { content: string; userId: number; chatId?: number; provider?: LlmProvider; model?: string; stream: boolean; isThinking?: boolean }) => {
      messageHandler.handleSendMessage(socket, payload);
    });

    socket.on('disconnect', () => {
      fastify.log.info(`Socket disconnected: ${socket.id}`);
    });
  });

  fastify.addHook('onClose', (instance, done) => {
    instance.io.close();
    done();
  });
}

export default fp(websocketPlugin);