<template>
  <div class="message-list" ref="messagesContainer">
    <!-- Empty State -->
    <div v-if="!messages.allMessages.length && !showLoaderOverlay" class="empty-chat">
      <div class="empty-icon">
        <FontAwesomeIcon icon="message" class="empty-chat-icon" />
      </div>
      <h3 class="empty-title">Start a conversation</h3>
      <p class="empty-description">
        Send a message to begin chatting with the AI assistant.
      </p>
    </div>

    <!-- Sphere Loading Animation -->
    <Transition name="sphere-fade">
      <WaterCirclesLoading :show="showLoaderOverlay" />
    </Transition>

    <!-- Messages -->
    <div
      v-if="messages.allMessages.length || (messages.isStreaming && (messages.streamingMessage?.chunkCount ?? 0) > 0)"
      class="messages-wrapper">
      <div class="messages-container">
        <MessageItem v-for="message in messages.allMessages" :key="`message-${message.id}-${message.role}`"
          :message="message" :is-streaming="message.id === -1 && messages.isStreaming" />
      </div>
    </div>

    <!-- Scroll to bottom button -->
    <Transition name="scroll-btn">
      <button v-if="showScrollButton" @click="scrollToBottom" class="scroll-bottom-btn">
        <FontAwesomeIcon icon="arrow-down" class="scroll-icon" />
      </button>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted, onUnmounted, computed } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useChatsStore } from '@/stores/chats'
import MessageItem from './MessageItem.vue'
import WaterCirclesLoading from '@/components/animations/WaterCirclesLoading.vue'

const messages = useMessagesStore()
const chats = useChatsStore()

const messagesContainer = ref<HTMLElement>()
const showScrollButton = ref(false)
const isUserScrolled = ref(false)
const streamingScrollInterval = ref<number | null>(null)

const showLoaderOverlay = computed(() => {
  // Show water circles overlay when streaming and fewer than three messages
  return messages.isStreaming && messages.allMessages.length < 3 && !messages.hasAnyStreamingContent
})

// Auto-scroll to bottom when new messages arrive
watch(
  () => messages.allMessages.length,
  async () => {
    if (!isUserScrolled.value) {
      await nextTick()
      scrollToBottom()
    }
  }
)

// Enhanced streaming scroll handling
watch(
  () => messages.isStreaming,
  (isStreaming) => {
    if (isStreaming && !isUserScrolled.value) {
      startStreamingScrollHandler()
    } else {
      stopStreamingScrollHandler()
    }
  }
)

// Stop auto-scroll when user manually scrolls during streaming
watch(
  () => isUserScrolled.value,
  (userScrolled) => {
    if (userScrolled && messages.isStreaming) {
      stopStreamingScrollHandler()
    } else if (!userScrolled && messages.isStreaming) {
      startStreamingScrollHandler()
    }
  }
)

// Watch streaming content changes
watch(
  () => messages.streamingMessage?.content,
  async () => {
    if (messages.isStreaming && !isUserScrolled.value) {
      await nextTick()
      scrollToBottom()
    }
  },
  { flush: 'post' }
)

// Handle chat id changes - fetch messages, scroll to bottom, and clear when no chat selected
watch(
  () => chats.currentChatId,
  async (newChatId) => {
    if (newChatId) {
      // Fetch messages for the selected chat
      await messages.fetchMessages(newChatId)
      await nextTick()
      scrollToBottom()
      isUserScrolled.value = false
    } else {
      messages.clearMessages()
    }
  }
)

function scrollToBottom() {
  if (messagesContainer.value) {
    // Scroll to the bottom of the container
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    showScrollButton.value = false
    isUserScrolled.value = false
  }
}

function handleScroll() {
  if (!messagesContainer.value) return

  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  // Check if user is at the bottom (within 10px threshold)
  const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10

  isUserScrolled.value = !isAtBottom
  showScrollButton.value = !isAtBottom && messages.allMessages.length > 0
}

function startStreamingScrollHandler() {
  // Set up interval-based scrolling during streaming
  if (streamingScrollInterval.value) {
    clearInterval(streamingScrollInterval.value)
  }

  streamingScrollInterval.value = setInterval(() => {
    if (messages.isStreaming && !isUserScrolled.value) {
      scrollToBottom()
    }
  }, 50) // Check every 50ms during streaming for smooth updates
}

function stopStreamingScrollHandler() {
  // Clear the interval
  if (streamingScrollInterval.value) {
    clearInterval(streamingScrollInterval.value)
    streamingScrollInterval.value = null
  }
}

onMounted(async () => {
  messagesContainer.value?.addEventListener('scroll', handleScroll)

  // Fetch messages if we already have a current chat (e.g., on page reload)
  if (chats.currentChatId) {
    await messages.fetchMessages(chats.currentChatId)
    await nextTick()
    scrollToBottom()
  }
})

onUnmounted(() => {
  messagesContainer.value?.removeEventListener('scroll', handleScroll)
  stopStreamingScrollHandler()
})
</script>

<style lang="scss" scoped>
.message-list {
  position: relative;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  scroll-behavior: smooth;
  display: flex;
  flex-direction: column;
}

.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: var(--spacing-2xl);
  text-align: center;
}

.empty-icon {
  margin-bottom: var(--spacing-md);
  color: var(--color-text-muted);
}

.empty-chat-icon {
  @include icon-3xl;
  color: var(--color-text-muted);
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: var(--spacing-sm);
}

.empty-description {
  color: var(--color-text-secondary);
  max-width: 28rem;
  line-height: 1.5;
}

.messages-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  min-height: 0;
}

.messages-container {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-md);
  gap: var(--spacing-md);
  flex-grow: 1;
}

.scroll-bottom-btn {
  position: fixed;
  bottom: 6rem;
  right: 1.5rem;
  z-index: var(--z-sticky);
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-lg);
  cursor: pointer;
  transition: all var(--transition-normal);

  &:hover {
    background-color: var(--color-primary-hover);
    transform: translateY(-2px);
  }
}

.scroll-icon {
  @include icon-md;
}

/* Transitions */
.message-enter-active {
  transition: all var(--transition-normal);
}

.message-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.message-move {
  transition: transform var(--transition-normal);
}

.scroll-btn-enter-active,
.scroll-btn-leave-active {
  transition: all var(--transition-normal);
}

.scroll-btn-enter-from,
.scroll-btn-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.sphere-fade-enter-active,
.sphere-fade-leave-active {
  transition: opacity 0.5s ease-out;
}

.sphere-fade-enter-from,
.sphere-fade-leave-to {
  opacity: 0;
}

/* Custom scrollbar */
.message-list {
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: var(--color-surface);
  }

  &::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: var(--radius-full);
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--color-secondary);
  }
}
</style>