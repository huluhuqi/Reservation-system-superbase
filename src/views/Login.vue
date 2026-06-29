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
        <p>默认密码：123456</p>
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

    const email = employeeNo.value.trim().toLowerCase() + '@system.local'

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password.value
    })

    if (error) {
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

    if (profile && profile.username && profile.username !== name.value.trim()) {
      await supabase.auth.signOut()
      throw new Error('姓名与工号不匹配')
    }

    const user = {
      id: data.user.id,
      user_name: profile?.username || name.value.trim(),
      email: data.user.email,
      employee_no: profile?.employee_no || employeeNo.value.trim(),
      role: profile?.role || 'user'
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 360px;
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-card h2 {
  margin: 0 0 32px;
  text-align: center;
  color: #1f2a44;
  font-size: 24px;
  font-weight: 600;
}

.error-msg {
  padding: 12px 16px;
  background: #fef0f0;
  color: #e74c3c;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.success-msg {
  padding: 12px 16px;
  background: #e8f5e9;
  color: #27ae60;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
  text-align: center;
}

.login-card input {
  width: 100%;
  padding: 14px 16px;
  margin-bottom: 16px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 15px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.3s;
}

.login-card input:focus {
  border-color: #667eea;
}

.login-card button {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s;
}

.login-card button:hover:not(:disabled) {
  transform: translateY(-2px);
}

.login-card button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tip-text {
  margin-top: 20px;
  text-align: center;
  color: #8a9ab5;
  font-size: 13px;
}

.tip-text p {
  margin: 4px 0;
}
</style>
