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
    return tools.map(tool => {
      const { metadata, parameters, ...rest } = tool;

      // Handle JSON Schema format (parameters contains inputSchema structure)
      const schema = parameters;
      const properties: Record<string, Schema> = {};

      // Extract properties from JSON Schema format
      if (schema?.properties) {
        Object.entries(schema.properties).forEach(([key, value]: [string, any]) => {
          // Map JSON Schema types to Google SchemaType enum values
          let schemaType: SchemaType;
          switch (value.type?.toLowerCase()) {
            case 'string':
              schemaType = SchemaType.STRING;
              break;
            case 'number':
            case 'integer':
              schemaType = SchemaType.NUMBER;
              break;
            case 'boolean':
              schemaType = SchemaType.BOOLEAN;
              break;
            case 'array':
              schemaType = SchemaType.ARRAY;
              break;
            case 'object':
              schemaType = SchemaType.OBJECT;
              break;
            default:
              console.warn(`Unknown parameter type: ${value.type}, defaulting to STRING`);
              schemaType = SchemaType.STRING;
          }

          // Build the property schema based on type
          let propertySchema: Schema;

          // Build description with constraints
          let description = value.description || '';
          if (value.minimum !== undefined) {
            description += ` (minimum: ${value.minimum})`;
          }
          if (value.maximum !== undefined) {
            description += ` (maximum: ${value.maximum})`;
          }

          // Create schema based on type
          switch (schemaType) {
            case SchemaType.STRING:
              if (value.enum) {
                propertySchema = {
                  type: SchemaType.STRING,
                  enum: value.enum,
                  description
                };
              } else {
                propertySchema = {
                  type: SchemaType.STRING,
                  description
                };
              }
              break;
            case SchemaType.NUMBER:
              propertySchema = {
                type: SchemaType.NUMBER,
                description
              };
              break;
            case SchemaType.BOOLEAN:
              propertySchema = {
                type: SchemaType.BOOLEAN,
                description
              };
              break;
            case SchemaType.ARRAY:
              // Handle array item types
              let itemSchema: Schema;
              if (value.items?.type) {
                switch (value.items.type.toLowerCase()) {
                  case 'string':
                    itemSchema = { type: SchemaType.STRING };
                    break;
                  case 'number':
                  case 'integer':
                    itemSchema = { type: SchemaType.NUMBER };
                    break;
                  case 'boolean':
                    itemSchema = { type: SchemaType.BOOLEAN };
                    break;
                  case 'object':
                    itemSchema = { type: SchemaType.OBJECT, properties: {} };
                    break;
                  default:
                    itemSchema = { type: SchemaType.STRING };
                }
              } else {
                itemSchema = { type: SchemaType.STRING };
              }
              propertySchema = {
                type: SchemaType.ARRAY,
                items: itemSchema,
                description
              };
              break;
            case SchemaType.OBJECT:
              propertySchema = {
                type: SchemaType.OBJECT,
                properties: {},
                description
              };
              break;
            default:
              propertySchema = {
                type: SchemaType.STRING,
                description
              };
          }

          properties[key] = propertySchema;
        });
      }

      // Get required fields from JSON Schema
      const required = schema?.required || [];

      return {
        name: rest.name,
        description: rest.description,
        parameters: {
          type: SchemaType.OBJECT,
          properties,
          required,
        },
      };
    }) as FunctionDeclaration[];
  }
}
