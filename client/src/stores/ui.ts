import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export type Theme = 'light' | 'dark' | 'auto'
export type SidebarState = 'open' | 'closed' | 'collapsed'

export const useUIStore = defineStore('ui', () => {
  // State
  const sidebarState = ref<SidebarState>('open')
  const theme = ref<Theme>('auto')
  const isMobile = ref(false)
  const isInputFocused = ref(false)
  const isModelSelectorOpen = ref(false)
  const notifications = ref<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([])

  // Computed
  const isDarkMode = computed(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    // Auto mode - check system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const sidebarWidth = computed(() => {
    switch (sidebarState.value) {
      case 'open': return '320px'
      case 'collapsed': return '60px'
      case 'closed': return '0px'
      default: return '320px'
    }
  })

  const shouldCollapseSidebar = computed(() => {
    return isMobile.value && sidebarState.value === 'open'
  })

  const mainContentMargin = computed(() => {
    if (isMobile.value) return '0px'
    return sidebarWidth.value
  })

  // Actions
  function toggleSidebar() {
    if (isMobile.value) {
      sidebarState.value = sidebarState.value === 'closed' ? 'open' : 'closed'
    } else {
      sidebarState.value = sidebarState.value === 'open' ? 'collapsed' : 'open'
    }
  }

  function setSidebarState(state: SidebarState) {
    sidebarState.value = state
  }

  function closeSidebar() {
    sidebarState.value = 'closed'
  }

  function openSidebar() {
    sidebarState.value = 'open'
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    updateThemeClass()
  }

  function updateThemeClass() {
    const html = document.documentElement
    if (isDarkMode.value) {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
  }

  function setIsMobile(mobile: boolean) {
    isMobile.value = mobile
    
    // Auto-adjust sidebar for mobile
    if (mobile && sidebarState.value === 'collapsed') {
      sidebarState.value = 'closed'
    } else if (!mobile && sidebarState.value === 'closed') {
      sidebarState.value = 'open'
    }
  }

  function setInputFocus(focused: boolean) {
    isInputFocused.value = focused
  }

  function toggleModelSelector() {
    isModelSelectorOpen.value = !isModelSelectorOpen.value
  }

  function closeModelSelector() {
    isModelSelectorOpen.value = false
  }

  function addNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Date.now().toString()
    notifications.value.push({ id, message, type })
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      removeNotification(id)
    }, 5000)
    
    return id
  }

  function removeNotification(id: string) {
    const index = notifications.value.findIndex(n => n.id === id)
    if (index !== -1) {
      notifications.value.splice(index, 1)
    }
  }

  function clearNotifications() {
    notifications.value = []
  }

  // Initialize theme and mobile detection
  function init() {
    updateThemeClass()
    
    // Listen for system theme changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      mediaQuery.addEventListener('change', updateThemeClass)
    }
    
    // Initial mobile detection
    setIsMobile(window.innerWidth < 768)
    
    // Listen for window resize
    window.addEventListener('resize', () => {
      setIsMobile(window.innerWidth < 768)
    })
  }

  return {
    // State
    sidebarState,
    theme,
    isMobile,
    isInputFocused,
    isModelSelectorOpen,
    notifications,
    
    // Computed
    isDarkMode,
    sidebarWidth,
    shouldCollapseSidebar,
    mainContentMargin,
    
    // Actions
    toggleSidebar,
    setSidebarState,
    closeSidebar,
    openSidebar,
    setTheme,
    updateThemeClass,
    setIsMobile,
    setInputFocus,
    toggleModelSelector,
    closeModelSelector,
    addNotification,
    removeNotification,
    clearNotifications,
    init
  }
})