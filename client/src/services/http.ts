import { authService, AuthError } from './auth'

export interface ApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export interface ApiErrorResponse {
  message: string
  code?: string
  details?: any
}

class HttpService {
  private readonly baseURL: string

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
  }

  /**
   * Make an authenticated HTTP request
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    const token = authService.getToken()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add authentication header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type')
      const isJson = contentType?.includes('application/json')

      if (!response.ok) {
        let errorMessage = 'Request failed'
        let errorCode: string | undefined

        if (isJson) {
          try {
            const errorData: ApiErrorResponse = await response.json()
            errorMessage = errorData.message || errorMessage
            errorCode = errorData.code
          } catch (parseError) {
            console.warn('Failed to parse error response:', parseError)
          }
        } else {
          errorMessage = await response.text() || errorMessage
        }

        // Handle authentication errors
        if (response.status === 401) {
          authService.clearToken()
        }

        throw new AuthError(errorMessage, response.status, errorCode)
      }

      // Return response data
      if (isJson) {
        return await response.json()
      } else {
        return await response.text() as unknown as T
      }
    } catch (error) {
      if (error instanceof AuthError) {
        throw error
      }

      console.error('HTTP request failed:', error)
      throw new AuthError('Network error occurred', 500)
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    })
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  /**
   * PATCH request
   */
  async patch<T>(
    endpoint: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options,
    })
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    })
  }

  /**
   * Upload file with form data
   */
  async upload<T>(
    endpoint: string,
    formData: FormData,
    options?: Omit<RequestInit, 'body' | 'headers'>
  ): Promise<T> {
    const token = authService.getToken()
    const headers: HeadersInit = {}

    // Add authentication header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    // Don't set Content-Type for FormData, let browser set it with boundary
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers,
      ...options,
    })
  }

  /**
   * Download file
   */
  async download(
    endpoint: string,
    filename?: string,
    options?: RequestInit
  ): Promise<void> {
    const response = await this.request<Blob>(endpoint, {
      ...options,
      headers: {
        ...options?.headers,
        // Override Content-Type for blob response
      },
    })

    // Create download link
    const url = window.URL.createObjectURL(response as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}

export const httpService = new HttpService()
