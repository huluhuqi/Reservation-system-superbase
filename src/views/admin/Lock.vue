<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { timeSlotApi } from '../../api/timeSlot.js'
import { categoryApi } from '../../api/category.js'
import { instrumentApi } from '../../api/instrument.js'
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
    categories.value = await categoryApi.getCategories()
  } catch (e) {
    console.error(e)
  }
}

async function loadInstruments() {
  try {
    instruments.value = await instrumentApi.getInstruments()
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
    locks.value = await timeSlotApi.getLocks(params)
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
    await timeSlotApi.createLock({
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
    await timeSlotApi.deleteLock(lock._id || lock.record_id)
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
  const inst = instruments.value.find(i => i._id === lock.instrument_id)
  if (inst) return inst.instrument_name
  const cat = categories.value.find(c => c._id === lock.category_id)
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
            <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.category_name }}</option>
          </select>
        </div>
        <div class="field-block">
          <label>选择仪器</label>
          <select v-model="selectedInstrumentId">
            <option value="">全部</option>
            <option v-for="inst in filteredInstruments" :key="inst._id" :value="inst._id">{{ inst.instrument_name }}</option>
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
        <div v-for="lock in locks" :key="lock._id" class="lock-item">
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
  gap: 16px;
}

.form-card,
.list-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.type-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.type-btn {
  padding: 8px 20px;
  background: #f0f4f9;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  color: #6b7a99;
  cursor: pointer;
}

.type-btn.active {
  background: #4a90e2;
  color: white;
}

.form-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.field-block {
  flex: 1;
  min-width: 150px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-block label {
  font-size: 13px;
  color: #6b7a99;
}

.field-block input,
.field-block select {
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
}

.field-block input:focus,
.field-block select:focus {
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

.list-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
}

.lock-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lock-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #fff7e6;
  border-radius: 10px;
}

.lock-info {
  flex: 1;
}

.lock-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
  display: flex;
  align-items: center;
  gap: 8px;
}

.lock-type {
  font-size: 11px;
  padding: 2px 8px;
  background: #f39c12;
  color: white;
  border-radius: 10px;
  font-weight: normal;
}

.lock-sub {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 4px;
}

.text-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 12px;
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
