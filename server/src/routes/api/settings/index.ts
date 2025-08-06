import { FastifyInstance } from 'fastify';

export default async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings - Get user settings
  fastify.get('/', async () => {
    // For now, use a default user ID (1) - in a real app, this would come from auth
    const userId = 1;

    try {
      // First, ensure the default user exists
      let user = await fastify.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        user = await fastify.prisma.user.create({
          data: {
            email: 'user@example.com',
            name: 'Default User'
          }
        });
      }

      // Then get or create settings for this user
      let settings = await fastify.prisma.settings.findUnique({
        where: { userId: user.id }
      });

      // If no settings exist, create default ones
      if (!settings) {
        settings = await fastify.prisma.settings.create({
          data: {
            userId: user.id,
            defaultProvider: 'google',
            defaultModel: 'gemini-2.5-flash',
            thinkingBudget: 2048,
            responseBudget: 8192
          }
        });
      }

      return {
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
        thinkingBudget: settings.thinkingBudget,
        responseBudget: settings.responseBudget,
        // MCP Global Settings
        mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
        mcpDefaultTimeout: settings.mcpDefaultTimeout,
        mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
        mcpAutoDiscovery: settings.mcpAutoDiscovery
      };
    } catch (error) {
      fastify.log.error('Failed to get settings:', error);
      throw new Error('Failed to get settings');
    }
  });

  // PUT /api/settings - Update user settings
  fastify.put('/', async (request) => {
    const userId = 1; // For now, use a default user ID

    const {
      defaultProvider,
      defaultModel,
      thinkingBudget,
      responseBudget,
      // MCP Global Settings
      mcpEnableDebugLogging,
      mcpDefaultTimeout,
      mcpMaxConcurrentConnections,
      mcpAutoDiscovery
    } = request.body as {
      defaultProvider?: string;
      defaultModel?: string;
      thinkingBudget?: number;
      responseBudget?: number;
      // MCP Global Settings
      mcpEnableDebugLogging?: boolean;
      mcpDefaultTimeout?: number;
      mcpMaxConcurrentConnections?: number;
      mcpAutoDiscovery?: boolean;
    };

    try {
      // First, ensure the default user exists
      let user = await fastify.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        user = await fastify.prisma.user.create({
          data: {
            email: 'user@example.com',
            name: 'Default User'
          }
        });
      }

      const settings = await fastify.prisma.settings.upsert({
        where: { userId: user.id },
        update: {
          ...(defaultProvider && { defaultProvider }),
          ...(defaultModel && { defaultModel }),
          ...(thinkingBudget !== undefined && { thinkingBudget }),
          ...(responseBudget !== undefined && { responseBudget }),
          // MCP Global Settings
          ...(mcpEnableDebugLogging !== undefined && { mcpEnableDebugLogging }),
          ...(mcpDefaultTimeout !== undefined && { mcpDefaultTimeout }),
          ...(mcpMaxConcurrentConnections !== undefined && { mcpMaxConcurrentConnections }),
          ...(mcpAutoDiscovery !== undefined && { mcpAutoDiscovery })
        },
        create: {
          userId: user.id,
          defaultProvider: defaultProvider || 'openai',
          defaultModel: defaultModel || 'o3-mini',
          thinkingBudget: thinkingBudget ?? 2048,
          responseBudget: responseBudget ?? 8192,
          // MCP Global Settings defaults
          mcpEnableDebugLogging: mcpEnableDebugLogging ?? false,
          mcpDefaultTimeout: mcpDefaultTimeout ?? 10000,
          mcpMaxConcurrentConnections: mcpMaxConcurrentConnections ?? 5,
          mcpAutoDiscovery: mcpAutoDiscovery ?? true
        }
      });

      return {
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
        thinkingBudget: settings.thinkingBudget,
        responseBudget: settings.responseBudget,
        // MCP Global Settings
        mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
        mcpDefaultTimeout: settings.mcpDefaultTimeout,
        mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
        mcpAutoDiscovery: settings.mcpAutoDiscovery
      };

      // Update MCP service with new settings if it exists
      await fastify.mcpService?.updateGlobalSettings(userId);

      return {
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
        thinkingBudget: settings.thinkingBudget,
        responseBudget: settings.responseBudget,
        // MCP Global Settings
        mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
        mcpDefaultTimeout: settings.mcpDefaultTimeout,
        mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
        mcpAutoDiscovery: settings.mcpAutoDiscovery
      };
    } catch (error) {
      fastify.log.error('Failed to update settings:', error);
      throw new Error('Failed to update settings');
    }
  });
}
