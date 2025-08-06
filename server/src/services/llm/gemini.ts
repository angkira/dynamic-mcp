import { GoogleGenerativeAI, GoogleGenerativeAIFetchError, FunctionDeclaration, Schema, SchemaType } from '@google/generative-ai';
import type { LlmService, ConversationMessage } from './interface';
import { LlmAuthError, LlmBadRequestError, LlmRateLimitError, LlmInternalError } from '../../utils/errors';
import { buildSystemPrompt } from '../../prompts';
import { MCPToolForLLM } from '../../types/mcp.types';


export class GeminiService implements LlmService {
  private genAI: GoogleGenerativeAI;
  private model = 'gemini-2.5-flash-lite'; // Changed to a model that supports tools

  private responseBudget: number = 8192;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  }

  private handleError(error: unknown): never {
    if (error instanceof GoogleGenerativeAIFetchError) {
      const statusCode = error.status || 500;
      const errorMessage = error.message;

      if (statusCode === 429) {
        throw new LlmRateLimitError(errorMessage);
      } else if (statusCode === 401) {
        throw new LlmAuthError(errorMessage);
      } else if (statusCode === 400) {
        throw new LlmBadRequestError(errorMessage);
      } else {
        throw new LlmInternalError(errorMessage);
      }
    } else if (error instanceof Error) {
      throw new LlmInternalError(error.message);
    } else {
      throw new LlmInternalError('An unknown error occurred');
    }
  }

  async sendMessage(message: string): Promise<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: buildSystemPrompt({ isFirstMessage: true, enableReasoning: false })
      });
      const result = await model.generateContent(message);
      const response = await result.response;

      return response.text();
    } catch (error) {
      this.handleError(error);
    }
  }

  async *sendMessageStream(message: string): AsyncIterable<string> {
    try {
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: buildSystemPrompt({ isFirstMessage: true, enableReasoning: false }),
        generationConfig: {
          maxOutputTokens: this.responseBudget,
        },
      });

      const result = await model.generateContentStream(message);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private convertHistoryToGeminiFormat(history: ConversationMessage[], currentMessage: string) {
    const contents: any[] = [];

    history.forEach(msg => {
      if (msg.role === 'USER') {
        const messageText = msg.content?.text || String(msg.content);
        contents.push({ role: 'user', parts: [{ text: messageText }] });
      } else if (msg.role === 'AI') {
        if (msg.content?.toolCalls) {
          const toolCall = msg.content.toolCalls[0];
          contents.push({
            role: 'model',
            parts: [{
              functionCall: {
                name: toolCall.name,
                args: toolCall.arguments || {}
              }
            }]
          });
        } else {
          const messageText = msg.content?.text || String(msg.content);
          contents.push({ role: 'model', parts: [{ text: messageText }] });
        }
      } else if (msg.role === 'TOOL') {
        const toolResult = msg.content.toolResult;
        if (toolResult && toolResult.name) {
          let response = toolResult.result;
          if (response && typeof response === 'object' && 'stdout' in response) {
            try {
              const stdout = response.stdout;
              if (typeof stdout === 'string' && stdout.trim().startsWith('{')) {
                response = JSON.parse(stdout);
              } else {
                response = stdout;
              }
            } catch {
              response = response.stdout;
            }
          }

          // Ensure response is not null, undefined, or empty string
          if (response === null || response === undefined || response === '') {
            response = { error: 'Tool returned an empty response' };
          }

          contents.push({
            role: 'function',
            parts: [{
              functionResponse: {
                name: toolResult.name,
                response: response
              }
            }]
          });
        }
      }
    });

    // Only add currentMessage if it's not empty and not already in history
    if (currentMessage && currentMessage.trim()) {
      contents.push({ role: 'user', parts: [{ text: currentMessage.trim() }] });
    }

    if (contents.length === 0) {
      throw new Error('No valid conversation content to send to Gemini');
    }

    return contents;
  }

  async *sendMessageStreamWithHistory(message: string, history: ConversationMessage[]): AsyncIterable<string> {
    // This can now be a simplified version of sendMessageStreamWithTools
    for await (const chunk of this.sendMessageStreamWithTools(message, history, [])) {
      if (typeof chunk === 'string') {
        yield chunk;
      }
    }
  }

  async *sendMessageStreamWithTools(message: string, history: ConversationMessage[], tools: any[], isThinking?: boolean): AsyncIterable<any> {
    try {
      const contents = this.convertHistoryToGeminiFormat(history, message);
      const formattedTools = tools.length > 0 ? this.formatTools(tools) : [];

      const promptOptions = {
        hasHistory: history.length > 0,
        isFirstMessage: history.length === 0,
        enableReasoning: !!isThinking, // Only enable reasoning when thinking mode is requested
      };

      const systemPrompt = buildSystemPrompt(promptOptions);

      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: systemPrompt,
        ...(formattedTools.length > 0 ? { tools: [{ functionDeclarations: formattedTools }] } : {}),
        generationConfig: {
          maxOutputTokens: this.responseBudget,
        },
      });

      const result = await model.generateContentStream({ contents });

      let chunkCount = 0;
      console.debug(`🔄 Starting Gemini stream processing...`);

      for await (const chunk of result.stream) {
        console.debug(`📦 Received chunk:`, JSON.stringify(chunk, null, 2));

        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            if (part.text) {
              chunkCount++;
              console.debug(`📨 Gemini text chunk ${chunkCount}: "${part.text}"`);
              yield { type: 'text', content: part.text };
            }
            if (part.functionCall) {
              console.debug(`🔧 Gemini function call:`, part.functionCall);
              yield { type: 'toolCall', call: part.functionCall };
            }
          }
        } else {
          console.debug(`⚠️  Chunk has no content parts:`, chunk);
        }
      }
      console.debug(`✅ Gemini stream completed. Total text chunks: ${chunkCount}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  async getModels(): Promise<{ provider: string; model: string }[]> {
    try {
      return Promise.resolve([
        { provider: 'google', model: 'gemini-2.5-pro' },
        { provider: 'google', model: 'gemini-2.5-flash' },
        { provider: 'google', model: 'gemini-2.5-flash-lite' },
      ]);
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

  formatTools(tools: MCPToolForLLM[]): FunctionDeclaration[] {
    return tools.map((tool, index) => {
      try {
        const { metadata, parameters, ...rest } = tool;

        // Initialize with empty schema
        let properties: Record<string, Schema> = {};
        let required: string[] = [];

        // Handle different parameter formats
        if (parameters && typeof parameters === 'object') {
          // Case 1: JSON Schema format (new format)
          if (parameters.type === 'object' && parameters.properties) {
            Object.entries(parameters.properties).forEach(([key, value]: [string, any]) => {
              if (typeof value === 'object' && value !== null) {
                properties[key] = this.convertJsonSchemaToGoogleSchema(value);
              }
            });
            required = Array.isArray(parameters.required) ? parameters.required : [];
          }
          // Case 2: Legacy format with optional field
          else if (Object.values(parameters).some((v: any) => typeof v === 'object' && 'optional' in v)) {
            Object.entries(parameters).forEach(([key, value]: [string, any]) => {
              if (typeof value === 'object' && value !== null) {
                properties[key] = this.convertLegacyParameterToGoogleSchema(value);
                if (!value.optional) {
                  required.push(key);
                }
              }
            });
          }
          // Case 3: Direct properties (fallback)
          else {
            Object.entries(parameters).forEach(([key, value]: [string, any]) => {
              if (typeof value === 'object' && value !== null) {
                properties[key] = this.convertJsonSchemaToGoogleSchema(value);
              } else {
                // Simple value, treat as string
                properties[key] = {
                  type: SchemaType.STRING,
                  description: `Parameter: ${key}`
                };
              }
            });
          }
        }

        return {
          name: rest.name,
          description: rest.description || `Tool: ${rest.name}`,
          parameters: {
            type: SchemaType.OBJECT,
            properties,
            required,
          },
        };
      } catch (error) {
        console.error(`Error formatting tool ${index} (${tool.name}):`, error);
        // Return a safe fallback
        return {
          name: tool.name,
          description: tool.description || `Tool: ${tool.name}`,
          parameters: {
            type: SchemaType.OBJECT,
            properties: {},
            required: [],
          },
        };
      }
    }) as FunctionDeclaration[];
  }

  private convertJsonSchemaToGoogleSchema(jsonSchema: any): Schema {
    const description = jsonSchema.description || '';

    switch (jsonSchema.type?.toLowerCase()) {
      case 'string':
        if (jsonSchema.enum && Array.isArray(jsonSchema.enum)) {
          return {
            type: SchemaType.STRING,
            enum: jsonSchema.enum,
            description
          };
        }
        return {
          type: SchemaType.STRING,
          description
        };

      case 'number':
      case 'integer':
        return {
          type: SchemaType.NUMBER,
          description
        };

      case 'boolean':
        return {
          type: SchemaType.BOOLEAN,
          description
        };

      case 'array':
        return {
          type: SchemaType.ARRAY,
          items: jsonSchema.items ? this.convertJsonSchemaToGoogleSchema(jsonSchema.items) : { type: SchemaType.STRING, description: 'Array item' },
          description
        };

      case 'object':
        const properties: Record<string, Schema> = {};
        if (jsonSchema.properties) {
          Object.entries(jsonSchema.properties).forEach(([key, value]: [string, any]) => {
            properties[key] = this.convertJsonSchemaToGoogleSchema(value);
          });
        }
        return {
          type: SchemaType.OBJECT,
          properties,
          description
        };

      default:
        return {
          type: SchemaType.STRING,
          description
        };
    }
  }

  private convertLegacyParameterToGoogleSchema(param: any): Schema {
    const description = param.description || '';

    switch (param.type?.toLowerCase()) {
      case 'string':
        return {
          type: SchemaType.STRING,
          description
        };
      case 'number':
      case 'integer':
        return {
          type: SchemaType.NUMBER,
          description
        };
      case 'boolean':
        return {
          type: SchemaType.BOOLEAN,
          description
        };
      case 'array':
        return {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING, description: 'Array item' },
          description
        };
      case 'object':
        return {
          type: SchemaType.OBJECT,
          properties: {},
          description
        };
      default:
        return {
          type: SchemaType.STRING,
          description
        };
    }
  }
}
