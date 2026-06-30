<script setup>
import { ref, onMounted, computed } from 'vue'
import { InstrumentAPI, CategoryAPI } from '@/api'

const loading = ref(false)
const operating = ref(false)
const error_message = ref('')
const success_message = ref('')

const categories = ref([])
const instruments = ref([])
const selected_category_id = ref('')

const form = ref({
  instrument_name: '',
  category_id: '',
  description: ''
})
const editMode = ref(false)
const editingId = ref(null)

const filtered_instruments = computed(() => {
  if (!selected_category_id.value) return instruments.value
  return instruments.value.filter(i => i.category_id === selected_category_id.value)
})

async function loadCategories() {
  try {
    categories.value = await CategoryAPI.list()
    if (categories.value.length > 0 && !form.value.category_id) {
      form.value.category_id = categories.value[0].id
    }
  } catch (e) {
    console.error(e)
  }
}

async function loadInstruments() {
  loading.value = true
  try {
    instruments.value = await InstrumentAPI.list()
  } catch (e) {
    error_message.value = e.message || '加载仪器失败'
  } finally {
    loading.value = false
  }
}

async function addInstrument() {
  const instrument_name = form.value.instrument_name.trim()
  const category_id = form.value.category_id

  if (!instrument_name) {
    error_message.value = '请输入仪器名称'
    return
  }
  if (!category_id) {
    error_message.value = '请先创建仪器类别'
    return
  }

  operating.value = true
  error_message.value = ''
  try {
    await InstrumentAPI.create({
      instrument_name,
      category_id: category_id
    })
    form.value.instrument_name = ''
    success_message.value = '新增仪器成功'
    await loadInstruments()
    setTimeout(() => { success_message.value = '' }, 2000)
  } catch (e) {
    error_message.value = e.message || '新增失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

function editInstrument(item) {
  editingId.value = item.id
  form.value.instrument_name = item.instrument_name
  form.value.category_id = item.category_id
  form.value.description = item.description || ''
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
  editingId.value = null
  form.value.instrument_name = ''
  form.value.category_id = categories.value[0]?.id || ''
  form.value.description = ''
}

async function saveInstrument() {
  const instrument_name = form.value.instrument_name.trim()
  const category_id = form.value.category_id

  if (!instrument_name) {
    error_message.value = '请输入仪器名称'
    return
  }
  if (!category_id) {
    error_message.value = '请先创建仪器类别'
    return
  }

  operating.value = true
  error_message.value = ''
  try {
    await InstrumentAPI.update(editingId.value, {
      instrument_name,
      category_id,
      description: form.value.description.trim()
    })
    cancelEdit()
    success_message.value = '修改仪器成功'
    await loadInstruments()
    setTimeout(() => { success_message.value = '' }, 2000)
  } catch (e) {
    error_message.value = e.message || '修改失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

async function deleteInstrument(item) {
  const confirmed = window.confirm(`确定删除仪器"${item.instrument_name}"吗？`)
  if (!confirmed) return

  operating.value = true
  error_message.value = ''
  try {
    await InstrumentAPI.remove(item.id)
    success_message.value = '删除仪器成功'
    await loadInstruments()
    setTimeout(() => { success_message.value = '' }, 2000)
  } catch (e) {
    error_message.value = e.message || '删除失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

function getCategoryName(category_id) {
  const cat = categories.value.find(c => c.id === category_id)
  return cat?.category_name || '未知类别'
}

onMounted(async () => {
  await loadCategories()
  await loadInstruments()
})
</script>

<template>
  <div class="admin-page">
    <div class="form-card">
      <h3>{{ editMode ? '编辑仪器' : '新增仪器' }}</h3>
      <div class="form-row">
        <div class="field-block">
          <label>所属类别</label>
          <select v-model="form.category_id">
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.category_name }}</option>
          </select>
        </div>
        <div class="field-block">
          <label>仪器名称</label>
          <input
            v-model="form.instrument_name"
            type="text"
            placeholder="例如：显微镜A"
            @keydown.enter.prevent="editMode ? saveInstrument() : addInstrument()"
          />
        </div>
      </div>
      <div class="form-row">
        <div class="field-block" style="flex: 2;">
          <label>备注（选填）</label>
          <textarea
            v-model="form.description"
            placeholder="输入仪器备注信息..."
            rows="3"
          ></textarea>
        </div>
      </div>
      <div class="form-actions" v-if="editMode">
        <button class="secondary-btn" type="button" @click="cancelEdit">取消</button>
        <button class="primary-btn" type="button" @click="saveInstrument" :disabled="operating">
          {{ operating ? '处理中...' : '保存修改' }}
        </button>
      </div>
      <button v-else class="primary-btn" type="button" @click="addInstrument" :disabled="operating">
        {{ operating ? '处理中...' : '新增仪器' }}
      </button>
    </div>

    <p v-if="error_message" class="notice error">{{ error_message }}</p>
    <p v-if="success_message" class="notice success">{{ success_message }}</p>

    <div class="list-card">
      <div class="list-header">
        <h3>仪器列表（{{ filtered_instruments.length }} 台）</h3>
        <div class="filter-select">
          <select v-model="selected_category_id">
            <option value="">全部类别</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.category_name }}</option>
          </select>
          <button class="secondary-btn" type="button" @click="loadInstruments">刷新</button>
        </div>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="filtered_instruments.length === 0" class="empty-text">暂无仪器</div>
      <div v-else class="instrument-list">
        <div v-for="item in filtered_instruments" :key="item.id" class="instrument-item">
          <div class="instrument-info">
            <div class="instrument-name">{{ item.instrument_name }}</div>
            <div class="instrument-category">{{ getCategoryName(item.category_id) }}</div>
            <div v-if="item.description" class="instrument-desc">{{ item.description }}</div>
          </div>
          <div class="instrument-actions">
            <button class="text-btn" type="button" @click="editInstrument(item)" :disabled="operating">
              编辑
            </button>
            <button class="text-btn danger" type="button" @click="deleteInstrument(item)" :disabled="operating">
              删除
            </button>
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

.field-block input,
.field-block select,
.field-block textarea {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.field-block textarea {
  resize: vertical;
}

.field-block input:focus,
.field-block select:focus,
.field-block textarea:focus {
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

.form-actions {
  display: flex;
  gap: 12px;
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

.filter-select {
  display: flex;
  gap: 10px;
  align-items: center;
}

.filter-select select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
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

.instrument-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 10px;
}

.instrument-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  background: #f7f9fd;
  border-radius: 10px;
}

.instrument-info {
  flex: 1;
}

.instrument-actions {
  display: flex;
  gap: 8px;
}

.instrument-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.instrument-category {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 4px;
}

.instrument-desc {
  font-size: 12px;
  color: #8a9ab5;
  margin-top: 4px;
  font-style: italic;
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
