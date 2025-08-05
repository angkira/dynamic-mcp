import type { User } from '@/stores/user'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface ApiError {
  message: string
  code?: string
  status?: number
}

class AuthError extends Error {
  public readonly status: number
  public readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.code = code
  }
}

const API_BASE_URL = 'http://localhost:3000'
// Debug: const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

class AuthService {
  private readonly TOKEN_KEY = 'auth_token'
  private readonly USER_KEY = 'auth_user'

  /**
   * Get stored JWT token from sessionStorage
   */
  getToken(): string | null {
    try {
      return sessionStorage.getItem(this.TOKEN_KEY)
    } catch (error) {
      console.warn('Failed to access sessionStorage:', error)
      return null
    }
  }

  /**
   * Store JWT token in sessionStorage and trigger socket connection
   */
  setToken(token: string): void {
    try {
      sessionStorage.setItem(this.TOKEN_KEY, token)
      
      // Trigger socket connection when token is set
      this.triggerSocketConnection()
    } catch (error) {
      console.error('Failed to store token in sessionStorage:', error)
      throw new AuthError('Failed to store authentication token', 500)
    }
  }

  /**
   * Trigger socket connection after authentication
   */
  private async triggerSocketConnection(): Promise<void> {
    try {
      const { socketService } = await import('./socket')
      // Connect socket now that we have a token
      socketService.connectIfAuthenticated()
    } catch (err) {
      console.warn('Could not trigger socket connection:', err)
    }
  }

  /**
   * Remove JWT token from sessionStorage and disconnect socket
   */
  clearToken(): void {
    try {
      sessionStorage.removeItem(this.TOKEN_KEY)
      sessionStorage.removeItem(this.USER_KEY)
      
      // Disconnect socket when clearing token
      this.disconnectSocket()
    } catch (error) {
      console.warn('Failed to clear auth data from sessionStorage:', error)
    }
  }

  /**
   * Disconnect socket when authentication is cleared
   */
  private async disconnectSocket(): Promise<void> {
    try {
      const { socketService } = await import('./socket')
      socketService.disconnect()
    } catch (err) {
      console.warn('Could not disconnect socket:', err)
    }
  }

  /**
   * Get stored user data from sessionStorage
   */
  getStoredUser(): User | null {
    try {
      const userData = sessionStorage.getItem(this.USER_KEY)
      return userData ? JSON.parse(userData) : null
    } catch (error) {
      console.warn('Failed to parse stored user data:', error)
      return null
    }
  }

  /**
   * Store user data in sessionStorage
   */
  setStoredUser(user: User): void {
    try {
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(user))
    } catch (error) {
      console.error('Failed to store user data in sessionStorage:', error)
    }
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken()
    if (!token) return false

    try {
      // Basic JWT validation - check if token is not expired
      const payload = JSON.parse(atob(token.split('.')[1]))
      const currentTime = Math.floor(Date.now() / 1000)
      const isValid = payload.exp > currentTime
      if (!isValid) {
        console.log('Token expired, clearing stored token')
        this.clearToken()
      }
      return isValid
    } catch (error) {
      console.warn('Invalid token format:', error)
      this.clearToken()
      return false
    }
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      })

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response)
        throw new AuthError(
          errorData.message || 'Login failed',
          response.status,
          errorData.code
        )
      }

      const data: AuthResponse = await response.json()
      
      // Store token and user data
      this.setToken(data.token)
      this.setStoredUser(data.user)

      return data
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      
      console.error('Login request failed:', error)
      throw new AuthError('Network error during login', 500)
    }
  }

  /**
   * Get demo authentication token
   */
  async getDemoToken(): Promise<AuthResponse> {
    try {
      // Ensure no double /api by cleaning the base URL
      const baseUrl = API_BASE_URL.replace(/\/api$/, '')
      const url = `${baseUrl}/api/auth/demo-token`
      console.log('🔍 Demo token URL:', url)
      console.log('🔍 API_BASE_URL:', API_BASE_URL)
      console.log('🔍 Cleaned base URL:', baseUrl)
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response)
        throw new AuthError(
          errorData.message || 'Failed to get demo token',
          response.status,
          errorData.code
        )
      }

      const data: AuthResponse = await response.json()
      
      // Store token and user data
      this.setToken(data.token)
      this.setStoredUser(data.user)
      
      console.log('🔑 Demo token refreshed successfully', {
        userId: data.user.id,
        tokenExists: !!data.token,
        tokenLength: data.token?.length
      })

      // Refresh socket connection with new token
      try {
        const { socketService } = await import('./socket')
        socketService.refreshAuth()
      } catch (err) {
        console.warn('Could not refresh socket auth:', err)
      }

      return data
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      
      console.error('Demo token request failed:', error)
      throw new AuthError('Network error during demo authentication', 500)
    }
  }

  /**
   * Verify current token with server
   */
  async verifyToken(): Promise<User> {
    const token = this.getToken()
    if (!token) {
      throw new AuthError('No authentication token found', 401)
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response)
        if (response.status === 401) {
          this.clearToken()
        }
        throw new AuthError(
          errorData.message || 'Token verification failed',
          response.status,
          errorData.code
        )
      }

      const data: { user: User } = await response.json()
      this.setStoredUser(data.user)
      return data.user
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      
      console.error('Token verification failed:', error)
      throw new AuthError('Network error during token verification', 500)
    }
  }

  /**
   * Logout user
   */
  logout(): void {
    this.clearToken()
  }

  /**
   * Make authenticated API request
   */
  async authenticatedRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()
    if (!token) {
      throw new AuthError('No authentication token found', 401)
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    }

    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers,
      })

      if (!response.ok) {
        const errorData = await this.parseErrorResponse(response)
        if (response.status === 401) {
          this.clearToken()
        }
        throw new AuthError(
          errorData.message || 'Request failed',
          response.status,
          errorData.code
        )
      }

      return await response.json()
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }
      
      console.error('Authenticated request failed:', error)
      throw new AuthError('Network error during request', 500)
    }
  }

  /**
   * Parse error response from API
   */
  private async parseErrorResponse(response: Response): Promise<ApiError> {
    try {
      const errorData = await response.json()
      return {
        message: errorData.message || 'Unknown error occurred',
        code: errorData.code,
        status: response.status,
      }
    } catch (error) {
      return {
        message: 'Failed to parse error response',
        status: response.status,
      }
    }
  }
}

export const authService = new AuthService()
export { AuthError }
