<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { userApi } from '../../api/user.js'
import { clearUser } from '../../api/context.js'

const router = useRouter()

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

async function changePassword() {
  errorMessage.value = ''
  successMessage.value = ''

  if (!form.value.oldPassword) {
    errorMessage.value = '请输入当前密码'
    return
  }
  if (!form.value.newPassword) {
    errorMessage.value = '请输入新密码'
    return
  }
  if (form.value.newPassword.length < 6) {
    errorMessage.value = '新密码长度不能少于 6 位'
    return
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    errorMessage.value = '两次输入的新密码不一致'
    return
  }
  if (form.value.oldPassword === form.value.newPassword) {
    errorMessage.value = '新密码不能与旧密码相同'
    return
  }

  loading.value = true
  try {
    const settings = await userApi.getSettings()
    const currentPwd = settings?.admin_password || 'admin123'

    if (form.value.oldPassword !== currentPwd) {
      throw new Error('当前密码不正确')
    }

    await userApi.changeAdminPassword(form.value.newPassword)

    successMessage.value = '密码修改成功，请重新登录'
    form.value = { oldPassword: '', newPassword: '', confirmPassword: '' }

    setTimeout(() => {
      clearUser()
      router.push('/login')
    }, 1500)
  } catch (e) {
    errorMessage.value = e.message || '修改失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <div class="password-card">
      <div class="card-header">
        <div class="lock-icon">🔐</div>
        <h3>修改管理员密码</h3>
        <p class="subtitle">定期修改密码可以提高账户安全性</p>
      </div>

      <div class="form-body">
        <div class="field-block">
          <label>当前密码</label>
          <input
            v-model="form.oldPassword"
            type="password"
            placeholder="请输入当前密码"
            @keydown.enter.prevent="changePassword"
          />
        </div>

        <div class="field-block">
          <label>新密码</label>
          <input
            v-model="form.newPassword"
            type="password"
            placeholder="请输入新密码（至少 6 位）"
            @keydown.enter.prevent="changePassword"
          />
        </div>

        <div class="field-block">
          <label>确认新密码</label>
          <input
            v-model="form.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            @keydown.enter.prevent="changePassword"
          />
        </div>

        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

        <button class="primary-btn full" type="button" @click="changePassword" :disabled="loading">
          {{ loading ? '修改中...' : '确认修改' }}
        </button>
      </div>

      <div class="tips-section">
        <h4>安全提示</h4>
        <ul>
          <li>密码长度建议至少 8 位</li>
          <li>建议包含大小写字母、数字和特殊字符</li>
          <li>不要使用与其他网站相同的密码</li>
          <li>定期更换密码，建议每 3 个月更换一次</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 500px;
}

.password-card {
  background: white;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.card-header {
  text-align: center;
  margin-bottom: 28px;
}

.lock-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.card-header h3 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #1f2a44;
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: #6b7a99;
}

.form-body {
  margin-bottom: 24px;
}

.field-block {
  margin-bottom: 18px;
}

.field-block label {
  display: block;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 8px;
  font-weight: 500;
}

.field-block input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 15px;
  outline: none;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}

.field-block input:focus {
  border-color: #4a90e2;
  box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
}

.primary-btn {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 14px 24px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-btn.full {
  width: 100%;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  margin: 12px 0;
}

.notice.error { background: #fef0f0; color: #e74c3c; }
.notice.success { background: #f0f9f4; color: #27ae60; }

.tips-section {
  padding-top: 20px;
  border-top: 1px solid #f0f2f7;
}

.tips-section h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2a44;
}

.tips-section ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #6b7a99;
  line-height: 1.8;
}

.tips-section li {
  margin-bottom: 4px;
}
</style>
