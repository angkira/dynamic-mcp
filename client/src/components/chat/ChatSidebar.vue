<template>
  <div>
    <aside class="chat-sidebar" :style="{ width: ui.sidebarWidth }">
      <div class="sidebar-header">
        <button
          v-if="!ui.isMobile"
          @click="toggleSidebarAndContent"
          class="collapse-btn"
          :title="isCollapsed ? 'Expand' : 'Collapse'"
        >
          <FontAwesomeIcon
            icon="bars"
            class="collapse-icon"
            :class="{ 'rotate-180': isCollapsed }"
          />
        </button>
        <!-- Settings Button -->
        <button
          @click="openSettingsModal"
          class="settings-btn"
          :class="{ collapsed: isCollapsed }"
          title="Settings"
        >
          <FontAwesomeIcon icon="fa-solid fa-gear" class="settings-icon" />
          <span v-if="!isCollapsed">Settings</span>
        </button>
      </div>

      <div class="sidebar-content-wrapper">
        <transition name="sidebar-content-transition">
          <div v-if="showContent" class="sidebar-content">
            <!-- Chat List -->
            <ChatList :is-collapsed="isCollapsed" @select="selectChat" @delete="deleteChat" />
          </div>
        </transition>
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
        <button
          v-if="ui.sidebarState === 'open'"
          @click="handleLogout"
          class="logout-btn"
          title="Logout"
        >
          <FontAwesomeIcon icon="arrow-right-from-bracket" />
        </button>
      </div>
    </aside>
    <ChatSettings v-model:show="showSettingsModal" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useUIStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { useChatsStore } from '@/stores/chats'
import ChatList from './ChatList.vue'
import ChatSettings from '../settings/Settings.vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const ui = useUIStore()
const user = useUserStore()
const chats = useChatsStore()
const router = useRouter()

const showSettingsModal = ref(false)
// Determine if sidebar is collapsed
const isCollapsed = computed(() => ui.sidebarState === 'collapsed')
// Show content only when sidebar is not collapsed
const showContent = ref(!isCollapsed.value)

async function toggleSidebarAndContent() {
  const collapsing = !isCollapsed.value
  if (collapsing) {
    showContent.value = false
    await nextTick() // Wait for DOM update
  }

  ui.toggleSidebar()

  if (!collapsing) {
    setTimeout(() => {
      showContent.value = true
    }, 300) // Match transition duration
  }
}

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
  // Refresh the chat list after deletion
  if (user.user) {
    // After deletion, fetch next chat seamlessly (limit 1)
    await chats.fetchChats(user.user.id, true, 1)
  }
}

function openSettingsModal() {
  showSettingsModal.value = true
}

function handleLogout() {
  user.logout()
  router.push('/login')
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
  display: flex;
  flex-direction: column;
}

.sidebar-content-wrapper {
  flex: 1;
  overflow: hidden;
}

.sidebar-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sidebar-content-transition-enter-active,
.sidebar-content-transition-leave-active {
  transition: opacity 0.3s ease;
}

.sidebar-content-transition-enter-from,
.sidebar-content-transition-leave-to {
  opacity: 0;
}

.user-section {
  padding: var(--spacing-md);
  border-top: 1px solid var(--color-border);
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

.logout-btn {
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

.sidebar-header {
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  border-bottom: 1px solid var(--color-border);
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
</style>
