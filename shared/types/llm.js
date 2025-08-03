"use strict";
/**
 * LLM-related types and interfaces
 * Shared between client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRole = exports.LlmProvider = void 0;
var LlmProvider;
(function (LlmProvider) {
    LlmProvider["OpenAI"] = "openai";
    LlmProvider["Google"] = "google";
    LlmProvider["Anthropic"] = "anthropic";
    LlmProvider["DeepSeek"] = "deepseek";
    LlmProvider["Qwen"] = "qwen";
})(LlmProvider || (exports.LlmProvider = LlmProvider = {}));
/**
 * Message roles as defined in the database schema
 * Note: We use the same values as Prisma's MessageRole enum
 */
var MessageRole;
(function (MessageRole) {
    MessageRole["USER"] = "USER";
    MessageRole["AI"] = "AI";
    MessageRole["TOOL"] = "TOOL";
})(MessageRole || (exports.MessageRole = MessageRole = {}));
//# sourceMappingURL=llm.js.map