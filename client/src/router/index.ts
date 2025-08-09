import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/components/auth/Login.vue'),
      meta: {
        requiresAuth: false,
        redirectIfAuthenticated: true
      }
    },
    {
      path: '/signup',
      name: 'signup',
      component: () => import('@/components/auth/Signup.vue'),
      meta: {
        requiresAuth: false,
        redirectIfAuthenticated: true
      }
    },
    {
      path: '/',
      name: 'chat',
      component: () => import('@/components/chat/ChatLayout.vue'),
      meta: {
        requiresAuth: true
      }
    },
    {
      path: '/chat/:chatId',
      name: 'chat-with-id',
      component: () => import('@/components/chat/ChatLayout.vue'),
      props: (route) => ({ chatId: Number(route.params.chatId) }),
      meta: {
        requiresAuth: true
      }
    },
    // Redirect any unknown routes to the chat
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// Navigation guards
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()

  // Initialize user from storage if not already done
  if (!userStore.isAuthenticated) {
    userStore.initializeFromStorage()
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth && userStore.requiresAuthentication()) {
    // Save the intended destination for redirect after login
    const redirectQuery = to.fullPath !== '/' ? { redirect: to.fullPath } : {}
    next({ name: 'login', query: redirectQuery })
    return
  }

  // Redirect to main app if already authenticated and trying to access login
  if (to.meta.redirectIfAuthenticated && userStore.isAuthenticated) {
    const redirectPath = (to.query.redirect as string) || '/'
    next(redirectPath)
    return
  }

  next()
})

// Optional: Add after navigation hook for analytics or other side effects
router.afterEach((to, from) => {
  // Update document title based on route
  const defaultTitle = 'Dynamic MCP'
  if (to.name === 'login') {
    document.title = `${defaultTitle} - Login`
  } else if (to.name === 'chat' || to.name === 'chat-with-id') {
    document.title = `${defaultTitle} - Chat`
  } else {
    document.title = defaultTitle
  }
})

export default router
