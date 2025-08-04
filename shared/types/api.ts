/**
 * API request and response types
 * Shared between client and server
 */

import { LlmProvider } from './llm';
import type { Message } from './message';
import type { Chat } from './chat';

/**
 * Message API types
 */
export interface SendMessageRequest {
  content: string;
  userId: number;
  chatId?: number;
  provider?: LlmProvider;
  model?: string;
  stream?: boolean;
  socketId?: string;
  isThinking?: boolean;
}

export interface SendMessageResponse {
  message: Message;
  chatId: number;
}

export interface GetMessagesRequest {
  chatId: number;
  page?: number;
  limit?: number;
}

export interface GetMessagesResponse {
  messages: Message[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Chat API types
 */
export interface CreateChatRequest {
  userId: number;
  title?: string;
}

export interface CreateChatResponse {
  chat: Chat;
}

export interface GetChatsRequest {
  userId: number;
  page?: number;
  limit?: number;
}

export interface GetChatsResponse {
  chats: Chat[];
  total: number;
  page: number;
  limit: number;
}

export interface UpdateChatRequest {
  chatId: number;
  title?: string;
}

export interface UpdateChatResponse {
  chat: Chat;
}

export interface DeleteChatRequest {
  chatId: number;
}

export interface DeleteChatResponse {
  success: boolean;
  message: string;
}

/**
 * WebSocket payload types
 */
export interface WebSocketSendMessagePayload {
  content: string;
  userId: number;
  chatId?: number;
  provider?: LlmProvider;
  model?: string;
  stream: boolean;
  isThinking?: boolean;
}

/**
 * Common API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Pagination helpers
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}