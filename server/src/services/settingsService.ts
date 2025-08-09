import type { PrismaClient, Settings as SettingsModel } from '@shared-prisma'
import { llmServiceFactories } from '../services/llm'
import { LlmProvider } from '@dynamic-mcp/shared'

export interface UpdateSettingsInput {
  defaultProvider?: string
  defaultModel?: string
  thinkingBudget?: number
  responseBudget?: number
  openaiApiKey?: string | null
  googleApiKey?: string | null
  anthropicApiKey?: string | null
  deepseekApiKey?: string | null
  qwenApiKey?: string | null
  mcpEnableDebugLogging?: boolean
  mcpDefaultTimeout?: number
  mcpMaxConcurrentConnections?: number
  mcpAutoDiscovery?: boolean
}

export class SettingsService {
  constructor(private readonly prisma: PrismaClient, private readonly mcpService?: any) { }

  private maskKeys(settings: SettingsModel) {
    return {
      openaiApiKey: settings.openaiApiKey ? '********' : null,
      googleApiKey: settings.googleApiKey ? '********' : null,
      anthropicApiKey: settings.anthropicApiKey ? '********' : null,
      deepseekApiKey: settings.deepseekApiKey ? '********' : null,
      qwenApiKey: settings.qwenApiKey ? '********' : null,
    }
  }

  async ensureSettings(userId: number): Promise<SettingsModel> {
    let settings = await this.prisma.settings.findUnique({ where: { userId } })
    if (!settings) {
      settings = await this.prisma.settings.create({ data: { userId } })
    }
    return settings
  }

  async getUserSettings(userId: number) {
    const settings = await this.ensureSettings(userId)
    return {
      defaultProvider: settings.defaultProvider,
      defaultModel: settings.defaultModel,
      thinkingBudget: settings.thinkingBudget,
      responseBudget: settings.responseBudget,
      ...this.maskKeys(settings),
      mcpEnableDebugLogging: settings.mcpEnableDebugLogging,
      mcpDefaultTimeout: settings.mcpDefaultTimeout,
      mcpMaxConcurrentConnections: settings.mcpMaxConcurrentConnections,
      mcpAutoDiscovery: settings.mcpAutoDiscovery,
    }
  }

  async updateUserSettings(userId: number, updates: UpdateSettingsInput) {
    await this.ensureSettings(userId)

    // Treat masked values ("********") as "do not change"
    const sanitizeKey = (value: string | null | undefined): string | null | undefined => {
      if (value === '********') return undefined
      return value === '' ? null : value
    }

    const openaiApiKey = sanitizeKey(updates.openaiApiKey)
    const googleApiKey = sanitizeKey(updates.googleApiKey)
    const anthropicApiKey = sanitizeKey(updates.anthropicApiKey)
    const deepseekApiKey = sanitizeKey(updates.deepseekApiKey)
    const qwenApiKey = sanitizeKey(updates.qwenApiKey)

    const updated = await this.prisma.settings.update({
      where: { userId },
      data: {
        ...(updates.defaultProvider !== undefined && { defaultProvider: updates.defaultProvider }),
        ...(updates.defaultModel !== undefined && { defaultModel: updates.defaultModel }),
        ...(updates.thinkingBudget !== undefined && { thinkingBudget: updates.thinkingBudget }),
        ...(updates.responseBudget !== undefined && { responseBudget: updates.responseBudget }),
        ...(openaiApiKey !== undefined && { openaiApiKey }),
        ...(googleApiKey !== undefined && { googleApiKey }),
        ...(anthropicApiKey !== undefined && { anthropicApiKey }),
        ...(deepseekApiKey !== undefined && { deepseekApiKey }),
        ...(qwenApiKey !== undefined && { qwenApiKey }),
        ...(updates.mcpEnableDebugLogging !== undefined && { mcpEnableDebugLogging: updates.mcpEnableDebugLogging }),
        ...(updates.mcpDefaultTimeout !== undefined && { mcpDefaultTimeout: updates.mcpDefaultTimeout }),
        ...(updates.mcpMaxConcurrentConnections !== undefined && { mcpMaxConcurrentConnections: updates.mcpMaxConcurrentConnections }),
        ...(updates.mcpAutoDiscovery !== undefined && { mcpAutoDiscovery: updates.mcpAutoDiscovery }),
      },
    })

    // Optionally inform MCP service
    if (this.mcpService && typeof userId === 'number') {
      try { await this.mcpService.updateGlobalSettings(userId) } catch { }
    }

    return {
      defaultProvider: updated.defaultProvider,
      defaultModel: updated.defaultModel,
      thinkingBudget: updated.thinkingBudget,
      responseBudget: updated.responseBudget,
      ...this.maskKeys(updated),
      mcpEnableDebugLogging: updated.mcpEnableDebugLogging,
      mcpDefaultTimeout: updated.mcpDefaultTimeout,
      mcpMaxConcurrentConnections: updated.mcpMaxConcurrentConnections,
      mcpAutoDiscovery: updated.mcpAutoDiscovery,
    }
  }

  async getAvailableModels(userId: number) {
    const settings = await this.ensureSettings(userId)

    const providerToKey: Record<string, string | undefined> = {
      [LlmProvider.Google]: settings.googleApiKey || undefined,
      [LlmProvider.OpenAI]: settings.openaiApiKey || undefined,
      [LlmProvider.Anthropic]: settings.anthropicApiKey || undefined,
      [LlmProvider.DeepSeek]: settings.deepseekApiKey || undefined,
      [LlmProvider.Qwen]: settings.qwenApiKey || undefined,
    }

    const result: { provider: string; models: { provider: string; model: string }[] }[] = []
    for (const [provider, factory] of llmServiceFactories.entries()) {
      const apiKey = providerToKey[provider]
      if (!apiKey) continue
      try {
        const service = factory(apiKey)
        const models = await service.getModels()
        result.push({ provider, models })
      } catch {
        // Skip providers with invalid keys
      }
    }
    return result
  }
}


