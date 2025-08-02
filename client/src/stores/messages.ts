import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useChatsStore } from './chats'
import { useModelStore } from './models'
import { ChatAPIService } from '@/services/ChatAPIService'
import { buildApiUrl } from '@/config/api'
import type { Message, StreamingMessage, StreamingChunk, StreamingWord } from '@/types'
import { StreamingChunkType } from '@/types'

export const useMessagesStore = defineStore('messages', () => {
  // State
  const messages = ref<Message[]>([])
  const streamingMessage = ref<StreamingMessage | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const abortController = ref<AbortController | null>(null)
  const lastUserMessage = ref<string>('')

  // Computed
  const currentChatMessages = computed(() => {
    const chatsStore = useChatsStore()
    return chatsStore.currentChatId 
      ? messages.value.filter(msg => msg.chatId === chatsStore.currentChatId)
      : []
  })

  const isStreaming = computed(() => 
    streamingMessage.value?.isStreaming ?? false
  )

  const hasStreamingThoughts = computed(() => 
    streamingMessage.value?.thoughtContent && streamingMessage.value.thoughtContent.trim().length > 0
  )

  const hasStreamingContent = computed(() => 
    streamingMessage.value?.content && streamingMessage.value.content.trim().length > 0
  )

  const hasAnyStreamingContent = computed(() => 
    hasStreamingThoughts.value || hasStreamingContent.value
  )

  const allMessages = computed(() => {
    const chatMessages = [...currentChatMessages.value]
    
    // Add streaming message if it exists and streaming is active
    if (streamingMessage.value && streamingMessage.value.isStreaming) {
      const chatsStore = useChatsStore()
      chatMessages.push({
        id: -1, // Temporary ID for streaming message
        content: { text: streamingMessage.value.content || '' },
        role: 'AI' as const,
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

  function clearStreamingMessage() {
    streamingMessage.value = null
  }

  function abortStreaming() {
    if (abortController.value) {
      abortController.value.abort()
      abortController.value = null
    }
    clearStreamingMessage()
  }

  function initializeStreamingMessage() {
    streamingMessage.value = {
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
      chunkCount: 0
    }
  }

  function parseChunkType(chunk: string): StreamingChunk {
    // Only detect explicit thinking markers from the API
    if (chunk.includes('<thinking>') || chunk.includes('</thinking>') ||
        chunk.includes('<thought>') || chunk.includes('</thought>')) {
      return { text: chunk, type: StreamingChunkType.Reasoning, isComplete: false }
    }
    
    // Detect markdown code blocks
    if (chunk.includes('```')) {
      return { text: chunk, type: StreamingChunkType.Code, isComplete: false }
    }
    
    // Detect markdown patterns
    if (chunk.match(/[#*_`]/)) {
      return { text: chunk, type: StreamingChunkType.Markdown, isComplete: false }
    }
    
    // Default to content
    return { text: chunk, type: StreamingChunkType.Content, isComplete: false }
  }

  async function addStreamingChunk(chunk: string) {
    if (!streamingMessage.value) return

    // Increment chunk counter so UI can know when first chunk arrived
    streamingMessage.value.chunkCount = (streamingMessage.value.chunkCount || 0) + 1

    // Simply add content and animate - no tag parsing since backend handles it
    streamingMessage.value.content += chunk
    await processWordsAnimation(chunk)
  }

  async function processWordsAnimation(chunk: string) {
    if (!streamingMessage.value) return

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
        streamingMessage.value.html += wordGroup.join('')
        continue
      }

      // Create streaming word group
      const streamingWords = actualWords.map(word => ({
        word,
        id: `${groupId}-${word}`,
        isAnimating: true
      }))

      streamingMessage.value.words.push(...streamingWords)
      
      // Add animated span group to HTML
      streamingMessage.value.html += `<span class="streaming-word-group fade-in" data-group-id="${groupId}">${escapeHtml(groupText)}</span>`

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
          if (streamingMessage.value) {
            // Update word states
            streamingWords.forEach(streamingWord => {
              const wordIndex = streamingMessage.value!.words.findIndex(w => w.id === streamingWord.id)
              if (wordIndex !== -1) {
                streamingMessage.value!.words[wordIndex].isAnimating = false
              }
            })
            
            // Update HTML to remove animation class
            streamingMessage.value.html = streamingMessage.value.html.replace(
              `<span class="streaming-word-group fade-in" data-group-id="${groupId}">`,
              `<span class="streaming-word-group" data-group-id="${groupId}">`
            )
          }
        }, 200) // Slightly longer for 3-word groups
      })
    }
  }

  async function processThoughtWordsAnimation(chunk: string) {
    if (!streamingMessage.value) return

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
        streamingMessage.value.thoughtHtml += wordGroup.join('')
        continue
      }

      // Create streaming word group for thoughts
      const streamingWords = actualWords.map(word => ({
        word,
        id: `${groupId}-${word}`,
        isAnimating: true
      }))

      streamingMessage.value.thoughtWords.push(...streamingWords)

      // Add animated span group to thought HTML
      streamingMessage.value.thoughtHtml += `<span class="streaming-thought-group fade-in" data-group-id="${groupId}">${escapeHtml(groupText)}</span>`

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
          if (streamingMessage.value) {
            // Update word states
            streamingWords.forEach(streamingWord => {
              const wordIndex = streamingMessage.value!.thoughtWords.findIndex(w => w.id === streamingWord.id)
              if (wordIndex !== -1) {
                streamingMessage.value!.thoughtWords[wordIndex].isAnimating = false
              }

              // Update HTML to remove animation class
              if (streamingMessage.value) {
                streamingMessage.value.thoughtHtml = streamingMessage.value.thoughtHtml.replace(
                  `<span class="streaming-thought-group fade-in" data-group-id="${groupId}">`,
                  `<span class="streaming-thought-group" data-group-id="${groupId}">`
                )
              }
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

  function finalizeStreamingMessage() {
    if (!streamingMessage.value) return

    // Clean up HTML by removing all streaming spans and keeping just text
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = streamingMessage.value.html
    streamingMessage.value.content = tempDiv.textContent || tempDiv.innerText || ''
    
    streamingMessage.value.isComplete = true
    streamingMessage.value.isStreaming = false
    streamingMessage.value.isThinking = false
  }

  async function sendMessage(content: string, userId: number, chatId?: number) {
    const chatsStore = useChatsStore()
    const modelStore = useModelStore()
    
    // Store the user message for potential rollback
    lastUserMessage.value = content
    
    // Clear any previous streaming state
    clearStreamingMessage()
    abortController.value = new AbortController()
    
    try {
      // Initialize streaming message
      initializeStreamingMessage()
      // Track ongoing thought parsing across chunks
      let insideThought = false

      // Build URL with query parameters instead of path parameters
      const url = buildApiUrl(chatId ? `/message?chatId=${chatId}` : '/message')
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          userId,
          provider: modelStore.currentProvider,
          model: modelStore.currentModel,
          stream: true
        }),
        signal: abortController.value.signal
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Failed to get response reader')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          if (line.trim() === '') continue
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              switch (data.type) {
                case 'chatId':
                  // Update current chat if it was newly created
                  if (!chatId) {
                    chatsStore.setCurrentChat(data.chatId as number)
                  }
                  break
                  
                case 'userMessage':
                  // Add user message to store
                  addMessage(data.message)
                  // Clear the stored user message since it's now saved successfully
                  lastUserMessage.value = ''
                  break

                case 'reasoning':
                  // Process reasoning chunks (thoughts)
                  if (streamingMessage.value) {
                    await processThoughtWordsAnimation(data.content)
                    streamingMessage.value.thoughtContent += data.content
                  }
                  break

                case 'code':
                case 'markdown':
                  // Process code or markdown chunks
                  await addStreamingChunk(data.content)
                  break

                case 'content':
                  // Process regular content chunks (should not happen with new backend)
                  await addStreamingChunk(data.content)
                  break
                  
                case 'title':
                  // Set chat title if it doesn't have one
                  if (chatsStore.currentChatId && !chatsStore.currentChat?.title) { 
                    chatsStore.updateChat(chatsStore.currentChatId, { title: data.title as string })
                  }
                  break
                  
                case 'complete':
                  // Finalize streaming animation
                  finalizeStreamingMessage()
                  
                  // Add AI message from backend (now includes proper DB ID)
                  if (data.aiMessage) {
                    // Preserve thought content in message metadata if available
                    if (streamingMessage.value?.thoughtContent || streamingMessage.value?.thoughtHtml) {
                      data.aiMessage.content.metadata = {
                        ...data.aiMessage.content.metadata,
                        thoughtContent: streamingMessage.value.thoughtContent,
                        thoughtHtml: streamingMessage.value.thoughtHtml,
                        hasThoughts: true
                      }
                    }
                    addMessage(data.aiMessage)
                    
                    // Update chat last message
                    if (chatsStore.currentChatId) {
                      chatsStore.updateChatLastMessage(
                        chatsStore.currentChatId as number,
                        data.aiMessage.content.text as string
                      )
                    }
                  }
                  
                  // Clear streaming message
                  clearStreamingMessage()
                  break
                  
                case 'error':
                  throw new Error(data.error as string)
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError)
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was aborted - user cancelled
        console.log('Streaming was cancelled by user')
        return
      }
      
      error.value = (err instanceof Error ? err.message : 'Unknown error') as string
      console.error('Failed to send message:', err)
      
      // Clear streaming state on error
      if (streamingMessage.value) {
        finalizeStreamingMessage()
      }
    } finally {
      abortController.value = null
    }
  }

  function clearMessages() {
    messages.value = []
    clearStreamingMessage()
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
    streamingMessage,
    isLoading,
    error,
    
    // Computed
    currentChatMessages,
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
    finalizeStreamingMessage,
    getLastUserMessageForRestore,
    clearLastUserMessage
  }
})