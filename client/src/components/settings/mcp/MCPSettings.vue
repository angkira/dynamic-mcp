<template>
  <div class="mcp-settings">
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="left" label-width="140px"
      require-mark-placement="right-hanging">
      <!-- Basic Information -->
      <div class="form-section">
        <h3 class="section-title">Basic Information</h3>

        <n-form-item label="Server Name" path="name" required>
          <n-input v-model:value="formData.name" placeholder="Enter server name" :disabled="isEditing" />
        </n-form-item>

        <n-form-item label="Version" path="version" required>
          <n-input v-model:value="formData.version" placeholder="e.g., 1.0.0" />
        </n-form-item>

        <n-form-item label="Description" path="description">
          <n-input v-model:value="formData.description" type="textarea"
            placeholder="Optional description of the MCP server" :autosize="{ minRows: 2, maxRows: 4 }" />
        </n-form-item>

        <n-form-item label="Enabled" path="isEnabled">
          <n-switch v-model:value="formData.isEnabled" />
          <span class="field-help">Enable this MCP server</span>
        </n-form-item>
      </div>

      <n-divider />

      <!-- Transport Configuration -->
      <div class="form-section">
        <h3 class="section-title">Transport Configuration</h3>

        <n-form-item label="Transport Type" path="transport.type" required>
          <n-select v-model:value="formData.transport.type" :options="transportOptions"
            @update:value="onTransportTypeChange" />
        </n-form-item>

        <!-- STDIO Transport Config -->
        <template v-if="formData.transport.type === MCPTransportType.STDIO">
          <n-form-item label="Command" path="transport.config.command" required>
            <n-input v-model:value="formData.transport.config.command" placeholder="e.g., node, python, ./server" />
          </n-form-item>

          <n-form-item label="Arguments" path="transport.config.args">
            <n-dynamic-input v-model:value="formData.transport.config.args" placeholder="Add argument" :min="0" />
          </n-form-item>

          <n-form-item label="Environment Variables" path="transport.config.env">
            <n-dynamic-input v-model:value="envPairs" :on-create="createEnvPair" placeholder="Add environment variable"
              :min="0">
              <template #default="{ value, index }">
                <div style="display: flex; gap: 8px; width: 100%">
                  <n-input v-model:value="value.key" placeholder="Variable name" style="flex: 1"
                    @update:value="updateEnvKey(index, $event)" />
                  <n-input v-model:value="value.value" placeholder="Variable value" style="flex: 1"
                    @update:value="updateEnvValue(index, $event)" />
                </div>
              </template>
            </n-dynamic-input>
          </n-form-item>
        </template>

        <!-- HTTP Transport Config -->
        <template v-else-if="['sse', 'streamable-http'].includes(formData.transport.type)">
          <n-form-item label="Base URL" path="transport.config.baseUrl" required>
            <n-input v-model:value="formData.transport.config.baseUrl" placeholder="https://example.com/mcp" />
          </n-form-item>

          <n-form-item label="Tool Call Endpoint" path="transport.config.toolEndpoint">
            <n-input v-model:value="formData.transport.config.toolEndpoint" placeholder="/call-tool" />
            <template #suffix>
              <span class="field-help">Endpoint for executing tools</span>
            </template>
          </n-form-item>

          <n-form-item label="Health Check Endpoint" path="transport.config.healthEndpoint">
            <n-input v-model:value="formData.transport.config.healthEndpoint" placeholder="/health" />
            <template #suffix>
              <span class="field-help">Endpoint for health checks</span>
            </template>
          </n-form-item>

          <n-form-item label="Tools Discovery Endpoint" path="transport.config.toolsEndpoint">
            <n-input v-model:value="formData.transport.config.toolsEndpoint" placeholder="/tools" />
            <template #suffix>
              <span class="field-help">Endpoint for listing available tools</span>
            </template>
          </n-form-item>

          <n-form-item label="Resources Endpoint" path="transport.config.resourcesEndpoint">
            <n-input v-model:value="formData.transport.config.resourcesEndpoint" placeholder="/resources" />
            <template #suffix>
              <span class="field-help">Endpoint for accessing resources</span>
            </template>
          </n-form-item>

          <n-form-item label="Timeout (ms)" path="transport.config.timeout">
            <n-input-number v-model:value="formData.transport.config.timeout" :min="1000" :max="30000" :step="1000"
              placeholder="10000" />
          </n-form-item>

          <n-form-item label="Retry Attempts" path="transport.config.retryAttempts">
            <n-input-number v-model:value="formData.transport.config.retryAttempts" :min="0" :max="10" :step="1"
              placeholder="3" />
          </n-form-item>
        </template>
      </div>

      <n-divider />

      <!-- Authentication Configuration -->
      <div class="form-section">
        <h3 class="section-title">Authentication</h3>

        <n-form-item label="Authentication Type" path="authentication.type">
          <n-select v-model:value="formData.authentication.type" :options="authOptions"
            @update:value="onAuthTypeChange" />
        </n-form-item>

        <!-- OAuth Configuration -->
        <template v-if="formData.authentication.type === MCPAuthType.OAUTH">
          <n-form-item label="Client ID" path="authentication.config.clientId" required>
            <n-input v-model:value="formData.authentication.config.clientId" />
          </n-form-item>

          <n-form-item label="Client Secret" path="authentication.config.clientSecret" required>
            <n-input v-model:value="formData.authentication.config.clientSecret" type="password"
              show-password-on="mousedown" />
          </n-form-item>

          <n-form-item label="Authorization URL" path="authentication.config.authUrl" required>
            <n-input v-model:value="formData.authentication.config.authUrl" />
          </n-form-item>

          <n-form-item label="Token URL" path="authentication.config.tokenUrl" required>
            <n-input v-model:value="formData.authentication.config.tokenUrl" />
          </n-form-item>

          <n-form-item label="Scopes" path="authentication.config.scopes">
            <n-dynamic-input v-model:value="formData.authentication.config.scopes" placeholder="Add scope" :min="0" />
          </n-form-item>
        </template>

        <!-- API Key Configuration -->
        <template v-else-if="formData.authentication.type === MCPAuthType.APIKEY">
          <n-form-item label="API Key" path="authentication.config.apiKey" required>
            <n-input v-model:value="formData.authentication.config.apiKey" type="password"
              show-password-on="mousedown" />
          </n-form-item>

          <n-form-item label="Header Name" path="authentication.config.headerName">
            <n-input v-model:value="formData.authentication.config.headerName" placeholder="X-API-Key" />
          </n-form-item>
        </template>

        <!-- Bearer Token Configuration -->
        <template v-else-if="formData.authentication.type === MCPAuthType.BEARER">
          <n-form-item label="Bearer Token" path="authentication.config.token" required>
            <n-input v-model:value="formData.authentication.config.token" type="password"
              show-password-on="mousedown" />
          </n-form-item>
        </template>
      </div>

      <n-divider />

      <!-- Server Configuration -->
      <div class="form-section">
        <h3 class="section-title">Server Configuration</h3>

        <n-form-item label="Auto Connect" path="config.autoConnect">
          <n-switch v-model:value="formData.config.autoConnect" />
          <span class="field-help">Automatically connect when starting</span>
        </n-form-item>

        <n-form-item label="Connection Timeout" path="config.connectionTimeout">
          <n-input-number v-model:value="formData.config.connectionTimeout" :min="5000" :max="60000" :step="1000" />
          <template #suffix>ms</template>
        </n-form-item>

        <n-form-item label="Max Retries" path="config.maxRetries">
          <n-input-number v-model:value="formData.config.maxRetries" :min="0" :max="10" :step="1" />
        </n-form-item>

        <n-form-item label="Retry Delay" path="config.retryDelay">
          <n-input-number v-model:value="formData.config.retryDelay" :min="1000" :max="30000" :step="1000" />
          <template #suffix>ms</template>
        </n-form-item>

        <n-form-item label="Validate Certificates" path="config.validateCertificates">
          <n-switch v-model:value="formData.config.validateCertificates" />
          <span class="field-help">Validate SSL certificates (recommended)</span>
        </n-form-item>

        <n-form-item label="Debug Mode" path="config.debug">
          <n-switch v-model:value="formData.config.debug" />
          <span class="field-help">Enable debug logging for this server</span>
        </n-form-item>
      </div>
    </n-form>

    <!-- Test Connection Button -->
    <div class="test-section">
      <n-button @click="testConnection" :loading="testing" :disabled="!isFormValid" secondary>
        <template #icon>
          <n-icon><font-awesome-icon icon="plug" /></n-icon>
        </template>
        Test Connection
      </n-button>
      <span v-if="testResult" class="test-result" :class="testResult.success ? 'success' : 'error'">
        {{ testResult.message }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import {
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  NInputNumber,
  NDynamicInput,
  NDivider,
  NButton,
  NIcon,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useMcpStore } from '@/stores/mcp'
import type { MCPServer, MCPServerStatus } from '@/types'
import { MCPTransportType, MCPAuthType } from '@/types'

// Props
interface Props {
  server?: MCPServer
  mode?: 'create' | 'edit'
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
})

// Emits
const emit = defineEmits<{
  save: [server: Partial<MCPServer>]
  cancel: []
}>()

// Refs
const formRef = ref<FormInst>()
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Store
const mcpStore = useMcpStore()

// Form data
const formData = reactive({
  name: '',
  version: '1.0.0',
  description: '',
  isEnabled: true,
  transport: {
    type: MCPTransportType.STDIO,
    config: {
      command: '',
      args: [] as string[],
      env: {} as Record<string, string>,
      baseUrl: '',
      toolEndpoint: '/call-tool',
      healthEndpoint: '/health',
      toolsEndpoint: '/tools',
      resourcesEndpoint: '/resources',
      timeout: 10000,
      retryAttempts: 3,
    },
  },
  authentication: {
    type: MCPAuthType.NONE,
    config: {
      clientId: '',
      clientSecret: '',
      authUrl: '',
      tokenUrl: '',
      scopes: [] as string[],
      apiKey: '',
      headerName: 'X-API-Key',
      token: '',
    },
  },
  config: {
    autoConnect: false,
    connectionTimeout: 10000,
    maxRetries: 3,
    retryDelay: 2000,
    validateCertificates: true,
    debug: false,
  },
})

// Environment variables as key-value pairs
const envPairs = ref<Array<{ key: string; value: string }>>([])

// Computed
const isEditing = computed(() => props.mode === 'edit')
const isFormValid = computed(() => {
  return formData.name && formData.version && formData.transport.type
})

// Options
const transportOptions = [
  { label: 'Standard I/O', value: MCPTransportType.STDIO },
  { label: 'Server-Sent Events (Legacy)', value: MCPTransportType.SSE },
  { label: 'Streamable HTTP', value: MCPTransportType.STREAMABLE_HTTP },
]

const authOptions = [
  { label: 'None', value: MCPAuthType.NONE },
  { label: 'OAuth 2.0', value: MCPAuthType.OAUTH },
  { label: 'API Key', value: MCPAuthType.APIKEY },
  { label: 'Bearer Token', value: MCPAuthType.BEARER },
]

// Form rules
const formRules: FormRules = {
  name: [
    { required: true, message: 'Server name is required' },
    { min: 1, max: 50, message: 'Name must be 1-50 characters' },
  ],
  version: [
    { required: true, message: 'Version is required' },
    { pattern: /^\d+\.\d+\.\d+$/, message: 'Version must be in format x.y.z' },
  ],
  'transport.type': [{ required: true, message: 'Transport type is required' }],
  'transport.config.command': [
    {
      required: true,
      message: 'Command is required for stdio transport',
      trigger: ['blur', 'change'],
    },
  ],
  'transport.config.baseUrl': [
    {
      required: true,
      message: 'Base URL is required for HTTP transports',
      trigger: ['blur', 'change'],
    },
    {
      pattern: /^https?:\/\/.+/,
      message: 'Base URL must be a valid HTTP/HTTPS URL',
      trigger: ['blur', 'change'],
    },
  ],
}

// Methods
const createEnvPair = () => ({ key: '', value: '' })

const updateEnvKey = (index: number, key: string) => {
  const oldKey = envPairs.value[index]?.key
  if (oldKey && formData.transport.config.env) {
    delete formData.transport.config.env[oldKey]
  }
  if (key && envPairs.value[index]) {
    envPairs.value[index].key = key
    updateEnv()
  }
}

const updateEnvValue = (index: number, value: string) => {
  if (envPairs.value[index]) {
    envPairs.value[index].value = value
    updateEnv()
  }
}

const updateEnv = () => {
  formData.transport.config.env = {}
  envPairs.value.forEach((pair) => {
    if (pair.key) {
      formData.transport.config.env[pair.key] = pair.value
    }
  })
}

const onTransportTypeChange = (type: string) => {
  // Reset transport config when type changes
  formData.transport.config = {
    command: '',
    args: [],
    env: {},
    baseUrl: '',
    toolEndpoint: '/call-tool',
    healthEndpoint: '/health',
    toolsEndpoint: '/tools',
    resourcesEndpoint: '/resources',
    timeout: 10000,
    retryAttempts: 3,
  }
  envPairs.value = []
}

const onAuthTypeChange = (type: string) => {
  // Reset auth config when type changes
  formData.authentication.config = {
    clientId: '',
    clientSecret: '',
    authUrl: '',
    tokenUrl: '',
    scopes: [],
    apiKey: '',
    headerName: 'X-API-Key',
    token: '',
  }
}

const testConnection = async () => {
  testing.value = true
  testResult.value = null

  try {
    // If editing existing server, test with current server ID
    if (props.mode === 'edit' && props.server?.id) {
      const result = await mcpStore.testConnection(props.server.id)
      testResult.value = result
    } else {
      // For new servers, we can't test without creating them first
      testResult.value = {
        success: false,
        message: 'Please save the server first before testing the connection.',
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: 'Connection test failed with an error.',
    }
  } finally {
    testing.value = false
  }
}

const saveServer = async () => {
  try {
    await formRef.value?.validate()
    emit('save', formData)
  } catch (error) {
    console.error('Form validation failed:', error)
  }
}

const cancel = () => {
  emit('cancel')
}

// Initialize form with server data if editing
watch(
  () => props.server,
  (server) => {
    if (server) {
      Object.assign(formData, server)

      // Convert env object to pairs
      if (server.transport.config.env) {
        envPairs.value = Object.entries(server.transport.config.env || {}).map(([key, value]) => ({
          key,
          value: String(value ?? ''),
        }))
      }
    }
  },
  { immediate: true },
)

// Watch env pairs to update form data
watch(envPairs, updateEnv, { deep: true })

// Expose methods for parent component
defineExpose({
  save: saveServer,
  cancel,
  validate: () => formRef.value?.validate(),
})
</script>

<style scoped>
.mcp-settings {
  max-width: 800px;
  margin: 0 auto;
}

.form-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 16px 0;
  color: var(--text-color);
}

.field-help {
  margin-left: 8px;
  font-size: 12px;
  color: var(--text-color-3);
}

.test-section {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  padding: 16px;
  background: var(--code-color);
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.test-result {
  font-size: 14px;
  font-weight: 500;
}

.test-result.success {
  color: var(--success-color);
}

.test-result.error {
  color: var(--error-color);
}

:deep(.n-form-item-feedback-wrapper) {
  min-height: 18px;
}
</style>
