/**
 * LLM-related types and interfaces
 * Shared between client and server
 */
export declare enum LlmProvider {
    OpenAI = "openai",
    Google = "google",
    Anthropic = "anthropic",
    DeepSeek = "deepseek",
    Qwen = "qwen"
}
/**
 * Message roles as defined in the database schema
 * Note: We use the same values as Prisma's MessageRole enum
 */
export declare enum MessageRole {
    USER = "USER",
    AI = "AI",
    TOOL = "TOOL"
}
/**
 * Base conversation message interface aligned with database schema
 */
export interface ConversationMessage {
    id: number;
    content: any;
    role: MessageRole;
    chatId: number;
    createdAt: Date;
    updatedAt: Date;
    thoughts?: any;
}
/**
 * LLM service interface for server-side implementations
 */
export interface LlmService {
    sendMessage(message: string): Promise<string>;
    sendMessageStream(message: string): AsyncIterable<string>;
    sendMessageStreamWithHistory(message: string, history: ConversationMessage[]): AsyncIterable<string>;
    sendMessageStreamWithTools(message: string, history: ConversationMessage[], tools: any[], isThinking?: boolean): AsyncIterable<any>;
    getModels(): Promise<{
        provider: string;
        model: string;
    }[]>;
    setModel(model: string): void;
    setBudgets(responseBudget: number): void;
    formatTools(tools: any[]): any[];
}
/**
 * Streaming chunk types for real-time communication
 */
export interface StreamingChunk {
    type: 'text' | 'toolCall' | 'thought' | 'reasoning' | 'code';
    content?: string;
    call?: {
        name: string;
        arguments: any;
    };
}
//# sourceMappingURL=llm.d.ts.map