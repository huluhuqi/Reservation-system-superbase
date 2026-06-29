<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { CategoryAPI, InstrumentAPI, BookingAPI, UserAPI, TimeSlotAPI } from '@/api'
import { getTodayDate, formatDateText, getDateLabel } from '../../utils/date.js'

const router = useRouter()

const categories = ref([])
const selectedCategoryId = ref(null)
const instruments = ref([])
const selectedInstrumentId = ref(null)
const customSlots = ref([])
const slots = ref([])
const selectedSlots = ref([])
const selectedDate = ref(getTodayDate())
const remark = ref('')
const loading = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const systemSettings = ref(null)
const currentStep = ref(3)

const userInfo = computed(() => {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
})

const selectedCategoryName = computed(() => {
  const cat = categories.value.find(c => c.id === selectedCategoryId.value)
  return cat ? cat.category_name : ''
})

const selectedInstrument = computed(() => {
  return instruments.value.find(i => i.id === selectedInstrumentId.value)
})

const quickDateOptions = computed(() => {
  const maxAdvanceDays = Number(systemSettings.value?.booking_advance_days || 7)
  const bookingOpenTime = systemSettings.value?.booking_open_time || '09:00'

  const now = new Date()
  const openHour = parseInt(bookingOpenTime.split(':')[0])
  const openMinute = parseInt(bookingOpenTime.split(':')[1])
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openHour * 60 + openMinute

  let availableDays = currentMinutes >= openMinutes ? maxAdvanceDays : 1

  return Array.from({ length: availableDays }, (_, dayDiff) => {
    const date = new Date()
    date.setDate(date.getDate() + dayDiff)
    const value = getTodayDate().replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => {
      const dt = new Date()
      dt.setDate(dt.getDate() + dayDiff)
      const yy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      return `${yy}-${mm}-${dd}`
    })
    const correctValue = (() => {
      const dt = new Date()
      dt.setDate(dt.getDate() + dayDiff)
      const yy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      return `${yy}-${mm}-${dd}`
    })()
    const label = getDateLabel(correctValue)
    let title = `${dayDiff}天后`
    if (dayDiff === 0) title = '今天'
    if (dayDiff === 1) title = '明天'
    if (dayDiff === 2) title = '后天'

    return { key: `day-${dayDiff}`, value: correctValue, title, ...label }
  })
})

const availableCount = computed(() => {
  return slots.value.filter(s => s.status === 'free').length
})

const totalCount = computed(() => slots.value.length)

const instrumentStatus = computed(() => {
  if (totalCount.value === 0) return { status: 'free', label: '可用' }
  if (availableCount.value === 0) return { status: 'busy', label: '已满' }
  if (availableCount.value < totalCount.value) return { status: 'partial', label: '部分可用' }
  return { status: 'free', label: '可用' }
})

function resetMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

async function loadCategories() {
  try {
    categories.value = await CategoryAPI.list()
    if (categories.value.length > 0 && !selectedCategoryId.value) {
      selectedCategoryId.value = categories.value[0].id
    }
  } catch (e) {
    console.error(e)
  }
}

function handleSelectCategory(catId) {
  selectedCategoryId.value = catId
  loadInstruments()
}

async function loadInstruments() {
  if (!selectedCategoryId.value) return
  try {
    instruments.value = await InstrumentAPI.list(selectedCategoryId.value)
    if (instruments.value.length > 0 && !selectedInstrumentId.value) {
      selectedInstrumentId.value = instruments.value[0].id
    }
    await nextTick()
    loadSlots()
  } catch (e) {
    console.error(e)
  }
}

async function loadSlots() {
  if (!selectedInstrumentId.value || !selectedDate.value) {
    slots.value = []
    return
  }

  loading.value = true
  resetMessages()
  handleClearSelectedSlots()

  const maxAdvanceDays = Number(systemSettings.value?.booking_advance_days || 7)
  const bookingOpenTime = systemSettings.value?.booking_open_time || '09:00'
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selectedDateObj = new Date(selectedDate.value)
  selectedDateObj.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor((selectedDateObj - today) / (1000 * 60 * 60 * 24))

  const openHour = parseInt(bookingOpenTime.split(':')[0])
  const openMinute = parseInt(bookingOpenTime.split(':')[1])
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openHour * 60 + openMinute

  const maxAllowedDayDiff = currentMinutes >= openMinutes ? (maxAdvanceDays - 1) : 0

  if (dayDiff > maxAllowedDayDiff) {
    errorMessage.value = `仅可预约 ${maxAdvanceDays} 天内的日期`
    slots.value = []
    loading.value = false
    return
  }

  if (dayDiff < 0) {
    errorMessage.value = '不能预约历史日期'
    slots.value = []
    loading.value = false
    return
  }

  const isToday = dayDiff === 0

  try {
    let slotList = []
    if (customSlots.value.length > 0) {
      slotList = customSlots.value.map((s, idx) => ({
        slot_index: idx,
        slot_start: s.slot_start,
        slot_end: s.slot_end
      }))
    } else {
      const settings = systemSettings.value
      const customSlotsFromSettings = settings?.custom_slots || []
      if (customSlotsFromSettings.length > 0) {
        slotList = customSlotsFromSettings.map((s, idx) => ({
          slot_index: idx,
          slot_start: s.slot_start,
          slot_end: s.slot_end
        }))
      }
    }

    if (slotList.length === 0) {
      loading.value = false
      return
    }

    const bookings = await BookingAPI.getByDate(selectedDate.value, selectedInstrumentId.value)
    const locks = await TimeSlotAPI.getLocks({
      instrument_id: selectedInstrumentId.value,
      lock_date: selectedDate.value
    })

    const bookingSet = new Set(bookings.map(b => b.slot_start))
    const dayLock = locks.some(l => l.lock_type === 'day')
    const slotLockSet = new Set(locks.filter(l => l.lock_type === 'slot').map(l => l.slot_index))

    const userId = userInfo.value?.id

    slots.value = slotList.map((slot, index) => {
      const isBooked = bookingSet.has(slot.slot_start)
      const isLocked = dayLock || slotLockSet.has(index)
      const isMyBooking = isBooked && userId &&
        bookings.find(b => b.slot_start === slot.slot_start && b.user_id === userId)

      let status = 'free'
      let text = '可预约'

      if (isLocked) {
        status = 'locked'
        text = '已锁定'
      } else if (isMyBooking) {
        status = 'my'
        text = '我的预约'
      } else if (isBooked) {
        status = 'booked'
        text = '已占用'
      } else if (isToday) {
        const slotHour = parseInt(slot.slot_start.split(':')[0])
        const slotMinute = parseInt(slot.slot_start.split(':')[1])
        const slotMinutes = slotHour * 60 + slotMinute
        if (currentMinutes >= slotMinutes) {
          status = 'expired'
          text = '已过期'
        }
      }

      return { ...slot, id: `slot-${index}`, status, text }
    })
  } catch (e) {
    console.error(e)
    errorMessage.value = '加载时段失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function handleSelectDate(dateStr) {
  selectedDate.value = dateStr
  handleClearSelectedSlots()
}

function handleToggleSlot(slot) {
  if (slot.status !== 'free') return
  const idx = selectedSlots.value.findIndex(s => s.slot_start === slot.slot_start)
  if (idx > -1) {
    selectedSlots.value.splice(idx, 1)
  } else {
    selectedSlots.value.push(slot)
  }
}

function handleClearSelectedSlots() {
  selectedSlots.value = []
}

async function handleConfirmBooking() {
  if (selectedSlots.value.length === 0) {
    errorMessage.value = '请至少选择一个时间段'
    return
  }
  if (!selectedInstrumentId.value) {
    errorMessage.value = '请选择仪器'
    return
  }
  if (!userInfo.value?.id) {
    errorMessage.value = '请先登录'
    return
  }

  const maxAdvanceDays = Number(systemSettings.value?.booking_advance_days || 7)
  const bookingOpenTime = systemSettings.value?.booking_open_time || '09:00'
  const now = new Date()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selectedDateObj = new Date(selectedDate.value)
  selectedDateObj.setHours(0, 0, 0, 0)
  const dayDiff = Math.floor((selectedDateObj - today) / (1000 * 60 * 60 * 24))

  const openHour = parseInt(bookingOpenTime.split(':')[0])
  const openMinute = parseInt(bookingOpenTime.split(':')[1])
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openHour * 60 + openMinute
  const maxAllowedDayDiff = currentMinutes >= openMinutes ? (maxAdvanceDays - 1) : 0

  if (dayDiff > maxAllowedDayDiff) {
    errorMessage.value = `仅可预约 ${maxAdvanceDays} 天内的日期`
    return
  }
  if (dayDiff < 0) {
    errorMessage.value = '不能预约历史日期'
    return
  }

  submitting.value = true
  resetMessages()

  try {
    const promises = selectedSlots.value.map(slot =>
      BookingAPI.create({
        instrument_id: selectedInstrumentId.value,
        user_id: userInfo.value.id,
        booking_date: selectedDate.value,
        slot_index: slot.slot_index,
        slot_start: slot.slot_start,
        slot_end: slot.slot_end,
        booking_remark: remark.value
      })
    )
    await Promise.all(promises)
    successMessage.value = `成功预约 ${selectedSlots.value.length} 个时段！`
    handleClearSelectedSlots()
    loadSlots()
  } catch (e) {
    errorMessage.value = e.message || '预约失败，请重试'
  } finally {
    submitting.value = false
  }
}

async function handleCancelReservation() {
  if (!selectedSlots.value.length) {
    errorMessage.value = '请先选择要取消的时段'
    return
  }
  if (!confirm(`确定要取消选中的 ${selectedSlots.value.length} 个预约吗？`)) return

  submitting.value = true
  resetMessages()

  try {
    const myBookings = await BookingAPI.getByDate(selectedDate.value, selectedInstrumentId.value)
    const toCancel = selectedSlots.value
      .map(slot => myBookings.find(b => b.slot_start === slot.slot_start && b.user_id === userInfo.value?.id))
      .filter(b => b)

    const promises = toCancel.map(b => BookingAPI.remove(b.id))
    await Promise.all(promises)
    successMessage.value = `成功取消 ${toCancel.length} 个预约`
    handleClearSelectedSlots()
    loadSlots()
  } catch (e) {
    errorMessage.value = e.message || '取消失败，请重试'
  } finally {
    submitting.value = false
  }
}

function handleBack() {
  router.push('/home')
}

onMounted(async () => {
  try {
    systemSettings.value = await UserAPI.getSettings()
    await loadCategories()
  } catch (e) {
    console.error(e)
  }
})

watch(selectedDate, () => {
  if (selectedInstrumentId.value) {
    loadSlots()
  }
})
</script>

<template>
  <div class="booking-page">
    <div class="page-header">
      <button class="back-btn" type="button" @click="handleBack">
        <span class="back-icon">‹</span>
      </button>
      <h2 class="page-title">7500预约系统</h2>
      <div class="header-right">···</div>
    </div>

    <div class="hero-section">
      <h1 class="hero-title">科研仪器预约系统</h1>
      <p class="hero-subtitle">{{ selectedCategoryName }} 设备预约</p>
    </div>

    <div class="stepper-card card-surface">
      <div class="stepper">
        <div class="step completed">
          <div class="step-circle">✓</div>
          <span class="step-label">用户信息</span>
        </div>
        <div class="step-line completed"></div>
        <div class="step completed">
          <div class="step-circle">✓</div>
          <span class="step-label">选择仪器</span>
        </div>
        <div class="step-line active"></div>
        <div class="step active">
          <div class="step-circle">3</div>
          <span class="step-label">选择日期时间</span>
        </div>
        <div class="step-line"></div>
        <div class="step">
          <div class="step-circle">4</div>
          <span class="step-label">确认预约</span>
        </div>
      </div>
    </div>

    <div class="card-surface user-info-card">
      <div class="section-head">
        <h3>已确认用户</h3>
        <button class="link-btn" type="button">修改信息</button>
      </div>
      <p class="user-id">（工号：{{ userInfo?.username || userInfo?.email?.split('@')[0] || '-' }}）</p>
    </div>

    <div class="card-surface instrument-card">
      <div class="section-head">
        <h3>选择仪器</h3>
        <span class="section-tip">点击卡片切换</span>
      </div>
      <div class="instrument-grid">
        <button
          v-for="inst in instruments"
          :key="inst.id"
          class="inst-card"
          :class="{ active: selectedInstrumentId === inst.id }"
          type="button"
          @click="selectedInstrumentId = inst.id; handleClearSelectedSlots(); loadSlots()"
        >
          <div class="inst-progress">
            <div
              class="inst-progress-fill"
              :style="{ width: ((availableCount / (totalCount || 1)) * 100) + '%' }"
            ></div>
          </div>
          <div class="inst-name">{{ inst.instrument_name }}</div>
          <div class="inst-status">
            <span class="status-dot" :class="instrumentStatus.status"></span>
            {{ instrumentStatus.label }}
          </div>
          <div class="inst-remain">剩余 {{ availableCount }}/{{ totalCount }}</div>
          <div class="inst-radio">
            <span v-if="selectedInstrumentId === inst.id" class="radio-dot">●</span>
            <span v-else class="radio-ring">○</span>
          </div>
        </button>
      </div>
    </div>

    <div class="card-surface date-card">
      <div class="section-head">
        <h3>选择日期</h3>
        <span class="date-display">{{ formatDateText(selectedDate) }}</span>
      </div>
      <div class="date-options">
        <button
          v-for="opt in quickDateOptions"
          :key="opt.key"
          class="date-btn"
          :class="{ active: selectedDate === opt.value }"
          type="button"
          @click="handleSelectDate(opt.value)"
        >
          <div class="date-day">{{ opt.title }}</div>
          <div class="date-num">{{ opt.month }}月{{ opt.day }}日</div>
          <div class="date-weekday">{{ opt.weekday }}</div>
        </button>
      </div>
      <p class="date-tip">当天只能预约未开始的时段。</p>
    </div>

    <div class="card-surface slot-card">
      <div class="section-head">
        <h3>选择时间段</h3>
        <span class="slot-date">{{ formatDateText(selectedDate) }}</span>
      </div>
      <div class="slot-legend">
        <span class="legend-item">
          <span class="legend-dot free"></span> 可预约
        </span>
        <span class="legend-item">
          <span class="legend-dot my"></span> 我的预约
        </span>
        <span class="legend-item">
          <span class="legend-dot booked"></span> 已占用
        </span>
        <span class="legend-item">
          <span class="legend-dot expired"></span> 不可预约
        </span>
      </div>

      <div v-if="loading" class="loading-text">加载中...</div>
      <div v-else-if="errorMessage && !slots.length" class="error-text">{{ errorMessage }}</div>
      <div v-else-if="slots.length === 0" class="empty-text">暂无时段数据</div>
      <div v-else class="slot-grid">
        <button
          v-for="slot in slots"
          :key="slot.id"
          class="slot-btn"
          :class="[
            slot.status,
            { selected: selectedSlots.some(s => s.slot_start === slot.slot_start) }
          ]"
          type="button"
          :disabled="slot.status !== 'free' && slot.status !== 'my'"
          @click="handleToggleSlot(slot)"
        >
          <div class="slot-time">{{ slot.slot_start }}-{{ slot.slot_end }}</div>
          <div class="slot-label">{{ slot.text }}</div>
        </button>
      </div>
    </div>

    <div class="bottom-section">
      <div v-if="successMessage" class="success-banner">
        {{ successMessage }}
      </div>
      <div v-if="errorMessage && slots.length > 0" class="error-banner">
        {{ errorMessage }}
      </div>

      <div class="selected-info">
        已选 <span class="selected-count">{{ selectedSlots.length }}</span> 个时段
      </div>

      <div class="action-buttons">
        <button
          class="cancel-btn"
          type="button"
          :disabled="submitting || selectedSlots.length === 0"
          @click="handleCancelReservation"
        >
          {{ submitting ? '处理中...' : '取消预约' }}
        </button>
        <button
          class="confirm-btn"
          type="button"
          :disabled="submitting || selectedSlots.length === 0"
          @click="handleConfirmBooking"
        >
          {{ submitting ? '提交中...' : `确认预约 (${selectedSlots.length})` }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.booking-page {
  padding: 0 16px 220px;
  background: linear-gradient(180deg, #dce8ff 0%, #e8f0ff 100px, #f5f7fa 300px);
  min-height: 100vh;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0 12px;
}

.back-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-icon {
  font-size: 24px;
  color: #1a2a4a;
  font-weight: 300;
  line-height: 1;
}

.page-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1a2a4a;
}

.header-right {
  width: 36px;
  text-align: center;
  font-size: 18px;
  color: #1a2a4a;
}

.hero-section {
  padding: 8px 0 20px;
}

.hero-title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  color: #1a2a4a;
  letter-spacing: -0.5px;
}

.hero-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: #6b7a99;
}

.card-surface {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 4px 20px rgba(31, 42, 68, 0.05);
  margin-bottom: 14px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-head h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1a2a4a;
}

.section-tip {
  font-size: 13px;
  color: #4a90e2;
  font-weight: 500;
}

.date-display {
  font-size: 13px;
  color: #4a90e2;
  font-weight: 500;
}

.slot-date {
  font-size: 13px;
  color: #4a90e2;
  font-weight: 500;
}

.stepper-card {
  padding: 20px 16px;
}

.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.step-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #e1e8f2;
  color: #95a5b8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.step.completed .step-circle {
  background: #4a90e2;
  color: white;
}

.step.active .step-circle {
  background: #4a90e2;
  color: white;
  box-shadow: 0 4px 12px rgba(74, 144, 226, 0.4);
}

.step-label {
  font-size: 11px;
  color: #95a5b8;
  white-space: nowrap;
}

.step.completed .step-label,
.step.active .step-label {
  color: #1a2a4a;
  font-weight: 500;
}

.step-line {
  flex: 1;
  height: 3px;
  background: #e1e8f2;
  margin: 0 4px;
  border-radius: 2px;
  margin-bottom: 22px;
}

.step-line.completed {
  background: #4a90e2;
}

.step-line.active {
  background: linear-gradient(90deg, #4a90e2 50%, #e1e8f2 50%);
}

.user-info-card {
  padding-bottom: 14px;
}

.link-btn {
  background: #eef5ff;
  color: #4a90e2;
  border: none;
  padding: 6px 14px;
  border-radius: 18px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.user-id {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a2a4a;
}

.instrument-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.inst-card {
  position: relative;
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.25s ease;
  overflow: hidden;
}

.inst-card.active {
  border-color: #4a90e2;
  background: #eef5ff;
}

.inst-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 10px;
  background: #f0e6d3;
  overflow: hidden;
  border-radius: 14px 14px 0 0;
}

.inst-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f39c12, #f1c40f);
  border-radius: 14px 0 0 0;
  transition: width 0.3s;
}

.inst-name {
  font-size: 15px;
  font-weight: 700;
  color: #1a2a4a;
  margin-top: 6px;
}

.inst-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7a99;
  margin-top: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.free { background: #27ae60; }
.status-dot.partial { background: #f39c12; }
.status-dot.busy { background: #95a5a6; }

.inst-remain {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 4px;
}

.inst-radio {
  position: absolute;
  top: 14px;
  right: 14px;
  color: #4a90e2;
  font-size: 18px;
}

.radio-ring {
  color: #c5d0e0;
  font-size: 20px;
}

.radio-dot {
  font-size: 22px;
}

.date-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.date-btn {
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 14px;
  padding: 14px 10px;
  cursor: pointer;
  text-align: center;
  transition: all 0.25s ease;
}

.date-btn.active {
  border-color: #4a90e2;
  background: #e8f5e9;
  border-color: #4caf50;
}

.date-day {
  font-size: 15px;
  font-weight: 700;
  color: #1a2a4a;
}

.date-btn.active .date-day {
  color: #2e7d32;
}

.date-num {
  font-size: 22px;
  font-weight: 800;
  color: #4a90e2;
  margin: 4px 0;
}

.date-btn.active .date-num {
  color: #2e7d32;
}

.date-weekday {
  font-size: 12px;
  color: #6b7a99;
}

.date-tip {
  margin: 8px 0 0;
  font-size: 13px;
  color: #6b7a99;
}

.slot-legend {
  display: flex;
  gap: 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7a99;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-dot.free { background: #4a90e2; }
.legend-dot.my { background: #f39c12; }
.legend-dot.booked { background: #e74c3c; }
.legend-dot.expired { background: #bdc3c7; }

.slot-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.slot-btn {
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 12px;
  padding: 12px 8px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.slot-btn.free:hover {
  border-color: #4a90e2;
  background: #eef5ff;
}

.slot-btn.selected {
  border-color: #4a90e2;
  background: #eef5ff;
}

.slot-btn.booked,
.slot-btn.locked,
.slot-btn.expired {
  opacity: 0.5;
  cursor: not-allowed;
}

.slot-btn.booked {
  background: #fdecea;
}

.slot-btn.my {
  background: #fff8e1;
}

.slot-time {
  font-size: 13px;
  font-weight: 600;
  color: #1a2a4a;
}

.slot-label {
  font-size: 11px;
  color: #6b7a99;
  margin-top: 3px;
}

.slot-btn.selected .slot-time {
  color: #4a90e2;
}

.slot-btn.my .slot-time {
  color: #f39c12;
}

.slot-btn.booked .slot-time {
  color: #e74c3c;
}

.loading-text, .empty-text, .error-text {
  text-align: center;
  padding: 20px;
  font-size: 14px;
}

.loading-text { color: #6b7a99; }
.empty-text { color: #9aa8c4; }
.error-text { color: #e74c3c; }

.bottom-section {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  z-index: 100;
}

.success-banner,
.error-banner {
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 10px;
  text-align: center;
}

.success-banner {
  background: #e8f5e9;
  color: #2e7d32;
}

.error-banner {
  background: #fdecea;
  color: #c62828;
}

.selected-info {
  text-align: center;
  font-size: 13px;
  color: #6b7a99;
  margin-bottom: 10px;
}

.selected-count {
  color: #4a90e2;
  font-weight: 700;
  font-size: 16px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

.cancel-btn,
.confirm-btn {
  flex: 1;
  padding: 14px;
  border: none;
  border-radius: 14px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: #f0f2f7;
  color: #6b7a99;
}

.cancel-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-btn {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(74, 144, 226, 0.4);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-btn:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
