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
    const contents = [];
    
    history.forEach(msg => {
      const messageText = msg.content?.text || String(msg.content);
      if (msg.role === 'USER') {
        contents.push({ role: 'user', parts: [{ text: messageText }] });
      } else if (msg.role === 'AI') {
        // Handle tool calls in AI messages
        if (msg.content?.toolCalls) {
            contents.push({ role: 'model', parts: [{ functionCall: msg.content.toolCalls[0] }] });
        } else {
            contents.push({ role: 'model', parts: [{ text: messageText }] });
        }
      } else if (msg.role === 'TOOL') {
        contents.push({ role: 'function', parts: [{ functionResponse: { name: msg.content.name, response: { content: msg.content.result }}}]});
      }
    });
    
    contents.push({ role: 'user', parts: [{ text: currentMessage }] });
    
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

      for await (const chunk of result.stream) {
        if (chunk.candidates?.[0]?.content?.parts) {
            for (const part of chunk.candidates[0].content.parts) {
                if (part.text) {
                    yield { type: 'text', content: part.text };
                }
                if (part.functionCall) {
                    yield { type: 'toolCall', call: part.functionCall };
                }
            }
        }
      }
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

      const properties = Object.entries(parameters).reduce((acc, [key, value]) => {
        const { optional, type, ...paramProps } = value as any;
        
        // Map common type strings to SchemaType enum values
        let schemaType: SchemaType;
        switch (type?.toLowerCase()) {
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
            console.warn(`Unknown parameter type: ${type}, defaulting to STRING`);
            schemaType = SchemaType.STRING;
        }
        
        acc[key] = { ...paramProps, type: schemaType };
        return acc;
      }, {} as Record<string, Schema>);

      const required = Object.entries(parameters)
          .filter(([, value]) => !(value as { optional?: boolean }).optional)
          .map(([key]) => key);

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
