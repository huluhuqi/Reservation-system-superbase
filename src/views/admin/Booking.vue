<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { BookingAPI, InstrumentAPI, CategoryAPI } from '@/api'
import { formatDate, getTodayDate } from '../../utils/date.js'

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const operating = ref(false)

const categories = ref([])
const instruments = ref([])
const selectedCategoryId = ref('')
const selectedDate = ref(getTodayDate())
const bookingRecords = ref([])

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

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const records = await BookingAPI.getByDate(selectedDate.value, null, selectedCategoryId.value || null)
    bookingRecords.value = records.sort((a, b) => {
      const aKey = `${a.instrument_name || ''}_${a.slot_start || ''}`
      const bKey = `${b.instrument_name || ''}_${b.slot_start || ''}`
      return aKey.localeCompare(bKey)
    })
  } catch (e) {
    errorMessage.value = e.message || '加载预约记录失败'
  } finally {
    loading.value = false
  }
}

async function deleteBooking(record) {
  const confirmed = window.confirm(
    `确定删除 ${record.user_name} 在 ${record.instrument_name} ${record.slot_start}-${record.slot_end} 的预约吗？`
  )
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  try {
    const recordId = record.id
    await BookingAPI.remove(recordId)
    successMessage.value = '已删除预约记录'
    await loadBookings()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '删除失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

watch([selectedDate, selectedCategoryId], () => {
  loadBookings()
})

onMounted(async () => {
  await Promise.all([loadCategories(), loadInstruments()])
  await loadBookings()
})
</script>

<template>
  <div class="admin-page">
    <div class="filter-bar">
      <div class="filter-item">
        <label>选择类别</label>
        <select v-model="selectedCategoryId">
          <option value="">全部类别</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.category_name }}</option>
        </select>
      </div>
      <div class="filter-item">
        <label>选择日期</label>
        <input v-model="selectedDate" type="date" />
      </div>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div class="data-table-card">
      <div class="table-header">
        <h3>预约记录（{{ bookingRecords.length }} 条）</h3>
        <button class="secondary-btn" type="button" @click="loadBookings">刷新</button>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="bookingRecords.length === 0" class="empty-text">
        暂无预约记录
      </div>
      <div v-else class="record-list">
        <div v-for="record in bookingRecords" :key="record.id" class="record-row">
          <div class="record-main">
            <div class="record-title">
              {{ record.instrument_name }} · {{ record.slot_start }} - {{ record.slot_end }}
            </div>
            <div class="record-sub">
              {{ record.user_name }}（工号：{{ record.employee_no || '无' }}）
              <span v-if="record.booking_remark"> · {{ record.booking_remark }}</span>
            </div>
            <div class="record-date">{{ record.booking_date }}</div>
          </div>
          <button
            class="text-btn danger"
            type="button"
            @click="deleteBooking(record)"
            :disabled="operating"
          >
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
  gap: var(--space-4);
}

.filter-bar {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
  background: var(--card);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.filter-item label {
  font-size: 13px;
  color: var(--text-secondary);
}

.filter-item select,
.filter-item input {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  min-width: 160px;
}

.filter-item select:focus,
.filter-item input:focus {
  border-color: var(--primary);
}

.data-table-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
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

.secondary-btn:hover {
  background: var(--line);
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.record-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--disabled-soft);
  border-radius: var(--radius-md);
}

.record-main {
  flex: 1;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.record-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.record-date {
  font-size: 12px;
  color: var(--text-muted);
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
  padding: 40px;
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
