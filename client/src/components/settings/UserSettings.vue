<template>
  <div class="user-settings">
    <n-space vertical :size="24">
      <!-- Profile -->
      <div class="setting-group">
        <h3 class="setting-title">Profile</h3>
        <n-form :model="profile" label-placement="left" :show-require-mark="false">
          <n-form-item label="Name">
            <n-input v-model:value="profile.name" placeholder="Your name" />
          </n-form-item>
          <n-form-item label="Email">
            <n-input v-model:value="profile.email" placeholder="you@example.com" />
          </n-form-item>
          <n-space>
            <n-button type="primary" :loading="savingProfile" @click="saveProfile">Save Profile</n-button>
          </n-space>
        </n-form>
      </div>

      <n-divider />

      <!-- Password -->
      <div class="setting-group">
        <h3 class="setting-title">Password</h3>
        <n-alert v-if="!hasPassword" type="info" :show-icon="true" class="mb-2">
          This account was created via OAuth. You can set a password below to enable password login.
        </n-alert>
        <n-form :model="passwordForm" label-placement="left" :show-require-mark="false">
          <n-form-item v-if="hasPassword" label="Current Password">
            <n-input v-model:value="passwordForm.currentPassword" type="password" placeholder="Current password" />
          </n-form-item>
          <n-form-item label="New Password">
            <n-input v-model:value="passwordForm.newPassword" type="password" placeholder="New password (min 6)" />
          </n-form-item>
          <n-space>
            <n-button type="primary" :loading="savingPassword" :disabled="!passwordForm.newPassword"
              @click="changePassword">Update Password</n-button>
          </n-space>
        </n-form>
      </div>

      <n-divider />

      <!-- Provider API Keys -->
      <div class="setting-group">
        <h3 class="setting-title">Provider API Keys</h3>
        <p class="setting-description">Add API keys for providers you want to use. Models are shown only for providers
          with a key.</p>
        <n-space vertical :size="12">
          <n-form-item label="Google (Gemini) API Key" label-placement="left">
            <n-input v-model:value="localSettings.googleApiKey" type="password" placeholder="Enter Google API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="OpenAI API Key" label-placement="left">
            <n-input v-model:value="localSettings.openaiApiKey" type="password" placeholder="Enter OpenAI API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="Anthropic API Key" label-placement="left">
            <n-input v-model:value="localSettings.anthropicApiKey" type="password" placeholder="Enter Anthropic API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="DeepSeek API Key" label-placement="left">
            <n-input v-model:value="localSettings.deepseekApiKey" type="password" placeholder="Enter DeepSeek API key"
              @change="onKeyChanged" />
          </n-form-item>
          <n-form-item label="Qwen API Key" label-placement="left">
            <n-input v-model:value="localSettings.qwenApiKey" type="password" placeholder="Enter Qwen API key"
              @change="onKeyChanged" />
          </n-form-item>
        </n-space>
      </div>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NForm, NFormItem, NInput, NSpace, NButton, NDivider, NAlert, useMessage } from 'naive-ui'
import { useSettingsStore } from '@/stores/settings'
import { useUserStore } from '@/stores/user'
import { useModelStore } from '@/stores/models'

const message = useMessage()
const settingsStore = useSettingsStore()
const userStore = useUserStore()
const modelStore = useModelStore()

// Local copy of settings for API keys
const localSettings = computed({
  get: () => settingsStore.settings,
  set: (value) => settingsStore.updateSettings(value as any)
})

// Profile state
const profile = ref<{ name?: string; email: string }>({ name: '', email: '' })
const hasPassword = ref<boolean>(true)
const savingProfile = ref(false)
const savingPassword = ref(false)

async function loadMe() {
  try {
    const { hasPassword: hp } = await userStore.fetchMe()
    profile.value = { name: userStore.user?.name, email: userStore.user?.email || '' }
    hasPassword.value = hp
  } catch (e) { /* ignore */ }
}

async function saveProfile() {
  savingProfile.value = true
  try {
    await userStore.updateProfile({ name: profile.value.name, email: profile.value.email })
    message.success('Profile updated')
    // Refresh models in case provider defaults changed
    await modelStore.fetchModels()
  } catch (e: any) {
    message.error(e?.message || 'Failed to update profile')
  } finally {
    savingProfile.value = false
  }
}

async function changePassword() {
  savingPassword.value = true
  try {
    await userStore.changePassword(passwordForm.value)
    passwordForm.value = { currentPassword: '', newPassword: '' }
    hasPassword.value = true
    message.success('Password updated')
    // Password change does not affect models
  } catch (e: any) {
    message.error(e?.message || 'Failed to update password')
  } finally {
    savingPassword.value = false
  }
}

const passwordForm = ref<{ currentPassword?: string; newPassword: string }>({ currentPassword: '', newPassword: '' })

// When any provider key changes, persist and refresh models
async function onKeyChanged() {
  try {
    const { openaiApiKey, googleApiKey, anthropicApiKey, deepseekApiKey, qwenApiKey } = localSettings.value
    await settingsStore.updateSettings({
      openaiApiKey: openaiApiKey ?? undefined,
      googleApiKey: googleApiKey ?? undefined,
      anthropicApiKey: anthropicApiKey ?? undefined,
      deepseekApiKey: deepseekApiKey ?? undefined,
      qwenApiKey: qwenApiKey ?? undefined,
    })
    // After saving keys, refresh models list to reflect availability
    await modelStore.fetchModels()
  } catch (e) {
    // ignore
  }
}

onMounted(async () => {
  await Promise.all([settingsStore.fetchProviders(), loadMe()])
})
</script>

<style lang="scss" scoped>
.user-settings {
  padding: 16px 0;
}

.setting-group {
  margin-bottom: 24px;
}

.setting-title {
  font-size: 18px;
  font-weight: 600;
  margin: 0 0 8px 0;
}

.setting-description {
  font-size: 14px;
  color: var(--text-color-2);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

.mb-2 {
  margin-bottom: 12px;
}

:deep(.n-form-item) {
  --n-label-width: 120px;
}

:deep(.n-form-item .n-form-item-label) {
  min-width: var(--n-label-width);
  justify-content: flex-start;
}
</style>
