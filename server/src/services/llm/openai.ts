import OpenAI from 'openai';
import type { LlmService, ConversationMessage } from './interface';
import { LlmAuthError, LlmBadRequestError, LlmRateLimitError, LlmInternalError } from '../../utils/errors';
import { buildSystemPrompt } from '../../prompts';
import { MCPToolForLLM } from '../../types/mcp.types';

export class OpenAiService implements LlmService {
  private openai: OpenAI;
  private model = 'o3-mini';
  private responseBudget: number = 8192;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  private handleError(error: unknown): never {
    if (error instanceof OpenAI.APIError) {
      const errorCode = error.code === null ? undefined : error.code;
      if (error.status === 429) {
        throw new LlmRateLimitError(error.message, errorCode);
      } else if (error.status === 401) {
        throw new LlmAuthError(error.message, errorCode);
      } else if (error.status === 400) {
        throw new LlmBadRequestError(error.message, errorCode);
      } else {
        throw new LlmInternalError(error.message, errorCode);
      }
    } else if (error instanceof Error) {
      throw new LlmInternalError(error.message);
    } else {
      throw new LlmInternalError('An unknown error occurred');
    }
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        messages: [
          { role: 'system', content: buildSystemPrompt({ isFirstMessage: true, enableReasoning: false }) },
          { role: 'user', content: message }
        ],
        model: this.model,
        max_tokens: this.responseBudget,
      });

      if (completion.choices[0]) {
        return completion.choices[0].message.content ?? '';
      }
      return '';
    } catch (error) {
      this.handleError(error);
    }
  }

  async *sendMessageStream(message: string): AsyncIterable<string> {
    for await (const chunk of this.sendMessageStreamWithTools(message, [], [])) {
        if (typeof chunk === 'string') {
            yield chunk;
        }
    }
  }

  private convertHistoryToOpenAIMessages(history: ConversationMessage[], currentMessage: string, isThinking: boolean): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    // Determine if it's the first message in the chat for prompt building
    const isFirstMessageInChat = history.length === 0;
    const promptOptions = {
        isFirstMessage: isFirstMessageInChat,
        hasHistory: history.length > 0,
        enableReasoning: !!isThinking, // Only enable reasoning when thinking mode is requested
        restrictToMCP: false, // Allow general assistance, not restricted to MCP tools only
    };
    console.debug(` OpenAI prompt options:`, promptOptions);
    
    const systemPrompt = buildSystemPrompt(promptOptions);
    console.debug(` OpenAI system prompt preview: "${systemPrompt.substring(0, 100)}..."`);
    
    messages.push({ 
        role: 'system', 
        content: systemPrompt
    });
    
    history.forEach(msg => {
      const messageText = msg.content?.text || String(msg.content);
      if (msg.role === 'USER') {
        messages.push({ role: 'user', content: messageText });
      } else if (msg.role === 'AI') {
        if (msg.content?.tool_calls) {
            messages.push({ role: 'assistant', tool_calls: msg.content.tool_calls });
        } else {
            messages.push({ role: 'assistant', content: messageText });
        }
      } else if (msg.role === 'TOOL') {
        messages.push({ role: 'tool', tool_call_id: msg.content.tool_call_id, content: msg.content.result });
      }
    });
    
    messages.push({ role: 'user', content: currentMessage });
    
    return messages;
  }

  async *sendMessageStreamWithHistory(message: string, history: ConversationMessage[]): AsyncIterable<string> {
    for await (const chunk of this.sendMessageStreamWithTools(message, history, [])) {
      if (chunk.type === 'text') {
        yield chunk.content;
      }
    }
  }

  async *sendMessageStreamWithTools(message: string, history: ConversationMessage[], tools: any[], isThinking?: boolean): AsyncIterable<any> {
    try {
      const messages = this.convertHistoryToOpenAIMessages(history, message, !!isThinking);
      
      const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
          messages,
          model: this.model,
          max_tokens: this.responseBudget,
          stream: true,
      };

      if (tools.length > 0) {
        options.tools = this.formatTools(tools);
      }
      // No specific LLM behavior change based on isThinking for now, just pass the flag.
      // Future implementation might modify messages or options based on this flag.

      const stream = await this.openai.chat.completions.create(options);

      for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
              yield { type: 'text', content: delta.content };
          }
          if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                  yield { type: 'toolCall', call: toolCall };
              }
          }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async getModels(): Promise<{ provider: string; model: string }[]> {
    try {
      const models = await this.openai.models.list();
      const filteredModels = models.data.filter((model) => {
        const modelId = model.id.toLowerCase();
        return modelId.includes('gpt') || modelId.startsWith('o');
      });
      return filteredModels.map((model) => ({
        provider: 'openai',
        model: model.id,
      }));
    } catch (error) {
      this.handleError(error);
    }
  }

  setModel(model: string): void {
    this.model = model;
  }

  setBudgets(responseBudget: number): void {
    this.responseBudget = responseBudget;
  }

  formatTools(tools: MCPToolForLLM[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
    return tools.map(tool => {
      const { metadata, parameters, ...rest } = tool;

      // Convert MCP parameter format to JSON schema format for OpenAI
      const properties = Object.entries(parameters).reduce((acc, [key, value]) => {
        const { optional, type, ...paramProps } = value as any;
        
        // Map parameter types to JSON schema types
        let jsonSchemaType: string;
        switch (type?.toLowerCase()) {
          case 'number':
          case 'integer':
            jsonSchemaType = 'number';
            break;
          case 'boolean':
            jsonSchemaType = 'boolean';
            break;
          case 'array':
            jsonSchemaType = 'array';
            break;
          case 'object':
            jsonSchemaType = 'object';
            break;
          case 'string':
          default:
            jsonSchemaType = 'string';
        }
        
        acc[key] = { ...paramProps, type: jsonSchemaType };
        return acc;
      }, {} as Record<string, any>);

      const required = Object.entries(parameters)
          .filter(([, value]) => !(value as { optional?: boolean }).optional)
          .map(([key]) => key);

      return {
        type: 'function' as const,
        function: {
          name: rest.name,
          description: rest.description,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      };
    });
  }
}
