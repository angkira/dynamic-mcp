import type { FastifyInstance } from 'fastify'
import type McpService from '../services/mcp/mcpService'

/**
 * MCP Integration Utilities
 * 
 * Provides utilities for integrating MCP functionality with the LLM message system
 * without breaking existing code.
 */

/**
 * Get available MCP tools for LLM integration
 */
export async function getMCPToolsForLLM(fastify: FastifyInstance): Promise<any[]> {
  try {
    // Check if MCP service is available
    if ('mcpService' in fastify && fastify.mcpService) {
      const mcpService = fastify.mcpService as McpService
      return await mcpService.getAvailableToolsForLLM()
    }
    return []
  } catch (error) {
    console.error('Error getting MCP tools:', error)
    return []
  }
}

/**
 * Execute an MCP tool call
 */
export async function executeMCPTool(fastify: FastifyInstance, toolName: string, arguments_: any): Promise<any> {
  try {
    // Check if MCP service is available
    if ('mcpService' in fastify && fastify.mcpService) {
      const mcpService = fastify.mcpService as McpService
      return await mcpService.executeMCPTool(toolName, arguments_)
    }
    throw new Error('MCP service not available')
  } catch (error) {
    console.error('Error executing MCP tool:', error)
    throw error
  }
}

/**
 * Get MCP resources for LLM integration
 */
export async function getMCPResourcesForLLM(fastify: FastifyInstance): Promise<any[]> {
  try {
    // Check if MCP service is available
    if ('mcpService' in fastify && fastify.mcpService) {
      const mcpService = fastify.mcpService as McpService
      return await mcpService.getAvailableResourcesForLLM()
    }
    return []
  } catch (error) {
    console.error('Error getting MCP resources:', error)
    return []
  }
}

/**
 * Check if MCP is available and configured
 */
export function isMCPAvailable(fastify: FastifyInstance): boolean {
  return 'mcpService' in fastify && Boolean(fastify.mcpService)
}

/**
 * Get MCP system information for inclusion in LLM context
 */
export async function getMCPSystemInfo(fastify: FastifyInstance): Promise<string> {
  try {
    if (!isMCPAvailable(fastify)) {
      return ''
    }

    const tools = await getMCPToolsForLLM(fastify)
    const resources = await getMCPResourcesForLLM(fastify)

    if (tools.length === 0 && resources.length === 0) {
      return ''
    }

    let systemInfo = '\n\n=== MCP TOOLS & RESOURCES AVAILABLE ===\n'
    
    if (tools.length > 0) {
      systemInfo += '\nAvailable MCP Tools:\n'
      tools.forEach(tool => {
        systemInfo += `- ${tool.name}: ${tool.description}\n`
      })
    }

    if (resources.length > 0) {
      systemInfo += '\nAvailable MCP Resources:\n'
      resources.forEach(resource => {
        systemInfo += `- ${resource.uri} (${resource.serverName}): ${resource.description || 'No description'}\n`
      })
    }

    systemInfo += '\nYou can use these tools and resources to help answer user questions.\n'
    systemInfo += '===================================\n\n'

    return systemInfo
  } catch (error) {
    console.error('Error getting MCP system info:', error)
    return ''
  }
}

// Type declarations for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    mcpService?: McpService
  }
}