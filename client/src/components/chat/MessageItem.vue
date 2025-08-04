<template>
  <div
    class="message-item"
    :class="{
      'user-message': message.role === MessageRole.USER,
      'ai-message': message.role === MessageRole.AI,
      streaming: isStreaming,
    }"
  >
    <div class="message-avatar">
      <div v-if="message.role === MessageRole.USER" class="user-avatar">
        {{ user.userInitials }}
      </div>
      <div v-else class="ai-avatar">
        <FontAwesomeIcon icon="robot" class="ai-avatar-icon" />
      </div>
    </div>

    <div class="message-content">
      <div class="message-header">
        <span class="message-sender">
          {{ message.role === MessageRole.USER ? user.userName : 'AI Assistant' }}
        </span>
        <span
          v-if="message.role === MessageRole.AI && message.content.metadata"
          class="message-model"
        >
          {{ message.content.metadata.provider }}/{{ message.content.metadata.model }}
        </span>
        <span class="message-time">
          {{ formatTime(message.createdAt) }}
        </span>
      </div>

      <div class="message-body">
        <!-- Chain of thoughts display -->
        <div
          v-if="showThoughts"
          class="thoughts-content"
          :class="{ collapsed: isThoughtsCollapsed, streaming: isStreaming }"
        >
          <div class="thinking-header" @click="toggleThoughts">
            <FontAwesomeIcon icon="brain" class="thinking-icon" />
            <span v-if="isStreaming && streamingMessage?.isThinking">Model is thinking...</span>
            <span v-else>View reasoning process</span>
            <FontAwesomeIcon
              :icon="isThoughtsCollapsed ? 'chevron-right' : 'chevron-down'"
              class="collapse-icon"
            />
          </div>
          <div class="thinking-text" v-show="!isThoughtsCollapsed">
            <!-- Streaming thoughts -->
            <template v-if="isStreaming">
              <div v-if="streamingMessage?.thoughtHtml" v-html="streamingMessage.thoughtHtml"></div>
              <div v-else-if="streamingMessage?.thoughtContent">
                {{ streamingMessage.thoughtContent }}
              </div>
              <span v-if="streamingMessage?.thoughtBuffer" class="current-thinking">{{
                streamingMessage.thoughtBuffer
              }}</span>
            </template>
            <!-- Completed message thoughts -->
            <template v-else>
              <div
                v-if="message.content.metadata?.thoughtHtml"
                v-html="message.content.metadata.thoughtHtml"
              ></div>
              <div v-else-if="message.content.metadata?.thoughtContent">
                {{ message.content.metadata.thoughtContent }}
              </div>
            </template>
          </div>
        </div>

        <!-- Tool execution block -->
        <div
          v-if="
            message.role === MessageRole.AI &&
            ((streamingMessage?.toolCalls && streamingMessage.toolCalls.length > 0) ||
              (message.content.toolCalls && message.content.toolCalls.length > 0))
          "
          class="tool-block"
        >
          <div class="tool-header">
            <div class="tool-icon">🔧</div>
            <span class="tool-title">Tool Execution</span>
            <div v-if="streamingMessage?.isToolExecuting" class="tool-pulse"></div>
          </div>

          <div class="tool-logs">
            <!-- Show tool calls and results -->
            <div
              v-for="(tool, index) in streamingMessage?.toolCalls ||
              message.content.toolCalls ||
              []"
              :key="index"
              class="tool-entry"
            >
              <div class="tool-call">
                <span class="tool-status executing">Executing tool {{ tool.name }}...</span>
              </div>
              <div v-if="tool.result" class="tool-result">
                <span v-if="tool.error" class="tool-status error"
                  >Error in executing: {{ tool.error }}</span
                >
                <span v-else class="tool-status success"
                  >✅ Tool {{ tool.name }} executed successfully</span
                >
                <!-- <pre v-if="tool.result" class="tool-output">{{
                  JSON.stringify(tool.result, null, 2)
                }}</pre> -->
              </div>
            </div>
          </div>
        </div>

        <!-- Message content -->
        <div class="message-text">
          <!-- Streaming content -->
          <div v-if="isStreaming && streamingMessage" class="streaming-content">
            <div v-if="streamingMessage?.html" v-html="streamingMessage.html"></div>
            <div v-else-if="streamingMessage?.content">{{ streamingMessage.content }}</div>
            <div v-else class="streaming-placeholder">
              <span class="pulse">Assistant is thinking...</span>
            </div>
          </div>

          <!-- Static markdown content for completed messages -->
          <VueMarkdown
            v-else-if="message.content.text"
            :markdown="message.content.text"
            :remark-plugins="[remarkGfm]"
            :sanitize="true"
            class="markdown-content"
          />
        </div>
      </div>

      <!-- Message actions -->
      <div v-if="!isStreaming && message.role === MessageRole.AI" class="message-actions">
        <button @click="copyMessage" class="action-btn" title="Copy message">
          <FontAwesomeIcon icon="copy" class="copy-icon" />
        </button>

        <button @click="regenerateResponse" class="action-btn" title="Regenerate response">
          <FontAwesomeIcon icon="redo" class="regenerate-icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useUIStore } from '@/stores/ui'
import { useMessagesStore } from '@/stores/messages'
import type { Message } from '@/types'
import { VueMarkdown } from '@crazydos/vue-markdown'
import remarkGfm from 'remark-gfm'
import { MessageRole } from '@prisma/client'

interface Props {
  message: Message
  isStreaming?: boolean
}

const props = defineProps<Props>()

const user = useUserStore()
const ui = useUIStore()
const messages = useMessagesStore()

// Reactive state for thoughts collapse
const isThoughtsCollapsed = ref(false)

// Computed properties for streaming and thoughts
const streamingMessage = computed(() => messages.currentStreamingMessage)
const showThoughts = computed(() => {
  if (props.isStreaming && props.message.role === MessageRole.AI) {
    // Show thoughts during streaming only if we actually have thought content
    return messages.hasStreamingThoughts
  } else if (!props.isStreaming && props.message.role === MessageRole.AI) {
    // Show thoughts for completed messages if they have thoughts in metadata
    return props.message.content.metadata?.hasThoughts
  }
  return false
})

// Auto-collapse thoughts when streaming is completed, but keep them visible
watch(
  () => streamingMessage.value?.isComplete,
  (isComplete) => {
    if (
      isComplete &&
      (streamingMessage.value?.thoughtContent || streamingMessage.value?.thoughtHtml)
    ) {
      // Collapse but don't hide thoughts when streaming finishes
      isThoughtsCollapsed.value = true
    }
  },
)

function toggleThoughts() {
  // Always allow toggling thoughts when they exist
  isThoughtsCollapsed.value = !isThoughtsCollapsed.value
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(props.message.content.text)
    ui.addNotification('Message copied to clipboard', 'success')
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    ui.addNotification(`Failed to copy message: ${errorMessage}`, 'error')
  }
}

function regenerateResponse() {
  ui.addNotification('Regeneration feature coming soon', 'info')
}
</script>

<style lang="scss">
.message-body {
  li > p {
    display: inline;
    margin: 0;
    padding: 0;
  }
}
</style>

<style lang="scss" scoped>
.message-item {
  display: flex;
  gap: var(--spacing-md);

  &:hover {
    .message-actions {
      opacity: 1;
    }
  }
}

.user-message {
  flex-direction: row-reverse;

  .message-header {
    justify-content: flex-end;
  }

  .message-body {
    text-align: right;
  }

  .message-actions {
    justify-content: flex-end;
  }

  .message-text {
    background-color: var(--color-primary-light);
    margin-left: auto;
    border-bottom-right-radius: var(--radius-sm);
  }
}

.message-avatar {
  flex-shrink: 0;
  margin-top: var(--spacing-xs);
}

.user-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
}

.ai-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  background-color: var(--color-secondary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ai-avatar-icon {
  @include icon-md;
}

.message-content {
  flex: 1;
  min-width: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
}

.message-sender {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
}

.message-model {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background-color: var(--color-surface);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.message-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.message-body {
  position: relative;
}

.message-text {
  display: inline-block;
  padding: 2rem 3rem;
  max-width: 80%;
  border-radius: var(--radius-lg);
  color: var(--color-text);
  white-space: pre-wrap;
  word-break: word-break;
  line-height: 1.5;
  border: 1px solid var(--color-border);
}

/* Markdown content styling */
.markdown-content {
  :deep(ul),
  :deep(ol) {
    margin: 0.5em 0;
    padding-left: 1.5em;
  }

  :deep(li) {
    margin: 0.25em 0;
    line-height: 1.6;

    /* Fix for <li><p> issue: make single paragraph inline */
    > p:only-child {
      display: inline;
      margin: 0;
      padding: 0;
    }

    /* For multiple paragraphs, reduce spacing */
    > p:first-child {
      margin-top: 0;
    }

    > p:last-child {
      margin-bottom: 0;
    }

    /* Ensure proper spacing for paragraphs in lists */
    > p + p {
      margin-top: 0.5em;
    }
  }

  :deep(ul) {
    list-style-type: disc;
  }

  :deep(ol) {
    list-style-type: decimal;
  }

  /* Nested lists */
  :deep(li ul),
  :deep(li ol) {
    margin: 0.25em 0;
    padding-left: 1.2em;
  }

  :deep(li ul) {
    list-style-type: circle;
  }

  :deep(li li ul) {
    list-style-type: square;
  }

  /* Other markdown elements */
  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 0.75em 0 0.5em 0;
    font-weight: 600;
  }

  :deep(p) {
    margin: 0.5em 0;
  }

  :deep(code) {
    background-color: var(--color-surface);
    padding: 0.125em 0.25em;
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 0.875em;
  }

  :deep(pre) {
    background-color: var(--color-surface);
    padding: 1em;
    border-radius: var(--radius-md);
    overflow-x: auto;
    margin: 0.75em 0;
  }

  :deep(pre code) {
    background: none;
    padding: 0;
  }

  :deep(blockquote) {
    border-left: 3px solid var(--color-primary);
    padding-left: 1em;
    margin: 0.75em 0;
    color: var(--color-text-muted);
    font-style: italic;
  }

  :deep(table) {
    border-collapse: collapse;
    width: 100%;
    margin: 0.75em 0;
  }

  :deep(th),
  :deep(td) {
    border: 1px solid var(--color-border);
    padding: 0.5em;
    text-align: left;
  }

  :deep(th) {
    background-color: var(--color-surface);
    font-weight: 600;
  }
}

.streaming .message-text {
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  animation: pulse-border 2s infinite;
}

.streaming-placeholder {
  animation: pulse 1.5s infinite;
  color: var(--color-text-muted);
  font-style: italic;
}

.thoughts-content {
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-sm);
  background-color: var(--color-border-light);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  font-style: italic;
  color: var(--color-text-muted);
  animation: none;

  &.streaming {
    animation: thoughtsPulse 2s infinite;
  }

  &.collapsed {
    animation: none;
    background-color: var(--color-surface);
  }

  em {
    font-style: italic;
  }
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  user-select: none;
  transition: all var(--transition-fast);

  &:hover {
    color: var(--color-primary);
  }
}

.thinking-icon {
  @include icon-sm;
  color: var(--color-primary);
  margin-right: var(--spacing-md);
  margin-top: var(--spacing-xs);
}

.collapse-icon {
  @include icon-xs;
  margin-left: auto;
  transition: transform var(--transition-fast);
}

.thinking-text {
  margin-top: var(--spacing-xs);
  line-height: 1.5;
}

.streaming-content {
  :deep(.streaming-word) {
    &.fade-in {
      animation: streamingWordFadeIn 0.3s ease-out;
      opacity: 0;
      animation-fill-mode: forwards;
    }

    &.animating {
      animation: streamingWordFadeIn var(--transition-fast) ease-out;
    }
  }

  :deep(.streaming-word-group) {
    &.fade-in {
      animation: streamingWordGroupFadeIn 0.4s ease-out;
      opacity: 0;
      animation-fill-mode: forwards;
    }
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

@keyframes streamingWordFadeIn {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes streamingWordGroupFadeIn {
  0% {
    opacity: 0;
    transform: translateY(8px) scale(0.95);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* Thought streaming animations */
.thinking-text {
  color: var(--color-text-secondary);

  :deep(.streaming-thought-group) {
    &.fade-in {
      animation: streamingThoughtFadeIn 0.5s ease-out;
      opacity: 0;
      animation-fill-mode: forwards;
    }
  }
}

@keyframes streamingThoughtFadeIn {
  0% {
    opacity: 0;
    transform: translateY(6px) scale(0.98);
    background-color: rgba(var(--color-primary-rgb), 0.1);
  }

  50% {
    background-color: rgba(var(--color-primary-rgb), 0.05);
  }

  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    background-color: transparent;
  }
}

.current-thinking {
  color: var(--color-primary);
  font-style: italic;
  opacity: 0.8;
}

.typing-cursor {
  animation: pulse 1s infinite;
  font-weight: bold;
  margin-left: 2px;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.action-btn {
  @include button-secondary;
  padding: var(--spacing-xs);
  color: var(--color-text-muted);

  &:hover {
    color: var(--color-text-secondary);
    background-color: var(--color-surface);
  }
}

.copy-icon,
.regenerate-icon {
  @include icon-sm;
}

/* Animations */
@keyframes pulse-border {
  0%,
  100% {
    border-color: var(--color-border);
  }

  50% {
    border-color: var(--color-primary);
  }
}

/* Mobile adjustments */
@include mobile {
  .message-item {
    gap: var(--spacing-sm);
  }

  .user-avatar,
  .ai-avatar {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.75rem;
  }

  .message-text {
    padding: var(--spacing-sm);
    font-size: 0.875rem;
  }
}

/* Tool execution styles */
.tool-block {
  margin: var(--spacing-sm) 0;
  border: 1px solid rgba(var(--color-border-rgb), 0.3);
  border-radius: var(--border-radius-md);
  background: rgba(var(--color-surface-rgb), 0.5);
  backdrop-filter: blur(10px);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  background: rgba(var(--color-primary-rgb), 0.1);
  border-bottom: 1px solid rgba(var(--color-border-rgb), 0.2);
  border-radius: var(--border-radius-md) var(--border-radius-md) 0 0;
}

.tool-icon {
  font-size: 1rem;
}

.tool-title {
  font-weight: 600;
  color: var(--color-text-primary);
}

.tool-pulse {
  width: 8px;
  height: 8px;
  background: var(--color-accent);
  border-radius: 50%;
  animation: toolPulse 1.5s ease-in-out infinite;
  margin-left: auto;
}

@keyframes toolPulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.tool-logs {
  padding: var(--spacing-md);
}

.tool-entry {
  margin-bottom: var(--spacing-sm);

  &:last-child {
    margin-bottom: 0;
  }
}

.tool-call {
  margin-bottom: var(--spacing-xs);
}

.tool-status {
  font-size: 0.875rem;
  font-weight: 500;

  &.executing {
    color: var(--color-warning);
  }

  &.success {
    color: var(--color-success);
  }

  &.error {
    color: var(--color-error);
  }
}

.tool-output {
  margin-top: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: rgba(var(--color-text-rgb), 0.05);
  border-radius: var(--border-radius-sm);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}
</style>
