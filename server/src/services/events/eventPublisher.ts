import type { FastifyInstance } from 'fastify'
import { ServerWebSocketEvent } from '@dynamic-mcp/shared'
import { DomainEventScope, MCPDomainEventType, type NotificationEventPayload, type MCPDomainEventPayload } from '../../constants/notifications'

export class EventPublisher {
  private fastify: FastifyInstance

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
  }

  private getUserRoom(userId: number): string {
    return `user:${userId}`
  }

  public publishMcpEvent(userId: number, type: MCPDomainEventType, payload: Record<string, unknown>) {
    const event: MCPDomainEventPayload = {
      scope: DomainEventScope.MCP,
      type,
      payload,
    }
    try {
      this.fastify.io.to(this.getUserRoom(userId)).emit(ServerWebSocketEvent.DomainEvent, event)
    } catch (error) {
      this.fastify.log.warn('Failed to emit MCP domain event:', { error, type })
    }
  }

  public publishNotification(userId: number, notification: NotificationEventPayload) {
    try {
      this.fastify.io.to(this.getUserRoom(userId)).emit(ServerWebSocketEvent.Notification, notification)
    } catch (error) {
      this.fastify.log.warn('Failed to emit notification:', { error, notification })
    }
  }
}


