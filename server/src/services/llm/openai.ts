import OpenAI from 'openai';
import type { LlmService } from './interface';

export class OpenAiService implements LlmService {
  private openai: OpenAI;
  private model = 'o3-mini';

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async sendMessage(message: string): Promise<string> {
    const completion = await this.openai.chat.completions.create({
      messages: [{ role: 'user', content: message }],
      model: this.model,
    });

    if (!completion.choices[0]) {
      return '';
    }

    return completion.choices[0].message.content ?? '';
  }

  async getModels(): Promise<{ provider: string; model: string }[]> {
    const models = await this.openai.models.list();
    return models.data.map((model) => ({
      provider: 'openai',
      model: model.id,
    }));
  }

  setModel(model: string): void {
    this.model = model;
  }
}
