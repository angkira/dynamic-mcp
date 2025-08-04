import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url))
    },
  },
  optimizeDeps: {
    exclude: ['@shared']
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // Use modern Sass API
        additionalData: `@use "@/assets/styles/variables" as *; @use "@/assets/styles/mixins" as *;`
      }
    }
  },
  server: {
    // Fix MIME type issues for Firefox
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control'
    },
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..']
    }
  }
})
