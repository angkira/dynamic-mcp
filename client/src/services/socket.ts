import { io, Socket } from 'socket.io-client'
import { reactive } from 'vue'
import { authService } from './auth'

class SocketService {
  public socket: Socket | null = null
  public state = reactive({
    isConnected: false,
    isAuthenticated: false,
    error: null as string | null
  })

  connect() {
    if (this.socket?.connected) return

    // Get authentication token first
    const token = authService.getToken()

    // Don't connect if no token is available
    if (!token) {
      console.log('Socket connection skipped: No authentication token available')
      this.state.error = 'No authentication token'
      return
    }

    // Use dedicated socket URL if provided; default to API base URL host if available
    const envSocketUrl = import.meta.env.VITE_SOCKET_URL as string | undefined
    let socketUrl = envSocketUrl && /^(http|https):\/\//.test(envSocketUrl)
      ? envSocketUrl
      : undefined

    if (!socketUrl) {
      // Derive from API base URL to avoid connecting to the vite dev server
      // Static import to avoid async/await in non-async method
      try {
        // Note: this import path is static at build time
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const apiConfig = require('@/config/api') as typeof import('@/config/api')
        const apiBase = apiConfig.API_CONFIG.BASE_URL // e.g., http://localhost:3000/api
        const origin = apiBase.replace(/\/?api\/?$/, '') // strip trailing /api
        socketUrl = origin
      } catch {
        socketUrl = window.location.origin
      }
    }

    // Configure socket with authentication
    const socketOptions: any = {
      path: '/socket.io/',
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
      auth: {
        token: token
      },
      // Also send as header for compatibility
      extraHeaders: {
        'Authorization': `Bearer ${token}`
      }
    }

    this.socket = io(socketUrl, socketOptions)

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('Socket connected successfully')
      this.state.isConnected = true
      this.state.error = null
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.state.isConnected = false
      this.state.isAuthenticated = false

      // If disconnected due to auth issues, clear token
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        this.state.error = 'Connection lost'
      }
    })

    // Authentication event handlers
    this.socket.on('authenticated', () => {
      console.log('Socket authenticated successfully')
      this.state.isAuthenticated = true
      this.state.error = null
    })

    this.socket.on('unauthorized', (error) => {
      console.error('Socket authentication failed:', error)
      this.state.isAuthenticated = false
      this.state.error = 'Authentication failed'

      // Don't clear the token here since API client has retry logic
      // authService.clearToken()
    })

    // Error handling
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.state.error = 'Connection failed'
    })

    this.socket.on('error', (error) => {
      console.error('Socket error:', error)
      this.state.error = error.message || 'Socket error occurred'
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.state.isConnected = false
    this.state.isAuthenticated = false
    this.state.error = null
  }

  /**
   * Connect only if authenticated, otherwise skip connection
   */
  connectIfAuthenticated() {
    const token = authService.getToken()
    if (token) {
      this.connect()
    } else {
      console.log('Socket connection skipped: Not authenticated')
    }
  }

  /**
   * Reconnect with updated authentication
   */
  reconnectWithAuth() {
    this.disconnect()
    this.connect()
  }

  /**
   * Update authentication token for existing connection
   */
  updateAuth() {
    const token = authService.getToken()
    if (this.socket && token) {
      this.socket.auth = { token }
      // Trigger re-authentication
      this.socket.disconnect().connect()
    }
  }

  emit(event: string, ...args: any[]) {
    if (!this.socket) {
      console.warn('Socket not connected, cannot emit event:', event)
      return
    }

    this.socket.emit(event, ...args)
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.socket) {
      console.warn('Socket not connected, cannot listen to event:', event)
      return
    }

    this.socket.on(event, callback)
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (!this.socket) return
    this.socket.off(event, callback)
  }

  /**
   * Refresh socket connection with new authentication token
   */
  refreshAuth() {
    if (this.socket) {
      const token = authService.getToken()
      if (token) {
        // Update socket auth and reconnect
        this.socket.auth = { token }
        this.socket.disconnect().connect()
      }
    }
  }

  /**
   * Wait for socket to be connected and authenticated
   */
  waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state.isConnected && this.state.isAuthenticated) {
        resolve()
        return
      }

      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'))
      }, 10000) // 10 second timeout

      const checkConnection = () => {
        if (this.state.isConnected && this.state.isAuthenticated) {
          clearTimeout(timeout)
          resolve()
        } else if (this.state.error) {
          clearTimeout(timeout)
          reject(new Error(this.state.error))
        }
      }

      // Check periodically
      const interval = setInterval(checkConnection, 100)

      // Clean up interval when done
      Promise.resolve().then(() => {
        clearInterval(interval)
      })
    })
  }
}

export const socketService = new SocketService()