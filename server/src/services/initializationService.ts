import JWTService from './auth/jwtService';
import { PrismaClient } from '@prisma/client';
import McpConfigService from './config/mcpConfigService';

export class InitializationService {
  private jwtService: JWTService;
  private prisma: PrismaClient;
  private mcpConfigService: McpConfigService;

  constructor() {
    this.jwtService = new JWTService();
    this.prisma = new PrismaClient();
    this.mcpConfigService = McpConfigService.getInstance();
  }

  /**
   * Initialize the application with demo user and JWT
   */
  async initialize(): Promise<{ token: string; user: any }> {
    console.log('🚀 Initializing application...');

    // Ensure demo user exists and has a token
    const { user, token } = await this.jwtService.ensureDemoUserWithToken();

    // Ensure default MCP servers exist
    await this.ensureDefaultMCPServers(user.id, token);

    console.log('✅ Application initialization complete');
    return { token, user };
  }

  /**
   * Ensure default MCP servers exist with the correct token
   */
  private async ensureDefaultMCPServers(userId: number, token: string) {
    // Load default server configurations from JSON files
    const defaultServers = this.mcpConfigService.getDefaultServers();

    for (const serverConfig of defaultServers) {
      // Check if server already exists
      const existingServer = await this.prisma.mCPServer.findFirst({
        where: {
          userId,
          name: serverConfig.name
        }
      });

      if (existingServer) {
        // Update existing server with new token, auth type, and capabilities
        await this.prisma.mCPServer.update({
          where: { id: existingServer.id },
          data: { 
            authToken: token,
            authType: 'BEARER',
            capabilities: serverConfig.capabilities
          }
        });
        console.log(`✅ Updated token and capabilities for existing MCP server: ${serverConfig.name}`);
      } else {
        // Create new server with full configuration including capabilities
        await this.prisma.mCPServer.create({
          data: {
            userId,
            name: serverConfig.name,
            version: serverConfig.version,
            description: serverConfig.description,
            transportType: serverConfig.transportType,
            transportBaseUrl: serverConfig.transportBaseUrl,
            transportCommand: serverConfig.transportCommand,
            transportArgs: serverConfig.transportArgs,
            configAutoConnect: serverConfig.configAutoConnect,
            authToken: token,
            authType: 'BEARER',
            isEnabled: true,
            capabilities: serverConfig.capabilities
          }
        });
        console.log(`✅ Created new MCP server with capabilities: ${serverConfig.name}`);
      }
    }
  }
}

export default InitializationService;
