import type { PaginationParams, GetMessagesResponse, SendMessageRequest, SendMessageResponse, GetChatsResponse, CreateChatRequest, CreateChatResponse, DeleteChatResponse, GetModelsResponse, GetDefaultConfigResponse, UpdateDefaultConfigRequest, UpdateDefaultConfigResponse, GetSettingsResponse, UpdateSettingsRequest, UpdateSettingsResponse } from '@/types';
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
  },

  // Chat endpoints
  chats: {
    async getChats(userId: number, page: number, limit: number): Promise<GetChatsResponse> {
      return httpClient.get<GetChatsResponse>('/chats', {
        userId,
        page,
        limit,
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

  // Settings endpoints
  settings: {
    async getSettings(): Promise<GetSettingsResponse> {
      return httpClient.get<GetSettingsResponse>('/settings');
    },
    async updateSettings(request: UpdateSettingsRequest): Promise<UpdateSettingsResponse> {
      return httpClient.put<UpdateSettingsResponse>('/settings', request);
    },
  },
};
