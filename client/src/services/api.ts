/**
 * API Service Layer
 * Centralized HTTP client with authentication support
 */

import { API_CONFIG, buildApiUrl } from '@/config/api'
import { ApiError } from '@/types'
import { authService, AuthError } from './auth'

/**
 * Authenticated HTTP client
 */
class HttpClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private timeout: number
  private demoTokenRefreshPromise: Promise<any> | null = null

  constructor() {
    this.baseUrl = API_CONFIG.BASE_URL
    this.defaultHeaders = API_CONFIG.HEADERS
    this.timeout = API_CONFIG.TIMEOUT
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const isAbsolute = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    const urlToFetch = isAbsolute ? endpoint : buildApiUrl(endpoint);

    const headers = new Headers(this.defaultHeaders)
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => {
        headers.set(key, value)
      })
    }

    // Add authentication header if token exists
    const token = authService.getToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    config.signal = controller.signal;

    let response;
    try {
      response = await fetch(urlToFetch, config);
      clearTimeout(timeoutId);
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Request timeout', 'TIMEOUT');
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network error occurred',
        'NETWORK_ERROR',
        error
      );
    }

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorDetails: unknown = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
        errorDetails = errorData;
      } catch {
        // If error response is not JSON, use status text
      }

      // Handle authentication errors
      if (response.status === 401) {
        // Demo user auto-retry logic
        const storedUser = authService.getStoredUser();
        if (storedUser && storedUser.id === 2) {
          try {
            // Prevent multiple simultaneous demo token refreshes
            if (!this.demoTokenRefreshPromise) {
              this.demoTokenRefreshPromise = authService.getDemoToken().finally(() => {
                this.demoTokenRefreshPromise = null;
              });
            }
            const authResponse = await this.demoTokenRefreshPromise;
            
            const freshHeaders = new Headers(headers)
            freshHeaders.set('Authorization', `Bearer ${authResponse.token}`)
            const retryConfig: RequestInit = {
              ...options,
              headers: freshHeaders,
            };
            // Add timeout for retry
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), this.timeout);
            retryConfig.signal = retryController.signal;

            try {
              const retryResponse = await fetch(urlToFetch, retryConfig);
              clearTimeout(retryTimeoutId);
              
              if (!retryResponse.ok) {
                throw new AuthError('Demo token refresh failed - still unauthorized', 401);
              }
              
              const contentType = retryResponse.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                return await retryResponse.json();
              }
              return retryResponse.text() as T;
            } catch (retryError: unknown) {
              clearTimeout(retryTimeoutId);
              throw retryError;
            }
          } catch (demoErr) {
            authService.clearToken();
            throw new AuthError('Demo token refresh failed', 401);
          }
        }
        authService.clearToken();
        throw new AuthError(errorMessage, response.status);
      }

      throw new ApiError(errorMessage, response.status, errorDetails);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }

    return response.text() as T;
  }

  async get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> {
    // Handle query parameters
    if (params) {
      const fullUrl = buildApiUrl(endpoint)
      const url = new URL(fullUrl, window.location.origin) // Use window.location.origin as base for relative URLs
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
      return this.request<T>(url.toString())
    }

    // For simple endpoints without params, let request method handle URL building
    return this.request<T>(endpoint)
  }

  async post<T>(endpoint: string, data?: object): Promise<T> {
    const options: RequestInit = {
      method: 'POST',
    }
    
    // Only set body and Content-Type if data is provided
    if (data !== undefined) {
      options.body = JSON.stringify(data)
      options.headers = {
        'Content-Type': 'application/json',
      }
    }
    
    return this.request<T>(endpoint, options)
  }

  async put<T>(endpoint: string, data?: object): Promise<T> {
    const options: RequestInit = {
      method: 'PUT',
    }
    
    // Only set body and Content-Type if data is provided
    if (data !== undefined) {
      options.body = JSON.stringify(data)
      options.headers = {
        'Content-Type': 'application/json',
      }
    }
    
    return this.request<T>(endpoint, options)
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    })
  }

  async patch<T>(endpoint: string, data?: object): Promise<T> {
    const options: RequestInit = {
      method: 'PATCH',
    }
    
    // Only set body and Content-Type if data is provided
    if (data !== undefined) {
      options.body = JSON.stringify(data)
      options.headers = {
        'Content-Type': 'application/json',
      }
    }
    
    return this.request<T>(endpoint, options)
  }

  /**
   * Create SSE connection for streaming with authentication
   */
  createEventSource(endpoint: string, data?: Record<string, string | number | boolean>): EventSource {
    const url = buildApiUrl(endpoint)
    const token = authService.getToken()
    
    if (data) {
      const urlWithData = new URL(url)
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          urlWithData.searchParams.append(key, String(value))
        }
      })
      
      // Add token as query parameter for SSE since EventSource doesn't support headers
      if (token) {
        urlWithData.searchParams.append('token', token)
      }
      
      return new EventSource(urlWithData.toString())
    }
    
    // Add token as query parameter for SSE
    const urlWithAuth = new URL(url)
    if (token) {
      urlWithAuth.searchParams.append('token', token)
    }
    
    return new EventSource(urlWithAuth.toString())
  }

  /**
   * Check if request requires authentication
   */
  requiresAuth(): boolean {
    return authService.isAuthenticated()
  }

  /**
   * Force token refresh and retry request
   */
  async retryWithRefresh<T>(requestFn: () => Promise<T>): Promise<T> {
    try {
      return await requestFn()
    } catch (error) {
      if (error instanceof AuthError && error.status === 401) {
        // Token expired, try to refresh if user is still authenticated in storage
        const storedUser = authService.getStoredUser()
        if (storedUser) {
          try {
            // This would be a refresh token endpoint in a full implementation
            // For now, we'll just clear the auth and let user re-login
            authService.clearToken()
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError)
          }
        }
      }
      throw error
    }
  }
}

// Create singleton instance
export const httpClient = new HttpClient()

export { ApiError, AuthError }