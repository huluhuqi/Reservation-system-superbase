<script setup>
import { ref, computed, onMounted } from 'vue'
import { UserAPI, AdminUsersAPI } from '@/api'

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const users = ref([])
const selectedUserIds = ref([])
const showAddModal = ref(false)
const showBatchModal = ref(false)

const newUser = ref({
  employee_no: '',
  username: '',
  role: 'user'
})

const batchText = ref('')

const allSelected = computed(() => {
  const normalUsers = users.value.filter(u => u.role !== 'admin')
  return normalUsers.length > 0 && normalUsers.every(u => selectedUserIds.value.includes(u.id))
})

const selectedCount = computed(() => selectedUserIds.value.length)

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''
  try {
    users.value = await UserAPI.listUsers()
    selectedUserIds.value = []
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

function toggleSelect(userId, role) {
  if (role === 'admin') return
  const idx = selectedUserIds.value.indexOf(userId)
  if (idx > -1) {
    selectedUserIds.value.splice(idx, 1)
  } else {
    selectedUserIds.value.push(userId)
  }
}

function toggleSelectAll() {
  const normalUserIds = users.value.filter(u => u.role !== 'admin').map(u => u.id)
  if (allSelected.value) {
    selectedUserIds.value = []
  } else {
    selectedUserIds.value = [...normalUserIds]
  }
}

function openAddModal() {
  newUser.value = { employee_no: '', username: '', role: 'user' }
  errorMessage.value = ''
  successMessage.value = ''
  showAddModal.value = true
}

async function handleAddUser() {
  if (!newUser.value.employee_no.trim()) {
    errorMessage.value = '请输入工号'
    return
  }
  if (!newUser.value.username.trim()) {
    errorMessage.value = '请输入姓名'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    await AdminUsersAPI.createUser(
      newUser.value.employee_no.trim(),
      newUser.value.username.trim(),
      '123456',
      newUser.value.role
    )
    successMessage.value = '创建成功，默认密码：123456'
    showAddModal.value = false
    loadUsers()
  } catch (e) {
    errorMessage.value = e.message || '创建失败'
  } finally {
    submitting.value = false
  }
}

function openBatchModal() {
  batchText.value = ''
  errorMessage.value = ''
  successMessage.value = ''
  showBatchModal.value = true
}

async function handleBatchCreate() {
  const lines = batchText.value.trim().split('\n').filter(l => l.trim())
  if (lines.length === 0) {
    errorMessage.value = '请输入用户数据'
    return
  }

  const userList = []
  for (const line of lines) {
    const parts = line.split(/[,，\t\s]+/).filter(p => p.trim())
    if (parts.length >= 2) {
      userList.push({
        employee_no: parts[0].trim(),
        username: parts[1].trim(),
        password: '123456',
        role: 'user'
      })
    }
  }

  if (userList.length === 0) {
    errorMessage.value = '未解析到有效用户数据，请按"工号,姓名"格式输入，每行一个'
    return
  }

  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await AdminUsersAPI.batchCreateUsers(userList)
    if (result && result.failed > 0) {
      errorMessage.value = `成功 ${result.success} 个，失败 ${result.failed} 个\n${(result.errors || []).join('\n')}`
    } else {
      successMessage.value = `成功创建 ${result?.success || userList.length} 个用户，默认密码：123456`
    }
    showBatchModal.value = false
    loadUsers()
  } catch (e) {
    errorMessage.value = e.message || '批量创建失败'
  } finally {
    submitting.value = false
  }
}

async function handleDeleteUser(userId) {
  if (!confirm('确定要删除该用户吗？')) return
  try {
    await AdminUsersAPI.deleteUser(userId)
    successMessage.value = '删除成功'
    loadUsers()
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  }
}

async function handleBatchDelete() {
  if (selectedUserIds.value.length === 0) {
    errorMessage.value = '请先选择要删除的用户'
    return
  }
  if (!confirm(`确定要删除选中的 ${selectedUserIds.value.length} 个用户吗？`)) return
  try {
    const result = await AdminUsersAPI.batchDeleteUsers(selectedUserIds.value)
    if (result && result.failed > 0) {
      errorMessage.value = `成功删除 ${result.success} 个，失败 ${result.failed} 个`
    } else {
      successMessage.value = `成功删除 ${result?.success || selectedUserIds.value.length} 个用户`
    }
    loadUsers()
  } catch (e) {
    errorMessage.value = e.message || '批量删除失败'
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="admin-page">
    <div class="list-card">
      <div class="list-header">
        <h3>用户管理（{{ users.length }} 人）</h3>
        <div class="header-actions">
          <button class="secondary-btn" type="button" @click="loadUsers">刷新</button>
          <button class="primary-btn" type="button" @click="openAddModal">新增用户</button>
          <button class="secondary-btn" type="button" @click="openBatchModal">批量新增</button>
        </div>
      </div>

      <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

      <div v-if="selectedCount > 0" class="batch-bar">
        <span>已选择 {{ selectedCount }} 个用户</span>
        <button class="danger-btn" type="button" @click="handleBatchDelete">批量删除</button>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="users.length === 0" class="empty-text">暂无用户</div>
      <div v-else class="user-table">
        <div class="table-head">
          <div class="col-check">
            <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
          </div>
          <div class="col-no">工号</div>
          <div class="col-name">姓名</div>
          <div class="col-role">角色</div>
          <div class="col-date">创建时间</div>
          <div class="col-action">操作</div>
        </div>
        <div class="table-body">
          <div
            v-for="user in users"
            :key="user.id"
            class="table-row"
            :class="{ 'row-disabled': user.role === 'admin' }"
          >
            <div class="col-check">
              <input
                v-if="user.role !== 'admin'"
                type="checkbox"
                :checked="selectedUserIds.includes(user.id)"
                @change="toggleSelect(user.id, user.role)"
              />
              <span v-else class="lock-icon">🔒</span>
            </div>
            <div class="col-no">{{ user.employee_no || '-' }}</div>
            <div class="col-name">{{ user.username || '-' }}</div>
            <div class="col-role">
              <span class="badge" :class="getRoleBadgeClass(user.role)">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </span>
            </div>
            <div class="col-date">{{ formatDate(user.created_at) }}</div>
            <div class="col-action">
              <button
                v-if="user.role !== 'admin'"
                class="link-btn danger"
                type="button"
                @click="handleDeleteUser(user.id)"
              >
                删除
              </button>
              <span v-else class="muted">-</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="info-card">
      <h4>说明</h4>
      <ul>
        <li>新增用户默认密码为 <strong>123456</strong></li>
        <li>批量新增格式：每行一个用户，<strong>工号,姓名</strong>（逗号或空格分隔）</li>
        <li>管理员账号无法删除，保护最高权限</li>
        <li>用户登录需要输入 <strong>姓名、工号、密码</strong> 三项</li>
      </ul>
    </div>

    <div v-if="showAddModal" class="modal-mask" @click.self="showAddModal = false">
      <div class="modal-box">
        <h3>新增用户</h3>
        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
        <div class="form-group">
          <label>工号</label>
          <input v-model="newUser.employee_no" placeholder="请输入工号" type="text" />
        </div>
        <div class="form-group">
          <label>姓名</label>
          <input v-model="newUser.username" placeholder="请输入姓名" type="text" />
        </div>
        <div class="form-group">
          <label>角色</label>
          <select v-model="newUser.role">
            <option value="user">普通用户</option>
            <option value="admin">管理员</option>
          </select>
        </div>
        <div class="form-tip">默认密码：123456</div>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" @click="showAddModal = false">取消</button>
          <button class="primary-btn" type="button" :disabled="submitting" @click="handleAddUser">
            {{ submitting ? '创建中...' : '确认创建' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showBatchModal" class="modal-mask" @click.self="showBatchModal = false">
      <div class="modal-box wide">
        <h3>批量新增用户</h3>
        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
        <div class="form-group">
          <label>用户列表</label>
          <textarea
            v-model="batchText"
            placeholder="每行一个用户，格式：工号,姓名&#10;例如：&#10;001,张三&#10;002,李四&#10;003,王五"
            rows="10"
          ></textarea>
        </div>
        <div class="form-tip">
          默认密码：123456，角色均为普通用户<br/>
          支持逗号、空格、Tab 分隔
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" type="button" @click="showBatchModal = false">取消</button>
          <button class="primary-btn" type="button" :disabled="submitting" @click="handleBatchCreate">
            {{ submitting ? '创建中...' : '确认批量创建' }}
          </button>
        </div>
      </div>
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
  flex-wrap: wrap;
  gap: 12px;
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.primary-btn,
.secondary-btn,
.danger-btn {
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: #4a90e2;
  color: white;
}

.primary-btn:hover:not(:disabled) {
  background: #357abd;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: #f0f4f9;
  color: #1f2a44;
}

.secondary-btn:hover {
  background: #e2e8f0;
}

.danger-btn {
  background: #e74c3c;
  color: white;
}

.danger-btn:hover:not(:disabled) {
  background: #c0392b;
}

.danger-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #e8f4fd;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 12px;
  font-size: 14px;
  color: #4a90e2;
  font-weight: 500;
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

.row-disabled {
  opacity: 0.7;
}

.col-check {
  width: 40px;
  flex-shrink: 0;
}

.col-check input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.lock-icon {
  font-size: 14px;
}

.col-no {
  width: 100px;
  flex-shrink: 0;
}

.col-name {
  flex: 1;
}

.col-role {
  width: 100px;
  flex-shrink: 0;
}

.col-date {
  width: 120px;
  color: #6b7a99;
  flex-shrink: 0;
}

.col-action {
  width: 80px;
  flex-shrink: 0;
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

.link-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
  color: #4a90e2;
}

.link-btn.danger {
  color: #e74c3c;
}

.link-btn:hover {
  text-decoration: underline;
}

.muted {
  color: #b0b8c8;
  font-size: 13px;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 30px;
  color: #8a9ab5;
  font-size: 14px;
}

.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  margin-bottom: 12px;
  white-space: pre-line;
}

.notice.error {
  background: #fef0f0;
  color: #e74c3c;
}

.notice.success {
  background: #e8f5e9;
  color: #27ae60;
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
  padding: 20px;
}

.modal-box {
  background: white;
  border-radius: 16px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.modal-box.wide {
  max-width: 500px;
}

.modal-box h3 {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: #1f2a44;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #4a5568;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: #4a90e2;
}

.form-tip {
  font-size: 12px;
  color: #8a9ab5;
  margin-bottom: 16px;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
