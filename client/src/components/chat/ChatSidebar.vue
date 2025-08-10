<template>
  <div>
    <aside class="chat-sidebar" :style="{ width: ui.sidebarWidth }">
      <div class="sidebar-header">
        <button @click="toggleSidebarAndContent" class="collapse-btn" :title="isCollapsed ? 'Expand' : 'Collapse'">
          <FontAwesomeIcon icon="bars" class="collapse-icon" :class="{ 'rotate-180': isCollapsed }" />
        </button>
        <!-- Settings Button -->
        <button @click="openSettingsModal" class="settings-btn" :class="{ collapsed: isCollapsed }" title="Settings">
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

      <!-- User Profile Section with Notifications -->
      <div class="user-section">
        <div class="user-and-bell">
          <UserInfo :name="user.user?.name" :email="user.user?.email || ''" :initials="user.userInitials"
            :expanded="ui.sidebarState === 'open'" />
          <button class="notif-bell" title="Notifications" @click="togglePanel">
            <FontAwesomeIcon icon="bell" />
          </button>
        </div>
        <button v-if="ui.sidebarState === 'open'" @click="handleLogout" class="logout-btn" title="Logout">
          <FontAwesomeIcon icon="arrow-right-from-bracket" />
        </button>
        <NotificationPanel :open="panelOpen" :expanded-ids="expandedIds" @toggle-expand="toggleExpand"
          @remove="remove" />
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
import UserInfo from '@/components/user/UserInfo.vue'
import { useNotifyStore } from '@/stores/notify'
import type { NotifyItem } from '@/stores/notify'
import { NotificationLevel } from '@/types'
import NotificationPanel from '@/components/NotificationPanel.vue'

const ui = useUIStore()
const user = useUserStore()
const chats = useChatsStore()
const router = useRouter()
const notify = useNotifyStore()
const panelOpen = ref(false)
const expandedIds = ref<Set<number>>(new Set())
const displayQueue = computed<NotifyItem[]>(() => notify.queue.slice(-10))

function togglePanel() {
  panelOpen.value = !panelOpen.value
}

function toggleExpand(id: number) {
  const set = new Set(expandedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  expandedIds.value = set
}

function remove(id: number) {
  const idx = notify.queue.findIndex((i: NotifyItem) => i.id === id)
  if (idx > -1) notify.queue.splice(idx, 1)
}

function kindIcon(kind: NotificationLevel) {
  if (kind === NotificationLevel.Error) return 'triangle-exclamation'
  if (kind === NotificationLevel.Warning) return 'circle-exclamation'
  if (kind === NotificationLevel.Success) return 'circle-check'
  return 'circle-info'
}

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
  position: relative;
}

.user-and-bell {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.notif-bell {
  @include button-secondary;
  padding: var(--spacing-xs);
  width: 2.5rem;
  height: 2.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);

  &:hover {
    color: var(--color-text-secondary);
    background-color: var(--color-surface);
  }
}

.notif-panel-enter-active,
.notif-panel-leave-active {
  transition: all 0.2s ease;
}

.notif-panel-enter-from,
.notif-panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.notif-panel {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  /* stick to left bottom corner above user section */
  width: 320px;
  max-height: 40vh;
  overflow: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 8px;
}

.notif-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  background: var(--color-surface);
}

.notif-item.success {
  border-left: 3px solid var(--color-success);
}

.notif-item.warning {
  border-left: 3px solid var(--color-warning);
}

.notif-item.error {
  border-left: 3px solid var(--color-danger);
}

.notif-item.info {
  border-left: 3px solid var(--color-primary);
}

.notif-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.notif-icon {
  @include icon-sm;
  color: var(--color-text-muted);
}

.notif-title {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
}

.notif-close {
  @include button-ghost;
  color: var(--color-text-muted);
}

.notif-content {
  padding: 0 8px 8px 32px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}

/* user styles moved to UserInfo component */

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
  padding: 1.4rem 1rem;
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
