<script setup>
import { ref, onMounted } from 'vue'
import { UserAPI, BookingAPI } from '@/api'

const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const riskStats = ref({
  totalBookings: 0,
  totalUsers: 0,
  highRiskUsers: [],
  recentCancellations: 0
})

const defaultRules = [
  { id: 1, name: '单日预约次数限制', value: 20, enabled: true, unit: '次', value_type: 'count' },
  { id: 2, name: '取消预约次数限制', value: 20, enabled: true, unit: '次', value_type: 'count' },
  { id: 3, name: '预约超时提醒', value: 30, enabled: true, unit: '分钟', value_type: 'time' },
  { id: 4, name: '短时间内频繁预约', value: 5, enabled: true, unit: '次', value_type: 'count', time_window: 10, time_unit: '分钟' }
]

function loadRulesFromStorage() {
  try {
    const saved = localStorage.getItem('riskRules')
    if (saved) {
      const parsed = JSON.parse(saved)
      return defaultRules.map(defaultRule => {
        const savedRule = parsed.find(r => r.id === defaultRule.id)
        return savedRule ? { ...defaultRule, ...savedRule } : defaultRule
      })
    }
  } catch (e) {}
  return [...defaultRules]
}

function saveRulesToStorage() {
  try {
    localStorage.setItem('riskRules', JSON.stringify(riskRules.value))
  } catch (e) {}
}

const riskRules = ref(loadRulesFromStorage())

const showEditModal = ref(false)
const editingRule = ref(null)
const editForm = ref({
  value: 0,
  time_window: 0
})

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
  saveRulesToStorage()
}

function openEditModal(rule) {
  editingRule.value = rule
  editForm.value = {
    value: rule.value,
    time_window: rule.time_window || 0
  }
  showEditModal.value = true
}

function closeEditModal() {
  showEditModal.value = false
  editingRule.value = null
}

function handleSaveEdit() {
  if (!editingRule.value) return

  const val = Number(editForm.value.value)
  if (isNaN(val) || val <= 0) {
    errorMessage.value = '请输入有效的阈值数值'
    return
  }

  if (editingRule.value.value_type === 'count' && editingRule.value.time_window !== undefined) {
    const tw = Number(editForm.value.time_window)
    if (isNaN(tw) || tw <= 0) {
      errorMessage.value = '请输入有效的时间窗口数值'
      return
    }
    editingRule.value.time_window = tw
  }

  editingRule.value.value = val
  saveRulesToStorage()
  successMessage.value = '阈值保存成功'
  setTimeout(() => { successMessage.value = '' }, 2000)
  closeEditModal()
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

    <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

    <div class="panel-card">
      <div class="panel-header">
        <h3>风控规则配置</h3>
      </div>
      <div class="rule-list">
        <div v-for="rule in riskRules" :key="rule.id" class="rule-item">
          <div class="rule-info">
            <div class="rule-name">{{ rule.name }}</div>
            <div class="rule-desc">
              <template v-if="rule.time_window">
                {{ rule.time_window }}{{ rule.time_unit || '分钟' }}内 
              </template>
              阈值：{{ rule.value }}{{ rule.unit || '次' }}
            </div>
          </div>
          <div class="rule-actions">
            <button class="btn btn-secondary btn-sm" @click="openEditModal(rule)">编辑</button>
            <label class="toggle-switch">
              <input type="checkbox" :checked="rule.enabled" @change="toggleRule(rule)" />
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
      <p class="hint-text">提示：点击"编辑"可自定义风控阈值，配置自动保存到本地</p>
    </div>

    <!-- 编辑阈值弹窗 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="closeEditModal">
      <div class="modal">
        <div class="modal-header">
          <h3>编辑阈值 - {{ editingRule?.name }}</h3>
          <button class="close-btn" @click="closeEditModal">&times;</button>
        </div>
        <div class="modal-body">
          <div v-if="editingRule?.time_window !== undefined" class="form-group">
            <label>时间窗口</label>
            <div class="input-with-unit">
              <input
                v-model.number="editForm.time_window"
                type="number"
                min="1"
                placeholder="请输入时间窗口"
              />
              <span class="input-unit">{{ editingRule?.time_unit || '分钟' }}</span>
            </div>
            <p class="hint">在此时间范围内达到阈值将触发风控</p>
          </div>
          <div class="form-group">
            <label>阈值数值</label>
            <div class="input-with-unit">
              <input
                v-model.number="editForm.value"
                type="number"
                min="1"
                placeholder="请输入阈值"
              />
              <span class="input-unit">{{ editingRule?.unit || '次' }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeEditModal">取消</button>
          <button class="btn btn-primary" @click="handleSaveEdit">保存</button>
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
.notice.success { background: var(--success-soft); color: var(--success); }

.rule-actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--card);
  border-radius: var(--radius-lg);
  width: 90%;
  max-width: 420px;
  box-shadow: var(--shadow-md);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-5);
  border-bottom: 1px solid var(--line);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: var(--text-primary);
}

.modal-body {
  padding: var(--space-5);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-5);
  border-top: 1px solid var(--line);
}

.form-group {
  margin-bottom: var(--space-5);
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.input-with-unit {
  display: flex;
  align-items: stretch;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.input-with-unit input {
  flex: 1;
  padding: var(--space-3);
  border: none;
  outline: none;
  font-size: 14px;
}

.input-with-unit input:focus {
  background: var(--primary-soft);
}

.input-unit {
  padding: 0 var(--space-4);
  background: var(--disabled-soft);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  font-size: 13px;
  border-left: 1px solid var(--line);
}

.hint {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: var(--space-1);
}
</style>
