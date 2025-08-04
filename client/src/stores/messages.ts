import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useChatsStore } from './chats'
import { useModelStore } from './models'
import { ChatAPIService } from '@/services/ChatAPIService'
import type { Message, StreamingMessage, StreamingChunk, StreamingWord } from '@/types'
import { StreamingChunkType, MessageRole, ServerWebSocketEvent, ClientWebSocketEvent } from '@/types'
import { socketService } from '@/services/socket';

export const useMessagesStore = defineStore('messages', () => {
  // State
  const messages = ref<Message[]>([])
  // Multi-chat streaming support: Map<chatId, StreamingMessage>
  const streamingMessages = ref<Map<number, StreamingMessage>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)
  const lastUserMessage = ref<string>('')

  // Temporary store for chat titles that arrive before the chat entry exists
  const pendingChatTitles = new Map<number, string>();

  // Computed
  const currentChatMessages = computed(() => {
    const chatsStore = useChatsStore()
    return chatsStore.currentChatId
      ? messages.value.filter(msg => msg.chatId === chatsStore.currentChatId)
      : []
  })

  // Dynamic streaming message for the current chat
  const currentStreamingMessage = computed(() => {
    const chatsStore = useChatsStore()
    return chatsStore.currentChatId
      ? streamingMessages.value.get(chatsStore.currentChatId) || null
      : null
  })

  const isStreaming = computed(() =>
    currentStreamingMessage.value?.isStreaming ?? false
  )

  const hasStreamingThoughts = computed(() =>
    currentStreamingMessage.value?.thoughtContent && currentStreamingMessage.value.thoughtContent.trim().length > 0
  )

  const hasStreamingContent = computed(() =>
    currentStreamingMessage.value?.content && currentStreamingMessage.value.content.trim().length > 0
  )

  const hasAnyStreamingContent = computed(() =>
    hasStreamingThoughts.value || hasStreamingContent.value
  )

  const allMessages = computed(() => {
    const chatMessages = [...currentChatMessages.value]

    // Add streaming message if actively streaming
    if (currentStreamingMessage.value &&
      currentStreamingMessage.value.isStreaming &&
      !currentStreamingMessage.value.isComplete) {
      const chatsStore = useChatsStore()
      chatMessages.push({
        id: -1, // Temporary ID for streaming message
        content: { text: currentStreamingMessage.value.content || '' },
        role: MessageRole.AI,
        chatId: chatsStore.currentChatId || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    }

    return chatMessages
  })

  // Actions
  async function fetchMessages(chatId: number) {
    if (!chatId) return

    isLoading.value = true
    error.value = null

    try {
      const response = await ChatAPIService.messages.getMessages(chatId)
      // Replace messages for this chat
      messages.value = messages.value.filter(msg => msg.chatId !== chatId).concat(response.messages || [])
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error'
      console.error('Failed to fetch messages:', err)
    } finally {
      isLoading.value = false
    }
  }

  function addMessage(message: Message) {
    const existingIndex = messages.value.findIndex(m => m.id === message.id)
    if (existingIndex !== -1) {
      messages.value[existingIndex] = message
    } else {
      messages.value.push(message)
    }
  }

  function clearStreamingMessage(chatId?: number) {
    if (chatId) {
      streamingMessages.value.delete(chatId)
    } else {
      // Clear all streaming messages if no chatId specified
      streamingMessages.value.clear()
    }
  }

  function abortStreaming(chatId?: number) {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    clearStreamingMessage(chatId)
  }

  function initializeStreamingMessage(chatId: number) {
    const streamingMessage: StreamingMessage = {
      content: '',
      html: '',
      words: [],
      currentChunk: null,
      isComplete: false,
      isStreaming: true,
      isThinking: false,
      thoughtContent: '',
      thoughtHtml: '',
      insideThoughtTag: false,
      thoughtBuffer: '',
      thoughtWords: [],
      thoughtsCompleted: false,
      chatTitle: '',
      titleExtracted: false,
      chunkCount: 0,
      toolCalls: [],
      isToolExecuting: false
    }
    streamingMessages.value.set(chatId, streamingMessage)
    return streamingMessage
  }

  async function addStreamingChunk(chunk: string, chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    // Increment chunk counter so UI can know when first chunk arrived
    streamingMessage.chunkCount = (streamingMessage.chunkCount || 0) + 1

    // Add content and animate - backend already parsed and typed it
    streamingMessage.content += chunk
    await processWordsAnimation(chunk, chatId)
  }

  async function addStreamingReasoning(chunk: string, chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    streamingMessage.thoughtContent += chunk
    await processThoughtWordsAnimation(chunk, chatId)
  }

  async function setStreamingTitle(title: string, chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    streamingMessage.chatTitle = title
    
    // Store pending title if chat doesn't exist yet
    pendingChatTitles.set(chatId, title)
  }

  async function addToolCall(toolCall: any, chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    streamingMessage.toolCalls.push({
      ...toolCall,
      status: 'executing',
      result: null
    })
    streamingMessage.isToolExecuting = true
  }

  async function addToolResult(toolName: string, result: any, chatId: number, isError = false) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    const toolCall = streamingMessage.toolCalls?.find(tc => tc.name === toolName)
    if (toolCall) {
      toolCall.result = result
      toolCall.status = isError ? 'error' : 'completed'
    }
    
    streamingMessage.isToolExecuting = false
  }

  async function processWordsAnimation(chunk: string, chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    const words = chunk.split(/(\s+)/).filter(Boolean)

    // Process words in groups of 3
    for (let i = 0; i < words.length; i += 3) {
      const wordGroup = words.slice(i, i + 3)
      const groupId = `group-${Date.now()}-${Math.random()}`

      // Separate actual words from whitespace
      const actualWords = wordGroup.filter(w => w.trim())
      const groupText = wordGroup.join('')

      if (actualWords.length === 0) {
        // Only whitespace, add directly
        streamingMessage.html += wordGroup.join('')
        continue
      }

      // Create streaming word group
      const streamingWords = actualWords.map(word => ({
        word,
        id: `${groupId}-${word}`,
        isAnimating: true
      }))

      streamingMessage.words.push(...streamingWords)

      // Add animated span group to HTML
      streamingMessage.html += `<span class="streaming-word-group fade-in" data-group-id="${groupId}">${escapeHtml(groupText)}</span>`

      setTimeout(() => {
        const currentStreamingMessage = streamingMessages.value.get(chatId)
        if (currentStreamingMessage) {
          // Update word states
          streamingWords.forEach(streamingWord => {
            const wordIndex = currentStreamingMessage.words.findIndex(w => w.id === streamingWord.id)
            if (wordIndex !== -1) {
              currentStreamingMessage.words[wordIndex].isAnimating = false
            }
          })

          // Update HTML to remove animation class
          currentStreamingMessage.html = currentStreamingMessage.html.replace(
            `<span class="streaming-word-group fade-in" data-group-id="${groupId}">`,
            `<span class="streaming-word-group" data-group-id="${groupId}">`
          )
        }
      }, 200) // Slightly longer for 3-word groups
    }
  }

  async function processThoughtWordsAnimation(chunk: string, chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    const words = chunk.split(/(\s+)/).filter(Boolean)

    // Process words in groups of 3
    for (let i = 0; i < words.length; i += 3) {
      const wordGroup = words.slice(i, i + 3)
      const groupId = `thought-group-${Date.now()}-${Math.random()}`

      // Separate actual words from whitespace
      const actualWords = wordGroup.filter(w => w.trim())
      const groupText = wordGroup.join('')

      if (actualWords.length === 0) {
        // Only whitespace, add directly
        streamingMessage.thoughtHtml += wordGroup.join('')
        continue
      }

      // Create streaming word group for thoughts
      const streamingWords = actualWords.map(word => ({
        word,
        id: `${groupId}-${word}`,
        isAnimating: true
      }))

      streamingMessage.thoughtWords.push(...streamingWords)

      // Add animated span group to thought HTML
      streamingMessage.thoughtHtml += `<span class="streaming-thought-group fade-in" data-group-id="${groupId}">${escapeHtml(groupText)}</span>`

      // Use requestAnimationFrame for smooth animation timing
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve()
          })
        })
      })

      // Remove animation class after delay using requestAnimationFrame
      requestAnimationFrame(() => {
        setTimeout(() => {
          const currentStreamingMessage = streamingMessages.value.get(chatId)
          if (currentStreamingMessage) {
            // Update word states
            streamingWords.forEach(streamingWord => {
              const wordIndex = currentStreamingMessage.thoughtWords.findIndex(w => w.id === streamingWord.id)
              if (wordIndex !== -1) {
                currentStreamingMessage.thoughtWords[wordIndex].isAnimating = false
              }

              // Update HTML to remove animation class
              currentStreamingMessage.thoughtHtml = currentStreamingMessage.thoughtHtml.replace(
                `<span class="streaming-thought-group fade-in" data-group-id="${groupId}">`,
                `<span class="streaming-thought-group" data-group-id="${groupId}">`
              )
            })
          }
        }, 200) // Slightly longer for 3-word groups
      })
    }
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  function finalizeStreamingMessage(chatId: number) {
    const streamingMessage = streamingMessages.value.get(chatId)
    if (!streamingMessage) return

    // Don't overwrite the content - it's already correct from streaming chunks
    // Just mark the message as complete
    streamingMessage.isComplete = true
    streamingMessage.isStreaming = false
    streamingMessage.isThinking = false
  }

  async function sendMessage(content: string, userId: number, chatId?: number, isThinking: boolean = false) {
    const chatsStore = useChatsStore()
    const modelStore = useModelStore()

    // Store the user message for potential rollback
    lastUserMessage.value = content

    // Determine if this is a new chat (first message)
    const isNewChat = !chatId
    let actualChatId = chatId

    // Create temporary local chat for first message
    if (isNewChat) {
      const tempChat = {
        id: -1, // Temporary ID 
        title: null,
        userId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      chatsStore.addChat(tempChat)
      chatsStore.setCurrentChat(-1)
      actualChatId = -1
    }

    // Add user message to local chat immediately
    const userMessage = {
      id: Date.now(), // Temporary ID for local message
      content: { text: content },
      role: MessageRole.USER,
      chatId: actualChatId!,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    addMessage(userMessage)

    // Clear streaming state for the specific chat
    if (actualChatId) {
      clearStreamingMessage(actualChatId)
    }
    abortController.value = new AbortController()

    try {
      // Initialize streaming message for the specific chat
      if (actualChatId) {
        initializeStreamingMessage(actualChatId)
      }

      // Store references for event cleanup
      const chatIdHandler = (data: { chatId: number }) => {
        // Handle new chat creation: replace temporary chat with real chat
        if (isNewChat && actualChatId === -1) {
          // Remove temporary chat
          chatsStore.chats = chatsStore.chats.filter(chat => chat.id !== -1)

          // Update user message with real chatId
          const userMessageIndex = messages.value.findIndex(msg => msg.chatId === -1 && msg.role === MessageRole.USER)
          if (userMessageIndex !== -1) {
            messages.value[userMessageIndex].chatId = data.chatId
          }

          // Update streaming message map: move from -1 to real chatId
          const tempStreamingMessage = streamingMessages.value.get(-1)
          if (tempStreamingMessage) {
            streamingMessages.value.delete(-1)
            streamingMessages.value.set(data.chatId, tempStreamingMessage)
          }

          // Set current chat to the real chatId
          chatsStore.setCurrentChat(data.chatId)
          actualChatId = data.chatId
        }
      };

      const messageChunkHandler = (data: { content: string; chatId: number }) => {
        if (!streamingMessages.value.has(data.chatId)) {
          initializeStreamingMessage(data.chatId);
        }
        addStreamingChunk(data.content, data.chatId);
      };

      const reasoningHandler = (data: { content: string; chatId: number }) => {
        if (!streamingMessages.value.has(data.chatId)) {
          initializeStreamingMessage(data.chatId);
        }
        addStreamingReasoning(data.content, data.chatId);
      };

      const titleHandler = (data: { title: string; chatId: number }) => {
        if (!streamingMessages.value.has(data.chatId)) {
          initializeStreamingMessage(data.chatId);
        }
        setStreamingTitle(data.title, data.chatId);
        
        // Also update the chat store
        const targetChat = chatsStore.chats.find(chat => chat.id === data.chatId);
        if (targetChat && !targetChat.title) {
          chatsStore.updateChat(data.chatId, { title: data.title });
        } else if (!targetChat) {
          pendingChatTitles.set(data.chatId, data.title);
        }
      };

      const toolCallHandler = (data: { toolCall: any; chatId: number }) => {
        if (!streamingMessages.value.has(data.chatId)) {
          initializeStreamingMessage(data.chatId);
        }
        addToolCall(data.toolCall, data.chatId);
      };

      const toolResultHandler = (data: { toolName: string; result: any; isError?: boolean; chatId: number }) => {
        if (!streamingMessages.value.has(data.chatId)) {
          initializeStreamingMessage(data.chatId);
        }
        addToolResult(data.toolName, data.result, data.chatId, data.isError);
      };

      const messageCompleteHandler = (data: { aiMessage: Message; chatId: number }) => {
        // Finalize streaming for the specific chat
        finalizeStreamingMessage(data.chatId);
        const streamingMessage = streamingMessages.value.get(data.chatId);

        // For new chats, ensure the chat exists in the chats store
        if (isNewChat) {
          const existingChat = chatsStore.chats.find(chat => chat.id === data.chatId);
          if (!existingChat) {
            // Create the chat entry in the store (it was created in the backend)
            const newChat = {
              id: data.chatId,
              title: pendingChatTitles.get(data.chatId) || null, // apply title if already received
              userId: userId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              lastMessage: data.aiMessage?.content.text || '',
              lastMessageAt: new Date().toISOString()
            }
            chatsStore.addChat(newChat);
            // Remove pending title if applied
            pendingChatTitles.delete(data.chatId);
          }
        }

        if (data.aiMessage) {
          if (streamingMessage?.thoughtContent || streamingMessage?.thoughtHtml) {
            data.aiMessage.content.metadata = {
              ...data.aiMessage.content.metadata,
              thoughtContent: streamingMessage.thoughtContent,
              thoughtHtml: streamingMessage.thoughtHtml,
              hasThoughts: true,
            };
          }
          // Include tool calls in the final message
          if (streamingMessage?.toolCalls && streamingMessage.toolCalls.length > 0) {
            data.aiMessage.content.toolCalls = streamingMessage.toolCalls;
          }
          addMessage(data.aiMessage);
          if (data.chatId === chatsStore.currentChatId) {
            chatsStore.updateChatLastMessage(
              data.chatId,
              data.aiMessage.content.text || ''
            );
          }
        }
        // Mark streaming as completed and clear after saving AI message
        if (streamingMessage) {
          streamingMessage.isComplete = true;
          streamingMessage.isStreaming = false;
          // Clear streaming message after a short delay to let UI update
          setTimeout(() => {
            clearStreamingMessage(data.chatId);
          }, 100);
        }

        // Clean up event listeners
        socketService.off(ServerWebSocketEvent.ChatId, chatIdHandler);
        socketService.off(ServerWebSocketEvent.MessageChunk, messageChunkHandler);
        socketService.off(ServerWebSocketEvent.Reasoning, reasoningHandler);
        socketService.off(ServerWebSocketEvent.Title, titleHandler);
        socketService.off(ServerWebSocketEvent.ToolCall, toolCallHandler);
        socketService.off(ServerWebSocketEvent.ToolResult, toolResultHandler);
        socketService.off(ServerWebSocketEvent.MessageComplete, messageCompleteHandler);
        socketService.off(ServerWebSocketEvent.Error, errorHandler);
      };

      const errorHandler = (data: { error: string; chatId?: number }) => {
        // Show errors for current chat or if no chatId specified
        if (!data.chatId || data.chatId === chatsStore.currentChatId) {
          error.value = data.error;
          console.error('WebSocket error:', data.error);
          // Finalize streaming for the specific chat if error is associated with a chat
          if (data.chatId && streamingMessages.value.has(data.chatId)) {
            finalizeStreamingMessage(data.chatId);
          }
        }

        // Clean up event listeners on error
        socketService.off(ServerWebSocketEvent.ChatId, chatIdHandler);
        socketService.off(ServerWebSocketEvent.MessageChunk, messageChunkHandler);
        socketService.off(ServerWebSocketEvent.Reasoning, reasoningHandler);
        socketService.off(ServerWebSocketEvent.Title, titleHandler);
        socketService.off(ServerWebSocketEvent.ToolCall, toolCallHandler);
        socketService.off(ServerWebSocketEvent.ToolResult, toolResultHandler);
        socketService.off(ServerWebSocketEvent.MessageComplete, messageCompleteHandler);
        socketService.off(ServerWebSocketEvent.Error, errorHandler);
      };

      // Set up WebSocket listeners
      socketService.on(ServerWebSocketEvent.ChatId, chatIdHandler);
      socketService.on(ServerWebSocketEvent.MessageChunk, messageChunkHandler);
      socketService.on(ServerWebSocketEvent.Reasoning, reasoningHandler);
      socketService.on(ServerWebSocketEvent.Title, titleHandler);
      socketService.on(ServerWebSocketEvent.ToolCall, toolCallHandler);
      socketService.on(ServerWebSocketEvent.ToolResult, toolResultHandler);
      socketService.on(ServerWebSocketEvent.MessageComplete, messageCompleteHandler);
      socketService.on(ServerWebSocketEvent.Error, errorHandler);

      // Send message via WebSocket
      socketService.emit(ClientWebSocketEvent.SendMessage, {
        content,
        userId,
        chatId: isNewChat ? null : actualChatId, // Send null for new chats so backend creates them
        provider: modelStore.currentProvider,
        model: modelStore.currentModel,
        stream: true,
        socketId: socketService.socket?.id || '',
        isThinking,
      });

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted - user cancelled
        console.log('Streaming was cancelled by user')
        return
      }

      error.value = (err instanceof Error ? err.message : 'Unknown error') as string
      console.error('Failed to send message:', err)

      // Clear streaming state on error for the specific chat
      if (actualChatId && streamingMessages.value.has(actualChatId)) {
        finalizeStreamingMessage(actualChatId)
      }

      // If this was a new chat and AI response failed, clean up the temporary chat
      if (isNewChat) {
        chatsStore.chats = chatsStore.chats.filter(chat => chat.id !== -1)
        // Remove the user message we added locally
        messages.value = messages.value.filter(msg => msg.chatId !== -1)
        chatsStore.setCurrentChat(null)
      }
    } finally {
      abortController.value = null
    }
  }

  function clearMessages() {
    messages.value = []
    clearStreamingMessage() // Clear all streaming messages
  }

  function clearChatMessages(chatId: number) {
    messages.value = messages.value.filter(msg => msg.chatId !== chatId)
  }

  function getLastUserMessageForRestore(): string {
    return lastUserMessage.value
  }

  function clearLastUserMessage() {
    lastUserMessage.value = ''
  }

  return {
    // State
    messages,
    streamingMessages, // Multi-chat streaming support
    isLoading,
    error,

    // Computed
    currentChatMessages,
    currentStreamingMessage, // Dynamic streaming message for current chat
    isStreaming,
    hasStreamingThoughts,
    hasStreamingContent,
    hasAnyStreamingContent,
    allMessages,

    // Actions
    fetchMessages,
    addMessage,
    sendMessage,
    clearStreamingMessage,
    abortStreaming,
    clearMessages,
    clearChatMessages,
    initializeStreamingMessage,
    addStreamingChunk,
    addStreamingReasoning,
    setStreamingTitle,
    finalizeStreamingMessage,
    getLastUserMessageForRestore,
    clearLastUserMessage
  }
})
