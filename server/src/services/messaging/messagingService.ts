import { FastifyInstance } from 'fastify';
import type { LlmService, ConversationMessage } from '@dynamic-mcp/shared';
import { LlmProvider, ServerWebSocketEvent, MessageRole } from '@dynamic-mcp/shared';
import { McpService } from '../mcp/mcpService';
import { MessageRole as PrismaMessageRole } from '@prisma/client';
import { StreamingPipeline, StreamingResults } from './StreamingPipeline';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import * as path from 'path';

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
      // Choose debug directory via ENV or default to ./debug inside current working dir
      const debugDir = process.env.DEBUG_DIR || path.resolve(process.cwd(), 'debug');
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
      console.log(`🔧 Providing ${availableTools.length} tools to LLM:`, availableTools.map(t => t.name));
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
            console.log(`🔧 Executing MCP tool: ${toolCall.name} with args:`, toolCall.arguments);

            // Add timeout to prevent hanging
            const executionTimeout = 30000; // 30 seconds
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error(`Tool execution timeout after ${executionTimeout}ms`)), executionTimeout);
            });

            const executionPromise = this.mcpService.executeMCPTool(toolCall.name, toolCall.arguments);

            console.log(`⏱️ Starting tool execution with ${executionTimeout}ms timeout...`);
            const result = await Promise.race([executionPromise, timeoutPromise]);
            console.log(`✅ Tool execution completed:`, result);
            stream(ServerWebSocketEvent.ToolResult, { toolName: toolCall.name, result, chatId });

            // Update tracked tool call with result
            trackedToolCall.result = result;
            trackedToolCall.status = 'completed';
            console.log(`📊 Updated tracked tool call status to: ${trackedToolCall.status}`);

            // Add tool result to history
            console.log(`📝 Adding tool result to history. Current history length: ${history.length}`);
            history.push({
              id: 0,
              role: MessageRole.TOOL,
              content: { toolResult: { name: toolCall.name, result } },
              chatId,
              createdAt: new Date(),
              updatedAt: new Date()
            });
            console.log(`📝 Tool result added. New history length: ${history.length}`);

            // Continue the conversation with the tool result
            console.log(`🔄 Starting follow-up stream for tool result. History length: ${history.length}`);
            console.log(`📋 Last 3 history items:`, history.slice(-3).map(h => ({ role: h.role, content: typeof h.content === 'object' ? Object.keys(h.content) : h.content })));
            console.log(`🎯 About to create follow-up stream...`);
            try {
              // For Gemini, we pass an empty message. The model will see the function response
              // as the last message and generate a natural language response automatically.
              console.log(`🚀 Creating follow-up stream with LLM service...`);
              const followUpStream = this.llmService.sendMessageStreamWithTools('', history, availableTools, isThinking);
              console.log(`✅ Follow-up stream created successfully, starting iteration...`);
              let followUpChunkCount = 0;
              let followUpTextCount = 0;
              for await (const followUpChunk of followUpStream) {
                followUpChunkCount++;
                console.log(`📦 Follow-up chunk ${followUpChunkCount} type: ${followUpChunk.type}`);
                appendFileSync(rawLogFile, `${new Date().toISOString()} - FOLLOW_UP_CHUNK: type=${followUpChunk.type}, content="${followUpChunk.type === 'text' ? followUpChunk.content : JSON.stringify(followUpChunk)}"\n`);

                if (followUpChunk.type === 'text') {
                  followUpTextCount++;
                  console.log(`📝 Follow-up text chunk ${followUpTextCount}: "${followUpChunk.content}"`);
                  pipeline.processTextChunk(followUpChunk.content);
                } else if (followUpChunk.type === 'toolCall') {
                  console.log(`🔧 Follow-up wants to make another tool call: ${followUpChunk.call.name}`);
                  // For now, we'll skip nested tool calls to avoid infinite loops
                  // but log them for debugging
                  appendFileSync(rawLogFile, `${new Date().toISOString()} - NESTED_TOOL_CALL_SKIPPED: ${JSON.stringify(followUpChunk.call)}\n`);
                }
              }
              console.log(`✅ Follow-up stream completed. Total chunks: ${followUpChunkCount}, Text chunks: ${followUpTextCount}`);
            } catch (followUpError) {
              console.error(`❌ Follow-up stream error:`, followUpError);
              console.error(`❌ Follow-up error stack:`, followUpError instanceof Error ? followUpError.stack : 'No stack');
              appendFileSync(rawLogFile, `${new Date().toISOString()} - FOLLOW_UP_ERROR: ${followUpError}\n`);
            }
            console.log(`🏁 Follow-up processing completed, continuing...`);

          } catch (error: any) {
            console.error(`❌ Tool execution failed for ${toolCall.name}:`, error);
            console.error(`❌ Error details:`, {
              message: error.message,
              stack: error.stack,
              name: error.name,
              type: typeof error
            });

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
