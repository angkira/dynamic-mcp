import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: () => import('@/components/chat/ChatLayout.vue'),
    },
    {
      path: '/chat/:chatId',
      name: 'chat-with-id',
      component: () => import('@/components/chat/ChatLayout.vue'),
      props: (route) => ({ chatId: Number(route.params.chatId) })
    },
    // Redirect any unknown routes to the chat
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
