<template>
  <div class="chat-layout" :class="{ 'sidebar-open': !ui.shouldCollapseSidebar }">
    <!-- Main Chat Container -->
    <div class="chat-container" :style="{ marginLeft: ui.mainContentMargin }">
      <!-- Model Selector Header -->
      <ChatHeader />

      <!-- Messages Area -->
      <div class="messages-container">
        <MessageList />
      </div>

      <!-- Input Area -->
      <ChatInput />
    </div>

    <!-- Sidebar -->
    <ChatSidebar v-if="ui.sidebarState !== 'closed'" />

    <!-- Mobile Overlay -->
    <Transition name="overlay">
      <div
        v-if="ui.isMobile && ui.sidebarState === 'open'"
        class="mobile-overlay"
        @click="ui.closeSidebar"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { withDefaults, defineProps, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { useModelStore } from '@/stores/models'
import { useChatsStore } from '@/stores/chats'
import { useMessagesStore } from '@/stores/messages'

import ChatHeader from './ChatHeader.vue'
import ChatSidebar from './ChatSidebar.vue'
import MessageList from './MessageList.vue'
import ChatInput from './ChatInput.vue'

interface Props {
  chatId?: number
}

const props = withDefaults(defineProps<Props>(), {
  chatId: undefined,
})

const route = useRoute()
const router = useRouter()
const ui = useUIStore()
const user = useUserStore()
const models = useModelStore()
const chats = useChatsStore()
const messages = useMessagesStore()

onMounted(async () => {
  // Initialize UI
  ui.init()

  // Verify and refresh user before using user data
  await user.verifyAndRefreshUser()

  // Fetch available models
  await models.fetchModels()

  // Fetch user's chats
  if (user.userId) {
    await chats.fetchChats(user.userId)
  }

  // Initial route will be handled by immediate watcher
})

// Watch for route changes to handle navigation
watch(
  () => route.params.chatId,
  (newChatId, oldChatId) => {
    // Only handle route change if chatId actually changed
    if (newChatId !== oldChatId) {
      handleRouteChange()
    }
  },
  { immediate: true },
)

// Watch for programmatic chat changes and update route
watch(
  () => chats.currentChatId,
  (newChatId, oldChatId) => {
    // Avoid infinite loops - only update route if it's actually different
    if (newChatId !== oldChatId) {
      if (newChatId && route.params.chatId !== String(newChatId)) {
        router.push(`/chat/${newChatId}`)
      } else if (!newChatId && route.params.chatId) {
        router.push('/')
      }
    }
  },
)

async function handleRouteChange() {
  const routeChatId = route.params.chatId ? Number(route.params.chatId) : null

  if (routeChatId && routeChatId !== chats.currentChatId) {
    // Set the current chat - MessageList will handle fetching messages via its watcher
    chats.setCurrentChat(routeChatId)
  } else if (!routeChatId && chats.currentChatId) {
    // Clear current chat if we're on the home route
    chats.setCurrentChat(null)
  }
}
</script>

<style lang="scss" scoped>
.chat-layout {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background-color: var(--color-surface);
  position: relative;
}

.chat-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: margin-left var(--transition-normal);
  position: relative;
}

.messages-container {
  flex: 1;
  overflow: hidden;
  margin-bottom: 170px;
  /* Height of ChatInput */
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: var(--z-modal-backdrop);
}

/* Transitions */
.sidebar-enter-active,
.sidebar-leave-active {
  transition: transform var(--transition-normal);
}

.sidebar-enter-from,
.sidebar-leave-to {
  transform: translateX(-100%);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity var(--transition-normal);
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
