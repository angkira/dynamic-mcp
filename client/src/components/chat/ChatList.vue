<template>
  <div class="chat-list-container">
    <div class="section-header">Recent Chats</div>
    <div v-if="chats.isLoading && !chats.hasChats" class="loading-state">
      <div class="loading-spinner"></div>
      <span>Loading chats...</span>
    </div>
    <div v-else-if="!chats.hasChats" class="empty-state">
      <FontAwesomeIcon icon="comments" class="empty-state-icon" />
      <p>No chats yet. Start a conversation!</p>
    </div>
    <div v-else class="chat-list" ref="scrollContainer">
      <NInfiniteScroll
        :distance="10"
        :is-loading="chats.isLoading"
        @load="handleLoadMore"
        :disabled="!chats.hasMore"
      >
        <TransitionGroup
          appear
          name="chat-item-stagger"
          tag="div"
          @before-enter="onBeforeEnter"
          @enter="onEnter"
          @leave="onLeave"
        >
          <ChatItem
            v-for="(chat, index) in chats.sortedChats"
            :key="`chat-${chat.id}`"
            :data-index="index"
            :chat="chat"
            :is-active="chats.currentChatId === chat.id"
            :is-collapsed="isCollapsed"
            @select="onSelectChat"
            @delete="onDeleteChat"
          />
        </TransitionGroup>
        <div v-if="chats.isLoading && chats.hasChats" class="loading-state">
          <div class="loading-spinner"></div>
          <span>Loading more...</span>
        </div>
      </NInfiniteScroll>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useChatsStore } from '@/stores/chats'
import { useUserStore } from '@/stores/user'
import ChatItem from './ChatItem.vue'
import { NInfiniteScroll } from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

const props = defineProps<{
  isCollapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'select', chatId: number): void
  (e: 'delete', chatId: number): void
}>()

const chats = useChatsStore()
const user = useUserStore()
const scrollContainer = ref<HTMLElement | null>(null)

const isCollapsed = computed(() => props.isCollapsed)

function handleLoadMore() {
  if (user.user) {
    chats.fetchChats(user.user.id, true)
  }
}

function onSelectChat(chatId: number) {
  emit('select', chatId)
}

function onDeleteChat(chatId: number) {
  emit('delete', chatId)
}

function onBeforeEnter(el: Element) {
  const htmlEl = el as HTMLElement
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateX(-30px)'
}

function onEnter(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  const index = parseInt(htmlEl.dataset.index || '0', 10)
  const delay = index * 100 // 0.1s stagger

  setTimeout(() => {
    htmlEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
    htmlEl.style.opacity = '1'
    htmlEl.style.transform = 'translateX(0)'
    htmlEl.addEventListener('transitionend', done, { once: true })
  }, delay)
}

function onLeave(el: Element, done: () => void) {
  const htmlEl = el as HTMLElement
  htmlEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease'
  htmlEl.style.opacity = '0'
  htmlEl.style.transform = 'translateX(30px)'
  htmlEl.addEventListener('transitionend', done, { once: true })
}

onMounted(() => {
  if (user.user) {
    chats.fetchChats(user.user.id)
  }
})
</script>

<style lang="scss" scoped>
.chat-list-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  position: relative;
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

.chat-item-stagger-move,
.chat-item-stagger-enter-active,
.chat-item-stagger-leave-active {
  transition: all 0.5s ease;
}

.chat-item-stagger-leave-active {
  position: absolute;
}
</style>
