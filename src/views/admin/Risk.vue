<script setup>
import { ref, onMounted } from 'vue'
import { userApi } from '../../api/user.js'
import { bookingApi } from '../../api/booking.js'

const loading = ref(false)
const errorMessage = ref('')
const riskStats = ref({
  totalBookings: 0,
  totalUsers: 0,
  highRiskUsers: [],
  recentCancellations: 0
})

const riskRules = ref([
  { id: 1, name: '单日预约次数限制', value: 5, enabled: true },
  { id: 2, name: '取消预约次数限制', value: 3, enabled: true },
  { id: 3, name: '预约超时提醒', value: 30, enabled: true, unit: '分钟' }
])

async function loadRiskData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [users, bookings] = await Promise.all([
      userApi.getRegisteredUsers(),
      bookingApi.getBookings({})
    ])

    const userBookingCount = {}
    for (const b of bookings) {
      const key = `${b.user_name}-${b.employee_no}`
      userBookingCount[key] = (userBookingCount[key] || 0) + 1
    }

    const highRiskUsers = users
      .map(u => ({
        ...u,
        bookingCount: userBookingCount[`${u.user_name}-${u.employee_no}`] || 0
      }))
      .filter(u => u.bookingCount >= 10)
      .sort((a, b) => b.bookingCount - a.bookingCount)
      .slice(0, 10)

    riskStats.value = {
      totalBookings: bookings.length,
      totalUsers: users.length,
      highRiskUsers,
      recentCancellations: 0
    }
  } catch (e) {
    errorMessage.value = e.message || '加载风险数据失败'
  } finally {
    loading.value = false
  }
}

function toggleRule(rule) {
  rule.enabled = !rule.enabled
}

onMounted(() => {
  loadRiskData()
})
</script>

<template>
  <div class="admin-page">
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <div class="stat-value">{{ riskStats.totalBookings }}</div>
          <div class="stat-label">总预约数</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-info">
          <div class="stat-value">{{ riskStats.totalUsers }}</div>
          <div class="stat-label">注册用户</div>
        </div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info">
          <div class="stat-value">{{ riskStats.highRiskUsers.length }}</div>
          <div class="stat-label">高风险用户</div>
        </div>
      </div>
    </div>

    <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>

    <div class="panel-card">
      <div class="panel-header">
        <h3>高风险用户（预约频次前 10）</h3>
        <button class="secondary-btn" type="button" @click="loadRiskData">刷新</button>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="riskStats.highRiskUsers.length === 0" class="empty-text">
        暂无高风险用户
      </div>
      <div v-else class="risk-list">
        <div v-for="(user, index) in riskStats.highRiskUsers" :key="`${user.user_name}-${user.employee_no}`" class="risk-item">
          <div class="rank">{{ index + 1 }}</div>
          <div class="user-info">
            <div class="user-name">{{ user.user_name }}</div>
            <div class="user-no">工号：{{ user.employee_no }}</div>
          </div>
          <div class="booking-count">
            <span class="count-value">{{ user.bookingCount }}</span>
            <span class="count-label">次预约</span>
          </div>
        </div>
      </div>
    </div>

    <div class="panel-card">
      <div class="panel-header">
        <h3>风控规则配置</h3>
      </div>
      <div class="rule-list">
        <div v-for="rule in riskRules" :key="rule.id" class="rule-item">
          <div class="rule-info">
            <div class="rule-name">{{ rule.name }}</div>
            <div class="rule-desc">
              阈值：{{ rule.value }}{{ rule.unit || '次' }}
            </div>
          </div>
          <label class="toggle-switch">
            <input type="checkbox" :checked="rule.enabled" @change="toggleRule(rule)" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <p class="hint-text">提示：风控规则功能正在完善中，当前仅用于展示</p>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-card.warning {
  background: linear-gradient(135deg, #fff7e6 0%, #ffe8cc 100%);
}

.stat-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f6ff;
  border-radius: 10px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2a44;
}

.stat-label {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 2px;
}

.panel-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-header h3 {
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

.risk-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.risk-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f7f9fd;
  border-radius: 10px;
}

.rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #4a90e2;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.user-no {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 2px;
}

.booking-count {
  text-align: right;
}

.count-value {
  font-size: 18px;
  font-weight: 700;
  color: #e74c3c;
}

.count-label {
  font-size: 12px;
  color: #6b7a99;
  margin-left: 4px;
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: #f7f9fd;
  border-radius: 10px;
}

.rule-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.rule-desc {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 4px;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  display: none;
}

.slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #d0d7e2;
  border-radius: 24px;
  transition: 0.3s;
}

.slider::before {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  left: 2px;
  bottom: 2px;
  background: white;
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-switch input:checked + .slider {
  background: #4a90e2;
}

.toggle-switch input:checked + .slider::before {
  transform: translateX(20px);
}

.hint-text {
  margin: 16px 0 0;
  font-size: 12px;
  color: #9aa8c4;
  text-align: center;
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
</style>
