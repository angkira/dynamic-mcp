import type { LlmService } from './interface'
import { LlmProvider } from './interface'
import { OpenAiService } from './openai'
import { GeminiService } from './gemini'

export const llmServices = new Map<LlmProvider, LlmService>([
  [LlmProvider.OpenAI, new OpenAiService()],
  [LlmProvider.Gemini, new GeminiService()],
]);
