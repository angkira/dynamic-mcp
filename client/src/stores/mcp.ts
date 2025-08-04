import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mcpApi } from '@/services/api/mcp'
import { socketService } from '@/services/socket'
import { useSettingsStore } from '@/stores/settings'
import type { MCPServer, MCPSettings } from '@/types'
import { MCPServerStatus, MCPTransportType, MCPAuthType } from '@/types'

export const useMcpStore = defineStore('mcp', () => {
  // State
  const servers = ref<MCPServer[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Get settings store for global MCP config
  const settingsStore = useSettingsStore()
  
  // Global MCP settings are now derived from main settings
  const globalConfig = computed(() => ({
    enableDebugLogging: settingsStore.settings.mcpEnableDebugLogging,
    defaultTimeout: settingsStore.settings.mcpDefaultTimeout,
    maxConcurrentConnections: settingsStore.settings.mcpMaxConcurrentConnections,
    autoDiscovery: settingsStore.settings.mcpAutoDiscovery
  }))

  // Computed
  const connectedServers = computed(() => 
    servers.value.filter(server => server.status === MCPServerStatus.Connected)
  )
  
  const enabledServers = computed(() => 
    servers.value.filter(server => server.isEnabled)
  )
  
  const mcpSettings = computed((): MCPSettings => ({
    servers: servers.value,
    globalConfig: globalConfig.value
  }))

  // Actions
  const fetchServers = async () => {
    isLoading.value = true
    error.value = null
    
    try {
      const fetchedServers = await mcpApi.getServers()
      // Normalize capabilities to ensure they have the expected structure
      servers.value = fetchedServers.map(server => ({
        ...server,
        capabilities: {
          tools: server.capabilities?.tools || [],
          resources: server.capabilities?.resources || [],
          prompts: server.capabilities?.prompts || [],
          supportsElicitation: server.capabilities?.supportsElicitation,
          supportsRoots: server.capabilities?.supportsRoots,
          supportsProgress: server.capabilities?.supportsProgress
        }
      }))
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch MCP servers'
      console.error('Error fetching MCP servers:', err)
    } finally {
      isLoading.value = false
    }
  }

  const getServer = async (id: string): Promise<MCPServer | null> => {
    try {
      const server = await mcpApi.getServer(id)
      if (!server) return null
      
      // Normalize capabilities to ensure they have the expected structure
      return {
        ...server,
        capabilities: {
          tools: server.capabilities?.tools || [],
          resources: server.capabilities?.resources || [],
          prompts: server.capabilities?.prompts || [],
          supportsElicitation: server.capabilities?.supportsElicitation,
          supportsRoots: server.capabilities?.supportsRoots,
          supportsProgress: server.capabilities?.supportsProgress
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch MCP server'
      console.error('Error fetching MCP server:', err)
      return null
    }
  }

  const createServer = async (serverData: Partial<MCPServer>): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    
    try {
      const result = await mcpApi.createServer(serverData)
      
      // Add the new server to the local state with the returned ID
      const newServer: MCPServer = {
        id: result.id,
        name: serverData.name || '',
        version: serverData.version || '1.0.0',
        description: serverData.description,
        isEnabled: serverData.isEnabled ?? true,
        status: MCPServerStatus.Disconnected,
        transport: serverData.transport || {
          type: MCPTransportType.STDIO,
          config: {}
        },
        authentication: serverData.authentication || {
          type: MCPAuthType.NONE,
          config: {}
        },
        config: serverData.config || {
          autoConnect: false,
          connectionTimeout: 10000,
          maxRetries: 3,
          retryDelay: 2000,
          validateCertificates: true,
          debug: false
        },
        capabilities: serverData.capabilities || {
          tools: [],
          resources: [],
          prompts: []
        }
      }
      
      servers.value.push(newServer)
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create MCP server'
      console.error('Error creating MCP server:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const updateServer = async (id: string, serverData: Partial<MCPServer>): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    
    try {
      await mcpApi.updateServer(id, serverData)
      
      // Update the server in local state
      const index = servers.value.findIndex(s => s.id === id)
      if (index > -1) {
        servers.value[index] = { ...servers.value[index], ...serverData }
      }
      
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update MCP server'
      console.error('Error updating MCP server:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const updateServerStatus = async (id: string, status: MCPServerStatus, lastConnected?: Date): Promise<boolean> => {
    try {
      await mcpApi.updateServerStatus(id, status, lastConnected)
      
      // Update the server status in local state
      const server = servers.value.find(s => s.id === id)
      if (server) {
        server.status = status
        if (lastConnected) {
          server.lastConnected = lastConnected
        } else if (status === MCPServerStatus.Connected) {
          server.lastConnected = new Date()
        }
      }
      
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update MCP server status'
      console.error('Error updating MCP server status:', err)
      return false
    }
  }

  const deleteServer = async (id: string): Promise<boolean> => {
    isLoading.value = true
    error.value = null
    
    try {
      await mcpApi.deleteServer(id)
      
      // Remove the server from local state
      const index = servers.value.findIndex(s => s.id === id)
      if (index > -1) {
        servers.value.splice(index, 1)
      }
      
      return true
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete MCP server'
      console.error('Error deleting MCP server:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  const toggleServer = async (id: string): Promise<boolean> => {
    const server = servers.value.find(s => s.id === id)
    if (!server) return false
    
    return await updateServer(id, { isEnabled: !server.isEnabled })
  }

  const connectServer = async (id: string): Promise<boolean> => {
    const server = servers.value.find(s => s.id === id)
    if (!server || !server.isEnabled) return false
    
    // Set status to connecting
    await updateServerStatus(id, MCPServerStatus.Connecting)
    
    try {
      const result = await mcpApi.testConnection(id)
      
      if (result.success) {
        await updateServerStatus(id, MCPServerStatus.Connected, new Date())
        return true
      } else {
        await updateServerStatus(id, MCPServerStatus.Error)
        error.value = result.message
        return false
      }
    } catch (err) {
      await updateServerStatus(id, MCPServerStatus.Error)
      error.value = err instanceof Error ? err.message : 'Connection failed'
      return false
    }
  }

  const disconnectServer = async (id: string): Promise<boolean> => {
    return await updateServerStatus(id, MCPServerStatus.Disconnected)
  }

  const testConnection = async (id: string): Promise<{ success: boolean; message: string }> => {
    return new Promise((resolve, reject) => {
      if (!socketService.socket) {
        socketService.connect()
      }

      let timeoutId: NodeJS.Timeout | null = null

      // Set up one-time listeners for this specific test
      const handleTestComplete = (data: { serverId: string; success: boolean; message: string }) => {
        if (data.serverId === id) {
          cleanup()
          resolve({ success: data.success, message: data.message })
        }
      }

      const handleTestError = (data: { serverId: string; error: string }) => {
        if (data.serverId === id) {
          cleanup()
          resolve({ success: false, message: data.error })
        }
      }

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
        socketService.off('mcp:test:complete', handleTestComplete)
        socketService.off('mcp:test:error', handleTestError)
      }

      // Set up timeout
      timeoutId = setTimeout(() => {
        cleanup()
        resolve({ success: false, message: 'Test connection timeout (30s)' })
      }, 30000)

      // Listen for responses
      socketService.on('mcp:test:complete', handleTestComplete)
      socketService.on('mcp:test:error', handleTestError)

      try {
        // Send WebSocket request to test MCP server
        socketService.emit('mcp:test:request', { serverId: id })
      } catch (err) {
        cleanup()
        const message = err instanceof Error ? err.message : 'Failed to send test request'
        resolve({ success: false, message })
      }
    })
  }

  const updateGlobalConfig = async (key: keyof typeof globalConfig.value, value: unknown) => {
    // Map MCP config keys to settings keys
    const settingsKey = `mcp${key.charAt(0).toUpperCase() + key.slice(1)}` as keyof typeof settingsStore.settings
    
    // Update the main settings store
    await settingsStore.updateSettings({
      [settingsKey]: value
    } as any)
  }

  const clearError = () => {
    error.value = null
  }

  // Initialize store
  const initialize = async () => {
    // Ensure settings are loaded first so global config is available
    await settingsStore.fetchSettings()
    await fetchServers()
  }

  return {
    // State
    servers,
    isLoading,
    error,
    globalConfig,
    
    // Computed
    connectedServers,
    enabledServers,
    mcpSettings,
    
    // Actions
    fetchServers,
    getServer,
    createServer,
    updateServer,
    updateServerStatus,
    deleteServer,
    toggleServer,
    connectServer,
    disconnectServer,
    testConnection,
    updateGlobalConfig,
    clearError,
    initialize
  }
})