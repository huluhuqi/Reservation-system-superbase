<script setup>
import { ref, computed, onMounted } from 'vue'
import { getUser } from '../../api/context.js'
import { bookingApi } from '../../api/booking.js'

const serverRecords = ref([])
const loading = ref(false)
const errorMessage = ref('')

const userInfo = computed(() => getUser())

async function loadServerRecords() {
  if (!userInfo.value) return
  loading.value = true
  try {
    const allBookings = await bookingApi.getBookings({})
    serverRecords.value = allBookings
      .filter(b => b.user_name === userInfo.value.user_name && b.employee_no === userInfo.value.employee_no)
      .sort((a, b) => {
        const dateCompare = b.booking_date.localeCompare(a.booking_date)
        if (dateCompare !== 0) return dateCompare
        return b.slot_start.localeCompare(a.slot_start)
      })
  } catch (e) {
    errorMessage.value = e.message || '加载记录失败'
  } finally {
    loading.value = false
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
      </div>

      <p v-if="loading" class="notice loading">加载中...</p>
      <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

      <div v-if="!loading && serverRecords.length === 0" class="empty-text">
        暂无预约记录
      </div>

      <div v-else class="record-list">
        <div v-for="item in serverRecords" :key="item._id || item.id" class="record-card">
          <div class="record-main">
            <div class="record-title">
              {{ item.instrument_name }}
            </div>
            <div class="record-sub">{{ item.booking_date }} · {{ item.slot_start }} - {{ item.slot_end }}</div>
            <div v-if="item.remark" class="record-sub">备注：{{ item.remark }}</div>
          </div>
          <span class="status-badge success">已预约</span>
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

.notice {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  margin: 10px 0;
}

.notice.error { background: #fef0f0; color: #e74c3c; }
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
