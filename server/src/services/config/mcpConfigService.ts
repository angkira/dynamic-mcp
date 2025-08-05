import { readFileSync } from 'fs';
import { join } from 'path';

export interface MCPServerConfig {
  server: {
    name: string;
    version: string;
    description: string;
  };
  tools: Array<{
    name: string;
    description: string;
    parameters?: Record<string, any>;
  }>;
  resources: Array<{
    uri: string;
    name: string;
    description: string;
    mimeType?: string;
  }>;
  prompts?: Array<{
    name: string;
    description: string;
    arguments?: Array<{
      name: string;
      description: string;
      required: boolean;
      type: string;
    }>;
  }>;
}

export interface DefaultServerDefinition {
  configFile: string;
  serverName?: string; // Override the name from config file
  transportType: 'STREAMABLE_HTTP' | 'STDIO';
  transportBaseUrl?: string;
  transportCommand?: string;
  transportArgs?: string[];
  configAutoConnect: boolean;
}

export class McpConfigService {
  private static instance: McpConfigService;
  private configCache: Map<string, MCPServerConfig> = new Map();

  // Define the default servers that should be created during initialization
  private readonly defaultServers: Record<string, DefaultServerDefinition> = {
    'memory': {
      configFile: 'memory-daemon-mcp-tools.json',
      serverName: 'memory', // Override the name from config file
      transportType: 'STREAMABLE_HTTP',
      transportBaseUrl: 'http://mcp-memory:3001',
      configAutoConnect: true
    },
    'dynamic-mcp-api': {
      configFile: 'internal-mcp-tools.json', 
      serverName: 'dynamic-mcp-api', // Override the name from config file
      transportType: 'STREAMABLE_HTTP',
      transportBaseUrl: 'http://mcp-api:3002',
      configAutoConnect: true
    }
  };

  static getInstance(): McpConfigService {
    if (!McpConfigService.instance) {
      McpConfigService.instance = new McpConfigService();
    }
    return McpConfigService.instance;
  }

  /**
   * Load MCP server configuration from JSON file
   */
  loadConfig(configFileName: string): MCPServerConfig {
    // Check cache first
    if (this.configCache.has(configFileName)) {
      return this.configCache.get(configFileName)!;
    }

    try {
      const configPath = join(__dirname, '../../../src/config', configFileName);
      const configData = readFileSync(configPath, 'utf-8');
      const config: MCPServerConfig = JSON.parse(configData);
      
      // Cache the config
      this.configCache.set(configFileName, config);
      
      return config;
    } catch (error) {
      console.error(`Failed to load MCP config file ${configFileName}:`, error);
      throw new Error(`Cannot load MCP configuration: ${configFileName}`);
    }
  }

  /**
   * Get all default server configurations for initialization
   */
  getDefaultServers(): Array<{
    name: string;
    version: string;
    description: string;
    transportType: 'STREAMABLE_HTTP' | 'STDIO';
    transportBaseUrl?: string;
    transportCommand?: string;
    transportArgs?: string[];
    configAutoConnect: boolean;
    capabilities: {
      tools: Array<{ name: string; description: string }>;
      resources: Array<{ uri: string; name: string; description: string; mimeType?: string }>;
      prompts: Array<{ name: string; description: string; arguments?: any[] }>;
    };
  }> {
    return Object.entries(this.defaultServers).map(([serverName, serverDef]) => {
      const config = this.loadConfig(serverDef.configFile);
      
      return {
        name: serverDef.serverName || config.server.name, // Use override name if provided
        version: config.server.version,
        description: config.server.description,
        transportType: serverDef.transportType,
        transportBaseUrl: serverDef.transportBaseUrl,
        transportCommand: serverDef.transportCommand,
        transportArgs: serverDef.transportArgs,
        configAutoConnect: serverDef.configAutoConnect,
        capabilities: {
          tools: config.tools.map(tool => ({
            name: tool.name,
            description: tool.description
          })),
          resources: config.resources.map(resource => ({
            uri: resource.uri,
            name: resource.name,
            description: resource.description,
            mimeType: resource.mimeType
          })),
          prompts: config.prompts?.map(prompt => ({
            name: prompt.name,
            description: prompt.description,
            arguments: prompt.arguments
          })) || []
        }
      };
    });
  }

  /**
   * Get configuration for a specific server by name
   */
  getServerConfig(serverName: string): MCPServerConfig | null {
    const serverDef = this.defaultServers[serverName];
    if (!serverDef) {
      return null;
    }
    
    return this.loadConfig(serverDef.configFile);
  }

  /**
   * Clear the configuration cache (useful for testing)
   */
  clearCache(): void {
    this.configCache.clear();
  }
}

export default McpConfigService;
