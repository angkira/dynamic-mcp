import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

export interface JWTPayload {
  userId: number;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

export class JWTService {
  private readonly secret: string;
  private readonly expiresIn: string;
  private prisma: PrismaClient;

  constructor(secret?: string, expiresIn: string = '30d') {
    this.secret = secret || process.env.JWT_SECRET || 'demo-secret-key-for-mvp';
    this.expiresIn = expiresIn;
    this.prisma = new PrismaClient();
  }

  /**
   * Generate JWT token for a user
   */
  generateToken(user: { id: number; email: string; name?: string }): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      name: user.name ?? undefined
    };

    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  /**
   * Verify and decode JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.secret) as JWTPayload;
      return decoded;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Get or create demo user and generate token
   */
  async ensureDemoUserWithToken(): Promise<{ user: any; token: string }> {
    const demoEmail = 'demo@example.com';
    
    // Try to find existing demo user
    let user = await this.prisma.user.findUnique({
      where: { email: demoEmail }
    });

    // Create demo user if not exists
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: demoEmail,
          name: 'Demo User'
        }
      });
      console.log('✅ Created demo user:', user.email);
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,
      email: user.email,
      name: user.name ?? undefined
    });

    // Update all MCP servers to use this token
    await this.prisma.mCPServer.updateMany({
      where: { userId: user.id },
      data: { authToken: token }
    });

    console.log('✅ Demo user token generated and stored in MCP servers');
    return { user, token };
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: number) {
    return await this.prisma.user.findUnique({
      where: { id: userId }
    });
  }
}

export default JWTService;
