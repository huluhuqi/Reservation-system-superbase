<script setup>
import { ref, onMounted } from 'vue'
import { categoryApi } from '../../api/category.js'

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const categories = ref([])
const form = ref({
  category_name: '',
  category_icon: ''
})

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await categoryApi.getCategories()
  } catch (e) {
    errorMessage.value = e.message || '加载类别失败'
  } finally {
    loading.value = false
  }
}

async function addCategory() {
  const category_name = form.value.category_name.trim()
  if (!category_name) {
    errorMessage.value = '请输入类别名称'
    return
  }

  operating.value = true
  errorMessage.value = ''
  try {
    await categoryApi.createCategory({
      category_name,
      category_icon: form.value.category_icon.trim()
    })
    form.value.category_name = ''
    form.value.category_icon = ''
    successMessage.value = '新增类别成功'
    await loadCategories()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '新增失败'
  } finally {
    operating.value = false
  }
}

async function deleteCategory(item) {
  const confirmed = window.confirm(
    `确定删除类别"${item.category_name}"吗？该类别下的所有仪器和预约记录也会被删除。`
  )
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  try {
    await categoryApi.deleteCategory(item._id)
    successMessage.value = '删除类别成功'
    await loadCategories()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    operating.value = false
  }
}

onMounted(() => {
  loadCategories()
})
</script>

<template>
  <div class="admin-page">
    <div class="form-card">
      <h3>新增类别</h3>
      <div class="form-row">
        <div class="field-block">
          <label>类别名称</label>
          <input v-model="form.category_name" type="text" placeholder="例如：显微镜" @keydown.enter.prevent="addCategory" />
        </div>
        <div class="field-block">
          <label>图标（选填）</label>
          <input v-model="form.category_icon" type="text" placeholder="例如：🔬" @keydown.enter.prevent="addCategory" />
        </div>
      </div>
      <button class="primary-btn" type="button" @click="addCategory" :disabled="operating">
        {{ operating ? '处理中...' : '新增类别' }}
      </button>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div class="list-card">
      <div class="list-header">
        <h3>类别列表（{{ categories.length }} 个）</h3>
        <button class="secondary-btn" type="button" @click="loadCategories">刷新</button>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="categories.length === 0" class="empty-text">暂无类别</div>
      <div v-else class="category-list">
        <div v-for="item in categories" :key="item._id" class="category-item">
          <div class="category-info">
            <span class="category-icon">{{ item.category_icon || '📱' }}</span>
            <span class="category-name">{{ item.category_name }}</span>
          </div>
          <button class="text-btn danger" type="button" @click="deleteCategory(item)" :disabled="operating">
            删除
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

.form-card,
.list-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.form-card h3,
.list-header h3 {
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

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.category-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  background: #f7f9fd;
  border-radius: 10px;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.category-icon {
  font-size: 24px;
}

.category-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
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
