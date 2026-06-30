<script setup>
import { ref, onMounted, computed } from 'vue'
import { UserAPI, InstrumentAPI, BookingAPI, CategoryAPI } from '@/api'
import { formatDate, getTodayDate } from '../../utils/date.js'

const loading = ref(true)
const stats = ref({
  totalInstruments: 0,
  totalCategories: 0,
  totalUsers: 0,
  todayBookings: 0
})

const recentBookings = ref([])

async function loadStats() {
  try {
    const [settings, categories, instruments, todayBookings, users] = await Promise.all([
      UserAPI.getSettings(),
      CategoryAPI.list(),
      InstrumentAPI.list(),
      BookingAPI.getByDate(getTodayDate()),
      UserAPI.listUsers()
    ])

    stats.value = {
      totalInstruments: instruments.length,
      totalCategories: categories.length,
      totalUsers: users.length,
      todayBookings: todayBookings.length
    }

    recentBookings.value = todayBookings.slice(0, 5).sort((a, b) => {
      return a.slot_start.localeCompare(b.slot_start)
    })
  } catch (e) {
    console.error('加载统计数据失败', e)
  } finally {
    loading.value = false
  }
}

const statCards = computed(() => [
  { label: '仪器总数', value: stats.value.totalInstruments, icon: '🔬', color: 'blue' },
  { label: '类别数量', value: stats.value.totalCategories, icon: '📁', color: 'green' },
  { label: '注册用户', value: stats.value.totalUsers, icon: '👥', color: 'orange' },
  { label: '今日预约', value: stats.value.todayBookings, icon: '📅', color: 'purple' }
])

onMounted(() => {
  loadStats()
})
</script>

<template>
  <div class="dashboard-page">
    <div v-if="loading" class="loading-text">加载中...</div>

    <template v-else>
      <div class="stats-grid">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="stat-card"
          :class="card.color"
        >
          <div class="stat-icon">{{ card.icon }}</div>
          <div class="stat-info">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <h3>今日预约</h3>
          <router-link to="/admin/booking" class="view-all">查看全部</router-link>
        </div>
        <div v-if="recentBookings.length === 0" class="empty-text">
          今日暂无预约
        </div>
        <div v-else class="booking-list">
          <div v-for="item in recentBookings" :key="item.id" class="booking-item">
            <div class="booking-info">
              <div class="booking-title">{{ item.instrument_name }}</div>
              <div class="booking-sub">
                {{ item.user_name }}（{{ item.employee_no || '无工号' }}）
              </div>
            </div>
            <div class="booking-time">{{ item.slot_start }} - {{ item.slot_end }}</div>
          </div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <h3>快捷操作</h3>
        </div>
        <div class="quick-actions">
          <router-link to="/admin/instrument" class="action-btn">
            <span class="action-icon">➕</span>
            <span>新增仪器</span>
          </router-link>
          <router-link to="/admin/user" class="action-btn">
            <span class="action-icon">👤</span>
            <span>用户管理</span>
          </router-link>
          <router-link to="/admin/lock" class="action-btn">
            <span class="action-icon">🔒</span>
            <span>锁定管理</span>
          </router-link>
          <router-link to="/admin/timeslot" class="action-btn">
            <span class="action-icon">⏰</span>
            <span>时段设置</span>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.loading-text {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-4);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  font-size: 32px;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-lg);
  background: var(--primary-soft);
}

.stat-card.blue .stat-icon { background: var(--primary-soft); }
.stat-card.green .stat-icon { background: var(--success-soft); }
.stat-card.orange .stat-icon { background: var(--warning-soft); }
.stat-card.purple .stat-icon { background: var(--warning-soft); }

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-label {
  font-size: 13px;
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

.view-all {
  font-size: 13px;
  color: var(--primary);
  text-decoration: none;
}

.view-all:hover {
  text-decoration: underline;
}

.booking-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.booking-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-3);
  background: var(--disabled-soft);
  border-radius: var(--radius-md);
}

.booking-info {
  flex: 1;
}

.booking-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.booking-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: var(--space-1);
}

.booking-time {
  font-size: 13px;
  font-weight: 500;
  color: var(--primary);
  background: var(--primary-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.quick-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-3);
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-5) var(--space-3);
  background: var(--disabled-soft);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: var(--text-primary);
  font-size: 13px;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--hover);
  transform: translateY(-2px);
}

.action-icon {
  font-size: 24px;
}

.empty-text {
  text-align: center;
  color: var(--text-muted);
  padding: 30px 0;
  font-size: 14px;
}
</style>
