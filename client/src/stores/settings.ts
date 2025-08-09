import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatAPIService } from '@/services/ChatAPIService'
import type { Settings, UpdateSettingsRequest } from '@/types'

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<Settings>({
    defaultProvider: 'google',
    defaultModel: 'gemini-2.5-flash',
    thinkingBudget: 2048,
    responseBudget: 8192,
    openaiApiKey: null,
    googleApiKey: null,
    anthropicApiKey: null,
    deepseekApiKey: null,
    qwenApiKey: null,
    mcpEnableDebugLogging: false,
    mcpDefaultTimeout: 30000,
    mcpMaxConcurrentConnections: 10,
    mcpAutoDiscovery: true
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const providers = ref<string[]>([])
  let fetchPromise: Promise<void> | null = null

  // Computed
  const defaultProviderModel = computed(() => ({
    provider: settings.value.defaultProvider,
    model: settings.value.defaultModel
  }))

  // Actions
  async function fetchSettings() {
    // Return existing promise if one is in progress
    if (fetchPromise) {
      return fetchPromise
    }

    // Create new promise and cache it
    fetchPromise = (async () => {
      isLoading.value = true
      error.value = null

      try {
        const response = await ChatAPIService.settings.getSettings()
        // Merge response but never store masked keys ("********") in client state
        const merged = { ...settings.value, ...response } as Settings
        const keyFields = [
          'openaiApiKey',
          'googleApiKey',
          'anthropicApiKey',
          'deepseekApiKey',
          'qwenApiKey'
        ] as const
        for (const key of keyFields) {
          const val = (response as any)[key]
          if (val === '********' || val == null) {
            ; (merged as any)[key] = (settings.value as any)[key]
          }
        }
        settings.value = merged
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to fetch settings'
        console.error('Failed to fetch settings:', err)
        throw err
      } finally {
        isLoading.value = false
        fetchPromise = null // Reset promise cache
      }
    })()

    return fetchPromise
  }

  async function fetchProviders() {
    try {
      providers.value = await ChatAPIService.models.getProviders()
    } catch (err) {
      console.error('Failed to fetch providers:', err)
      providers.value = []
    }
  }

  async function updateSettings(updates: UpdateSettingsRequest) {
    isLoading.value = true
    error.value = null

    try {
      // Sanitize outgoing updates: never send masked strings; convert empty strings to null
      const cleanedUpdates: UpdateSettingsRequest = { ...updates }
      const keyFields: Array<keyof UpdateSettingsRequest> = [
        'openaiApiKey', 'googleApiKey', 'anthropicApiKey', 'deepseekApiKey', 'qwenApiKey'
      ]
      for (const key of keyFields) {
        const val = (cleanedUpdates as any)[key]
        if (val === '********') {
          delete (cleanedUpdates as any)[key]
        } else if (val === '') {
          ; (cleanedUpdates as any)[key] = null
        }
      }

      const response = await ChatAPIService.settings.updateSettings(cleanedUpdates)
      // Merge response while ensuring API key fields don't get cleared.
      const merged = { ...settings.value, ...response } as Settings
      const respKeyFields: Array<keyof Settings> = ['openaiApiKey', 'googleApiKey', 'anthropicApiKey', 'deepseekApiKey', 'qwenApiKey']
      for (const key of respKeyFields) {
        const reqVal = (cleanedUpdates as any)[key]
        const respVal = (response as any)[key]
        if (typeof reqVal === 'string' && reqVal !== '********') {
          ; (merged as any)[key] = reqVal
        } else if (respVal === '********' || respVal == null) {
          ; (merged as any)[key] = (settings.value as any)[key]
        }
      }

      settings.value = merged
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
    providers,

    // Computed
    defaultProviderModel,

    // Actions
    fetchSettings,
    updateSettings,
    updateDefaultModel,
    updateThinkingBudget,
    updateResponseBudget,
    fetchProviders
  }
})
