import { defineStore } from 'pinia'
import { NotificationLevel } from '@dynamic-mcp/shared'
export interface NotifyItem {
  id: number
  kind: NotificationLevel
  title: string
  content?: string
  duration?: number
}

export const useNotifyStore = defineStore('notify', () => {
  const queue: NotifyItem[] = []

  function push(kind: NotificationLevel, title: string, content?: string, duration?: number) {
    queue.push({ id: Date.now() + Math.random(), kind, title, content, duration })
  }

  function take(): NotifyItem | undefined {
    return queue.shift()
  }

  // convenience
  const info = (title: string, content?: string, duration?: number) => push(NotificationLevel.Info, title, content, duration)
  const success = (title: string, content?: string, duration?: number) => push(NotificationLevel.Success, title, content, duration)
  const warning = (title: string, content?: string, duration?: number) => push(NotificationLevel.Warning, title, content, duration)
  const error = (title: string, content?: string, duration?: number) => push(NotificationLevel.Error, title, content, duration)

  return { queue, push, take, info, success, warning, error }
})


