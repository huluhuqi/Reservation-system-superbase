<script setup>
import { ref, onMounted } from 'vue'
import { UserAPI } from '@/api'

const loading = ref(false)
const errorMessage = ref('')

const users = ref([])

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''
  try {
    users.value = await UserAPI.listUsers()
  } catch (e) {
    errorMessage.value = e.message || '加载用户失败'
  } finally {
    loading.value = false
  }
}

function getRoleBadgeClass(role) {
  return role === 'admin' ? 'badge-admin' : 'badge-user'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="admin-page">
    <div class="list-card">
      <div class="list-header">
        <h3>注册用户（{{ users.length }} 人）</h3>
        <button class="secondary-btn" type="button" @click="loadUsers">刷新</button>
      </div>

      <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="users.length === 0" class="empty-text">暂无注册用户</div>
      <div v-else class="user-table">
        <div class="table-head">
          <div class="col-email">邮箱</div>
          <div class="col-name">用户名</div>
          <div class="col-role">角色</div>
          <div class="col-date">注册时间</div>
        </div>
        <div class="table-body">
          <div
            v-for="user in users"
            :key="user.id"
            class="table-row"
          >
            <div class="col-email">{{ user.email }}</div>
            <div class="col-name">{{ user.username || '-' }}</div>
            <div class="col-role">
              <span class="badge" :class="getRoleBadgeClass(user.role)">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </div>
            <div class="col-date">{{ formatDate(user.created_at) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-card">
      <h4>用户说明</h4>
      <ul>
        <li>用户通过注册页面自行注册，系统自动创建账号</li>
        <li>如需设置管理员，请直接在 Supabase 后台修改用户的 role 字段为 'admin'</li>
        <li>管理员邮箱建议设置为 <strong>admin@admin.com</strong>，系统会自动识别为管理员</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.list-card,
.info-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
}

.secondary-btn {
  background: #f0f4f9;
  color: #1f2a44;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
}

.user-table {
  border: 1px solid #e8ecf3;
  border-radius: 10px;
  overflow: hidden;
}

.table-head,
.table-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
}

.table-head {
  background: #f7f9fd;
  font-weight: 600;
  font-size: 13px;
  color: #6b7a99;
}

.table-body {
  max-height: 500px;
  overflow-y: auto;
}

.table-row {
  border-top: 1px solid #f0f2f7;
  font-size: 14px;
  color: #1f2a44;
}

.table-row:hover {
  background: #fafbfd;
}

.col-email {
  flex: 2;
  word-break: break-all;
}

.col-name {
  flex: 1;
}

.col-role {
  width: 100px;
}

.col-date {
  width: 120px;
  color: #6b7a99;
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
}

.badge-user {
  background: #e8f4fd;
  color: #4a90e2;
}

.badge-admin {
  background: #fff3e0;
  color: #f39c12;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 30px;
  color: #8a9ab5;
  font-size: 14px;
}

.notice.error {
  background: #fef0f0;
  color: #e74c3c;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 16px;
}

.info-card {
  background: #f0f6ff;
  border: 1px solid #d0e3ff;
}

.info-card h4 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1f2a44;
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: #4a5568;
  line-height: 1.8;
}

.info-card li {
  margin-bottom: 4px;
}
</style>
