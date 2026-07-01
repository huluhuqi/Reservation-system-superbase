<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
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

// 动画状态
const isRefreshing = ref(false)
const newItemId = ref(null)
const deletingId = ref(null)

// 拖拽排序状态
const draggingId = ref(null)
const dragOverId = ref(null)
const savingSort = ref(false)

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
  isRefreshing.value = true
  try {
    instruments.value = await InstrumentAPI.list()
  } catch (e) {
    error_message.value = e.message || '加载仪器失败'
  } finally {
    loading.value = false
    // 延迟移除刷新动画类
    setTimeout(() => {
      isRefreshing.value = false
    }, 600)
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
    const newInstrument = await InstrumentAPI.create({
      instrument_name,
      category_id: category_id
    })
    form.value.instrument_name = ''
    success_message.value = '新增仪器成功'
    await loadInstruments()
    // 设置新增项ID用于动画
    if (newInstrument && newInstrument.id) {
      newItemId.value = newInstrument.id
      setTimeout(() => {
        newItemId.value = null
      }, 600)
    }
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

  // 先添加删除动画类
  deletingId.value = item.id

  // 等待动画完成后再执行删除
  setTimeout(async () => {
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
      deletingId.value = null
      setTimeout(() => {
        operating.value = false
      }, 1200)
    }
  }, 350)
}

function getCategoryName(category_id) {
  const cat = categories.value.find(c => c.id === category_id)
  return cat?.category_name || '未知类别'
}

onMounted(async () => {
  await loadCategories()
  await loadInstruments()
})

// 拖拽排序
function handleDragStart(event, item) {
  draggingId.value = item.id
  event.dataTransfer.effectAllowed = 'move'
  event.target.classList.add('dragging')
}

function handleDragEnd(event) {
  event.target.classList.remove('dragging')
  draggingId.value = null
  dragOverId.value = null
}

function handleDragOver(event, item) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  if (item.id !== draggingId.value) {
    dragOverId.value = item.id
  }
}

function handleDragLeave() {
  dragOverId.value = null
}

async function handleDrop(event, targetItem) {
  event.preventDefault()
  const draggedId = draggingId.value
  if (!draggedId || draggedId === targetItem.id) {
    draggingId.value = null
    dragOverId.value = null
    return
  }

  const list = filtered_instruments.value
  const draggedIndex = list.findIndex(i => i.id === draggedId)
  const targetIndex = list.findIndex(i => i.id === targetItem.id)

  if (draggedIndex === -1 || targetIndex === -1) return

  // 交换位置
  const draggedItem = list[draggedIndex]
  list.splice(draggedIndex, 1)
  list.splice(targetIndex, 0, draggedItem)

  draggingId.value = null
  dragOverId.value = null

  // 保存排序
  savingSort.value = true
  try {
    await InstrumentAPI.updateSortOrder(list)
    success_message.value = '排序已保存'
    setTimeout(() => { success_message.value = '' }, 1500)
  } catch (e) {
    error_message.value = '排序保存失败：' + (e.message || '')
    await loadInstruments()
  } finally {
    savingSort.value = false
  }
}
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
        <button class="secondary-btn btn-animate" type="button" @click="cancelEdit">取消</button>
        <button class="primary-btn btn-animate" type="button" @click="saveInstrument" :disabled="operating">
          {{ operating ? '处理中...' : '保存修改' }}
        </button>
      </div>
      <button v-else class="primary-btn btn-animate" type="button" @click="addInstrument" :disabled="operating">
        {{ operating ? '处理中...' : '新增仪器' }}
      </button>
    </div>

    <p v-if="error_message" class="notice error">{{ error_message }}</p>
    <p v-if="success_message" class="notice success">{{ success_message }}</p>

    <div class="list-card">
      <div class="list-header">
        <h3>仪器列表（{{ filtered_instruments.length }} 台）</h3>
        <div class="filter-select">
          <span v-if="savingSort" class="sort-saving">保存排序中...</span>
          <select v-model="selected_category_id">
            <option value="">全部类别</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.category_name }}</option>
          </select>
          <button class="secondary-btn btn-animate" type="button" @click="loadInstruments">刷新</button>
        </div>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="filtered_instruments.length === 0" class="empty-text">暂无仪器</div>
      <div v-else class="instrument-list">
        <div
          v-for="item in filtered_instruments"
          :key="item.id"
          class="instrument-item"
          :class="{
            'list-refresh-item': isRefreshing,
            'blinds-enter': newItemId === item.id,
            'wipe-out': deletingId === item.id,
            'dragging': draggingId === item.id,
            'drag-over': dragOverId === item.id
          }"
          draggable="true"
          @dragstart="handleDragStart($event, item)"
          @dragend="handleDragEnd($event)"
          @dragover="handleDragOver($event, item)"
          @dragleave="handleDragLeave"
          @drop="handleDrop($event, item)"
        >
          <div class="drag-handle" title="拖拽排序">⋮⋮</div>
          <div class="instrument-info">
            <div class="instrument-name">{{ item.instrument_name }}</div>
            <div class="instrument-category">{{ getCategoryName(item.category_id) }}</div>
            <div v-if="item.description" class="instrument-desc">{{ item.description }}</div>
          </div>
          <div class="instrument-actions">
            <button class="text-btn btn-animate" type="button" @click="editInstrument(item)" :disabled="operating">
              编辑
            </button>
            <button class="text-btn danger btn-animate" type="button" @click="deleteInstrument(item)" :disabled="operating">
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
  gap: var(--space-4);
}

.form-card,
.list-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.form-card h3 {
  margin: 0 0 var(--space-4);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.field-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-block label {
  font-size: 13px;
  color: var(--text-secondary);
}

.field-block input,
.field-block select,
.field-block textarea {
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
}

.field-block textarea {
  resize: vertical;
}

.field-block input:focus,
.field-block select:focus,
.field-block textarea:focus {
  border-color: var(--primary);
}

.primary-btn {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.primary-btn:disabled {
  background: var(--disabled);
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  gap: var(--space-3);
}

.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.filter-select {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.filter-select select {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 13px;
  outline: none;
}

.secondary-btn {
  background: var(--hover);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary-btn:hover {
  background: var(--line);
}

.instrument-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: var(--space-3);
}

.instrument-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  background: var(--bg);
  border-radius: var(--radius-md);
  cursor: grab;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.instrument-item:hover {
  background: var(--hover);
}

.instrument-item.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.instrument-item.drag-over {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.drag-handle {
  cursor: grab;
  color: var(--text-muted);
  font-size: 14px;
  padding: 0 4px;
  user-select: none;
}

.drag-handle:active {
  cursor: grabbing;
}

.sort-saving {
  font-size: 12px;
  color: var(--text-muted);
}

.instrument-info {
  flex: 1;
}

.instrument-actions {
  display: flex;
  gap: var(--space-2);
}

.instrument-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.instrument-category {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.instrument-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: var(--space-1);
  font-style: italic;
}

.text-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.text-btn:hover:not(:disabled) {
  background: var(--hover);
}

.text-btn.danger {
  color: var(--danger);
}

.text-btn.danger:hover {
  background: var(--danger-soft);
}

.text-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-text,
.empty-text {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
  font-size: 14px;
}

.notice {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
}

.notice.error { background: var(--danger-soft); color: var(--danger); }
.notice.success { background: var(--success-soft); color: var(--success); }

/* 按钮点击跳动特效 */
.btn-animate {
  transition: transform 0.15s ease;
}
.btn-animate:active:not(:disabled) {
  animation: btn-bounce 0.3s ease;
}
@keyframes btn-bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.95); }
}

/* 列表刷新百叶窗特效 */
.list-refresh-item {
  animation: blinds-refresh 0.6s ease;
}
@keyframes blinds-refresh {
  0% {
    opacity: 0;
    transform: translateY(-10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 新增项百叶窗进入特效 */
.blinds-enter {
  animation: blinds-enter 0.6s ease;
}
@keyframes blinds-enter {
  0% {
    opacity: 0;
    transform: scaleY(0);
    transform-origin: top;
  }
  100% {
    opacity: 1;
    transform: scaleY(1);
  }
}

/* 删除项擦除特效 */
.wipe-out {
  animation: wipe-out 0.35s ease forwards;
}
@keyframes wipe-out {
  0% {
    opacity: 1;
    transform: translateX(0);
  }
  100% {
    opacity: 0;
    transform: translateX(100%);
  }
}

/* 模态框动画（如需要可添加 modal-box 元素） */
.modal-animate {
  animation: modal-fade-in 0.3s ease;
}
@keyframes modal-fade-in {
  0% {
    opacity: 0;
    transform: scale(0.9);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
