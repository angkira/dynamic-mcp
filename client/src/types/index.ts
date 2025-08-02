/**
 * Centralized type exports
 */

// Message types
export * from './message'

// Chat types  
export * from './chat'

// Model types
export * from './model'

// UI types
export * from './ui'

// User types
export * from './user'

// Common utility types
export interface ApiResponse<T = unknown> {
  data: T
  message?: string
  success: boolean
}

export class ApiError extends Error {
  code?: string | number
  details?: unknown
  constructor(message: string, code?: string | number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc'
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort?: string
  order?: SortOrder
}

// Settings types
export interface Settings {
  defaultProvider: string
  defaultModel: string
  thinkingBudget: number
  responseBudget: number
}

export interface GetSettingsResponse extends Settings {}

export interface UpdateSettingsRequest extends Partial<Settings> {}

export interface UpdateSettingsResponse extends Settings {}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export enum SSEEventType {
  ChatId = 'chatId',
  UserMessage = 'userMessage',
  Chunk = 'chunk',
  Complete = 'complete',
  Error = 'error'
}

// Event types for SSE
export interface SSEEvent {
  type: SSEEventType
  data: unknown
}