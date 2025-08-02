<template>
  <div class="chat-item" :class="{
    'active': isActive,
    'collapsed': isCollapsed,
    'is-loading': isLoading
  }" @click="!isLoading && $emit('select', chat.id)" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
    </div>

    <div class="chat-icon">
      <FontAwesomeIcon icon="comment" class="chat-icon-svg" />
    </div>

    <div v-if="!isCollapsed" class="chat-content">
      <div class="chat-title">
        {{ displayTitle }}
      </div>
      <div class="chat-time">
        {{ formatTime(chat.updatedAt) }}
      </div>
    </div>

    <!-- Actions -->
    <div v-if="!isCollapsed && (isHovered || isActive) && !isLoading" class="chat-actions" @click.stop>
      <button @click="handleDelete" class="delete-btn" title="Delete chat" :disabled="isLoading">
        <FontAwesomeIcon icon="trash" class="delete-icon" />
      </button>
    </div>

    <!-- Tooltip for collapsed state -->
    <div v-if="isCollapsed && isHovered && !isLoading" class="tooltip">
      {{ displayTitle }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Chat } from '@/types'

interface Props {
  chat: Chat
  isActive: boolean
  isCollapsed: boolean
}

interface Emits {
  (e: 'select', chatId: number): void
  (e: 'delete', chatId: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isHovered = ref(false)
const isLoading = ref(false)

const displayTitle = computed(() => {
  if (props.chat.title) return props.chat.title
  if (props.chat.lastMessage) {
    return props.chat.lastMessage.slice(0, 30) + (props.chat.lastMessage.length > 30 ? '...' : '')
  }
  return 'New Chat'
})

function handleDelete() {
  isLoading.value = true
  emit('delete', props.chat.id)
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffHours / 24

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`
  } else if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`
  } else if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`
  } else {
    return date.toLocaleDateString()
  }
}
</script>

<style lang="scss" scoped>
.chat-item {
  @include card;
  position: relative;
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  margin: var(--spacing-xs) var(--spacing-xs) var(--spacing-sm);
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  color: var(--color-text);
  transition: all var(--transition-normal);
  border: 1px solid transparent;

  &:hover:not(.is-loading) {
    background-color: var(--color-border);

    .chat-actions {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--color-primary-light);
    color: var(--color-primary-dark);
    border-color: var(--color-primary);
  }

  &.collapsed {
    justify-content: center;
    padding: var(--spacing-sm);
  }

  &.is-loading {
    cursor: wait;
  }
}

.chat-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-text-secondary);
}

.chat-icon-svg {
  @include icon-sm;
}

.chat-content {
  flex: 1;
  min-width: 0;
}

.chat-title {
  font-weight: 500;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--spacing-xs);
}

.chat-preview {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: var(--spacing-xs);
}

.chat-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.chat-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  margin-left: var(--spacing-sm);
  opacity: 0;
  transition: opacity var(--transition-normal);
}

.delete-btn {
  @include button-secondary;
  padding: var(--spacing-xs);
  color: var(--color-error);
  border: none;

  &:hover {
    color: #dc2626;
    background-color: rgba(239, 68, 68, 0.1);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.delete-icon {
  @include icon-sm;
}

.tooltip {
  position: absolute;
  left: 100%;
  margin-left: var(--spacing-sm);
  top: var(--spacing-sm);
  z-index: var(--z-tooltip);
  background-color: var(--color-text);
  color: var(--color-background);
  font-size: 0.75rem;
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  white-space: nowrap;
  pointer-events: none;

  &::before {
    content: '';
    position: absolute;
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border: 4px solid transparent;
    border-right-color: var(--color-text);
  }
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  border-radius: inherit;
}

.spinner {
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>