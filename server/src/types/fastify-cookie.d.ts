import type { CookieSerializeOptions } from '@fastify/cookie'

declare module 'fastify' {
  interface FastifyRequest {
    cookies: Record<string, string>
    unsignCookie(value: string): { valid: boolean; value?: string; renew?: boolean }
  }

  interface FastifyReply {
    setCookie(name: string, value: string, options?: CookieSerializeOptions): this
    clearCookie(name: string, options?: CookieSerializeOptions): this
  }
}


