import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export interface User {
  id: number
  email: string
  name?: string
  createdAt: string
  updatedAt: string
}

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref<User | null>(null)
  const isAuthenticated = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const userId = computed(() => user.value?.id || 0)
  const userName = computed(() => user.value?.name || user.value?.email || 'Anonymous')
  const userInitials = computed(() => {
    const name = userName.value
    if (name === 'Anonymous') return 'AN'
    
    const parts = name.split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  })

  // Actions
  function setUser(userData: User) {
    user.value = userData
    isAuthenticated.value = true
    error.value = null
  }

  function logout() {
    user.value = null
    isAuthenticated.value = false
    error.value = null
  }

  // For demo purposes, let's create a mock user
  // In a real app, this would involve actual authentication
  function initMockUser() {
    const mockUser: User = {
      id: 1,
      email: 'demo@example.com',
      name: 'Demo User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    setUser(mockUser)
  }

  async function fetchUser() {
    isLoading.value = true
    error.value = null
    
    try {
      // In a real app, this would fetch the current user from an API
      // For now, we'll use the mock user
      initMockUser()
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user'
      console.error('Failed to fetch user:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function updateProfile(updates: Partial<Pick<User, 'name' | 'email'>>) {
    if (!user.value) return
    
    isLoading.value = true
    error.value = null
    
    try {
      // In a real app, this would make an API call
      const updatedUser = { ...user.value, ...updates, updatedAt: new Date().toISOString() }
      setUser(updatedUser)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update profile'
      console.error('Failed to update profile:', err)
    } finally {
      isLoading.value = false
    }
  }

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    
    // Computed
    userId,
    userName,
    userInitials,
    
    // Actions
    setUser,
    logout,
    initMockUser,
    fetchUser,
    updateProfile
  }
})