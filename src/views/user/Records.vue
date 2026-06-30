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
  padding-bottom: var(--space-5);
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
  color: var(--text-primary);
}

.secondary-btn {
  background: var(--hover);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
}

.secondary-btn:disabled {
  background: var(--disabled-soft);
  color: var(--text-muted);
  cursor: not-allowed;
}

.record-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.record-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 14px;
  background: var(--bg);
  border-radius: var(--radius-lg);
}

.record-main {
  flex: 1;
  min-width: 0;
}

.record-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.record-sub {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.record-actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  flex-shrink: 0;
}

.status-badge.success {
  background: var(--success-soft);
  color: var(--success);
}

.cancel-btn {
  background: var(--danger-soft);
  color: var(--danger);
  border: none;
  border-radius: var(--radius-sm);
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.cancel-btn:hover {
  opacity: 0.8;
}

.cancel-btn:disabled {
  background: var(--disabled-soft);
  color: var(--text-muted);
  cursor: not-allowed;
}

.notice {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  margin: var(--space-2) 0;
}

.notice.error { background: var(--danger-soft); color: var(--danger); }
.notice.success { background: var(--success-soft); color: var(--success); }
.notice.loading { background: var(--primary-soft); color: var(--primary); }

.empty-text {
  text-align: center;
  color: var(--text-muted);
  padding: 30px 0;
  font-size: 14px;
}

.card-surface {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-md);
  margin-bottom: 14px;
}
</style>