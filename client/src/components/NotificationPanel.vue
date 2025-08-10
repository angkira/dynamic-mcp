<template>
  <transition name="notif-panel">
    <div v-if="open" class="notif-panel">
      <div v-for="item in displayQueue" :key="item.id" class="notif-item" :class="String(item.kind).toLowerCase()">
        <div class="notif-header" @click="$emit('toggle-expand', item.id)">
          <FontAwesomeIcon :icon="kindIcon(item.kind as any)" class="notif-icon" />
          <div class="notif-title">{{ item.title }}</div>
          <button class="notif-close" @click.stop="$emit('remove', item.id)">
            <FontAwesomeIcon icon="xmark" />
          </button>
        </div>
        <div v-if="expandedIds.has(item.id) && item.content" class="notif-content">{{ item.content }}</div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNotifyStore, type NotifyItem } from '@/stores/notify'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { NotificationLevel } from '@/types'

interface Props {
  open: boolean
  expandedIds: Set<number>
}
const props = defineProps<Props>()
defineEmits<{
  'toggle-expand': [id: number]
  remove: [id: number]
}>()

const notify = useNotifyStore()
const displayQueue = computed<NotifyItem[]>(() => notify.queue.slice(-10))

function kindIcon(kind: NotificationLevel) {
  if (kind === NotificationLevel.Error) return 'triangle-exclamation'
  if (kind === NotificationLevel.Warning) return 'circle-exclamation'
  if (kind === NotificationLevel.Success) return 'circle-check'
  return 'circle-info'
}
</script>

<style scoped lang="scss">
.notif-panel-enter-active,
.notif-panel-leave-active {
  transition: all 0.2s ease;
}

.notif-panel-enter-from,
.notif-panel-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.notif-panel {
  position: absolute;
  left: 0;
  bottom: calc(100% + 8px);
  width: 320px;
  max-height: 40vh;
  overflow: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: 8px;
}

.notif-item {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  margin-bottom: 8px;
  background: var(--color-surface);
}

.notif-item.success {
  border-left: 3px solid var(--color-success);
}

.notif-item.warning {
  border-left: 3px solid var(--color-warning);
}

.notif-item.error {
  border-left: 3px solid var(--color-danger);
}

.notif-item.info {
  border-left: 3px solid var(--color-primary);
}

.notif-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}

.notif-icon {
  @include icon-sm;
  color: var(--color-text-muted);
}

.notif-title {
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
}

.notif-close {
  @include button-ghost;
  color: var(--color-text-muted);
}

.notif-content {
  padding: 0 8px 8px 32px;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}
</style>
