<template>
  <div>
    <aside class="chat-sidebar" :style="{ width: ui.sidebarWidth }">
      <div class="sidebar-header">
        <button v-if="!ui.isMobile" @click="ui.toggleSidebar" class="collapse-btn"
          :title="isCollapsed ? 'Expand' : 'Collapse'">
          <FontAwesomeIcon icon="bars" class="collapse-icon" :class="{ 'rotate-180': isCollapsed }" />
        </button>
        <!-- Settings Button -->
        <button @click="openSettingsModal" class="settings-btn" :class="{ 'collapsed': isCollapsed }" title="Settings">
          <FontAwesomeIcon icon="fa-solid fa-gear" class="settings-icon" />
          <span v-if="!isCollapsed">Settings</span>
        </button>
      </div>

      <div class="sidebar-content">
        <!-- Chat List -->
        <div v-if="!isCollapsed" class="chat-list-container">
          <div class="section-header">
            Recent Chats
          </div>

          <div class="chat-list">
            <Transition name="loading" mode="out-in">
              <div v-if="chats.isLoading" class="loading-state">
                <div class="loading-spinner"></div>
                <span v-if="!isCollapsed">Loading chats...</span>
              </div>

              <div v-else-if="!chats.hasChats" class="empty-state">
                <FontAwesomeIcon icon="comments" class="empty-state-icon" />
                <p v-if="!isCollapsed">No chats yet. Start a conversation!</p>
              </div>

              <TransitionGroup v-else name="chat-item" tag="div">
                <ChatItem v-for="chat in chats.sortedChats" :key="`chat-${chat.id}`" :chat="chat"
                  :is-active="chats.currentChatId === chat.id" :is-collapsed="isCollapsed" @select="selectChat"
                  @delete="deleteChat" />
              </TransitionGroup>
            </Transition>
          </div>
        </div>
      </div>

      <!-- User Profile Section -->
      <div class="user-section">
        <div class="user-info">
          <div class="user-avatar">
            {{ user.userInitials }}
          </div>
          <div v-if="ui.sidebarState === 'open'" class="user-details">
            <div class="user-name">{{ user.userName }}</div>
            <div class="user-email">{{ user.user?.email }}</div>
          </div>
        </div>
      </div>
    </aside>
    <ChatSettings v-model:show="showSettingsModal" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { useChatsStore } from '@/stores/chats'
import { useMessagesStore } from '@/stores/messages'
import ChatItem from './ChatItem.vue'
import ChatSettings from '../settings/Settings.vue'

const ui = useUIStore()
const user = useUserStore()
const chats = useChatsStore()
const messages = useMessagesStore()
const router = useRouter()

const showSettingsModal = ref(false)

const isCollapsed = computed(() => ui.sidebarState === 'collapsed')

async function selectChat(chatId: number) {
  // Navigate to the chat route, which will handle setting current chat and fetching messages
  router.push(`/chat/${chatId}`)

  // Close sidebar on mobile after selection
  if (ui.isMobile) {
    ui.closeSidebar()
  }
}

async function deleteChat(chatId: number) {
  await chats.deleteChat(chatId)
}

function openSettingsModal() {
  showSettingsModal.value = true
}
</script>

<style lang="scss" scoped>
.chat-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100%;
  z-index: var(--z-fixed);
  background-color: var(--color-background);
  border-right: 1px solid var(--color-border);
  transition: all var(--transition-normal);
}

.sidebar-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.user-section {
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 0;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  flex-shrink: 0;
}

.user-details {
  min-width: 0;
}

.user-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.collapse-btn {
  @include button-secondary;
  padding: var(--spacing-xs);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;

  &:hover {
    color: var(--color-text-secondary);
    background-color: var(--color-surface);
  }
}

.collapse-icon {
  @include icon-sm;
  transition: transform var(--transition-normal);

  &.rotate-180 {
    transform: rotate(180deg);
  }
}

.settings-btn {
  @include button-secondary;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  white-space: nowrap;

  &.collapsed {
    flex-direction: column;
    width: 2.5rem;
    height: 2.5rem;
    padding: var(--spacing-xs);
    justify-content: center;

    .collapsed-text {
      font-size: 0.6rem;
      line-height: 1;
      white-space: wrap;
      /* Ensure text wraps */
      text-align: center;
      margin-top: 2px;
    }
  }

  &:hover {
    color: var(--color-text-secondary);
    background-color: var(--color-surface);
  }
}

.settings-icon {
  @include icon-sm;
}

.new-chat-btn {
  @include button-primary;
  gap: var(--spacing-sm);
  width: 10rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &.collapsed {
    margin: 0 var(--spacing-sm) var(--spacing-md) var(--spacing-sm);
    padding: var(--spacing-sm);
    justify-content: center;
  }
}

.new-chat-icon {
  @include icon-md;
}

.chat-list-container {
  flex: 1;
  overflow: hidden;
}

.section-header {
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--spacing-sm);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  color: var(--color-text-muted);
  text-align: center;
}

.loading-spinner {
  @include loading-spinner;
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: var(--spacing-sm);
}

.empty-state-icon {
  @include icon-2xl;
  color: var(--color-text-muted);
}

/* Transitions */
.loading-enter-active,
.loading-leave-active {
  transition: all var(--transition-normal);
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.chat-item-enter-active,
.chat-item-leave-active {
  transition: all var(--transition-normal);
}

.chat-item-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.chat-item-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

.chat-item-move {
  transition: transform var(--transition-normal);
}
</style>