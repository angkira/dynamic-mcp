<template>
  <div class="mcp-item" :class="{ disabled: !server.isEnabled }">
    <n-card :bordered="false" embedded>
      <div class="mcp-item-content">
        <div class="mcp-header">
          <div class="mcp-info">
            <div class="mcp-title-row">
              <h4 class="mcp-name">{{ server.name }}</h4>
              <n-tag :type="statusTagType" size="small">
                <template #icon>
                  <font-awesome-icon :icon="statusIcon" />
                </template>
                {{ server.status }}
              </n-tag>
            </div>
            <p v-if="server.description" class="mcp-description">{{ server.description }}</p>
            <div class="mcp-meta">
              <span class="meta-item">
                <font-awesome-icon icon="code-branch" />
                v{{ server.version }}
              </span>
              <span class="meta-item">
                <font-awesome-icon icon="plug" />
                {{ server.transport.type }}
              </span>
              <span v-if="server.lastConnected" class="meta-item">
                <font-awesome-icon icon="clock" />
                Last: {{ formatDate(server.lastConnected) }}
              </span>
            </div>
          </div>
          <div class="mcp-actions">
            <n-space>
              <n-switch
                :value="server.isEnabled"
                @update:value="$emit('toggle', server.id)"
                size="small"
              />
              <n-button
                v-if="server.status === MCPServerStatus.DISCONNECTED && server.isEnabled"
                size="small"
                type="primary"
                @click="$emit('connect', server.id)"
              >
                Connect
              </n-button>
              <n-button
                v-else-if="server.status === MCPServerStatus.CONNECTED"
                size="small"
                @click="$emit('disconnect', server.id)"
              >
                Disconnect
              </n-button>
              <n-dropdown :options="menuOptions" @select="handleMenuSelect">
                <n-button size="small" quaternary circle>
                  <template #icon>
                    <n-icon><font-awesome-icon icon="ellipsis-v" /></n-icon>
                  </template>
                </n-button>
              </n-dropdown>
            </n-space>
          </div>
        </div>

        <!-- Capabilities Section -->
        <div v-if="server.isEnabled && hasCapabilities" class="mcp-capabilities">
          <n-space :size="16">
            <div v-if="(server.capabilities.tools?.length || 0) > 0" class="capability-group">
              <span class="capability-label">
                <n-icon><font-awesome-icon icon="wrench" /></n-icon>
                Tools ({{ server.capabilities.tools?.length || 0 }})
              </span>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button size="tiny" text @click="showTools = !showTools">
                    {{ showTools ? 'Hide' : 'Show' }}
                  </n-button>
                </template>
                View available tools
              </n-tooltip>
            </div>

            <div v-if="(server.capabilities.resources?.length || 0) > 0" class="capability-group">
              <span class="capability-label">
                <n-icon><font-awesome-icon icon="database" /></n-icon>
                Resources ({{ server.capabilities.resources?.length || 0 }})
              </span>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button size="tiny" text @click="showResources = !showResources">
                    {{ showResources ? 'Hide' : 'Show' }}
                  </n-button>
                </template>
                View available resources
              </n-tooltip>
            </div>

            <div v-if="(server.capabilities.prompts?.length || 0) > 0" class="capability-group">
              <span class="capability-label">
                <n-icon><font-awesome-icon icon="comment-dots" /></n-icon>
                Prompts ({{ server.capabilities.prompts?.length || 0 }})
              </span>
              <n-tooltip trigger="hover">
                <template #trigger>
                  <n-button size="tiny" text @click="showPrompts = !showPrompts">
                    {{ showPrompts ? 'Hide' : 'Show' }}
                  </n-button>
                </template>
                View available prompts
              </n-tooltip>
            </div>
          </n-space>

          <!-- Expandable Sections -->
          <n-collapse-transition :show="showTools">
            <div v-if="showTools" class="capability-details">
              <h5>Available Tools</h5>
              <n-space vertical :size="8">
                <div
                  v-for="tool in server.capabilities.tools || []"
                  :key="tool.name"
                  class="capability-item"
                >
                  <strong>{{ tool.name }}</strong>
                  <span v-if="tool.description" class="item-description"
                    >: {{ tool.description }}</span
                  >
                  <n-tag v-if="tool.category" size="tiny" class="item-tag">{{
                    tool.category
                  }}</n-tag>
                </div>
              </n-space>
            </div>
          </n-collapse-transition>

          <n-collapse-transition :show="showResources">
            <div v-if="showResources" class="capability-details">
              <h5>Available Resources</h5>
              <n-space vertical :size="8">
                <div
                  v-for="resource in server.capabilities.resources || []"
                  :key="resource.uri"
                  class="capability-item"
                >
                  <strong>{{ resource.name }}</strong>
                  <span v-if="resource.description" class="item-description"
                    >: {{ resource.description }}</span
                  >
                  <code class="resource-uri">{{ resource.uri }}</code>
                </div>
              </n-space>
            </div>
          </n-collapse-transition>

          <n-collapse-transition :show="showPrompts">
            <div v-if="showPrompts" class="capability-details">
              <h5>Available Prompts</h5>
              <n-space vertical :size="8">
                <div
                  v-for="prompt in server.capabilities.prompts || []"
                  :key="prompt.name"
                  class="capability-item"
                >
                  <strong>{{ prompt.name }}</strong>
                  <span v-if="prompt.description" class="item-description"
                    >: {{ prompt.description }}</span
                  >
                  <span v-if="prompt.arguments?.length" class="prompt-args">
                    ({{ prompt.arguments.length }} args)
                  </span>
                </div>
              </n-space>
            </div>
          </n-collapse-transition>
        </div>

        <!-- Test Result Section -->
        <div v-if="testResult" class="test-result-section">
          <span class="test-result" :class="testResult.success ? 'success' : 'error'">
            <n-icon>
              <font-awesome-icon :icon="testResult.success ? 'check-circle' : 'times-circle'" />
            </n-icon>
            {{ testResult.message }}
          </span>
        </div>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted, onUnmounted } from 'vue'
import {
  NCard,
  NSpace,
  NTag,
  NIcon,
  NSwitch,
  NButton,
  NDropdown,
  NTooltip,
  NCollapseTransition,
} from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useMcpStore } from '@/stores/mcp'
import { socketService } from '@/services/socket'
import type { MCPServer } from '@/types'
import { MCPServerStatus } from '@/types'

// Props
interface Props {
  server: MCPServer
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  edit: [server: MCPServer]
  delete: [serverId: string]
  toggle: [serverId: string]
  connect: [serverId: string]
  disconnect: [serverId: string]
}>()

// Local state
const showTools = ref(false)
const showResources = ref(false)
const showPrompts = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Store
const mcpStore = useMcpStore()

// Computed properties
const statusTagType = computed(() => {
  switch (props.server.status) {
    case MCPServerStatus.CONNECTED:
      return 'success'
    case MCPServerStatus.DISCONNECTED:
      return 'error'
    case MCPServerStatus.CONNECTING:
      return 'info'
    case MCPServerStatus.ERROR:
      return 'warning'
    default:
      return 'default'
  }
})

const statusIcon = computed(() => {
  switch (props.server.status) {
    case MCPServerStatus.CONNECTED:
      return 'check-circle'
    case MCPServerStatus.DISCONNECTED:
      return 'times-circle'
    case MCPServerStatus.CONNECTING:
      return 'spinner'
    case MCPServerStatus.ERROR:
      return 'exclamation-circle'
    default:
      return 'circle'
  }
})

const hasCapabilities = computed(() => {
  const capabilities = props.server.capabilities
  if (!capabilities) return false
  return (
    (capabilities.tools?.length || 0) > 0 ||
    (capabilities.resources?.length || 0) > 0 ||
    (capabilities.prompts?.length || 0) > 0
  )
})

const menuOptions = computed(() => [
  {
    label: 'Edit',
    key: 'edit',
    icon: () => h(FontAwesomeIcon, { icon: 'edit' }),
  },
  {
    label: testing.value ? 'Testing...' : 'Test Connection',
    key: 'test',
    icon: () => h(FontAwesomeIcon, { icon: testing.value ? 'spinner' : 'plug' }),
    disabled: testing.value,
  },
  {
    type: 'divider',
    key: 'divider',
  },
  {
    label: 'Delete',
    key: 'delete',
    icon: () => h(FontAwesomeIcon, { icon: 'trash' }),
  },
])

// Methods
const testConnection = async () => {
  if (testing.value) return // Prevent multiple simultaneous tests

  testing.value = true
  testResult.value = { success: true, message: 'Testing connection...' }

  try {
    const result = await mcpStore.testConnection(props.server.id)
    testResult.value = result
    testing.value = false

    // Auto-hide result after 5 seconds
    setTimeout(() => {
      testResult.value = null
    }, 5000)
  } catch (error) {
    testing.value = false

    const errorMessage =
      error instanceof Error ? error.message : 'Connection test failed with an error.'
    testResult.value = {
      success: false,
      message: errorMessage,
    }

    // Auto-hide result after 5 seconds
    setTimeout(() => {
      testResult.value = null
    }, 5000)
  }
}

const handleMenuSelect = (key: string) => {
  switch (key) {
    case 'edit':
      emit('edit', props.server)
      break
    case 'test':
      testConnection()
      break
    case 'delete':
      emit('delete', props.server.id)
      break
  }
}

const formatDate = (value: string | Date | undefined | null) => {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
</script>

<style scoped>
.mcp-item {
  transition: opacity 0.3s ease;
}

.mcp-item.disabled {
  opacity: 0.6;
}

.mcp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.mcp-info {
  flex: 1;
  margin-right: 16px;
}

.mcp-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}

.mcp-name {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  color: var(--text-color);
}

.mcp-description {
  font-size: 14px;
  color: var(--text-color-2);
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.mcp-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-color-3);
}

.mcp-actions {
  display: flex;
  align-items: flex-start;
}

.mcp-capabilities {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
}

.capability-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.capability-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--text-color-2);
  font-weight: 500;
}

.capability-details {
  margin-top: 12px;
  padding: 12px;
  background: var(--code-color);
  border-radius: 6px;
}

.capability-details h5 {
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.capability-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-description {
  font-size: 12px;
  color: var(--text-color-2);
}

.item-tag {
  margin-left: auto;
}

.resource-uri {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-color-3);
  background: var(--code-color);
  padding: 2px 4px;
  border-radius: 3px;
}

.prompt-args {
  font-size: 11px;
  color: var(--text-color-3);
  font-style: italic;
}

.test-result-section {
  border-top: 1px solid var(--border-color);
  padding-top: 12px;
  margin-top: 12px;
}

.test-result {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
}

.test-result.success {
  color: var(--success-color);
}

.test-result.error {
  color: var(--error-color);
}
</style>
