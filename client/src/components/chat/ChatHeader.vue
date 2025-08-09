<template>
  <header class="chat-header">
    <div class="header-content">
      <!-- Mobile Menu Button -->
      <button v-if="ui.isMobile" @click="ui.toggleSidebar" class="mobile-menu-btn" aria-label="Toggle sidebar">
        <FontAwesomeIcon icon="bars" class="mobile-menu-icon" />
      </button>

      <h1 class="chat-title">{{ chats?.currentChat?.title || 'Chat' }}</h1>

      <!-- Model Selector -->
      <div class="model-selector-container" v-if="models.availableModels.length > 0">
        <n-select :value="currentModelValue" :options="modelOptions as any" @update:value="handleModelSelect"
          placeholder="Select model" :render-label="renderModelLabel" :render-tag="renderSelectedTag"
          class="model-select">
        </n-select>
      </div>

      <!-- Actions -->
      <div class="header-actions">
        <button @click="chats.createNewChat" class="action-btn" title="New Chat">
          <FontAwesomeIcon icon="plus" class="new-chat-icon" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { useUIStore } from '@/stores/ui'
import { useModelStore } from '@/stores/models'
import { useChatsStore } from '@/stores/chats'
import { NSelect } from 'naive-ui'

const ui = useUIStore()
const models = useModelStore()
const chats = useChatsStore()

const modelOptions = computed(() => {
  return models.availableModels.map(group => {
    return {
      label: group.provider,
      type: 'group' as const,
      key: group.provider,
      children: group.models.map(model => ({
        label: model.name,
        value: model.id
      }))
    }
  })
})

const currentModelValue = computed(() => {
  return models.currentModel
})

function selectModel(provider: string, model: string) {
  models.setSelectedModel(provider, model)
  ui.closeModelSelector()
}

function handleModelSelect(value: string) {
  selectModel(models.currentProvider, value)
}

function renderModelLabel(option: any) {
  // For group headers, just return the label
  if (option.type === 'group') {
    return h('span', {}, option.label)
  }

  // For individual options, just return the model name since the group shows the provider
  return h('span', {}, option.label)
}

function renderSelectedTag({ option }: { option: any }) {
  // For the selected value display, show provider and model in two lines
  return h('span', {}, option.label)
}
</script>

<style lang="scss" scoped>
.chat-header {
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  padding: var(--spacing-md);
  flex-shrink: 0;
  z-index: 10;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 100%;
}

.mobile-menu-btn {
  @include button-secondary;
  padding: var(--spacing-sm);
  color: var(--color-text-secondary);

  &:hover {
    background-color: var(--color-surface);
  }
}

.mobile-menu-icon {
  @include icon-lg;
}

.chat-title {
  max-width: 30rem;
  color: var(--color-primary);
  font-size: 1.125rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-selector-container {
  flex: 1;
  max-width: 20rem;
  margin: 0 var(--spacing-md);
  position: relative;
}

.model-select {
  width: 100%;

  :deep(.n-base-selection) {
    background-color: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);

    &:hover {
      background-color: var(--color-border-light);
    }

    &.n-base-selection--focused {
      background-color: var(--color-primary-light);
      border-color: var(--color-primary);
    }
  }

  :deep(.n-base-selection-label) {
    font-size: 0.875rem;
    padding: var(--spacing-sm) var(--spacing-md);
  }
}

.model-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}

.provider {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.model {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.action-btn {
  @include button-secondary;
  padding: var(--spacing-sm);
  color: var(--color-text-secondary);

  &:hover {
    background-color: var(--color-surface);
  }
}

.new-chat-icon {
  @include icon-md;
}
</style>