#!/usr/bin/env node

/**
 * Update Internal MCP Server Script
 * 
 * This script updates the internal MCP server record in the database
 * with the latest capabilities including memory tools.
 */

import { PrismaClient } from '@shared/prisma'
import InternalMCPConfigLoader from './src/services/mcp/internalMCPConfigLoader'

async function updateInternalMCPServer() {
  console.log('🔄 Updating internal MCP server capabilities...')

  const prisma = new PrismaClient()
  const configLoader = InternalMCPConfigLoader.getInstance()

  try {
    // Load the latest capabilities from JSON config
    const capabilities = await configLoader.getCapabilities()
    const serverInfo = await configLoader.getServerInfo()

    console.log('📋 Latest capabilities:')
    console.log(`  - Tools: ${(capabilities as any).tools?.length || 0}`)
    console.log(`  - Resources: ${(capabilities as any).resources?.length || 0}`)

    // Update the internal server record
    const result = await prisma.mCPServer.updateMany({
      where: {
        name: 'dynamic-mcp-api',
        transportCommand: 'internal'
      },
      data: {
        version: serverInfo.version,
        description: serverInfo.description,
        capabilities: capabilities as any,
        status: 'CONNECTED',
        lastConnected: new Date()
      }
    })

    if (result.count === 0) {
      console.log('❌ No internal MCP server found to update')
      console.log('💡 Creating new internal MCP server record...')

      // Create the internal server if it doesn't exist
      await prisma.mCPServer.create({
        data: {
          userId: 1, // Default user
          name: serverInfo.name,
          version: serverInfo.version,
          description: serverInfo.description,
          isEnabled: true,
          status: 'CONNECTED',
          transportType: 'STDIO',
          transportCommand: 'internal',
          authType: 'NONE',
          configAutoConnect: true,
          capabilities: capabilities as any,
          lastConnected: new Date()
        }
      })

      console.log('✅ Created new internal MCP server record')
    } else {
      console.log(`✅ Updated ${result.count} internal MCP server record(s)`)
    }

    // Verify the update
    const updatedServer = await prisma.mCPServer.findFirst({
      where: { name: 'dynamic-mcp-api' }
    })

    if (updatedServer) {
      const caps = updatedServer.capabilities as any
      console.log('🔍 Verification:')
      console.log(`  - Server ID: ${updatedServer.id}`)
      console.log(`  - Version: ${updatedServer.version}`)
      console.log(`  - Status: ${updatedServer.status}`)
      console.log(`  - Tools in DB: ${caps?.tools?.length || 0}`)
      console.log(`  - Resources in DB: ${caps?.resources?.length || 0}`)

      // List all tool names for verification
      if (caps?.tools) {
        console.log('🛠️ Available tools:')
        caps.tools.forEach((tool: any, index: number) => {
          console.log(`  ${index + 1}. ${tool.name} - ${tool.description}`)
        })
      }
    }

    console.log('\n🎉 Internal MCP server update completed!')

  } catch (error) {
    console.error('❌ Failed to update internal MCP server:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
if (require.main === module) {
  updateInternalMCPServer()
}

export { updateInternalMCPServer }
