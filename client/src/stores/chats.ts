import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { ChatAPIService } from '@/services/ChatAPIService'
import type { Chat } from '@/types'

export const useChatsStore = defineStore('chats', () => {
  // State
  const chats = ref<Chat[]>([])
  const currentChatId = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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
  async function fetchChats(userId: number) {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await ChatAPIService.chats.getChats(userId)
      chats.value = response.chats || []
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to fetch chats:', err)
    } finally {
      isLoading.value = false
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
        currentChatId.value = chats.value.length > 0 ? chats.value[0].id : null
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
    error,
    
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
    deleteChat
  }
})