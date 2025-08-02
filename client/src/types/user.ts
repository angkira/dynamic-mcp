/**
 * User-related types and interfaces
 */

export interface User {
  id: string
  name?: string
  email?: string
  avatar?: string
  initials?: string
  preferences?: UserPreferences
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto'
  language?: string
  defaultProvider?: string
  defaultModel?: string
  streamingEnabled?: boolean
  notificationsEnabled?: boolean
}

// Auth types (for future implementation)
export interface AuthState {
  isAuthenticated: boolean
  user: User | null
  token?: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: User
  token: string
}