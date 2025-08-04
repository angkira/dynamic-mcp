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
  private config: InternalMCPConfig | null = null

  private constructor() {}

  static getInstance(): InternalMCPConfigLoader {
    if (!InternalMCPConfigLoader.instance) {
      InternalMCPConfigLoader.instance = new InternalMCPConfigLoader()
    }
    return InternalMCPConfigLoader.instance
  }

  /**
   * Load the internal MCP configuration from JSON
   */
  async loadConfig(): Promise<InternalMCPConfig> {
    if (this.config) {
      return this.config
    }

    try {
      const configPath = path.join(__dirname, '../config/internal-mcp-tools.json')
      const configData = await fs.readFile(configPath, 'utf-8')
      this.config = JSON.parse(configData)
      
      console.log('✅ Loaded internal MCP configuration')
      return this.config!
    } catch (error) {
      console.error('❌ Failed to load internal MCP configuration:', error)
      throw new Error('Failed to load internal MCP configuration')
    }
  }

  /**
   * Get the server information
   */
  async getServerInfo(): Promise<{ name: string; version: string; description: string }> {
    const config = await this.loadConfig()
    return config.server
  }

  /**
   * Get all tools
   */
  async getTools(): Promise<InternalMCPTool[]> {
    const config = await this.loadConfig()
    return config.tools
  }

  /**
   * Get all resources
   */
  async getResources(): Promise<InternalMCPResource[]> {
    const config = await this.loadConfig()
    return config.resources
  }

  /**
   * Get capabilities object for database storage
   */
  async getCapabilities(): Promise<object> {
    const config = await this.loadConfig()
    return {
      tools: config.tools.map(tool => ({
        name: tool.name,
        description: tool.description
      })),
      resources: config.resources,
      prompts: []
    }
  }

  /**
   * Clear cached config (useful for testing or hot reload)
   */
  clearCache(): void {
    this.config = null
  }
}

export default InternalMCPConfigLoader
