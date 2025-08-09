<template>
  <!-- Overlay mode with fade -->
  <transition name="fade">
    <div v-if="overlay && show" class="overlay" role="status" aria-live="polite">
      <div v-if="type === 'spinner'" class="spinner"></div>
      <WaterCirclesLoading v-else :show="true" />
      <div v-if="text" class="loader-text">{{ text }}</div>
    </div>
  </transition>

  <!-- Inline mode -->
  <div v-if="!overlay && show" class="inline" role="status" aria-live="polite">
    <div v-if="type === 'spinner'" class="spinner"></div>
    <WaterCirclesLoading v-else :show="true" />
    <div v-if="text" class="loader-text">{{ text }}</div>
  </div>

  <slot />
</template>

<script setup lang="ts">
import { withDefaults, defineProps } from 'vue'
import WaterCirclesLoading from '@/components/animations/WaterCirclesLoading.vue'

interface Props {
  show?: boolean
  overlay?: boolean
  text?: string
  type?: 'spinner' | 'water'
}

withDefaults(defineProps<Props>(), {
  show: false,
  overlay: true,
  text: '',
  type: 'spinner'
})
</script>

<style lang="scss" scoped>
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 10;
  border-radius: inherit;
}

.overlay.hidden {
  opacity: 0;
  pointer-events: none;
}

.inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  border: 3px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  width: 24px;
  height: 24px;
  animation: spin 1s linear infinite;
}

.loader-text {
  margin-top: 8px;
  color: var(--color-text);
  font-size: 0.875rem;
}

@keyframes spin {
  0% {
    transform: rotate(0deg)
  }

  100% {
    transform: rotate(360deg)
  }
}
</style>
