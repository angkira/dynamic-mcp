import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';

export default async function authRoute(fastify: FastifyInstance) {
  
  // Get demo token endpoint
  fastify.get('/demo-token', {
    schema: {
      response: {
        200: Type.Object({
          token: Type.String(),
          user: Type.Object({
            id: Type.Number(),
            email: Type.String(),
            name: Type.Optional(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    try {
      // Generate token for demo user
      const { token, user } = await fastify.jwtService.ensureDemoUserWithToken();
      
      return { token, user };
    } catch (error) {
      fastify.log.error('Error generating demo token:', error);
      return reply.status(500).send({ error: 'Failed to generate demo token' });
    }
  });

  // Verify token endpoint
  fastify.get('/verify', {
    preHandler: [fastify.jwtMiddleware.authenticate.bind(fastify.jwtMiddleware)],
    schema: {
      response: {
        200: Type.Object({
          valid: Type.Boolean(),
          user: Type.Object({
            id: Type.Number(),
            email: Type.String(),
            name: Type.Optional(Type.String())
          })
        })
      }
    }
  }, async (request, reply) => {
    return {
      valid: true,
      user: request.user!
    };
  });
}
