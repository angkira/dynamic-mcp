import { PrismaClient } from '@prisma/client'
import type { Memory } from '@prisma/client'
import type { 
  RememberRequestType, 
  RecallRequestType, 
  ResetRequestType, 
  RecallResponseType,
  ResetResponseType 
} from '../../schemas/memory.schema'

/**
 * Memory Service
 * 
 * Manages persistent memory storage for AI conversations and user notes.
 * Provides remember, recall, and reset functionality.
 */
export class MemoryService {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Store a new memory
   */
  async remember(data: RememberRequestType): Promise<Memory | { error: string }> {
    const userId = data.userId || 1 // Default to user ID 1 for now

    console.log('🔍 MemoryService.remember called with data:', JSON.stringify(data, null, 2));
    console.log('🔍 Resolved userId:', userId);

    if (!data.content) {
      console.warn('⚠️ Attempted to store memory with no content');
      return { error: 'Content is required to store a memory.' }
    }

    try {
      console.log('🔍 Creating memory in database with data:', {
        userId,
        key: data.key || null,
        content: data.content,
        metadata: data.metadata || null
      });

      const memory = await this.prisma.memory.create({
        data: {
          userId,
          key: data.key || null,
          content: data.content,
          metadata: data.metadata || null
        }
      })

      console.log(`💾 Memory stored: ${memory.id} for user ${userId}`);
      console.log('🔍 Created memory object:', JSON.stringify(memory, null, 2));
      return memory
    } catch (error) {
      console.error('❌ Error storing memory:', error)
      throw new Error('Failed to store memory')
    }
  }

  /**
   * Recall memories with optional filtering and search
   */
  async recall(data: RecallRequestType): Promise<RecallResponseType> {
    const userId = data.userId || 1 // Default to user ID 1 for now
    const limit = data.limit || 50
    const offset = data.offset || 0

    try {
      // Build where clause for filtering
      const where: any = { userId }
      
      if (data.key) {
        where.key = data.key
      }
      
      if (data.search) {
        where.content = {
          contains: data.search,
          mode: 'insensitive'
        }
      }

      // Get memories with pagination
      const [memories, total] = await Promise.all([
        this.prisma.memory.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset
        }),
        this.prisma.memory.count({ where })
      ])

      const hasMore = offset + limit < total

      console.log(`🧠 Recalled ${memories.length} memories (${total} total) for user ${userId}`)
      
      return {
        memories,
        total,
        hasMore
      }
    } catch (error) {
      console.error('❌ Error recalling memories:', error)
      throw new Error('Failed to recall memories')
    }
  }

  /**
   * Reset (delete) memories with optional key filtering
   */
  async reset(data: ResetRequestType): Promise<ResetResponseType> {
    const userId = data.userId || 1 // Default to user ID 1 for now

    try {
      // Build where clause for deletion
      const where: any = { userId }
      
      if (data.key) {
        where.key = data.key
      }

      // Delete memories
      const result = await this.prisma.memory.deleteMany({ where })
      
      const message = data.key 
        ? `Deleted ${result.count} memories with key '${data.key}' for user ${userId}`
        : `Deleted all ${result.count} memories for user ${userId}`

      console.log(`🗑️ ${message}`)
      
      return {
        deletedCount: result.count,
        message
      }
    } catch (error) {
      console.error('❌ Error resetting memories:', error)
      throw new Error('Failed to reset memories')
    }
  }

  /**
   * Get memory statistics for a user
   */
  async getStats(userId: number = 1): Promise<{
    totalMemories: number
    memoriesWithKeys: number
    uniqueKeys: string[]
    oldestMemory?: Date
    newestMemory?: Date
  }> {
    try {
      const [total, withKeys, memories] = await Promise.all([
        this.prisma.memory.count({ where: { userId } }),
        this.prisma.memory.count({ where: { userId, key: { not: null } } }),
        this.prisma.memory.findMany({
          where: { userId },
          select: { key: true, createdAt: true },
          orderBy: { createdAt: 'asc' }
        })
      ])

      const uniqueKeys = [...new Set(
        memories
          .map(m => m.key)
          .filter((key): key is string => key !== null)
      )]

      return {
        totalMemories: total,
        memoriesWithKeys: withKeys,
        uniqueKeys,
        oldestMemory: memories[0]?.createdAt,
        newestMemory: memories[memories.length - 1]?.createdAt
      }
    } catch (error) {
      console.error('❌ Error getting memory stats:', error)
      throw new Error('Failed to get memory statistics')
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

export default MemoryService
