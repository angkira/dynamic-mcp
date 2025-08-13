import type { FastifyInstance } from 'fastify';
// Ensure cookie types are augmented for request/reply
// Import cookie module so Fastify types include cookie helpers on request/reply
import '@fastify/cookie'
import { Type } from '@sinclair/typebox';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export default async function authRoute(fastify: FastifyInstance) {
  // Sign up endpoint
  fastify.post('/signup', {
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String({ minLength: 6 }),
        name: Type.Optional(Type.String())
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
        400: Type.Object({ message: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { email, password, name } = request.body as { email: string; password: string; name?: string };
    try {
      const result = await fastify.authService.signup(email, password, name);
      return result;
    } catch (error: any) {
      fastify.log.warn('Signup error:', error?.message || error);
      return reply.status(400).send({ message: error?.message || 'Failed to sign up' });
    }
  });

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
        }),
        500: Type.Object({ message: Type.String() })
      }
    }
  }, async (request, reply) => {
    try {
      // Generate token for demo user
      const { token, user } = await fastify.jwtService.ensureDemoUserWithToken();

      return { token, user };
    } catch (error) {
      fastify.log.error('Error generating demo token:', error);
      return reply.status(500).send({ message: 'Failed to generate demo token' });
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
        401: Type.Object({ message: Type.String() })
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };
    try {
      const result = await fastify.authService.login(email, password);
      return result;
    } catch (error: any) {
      const msg = error?.message || 'An error occurred during login'
      const status = msg === 'Invalid credentials' ? 401 : 500
      fastify.log.error('Login error:', error);
      return reply.status(status).send({ message: msg });
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
    const authUser = request.user!
    // Return fresh user from DB to ensure latest profile info (e.g., name)
    const dbUser = await fastify.jwtService.getUserById(authUser.id)
    return {
      valid: true,
      user: {
        id: dbUser!.id,
        email: dbUser!.email,
        name: dbUser!.name ?? undefined,
      }
    }
  });

  // Current user endpoint (/me)
  fastify.get('/me', {
    preHandler: [fastify.jwtMiddleware.authenticate.bind(fastify.jwtMiddleware)],
    schema: {
      response: {
        200: Type.Object({
          user: Type.Object({
            id: Type.Number(),
            email: Type.String(),
            name: Type.Optional(Type.String())
          }),
          hasPassword: Type.Boolean()
        })
      }
    }
  }, async (request, reply) => {
    const authUser = request.user!
    // Fetch latest user info from DB (not from JWT payload)
    const dbUser = await fastify.jwtService.getUserById(authUser.id)
    const hasPassword = await fastify.jwtService.userHasPassword(authUser.id)
    return {
      user: {
        id: dbUser!.id,
        email: dbUser!.email,
        name: dbUser!.name ?? undefined,
      },
      hasPassword
    }
  })

  // OAuth: Start Google flow (redirect URL generation)
  fastify.get('/oauth/google', {
    schema: { response: { 200: Type.Object({ url: Type.String() }) } }
  }, async (request, reply) => {
    const state = randomUUID();
    reply.setCookie('oauth_state', state, {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      signed: true,
      maxAge: 60 * 10,
    });
    const url = fastify.authService.getGoogleAuthUrl(state);
    reply.send({ url });
  });

  // OAuth: Google callback exchange
  fastify.get('/oauth/google/callback', {
    schema: {
      querystring: Type.Object({ code: Type.Optional(Type.String()), state: Type.Optional(Type.String()) }),
      response: { 400: Type.Object({ message: Type.String() }), 500: Type.Object({ message: Type.String() }) }
    }
  }, async (request, reply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code) return reply.status(400).send({ message: 'Missing code' });
      if (!state) return reply.status(400).send({ message: 'Missing state' });

      const stateCookieRaw = request.cookies?.['oauth_state'];
      if (!stateCookieRaw) return reply.status(400).send({ message: 'Missing state cookie' });
      const unsign = request.unsignCookie(stateCookieRaw);
      if (!unsign.valid || !unsign.value) return reply.status(400).send({ message: 'Invalid state signature' });
      const cookieBuf = Buffer.from(unsign.value);
      const stateBuf = Buffer.from(state);
      if (cookieBuf.length !== stateBuf.length || !timingSafeEqual(cookieBuf, stateBuf)) {
        return reply.status(400).send({ message: 'State mismatch' });
      }
      reply.clearCookie('oauth_state', { path: '/api/auth' });

      const { user, token } = await fastify.authService.handleGoogleCallback(code);
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const redirectTo = `${clientUrl}/login?token=${encodeURIComponent(token)}`;
      return reply.redirect(redirectTo, 302);
    } catch (error) {
      fastify.log.error({ err: error }, 'Google OAuth callback error');
      return reply.status(500).send({ message: 'Google OAuth failed' });
    }
  });

  // OAuth: Start GitHub flow
  fastify.get('/oauth/github', {
    schema: { response: { 200: Type.Object({ url: Type.String() }) } }
  }, async (request, reply) => {
    const state = randomUUID();
    reply.setCookie('oauth_state', state, {
      path: '/api/auth',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      signed: true,
      maxAge: 60 * 10,
    });
    const url = fastify.authService.getGithubAuthUrl(state);
    reply.send({ url });
  });

  // OAuth: GitHub callback exchange
  fastify.get('/oauth/github/callback', {
    schema: {
      querystring: Type.Object({ code: Type.Optional(Type.String()), state: Type.Optional(Type.String()) }),
      response: { 400: Type.Object({ message: Type.String() }), 500: Type.Object({ message: Type.String() }) }
    }
  }, async (request, reply) => {
    try {
      const { code, state } = request.query as { code?: string; state?: string };
      if (!code) return reply.status(400).send({ message: 'Missing code' });
      if (!state) return reply.status(400).send({ message: 'Missing state' });

      const stateCookieRaw = request.cookies?.['oauth_state'];
      if (!stateCookieRaw) return reply.status(400).send({ message: 'Missing state cookie' });
      const unsign = request.unsignCookie(stateCookieRaw);
      if (!unsign.valid || !unsign.value) return reply.status(400).send({ message: 'Invalid state signature' });
      const cookieBuf = Buffer.from(unsign.value);
      const stateBuf = Buffer.from(state);
      if (cookieBuf.length !== stateBuf.length || !timingSafeEqual(cookieBuf, stateBuf)) {
        return reply.status(400).send({ message: 'State mismatch' });
      }
      reply.clearCookie('oauth_state', { path: '/api/auth' });

      const { user, token } = await fastify.authService.handleGithubCallback(code)
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const redirectTo = `${clientUrl}/login?token=${encodeURIComponent(token)}`;
      return reply.redirect(redirectTo, 302);
    } catch (error) {
      fastify.log.error({ err: error }, 'GitHub OAuth callback error');
      return reply.status(500).send({ message: 'GitHub OAuth failed' });
    }
  });
}
