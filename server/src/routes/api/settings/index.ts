import { Settings } from '@shared/prisma';
import { FastifyInstance, FastifyRequest } from 'fastify';
import { SettingsService } from '../../../services/settingsService'

export default async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings - Get user settings
  fastify.get('/', async (request: FastifyRequest) => {
    // Use authenticated user
    const userId = request.user?.id as number | undefined;

    if (!userId) {
      throw new Error('Unauthorized')
    }

    try {
      // Ensure a corresponding User row exists (fresh DB after reset may not have it yet)
      const email = (request as any).user?.email as string | undefined
      const name = (request as any).user?.name as string | undefined
      await (fastify.prisma as any).user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: email || `user-${userId}@local.invalid`,
          name: name || null
        }
      })

      const service = new SettingsService(fastify.prisma as any, (fastify as any).mcpService)
      return await service.getUserSettings(userId)
    } catch (error) {
      fastify.log.error('Failed to get settings:', error);
      throw new Error('Failed to get settings');
    }
  });

  // PUT /api/settings - Update user settings
  fastify.put('/', async (request: FastifyRequest<{ Body: Settings }>) => {
    const userId = request.user?.id as number | undefined;

    if (!userId) {
      throw new Error('Unauthorized')
    }

    const body = request.body as any

    try {
      // Ensure a corresponding User row exists
      const email = (request as any).user?.email as string | undefined
      const name = (request as any).user?.name as string | undefined
      await (fastify.prisma as any).user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          email: email || `user-${userId}@local.invalid`,
          name: name || null
        }
      })

      const service = new SettingsService(fastify.prisma as any, (fastify as any).mcpService)
      return await service.updateUserSettings(userId, body)

      // Update MCP service with new settings if it exists
      // Update MCP service with new settings if available
      // const mcpService: any = (fastify as any).mcpService
      // if (mcpService && typeof userId === 'number') {
      //   await mcpService.updateGlobalSettings(userId as number)
      // }
    } catch (error) {
      fastify.log.error('Failed to update settings:', error);
      throw new Error('Failed to update settings');
    }
  });
}
