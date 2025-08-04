"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerWebSocketEvent = exports.ClientWebSocketEvent = void 0;
var ClientWebSocketEvent;
(function (ClientWebSocketEvent) {
    ClientWebSocketEvent["SendMessage"] = "sendMessage";
})(ClientWebSocketEvent || (exports.ClientWebSocketEvent = ClientWebSocketEvent = {}));
var ServerWebSocketEvent;
(function (ServerWebSocketEvent) {
    ServerWebSocketEvent["ChatId"] = "chatId";
    ServerWebSocketEvent["UserMessage"] = "userMessage";
    ServerWebSocketEvent["Reasoning"] = "reasoning";
    ServerWebSocketEvent["Code"] = "code";
    ServerWebSocketEvent["MessageChunk"] = "messageChunk";
    ServerWebSocketEvent["ToolCall"] = "toolCall";
    ServerWebSocketEvent["ToolResult"] = "toolResult";
    ServerWebSocketEvent["Title"] = "title";
    ServerWebSocketEvent["Complete"] = "complete";
    ServerWebSocketEvent["Error"] = "error";
})(ServerWebSocketEvent || (exports.ServerWebSocketEvent = ServerWebSocketEvent = {}));
//# sourceMappingURL=websocketEvents.js.map