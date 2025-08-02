import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatAPIService } from '@/services/ChatAPIService'

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
      // Fetch default configuration from server
      const defaultConfig = await ChatAPIService.config.getDefaultConfig()

      const response = await ChatAPIService.models.getModels()

      // Convert providers to model groups format
      const modelGroups: ModelGroup[] = response.map(provider => ({
        provider: provider.provider, // Correctly map backend's 'provider' to frontend's 'provider' key in ModelGroup
        models: provider.models.map(m => ({ id: m.model, name: m.model, model: m.model })) // Map backend's 'model' to 'id', 'name', and 'model' for ModelInfo
      }))

      availableModels.value = modelGroups

      // Use server default configuration or fallback to first available
      if (modelGroups.length > 0) {
        // Check if the server's default provider exists in available models
        const defaultProviderGroup = modelGroups.find(group => group.provider === defaultConfig.provider)

        if (defaultProviderGroup) {
          // Use server's default provider
          currentProvider.value = defaultConfig.provider

          // Check if the server's default model exists in the provider
          const defaultModelExists = defaultProviderGroup.models.some(model => model.id === defaultConfig.model)
          if (defaultModelExists) {
            currentModel.value = defaultConfig.model
          } else {
            // Fallback to first model of the default provider
            currentModel.value = defaultProviderGroup.models[0]?.id || ''
          }
        } else {
          // Fallback to first available provider and model
          currentProvider.value = modelGroups[0].provider
          currentModel.value = modelGroups[0].models[0]?.id || ''
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
      await ChatAPIService.config.updateDefaultConfig({
        provider,
        model,
      });
    } catch (err) {
      console.error('Failed to update default model on server:', err);
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