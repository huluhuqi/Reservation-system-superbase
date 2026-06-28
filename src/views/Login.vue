<template>
  <div class="login-container">
    <div class="login-card">
      <h2>登录</h2>
      <input v-model="username" placeholder="账号" type="text" />
      <input v-model="password" placeholder="密码" type="password" />
      <button @click="handleLogin">登录</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { setUser, isAdmin } from '../api/context.js'

const router = useRouter()
const username = ref('')
const password = ref('')

const handleLogin = () => {
  const user = {
    id: 1,
    user_name: username.value,
    role: username.value === 'admin' ? 'admin' : 'user'
  }
  setUser(user)

  if (isAdmin()) {
    router.push('/admin/dashboard')
  } else {
    router.push('/home/booking')
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.login-card {
  width: 320px;
  padding: 32px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.login-card h2 {
  margin: 0 0 24px;
  text-align: center;
  color: #1f2a44;
}

.login-card input {
  width: 100%;
  padding: 10px 14px;
  margin-bottom: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
}

.login-card input:focus {
  border-color: #4a90e2;
}

.login-card button {
  width: 100%;
  padding: 12px;
  background: #4a90e2;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  cursor: pointer;
}

.login-card button:hover {
  background: #357abd;
}
</style>
