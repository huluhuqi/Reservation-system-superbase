<template>
  <div class="admin-layout">
    <div class="sidebar">
      <div class="sidebar-header">管理后台</div>
      <div class="menu-section">
        <button @click="$router.push('/admin/dashboard')">📊 仪表盘</button>
        <button @click="$router.push('/admin/booking')">📅 预约管理</button>
        <button @click="$router.push('/admin/category')">📁 类别管理</button>
        <button @click="$router.push('/admin/instrument')">🔬 仪器管理</button>
        <button @click="$router.push('/admin/timeslot')">⏰ 时段设置</button>
        <button @click="$router.push('/admin/lock')">🔒 锁定管理</button>
        <button @click="$router.push('/admin/user')">👥 用户管理</button>
        <button @click="$router.push('/admin/role')">🎭 角色管理</button>
        <button @click="$router.push('/admin/risk')">⚠️ 风险预警</button>
        <button @click="$router.push('/admin/password')">🔑 密码设置</button>
      </div>
      <div class="menu-bottom">
        <button @click="$router.push('/home/booking')">👤 用户界面</button>
        <button class="logout-btn" @click="handleLogout">🚪 退出登录</button>
      </div>
    </div>
    <div class="content">
      <router-view />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

async function handleLogout() {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem('user')
    router.push('/login')
  } catch (e) {
    console.error('退出失败', e)
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 200px;
  background: var(--primary);
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 100;
  box-shadow: var(--shadow-md);
}

.sidebar-header {
  padding: var(--space-5);
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}

.menu-section {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2) 0;
}

.menu-bottom {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  padding: var(--space-2) 0;
  flex-shrink: 0;
}

button {
  display: block;
  width: 100%;
  padding: var(--space-3) var(--space-5);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.75);
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover {
  background: var(--primary-hover);
  color: white;
}

.logout-btn {
  color: var(--danger-soft);
}

.logout-btn:hover {
  background: var(--danger);
  color: white;
}

.content {
  flex: 1;
  margin-left: 200px;
  background: var(--bg);
  min-height: 100vh;
}
</style>
