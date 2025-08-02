/**
 * Chat-related types and interfaces
 */

export interface Chat {
  id: number
  title: string
  userId: string
  createdAt: string
  updatedAt: string
  lastMessage?: string
  lastMessageAt?: string
}

// API request/response types
export interface CreateChatRequest {
  userId: string
  title?: string
}

export interface CreateChatResponse {
  chat: Chat
}

export interface GetChatsResponse {
  chats: Chat[]
  total: number
  page: number
  limit: number
}

export interface DeleteChatResponse {
  success: boolean
  message: string
}