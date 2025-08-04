"use strict";
/**
 * Message-related types and interfaces
 * Shared between client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingChunkType = void 0;
/**
 * Streaming-related types for real-time message processing
 */
var StreamingChunkType;
(function (StreamingChunkType) {
    StreamingChunkType["Thought"] = "thought";
    StreamingChunkType["Code"] = "code";
    StreamingChunkType["Reasoning"] = "reasoning";
    StreamingChunkType["Title"] = "title";
    StreamingChunkType["ChatId"] = "chatId";
    StreamingChunkType["UserMessage"] = "userMessage";
    StreamingChunkType["Complete"] = "complete";
    StreamingChunkType["Error"] = "error";
    StreamingChunkType["MessageChunk"] = "messageChunk";
    StreamingChunkType["ToolCall"] = "toolCall";
    StreamingChunkType["ToolResult"] = "toolResult";
})(StreamingChunkType || (exports.StreamingChunkType = StreamingChunkType = {}));
//# sourceMappingURL=message.js.map