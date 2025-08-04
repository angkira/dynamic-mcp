import type { LlmService } from '@dynamic-mcp/shared'
import { LlmProvider } from '@dynamic-mcp/shared'
import { OpenAiService } from './openai'
import { GeminiService } from './gemini'

export const llmServices = new Map<LlmProvider, LlmService>([
  [LlmProvider.Google, new GeminiService()], // Fixed to match shared enum
  [LlmProvider.OpenAI, new OpenAiService()],
]);
