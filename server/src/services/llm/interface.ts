export enum LlmProvider {
  OpenAI = 'openai',
  Gemini = 'gemini',
}

export interface LlmService {
  sendMessage(message: string): Promise<string>;
  getModels(): Promise<{ provider: string; model: string }[]>;
  setModel(model: string): void;
}
