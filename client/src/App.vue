<script setup lang="ts">
import { onMounted } from 'vue'

// Initialize dark mode support
onMounted(() => {
  // Add dark class to HTML element if system prefers dark mode
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark')
  }
})
</script>

<template>
  <div id="app">
    <RouterView />
  </div>
</template>

<style lang="scss">
@use '@/assets/styles/main.scss';
</style>
