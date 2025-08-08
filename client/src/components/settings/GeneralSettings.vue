<template>
  <div class="general-settings">
    <n-space vertical :size="24">
      <!-- Provider API Keys Section -->
      <div class="setting-group">
        <h3 class="setting-title">Provider API Keys</h3>
        <p class="setting-description">Add API keys for providers you want to use. Models are shown only for providers
          with a key.</p>
        <n-space vertical :size="12">
          <n-form-item label="Google (Gemini) API Key" label-placement="left">
            <n-input v-model:value="localSettings.googleApiKey" type="password" placeholder="Enter Google API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="OpenAI API Key" label-placement="left">
            <n-input v-model:value="localSettings.openaiApiKey" type="password" placeholder="Enter OpenAI API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="Anthropic API Key" label-placement="left">
            <n-input v-model:value="localSettings.anthropicApiKey" type="password" placeholder="Enter Anthropic API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="DeepSeek API Key" label-placement="left">
            <n-input v-model:value="localSettings.deepseekApiKey" type="password" placeholder="Enter DeepSeek API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="Qwen API Key" label-placement="left">
            <n-input v-model:value="localSettings.qwenApiKey" type="password" placeholder="Enter Qwen API key"
              @change="onKeyChanged" />
          </n-form-item>
        </n-space>
      </div>

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
              <n-select v-if="hasAnyProviders" v-model:value="localSettings.defaultProvider" :options="providerOptions"
                placeholder="Select provider" :loading="modelStore.isLoading" @update:value="onProviderChange"
                style="min-width: 200px" />
              <span v-else class="setting-help">Add a provider API key above to enable model selection.</span>
            </n-form-item>
          </div>

          <!-- Model Selection -->
          <div class="setting-item">
            <n-form-item label="Model" label-placement="left">
              <n-select v-if="hasAnyProviders" v-model:value="localSettings.defaultModel" :options="modelOptions"
                placeholder="Select model" :loading="modelStore.isLoading" :disabled="!localSettings.defaultProvider"
                style="min-width: 200px" />
              <span v-else class="setting-help">No models available.</span>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  NSpace,
  NFormItem,
  NSelect,
  NInput,
  NInputNumber,
  NDivider
} from 'naive-ui'
import { useModelStore } from '@/stores/models'
import type { Settings } from '@/types'

// Props
interface Props {
  modelValue: Settings
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:modelValue': [value: Settings]
}>()

// Stores
const modelStore = useModelStore()

// Computed
const localSettings = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const hasAnyProviders = computed(() => modelStore.availableModels.length > 0)

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
const onProviderChange = (provider: string) => {
  // Reset model when provider changes
  const providerGroup = modelStore.availableModels.find(group => group.provider === provider)
  if (providerGroup && providerGroup.models.length > 0) {
    localSettings.value = {
      ...localSettings.value,
      defaultProvider: provider,
      defaultModel: providerGroup.models[0].id
    }
  }
}

// When any provider key changes, persist keys and refresh models
async function onKeyChanged() {
  try {
    const { openaiApiKey, googleApiKey, anthropicApiKey, deepseekApiKey, qwenApiKey } = localSettings.value
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openaiApiKey, googleApiKey, anthropicApiKey, deepseekApiKey, qwenApiKey })
    })
    await modelStore.fetchModels()
  } catch (e) {
    console.error('Failed to update provider keys', e)
  }
}
</script>

<style scoped>
.general-settings {
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