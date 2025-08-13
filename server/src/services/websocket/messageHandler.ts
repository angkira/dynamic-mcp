import { FastifyInstance } from 'fastify';
import { Socket } from 'socket.io';
import { getLlmService } from '../llm';
import type { ConversationMessage } from '@dynamic-mcp/shared';
import { LlmProvider, ServerWebSocketEvent, MessageRole } from '@dynamic-mcp/shared';
import { MessagingService } from '../messaging';
import { McpService } from '../mcp/mcpService';
import type { Prisma } from '@shared/prisma';
import { getMCPSystemInfo, isMCPAvailable } from '../../utils/mcpIntegration';

export class WebSocketMessageHandlerService {
  private fastify: FastifyInstance;
  private mcpService: McpService; // Add mcpService as a private member

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
    this.mcpService = new McpService(fastify); // Instantiate McpService here
  }

  public async handleSendMessage(socket: Socket, payload: { content: string; userId: number; chatId?: number; provider?: LlmProvider; model?: string; stream: boolean; isThinking?: boolean }) {
    const { content, userId, provider, model, /* stream, */ isThinking } = payload;
    let { chatId } = payload;

    const selectedProvider = (provider as LlmProvider) || LlmProvider.Google;
    // Fetch user settings to get provider API key
    const settingsUserId = userId || 1;
    const userSettings = await this.fastify.prisma.settings.findUnique({ where: { userId: settingsUserId } });
    const unmasket = (k?: string | null): string | undefined => (k && k !== '********' ? k : undefined);
    const providerKeyMap: Record<string, string | undefined> = {
      [LlmProvider.Google]: unmasket(userSettings?.googleApiKey),
      [LlmProvider.OpenAI]: unmasket(userSettings?.openaiApiKey),
      [LlmProvider.Anthropic]: unmasket(userSettings?.anthropicApiKey),
      [LlmProvider.DeepSeek]: unmasket(userSettings?.deepseekApiKey),
      [LlmProvider.Qwen]: unmasket(userSettings?.qwenApiKey),
    };
    const apiKey = providerKeyMap[selectedProvider];
    if (!apiKey) {
      socket.emit(ServerWebSocketEvent.Error, { error: `API key for provider ${selectedProvider} is missing. Update it in settings.` });
      return;
    }
    const llmService = getLlmService(selectedProvider, apiKey);
    if (!llmService) {
      socket.emit(ServerWebSocketEvent.Error, { error: 'Invalid LLM provider specified.' });
      return;
    }

    const settingsUserId2 = userId || 1;
    let userSettings2: { responseBudget: number } | null;
    try {
      userSettings2 = await this.fastify.prisma.settings.findUnique({
        where: { userId: settingsUserId2 }
      });

      // If no settings found, return error (settings should be created via database initialization)
      if (!userSettings2) {
        this.fastify.log.error(`No settings found for user ${settingsUserId2}. Database may not be properly initialized.`);
        socket.emit(ServerWebSocketEvent.Error, { error: 'User settings not found. Please ensure database is properly initialized.' });
        return;
      }
    } catch (error) {
      this.fastify.log.error('Failed to fetch/create user settings:', error);
      socket.emit(ServerWebSocketEvent.Error, { error: 'Failed to fetch user settings' });
      return;
    }

    if (model) {
      llmService.setModel(model);
    }
    llmService.setBudgets(userSettings2.responseBudget);

    let enhancedContent = content;
    try {
      if (isMCPAvailable(this.fastify)) {
        const mcpSystemInfo = await getMCPSystemInfo(this.fastify);
        if (mcpSystemInfo) {
          enhancedContent = mcpSystemInfo + content;
        }
      }
    } catch (error) {
      this.fastify.log.warn('Failed to get MCP context:', error);
    }

    if (!chatId) {
      const chat = await this.fastify.prisma.chat.create({
        data: { userId },
      });
      chatId = chat.id;
    }

    const messagingService = new MessagingService(llmService, this.mcpService, this.fastify);

    const streamCallback = (type: ServerWebSocketEvent, data: any) => {
      // Ensure every WebSocket message includes chatId for proper routing
      const messageData = { ...data, chatId };
      socket.emit(type, messageData);
    };

    // Send Chat ID immediately
    streamCallback(ServerWebSocketEvent.ChatId, { chatId });

    const chat = await this.fastify.prisma.chat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: 'asc' } } }
    });
    // Convert Prisma messages to ConversationMessage format
    const conversationHistory: ConversationMessage[] = (chat?.messages || []).map((msg: any) => {
      // Clean tool calls for LLM compatibility
      let cleanContent = msg.content;
      if (cleanContent && typeof cleanContent === 'object' && !Array.isArray(cleanContent) && 'toolCalls' in cleanContent) {
        const contentObj = cleanContent as any;
        cleanContent = {
          ...cleanContent,
          toolCalls: contentObj.toolCalls?.map((tc: any) => ({
            name: tc.name,
            arguments: tc.arguments
          })) || []
        };
      }

      return {
        id: msg.id,
        content: cleanContent,
        role: MessageRole[msg.role as keyof typeof MessageRole],
        chatId: msg.chatId,
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
        thoughts: msg.thoughts
      };
    });

    try {
      await messagingService.sendMessage(enhancedContent, chatId!, conversationHistory, streamCallback, selectedProvider, model, isThinking, userId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred during streaming.';
      this.fastify.log.error('Error in messaging service:', error);
      streamCallback(ServerWebSocketEvent.Error, { error: errorMessage });
    }
  }
}