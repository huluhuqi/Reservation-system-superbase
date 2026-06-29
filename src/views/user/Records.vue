<script setup>
import { ref, onMounted } from 'vue'
import { BookingAPI } from '@/api'

const serverRecords = ref([])
const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

async function loadServerRecords() {
  loading.value = true
  errorMessage.value = ''
  try {
    serverRecords.value = await BookingAPI.myBookings()
  } catch (e) {
    errorMessage.value = e.message || '加载记录失败'
  } finally {
    loading.value = false
  }
}

async function handleCancel(record) {
  const confirmed = window.confirm(
    `确定取消预约吗？\n\n仪器：${record.instrument_name}\n日期：${record.booking_date}\n时段：${record.slot_start} - ${record.slot_end}`
  )
  if (!confirmed) return

  operating.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await BookingAPI.remove(record.id)
    successMessage.value = '取消预约成功'
    await loadServerRecords()
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '取消失败'
  } finally {
    setTimeout(() => { operating.value = false }, 800)
  }
}

onMounted(() => {
  loadServerRecords()
})
</script>

<template>
  <div class="records-page">
    <div class="records-card card-surface">
      <div class="section-head">
        <h3>我的预约</h3>
        <button class="secondary-btn" type="button" @click="loadServerRecords" :disabled="loading">
          刷新
        </button>
      </div>

      <p v-if="loading" class="notice loading">加载中...</p>
      <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

      <div v-if="!loading && serverRecords.length === 0" class="empty-text">
        暂无预约记录
      </div>

      <div v-else class="record-list">
        <div v-for="item in serverRecords" :key="item.id" class="record-card">
          <div class="record-main">
            <div class="record-title">
              {{ item.instrument_name }}
            </div>
            <div class="record-sub">{{ item.booking_date }} · {{ item.slot_start }} - {{ item.slot_end }}</div>
            <div v-if="item.booking_remark" class="record-sub">备注：{{ item.booking_remark }}</div>
          </div>
          <div class="record-actions">
            <span class="status-badge success">已预约</span>
            <button
              class="cancel-btn"
              type="button"
              @click="handleCancel(item)"
              :disabled="operating"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.records-page {
  padding-bottom: 20px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.secondary-btn {
  background: #f0f4f9;
  color: #1f2a44;
  border: none;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.secondary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.record-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #f7f9fd;
  border-radius: 12px;
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
  margin-bottom: 4px;
}

.record-sub {
  font-size: 12px;
  color: #6b7a99;
  line-height: 1.6;
}

.record-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  flex-shrink: 0;
}

.status-badge.success {
  background: #f0f9f4;
  color: #27ae60;
}

.cancel-btn {
  background: #fef0f0;
  color: #e74c3c;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #fde8e8;
}

.cancel-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  margin: 10px 0;
}

.notice.error { background: #fef0f0; color: #e74c3c; }
.notice.success { background: #f0f9f4; color: #27ae60; }
.notice.loading { background: #f0f6ff; color: #4a90e2; }

.empty-text {
  text-align: center;
  color: #9aa8c4;
  padding: 30px 0;
  font-size: 14px;
}

.card-surface {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 18px;
  box-shadow: 0 2px 12px rgba(31, 42, 68, 0.06);
  margin-bottom: 14px;
}
</style>