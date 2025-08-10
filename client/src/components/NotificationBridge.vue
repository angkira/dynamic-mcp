<script setup lang="ts">
import { onMounted } from 'vue'
import { useNotification } from 'naive-ui'
import { useNotifyStore } from '@/stores/notify'

const notification = useNotification()
const notify = useNotifyStore()

onMounted(() => {
  const pump = () => {
    let item = notify.take()
    while (item) {
      const { kind, title, content, duration } = item
      const isError = kind === 'error' || kind === 'Error'
      const isWarn = kind === 'warning' || kind === 'Warning'
      const dur = duration ?? (isError ? 5000 : 3000)
      const method = (String(kind).toLowerCase() as any)
      notification[method]({ title, content, duration: dur, keepAliveOnHover: true })
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
