import fp from 'fastify-plugin'
import cookie, { type FastifyCookieOptions } from '@fastify/cookie'
import type { FastifyPluginAsync } from 'fastify'

const cookiePlugin: FastifyPluginAsync = async (fastify) => {
  const options: FastifyCookieOptions = {
    secret: process.env.COOKIE_SECRET || 'dev-cookie-secret',
    hook: 'onRequest'
  }
  await fastify.register(cookie as unknown as FastifyPluginAsync<FastifyCookieOptions>, options)
}

export default fp(cookiePlugin)


