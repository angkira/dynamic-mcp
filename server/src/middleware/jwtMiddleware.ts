import type { FastifyRequest, FastifyReply } from 'fastify';
import JWTService, { type JWTPayload } from '../services/auth/jwtService';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      email: string;
      name?: string;
    };
  }
}

export class JWTMiddleware {
  private jwtService: JWTService;

  constructor() {
    this.jwtService = new JWTService();
  }

  /**
   * JWT authentication middleware
   */
  async authenticate(request: FastifyRequest, reply: FastifyReply) {
    try {
      const authHeader = request.headers.authorization;
      const token = this.jwtService.extractTokenFromHeader(authHeader);

      if (!token) {
        return reply.status(401).send({ 
          error: 'Authorization header missing or invalid format'
        });
      }

      const payload = this.jwtService.verifyToken(token);
      if (!payload) {
        return reply.status(401).send({ 
          error: 'Invalid or expired token'
        });
      }

      // Attach user info to request
      request.user = {
        id: payload.userId,
        email: payload.email,
        name: payload.name
      };

    } catch (error) {
      console.error('JWT authentication error:', error);
      return reply.status(401).send({ 
        error: 'Authentication failed'
      });
    }
  }

  /**
   * Get JWT service instance
   */
  getJWTService(): JWTService {
    return this.jwtService;
  }
}

export default JWTMiddleware;
