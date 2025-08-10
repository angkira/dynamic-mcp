/**
 * WebSocket event types
 * For build compatibility, these are declared locally
 */

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
  DomainEvent = 'domainEvent',
  Notification = 'notification',
}

// Domain event scopes
export enum DomainEventScope {
  MCP = 'MCP',
}

// MCP-specific domain events
export enum MCPDomainEventType {
  ServerCreated = 'MCP_SERVER_CREATED',
  ServerUpdated = 'MCP_SERVER_UPDATED',
  ServerDeleted = 'MCP_SERVER_DELETED',
  ServerStatusChanged = 'MCP_SERVER_STATUS_CHANGED',
}

export interface MCPDomainEventPayload {
  scope: DomainEventScope.MCP;
  type: MCPDomainEventType;
  payload: Record<string, unknown>;
}

export type DomainEventPayload = MCPDomainEventPayload;

// Notification enums
export enum NotificationScope {
  MCP = 'MCP',
  System = 'SYSTEM',
  Chat = 'CHAT',
}

export enum NotificationLevel {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export interface NotificationEventPayload {
  scope: NotificationScope;
  level: NotificationLevel;
  title: string;
  message?: string;
  meta?: Record<string, unknown>;
}