/**
 * API Configuration
 */

// Get API URL from environment variable or default to production config
const getApiBaseUrl = (): string => {
  // Check for Vite environment variable
  const envApiUrl = import.meta.env.VITE_API_URL
  
  if (envApiUrl) {
    return envApiUrl
  }
  
  // Fallback based on environment
  if (import.meta.env.DEV) {
    // Development: assume server is running on localhost
    return 'http://localhost:3000/api'
  } else {
    // Production: use docker service name
    return 'http://server:3000/api'
  }
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 30000, // 30 seconds
  HEADERS: {
    // Removed default Content-Type - set conditionally per request
  },
} as const

/**
 * Utility function to build full API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = API_CONFIG.BASE_URL.replace(/\/$/, '') // Remove trailing slash
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const result = `${baseUrl}${cleanEndpoint}`
  
  // Debug logging to track down the double /api issue
  console.log('buildApiUrl debug:', {
    endpoint,
    baseUrl,
    cleanEndpoint,
    result,
    'import.meta.env.VITE_API_URL': import.meta.env.VITE_API_URL,
    'import.meta.env.DEV': import.meta.env.DEV
  })
  
  return result
}