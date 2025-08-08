<template>
  <div class="login-container">
    <n-card class="login-card" :bordered="false">
      <template #header>
        <div class="login-header">
          <h1>Dynamic MCP</h1>
          <p>Sign in to continue</p>
        </div>
      </template>

      <!-- Demo Login Section -->
      <div class="demo-section">
        <n-alert type="info" :show-icon="false" class="demo-alert">
          <template #default>
            <strong>Demo Mode Available</strong>
            <p>Skip the login form and try the demo with pre-configured credentials.</p>
          </template>
        </n-alert>

        <n-button type="primary" size="large" block :loading="userStore.isLoading && isDemoLogin"
          :disabled="userStore.isLoading" @click="handleDemoLogin" class="demo-button">
          <template #icon>
            <n-icon>
              <FontAwesomeIcon icon="play" />
            </n-icon>
          </template>
          Try Demo
        </n-button>
      </div>

      <n-divider>
        <span class="divider-text">or sign in with credentials</span>
      </n-divider>

      <!-- Login Form -->
      <n-form ref="formRef" :model="formData" :rules="formRules" size="large" :disabled="userStore.isLoading"
        @submit.prevent="handleSubmit">
        <n-form-item path="email" label="Email">
          <n-input v-model:value="formData.email" type="text" placeholder="Enter your email"
            :input-props="{ autocomplete: 'email' }" @keyup.enter="handleSubmit">
            <template #prefix>
              <n-icon>
                <FontAwesomeIcon icon="envelope" />
              </n-icon>
            </template>
          </n-input>
        </n-form-item>

        <n-form-item path="password" label="Password">
          <n-input v-model:value="formData.password" type="password" show-password-on="click"
            placeholder="Enter your password" :input-props="{ autocomplete: 'current-password' }"
            @keyup.enter="handleSubmit">
            <template #prefix>
              <n-icon>
                <FontAwesomeIcon icon="lock" />
              </n-icon>
            </template>
          </n-input>
        </n-form-item>

        <!-- Error Display -->
        <n-alert v-if="userStore.error && !isDemoLogin" type="error" :show-icon="true" closable class="error-alert"
          @close="clearError">
          {{ userStore.error }}
        </n-alert>

        <!-- Demo Error Display -->
        <n-alert v-if="userStore.error && isDemoLogin" type="error" :show-icon="true" closable class="error-alert"
          @close="clearError">
          {{ userStore.error }}
        </n-alert>

        <n-form-item>
          <n-button type="primary" size="large" block :loading="userStore.isLoading && !isDemoLogin"
            :disabled="userStore.isLoading" attr-type="submit" @click="handleSubmit">
            <template #icon>
              <n-icon>
                <FontAwesomeIcon icon="sign-in-alt" />
              </n-icon>
            </template>
            Sign In
          </n-button>
        </n-form-item>

        <n-form-item>
          <n-button tertiary size="large" block :disabled="userStore.isLoading" @click="handleSignup">
            <template #icon>
              <n-icon>
                <FontAwesomeIcon icon="plus" />
              </n-icon>
            </template>
            Create Account
          </n-button>
        </n-form-item>
      </n-form>

      <n-divider>
        <span class="divider-text">or continue with</span>
      </n-divider>

      <n-space :wrap="false" :size="12">
        <n-button type="default" block @click="oauth('google')">
          <template #icon>
            <n-icon>
              <FontAwesomeIcon :icon="['fab', 'google']" />
            </n-icon>
          </template>
          Google
        </n-button>
        <n-button type="default" block @click="oauth('github')">
          <template #icon>
            <n-icon>
              <FontAwesomeIcon :icon="['fab', 'github']" />
            </n-icon>
          </template>
          GitHub
        </n-button>
      </n-space>

      <!-- Demo Credentials Info -->
      <n-collapse class="demo-info">
        <n-collapse-item title="Demo Credentials" name="demo-creds">
          <n-space vertical>
            <n-text depth="3">For testing purposes, you can use:</n-text>
            <n-code word-wrap>
              Email: demo@example.com<br />
              Password: demo123
            </n-code>
            <n-text depth="3" italic> Or simply click "Try Demo" for instant access. </n-text>
          </n-space>
        </n-collapse-item>
      </n-collapse>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NAlert,
  NDivider,
  NIcon,
  NCollapse,
  NCollapseItem,
  NSpace,
  NText,
  NCode,
  type FormInst,
  type FormRules,
  useMessage,
} from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useUserStore } from '@/stores/user'
import type { LoginCredentials } from '@/services/auth'

const router = useRouter()
const userStore = useUserStore()
const message = useMessage()

// Form handling
const formRef = ref<FormInst | null>(null)
const isDemoLogin = ref(false)

const formData = reactive<LoginCredentials>({
  email: '',
  password: '',
})

const formRules: FormRules = {
  email: [
    {
      required: true,
      message: 'Email is required',
      trigger: ['input', 'blur'],
    },
    {
      type: 'email',
      message: 'Please enter a valid email address',
      trigger: ['input', 'blur'],
    },
  ],
  password: [
    {
      required: true,
      message: 'Password is required',
      trigger: ['input', 'blur'],
    },
    {
      min: 6,
      message: 'Password must be at least 6 characters',
      trigger: ['input', 'blur'],
    },
  ],
}

// Actions
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    isDemoLogin.value = false
    await userStore.login(formData)

    message.success('Login successful!')

    // Redirect to main app
    const redirect = router.currentRoute.value.query.redirect as string
    await router.push(redirect || '/')
  } catch (error) {
    console.error('Login failed:', error)
    // Error is already handled by the store
  }
}

const handleDemoLogin = async () => {
  try {
    isDemoLogin.value = true
    await userStore.loginDemo()

    message.success('Demo login successful!')

    // Redirect to main app
    const redirect = router.currentRoute.value.query.redirect as string
    await router.push(redirect || '/')
  } catch (error) {
    console.error('Demo login failed:', error)
    // Error is already handled by the store
  } finally {
    isDemoLogin.value = false
  }
}

const clearError = () => {
  userStore.error = null
}

// Auto-fill demo credentials for convenience
const fillDemoCredentials = () => {
  formData.email = 'demo@example.com'
  formData.password = 'demo123'
}

// Signup action
const handleSignup = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    await userStore.signup({ ...formData })
    message.success('Account created!')
    const redirect = router.currentRoute.value.query.redirect as string
    await router.push(redirect || '/')
  } catch (error) {
    console.error('Signup failed:', error)
  }
}

// OAuth start
const oauth = async (provider: 'google' | 'github') => {
  try {
    await userStore.loginWithOAuth(provider)
  } catch (e) { }
}

// Check if user is already authenticated on mount
onMounted(() => {
  if (userStore.initializeFromStorage()) {
    // User is already authenticated, redirect
    const redirect = router.currentRoute.value.query.redirect as string
    router.push(redirect || '/')
  }
  // If redirected from OAuth with a token, apply it then redirect
  const token = router.currentRoute.value.query.token as string
  if (token) {
    userStore.applyTokenFromUrl(token)
    message.success('Logged in!')
    const redirect = router.currentRoute.value.query.redirect as string
    router.replace({ path: redirect || '/' })
  }
})
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
}

.login-card {
  width: 100%;
  max-width: 450px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  border-radius: 16px;
  overflow: hidden;
}

.login-header {
  text-align: center;
  margin-bottom: 1rem;
}

.login-header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.login-header p {
  margin: 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.demo-section {
  margin-bottom: 1.5rem;
}

.demo-alert {
  margin-bottom: 1rem;
}

.demo-alert p {
  margin: 0.25rem 0 0 0;
  font-size: 0.875rem;
}

.demo-button {
  height: 48px;
  font-weight: 500;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
}

.demo-button:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
}

.divider-text {
  color: #9ca3af;
  font-size: 0.875rem;
  padding: 0 1rem;
  background: white;
}

.error-alert {
  margin-bottom: 1rem;
}

.demo-info {
  margin-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
}

:deep(.n-card-header) {
  padding-bottom: 0;
}

:deep(.n-form-item-label) {
  font-weight: 500;
  color: #374151;
}

:deep(.n-input) {
  border-radius: 8px;
}

:deep(.n-button) {
  border-radius: 8px;
  font-weight: 500;
}

:deep(.n-collapse .n-collapse-item .n-collapse-item__header) {
  padding: 0.75rem 0;
  font-size: 0.875rem;
}

:deep(.n-collapse .n-collapse-item .n-collapse-item__content-wrapper .n-collapse-item__content-inner) {
  padding: 0.75rem 0;
}

/* Responsive design */
@media (max-width: 640px) {
  .login-container {
    padding: 1rem;
  }

  .login-card {
    max-width: 100%;
  }

  .login-header h1 {
    font-size: 1.75rem;
  }
}
</style>
