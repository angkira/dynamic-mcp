import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@shared/prisma';

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
    this.secret =
      secret ||
      process.env.JWT_SECRET ||
      process.env.JWT_SIGNING_KEY ||
      'demo-secret-key-for-mvp';
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
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<{ user: any; token: string } | null> {
    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (!user || !user.password) {
      return null; // User not found or has no password set
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null; // Invalid password
    }

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      name: user.name ?? undefined
    });

    return { user, token };
  }

  /**
   * Sign up a new user with email and password
   */
  async signup(email: string, password: string, name?: string): Promise<{ user: any; token: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing && existing.password) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = existing
      ? await this.prisma.user.update({ where: { email }, data: { name, password: passwordHash } })
      : await this.prisma.user.create({ data: { email, name, password: passwordHash } });

    const token = this.generateToken({ id: user.id, email: user.email, name: user.name ?? undefined });
    return { user, token };
  }

  /**
   * Find existing user by email or create one (for OAuth flows)
   */
  async findOrCreateByEmail(email: string, name?: string): Promise<{ user: any; token: string }> {
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await this.prisma.user.create({ data: { email, name } });
    } else if (name && !user.name) {
      // Backfill name if missing
      user = await this.prisma.user.update({ where: { id: user.id }, data: { name } });
    }

    const token = this.generateToken({ id: user.id, email: user.email, name: user.name ?? undefined });
    return { user, token };
  }

  /**
   * Find or create user using OAuth provider identity, and ensure linkage record exists
   */
  async findOrCreateByOAuth(
    provider: 'google' | 'github',
    providerUserId: string,
    email: string,
    name?: string
  ): Promise<{ user: any; token: string }> {
    // First, try to find an existing OAuthAccount
    const existingAccount = await (this.prisma as any).oAuthAccount.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } }
    });

    let user: any;
    if (existingAccount) {
      user = await this.prisma.user.findUnique({ where: { id: existingAccount.userId } });
    } else {
      // Fallback: try to find user by email to link accounts
      user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) {
        user = await this.prisma.user.create({ data: { email, name } });
      } else if (name && !user.name) {
        user = await this.prisma.user.update({ where: { id: user.id }, data: { name } });
      }

      // Create the OAuth account linkage
      await (this.prisma as any).oAuthAccount.create({
        data: { userId: user.id, provider, providerUserId }
      });
    }

    const token = this.generateToken({ id: user.id, email: user.email, name: user.name ?? undefined });
    return { user, token };
  }

  /**
   * Update user profile (name/email)
   */
  async updateUserProfile(userId: number, updates: { name?: string; email?: string }) {
    const data: any = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.email !== undefined) data.email = updates.email;
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    return user;
  }

  /**
   * Change or set password. If user has a password, currentPassword is required.
   */
  async changeUserPassword(userId: number, newPassword: string, currentPassword?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    if (user.password) {
      if (!currentPassword) throw new Error('Current password required');
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) throw new Error('Invalid current password');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    return await this.prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });
  }

  /**
   * Indicates if a user has a password set
   */
  async userHasPassword(userId: number): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    return !!user?.password;
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

    // Ensure demo user has default settings
    await this.ensureDemoUserSettings(user.id);

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
   * Ensure demo user has default settings
   */
  private async ensureDemoUserSettings(userId: number): Promise<void> {
    try {
      // Check if settings already exist
      // Settings are now created via database initialization script (fill.sql)
      // No need to create default settings here
    } catch (error) {
      console.error('Failed to ensure demo user settings:', error);
      throw error;
    }
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
