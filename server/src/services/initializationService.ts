import JWTService from './auth/jwtService';
import { PrismaClient } from '@shared-prisma';

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

    console.log('✅ Application initialization complete');
    return { token, user };
  }
}

export default InitializationService;
