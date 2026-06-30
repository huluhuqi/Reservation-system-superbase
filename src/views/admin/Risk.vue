<script setup>
import { ref, onMounted } from 'vue'
import { UserAPI, BookingAPI } from '@/api'

const loading = ref(false)
const errorMessage = ref('')
const riskStats = ref({
  totalBookings: 0,
  totalUsers: 0,
  highRiskUsers: [],
  recentCancellations: 0
})

const riskRules = ref([
  { id: 1, name: '单日预约次数限制', value: 20, enabled: true },
  { id: 2, name: '取消预约次数限制', value: 20, enabled: true },
  { id: 3, name: '预约超时提醒', value: 30, enabled: true, unit: '分钟' }
])

async function loadRiskData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [users, bookings] = await Promise.all([
      UserAPI.listUsers(),
      BookingAPI.list()
    ])

    const userBookingCount = {}
    for (const b of bookings) {
      const key = b.user_id
      userBookingCount[key] = (userBookingCount[key] || 0) + 1
    }

    const highRiskUsers = users
      .map(u => ({
        ...u,
        bookingCount: userBookingCount[u.id] || 0
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
        <div v-for="(user, index) in riskStats.highRiskUsers" :key="user.id" class="risk-item">
          <div class="rank">{{ index + 1 }}</div>
          <div class="user-info">
            <div class="user-name">{{ user.username || user.email }}</div>
            <div class="user-no">{{ user.email }}</div>
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
  gap: var(--space-4);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.stat-card.warning {
  background: var(--warning-soft);
}

.stat-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-soft);
  border-radius: var(--radius-md);
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.panel-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.panel-header h3 {
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

.risk-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.risk-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3);
  background: var(--disabled-soft);
  border-radius: var(--radius-md);
}

.rank {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary);
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
  color: var(--text-primary);
}

.user-no {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.booking-count {
  text-align: right;
}

.count-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--danger);
}

.count-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: var(--space-1);
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  background: var(--disabled-soft);
  border-radius: var(--radius-md);
}

.rule-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.rule-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
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
  background: var(--disabled);
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
  background: var(--card);
  border-radius: 50%;
  transition: 0.3s;
}

.toggle-switch input:checked + .slider {
  background: var(--primary);
}

.toggle-switch input:checked + .slider::before {
  transform: translateX(20px);
}

.hint-text {
  margin: var(--space-4) 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
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
</style>
