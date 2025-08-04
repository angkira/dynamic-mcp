import type { LlmService } from '@shared/types'
import { LlmProvider } from '@shared/types'
import { OpenAiService } from './openai'
import { GeminiService } from './gemini'

export const llmServices = new Map<LlmProvider, LlmService>([
  [LlmProvider.Google, new GeminiService()], // Fixed to match shared enum
  [LlmProvider.OpenAI, new OpenAiService()],
]);
