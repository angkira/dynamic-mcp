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

      console.debug(`🤖 Gemini request - Message: "${message}", History length: ${history.length}, Tools: ${tools.length}`);
      console.debug(`📝 Gemini contents:`, JSON.stringify(contents, null, 2));
      
      // Check for potential conversation format issues
      if (contents.length >= 2) {
        const lastTwo = contents.slice(-2);
        console.debug(`🔍 Last two conversation elements:`, JSON.stringify(lastTwo, null, 2));
        
        if (lastTwo[0]?.role === 'model' && lastTwo[1]?.role === 'function') {
          console.debug(`⚠️  Detected model->function pattern. This should be followed by model response, not user message.`);
        }
      }

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
