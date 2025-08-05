import JWTService from './auth/jwtService';
import { PrismaClient } from '@prisma/client';

export class InitializationService {
  private jwtService: JWTService;
  private prisma: PrismaClient;

  constructor() {
    this.jwtService = new JWTService();
    this.prisma = new PrismaClient();
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
    const defaultServers = [
      {
        name: 'memory',
        version: '1.0.0',
        description: 'Memory management server',
        transportType: 'STREAMABLE_HTTP' as const,
        transportBaseUrl: 'http://mcp-memory:3001',
        configAutoConnect: true
      },
      {
        name: 'dynamic-mcp-api',
        version: '1.0.0',
        description: 'Dynamic MCP API server',
        transportType: 'STREAMABLE_HTTP' as const,
        transportBaseUrl: 'http://mcp-api:3002',
        configAutoConnect: true
      }
    ];

    for (const serverConfig of defaultServers) {
      // Check if server already exists
      const existingServer = await this.prisma.mCPServer.findFirst({
        where: {
          userId,
          name: serverConfig.name
        }
      });

      if (existingServer) {
        // Update existing server with new token and auth type
        await this.prisma.mCPServer.update({
          where: { id: existingServer.id },
          data: { 
            authToken: token,
            authType: 'BEARER'
          }
        });
        console.log(`✅ Updated token for existing MCP server: ${serverConfig.name}`);
      } else {
        // Create new server
        await this.prisma.mCPServer.create({
          data: {
            userId,
            name: serverConfig.name,
            version: serverConfig.version,
            description: serverConfig.description,
            transportType: serverConfig.transportType,
            transportBaseUrl: serverConfig.transportBaseUrl,
            configAutoConnect: serverConfig.configAutoConnect,
            authToken: token,
            authType: 'BEARER',
            isEnabled: true
          }
        });
        console.log(`✅ Created new MCP server: ${serverConfig.name}`);
      }
    }
  }
}

export default InitializationService;
