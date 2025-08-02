/**
 * UI-related types and interfaces
 */

export type SidebarState = 'open' | 'collapsed' | 'hidden'
export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message?: string
  duration?: number
  actions?: NotificationAction[]
}

export interface NotificationAction {
  label: string
  action: () => void
  type?: 'primary' | 'secondary'
}

export interface UIState {
  isSidebarOpen: boolean
  isModelSelectorOpen: boolean
  sidebarState: SidebarState
  isMobile: boolean
  isLoading: boolean
  error: string | null
}

// Device and responsive types
export interface BreakpointState {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  screenWidth: number
}