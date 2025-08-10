import { createApp } from 'vue'
import { createPinia } from 'pinia'
import {
  create,
  NMessageProvider,
  NLoadingBarProvider,
  NDialogProvider,
  NNotificationProvider,
  NConfigProvider
} from 'naive-ui'

import App from './App.vue'
import router from './router'
import FontAwesomeIcon from './plugins/fontawesome'
import { socketService } from './services/socket'
import { useUserStore } from './stores/user'
import { useMcpStore } from './stores/mcp'

// Create Naive UI instance with only the components we need
const naive = create({
  components: [
    NMessageProvider,
    NLoadingBarProvider,
    NDialogProvider,
    NNotificationProvider,
    NConfigProvider
  ]
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(naive)

// Register Font Awesome globally
app.component('FontAwesomeIcon', FontAwesomeIcon)

// Initialize authentication before mounting
async function initializeApp() {
  const userStore = useUserStore()

  // Try to initialize user from stored session
  const wasInitialized = userStore.initializeFromStorage()

  // If user was found in storage, verify token with server
  if (wasInitialized && userStore.isAuthenticated) {
    try {
      await userStore.verifyAndRefreshUser()

      // Connect socket only after successful authentication
      socketService.connectIfAuthenticated()
      // Initialize MCP store (will subscribe to WS domain events)
      const mcpStore = useMcpStore()
      await mcpStore.initialize()
    } catch (error) {
      console.warn('Token verification failed during app initialization:', error)
      // User will be redirected to login by router guards
      // Don't connect socket if auth failed
    }
  } else {
    // No stored session or not authenticated - don't connect socket
    console.log('No stored authentication - socket connection deferred until login')
  }

  // Mount the app
  app.mount('#app')
}

// Start the app
initializeApp().catch(error => {
  console.error('Failed to initialize app:', error)
  // Mount anyway to show error state
  app.mount('#app')
})
