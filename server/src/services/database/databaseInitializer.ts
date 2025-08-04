import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import * as path from 'path'

export class DatabaseInitializer {
  private prisma: PrismaClient

  constructor() {
    this.prisma = new PrismaClient()
  }

  /**
   * Check if the database is initialized by looking for the User table
   */
  async isDatabaseInitialized(): Promise<boolean> {
    try {
      // Try to query a table to see if it exists
      await this.prisma.user.findFirst()
      return true
    } catch (error) {
      // If the table doesn't exist, Prisma will throw an error
      return false
    }
  }

  /**
   * Initialize the database by running the init.sql script
   */
  async initializeDatabase(): Promise<void> {
    try {
      console.log('🔧 Database not initialized, running init.sql...')
      
      // Read the init.sql file
      const initSqlPath = path.join(__dirname, '../../../../docker/db/init.sql')
      const initSql = await fs.readFile(initSqlPath, 'utf-8')
      
      // Split the SQL into individual statements and execute them
      const statements = initSql
        .split(';')
        .map((stmt: string) => stmt.trim())
        .filter((stmt: string) => stmt.length > 0 && !stmt.startsWith('--'))
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await this.prisma.$executeRawUnsafe(statement)
          } catch (error) {
            // Log but don't fail on individual statement errors (like CREATE TYPE if exists)
            console.warn('⚠️ Warning executing SQL statement:', error)
          }
        }
      }
      
      console.log('✅ Database initialized successfully')
    } catch (error) {
      console.error('❌ Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Ensure the database is initialized, run init if needed
   */
  async ensureInitialized(): Promise<void> {
    const isInitialized = await this.isDatabaseInitialized()
    
    if (!isInitialized) {
      await this.initializeDatabase()
    } else {
      console.log('✅ Database already initialized')
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect()
  }
}

export default DatabaseInitializer
