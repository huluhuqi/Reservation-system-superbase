<template>
  <div class="admin-layout">
    <div 
      class="sidebar-overlay" 
      :class="{ active: sidebarOpen }"
      @click="sidebarOpen = false"
    ></div>
    
    <div class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-header">
        <span>管理后台</span>
        <button class="close-btn" @click="sidebarOpen = false">✕</button>
      </div>
      <div class="menu-section">
        <button @click="navigateTo('/admin/dashboard')">📊 仪表盘</button>
        <button @click="navigateTo('/admin/booking')">📅 预约管理</button>
        <button @click="navigateTo('/admin/category')">📁 类别管理</button>
        <button @click="navigateTo('/admin/instrument')">🔬 仪器管理</button>
        <button @click="navigateTo('/admin/timeslot')">⏰ 时段设置</button>
        <button @click="navigateTo('/admin/lock')">🔒 锁定管理</button>
        <button @click="navigateTo('/admin/user')">👥 用户管理</button>
        <button @click="navigateTo('/admin/role')">🎭 角色管理</button>
        <button @click="navigateTo('/admin/risk')">⚠️ 风险预警</button>
        <button @click="navigateTo('/admin/password')">🔑 密码设置</button>
      </div>
      <div class="menu-bottom">
        <button @click="navigateTo('/home/booking')">👤 用户界面</button>
        <button class="logout-btn" @click="handleLogout">🚪 退出登录</button>
      </div>
    </div>
    
    <div class="content">
      <div class="mobile-header">
        <button class="menu-btn" @click="sidebarOpen = true">☰</button>
        <span class="mobile-title">管理后台</span>
      </div>
      <div class="page-content">
        <router-view v-slot="{ Component, route }">
          <transition name="page-transition" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const sidebarOpen = ref(false)

function navigateTo(path) {
  router.push(path)
  sidebarOpen.value = false
}

async function handleLogout() {
  try {
    await supabase.auth.signOut()
    localStorage.removeItem('user')
    router.push('/login')
  } catch (e) {
    console.error('退出失败', e)
  }
}

function handleResize() {
  if (window.innerWidth > 768) {
    sidebarOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 99;
  opacity: 0;
  transition: opacity 0.3s;
}

.sidebar-overlay.active {
  display: block;
  opacity: 1;
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
  transition: transform 0.3s ease;
}

.sidebar-header {
  padding: var(--space-5);
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  display: none;
  background: none;
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: auto;
}

.close-btn:hover {
  background: none;
  color: rgba(255, 255, 255, 0.8);
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

.mobile-header {
  display: none;
}

.page-content {
  padding: 0;
}

@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%);
    width: 240px;
    z-index: 101;
  }
  
  .sidebar.open {
    transform: translateX(0);
  }
  
  .close-btn {
    display: block;
  }
  
  .content {
    margin-left: 0;
  }
  
  .mobile-header {
    display: flex;
    align-items: center;
    background: var(--primary);
    color: white;
    padding: var(--space-3) var(--space-4);
    position: sticky;
    top: 0;
    z-index: 50;
    box-shadow: var(--shadow-sm);
  }
  
  .menu-btn {
    background: none;
    border: none;
    color: white;
    font-size: 22px;
    cursor: pointer;
    padding: 0;
    width: auto;
    margin-right: var(--space-3);
  }
  
  .menu-btn:hover {
    background: none;
    color: rgba(255, 255, 255, 0.9);
  }
  
  .mobile-title {
    font-size: 16px;
    font-weight: 600;
  }
  
  .page-content {
    padding: var(--space-3);
  }
}
</style>
