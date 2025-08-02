<template>
  <div class="chat-settings">
    <!-- Settings Modal/Drawer -->
    <n-modal v-model:show="isVisible" preset="card" :style="{ width: '800px', maxWidth: '90vw' }" title="Chat Settings"
      :bordered="false" size="huge" role="dialog" aria-label="Chat Settings">

      <!-- Tabs Container -->
      <n-tabs v-model:value="activeTab" type="line" animated justify-content="start">
        <!-- General Settings Tab -->
        <n-tab-pane name="general" tab="General Settings">
          <div class="settings-section">
            <n-space vertical :size="24">
              <!-- Default Model Section -->
              <div class="setting-group">
                <h3 class="setting-title">Default Model</h3>
                <p class="setting-description">
                  Choose the default AI model for new conversations
                </p>

                <n-space vertical :size="12">
                  <!-- Provider Selection -->
                  <div class="setting-item">
                    <n-form-item label="Provider" label-placement="left">
                      <n-select v-model:value="localSettings.defaultProvider" :options="providerOptions"
                        placeholder="Select provider" :loading="modelStore.isLoading" @update:value="onProviderChange"
                        style="min-width: 200px" />
                    </n-form-item>
                  </div>

                  <!-- Model Selection -->
                  <div class="setting-item">
                    <n-form-item label="Model" label-placement="left">
                      <n-select v-model:value="localSettings.defaultModel" :options="modelOptions"
                        placeholder="Select model" :loading="modelStore.isLoading"
                        :disabled="!localSettings.defaultProvider" style="min-width: 200px" />
                    </n-form-item>
                  </div>
                </n-space>
              </div>

              <n-divider />

              <!-- Budget Settings Section -->
              <div class="setting-group">
                <h3 class="setting-title">Response Budgets</h3>
                <p class="setting-description">
                  Control the token limits for AI responses and reasoning
                </p>

                <n-space vertical :size="16">
                  <!-- Thinking Budget -->
                  <div class="setting-item">
                    <n-form-item label="Thinking Budget" label-placement="left">
                      <n-input-number v-model:value="localSettings.thinkingBudget" :min="256" :max="8192" :step="256"
                        style="min-width: 200px" />
                      <template #suffix>tokens</template>
                    </n-form-item>
                    <div class="setting-help">
                      Maximum tokens for internal reasoning (256-8192)
                    </div>
                  </div>

                  <!-- Response Budget -->
                  <div class="setting-item">
                    <n-form-item label="Response Budget" label-placement="left">
                      <n-input-number v-model:value="localSettings.responseBudget" :min="512" :max="16384" :step="512"
                        style="min-width: 200px" />
                      <template #suffix>tokens</template>
                    </n-form-item>
                    <div class="setting-help">
                      Maximum tokens for the final response (512-16384)
                    </div>
                  </div>
                </n-space>
              </div>
            </n-space>
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
          <n-button @click="resetSettings">
            Reset to Defaults
          </n-button>
          <n-button @click="closeSettings">
            Cancel
          </n-button>
          <n-button type="primary" :loading="settingsStore.isLoading" @click="saveSettings">
            Save Settings
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
  useMessage
} from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useSettingsStore } from '@/stores/settings'
import { useModelStore } from '@/stores/models'
import type { Settings } from '@/types'

// Props
interface Props {
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false
})

// Emits
const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

// Stores
const settingsStore = useSettingsStore()
const modelStore = useModelStore()
const message = useMessage()

// Local state
const activeTab = ref('general')
const localSettings = ref<Settings>({
  defaultProvider: 'openai',
  defaultModel: 'o3-mini',
  thinkingBudget: 2048,
  responseBudget: 8192
})

// Computed
const isVisible = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value)
})

const providerOptions = computed(() =>
  modelStore.availableModels.map(group => ({
    label: group.provider.charAt(0).toUpperCase() + group.provider.slice(1),
    value: group.provider
  }))
)

const modelOptions = computed(() => {
  const provider = modelStore.availableModels.find(
    group => group.provider === localSettings.value.defaultProvider
  )
  return provider?.models.map(model => ({
    label: model.name,
    value: model.id
  })) || []
})

// Methods
const loadSettings = async () => {
  await settingsStore.fetchSettings()
  localSettings.value = { ...settingsStore.settings }
}

const onProviderChange = (provider: string) => {
  // Reset model when provider changes
  const providerGroup = modelStore.availableModels.find(group => group.provider === provider)
  if (providerGroup && providerGroup.models.length > 0) {
    localSettings.value.defaultModel = providerGroup.models[0].id
  }
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
  localSettings.value = {
    defaultProvider: 'openai',
    defaultModel: 'o3-mini',
    thinkingBudget: 2048,
    responseBudget: 8192
  }
}

const closeSettings = () => {
  isVisible.value = false
}

// Watch for settings changes
watch(() => settingsStore.settings, (newSettings) => {
  localSettings.value = { ...newSettings }
}, { deep: true })

// Load data on mount
onMounted(async () => {
  await Promise.all([
    modelStore.fetchModels(),
    loadSettings()
  ])
})
</script>

<style scoped>
.chat-settings {
  /* Container styles if needed */
}

.settings-section {
  padding: 16px 0;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--text-color);
}

.setting-description {
  font-size: 14px;
  color: var(--text-color-2);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-help {
  font-size: 12px;
  color: var(--text-color-3);
  margin-left: 120px;
  /* Align with form item content */
}

:deep(.n-form-item) {
  --n-label-width: 120px;
}

:deep(.n-form-item .n-form-item-label) {
  min-width: var(--n-label-width);
  justify-content: flex-start;
}
</style>
