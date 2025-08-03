/**
 * API Service Layer
 * Centralized HTTP client with configurable base URL
 */

import { API_CONFIG, buildApiUrl } from '@/config/api'
import { ApiError } from '@/types'


/**
 * Base HTTP client
 */
class HttpClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private timeout: number

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL
    this.defaultHeaders = API_CONFIG.HEADERS
    this.timeout = API_CONFIG.TIMEOUT
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://')
    const urlToFetch = isAbsolute ? endpoint : buildApiUrl(endpoint)
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
    }

    // Add timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)
    config.signal = controller.signal

    try {
      const response = await fetch(urlToFetch, config)
      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        let errorDetails: unknown = null

        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
          errorDetails = errorData
        } catch {
          // If error response is not JSON, use status text
        }

        throw new ApiError(errorMessage, response.status, errorDetails)
      }

      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        return await response.json()
      }

      return response.text() as T
    } catch (error: unknown) {
      clearTimeout(timeoutId)
      
      if (error instanceof ApiError) {
        throw error
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 'TIMEOUT')
      }

      throw new ApiError(
        error instanceof Error ? error.message : 'Network error occurred',
        'NETWORK_ERROR',
        error
      )
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    const url = new URL(buildApiUrl(endpoint))
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    return this.request<T>(url.toString())
  }

  async post<T>(endpoint: string, data?: object): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async put<T>(endpoint: string, data?: object): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }

  async patch<T>(endpoint: string, data?: object): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    })
  }

  /**
   * Create SSE connection for streaming
   */
  createEventSource(endpoint: string, data?: Record<string, string | number | boolean>): EventSource {
    const url = buildApiUrl(endpoint)
    
    if (data) {
      // For POST requests with data, we'll need to handle this differently
      // This is a simplified version - in practice, you might need to send
      // the data via POST first and then listen to SSE
      const urlWithData = new URL(url)
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlWithData.searchParams.append(key, String(value))
        }
      })
      return new EventSource(urlWithData.toString())
    }
    
    return new EventSource(url)
  }
}

// Create singleton instance
export const httpClient = new HttpClient()

export { ApiError }