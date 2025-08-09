import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatAPIService } from '@/services/ChatAPIService'
import { useSettingsStore } from './settings'

import type { ModelGroup } from '@/types'

export const useModelStore = defineStore('models', () => {
  // State
  const availableModels = ref<ModelGroup[]>([])
  const currentProvider = ref<string>('')
  const currentModel = ref<string>('')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentModelGroup = computed(() =>
    availableModels.value.find(group => group.provider === currentProvider.value)
  )

  const currentModelsList = computed(() =>
    currentModelGroup.value?.models || []
  )

  const selectedModel = computed(() => ({
    provider: currentProvider.value,
    model: currentModel.value
  }))

  // Actions
  async function fetchModels() {
    isLoading.value = true
    error.value = null

    try {
      // Get settings store to use user preferences
      const settingsStore = useSettingsStore()

      // Ensure settings are loaded (this will only fetch if not already loaded or in progress)
      await settingsStore.fetchSettings()

      // Fetch available models (backend filters by providers with keys)
      const modelsResponse = await ChatAPIService.models.getModels()

      // Convert providers to model groups format
      const modelGroups: ModelGroup[] = modelsResponse.map(provider => ({
        provider: provider.provider, // Correctly map backend's 'provider' to frontend's 'provider' key in ModelGroup
        models: provider.models.map(m => ({ id: m.model, name: m.model, model: m.model })) // Map backend's 'model' to 'id', 'name', and 'model' for ModelInfo
      }))

      availableModels.value = modelGroups

      // Decide default selection based on available providers and user settings
      if (modelGroups.length === 0) {
        currentProvider.value = ''
        currentModel.value = ''
      } else {
        const userSelectedProvider = settingsStore.settings.defaultProvider
        const selectedGroup = modelGroups.find(g => g.provider === userSelectedProvider)
        if (selectedGroup) {
          currentProvider.value = userSelectedProvider
          const defaultModelExists = selectedGroup.models.some(m => m.id === settingsStore.settings.defaultModel)
          currentModel.value = defaultModelExists ? settingsStore.settings.defaultModel : (selectedGroup.models[0]?.id || '')
        } else {
          // Fallback to the first provider that has models
          const firstGroup = modelGroups[0]
          currentProvider.value = firstGroup.provider
          currentModel.value = firstGroup.models[0]?.id || ''
          // Persist this fallback as new defaults so UI remains consistent
          try {
            await ChatAPIService.settings.updateSettings({
              defaultProvider: currentProvider.value,
              defaultModel: currentModel.value,
            })
          } catch (e) {
            // ignore persist error, selection still applied client-side
          }
        }
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to fetch models:', err)
    } finally {
      isLoading.value = false
    }
  }

  function setProvider(provider: string) {
    currentProvider.value = provider

    // Reset to first model of the new provider
    const providerGroup = availableModels.value.find(group => group.provider === provider)
    if (providerGroup && providerGroup.models.length > 0) {
      currentModel.value = providerGroup.models[0].id
    }
  }

  function setModel(model: string) {
    currentModel.value = model
  }

  async function setSelectedModel(provider: string, model: string) {
    currentProvider.value = provider;
    currentModel.value = model;

    try {
      // Update user settings instead of config
      await ChatAPIService.settings.updateSettings({
        defaultProvider: provider,
        defaultModel: model,
      });
    } catch (err) {
      console.error('Failed to update default model in settings:', err);
      // Optionally, revert the client-side selection or show an error message
    }
  }

  return {
    // State
    availableModels,
    currentProvider,
    currentModel,
    isLoading,
    error,

    // Computed
    currentModelGroup,
    currentModelsList,
    selectedModel,

    // Actions
    fetchModels,
    setProvider,
    setModel,
    setSelectedModel
  }
})