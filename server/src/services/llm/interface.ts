/**
 * Server-specific LLM interface
 * Imports shared types and extends them for server use
 */

// Import shared types
export { LlmProvider, MessageRole } from '@dynamic-mcp/shared/types/llm';
export type { ConversationMessage, LlmService, StreamingChunk } from '@dynamic-mcp/shared/types/llm';