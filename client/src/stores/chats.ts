import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatAPIService } from '@/services/ChatAPIService'
import type { Chat } from '@/types'

export const useChatsStore = defineStore('chats', () => {
  // State
  const chats = ref<Chat[]>([])
  const currentChatId = ref<number | null>(null)
  // Show initial loader until initial fetch completes
  const isLoading = ref(true)
  const isFetching = ref(false)
  const error = ref<string | null>(null)
  const page = ref(1)
  const limit = 20
  const hasMore = ref(true)

  // Computed
  const currentChat = computed(() =>
    currentChatId.value ? chats.value.find(chat => chat.id === currentChatId.value) : null
  )

  const sortedChats = computed(() =>
    [...chats.value].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  )

  const hasChats = computed(() => chats.value.length > 0)

  // Actions

  /**
   * Fetch chats for a user. If loadMore is true, fetch next page; otherwise, initial load.
   * Optionally pass customTake to fetch only a specific number of items when loading more.
   */
  async function fetchChats(userId: number, loadMore = false, customTake?: number) {
    if (isFetching.value || (loadMore && !hasMore.value)) return;

    isFetching.value = true;
    if (!loadMore) {
      isLoading.value = true;
      page.value = 1;
      chats.value = [];
      hasMore.value = true;
    }
    error.value = null;

    const take = customTake ?? limit;
    try {
      const response = await ChatAPIService.chats.getChats(userId, page.value, take);
      if (response?.chats && response.chats.length > 0) {
        if (loadMore) {
          chats.value.push(...response.chats);
        } else {
          chats.value = response.chats;
        }
        page.value++;
        hasMore.value = chats.value.length < response.total;
      } else {
        hasMore.value = false;
      }
    } catch (err: any) {
      error.value = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to fetch chats:', err);
    } finally {
      isFetching.value = false;
      isLoading.value = false;
    }
  }

  function addChat(chat: Chat) {
    const existingIndex = chats.value.findIndex(c => c.id === chat.id)
    if (existingIndex !== -1) {
      chats.value[existingIndex] = chat
    } else {
      chats.value.unshift(chat)
    }
  }

  function updateChat(chatId: number, updates: Partial<Chat>) {
    const index = chats.value.findIndex(chat => chat.id === chatId)
    if (index !== -1) {
      chats.value[index] = { ...chats.value[index], ...updates }
    }
  }

  function updateChatLastMessage(chatId: number, message: string) {
    updateChat(chatId, {
      lastMessage: message,
      lastMessageAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }

  function setCurrentChat(chatId: number | null) {
    currentChatId.value = chatId
  }

  function createNewChat() {
    currentChatId.value = null
  }

  async function deleteChat(chatId: number) {
    try {
      await ChatAPIService.chats.deleteChat(chatId)

      chats.value = chats.value.filter(chat => chat.id !== chatId)

      if (currentChatId.value === chatId) {
        currentChatId.value = hasChats.value ? sortedChats.value[0].id : null
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete chat'
      console.error('Failed to delete chat:', err)
    }
  }

  return {
    // State
    chats,
    currentChatId,
    isLoading,
    isFetching,
    error,
    hasMore,

    // Computed
    currentChat,
    sortedChats,
    hasChats,

    // Actions
    fetchChats,
    addChat,
    updateChat,
    updateChatLastMessage,
    setCurrentChat,
    createNewChat,
    deleteChat,
  }
})