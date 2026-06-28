<script setup>
import { ref, onMounted } from 'vue'
import { userApi } from '../../api/user.js'

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const registeredUsers = ref([])
const selectedUserKeys = ref([])

const form = ref({
  user_name: '',
  employee_no: ''
})

async function loadUsers() {
  loading.value = true
  errorMessage.value = ''
  try {
    registeredUsers.value = await userApi.getRegisteredUsers()
    selectedUserKeys.value = []
  } catch (e) {
    errorMessage.value = e.message || '加载用户失败'
  } finally {
    loading.value = false
  }
}

async function addUser() {
  const user_name = form.value.user_name.trim()
  const employee_no = form.value.employee_no.trim()

  if (!user_name || !employee_no) {
    errorMessage.value = '请填写姓名和工号'
    return
  }

  const exists = registeredUsers.value.some(
    (u) => u.user_name === user_name && u.employee_no === employee_no
  )
  if (exists) {
    errorMessage.value = '该用户已存在'
    return
  }

  operating.value = true
  errorMessage.value = ''
  try {
    await userApi.addUser({ user_name, employee_no })
    form.value.user_name = ''
    form.value.employee_no = ''
    successMessage.value = '添加用户成功'
    await loadUsers()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '添加失败'
  } finally {
    operating.value = false
  }
}

function toggleUserSelect(user_name, employee_no) {
  const key = `${user_name}-${employee_no}`
  if (selectedUserKeys.value.includes(key)) {
    selectedUserKeys.value = selectedUserKeys.value.filter((k) => k !== key)
  } else {
    selectedUserKeys.value.push(key)
  }
}

async function batchDeleteUsers() {
  if (selectedUserKeys.value.length === 0) {
    errorMessage.value = '请先选择要删除的用户'
    return
  }
  const confirmed = window.confirm(`确定删除选中的 ${selectedUserKeys.value.length} 个用户吗？`)
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  try {
    await userApi.batchDeleteUsers(selectedUserKeys.value)
    successMessage.value = '批量删除成功'
    await loadUsers()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    operating.value = false
  }
}

async function deleteSingleUser(user) {
  const confirmed = window.confirm(`确定删除用户 ${user.user_name} 吗？`)
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  try {
    await userApi.deleteUser(user.user_name, user.employee_no)
    successMessage.value = '删除用户成功'
    await loadUsers()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    operating.value = false
  }
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="admin-page">
    <div class="form-card">
      <h3>添加用户</h3>
      <div class="form-row">
        <div class="field-block">
          <label>姓名</label>
          <input
            v-model="form.user_name"
            type="text"
            placeholder="例如：张三"
            @keydown.enter.prevent="addUser"
          />
        </div>
        <div class="field-block">
          <label>工号</label>
          <input
            v-model="form.employee_no"
            type="text"
            placeholder="例如：2024001"
            @keydown.enter.prevent="addUser"
          />
        </div>
      </div>
      <button class="primary-btn" type="button" @click="addUser" :disabled="operating">
        {{ operating ? '处理中...' : '添加用户' }}
      </button>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div class="list-card">
      <div class="list-header">
        <h3>已注册用户（{{ registeredUsers.length }} 人）</h3>
        <div class="list-actions">
          <button
            class="secondary-btn danger"
            type="button"
            @click="batchDeleteUsers"
            :disabled="selectedUserKeys.length === 0 || operating"
          >
            批量删除 ({{ selectedUserKeys.length }})
          </button>
          <button class="secondary-btn" type="button" @click="loadUsers">刷新</button>
        </div>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="registeredUsers.length === 0" class="empty-text">暂无注册用户</div>
      <div v-else class="user-table">
        <div class="table-head">
          <div class="col-check">
            <input
              type="checkbox"
              :checked="selectedUserKeys.length === registeredUsers.length && registeredUsers.length > 0"
              @change="selectedUserKeys = selectedUserKeys.length === registeredUsers.length ? [] : registeredUsers.map(u => `${u.user_name}-${u.employee_no}`)"
            />
          </div>
          <div class="col-name">姓名</div>
          <div class="col-no">工号</div>
          <div class="col-action">操作</div>
        </div>
        <div class="table-body">
          <div
            v-for="(user, index) in registeredUsers"
            :key="`${user.user_name}-${user.employee_no}`"
            class="table-row"
          >
            <div class="col-check">
              <input
                type="checkbox"
                :checked="selectedUserKeys.includes(`${user.user_name}-${user.employee_no}`)"
                @change="toggleUserSelect(user.user_name, user.employee_no)"
              />
            </div>
            <div class="col-name">{{ user.user_name }}</div>
            <div class="col-no">{{ user.employee_no }}</div>
            <div class="col-action">
              <button
                class="text-btn danger"
                type="button"
                @click="deleteSingleUser(user)"
                :disabled="operating"
              >
                删除
              </button>
            </div>
          </div>
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

.form-card,
.list-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-card h3 {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.field-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-block label {
  font-size: 13px;
  color: #6b7a99;
}

.field-block input {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.field-block input:focus {
  border-color: #4a90e2;
}

.primary-btn {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.secondary-btn.danger {
  background: #fef0f0;
  color: #e74c3c;
}

.secondary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.list-actions {
  display: flex;
  gap: 10px;
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

.col-check {
  width: 40px;
}

.col-name {
  flex: 1;
}

.col-no {
  width: 160px;
}

.col-action {
  width: 80px;
  text-align: right;
}

.text-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
}

.text-btn.danger {
  color: #e74c3c;
}

.text-btn.danger:hover {
  background: #fef0f0;
}

.text-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
}

.notice.error { background: #fef0f0; color: #e74c3c; }
.notice.success { background: #f0f9f4; color: #27ae60; }
</style>
