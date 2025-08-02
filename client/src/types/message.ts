/**
 * Message-related types and interfaces
 */

export interface MessageContent {
  text: string
  html?: string
  metadata?: {
    provider: string
    model: string
    [key: string]: unknown
  }
}

export interface Message {
  id: number
  content: MessageContent
  role: 'USER' | 'AI'
  chatId: number
  createdAt: string
  updatedAt: string
}

// Streaming-related types

export enum StreamingChunkType {
  Thought = 'thought',
  Content = 'content',
  Markdown = 'markdown',
  Code = 'code',
  Reasoning = 'reasoning',
  Title = 'title',
  ChatId = 'chatId',
  UserMessage = 'userMessage',
  Complete = 'complete',
  Error = 'error',
}

export interface StreamingChunk {
  text: string
  type: StreamingChunkType
  isComplete: boolean
}

export interface StreamingWord {
  word: string
  id: string
  isAnimating: boolean
}

export interface StreamingMessage {
  content: string
  html: string
  words: StreamingWord[]
  currentChunk: StreamingChunk | null
  isComplete: boolean
  isStreaming: boolean
  isThinking: boolean
  thoughtContent: string
  thoughtHtml: string
  insideThoughtTag: boolean
  thoughtBuffer: string
  thoughtWords: StreamingWord[]
  thoughtsCompleted: boolean
  chatTitle: string
  titleExtracted: boolean
  chunkCount?: number
}

// API request/response types
export interface SendMessageRequest {
  content: string
  chatId?: number
  userId: string
  provider?: string
  model?: string
  stream?: boolean
}

export interface SendMessageResponse {
  message: Message
  chatId: number
}

export interface GetMessagesResponse {
  messages: Message[]
  total: number
  page: number
  limit: number
}