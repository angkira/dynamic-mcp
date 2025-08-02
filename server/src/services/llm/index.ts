import type { LlmService } from './interface'
import { LlmProvider } from './interface'
import { OpenAiService } from './openai'
import { GeminiService } from './gemini'

export const llmServices = new Map<LlmProvider, LlmService>([
  [LlmProvider.Gemini, new GeminiService()],
  [LlmProvider.OpenAI, new OpenAiService()],
]);
