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

  // Login endpoint
  fastify.post('/login', {
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String()
      }),
      response: {
        200: Type.Object({
          token: Type.String(),
          user: Type.Object({
            id: Type.Number(),
            email: Type.String(),
            name: Type.Optional(Type.String())
          })
        }),
        401: Type.Object({
          error: Type.String()
        })
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;
    try {
      const result = await fastify.jwtService.login(email, password);
      if (!result) {
        return reply.status(401).send({ error: 'Invalid credentials' });
      }
      return result;
    } catch (error) {
      fastify.log.error('Login error:', error);
      return reply.status(500).send({ error: 'An error occurred during login' });
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
