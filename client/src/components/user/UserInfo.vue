<template>
  <div class="user-info">
    <div class="user-avatar">{{ initials }}</div>
    <div v-if="expanded" class="user-details">
      <div class="user-name">{{ displayName || 'User' }}</div>
      <div class="user-email">{{ email }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name?: string | null
  email: string
  initials?: string
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: undefined,
  email: '',
  initials: '',
  expanded: true
})

const displayName = computed(() => props.name?.trim())

const initials = computed(() => {
  if (props.initials) return props.initials
  const base = props.name?.trim() || props.email
  const parts = base.split(' ').filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
})

const expanded = computed(() => !!props.expanded)
</script>

<style lang="scss" scoped>
.user-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  min-width: 0;
}

.user-avatar {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  background-color: var(--color-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 500;
  flex-shrink: 0;
}

.user-details {
  min-width: 0;
}

.user-name {
  font-size: 1rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-email {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
