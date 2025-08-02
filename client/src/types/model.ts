/**
 * LLM Model-related types and interfaces
 */

export interface ModelInfo {
  id: string
  name: string
  model: string // Add model property to match backend response
  description?: string
  contextLength?: number
  maxTokens?: number
}

export interface ModelProvider {
  provider: string // Changed from 'id' to 'provider'
  name?: string // Made optional as it's not in the current backend response
  models: ModelInfo[]
}

export interface ModelGroup {
  provider: string
  models: ModelInfo[]
}

// API response types
export type GetModelsResponse = ModelProvider[]

// Selection state
export interface ModelSelection {
  provider: string
  model: string
}

// Default configuration response
export interface GetDefaultConfigResponse {
  provider: string
  model: string
}

export interface UpdateDefaultConfigRequest {
  provider: string
  model: string
}

export interface UpdateDefaultConfigResponse {
  provider: string
  model: string
}