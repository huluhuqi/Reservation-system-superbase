<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { TimeSlotAPI, CategoryAPI, InstrumentAPI } from '@/api'
import { formatDate, getTodayDate } from '../../utils/date.js'

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const categories = ref([])
const instruments = ref([])
const locks = ref([])

const lockType = ref('day')
const lockDate = ref(getTodayDate())
const selectedCategoryId = ref('')
const selectedInstrumentId = ref('')
const lockReason = ref('')
const selectedSlotIndexes = ref([])

const filteredInstruments = computed(() => {
  if (!selectedCategoryId.value) return instruments.value
  return instruments.value.filter(i => i.category_id === selectedCategoryId.value)
})

async function loadCategories() {
  try {
    categories.value = await CategoryAPI.list()
  } catch (e) {
    console.error(e)
  }
}

async function loadInstruments() {
  try {
    instruments.value = await InstrumentAPI.list()
  } catch (e) {
    console.error(e)
  }
}

async function loadLocks() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = {}
    if (selectedCategoryId.value) {
      params.category_id = selectedCategoryId.value
    }
    locks.value = await TimeSlotAPI.getLocks(params)
  } catch (e) {
    errorMessage.value = e.message || '加载锁定记录失败'
  } finally {
    loading.value = false
  }
}

async function addDayLock() {
  if (!selectedInstrumentId.value && !selectedCategoryId.value) {
    errorMessage.value = '请选择仪器或类别'
    return
  }

  operating.value = true
  errorMessage.value = ''
  try {
    await TimeSlotAPI.addLock({
      lock_type: 'day',
      lock_date: lockDate.value,
      instrument_id: selectedInstrumentId.value,
      category_id: selectedCategoryId.value,
      lock_reason: lockReason.value
    })
    successMessage.value = '锁定成功'
    lockReason.value = ''
    await loadLocks()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '锁定失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

async function deleteLock(lock) {
  const confirmed = window.confirm('确定删除该锁定吗？')
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  try {
    await TimeSlotAPI.removeLock(lock.id)
    successMessage.value = '删除锁定成功'
    await loadLocks()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

function getLockTarget(lock) {
  const inst = instruments.value.find(i => i.id === lock.instrument_id)
  if (inst) return inst.instrument_name
  const cat = categories.value.find(c => c.id === lock.category_id)
  if (cat) return cat.category_name + '（全部）'
  return '未知'
}

watch([selectedCategoryId], () => {
  selectedInstrumentId.value = ''
  loadLocks()
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadInstruments()])
  await loadLocks()
})
</script>

<template>
  <div class="admin-page">
    <div class="form-card">
      <div class="type-tabs">
        <button
          class="type-btn"
          :class="{ active: lockType === 'day' }"
          type="button"
          @click="lockType = 'day'"
        >
          整天锁定
        </button>
        <button
          class="type-btn"
          :class="{ active: lockType === 'slot' }"
          type="button"
          @click="lockType = 'slot'"
        >
          时段锁定
        </button>
      </div>

      <div class="form-row">
        <div class="field-block">
          <label>选择类别</label>
          <select v-model="selectedCategoryId">
            <option value="">全部</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.category_name }}</option>
          </select>
        </div>
        <div class="field-block">
          <label>选择仪器</label>
          <select v-model="selectedInstrumentId">
            <option value="">全部</option>
            <option v-for="inst in filteredInstruments" :key="inst.id" :value="inst.id">{{ inst.instrument_name }}</option>
          </select>
        </div>
        <div class="field-block">
          <label>锁定日期</label>
          <input v-model="lockDate" type="date" />
        </div>
      </div>

      <div class="field-block">
        <label>锁定原因（选填）</label>
        <input v-model="lockReason" type="text" placeholder="例如：设备维护" />
      </div>

      <button class="primary-btn" type="button" @click="addDayLock" :disabled="operating">
        {{ operating ? '处理中...' : '添加锁定' }}
      </button>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div class="list-card">
      <div class="list-header">
        <h3>锁定列表（{{ locks.length }} 条）</h3>
        <button class="secondary-btn" type="button" @click="loadLocks">刷新</button>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="locks.length === 0" class="empty-text">暂无锁定记录</div>
      <div v-else class="lock-list">
        <div v-for="lock in locks" :key="lock.id" class="lock-item">
          <div class="lock-info">
            <div class="lock-title">
              {{ getLockTarget(lock) }}
              <span class="lock-type">{{ lock.lock_type === 'day' ? '整天' : '时段' }}</span>
            </div>
            <div class="lock-sub">
              {{ lock.lock_date }}
              <span v-if="lock.lock_reason"> · {{ lock.lock_reason }}</span>
            </div>
          </div>
          <button class="text-btn danger" type="button" @click="deleteLock(lock)" :disabled="operating">
            解除
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

.form-card,
.list-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
}

.type-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.type-btn {
  padding: var(--space-2) var(--space-5);
  background: var(--hover);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
}

.type-btn.active {
  background: var(--primary);
  color: white;
}

.form-row {
  display: flex;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  flex-wrap: wrap;
}

.field-block {
  flex: 1;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.field-block label {
  font-size: 13px;
  color: var(--text-secondary);
}

.field-block input,
.field-block select {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
}

.field-block input:focus,
.field-block select:focus {
  border-color: var(--primary);
}

.primary-btn {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-6);
  font-size: 14px;
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: var(--hover);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-4);
  font-size: 13px;
  cursor: pointer;
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

.lock-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.lock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--warning-soft);
  border-radius: var(--radius-md);
}

.lock-info {
  flex: 1;
}

.lock-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.lock-type {
  font-size: 11px;
  padding: 2px var(--space-2);
  background: var(--warning);
  color: white;
  border-radius: var(--radius-md);
  font-weight: normal;
}

.lock-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.text-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
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
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 14px;
}

.notice.error { background: var(--danger-soft); color: var(--danger); }
.notice.success { background: var(--success-soft); color: var(--success); }
</style>
