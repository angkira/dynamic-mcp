export enum ClientWebSocketEvent {
  SendMessage = 'sendMessage',
}

export enum ServerWebSocketEvent {
  ChatId = 'chatId',
  UserMessage = 'userMessage',
  Reasoning = 'reasoning',
  Code = 'code',
  MessageChunk = 'messageChunk',
  ToolCall = 'toolCall',
  ToolResult = 'toolResult',
  Title = 'title',
  MessageComplete = 'messageComplete',
  Error = 'error',
}