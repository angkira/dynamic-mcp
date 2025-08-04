/**
 * Message-related types and interfaces
 * Shared between client and server
 */
import { MessageRole } from './llm';
/**
 * Content structure for messages - flexible metadata support
 */
export interface MessageContent {
    text: string;
    html?: string;
    metadata?: {
        provider?: string;
        model?: string;
        [key: string]: unknown;
    };
    toolCalls?: Array<{
        name: string;
        arguments: any;
    }>;
    name?: string;
    result?: any;
}
/**
 * Message interface for client-side representation
 * Aligned with database schema but with client-friendly types
 */
export interface Message {
    id: number;
    content: MessageContent;
    role: MessageRole;
    chatId: number;
    createdAt: string;
    updatedAt: string;
    thoughts?: any;
}
/**
 * Streaming-related types for real-time message processing
 */
export declare enum StreamingChunkType {
    Thought = "thought",
    Code = "code",
    Reasoning = "reasoning",
    Title = "title",
    ChatId = "chatId",
    UserMessage = "userMessage",
    Complete = "complete",
    Error = "error",
    MessageChunk = "messageChunk",
    ToolCall = "toolCall",
    ToolResult = "toolResult"
}
export interface StreamingChunk {
    text: string;
    type: StreamingChunkType;
    isComplete: boolean;
}
export interface StreamingWord {
    word: string;
    id: string;
    isAnimating: boolean;
}
/**
 * Streaming message state for client-side UI
 */
export interface StreamingMessage {
    content: string;
    html: string;
    words: StreamingWord[];
    currentChunk: StreamingChunk | null;
    isComplete: boolean;
    isStreaming: boolean;
    isThinking: boolean;
    thoughtContent: string;
    thoughtHtml: string;
    insideThoughtTag: boolean;
    thoughtBuffer: string;
    thoughtWords: StreamingWord[];
    thoughtsCompleted: boolean;
    chatTitle: string;
    titleExtracted: boolean;
    chunkCount?: number;
}
//# sourceMappingURL=message.d.ts.map