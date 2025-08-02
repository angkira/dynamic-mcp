import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatAPIService } from '@/services/ChatAPIService'
import type { Settings, UpdateSettingsRequest } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<Settings>({
    defaultProvider: 'openai',
    defaultModel: 'o3-mini',
    thinkingBudget: 2048,
    responseBudget: 8192
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const defaultProviderModel = computed(() => ({
    provider: settings.value.defaultProvider,
    model: settings.value.defaultModel
  }))

  // Actions
  async function fetchSettings() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await ChatAPIService.settings.getSettings()
      settings.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch settings'
      console.error('Failed to fetch settings:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(updates: UpdateSettingsRequest) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await ChatAPIService.settings.updateSettings(updates)
      settings.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update settings'
      console.error('Failed to update settings:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function updateDefaultModel(provider: string, model: string) {
    await updateSettings({
      defaultProvider: provider,
      defaultModel: model
    })
  }

  async function updateThinkingBudget(budget: number) {
    await updateSettings({
      thinkingBudget: budget
    })
  }

  async function updateResponseBudget(budget: number) {
    await updateSettings({
      responseBudget: budget
    })
  }

  return {
    // State
    settings,
    isLoading,
    error,
    
    // Computed
    defaultProviderModel,
    
    // Actions
    fetchSettings,
    updateSettings,
    updateDefaultModel,
    updateThinkingBudget,
    updateResponseBudget
  }
})
