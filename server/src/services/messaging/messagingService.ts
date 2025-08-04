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

      // Add the current user message to the history for this turn.
      // This ensures the history is consistent for the initial call and any follow-up tool calls.
      if (content && content.trim()) {
        history.push({
          id: 0, // Not a real DB record yet
          role: MessageRole.USER,
          content: { text: content },
          chatId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      
      const availableTools = await this.mcpService.getAvailableToolsForLLM();
      // Pass an empty message because the user's message is now the last item in the history array.
      const responseStream = this.llmService.sendMessageStreamWithTools('', history, availableTools, isThinking);

      // Create a streaming pipeline
      const pipeline = new StreamingPipeline(
        (type: ServerWebSocketEvent, data: any) => {
          appendFileSync(streamLogFile, `${new Date().toISOString()} - ${type}: ${JSON.stringify(data)}\n`);
          stream(type, data);
        }, 
        chatId, 
        isThinking
      );
      
      // Track tool calls for final message
      const executedToolCalls: Array<{
        name: string;
        arguments: any;
        result?: any;
        error?: string;
        status: 'executing' | 'completed' | 'error';
      }> = [];

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

          // Add the AI message with tool call to history BEFORE executing the tool
          const cleanToolCall = {
            name: toolCall.name,
            arguments: toolCall.arguments
          };
          
          history.push({
            id: 0,
            role: MessageRole.AI,
            content: { toolCalls: [cleanToolCall] },
            chatId,
            createdAt: new Date(),
            updatedAt: new Date()
          });

          // Track tool call
          const trackedToolCall: {
            name: string;
            arguments: any;
            result?: any;
            error?: string;
            status: 'executing' | 'completed' | 'error';
          } = {
            name: toolCall.name,
            arguments: toolCall.arguments,
            status: 'executing'
          };
          executedToolCalls.push(trackedToolCall);

          try {
            const result = await this.mcpService.executeMCPTool(toolCall.name, toolCall.arguments);
            stream(ServerWebSocketEvent.ToolResult, { toolName: toolCall.name, result, chatId });

            // Update tracked tool call with result
            trackedToolCall.result = result;
            trackedToolCall.status = 'completed';

            // Add tool result to history
            history.push({
              id: 0,
              role: MessageRole.TOOL,
              content: { toolResult: { name: toolCall.name, result } },
              chatId,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Continue the conversation with the tool result
            console.debug(`🔄 Starting follow-up stream for tool result. History length: ${history.length}`);
            try {
              // For Gemini, we pass an empty message. The model will see the function response
              // as the last message and generate a natural language response automatically.
              const followUpStream = this.llmService.sendMessageStreamWithTools('', history, availableTools, isThinking);
              let followUpChunkCount = 0;
              for await (const followUpChunk of followUpStream) {
                if (followUpChunk.type === 'text') {
                  followUpChunkCount++;
                  console.debug(`📝 Follow-up chunk ${followUpChunkCount}: "${followUpChunk.content}"`);
                  appendFileSync(rawLogFile, `${new Date().toISOString()} - FOLLOW_UP_TEXT: "${followUpChunk.content}"\n`);
                  pipeline.processTextChunk(followUpChunk.content);
                }
                // Note: We don't handle nested tool calls in follow-up for simplicity
              }
              console.debug(`✅ Follow-up stream completed. Total chunks: ${followUpChunkCount}`);
            } catch (followUpError) {
              console.error(`❌ Follow-up stream error:`, followUpError);
              appendFileSync(rawLogFile, `${new Date().toISOString()} - FOLLOW_UP_ERROR: ${followUpError}\n`);
            }

          } catch (error: any) {
            // Update tracked tool call with error
            trackedToolCall.error = error.message || 'Tool execution failed';
            trackedToolCall.status = 'error';

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
      const aiMessage = await this.saveMessage(chatId, results.fullResponse, PrismaMessageRole.AI, provider, model || 'default', results.thoughts.length > 0 ? results.thoughts : undefined, executedToolCalls);

      // Update chat title if one was extracted and the chat doesn't already have a title
      if (results.title) {
        const chat = await this.fastify.prisma.chat.findUnique({
          where: { id: chatId },
          select: { title: true }
        });
        
        if (chat && !chat.title) {
          await this.fastify.prisma.chat.update({
            where: { id: chatId },
            data: { title: results.title }
          });
          this.fastify.log.info(`Updated chat ${chatId} with title: "${results.title}"`);
        }
      }

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

  private async saveMessage(
    chatId: number, 
    content: string, 
    role: PrismaMessageRole, 
    provider: LlmProvider, 
    model: string = 'default', 
    thoughts?: string[],
    toolCalls?: Array<{
      name: string;
      arguments: any;
      result?: any;
      error?: string;
      status: 'executing' | 'completed' | 'error';
    }>
  ) {
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
      content: { 
        text: content, 
        metadata,
        ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {})
      },
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
