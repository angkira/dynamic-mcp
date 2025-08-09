import { defineStore } from 'pinia'

export type NotifyKind = 'info' | 'success' | 'warning' | 'error'
export interface NotifyItem {
  id: number
  kind: NotifyKind
  title: string
  content?: string
  duration?: number
}

export const useNotifyStore = defineStore('notify', () => {
  const queue: NotifyItem[] = []

  function push(kind: NotifyKind, title: string, content?: string, duration?: number) {
    queue.push({ id: Date.now() + Math.random(), kind, title, content, duration })
  }

  function take(): NotifyItem | undefined {
    return queue.shift()
  }

  // convenience
  const info = (title: string, content?: string, duration?: number) => push('info', title, content, duration)
  const success = (title: string, content?: string, duration?: number) => push('success', title, content, duration)
  const warning = (title: string, content?: string, duration?: number) => push('warning', title, content, duration)
  const error = (title: string, content?: string, duration?: number) => push('error', title, content, duration)

  return { queue, push, take, info, success, warning, error }
})


