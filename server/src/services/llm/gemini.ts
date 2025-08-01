import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LlmService } from './interface';

export class GeminiService implements LlmService {
  private genAI: GoogleGenerativeAI;
  private model = 'gemini-2.5-flash-lite';

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
  }

  async sendMessage(message: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.model });
    const result = await model.generateContent(message);
    const response = await result.response;
    
    return response.text();
  }

  async getModels(): Promise<{ provider: string; model: string }[]> {
    // The Google Generative AI API does not currently support listing models.
    // We will return a hardcoded list of a few popular models for now.
    return Promise.resolve([
      { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
      { provider: 'gemini', model: 'gemini-2.0-flash' },
      { provider: 'gemini', model: 'gemini-2.5-pro-exp' },
      { provider: 'gemini', model: 'gemini-2.5-pro' },
    ]);
  }

  setModel(model: string): void {
    this.model = model;
  }
}
