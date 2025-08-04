<template>
  <div class="mcp-list">
    <div class="mcp-list-header">
      <n-space justify="space-between" align="center">
        <div>
          <h3 class="list-title">MCP Servers</h3>
          <p class="list-description">
            Manage Model Context Protocol servers that provide tools, resources, and prompts
          </p>
        </div>
        <n-button type="primary" @click="$emit('add-server')">
          <template #icon>
            <n-icon><font-awesome-icon icon="plus" /></n-icon>
          </template>
          Add Server
        </n-button>
      </n-space>
    </div>

    <div class="mcp-list-content">
      <n-empty v-if="servers.length === 0" description="No MCP servers configured">
        <template #extra>
          <n-button size="small" @click="$emit('add-server')"> Add your first MCP server </n-button>
        </template>
      </n-empty>

      <n-space v-else vertical :size="12">
        <MCPItem
          v-for="server in servers"
          :key="server.id"
          :server="server"
          @edit="$emit('edit-server', $event)"
          @delete="$emit('delete-server', $event)"
          @toggle="$emit('toggle-server', $event)"
          @connect="$emit('connect-server', $event)"
          @disconnect="$emit('disconnect-server', $event)"
        />
      </n-space>
    </div>

    <!-- Global MCP Settings -->
    <div class="mcp-global-settings">
      <n-divider />
      <h4 class="section-title">Global Settings</h4>

      <n-space vertical :size="16">
        <div class="setting-row">
          <n-form-item label="Debug Logging" label-placement="left">
            <n-switch
              :value="globalConfig.enableDebugLogging"
              @update:value="updateGlobalConfig('enableDebugLogging', $event)"
            />
          </n-form-item>
          <div class="setting-help">Enable detailed logging for MCP server connections</div>
        </div>

        <div class="setting-row">
          <n-form-item label="Default Timeout" label-placement="left">
            <n-input-number
              :value="globalConfig.defaultTimeout"
              @update:value="updateGlobalConfig('defaultTimeout', $event)"
              :min="1000"
              :max="30000"
              :step="1000"
              style="min-width: 150px"
            />
            <template #suffix>ms</template>
          </n-form-item>
          <div class="setting-help">Default connection timeout for MCP servers (1-30 seconds)</div>
        </div>

        <div class="setting-row">
          <n-form-item label="Max Concurrent Connections" label-placement="left">
            <n-input-number
              :value="globalConfig.maxConcurrentConnections"
              @update:value="updateGlobalConfig('maxConcurrentConnections', $event)"
              :min="1"
              :max="20"
              :step="1"
              style="min-width: 150px"
            />
          </n-form-item>
          <div class="setting-help">Maximum number of simultaneous MCP server connections</div>
        </div>

        <div class="setting-row">
          <n-form-item label="Auto Discovery" label-placement="left">
            <n-switch
              :value="globalConfig.autoDiscovery"
              @update:value="updateGlobalConfig('autoDiscovery', $event)"
            />
          </n-form-item>
          <div class="setting-help">Automatically discover MCP servers in common locations</div>
        </div>
      </n-space>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NSpace,
  NButton,
  NIcon,
  NEmpty,
  NDivider,
  NFormItem,
  NSwitch,
  NInputNumber,
} from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import MCPItem from './MCPItem.vue'
import type { MCPServer } from '@/types'

// Props
interface Props {
  servers: MCPServer[]
  globalConfig: {
    enableDebugLogging: boolean
    defaultTimeout: number
    maxConcurrentConnections: number
    autoDiscovery: boolean
  }
}

defineProps<Props>()

// Emits
const emit = defineEmits<{
  'add-server': []
  'edit-server': [server: MCPServer]
  'delete-server': [serverId: string]
  'toggle-server': [serverId: string]
  'connect-server': [serverId: string]
  'disconnect-server': [serverId: string]
  'update-global-config': [key: keyof Props['globalConfig'], value: unknown]
}>()

// Methods
const updateGlobalConfig = (key: keyof Props['globalConfig'], value: unknown) => {
  emit('update-global-config', key, value)
}
</script>

<style scoped>
.mcp-list {
  /* Container styles */
}

.mcp-list-header {
  margin-bottom: 24px;
}

.list-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: var(--text-color);
}

.list-description {
  font-size: 14px;
  color: var(--text-color-2);
  margin: 0;
  line-height: 1.5;
}

.mcp-list-content {
  margin-bottom: 32px;
}

.mcp-global-settings {
  margin-top: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--text-color);
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-help {
  font-size: 12px;
  color: var(--text-color-3);
  margin-left: 180px;
  /* Align with form item content */
}

:deep(.n-form-item) {
  --n-label-width: 180px;
}

:deep(.n-form-item .n-form-item-label) {
  min-width: var(--n-label-width);
  justify-content: flex-start;
}
</style>
