<script setup lang="ts">
import { onMounted } from 'vue'
import { useNotification } from 'naive-ui'
import { useNotifyStore } from '@/stores/notify'
import { NotificationLevel } from '@dynamic-mcp/shared'

const notification = useNotification()
const notify = useNotifyStore()

onMounted(() => {
  const pump = () => {
    let item = notify.take()
    while (item) {
      const { kind, title, content, duration } = item
      const isError = kind === NotificationLevel.Error
      const dur = duration ?? (isError ? 5000 : 3000)

      if (kind === NotificationLevel.Error) {
        notification.error({ title, content, duration: dur, keepAliveOnHover: true })
      } else if (kind === NotificationLevel.Warning) {
        notification.warning({ title, content, duration: dur, keepAliveOnHover: true })
      } else if (kind === NotificationLevel.Success) {
        notification.success({ title, content, duration: dur, keepAliveOnHover: true })
      } else {
        notification.info({ title, content, duration: dur, keepAliveOnHover: true })
      }

      item = notify.take()
    }
    requestAnimationFrame(pump)
  }
  requestAnimationFrame(pump)
})
</script>

<template>
  <!-- Headless bridge component -->
  <div style="display: none" />

</template>
