import OpenAI from 'openai';
import type { LlmService, ConversationMessage } from './interface';
import { LlmAuthError, LlmBadRequestError, LlmRateLimitError, LlmInternalError } from '../../utils/errors';
import { getSystemPrompt } from '../../constants/systemPrompts';

export class OpenAiService implements LlmService {
  private openai: OpenAI;
  private model = 'o3-mini';
  private thinkingBudget: number = 2048;
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
          { role: 'system', content: getSystemPrompt(false, true) }, // Assume single message is first message
          { role: 'user', content: message }
        ],
        model: this.model,
        max_tokens: this.responseBudget,
      });

      if (!completion.choices[0]) {
        return '';
      }

      return completion.choices[0].message.content ?? '';
    } catch (error) {
      this.handleError(error);
    }
  }

  async *sendMessageStream(message: string): AsyncIterable<string> {
    try {
      // For reasoning models (o1), we need to use non-streaming first as they don't support streaming yet
      // Note: o3 is not yet available in public API
      if (this.model.startsWith('o1') || this.model.startsWith('o3')) {
        const completion = await this.openai.chat.completions.create({
          messages: [
            { role: 'system', content: getSystemPrompt(false, true) }, // Assume stream without history is first message
            { role: 'user', content: message }
          ],
          model: this.model,
          max_tokens: this.responseBudget,
        });

        const responseContent = completion.choices[0]?.message?.content || '';
        
        // Split response into reasoning and final answer for better thinking display
        const lines = responseContent.split('\n');
        let reasoningEnd = -1;
        
        // Find where reasoning likely ends (look for conclusion patterns)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]?.toLowerCase() || '';
          if (line.includes('therefore') || line.includes('in conclusion') || 
              line.includes('so the answer') || line.includes('final answer') ||
              line.includes('the result is') || line.includes('to summarize') ||
              (i > 2 && line.trim().length > 40 && !line.includes('step') && 
               !line.includes('consider') && !line.includes('analyze') && 
               !line.includes('examine'))) {
            reasoningEnd = i;
            break;
          }
        }
        
        if (reasoningEnd > 0) {
          const reasoningPart = lines.slice(0, reasoningEnd).join('\n');
          const answerPart = lines.slice(reasoningEnd).join('\n');
          
          // Stream reasoning with explicit markers
          yield '<thinking>\n';
          for (const char of reasoningPart) {
            yield char;
            await new Promise(resolve => setTimeout(resolve, 12));
          }
          yield '\n</thinking>\n\n';
          
          // Stream the final answer
          for (const char of answerPart) {
            yield char;
            await new Promise(resolve => setTimeout(resolve, 8));
          }
        } else {
          // Stream the response character by character to simulate streaming
          for (const char of responseContent) {
            yield char;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      } else {
        // Use streaming for other models
        const stream = await this.openai.chat.completions.create({
          messages: [
            { role: 'system', content: getSystemPrompt(false, true) }, // Assume stream without history is first message
            { role: 'user', content: message }
          ],
          model: this.model,
          max_tokens: this.responseBudget,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  private convertHistoryToOpenAIMessages(history: ConversationMessage[], currentMessage: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    
    // Determine if this is the first message (no history)
    const isFirstMessage = history.length === 0;
    
    // Add system prompt first
    messages.push({ role: 'system', content: getSystemPrompt(history.length > 0, isFirstMessage) });
    
    // Add conversation history
    history.forEach(msg => {
      const messageText = msg.content?.text || String(msg.content);
      if (msg.role === 'USER') {
        messages.push({ role: 'user', content: messageText });
      } else if (msg.role === 'AI') {
        messages.push({ role: 'assistant', content: messageText });
      }
    });
    
    // Add current message
    messages.push({ role: 'user', content: currentMessage });
    
    return messages;
  }

  async *sendMessageStreamWithHistory(message: string, history: ConversationMessage[]): AsyncIterable<string> {
    try {
      const messages = this.convertHistoryToOpenAIMessages(history, message);
      
      // For reasoning models (o1), we need to use non-streaming first as they don't support streaming yet
      // Note: o3 is not yet available in public API
      if (this.model.startsWith('o1') || this.model.startsWith('o3')) {
        const completion = await this.openai.chat.completions.create({
          messages,
          model: this.model,
          max_tokens: this.responseBudget,
        });

        const responseContent = completion.choices[0]?.message?.content || '';
        
        // Split response into reasoning and final answer for better thinking display
        const lines = responseContent.split('\n');
        let reasoningEnd = -1;
        
        // Find where reasoning likely ends (look for conclusion patterns)
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]?.toLowerCase() || '';
          if (line.includes('therefore') || line.includes('in conclusion') || 
              line.includes('so the answer') || line.includes('final answer') ||
              line.includes('the result is') || line.includes('to summarize') ||
              (i > 2 && line.trim().length > 40 && !line.includes('step') && 
               !line.includes('consider') && !line.includes('analyze') && 
               !line.includes('examine'))) {
            reasoningEnd = i;
            break;
          }
        }
        
        if (reasoningEnd > 0) {
          const reasoningPart = lines.slice(0, reasoningEnd).join('\n');
          const answerPart = lines.slice(reasoningEnd).join('\n');
          
          // Stream reasoning with explicit markers
          yield '<thinking>\n';
          for (const char of reasoningPart) {
            yield char;
            await new Promise(resolve => setTimeout(resolve, 12));
          }
          yield '\n</thinking>\n\n';
          
          // Stream the final answer
          for (const char of answerPart) {
            yield char;
            await new Promise(resolve => setTimeout(resolve, 8));
          }
        } else {
          // Stream the response character by character to simulate streaming
          for (const char of responseContent) {
            yield char;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      } else {
        // Use streaming for other models
        const stream = await this.openai.chat.completions.create({
          messages,
          model: this.model,
          max_tokens: this.responseBudget,
          stream: true,
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            yield content;
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
      
      // Filter models to show only those with "gpt" or starting with "o"
      const filteredModels = models.data.filter((model) => {
        const modelId = model.id.toLowerCase();
        return modelId.includes('gpt') || modelId.startsWith('o');
      });

      // Prioritize reasoning models (o3 > o1 > gpt-4o)
      filteredModels.sort((a, b) => {
        const aIsO3 = a.id.startsWith('o3');
        const bIsO3 = b.id.startsWith('o3');
        const aIsO1 = a.id.startsWith('o1');
        const bIsO1 = b.id.startsWith('o1');
        
        if (aIsO3 && !bIsO3) return -1;
        if (!aIsO3 && bIsO3) return 1;
        if (aIsO1 && !bIsO1) return -1;
        if (!aIsO1 && bIsO1) return 1;
        return 0;
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

  setBudgets(thinkingBudget: number, responseBudget: number): void {
    // Note: OpenAI models (o1/o3) handle thinking internally, no direct API control
    // We store thinkingBudget for interface consistency but don't use it in API calls
    this.thinkingBudget = thinkingBudget;
    this.responseBudget = responseBudget;
    
    // Log the budget settings for debugging
    console.debug(`OpenAI budgets set: thinking=${this.thinkingBudget}, response=${this.responseBudget}`);
  }
}
