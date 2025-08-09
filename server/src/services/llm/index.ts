import type { LlmService } from '@dynamic-mcp/shared'
import { LlmProvider } from '@dynamic-mcp/shared'
import { OpenAiService } from './openai'
import { GeminiService } from './gemini'

type LlmFactory = (apiKey?: string) => LlmService;

export const llmServiceFactories = new Map<LlmProvider, LlmFactory>([
  [LlmProvider.Google, (apiKey?: string) => new GeminiService(apiKey)],
  [LlmProvider.OpenAI, (apiKey?: string) => new OpenAiService(apiKey)],
]);

export function getLlmService(provider: LlmProvider, apiKey?: string): LlmService | undefined {
  const factory = llmServiceFactories.get(provider);
  return factory ? factory(apiKey) : undefined;
}
