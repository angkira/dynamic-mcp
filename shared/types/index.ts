/**
 * Shared types index
 * Clean exports for all shared types between client and server
 */

// LLM types - mix of types and enums
export { LlmProvider, MessageRole } from './llm';
export * from './mcp'
export * from './enums'


// Message types - mix of types and enums
export { StreamingChunkType } from './message';
export type {
  MessageContent,
  Message,
  StreamingChunk as ClientStreamingChunk, // Rename to avoid conflict
  StreamingWord,
  StreamingMessage,
} from './message';

// Chat types - mix of types and enums
export { MCPServerStatus, MCPTransportType, MCPAuthType } from './chat';
export type { Chat, User, Settings, MCPServer } from './chat';

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