import { FastifyInstance } from 'fastify';
import type { LlmService, ConversationMessage } from '@shared/types';
import { LlmProvider, ServerWebSocketEvent, MessageRole } from '@shared/types';
import { McpService } from '../mcp/mcpService';
import { MessageRole as PrismaMessageRole } from '@prisma/client';
import { StreamingPipeline, StreamingResults } from './StreamingPipeline';
import { appendFileSync, existsSync, mkdirSync } from 'fs';

export class MessagingService {
  private llmService: LlmService;
  private mcpService: McpService;
  private fastify: FastifyInstance;

  constructor(llmService: LlmService, mcpService: McpService, fastify: FastifyInstance) {
    this.llmService = llmService;
    this.mcpService = mcpService;
    this.fastify = fastify;
  }

  public async sendMessage(
    content: string,
    chatId: number,
    history: ConversationMessage[],
    stream: (type: ServerWebSocketEvent, data: any) => void,
    provider: LlmProvider,
    model?: string,
    isThinking?: boolean,
  ): Promise<void> {
    try {
      // Setup debug logging
      const debugDir = '/home/angkira/Work/dynamic-mcp/server/debug';
      if (!existsSync(debugDir)) {
        mkdirSync(debugDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const rawLogFile = `${debugDir}/raw-chunks-${chatId}-${timestamp}.log`;
      const streamLogFile = `${debugDir}/stream-events-${chatId}-${timestamp}.log`;
      
      appendFileSync(rawLogFile, `=== RAW LLM CHUNKS - Chat ${chatId} ===\n`);
      appendFileSync(streamLogFile, `=== STREAM EVENTS - Chat ${chatId} ===\n`);

      console.debug(` MessageService.sendMessage - isThinking: ${isThinking}`);
      
      const availableTools = await this.mcpService.getAvailableToolsForLLM();
      const responseStream = this.llmService.sendMessageStreamWithTools(content, history, availableTools, isThinking);

      // Create a streaming pipeline
      const pipeline = new StreamingPipeline(
        (type: ServerWebSocketEvent, data: any) => {
          appendFileSync(streamLogFile, `${new Date().toISOString()} - ${type}: ${JSON.stringify(data)}\n`);
          stream(type, data);
        }, 
        chatId, 
        isThinking
      );
      
      for await (const chunk of responseStream) {
        if (chunk.type === 'text') {
          appendFileSync(rawLogFile, `${new Date().toISOString()} - TEXT: "${chunk.content}"\n`);
          pipeline.processTextChunk(chunk.content);
        } else if (chunk.type === 'toolCall') {
          appendFileSync(rawLogFile, `${new Date().toISOString()} - TOOL_CALL: ${JSON.stringify(chunk.call)}\n`);
          
          // Flush any pending content before tool execution
          pipeline.flush();
          
          const toolCall = chunk.call;
          stream(ServerWebSocketEvent.ToolCall, { toolCall, chatId });

          try {
            const result = await this.mcpService.executeMCPTool(toolCall.name, toolCall.arguments);
            stream(ServerWebSocketEvent.ToolResult, { toolName: toolCall.name, result, chatId });

            // Add tool interactions to history
            history.push({
              id: 0,
              role: MessageRole.AI,
              content: { toolCalls: [toolCall] },
              chatId,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            history.push({
              id: 0,
              role: MessageRole.TOOL,
              content: { toolResult: { name: toolCall.name, result } },
              chatId,
              createdAt: new Date(),
              updatedAt: new Date()
            });

          } catch (error: any) {
            stream(ServerWebSocketEvent.ToolResult, {
              toolName: toolCall.name,
              result: { error: error.message || 'Tool execution failed' },
              isError: true,
              chatId
            });
          }
        }
      }

      // Final flush and get results
      const results = pipeline.finalize();
      this.fastify.log.info('Message processing complete, saving to database.');

      // Save messages to database
      const userMessage = await this.saveMessage(chatId, content, PrismaMessageRole.USER, provider, model || 'default');
      const aiMessage = await this.saveMessage(chatId, results.fullResponse, PrismaMessageRole.AI, provider, model || 'default', results.thoughts.length > 0 ? results.thoughts : undefined);

      this.fastify.log.info('Sending MessageComplete event', { chatId, aiMessageId: aiMessage.id });
      stream(ServerWebSocketEvent.MessageComplete, {
        chatId,
        aiMessage,
      });

    } catch (error: unknown) {
      this.fastify.log.error(error, 'Error sending message');
      stream(ServerWebSocketEvent.Error, { message: 'An unexpected error occurred.' });
    }
  }

  private async saveMessage(chatId: number, content: string, role: PrismaMessageRole, provider: LlmProvider, model: string = 'default', thoughts?: string[]) {
    // Build base metadata
    const metadata: Record<string, any> = { provider, model };

    // If we captured chain-of-thought, embed lightweight summary into metadata
    if (thoughts && thoughts.length > 0) {
      metadata.hasThoughts = true;
      const joinedThoughts = thoughts.join('');
      metadata.thoughtContent = joinedThoughts;
      // For future rich rendering, we can include basic HTML (optional)
      metadata.thoughtHtml = joinedThoughts.replace(/\n/g, '<br/>');
    }

    const messageData = {
      content: { text: content, metadata },
      chatId,
      role,
      ...(thoughts && { thoughts }),
    };
    return await this.fastify.prisma.message.create({ data: messageData as any });
  }

  private handleError(error: unknown, stream: (type: ServerWebSocketEvent, data: any) => void, chatId?: number) {
    console.error('Messaging service error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    stream(ServerWebSocketEvent.Error, { error: errorMessage, chatId });
  }
}
