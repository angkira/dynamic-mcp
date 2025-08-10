import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { authService, type LoginCredentials, AuthError, type SignupPayload } from '@/services/auth'

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
    // Persist latest user to session storage so views (like UserSettings) see fresh name
    try {
      authService.setStoredUser(userData)
    } catch {
      // non-fatal
    }
  }

  function logout() {
    try {
      authService.logout()
      user.value = null
      isAuthenticated.value = false
      error.value = null
    } catch (err) {
      console.error('Logout error:', err)
      // Force clear local state even if logout service fails
      user.value = null
      isAuthenticated.value = false
      error.value = null
    }
  }

  /**
   * Initialize user from stored session data
   */
  function initializeFromStorage() {
    try {
      if (authService.isAuthenticated()) {
        const storedUser = authService.getStoredUser()
        if (storedUser) {
          setUser(storedUser)
          return true
        }
      }
      return false
    } catch (err) {
      console.error('Failed to initialize from storage:', err)
      return false
    }
  }

  /**
   * Login with credentials
   */
  async function login(credentials: LoginCredentials): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const authResponse = await authService.login(credentials)
      setUser(authResponse.user)
    } catch (err) {
      if (err instanceof AuthError) {
        error.value = err.message
      } else {
        error.value = 'Login failed. Please try again.'
        console.error('Unexpected login error:', err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Sign up with email/password
   */
  async function signup(payload: SignupPayload): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const authResponse = await authService.signup(payload)
      setUser(authResponse.user)
    } catch (err) {
      if (err instanceof AuthError) {
        error.value = err.message
      } else {
        error.value = 'Signup failed. Please try again.'
        console.error('Unexpected signup error:', err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Login with demo credentials
   */
  async function loginDemo(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const authResponse = await authService.getDemoToken()
      setUser(authResponse.user)
      console.log('Demo login successful, token updated:', !!authResponse.token)
    } catch (err) {
      if (err instanceof AuthError) {
        error.value = err.message
      } else {
        error.value = 'Demo login failed. Please try again.'
        console.error('Unexpected demo login error:', err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Begin OAuth login flow
   */
  async function loginWithOAuth(provider: 'google' | 'github'): Promise<void> {
    try {
      const url = await authService.getOAuthUrl(provider)
      window.location.href = url
    } catch (err) {
      console.error('Failed to start OAuth flow:', err)
      error.value = 'Failed to start OAuth flow'
      throw err
    }
  }

  /**
   * Handle token passed via URL (OAuth callback redirect)
   */
  async function applyTokenFromUrl(token: string) {
    try {
      authService.setToken(token)
      // Immediately verify and populate user info
      const userData = await authService.verifyToken()
      setUser(userData)
    } catch (err) {
      console.error('Failed to apply token from URL:', err)
      throw err
    }
  }

  /**
   * Verify and refresh user data from server
   */
  async function verifyAndRefreshUser(): Promise<void> {
    if (!authService.isAuthenticated()) {
      logout()
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const userData = await authService.verifyToken()
      setUser(userData)
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.status === 401) {
          // Token is invalid, logout user
          logout()
        } else {
          error.value = err.message
        }
      } else {
        error.value = 'Failed to verify authentication. Please try again.'
        console.error('Unexpected verification error:', err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update user profile
   */
  async function updateProfile(updates: Partial<Pick<User, 'name' | 'email'>>): Promise<void> {
    if (!user.value) {
      throw new Error('No user is currently logged in')
    }

    isLoading.value = true
    error.value = null

    try {
      // Make authenticated request to update profile
      const updatedUser = await authService.authenticatedRequest<User>('/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })

      setUser(updatedUser)
    } catch (err) {
      if (err instanceof AuthError) {
        error.value = err.message
        if (err.status === 401) {
          logout()
        }
      } else {
        error.value = 'Failed to update profile. Please try again.'
        console.error('Unexpected profile update error:', err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch current user info (and whether they have a password)
   */
  async function fetchMe(): Promise<{ hasPassword: boolean }> {
    try {
      const data = await authService.authenticatedRequest<{ user: User; hasPassword: boolean }>(
        '/auth/me',
        { method: 'GET' }
      )
      setUser(data.user)
      return { hasPassword: data.hasPassword }
    } catch (err) {
      if (err instanceof AuthError && err.status === 401) {
        logout()
      } else {
        console.error('Failed to fetch current user:', err)
      }
      throw err
    }
  }

  /**
   * Change or set password. If a password exists, currentPassword is required.
   */
  async function changePassword(payload: { currentPassword?: string; newPassword: string }): Promise<void> {
    isLoading.value = true
    error.value = null
    try {
      await authService.authenticatedRequest<{ success: boolean }>('/user/password', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })
    } catch (err) {
      if (err instanceof AuthError) {
        error.value = err.message
        if (err.status === 401) logout()
      } else {
        error.value = 'Failed to update password. Please try again.'
        console.error('Unexpected password change error:', err)
      }
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if user should be redirected to login
   */
  function requiresAuthentication(): boolean {
    return !isAuthenticated.value && !authService.isAuthenticated()
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
    login,
    loginDemo,
    signup,
    loginWithOAuth,
    applyTokenFromUrl,
    initializeFromStorage,
    verifyAndRefreshUser,
    updateProfile,
    fetchMe,
    changePassword,
    requiresAuthentication
  }
})