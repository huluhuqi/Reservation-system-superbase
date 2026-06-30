<script setup>
import { ref, onMounted, computed } from 'vue'
import { RoleAPI, CategoryAPI } from '@/api'

const loading = ref(false)
const roles = ref([])
const categories = ref([])
const showModal = ref(false)
const editingRole = ref(null)
const form = ref({
  role_name: '',
  role_description: '',
  can_booking_all: false
})
const selectedCategoryIds = ref([])
const errorMessage = ref('')
const successMessage = ref('')
const isAdmin = ref(false)

function getUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const userInfo = computed(() => getUser())
isAdmin.value = userInfo.value?.role === 'admin'

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    roles.value = await RoleAPI.getAll()
    categories.value = await CategoryAPI.getAll()
  } catch (e) {
    errorMessage.value = e.message || '加载数据失败'
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  editingRole.value = null
  form.value = { role_name: '', role_description: '', can_booking_all: false }
  selectedCategoryIds.value = []
  showModal.value = true
}

async function openEditModal(role) {
  editingRole.value = role
  form.value = {
    role_name: role.role_name,
    role_description: role.role_description || '',
    can_booking_all: role.can_booking_all
  }
  try {
    selectedCategoryIds.value = await RoleAPI.getCategories(role.id)
  } catch (e) {
    selectedCategoryIds.value = []
  }
  showModal.value = true
}

async function handleSave() {
  if (!form.value.role_name.trim()) {
    errorMessage.value = '请输入角色名称'
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    let roleId
    if (editingRole.value) {
      const updated = await RoleAPI.update(editingRole.value.id, form.value)
      roleId = updated.id
    } else {
      const created = await RoleAPI.create(form.value)
      roleId = created.id
    }

    // 保存角色-类别关联
    await RoleAPI.setCategories(roleId, selectedCategoryIds.value)

    successMessage.value = editingRole.value ? '角色更新成功' : '角色创建成功'
    showModal.value = false
    await loadData()
  } catch (e) {
    errorMessage.value = e.message || '保存失败'
  } finally {
    loading.value = false
  }
}

async function handleDelete(role) {
  if (role.role_name === 'admin' || role.role_name === 'user') {
    errorMessage.value = '无法删除系统默认角色'
    return
  }

  if (!confirm(`确定删除角色"${role.role_name}"吗？`)) return

  loading.value = true
  errorMessage.value = ''
  try {
    await RoleAPI.remove(role.id)
    successMessage.value = '角色删除成功'
    await loadData()
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    loading.value = false
  }
}

function toggleCategory(categoryId) {
  const idx = selectedCategoryIds.value.indexOf(categoryId)
  if (idx === -1) {
    selectedCategoryIds.value.push(categoryId)
  } else {
    selectedCategoryIds.value.splice(idx, 1)
  }
}

function toggleSelectAll() {
  if (selectedCategoryIds.value.length === categories.value.length) {
    selectedCategoryIds.value = []
  } else {
    selectedCategoryIds.value = categories.value.map(c => c.id)
  }
}

async function handleCancel() {
  showModal.value = false
  editingRole.value = null
  form.value = { role_name: '', role_description: '', can_booking_all: false }
  selectedCategoryIds.value = []
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="role-page">
    <div class="page-header">
      <h2>角色管理</h2>
      <button class="btn btn-primary" @click="openAddModal">+ 新增角色</button>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else class="role-list">
      <div v-for="role in roles" :key="role.id" class="role-card">
        <div class="role-info">
          <div class="role-header">
            <span class="role-name">{{ role.role_name }}</span>
            <span v-if="role.can_booking_all" class="tag tag-success">可预约全部</span>
            <span v-else class="tag tag-warning">部分类别</span>
            <span v-if="role.role_name === 'admin' || role.role_name === 'user'" class="tag tag-disabled">系统</span>
          </div>
          <div class="role-desc">{{ role.role_description || '无描述' }}</div>
        </div>
        <div class="role-actions">
          <button class="btn btn-secondary" @click="openEditModal(role)">编辑</button>
          <button
            class="btn btn-danger"
            @click="handleDelete(role)"
            :disabled="role.role_name === 'admin' || role.role_name === 'user'"
          >
            删除
          </button>
        </div>
      </div>

      <div v-if="roles.length === 0" class="empty">暂无角色数据</div>
    </div>

    <!-- 模态框 -->
    <div v-if="showModal" class="modal-overlay" @click.self="handleCancel">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ editingRole ? '编辑角色' : '新增角色' }}</h3>
          <button class="close-btn" @click="handleCancel">&times;</button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>角色名称</label>
            <input
              v-model="form.role_name"
              type="text"
              placeholder="请输入角色名称"
              :disabled="editingRole && (form.role_name === 'admin' || form.role_name === 'user')"
            />
          </div>

          <div class="form-group">
            <label>角色描述</label>
            <input
              v-model="form.role_description"
              type="text"
              placeholder="请输入角色描述（选填）"
            />
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.can_booking_all" />
              <span>可预约全部类别</span>
            </label>
            <p class="hint">勾选后，该角色可预约所有类别的仪器</p>
          </div>

          <div v-if="!form.can_booking_all" class="form-group">
            <label>可预约类别</label>
            <div class="category-header">
              <label class="checkbox-label">
                <input
                  type="checkbox"
                  :checked="selectedCategoryIds.length === categories.length"
                  :indeterminate="selectedCategoryIds.length > 0 && selectedCategoryIds.length < categories.length"
                  @change="toggleSelectAll"
                />
                <span>全选</span>
              </label>
            </div>
            <div class="category-list">
              <div
                v-for="cat in categories"
                :key="cat.id"
                class="category-item"
                :class="{ selected: selectedCategoryIds.includes(cat.id) }"
                @click="toggleCategory(cat.id)"
              >
                <div class="cat-icon">
                  <img v-if="isImageUrl(cat.category_icon)" :src="cat.category_icon" :alt="cat.category_name" />
                  <span v-else>{{ cat.category_icon || '📱' }}</span>
                </div>
                <div class="cat-name">{{ cat.category_name }}</div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleCancel">取消</button>
          <button class="btn btn-primary" @click="handleSave" :disabled="loading">
            {{ loading ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.role-page {
  padding: var(--space-6);
  max-width: 900px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary);
}

.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-4);
  font-size: 14px;
}

.notice.error {
  background: var(--danger-soft);
  color: var(--danger);
}

.notice.success {
  background: var(--success-soft);
  color: var(--success);
}

.loading {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.role-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: box-shadow 0.2s;
}

.role-card:hover {
  box-shadow: var(--shadow-md);
}

.role-info {
  flex: 1;
}

.role-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.role-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.role-desc {
  font-size: 13px;
  color: var(--text-secondary);
}

.role-actions {
  display: flex;
  gap: var(--space-2);
}

.empty {
  text-align: center;
  padding: var(--space-6);
  color: var(--text-muted);
}

/* 模态框 */
.modal-overlay {
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
}

.modal {
  background: var(--card);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5);
  border-bottom: 1px solid var(--line);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-5);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5);
  border-top: 1px solid var(--line);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.form-group input[type="text"] {
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input[type="text"]:focus {
  border-color: var(--primary);
}

.form-group input[type="text"]:disabled {
  background: var(--disabled-soft);
  color: var(--text-muted);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: var(--space-1);
}

.category-header {
  margin-bottom: var(--space-3);
}

.category-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-3);
  max-height: 250px;
  overflow-y: auto;
  padding: var(--space-2);
  background: var(--bg);
  border-radius: var(--radius-md);
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  background: var(--card);
}

.category-item:hover {
  border-color: var(--primary);
}

.category-item.selected {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.cat-icon {
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.cat-name {
  font-size: 12px;
  color: var(--text-primary);
  margin-top: var(--space-1);
  text-align: center;
}
</style>
