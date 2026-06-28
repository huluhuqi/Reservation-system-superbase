<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { bookingApi } from '../../api/booking.js'
import { instrumentApi } from '../../api/instrument.js'
import { categoryApi } from '../../api/category.js'
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

async function loadBookings() {
  loading.value = true
  errorMessage.value = ''
  try {
    const params = { date: selectedDate.value }
    if (selectedCategoryId.value) {
      params.category_id = selectedCategoryId.value
    }
    const records = await bookingApi.getBookings(params)
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
    const recordId = record._id
    await bookingApi.deleteBooking(recordId)
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
          <option v-for="cat in categories" :key="cat._id" :value="cat._id">{{ cat.category_name }}</option>
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
        <div v-for="record in bookingRecords" :key="record._id" class="record-row">
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
  gap: 16px;
}

.filter-bar {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  background: white;
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-item label {
  font-size: 13px;
  color: #6b7a99;
}

.filter-item select,
.filter-item input {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  min-width: 160px;
}

.filter-item select:focus,
.filter-item input:focus {
  border-color: #4a90e2;
}

.data-table-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.table-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2a44;
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

.secondary-btn:hover {
  background: #e4eaf2;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #f7f9fd;
  border-radius: 10px;
}

.record-main {
  flex: 1;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.record-sub {
  font-size: 13px;
  color: #6b7a99;
  margin-top: 4px;
}

.record-date {
  font-size: 12px;
  color: #9aa8c4;
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
  padding: 40px;
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
