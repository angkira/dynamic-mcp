/**
 * Re-export message types from shared
 * This file maintains backward compatibility for existing client imports
 * 
 * Note: For build compatibility, we import specific types and re-declare enums
 */

// Import types that work in the build
export type {
  MessageContent,
  Message,
  StreamingWord,
  StreamingMessage,
} from '@shared/types/message';

export type {
  SendMessageRequest,
  SendMessageResponse,
  GetMessagesResponse,
} from '@shared/types/api';

// Re-declare enums locally to avoid build issues with shared enums
export enum MessageRole {
  USER = 'USER',
  AI = 'AI',
  TOOL = 'TOOL',
}

export enum StreamingChunkType {
  Thought = 'thought',
  Code = 'code',
  Reasoning = 'reasoning',
  Title = 'title',
  ChatId = 'chatId',
  UserMessage = 'userMessage',
  Complete = 'complete',
  Error = 'error',
  MessageChunk = 'messageChunk',
  ToolCall = 'toolCall',
  ToolResult = 'toolResult',
}

export enum LlmProvider {
  OpenAI = 'openai',
  Google = 'google',
  Anthropic = 'anthropic',
  DeepSeek = 'deepseek',
  Qwen = 'qwen',
}

// Import and re-export the streaming chunk type with alias
import type { StreamingChunk as SharedStreamingChunk } from '@shared/types/message';
export interface StreamingChunk {
  text: string;
  type: StreamingChunkType;
  isComplete: boolean;
}