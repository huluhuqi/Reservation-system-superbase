<template>
  <div class="login-container">
    <div class="login-card">
      <h2>科研仪器预约系统</h2>
      <div v-if="errorMessage" class="error-msg">{{ errorMessage }}</div>
      <div v-if="successMessage" class="success-msg">{{ successMessage }}</div>

      <input v-model="name" placeholder="姓名" type="text" />
      <input v-model="employeeNo" placeholder="工号" type="text" />
      <input v-model="password" placeholder="密码" type="password" @keyup.enter="handleLogin" />

      <button @click="handleLogin" :disabled="loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>

      <div class="tip-text">
        <p>请使用管理员分配的账号登录</p>
        <p>用户默认密码：123456</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const name = ref('')
const employeeNo = ref('')
const password = ref('')
const errorMessage = ref('')
const successMessage = ref('')
const loading = ref(false)

async function handleLogin() {
  errorMessage.value = ''
  loading.value = true

  try {
    if (!name.value.trim()) {
      throw new Error('请输入姓名')
    }
    if (!employeeNo.value.trim()) {
      throw new Error('请输入工号')
    }
    if (!password.value.trim()) {
      throw new Error('请输入密码')
    }

    const isEmailLogin = employeeNo.value.trim().includes('@')
    let email
    let employeeNoForUser

    if (isEmailLogin) {
      email = employeeNo.value.trim().toLowerCase()
      employeeNoForUser = ''
    } else {
      email = employeeNo.value.trim().toLowerCase() + '@system.local'
      employeeNoForUser = employeeNo.value.trim()
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password.value
    })

    if (error) {
      console.error('登录错误:', error)
      throw new Error('工号或密码错误')
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (profileError) {
      console.warn('获取用户profile失败', profileError)
    }

    if (!isEmailLogin && profile && profile.username && profile.username !== name.value.trim()) {
      await supabase.auth.signOut()
      throw new Error('姓名与工号不匹配')
    }

    const isAdminEmail = data.user.email === 'admin@admin.com'
    const userRole = profile?.role || (isAdminEmail ? 'admin' : 'user')
    const userName = profile?.username || name.value.trim()
    const userEmployeeNo = profile?.employee_no || employeeNoForUser

    const user = {
      id: data.user.id,
      user_name: userName,
      email: data.user.email,
      employee_no: userEmployeeNo,
      role: userRole
    }

    localStorage.setItem('user', JSON.stringify(user))

    if (user.role === 'admin') {
      router.push('/admin/dashboard')
    } else {
      router.push('/home/booking')
    }
  } catch (e) {
    console.error('登录失败', e)
    errorMessage.value = e.message || '登录失败，请检查工号和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
}

.login-card {
  width: 360px;
  padding: 40px;
  background: var(--card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.login-card h2 {
  margin: 0 0 32px;
  text-align: center;
  color: var(--text-primary);
  font-size: 24px;
  font-weight: 600;
}

.error-msg {
  padding: 12px 16px;
  background: var(--danger-soft);
  color: var(--danger);
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.success-msg {
  padding: 12px 16px;
  background: var(--success-soft);
  color: var(--success);
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.login-card input {
  width: 100%;
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 15px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.3s;
}

.login-card input:focus {
  border-color: var(--primary);
}

.login-card button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s;
}

.login-card button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.login-card button:disabled {
  background: var(--disabled);
  cursor: not-allowed;
}

.tip-text {
  margin-top: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.tip-text p {
  margin: 4px 0;
}
</style>
