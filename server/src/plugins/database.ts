import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import DatabaseInitializer from '../services/database/databaseInitializer'

async function databasePlugin(fastify: FastifyInstance) {
  // Initialize database on application startup
  const dbInitializer = new DatabaseInitializer()
  
  try {
    await dbInitializer.ensureInitialized()
    fastify.log.info('✅ Database initialization completed')
  } catch (error) {
    fastify.log.error('❌ Database initialization failed:', error)
    throw error
  } finally {
    await dbInitializer.close()
  }
}

export default fp(databasePlugin, {
  name: 'database-init'
})
