<template>
  <div class="chat-settings">
    <!-- Settings Modal/Drawer -->
    <n-modal v-model:show="isVisible" preset="card" :style="{ width: '800px', maxWidth: '90vw' }" title="Chat Settings"
      :bordered="false" size="huge" role="dialog" aria-label="Chat Settings">
      <!-- Tabs Container -->
      <n-tabs v-model:value="activeTab" type="line" animated justify-content="start">
        <!-- General Settings Tab -->
        <n-tab-pane name="general" tab="General Settings">
          <GeneralSettings v-model="localSettings" />
        </n-tab-pane>

        <!-- MCP Settings Tab -->
        <n-tab-pane name="mcp" tab="MCP Servers">
          <div class="settings-section">
            <MCPList :servers="mcpStore.servers" :global-config="mcpStore.globalConfig"
              @add-server="showMCPModal = true" @edit-server="editMCPServer" @delete-server="deleteMCPServer"
              @toggle-server="toggleMCPServer" @connect-server="connectMCPServer"
              @disconnect-server="disconnectMCPServer" @update-global-config="mcpStore.updateGlobalConfig" />
          </div>
        </n-tab-pane>

        <!-- Future tabs can be added here -->
        <n-tab-pane name="advanced" tab="Advanced" disabled>
          <div class="settings-section">
            <n-empty description="Advanced settings coming soon" />
          </div>
        </n-tab-pane>

        <n-tab-pane name="appearance" tab="Appearance" disabled>
          <div class="settings-section">
            <n-empty description="Appearance settings coming soon" />
          </div>
        </n-tab-pane>
      </n-tabs>

      <!-- Action Buttons -->
      <template #action>
        <n-space>
          <n-button @click="resetSettings"> Reset to Defaults </n-button>
          <n-button @click="closeSettings"> Cancel </n-button>
          <n-button type="primary" :loading="settingsStore.isLoading" @click="saveSettings">
            Save Settings
          </n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- MCP Server Settings Modal -->
    <n-modal v-model:show="showMCPModal" preset="card" :style="{ width: '900px', maxWidth: '95vw' }"
      :title="mcpModalTitle" :bordered="false" size="huge" role="dialog" :aria-label="mcpModalTitle">
      <MCPSettings ref="mcpSettingsRef" :server="currentMCPServer" :mode="mcpModalMode" @save="saveMCPServer"
        @cancel="closeMCPModal" />

      <template #action>
        <n-space>
          <n-button @click="closeMCPModal"> Cancel </n-button>
          <n-button type="primary" @click="handleMCPSave">
            {{ mcpModalMode === 'create' ? 'Add Server' : 'Save Changes' }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  NModal,
  NTabs,
  NTabPane,
  NSpace,
  NFormItem,
  NSelect,
  NInputNumber,
  NButton,
  NDivider,
  NEmpty,
  useMessage,
} from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useSettingsStore } from '@/stores/settings'
import { useModelStore } from '@/stores/models'
import { useMcpStore } from '@/stores/mcp'
import GeneralSettings from './GeneralSettings.vue'
import MCPList from './mcp/MCPList.vue'
import MCPSettings from './mcp/MCPSettings.vue'
import { MCPServerStatus } from '@/types'
import type { Settings, MCPServer, MCPSettings as MCPSettingsType } from '@/types'

// Props
interface Props {
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
})

// Emits
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

// Stores
const settingsStore = useSettingsStore()
const modelStore = useModelStore()
const mcpStore = useMcpStore()
const message = useMessage()

const defaultSettings = {
  defaultProvider: 'google',
  defaultModel: 'gemini-2.5-flash',
  thinkingBudget: 2048,
  responseBudget: 8192,
  mcpEnableDebugLogging: false,
  mcpDefaultTimeout: 30000,
  mcpMaxConcurrentConnections: 10,
  mcpAutoDiscovery: true,
}

// Local state
const activeTab = ref('general')
const localSettings = ref<Settings>(defaultSettings)

// MCP-related state
const showMCPModal = ref(false)
const mcpModalMode = ref<'create' | 'edit'>('create')
const currentMCPServer = ref<MCPServer | undefined>(undefined)
const mcpSettingsRef = ref()

// Computed
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const providerOptions = computed(() =>
  modelStore.availableModels.map((group) => ({
    label: group.provider.charAt(0).toUpperCase() + group.provider.slice(1),
    value: group.provider,
  })),
)

const modelOptions = computed(() => {
  const provider = modelStore.availableModels.find(
    (group) => group.provider === localSettings.value.defaultProvider,
  )
  return (
    provider?.models.map((model) => ({
      label: model.name,
      value: model.id,
    })) || []
  )
})

const mcpModalTitle = computed(() => {
  return mcpModalMode.value === 'create' ? 'Add MCP Server' : 'Edit MCP Server'
})

// MCP Methods
const editMCPServer = (server: MCPServer) => {
  currentMCPServer.value = server
  mcpModalMode.value = 'edit'
  showMCPModal.value = true
}

const deleteMCPServer = async (serverId: string) => {
  const success = await mcpStore.deleteServer(serverId)
  if (success) {
    message.success('MCP server deleted successfully')
  } else {
    message.error(mcpStore.error || 'Failed to delete MCP server')
  }
}

const toggleMCPServer = async (serverId: string) => {
  const server = mcpStore.servers.find((s) => s.id === serverId)
  const success = await mcpStore.toggleServer(serverId)
  if (success && server) {
    message.success(`MCP server ${server.isEnabled ? 'disabled' : 'enabled'}`)
  } else {
    message.error(mcpStore.error || 'Failed to toggle MCP server')
  }
}

const connectMCPServer = async (serverId: string) => {
  const server = mcpStore.servers.find((s) => s.id === serverId)
  const success = await mcpStore.connectServer(serverId)
  if (success && server) {
    message.success(`Connected to ${server.name}`)
  } else {
    message.error(mcpStore.error || `Failed to connect to ${server?.name || 'server'}`)
  }
}

const disconnectMCPServer = async (serverId: string) => {
  const server = mcpStore.servers.find((s) => s.id === serverId)
  const success = await mcpStore.disconnectServer(serverId)
  if (success && server) {
    message.success(`Disconnected from ${server.name}`)
  } else {
    message.error(mcpStore.error || 'Failed to disconnect MCP server')
  }
}

const saveMCPServer = async (serverData: Partial<MCPServer>) => {
  let success = false

  if (mcpModalMode.value === 'create') {
    success = await mcpStore.createServer(serverData)
    if (success) {
      message.success('MCP server added successfully')
    } else {
      message.error(mcpStore.error || 'Failed to create MCP server')
    }
  } else if (currentMCPServer.value) {
    success = await mcpStore.updateServer(currentMCPServer.value.id, serverData)
    if (success) {
      message.success('MCP server updated successfully')
    } else {
      message.error(mcpStore.error || 'Failed to update MCP server')
    }
  }

  if (success) {
    closeMCPModal()
  }
}

const handleMCPSave = async () => {
  try {
    await mcpSettingsRef.value?.save()
  } catch (error) {
    console.error('Failed to save MCP server:', error)
  }
}

const closeMCPModal = () => {
  showMCPModal.value = false
  currentMCPServer.value = undefined
  mcpModalMode.value = 'create'
}

// General Settings Methods
const loadSettings = async () => {
  await settingsStore.fetchSettings()
  localSettings.value = { ...settingsStore.settings }
}

const saveSettings = async () => {
  try {
    await settingsStore.updateSettings(localSettings.value)
    message.success('Settings saved successfully')
    closeSettings()
  } catch (error) {
    message.error('Failed to save settings')
  }
}

const resetSettings = () => {
  localSettings.value = { ...defaultSettings }
}

const closeSettings = () => {
  isVisible.value = false
}

// Watch for settings changes
watch(
  () => settingsStore.settings,
  (newSettings) => {
    localSettings.value = { ...defaultSettings, ...newSettings }
  },
  { deep: true },
)

// Load data on mount
onMounted(async () => {
  await Promise.all([modelStore.fetchModels(), loadSettings(), mcpStore.initialize()])
})
</script>

<style scoped>
.settings-section {
  padding: 16px 0;
}
</style>
