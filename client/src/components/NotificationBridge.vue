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
      notification[kind]({ title, content, duration: duration ?? (kind === 'error' ? 5000 : 3000), keepAliveOnHover: true })
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
