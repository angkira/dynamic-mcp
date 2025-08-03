<template>
  <div class="chat-input-container">
    <div class="chat-input-header">
      <n-checkbox v-model:checked="isThinking" label="Thinking mode" />
    </div>

    <!-- Input form -->
    <form @submit.prevent="sendMessage" class="input-form">
      <div class="input-wrapper">
        <!-- Textarea -->
        <textarea ref="textareaRef" v-model="inputText" @keydown="handleKeydown" @input="adjustHeight"
          @focus="ui.setInputFocus(true)" @blur="ui.setInputFocus(false)" :disabled="messages.isStreaming"
          :placeholder="inputPlaceholder" class="message-input" :class="{ 'ai-thinking-pulse': messages.isStreaming }"
          rows="1" />

        <!-- Send/Stop button -->
        <button v-if="!messages.isStreaming" @click="sendMessage" :disabled="!canSend" class="send-btn"
          :class="{ 'active': canSend }" type="button">
          <FontAwesomeIcon icon="arrow-right" class="send-icon" />
        </button>
        <button v-else @click="stopGeneration" class="send-btn active" type="button">
          <FontAwesomeIcon icon="stop" class="stop-icon" />
        </button>
      </div>

      <!-- Character count and tips -->
      <div class="input-footer">
        <div class="input-tips">
          <span class="tip" v-if="!messages.isStreaming">Press Enter to send, Shift+Enter for new line</span>
        </div>
        <div class="char-count" :class="{ 'warning': inputText.length > 4000 }">
          {{ inputText.length }}/5000
        </div>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { useMessagesStore } from '@/stores/messages'
import { useChatsStore } from '@/stores/chats'
import { useUserStore } from '@/stores/user'
import { useUIStore } from '@/stores/ui'
import { NCheckbox } from 'naive-ui';

const messages = useMessagesStore()
const chats = useChatsStore()
const user = useUserStore()
const ui = useUIStore()

const textareaRef = ref<HTMLTextAreaElement>()
const inputText = ref('')
const isThinking = ref(false);

const inputPlaceholder = computed(() => {
  if (messages.isStreaming) return 'AI is thinking...'
  return 'Type your message...'
})

const canSend = computed(() =>
  inputText.value.trim().length > 0 &&
  !messages.isStreaming &&
  inputText.value.length <= 5000
)

async function sendMessage() {
  if (!canSend.value || !user.userId) return

  const messageText = inputText.value.trim()
  inputText.value = ''

  // Reset textarea height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
  }

  try {
    await messages.sendMessage(messageText, user.userId, chats.currentChatId || undefined, isThinking.value)
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    ui.addNotification(`Failed to send message: ${errorMessage}`, 'error');
    // Restore the message text on error
    inputText.value = messageText;
  }
}

function stopGeneration() {
  // Get the last user message before aborting
  const lastMessage = messages.getLastUserMessageForRestore()

  // Abort the streaming
  messages.abortStreaming()

  // Restore the message to input if it wasn't saved to DB
  if (lastMessage) {
    inputText.value = lastMessage
    messages.clearLastUserMessage()
    ui.addNotification('Message restored to input', 'info')
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    sendMessage()
  }
}

async function adjustHeight() {
  await nextTick()
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto'
    const scrollHeight = textareaRef.value.scrollHeight
    const maxHeight = 150 // Max height in pixels
    textareaRef.value.style.height = Math.min(scrollHeight, maxHeight) + 'px'
  }
}

onMounted(() => {
  // Focus the input when component mounts
  textareaRef.value?.focus()
})
</script>

<style lang="scss" scoped>
.chat-input-container {
  flex-shrink: 0;
  padding: var(--spacing-md);
  background-color: var(--color-background);
  border-top: 1px solid var(--color-border);
  position: absolute;
  bottom: 0;
  width: 100%;
}

.chat-input-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-bottom: var(--spacing-md);
}

.stop-icon {
  @include icon-sm;
}

.input-form {
  width: 100%;
  max-width: 64rem;
  margin: 0 auto;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-md);
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  transition: all var(--transition-normal);
  padding: var(--spacing-md);

  &:focus-within {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
  }
}

.message-input {
  @include input-base;
  flex: 1;
  background: transparent;
  border: none;
  resize: none;
  outline: none;
  font-size: 0.875rem;
  line-height: 1.5;
  max-height: 150px;
  padding: var(--spacing-sm) var(--spacing-md);
  height: 100%;
  width: 100%;

  &:focus {
    border: none;
    box-shadow: none;
  }

  &:disabled {
    background: transparent;
    color: var(--color-text-muted);
  }
}

.send-btn {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-border);
  color: var(--color-text-muted);
  border: none;
  cursor: pointer;
  transition: all var(--transition-normal);

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.active {
    background-color: var(--color-primary);
    color: white;

    &:hover:not(:disabled) {
      background-color: var(--color-primary-hover);
      transform: scale(1.05);
    }
  }
}

.send-icon {
  @include icon-md;
}

.loading-spinner {
  @include loading-spinner;
  border-top-color: white;
}

.input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--spacing-sm);
  padding: 0 var(--spacing-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.input-tips {
  @include desktop {
    display: block;
  }

  @include mobile {
    display: none;
  }
}

.ai-thinking-pulse {
  display: inline-block;
  font-weight: 500;
  color: var(--color-primary);
  animation: aiThinkingPulse 1.2s infinite;
}

@keyframes aiThinkingPulse {
  0% {
    color: var(--color-primary);
    opacity: 1;
  }

  50% {
    color: var(--color-primary-hover);
    opacity: 0.5;
  }

  100% {
    color: var(--color-primary);
    opacity: 1;
  }
}

.char-count {
  transition: color var(--transition-normal);

  &.warning {
    color: var(--color-error);
  }
}

/* Transitions */
.stop-btn-enter-active,
.stop-btn-leave-active {
  transition: all var(--transition-normal);
}

.stop-btn-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.stop-btn-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Mobile adjustments */
@include mobile {
  .chat-input-container {
    padding: var(--spacing-md);
  }

  .input-wrapper {
    padding: var(--spacing-sm);
  }

  .message-input {
    font-size: 1rem;
  }

  .send-btn {
    width: 2rem;
    height: 2rem;
  }
}
</style>