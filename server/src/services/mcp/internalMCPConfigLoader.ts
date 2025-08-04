import { promises as fs } from 'fs'
import * as path from 'path'

export interface InternalMCPTool {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required?: string[]
  }
}

export interface InternalMCPResource {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface InternalMCPConfig {
  server: {
    name: string
    version: string
    description: string
  }
  tools: InternalMCPTool[]
  resources: InternalMCPResource[]
}

export class InternalMCPConfigLoader {
  private static instance: InternalMCPConfigLoader
  private configs: Map<string, InternalMCPConfig> = new Map()

  private constructor() {}

  static getInstance(): InternalMCPConfigLoader {
    if (!InternalMCPConfigLoader.instance) {
      InternalMCPConfigLoader.instance = new InternalMCPConfigLoader()
    }
    return InternalMCPConfigLoader.instance
  }

  /**
   * Load a specific internal MCP configuration from JSON
   */
  async loadConfigForServer(serverName: string): Promise<InternalMCPConfig> {
    if (this.configs.has(serverName)) {
      return this.configs.get(serverName)!
    }

    try {
      // TODO: Move internal MCP configurations to the database properly instead of JSON files
      const configFileName = serverName === 'dynamic-mcp-api' 
        ? 'internal-mcp-tools.json' 
        : serverName === 'dynamic-mcp-api-daemon'
        ? 'internal-daemon-mcp-tools.json'
        : serverName === 'memory-daemon'
        ? 'memory-daemon-mcp-tools.json'
        : `${serverName}-mcp-tools.json`
      
      const configPath = path.join(process.cwd(), 'src/config', configFileName)
      const configData = await fs.readFile(configPath, 'utf-8')
      const config = JSON.parse(configData)
      
      this.configs.set(serverName, config)
      console.log(`✅ Loaded internal MCP configuration for ${serverName}`)
      return config
    } catch (error) {
      console.error(`❌ Failed to load internal MCP configuration for ${serverName}:`, error)
      throw new Error(`Failed to load internal MCP configuration for ${serverName}`)
    }
  }

  /**
   * Get the server information for a specific server
   */
  async getServerInfoForServer(serverName: string): Promise<{ name: string; version: string; description: string }> {
    const config = await this.loadConfigForServer(serverName)
    return config.server
  }

  /**
   * Get all tools for a specific server
   */
  async getToolsForServer(serverName: string): Promise<InternalMCPTool[]> {
    const config = await this.loadConfigForServer(serverName)
    return config.tools
  }

  /**
   * Get all resources for a specific server
   */
  async getResourcesForServer(serverName: string): Promise<InternalMCPResource[]> {
    const config = await this.loadConfigForServer(serverName)
    return config.resources
  }

  /**
   * Get capabilities object for database storage for a specific server
   */
  async getCapabilitiesForServer(serverName: string): Promise<object> {
    const config = await this.loadConfigForServer(serverName)
    return {
      tools: config.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      resources: config.resources,
      prompts: []
    }
  }

  // Legacy methods for backwards compatibility (default to dynamic-mcp-api)
  async loadConfig(): Promise<InternalMCPConfig> {
    return this.loadConfigForServer('dynamic-mcp-api')
  }

  async getServerInfo(): Promise<{ name: string; version: string; description: string }> {
    return this.getServerInfoForServer('dynamic-mcp-api')
  }

  async getTools(): Promise<InternalMCPTool[]> {
    return this.getToolsForServer('dynamic-mcp-api')
  }

  async getResources(): Promise<InternalMCPResource[]> {
    return this.getResourcesForServer('dynamic-mcp-api')
  }

  async getCapabilities(): Promise<object> {
    return this.getCapabilitiesForServer('dynamic-mcp-api')
  }

  /**
   * Clear cached configs (useful for testing or hot reload)
   */
  clearCache(): void {
    this.configs.clear()
  }
}

export default InternalMCPConfigLoader
