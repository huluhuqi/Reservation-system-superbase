<script setup>
import { ref, computed, onMounted } from 'vue'
import { UserAPI, RoleAPI } from '@/api'

const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const users = ref([])
const roles = ref([])
const selectedUserIds = ref([])
const showAddModal = ref(false)
const showBatchModal = ref(false)

const newUser = ref({
  employee_no: '',
  username: '',
  role_id: ''
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
    roles.value = await RoleAPI.getAll()
    selectedUserIds.value = []
  } catch (e) {
    errorMessage.value = e.message || '加载用户失败'
  } finally {
    loading.value = false
  }
}

function getRoleName(roleId) {
  const role = roles.value.find(r => r.id === roleId)
  return role ? role.role_name : (roleId ? '未知角色' : '普通用户')
}

function getRoleBadgeClass(roleId) {
  const role = roles.value.find(r => r.id === roleId)
  if (!role) return 'badge-user'
  return role.can_booking_all ? 'badge-user' : 'badge-custom'
}

function getUserRoleType(user) {
  // 如果有role_id，说明是自定义角色
  if (user.role_id) return 'custom'
  // 如果是admin角色
  if (user.role === 'admin') return 'admin'
  return 'user'
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

async function openAddModal() {
  newUser.value = { employee_no: '', username: '', role_id: '' }
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
    await UserAPI.createUserWithRole(
      newUser.value.employee_no.trim(),
      newUser.value.username.trim(),
      '123456',
      newUser.value.role_id || null
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
    const result = await UserAPI.batchCreateUsers(userList)
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
    await UserAPI.deleteUser(userId)
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
    const result = await UserAPI.batchDeleteUsers(selectedUserIds.value)
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
              <span class="badge" :class="getRoleBadgeClass(user.role_id)">
                {{ getRoleName(user.role_id) }}
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
          <select v-model="newUser.role_id">
            <option value="">普通用户（可预约全部）</option>
            <option v-for="role in roles" :key="role.id" :value="role.id">
              {{ role.role_name }}{{ role.can_booking_all ? '（可预约全部）' : '（部分类别）' }}
            </option>
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
  gap: var(--space-4);
}

.list-card,
.info-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
  gap: var(--space-3);
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: var(--space-2);
}

.primary-btn,
.secondary-btn,
.danger-btn {
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-size: 13px;
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
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: var(--hover);
  color: var(--text-primary);
}

.secondary-btn:hover {
  background: var(--line);
}

.danger-btn {
  background: var(--danger);
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
  background: var(--primary-soft);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-3);
  font-size: 14px;
  color: var(--primary);
  font-weight: 500;
}

.user-table {
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.table-head,
.table-row {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
}

.table-head {
  background: var(--disabled-soft);
  font-weight: 600;
  font-size: 13px;
  color: var(--text-secondary);
}

.table-body {
  max-height: 500px;
  overflow-y: auto;
}

.table-row {
  border-top: 1px solid var(--line);
  font-size: 14px;
  color: var(--text-primary);
}

.table-row:hover {
  background: var(--hover);
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
  color: var(--text-secondary);
  flex-shrink: 0;
}

.col-action {
  width: 80px;
  flex-shrink: 0;
}

.badge {
  display: inline-block;
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  font-size: 12px;
}

.badge-user {
  background: var(--primary-soft);
  color: var(--primary);
}

.badge-admin {
  background: var(--warning-soft);
  color: var(--warning);
}

.badge-custom {
  background: var(--success-soft);
  color: var(--success);
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-size: 13px;
  color: var(--primary);
}

.link-btn.danger {
  color: var(--danger);
}

.link-btn:hover {
  text-decoration: underline;
}

.muted {
  color: var(--text-muted);
  font-size: 13px;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
  font-size: 14px;
}

.notice {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
  margin-bottom: var(--space-3);
  white-space: pre-line;
}

.notice.error {
  background: var(--danger-soft);
  color: var(--danger);
}

.notice.success {
  background: var(--success-soft);
  color: var(--success);
}

.info-card {
  background: var(--primary-soft);
  border: 1px solid var(--primary-soft);
}

.info-card h4 {
  margin: 0 0 var(--space-3);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.8;
}

.info-card li {
  margin-bottom: var(--space-1);
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

.modal-box.wide {
  max-width: 500px;
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
  margin-bottom: var(--space-1);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  border-color: var(--primary);
}

.form-tip {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: var(--space-4);
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: var(--space-2);
  justify-content: flex-end;
  margin-top: var(--space-5);
}
</style>
