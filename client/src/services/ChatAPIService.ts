import type { PaginationParams, GetMessagesResponse, SendMessageRequest, SendMessageResponse, GetChatsResponse, CreateChatRequest, CreateChatResponse, DeleteChatResponse, GetModelsResponse, GetDefaultConfigResponse, UpdateDefaultConfigRequest, UpdateDefaultConfigResponse } from '@/types';
import { httpClient } from './api';

/**
 * API Service Methods
 */

export const ChatAPIService = {
  // Message endpoints
  messages: {
    async getMessages(chatId: number, params?: PaginationParams): Promise<GetMessagesResponse> {
      return httpClient.get<GetMessagesResponse>('/message', {
        chatId,
        ...params,
      });
    },

    async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
      // Use query parameters for chatId instead of URL parameters
      const queryParams = new URLSearchParams();
      if (request.chatId) {
        queryParams.set('chatId', request.chatId.toString());
      }
      
      const url = `/message${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      return httpClient.post<SendMessageResponse>(url, request);
    },

    createMessageStream(): EventSource {
      // For streaming, we'll handle this specially in the store
      // This is a placeholder for the streaming interface
      throw new Error('Use messagesStore.sendMessage with stream: true for streaming');
    },
  },

  // Chat endpoints
  chats: {
    async getChats(userId: number, params?: PaginationParams): Promise<GetChatsResponse> {
      return httpClient.get<GetChatsResponse>('/chats', {
        userId,
        ...params,
      });
    },

    async createChat(request: CreateChatRequest): Promise<CreateChatResponse> {
      return httpClient.post<CreateChatResponse>('/chats', request);
    },

    async deleteChat(chatId: string | number): Promise<DeleteChatResponse> {
      return httpClient.delete<DeleteChatResponse>(`/chats/${chatId}`);
    },
  },

  // Model endpoints
  models: {
    async getModels(): Promise<GetModelsResponse> {
      return httpClient.get<GetModelsResponse>('/models');
    },
  },

  // Config endpoints
  config: {
    async getDefaultConfig(): Promise<GetDefaultConfigResponse> {
      return httpClient.get<GetDefaultConfigResponse>('/config/default');
    },
    async updateDefaultConfig(request: UpdateDefaultConfigRequest): Promise<UpdateDefaultConfigResponse> {
      return httpClient.put<UpdateDefaultConfigResponse>('/config/default', request);
    },
  },
};
