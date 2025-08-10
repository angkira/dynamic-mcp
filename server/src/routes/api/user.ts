import type { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'

export default async function userRoute(fastify: FastifyInstance) {
  // Require JWT for all routes here
  const auth = fastify.jwtMiddleware.authenticate.bind(fastify.jwtMiddleware)

  // Me endpoint
  fastify.get('/me', {
    preHandler: [auth], schema: {
      response: {
        200: Type.Object({
          user: Type.Object({ id: Type.Number(), email: Type.String(), name: Type.Optional(Type.String()) }),
          hasPassword: Type.Boolean()
        })
      }
    }
  }, async (request, reply) => {
    const authUser = request.user!
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

  // Update profile
  fastify.patch('/profile', {
    preHandler: [auth],
    schema: {
      body: Type.Object({ name: Type.Optional(Type.String()), email: Type.Optional(Type.String({ format: 'email' })) }),
      response: { 200: Type.Object({ id: Type.Number(), email: Type.String(), name: Type.Optional(Type.String()) }) }
    }
  }, async (request, reply) => {
    const authUser = request.user!
    const { name, email } = request.body as { name?: string; email?: string }
    try {
      // If attempting to change email, ensure uniqueness at DB level will enforce
      const user = await fastify.jwtService.updateUserProfile(authUser.id, { name, email })
      return { id: user.id, email: user.email, name: user.name ?? undefined }
    } catch (error: any) {
      fastify.log.error('Profile update error:', error)
      return reply.status(400).send({ message: error?.message || 'Failed to update profile' })
    }
  })

  // Change password
  fastify.patch('/password', {
    preHandler: [auth],
    schema: {
      body: Type.Object({ currentPassword: Type.Optional(Type.String()), newPassword: Type.String({ minLength: 6 }) }),
      response: { 200: Type.Object({ success: Type.Boolean() }) }
    }
  }, async (request, reply) => {
    const authUser = request.user!
    const { currentPassword, newPassword } = request.body as { currentPassword?: string; newPassword: string }
    try {
      await fastify.jwtService.changeUserPassword(authUser.id, newPassword, currentPassword)
      return { success: true }
    } catch (error: any) {
      const msg = error?.message || 'Failed to change password'
      const status = msg.includes('Invalid current password') ? 401 : 400
      return reply.status(status).send({ message: msg })
    }
  })
}


