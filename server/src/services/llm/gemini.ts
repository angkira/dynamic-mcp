import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';
import type { LlmService, ConversationMessage } from './interface';
import { LlmAuthError, LlmBadRequestError, LlmRateLimitError, LlmInternalError } from '../../utils/errors';
import { getSystemPrompt } from '../../constants/systemPrompts';

export class GeminiService implements LlmService {
  private genAI: GoogleGenerativeAI;
  private model = 'gemini-2.5-flash';
  private thinkingBudget: number = 2048;
  private responseBudget: number = 8192;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  }

  private handleError(error: unknown): never {
    if (error instanceof GoogleGenerativeAIFetchError) {
      // The GoogleGenerativeAIFetchError might not have a direct statusCode property.
      // We can infer it from the error message or default to 500.
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
        systemInstruction: getSystemPrompt(false, true) // Assume single message is first message
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
        systemInstruction: getSystemPrompt(false, true), // Assume stream without history is first message
        generationConfig: {
          // For thinking models, allow longer responses
          maxOutputTokens: this.responseBudget,
        },
        // Enable thinking for Gemini 2.5 models - separate from generationConfig
        ...(this.model.includes('2.5') && {
          thinkingConfig: {
            thinkingBudget: this.thinkingBudget, // Use user-configured thinking budget
            includeThoughts: true, // Include thought summaries in response
          }
        })
      });
      
      const result = await model.generateContentStream(message);
      
      for await (const chunk of result.stream) {
        // Check if this chunk has parts with thinking content
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            // Type assertion for thinking parts since TypeScript doesn't know about this yet
            const partWithThought = part as any;
            if (partWithThought.thought && part.text) {
              // This is a thought summary - send with thinking markers
              yield `<thinking>${part.text}</thinking>`;
            } else if (part.text) {
              // Regular content
              yield part.text;
            }
          }
        } else {
          // Fallback for regular text chunks
          const chunkText = chunk.text();
          if (chunkText) {
            yield chunkText;
          }
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private convertHistoryToGeminiFormat(history: ConversationMessage[], currentMessage: string) {
    const contents = [];
    
    // Add conversation history
    history.forEach(msg => {
      const messageText = msg.content?.text || String(msg.content);
      if (msg.role === 'USER') {
        contents.push({ role: 'user', parts: [{ text: messageText }] });
      } else if (msg.role === 'AI') {
        contents.push({ role: 'model', parts: [{ text: messageText }] });
      }
    });
    
    // Add current message
    contents.push({ role: 'user', parts: [{ text: currentMessage }] });
    
    return contents;
  }

  async *sendMessageStreamWithHistory(message: string, history: ConversationMessage[]): AsyncIterable<string> {
    try {
      const contents = this.convertHistoryToGeminiFormat(history, message);
      
      const model = this.genAI.getGenerativeModel({
        model: this.model,
        systemInstruction: getSystemPrompt(history.length > 0, history.length === 0),
        generationConfig: {
          // For thinking models, allow longer responses
          maxOutputTokens: this.responseBudget,
        },
        // Enable thinking for Gemini 2.5 models - separate from generationConfig
        ...(this.model.includes('2.5') && {
          thinkingConfig: {
            thinkingBudget: this.thinkingBudget, // Use user-configured thinking budget
            includeThoughts: true, // Include thought summaries in response
          }
        })
      });

      const result = await model.generateContentStream({
        contents,
      });

      for await (const chunk of result.stream) {
        // Check if this chunk has parts with thinking content
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts) {
            // Type assertion for thinking parts since TypeScript doesn't know about this yet
            const partWithThought = part as any;
            if (partWithThought.thought && part.text) {
              // This is a thought summary - send with thinking markers
              yield `<thinking>${part.text}</thinking>`;
            } else if (part.text) {
              // Regular content
              yield part.text;
            }
          }
        } else {
          // Fallback for regular text chunks
          const chunkText = chunk.text();
          if (chunkText) {
            yield chunkText;
          }
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  async getModels(): Promise<{ provider: string; model: string }[]> {
    try {
      // The Google Generative AI API does not currently support listing models.
      // We will return a hardcoded list of a few popular models for now.
      return Promise.resolve([
        { provider: 'google', model: 'gemini-2.5-pro' },
        { provider: 'google', model: 'gemini-2.5-flash' },
        { provider: 'google', model: 'gemini-2.5-flash-lite' },
        { provider: 'google', model: 'gemini-2.0-flash' },
        { provider: 'google', model: 'gemini-1.5-pro' },
        { provider: 'google', model: 'gemini-1.5-flash' },
      ]);
    } catch (error) {
      this.handleError(error);
    }
  }

  setModel(model: string): void {
    this.model = model;
  }

  setBudgets(thinkingBudget: number, responseBudget: number): void {
    this.thinkingBudget = thinkingBudget;
    this.responseBudget = responseBudget;
  }
}
