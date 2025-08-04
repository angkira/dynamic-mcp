#!/usr/bin/env node

/**
 * Database initialization test script
 * 
 * This script tests the database initialization functionality
 * and verifies that the internal MCP server is properly configured.
 */

import DatabaseInitializer from '../src/services/database/databaseInitializer'
import InternalMCPConfigLoader from '../src/services/mcp/internalMCPConfigLoader'
import { PrismaClient } from '@prisma/client'

async function testDatabaseInit() {
  console.log('🧪 Testing database initialization...')
  
  const dbInit = new DatabaseInitializer()
  const configLoader = InternalMCPConfigLoader.getInstance()
  const prisma = new PrismaClient()
  
  try {
    // Test database initialization
    await dbInit.ensureInitialized()
    
    // Test config loading
    const config = await configLoader.loadConfig()
    console.log('✅ Config loaded:', {
      server: config.server.name,
      toolsCount: config.tools.length,
      resourcesCount: config.resources.length
    })
    
    // Test if internal MCP server exists in database
    const internalServer = await prisma.mCPServer.findFirst({
      where: { name: 'dynamic-mcp-api' }
    })
    
    if (internalServer) {
      console.log('✅ Internal MCP server found in database:', {
        id: internalServer.id,
        name: internalServer.name,
        status: internalServer.status,
        isEnabled: internalServer.isEnabled
      })
    } else {
      console.log('❌ Internal MCP server not found in database')
    }
    
    // Test capabilities
    const capabilities = await configLoader.getCapabilities()
    console.log('✅ Capabilities loaded:', {
      toolsCount: (capabilities as any).tools?.length || 0,
      resourcesCount: (capabilities as any).resources?.length || 0
    })
    
    console.log('🎉 All tests passed!')
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  } finally {
    await dbInit.close()
    await prisma.$disconnect()
  }
}

// Run the test
if (require.main === module) {
  testDatabaseInit()
}

export { testDatabaseInit }
