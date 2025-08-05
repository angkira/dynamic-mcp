/**
 * Shared types index
 * Clean exports for all shared types between client and server
 */

// Enum exports (regular imports)
export { LlmProvider, MessageRole } from './llm';
export { StreamingChunkType } from './message';
export { MCPServerStatus, MCPTransportType, MCPAuthType } from './enums';

// Type exports (import type)
export * from './mcp'
export type {
  MessageContent,
  Message,
  StreamingChunk as ClientStreamingChunk, // Rename to avoid conflict
  StreamingWord,
  StreamingMessage,
} from './message';

export type { Chat, User, Settings } from './chat';

// API types - all interfaces
export type {
  SendMessageRequest,
  SendMessageResponse,
  GetMessagesRequest,
  GetMessagesResponse,
  CreateChatRequest,
  CreateChatResponse,
  GetChatsRequest,
  GetChatsResponse,
  UpdateChatRequest,
  UpdateChatResponse,
  DeleteChatRequest,
  DeleteChatResponse,
  WebSocketSendMessagePayload,
  ApiResponse,
  PaginationParams,
  PaginationMeta,
} from './api';

// Re-export constants
export { ClientWebSocketEvent, ServerWebSocketEvent } from '../constants/websocketEvents';