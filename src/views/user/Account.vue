<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { getUser, clearUser, isAdmin as checkIsAdmin } from '../../api/context.js'

const router = useRouter()

const userInfo = computed(() => getUser())
const isAdmin = computed(() => checkIsAdmin())

const menuItems = [
  { icon: '📋', label: '我的预约', path: '/home/records' },
  { icon: '🔔', label: '消息通知', path: '/home/account' },
  { icon: '⚙️', label: '设置', path: '/home/account' }
]

function handleLogout() {
  clearUser()
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
      <button class="menu-item danger" type="button" @click="handleLogout">
        <span class="menu-icon">🚪</span>
        <span class="menu-label">退出登录</span>
        <span class="menu-arrow">›</span>
      </button>
    </div>

    <div class="about-section">
      <p>科研仪器预约系统 v1.0</p>
      <p>KG-7500 设备预约</p>
    </div>
  </div>
</template>

<style scoped>
.account-page {
  padding-bottom: 20px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
}

.avatar {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
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
  color: #1f2a44;
  margin-bottom: 4px;
}

.user-no {
  font-size: 13px;
  color: #6b7a99;
}

.admin-badge {
  padding: 6px 12px;
  background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.menu-card {
  padding: 8px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease;
}

.menu-item:hover {
  background: #f7f9fd;
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
  color: #1f2a44;
}

.menu-arrow {
  font-size: 18px;
  color: #c0c8d4;
}

.menu-item.danger .menu-label {
  color: #e74c3c;
}

.about-section {
  text-align: center;
  padding: 30px 20px;
  color: #9aa8c4;
  font-size: 12px;
  line-height: 1.8;
}

.about-section p {
  margin: 4px 0;
}

.card-surface {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 2px 12px rgba(31, 42, 68, 0.06);
  margin-bottom: 14px;
}
</style>
