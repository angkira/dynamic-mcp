// Local server-side enums and payload types mirroring shared constants

export enum DomainEventScope {
  MCP = 'MCP',
}

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



