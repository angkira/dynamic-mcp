<template>
  <div class="login-container">
    <n-card class="login-card" :bordered="false">
      <template #header>
        <div class="login-header">
          <h1>Create your account</h1>
          <p>Sign up to get started</p>
        </div>
      </template>

      <n-form ref="formRef" :model="formData" :rules="formRules" size="large" :disabled="userStore.isLoading"
        @submit.prevent="handleSubmit">
        <n-form-item path="name" label="Name">
          <n-input v-model:value="formData.name" type="text" placeholder="Your name">
            <template #prefix>
              <n-icon>
                <FontAwesomeIcon icon="user" />
              </n-icon>
            </template>
          </n-input>
        </n-form-item>
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
            placeholder="Create a password" :input-props="{ autocomplete: 'new-password' }" @keyup.enter="handleSubmit">
            <template #prefix>
              <n-icon>
                <FontAwesomeIcon icon="lock" />
              </n-icon>
            </template>
          </n-input>
        </n-form-item>

        <n-alert v-if="userStore.error" type="error" :show-icon="true" closable class="error-alert" @close="clearError">
          {{ userStore.error }}
        </n-alert>

        <n-form-item>
          <n-button type="primary" size="large" block :loading="userStore.isLoading" :disabled="userStore.isLoading"
            attr-type="submit" @click="handleSubmit">
            <template #icon>
              <n-icon>
                <FontAwesomeIcon icon="user-plus" />
              </n-icon>
            </template>
            Create Account
          </n-button>
        </n-form-item>

        <n-form-item>
          <n-button tertiary size="large" block :disabled="userStore.isLoading" @click="goToLogin">
            <template #icon>
              <n-icon>
                <FontAwesomeIcon icon="sign-in-alt" />
              </n-icon>
            </template>
            Have an account? Sign in
          </n-button>
        </n-form-item>
      </n-form>
    </n-card>
  </div>

</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, NIcon, type FormInst, type FormRules, useMessage } from 'naive-ui'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { useUserStore } from '@/stores/user'
import type { SignupPayload } from '@/services/auth'

const router = useRouter()
const userStore = useUserStore()
const message = useMessage()
const formRef = ref<FormInst | null>(null)

const formData = reactive<SignupPayload>({ email: '', password: '', name: '' })

const formRules: FormRules = {
  name: [{ required: false }],
  email: [
    { required: true, message: 'Email is required', trigger: ['input', 'blur'] },
    { type: 'email', message: 'Please enter a valid email address', trigger: ['input', 'blur'] }
  ],
  password: [
    { required: true, message: 'Password is required', trigger: ['input', 'blur'] },
    { min: 6, message: 'Password must be at least 6 characters', trigger: ['input', 'blur'] }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    await userStore.signup({ ...formData })
    message.success('Account created!')
    const redirect = (router.currentRoute.value.query.redirect as string) || '/'
    await router.push(redirect)
  } catch (error) {
    // handled in store
  }
}

const goToLogin = () => router.push({ name: 'login' })

const clearError = () => { userStore.error = null }
</script>

<style lang="scss" scoped>
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

.error-alert {
  margin-bottom: 1rem;
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

/* Responsive */
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
