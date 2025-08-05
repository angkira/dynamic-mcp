<script setup lang="ts">
import { onMounted } from 'vue'
import {
  NMessageProvider,
  NLoadingBarProvider,
  NDialogProvider,
  NNotificationProvider,
  NConfigProvider,
  darkTheme,
  type GlobalTheme,
} from 'naive-ui'
import { useUserStore } from '@/stores/user'

// Theme configuration
const theme: GlobalTheme | null = null // Use light theme by default

const userStore = useUserStore()

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
    <NConfigProvider :theme="theme">
      <NLoadingBarProvider>
        <NDialogProvider>
          <NNotificationProvider>
            <NMessageProvider>
              <RouterView />
            </NMessageProvider>
          </NNotificationProvider>
        </NDialogProvider>
      </NLoadingBarProvider>
    </NConfigProvider>
  </div>
</template>

<style lang="scss">
@use '@/assets/styles/main.scss';
</style>
