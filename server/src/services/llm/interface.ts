export enum LlmProvider {
  OpenAI = 'openai',
  Gemini = 'google',
}

// Type for message from database
export interface ConversationMessage {
  id: number
  content: any // JsonB field from database
  role: 'USER' | 'AI'
  chatId: number
  createdAt: Date
  updatedAt: Date
}

export interface LlmService {
  sendMessage(message: string): Promise<string>
  sendMessageStream(message: string): AsyncIterable<string>
  sendMessageStreamWithHistory(message: string, history: ConversationMessage[]): AsyncIterable<string>
  getModels(): Promise<{ provider: string; model: string }[]>
  setModel(model: string): void
}
