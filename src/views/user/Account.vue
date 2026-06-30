<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

function getUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const userInfo = computed(() => getUser())
const isAdmin = computed(() => {
  const user = getUser()
  return user && user.role === 'admin'
})

const showPasswordModal = ref(false)
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')

const menuItems = [
  { icon: '📋', label: '我的预约', path: '/home/records' },
  { icon: '🔔', label: '消息通知', path: '/home/account' },
  { icon: '⚙️', label: '设置', path: '/home/account' }
]

function openPasswordModal() {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
  showPasswordModal.value = true
}

async function handleChangePassword() {
  passwordError.value = ''
  passwordSuccess.value = ''

  if (!oldPassword.value.trim()) {
    passwordError.value = '请输入原密码'
    return
  }
  if (!newPassword.value.trim()) {
    passwordError.value = '请输入新密码'
    return
  }
  if (newPassword.value.length < 6) {
    passwordError.value = '新密码至少6位'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = '两次输入的新密码不一致'
    return
  }

  passwordLoading.value = true
  try {
    const user = userInfo.value
    if (!user || !user.email) {
      throw new Error('用户信息异常，请重新登录')
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: oldPassword.value
    })
    if (signInError) {
      throw new Error('原密码错误')
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword.value
    })
    if (updateError) {
      throw updateError
    }

    passwordSuccess.value = '密码修改成功'
    setTimeout(() => {
      showPasswordModal.value = false
    }, 1500)
  } catch (e) {
    console.error('修改密码失败', e)
    passwordError.value = e.message || '修改密码失败'
  } finally {
    passwordLoading.value = false
  }
}

async function handleLogout() {
  try {
    await supabase.auth.signOut()
  } catch (e) {
    console.error('登出Supabase失败', e)
  }
  localStorage.removeItem('user')
  router.push('/login')
}

function handleGoToAdmin() {
  router.push('/admin/dashboard')
}
</script>

<template>
  <div class="account-page">
    <div class="profile-card card-surface">
      <div class="avatar">
        {{ userInfo?.user_name?.charAt(0) || 'U' }}
      </div>
      <div class="profile-info">
        <div class="user-name">{{ userInfo?.user_name || '未登录' }}</div>
        <div class="user-no" v-if="userInfo?.employee_no">工号：{{ userInfo.employee_no }}</div>
      </div>
      <button v-if="isAdmin" class="admin-badge" type="button" @click="handleGoToAdmin">
        管理员
      </button>
    </div>

    <div class="menu-card card-surface">
      <button
        v-for="item in menuItems"
        :key="item.label"
        class="menu-item"
        type="button"
        @click="$router.push(item.path)"
      >
        <span class="menu-icon">{{ item.icon }}</span>
        <span class="menu-label">{{ item.label }}</span>
        <span class="menu-arrow">›</span>
      </button>
    </div>

    <div class="menu-card card-surface">
      <button class="menu-item" type="button" @click="openPasswordModal">
        <span class="menu-icon">🔑</span>
        <span class="menu-label">修改密码</span>
        <span class="menu-arrow">›</span>
      </button>
    </div>

    <div class="menu-card card-surface">
      <button class="menu-item danger" type="button" @click="handleLogout">
        <span class="menu-icon">🚪</span>
        <span class="menu-label">退出登录</span>
        <span class="menu-arrow">›</span>
      </button>
    </div>

    <div v-if="showPasswordModal" class="modal-mask" @click.self="showPasswordModal = false">
      <div class="modal-box">
        <h3>修改密码</h3>
        <p v-if="passwordError" class="notice error">{{ passwordError }}</p>
        <p v-if="passwordSuccess" class="notice success">{{ passwordSuccess }}</p>
        <div class="form-group">
          <label>原密码</label>
          <input v-model="oldPassword" placeholder="请输入原密码" type="password" />
        </div>
        <div class="form-group">
          <label>新密码</label>
          <input v-model="newPassword" placeholder="请输入新密码（至少6位）" type="password" />
        </div>
        <div class="form-group">
          <label>确认新密码</label>
          <input v-model="confirmPassword" placeholder="请再次输入新密码" type="password" @keyup.enter="handleChangePassword" />
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" @click="showPasswordModal = false">取消</button>
          <button class="primary-btn" type="button" :disabled="passwordLoading" @click="handleChangePassword">
            {{ passwordLoading ? '修改中...' : '确认修改' }}
          </button>
        </div>
      </div>
    </div>

    <div class="about-section">
      <p>科研仪器预约系统 v1.0</p>
      <p>KG-7500 设备预约</p>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  padding-bottom: var(--space-5);
}

.profile-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
  flex-shrink: 0;
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.user-no {
  font-size: 13px;
  color: var(--text-secondary);
}

.admin-badge {
  padding: 6px 12px;
  background: var(--warning);
  color: white;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.menu-card {
  padding: var(--space-2);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease;
}

.menu-item:hover {
  background: var(--hover);
}

.menu-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}

.menu-label {
  flex: 1;
  font-size: 15px;
  color: var(--text-primary);
}

.menu-arrow {
  font-size: 18px;
  color: var(--text-muted);
}

.menu-item.danger .menu-label {
  color: var(--danger);
}

.about-section {
  text-align: center;
  padding: 30px 20px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.8;
}

.about-section p {
  margin: var(--space-1) 0;
}

.card-surface {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-md);
  margin-bottom: 14px;
}

.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-5);
}

.modal-box {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  width: 100%;
  max-width: 400px;
  box-shadow: var(--shadow-md);
}

.modal-box h3 {
  margin: 0 0 var(--space-5);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: var(--space-4);
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid var(--line);
  border-radius: var(--radius-sm);
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: var(--primary);
}

.modal-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-5);
}

.primary-btn,
.secondary-btn {
  border: none;
  border-radius: var(--radius-sm);
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: var(--primary);
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.primary-btn:disabled {
  background: var(--disabled);
  cursor: not-allowed;
}

.secondary-btn {
  background: var(--hover);
  color: var(--text-primary);
}

.secondary-btn:hover {
  background: var(--line);
}

.notice {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-bottom: var(--space-3);
}

.notice.error {
  background: var(--danger-soft);
  color: var(--danger);
}

.notice.success {
  background: var(--success-soft);
  color: var(--success);
}
</style>
