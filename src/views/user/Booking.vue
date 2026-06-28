<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { getUser, buildUserKey } from '../../api/context.js'
import { instrumentApi } from '../../api/instrument.js'
import { categoryApi } from '../../api/category.js'
import { bookingApi } from '../../api/booking.js'
import { timeSlotApi } from '../../api/timeSlot.js'
import { userApi } from '../../api/user.js'
import { formatDate, getTodayDate, getDateLabel, formatDateText } from '../../utils/date.js'

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const categories = ref([])
const selectedCategoryId = ref('')
const selectedCategoryName = ref('')
const showCategorySelection = ref(true)

const instruments = ref([])
const selectedInstrumentId = ref('')
const selectedDate = ref(getTodayDate())
const slots = ref([])
const selectedSlotIndexes = ref([])
const availabilityMap = ref({})

const systemSettings = ref(null)
const categoryCustomSlots = ref([])

const remark = ref('')

const userInfo = computed(() => getUser())
const userKey = computed(() => {
  if (userInfo.value) {
    return buildUserKey(userInfo.value.user_name, userInfo.value.employee_no)
  }
  return ''
})

const quickDateOptions = computed(() => {
  const maxAdvanceDays = Number(systemSettings.value?.booking_advance_days || 1)
  return Array.from({ length: maxAdvanceDays + 1 }, (_, dayDiff) => {
    const date = new Date()
    date.setDate(date.getDate() + dayDiff)
    const value = formatDate(date)
    const label = getDateLabel(value)
    let title = `${dayDiff}天后`
    if (dayDiff === 0) title = '今天'
    if (dayDiff === 1) title = '明天'
    if (dayDiff === 2) title = '后天'

    return { key: `day-${dayDiff}`, value, title, ...label }
  })
})

const customSlots = computed(() => {
  if (selectedCategoryId.value && categoryCustomSlots.value.length > 0) {
    return normalizeSlots(categoryCustomSlots.value)
  }
  return normalizeSlots(systemSettings.value?.custom_slots || [])
})

function normalizeSlots(rawSlots) {
  return [...(rawSlots || [])]
    .sort((a, b) => a.slot_start.localeCompare(b.slot_start))
    .map((item, index) => ({
      slot_index: index,
      slot_start: item.slot_start,
      slot_end: item.slot_end
    }))
}

const selectedInstrument = computed(() =>
  instruments.value.find((item) => item._id === selectedInstrumentId.value) || null
)

const selectedInstrumentName = computed(() => selectedInstrument.value?.instrument_name || '')

const selectedSlotsForOperation = computed(() => {
  return slots.value
    .filter((slot) => selectedSlotIndexes.value.includes(slot.slot_index))
    .sort((a, b) => a.slot_index - b.slot_index)
})

const selectedSlotsText = computed(() => {
  if (selectedSlotsForOperation.value.length === 0) return '未选择时段'
  return selectedSlotsForOperation.value
    .map((slot) => `${slot.slot_start}-${slot.slot_end}`)
    .join('、')
})

const bookingSummary = computed(() => {
  return {
    user_name: userInfo.value?.user_name || '未填写',
    employee_no: userInfo.value?.employee_no || '未填写',
    instrument_name: selectedInstrumentName.value || '未选择',
    date: selectedDate.value,
    slots: selectedSlotsText.value
  }
})

function resetMessages() {
  errorMessage.value = ''
  successMessage.value = ''
}

function handleClearSelectedSlots() {
  selectedSlotIndexes.value = []
}

function isSelected(slot) {
  return selectedSlotIndexes.value.includes(slot.slot_index)
}

function toggleSlotSelection(slot) {
  const exists = selectedSlotIndexes.value.includes(slot.slot_index)
  if (exists) {
    selectedSlotIndexes.value = selectedSlotIndexes.value.filter((item) => item !== slot.slot_index)
  } else {
    selectedSlotIndexes.value = [...selectedSlotIndexes.value, slot.slot_index].sort((a, b) => a - b)
  }
}

function handleSlotClick(slot) {
  resetMessages()
  if (slot.status === 'locked' || slot.status === 'expired' || slot.status === 'booked') return
  toggleSlotSelection(slot)
}

function getSlotPersonName(slot) {
  if (!slot.user_name) return ''
  return slot.employee_no ? `${slot.user_name}；${slot.employee_no}` : slot.user_name
}

async function loadCategories() {
  try {
    categories.value = await categoryApi.getCategories()
  } catch (e) {
    console.error('加载类别失败', e)
  }
}

async function handleSelectCategory(category) {
  selectedCategoryId.value = category._id
  selectedCategoryName.value = category.category_name
  showCategorySelection.value = false

  try {
    const catSettings = await categoryApi.getCategorySettings(category._id)
    categoryCustomSlots.value = catSettings?.custom_slots || []
  } catch (e) {
    categoryCustomSlots.value = []
  }

  await loadInstruments()
  await loadAvailability()
}

function handleBackToCategorySelection() {
  showCategorySelection.value = true
  selectedCategoryId.value = ''
  selectedCategoryName.value = ''
  selectedInstrumentId.value = ''
  categoryCustomSlots.value = []
  instruments.value = []
  slots.value = []
}

async function loadInstruments() {
  if (!selectedCategoryId.value) return
  try {
    instruments.value = await instrumentApi.getInstruments({
      category_id: selectedCategoryId.value
    })
    if (instruments.value.length > 0) {
      selectedInstrumentId.value = instruments.value[0]._id
    }
  } catch (e) {
    console.error('加载仪器失败', e)
  }
}

async function loadAvailability() {
  if (instruments.value.length === 0) {
    availabilityMap.value = {}
    return
  }

  const totalCount = customSlots.value.length
  if (totalCount === 0) return

  try {
    const today = getTodayDate()
    const [bookings, locks] = await Promise.all([
      bookingApi.getBookingsByDate(today, null, selectedCategoryId.value),
      timeSlotApi.getLocks({ date: today, category_id: selectedCategoryId.value })
    ])

    const nextMap = {}
    for (const instrument of instruments.value) {
      const instBookings = bookings.filter(b => b.instrument_id === instrument._id)
      const instLocks = locks.filter(l => l.instrument_id === instrument._id)
      const bookingSet = new Set(instBookings.map(b => b.slot_start))
      const dayLock = instLocks.some(l => l.lock_type === 'day' && l.lock_date === today)
      const slotLockSet = new Set(instLocks.filter(l => l.lock_type === 'slot').map(l => l.slot_index))

      let freeCount = 0
      for (let i = 0; i < totalCount; i++) {
        const slot = customSlots.value[i]
        if (dayLock || slotLockSet.has(i) || bookingSet.has(slot?.slot_start)) {
          continue
        }
        freeCount += 1
      }

      let status = 'free'
      let label = '可用'
      if (dayLock) { status = 'busy'; label = '锁定' }
      else if (freeCount === 0) { status = 'busy'; label = '已满' }
      else if (freeCount < totalCount) { status = 'partial'; label = '部分可用' }

      nextMap[instrument._id] = { status, label, freeCount, totalCount }
    }

    availabilityMap.value = nextMap
  } catch (e) {
    console.error('加载可用状态失败', e)
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

  try {
    const baseSlots = customSlots.value.map((slot) => ({
      ...slot,
      status: 'available',
      text: '可预约',
      user_name: '',
      booking_id: '',
      remark: ''
    }))

    const [bookings, locks] = await Promise.all([
      bookingApi.getBookingsByDate(selectedDate.value, selectedInstrumentId.value, selectedCategoryId.value),
      timeSlotApi.getLocks({ date: selectedDate.value, instrument_id: selectedInstrumentId.value, category_id: selectedCategoryId.value })
    ])

    const dayLock = locks.some(l => l.lock_type === 'day' && (l.lock_date === selectedDate.value || l.scope_type === 'long_term'))
    const slotLockMap = {}
    locks
      .filter(l => l.lock_type === 'slot' && (l.lock_date === selectedDate.value || l.scope_type === 'long_term'))
      .forEach(l => { slotLockMap[l.slot_index] = l })

    slots.value = baseSlots.map((slot) => {
      if (dayLock) return { ...slot, status: 'locked', text: '整天锁定' }
      if (slotLockMap[slot.slot_index]) return { ...slot, status: 'locked', text: '时段锁定' }

      const matchedBooking = bookings.find((item) => item.slot_start === slot.slot_start)
      if (matchedBooking) {
        const isMine = matchedBooking.user_key === userKey.value
        return {
          ...slot,
          booking_id: matchedBooking._id || matchedBooking.record_id,
          record_id: matchedBooking.record_id || matchedBooking._id,
          user_key: matchedBooking.user_key || '',
          user_name: matchedBooking.user_name || '',
          employee_no: matchedBooking.employee_no || '',
          remark: matchedBooking.remark || '',
          status: isMine ? 'mine' : 'booked',
          text: isMine ? '我的预约' : '已占用'
        }
      }
      return { ...slot, status: 'available', text: '可预约' }
    })
  } catch (e) {
    errorMessage.value = e.message || '读取预约数据失败'
  } finally {
    loading.value = false
  }
}

async function handleReserveSelectedSlots() {
  if (selectedSlotsForOperation.value.length === 0) {
    errorMessage.value = '请先选择至少一个时段'
    return
  }

  operating.value = true
  resetMessages()

  try {
    const registeredUsers = systemSettings.value?.user_list || []
    const isWhitelisted = registeredUsers.some(
      (u) => u.user_name === userInfo.value?.user_name && u.employee_no === userInfo.value?.employee_no
    )

    if (!isWhitelisted) {
      errorMessage.value = '预约失败：该姓名与工号未注册，请联系管理员添加'
      return
    }

    let createCount = 0
    const existingBookings = await bookingApi.getBookingsByDate(
      selectedDate.value, selectedInstrumentId.value, selectedCategoryId.value
    )

    for (const slot of selectedSlotsForOperation.value) {
      const existed = existingBookings.find((item) => item.slot_start === slot.slot_start)
      if (existed) continue

      await bookingApi.createBooking({
        booking_date: selectedDate.value,
        instrument_id: selectedInstrumentId.value,
        instrument_name: selectedInstrumentName.value,
        slot_start: slot.slot_start,
        slot_end: slot.slot_end,
        slot_index: slot.slot_index,
        user_name: userInfo.value.user_name,
        employee_no: userInfo.value.employee_no,
        booking_remark: remark.value,
        user_key: userKey.value,
        category_id: selectedCategoryId.value
      })
      createCount += 1
    }

    successMessage.value = `预约成功：已预约 ${createCount} 个时段。`
    await loadSlots()
    await loadAvailability()
  } catch (e) {
    errorMessage.value = e.message || '预约失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

async function handleCancelSelectedSlots() {
  if (selectedSlotsForOperation.value.length === 0) {
    errorMessage.value = '请先选择要取消的时段'
    return
  }

  operating.value = true
  resetMessages()

  try {
    const existingBookings = await bookingApi.getBookingsByDate(
      selectedDate.value, selectedInstrumentId.value, selectedCategoryId.value
    )

    let cancelledCount = 0
    for (const slot of selectedSlotsForOperation.value) {
      const existed = existingBookings.find((item) => item.slot_start === slot.slot_start)
      if (!existed || existed.user_key !== userKey.value) continue

      const recordId = existed.record_id || existed._id
      if (recordId) {
        await bookingApi.deleteBooking(recordId)
        cancelledCount += 1
      }
    }

    successMessage.value = `取消完成：已取消 ${cancelledCount} 个时段。`
    await loadSlots()
    await loadAvailability()
  } catch (e) {
    errorMessage.value = e.message || '取消预约失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

watch([selectedDate, selectedInstrumentId], async () => {
  if (selectedInstrumentId.value) {
    await loadSlots()
  }
  await loadAvailability()
})

onMounted(async () => {
  loading.value = true
  try {
    systemSettings.value = await userApi.getSettings()
    await loadCategories()
  } catch (e) {
    console.error(e)
    errorMessage.value = e.message || '初始化失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="booking-page">
    <div v-if="showCategorySelection" class="category-selection card-surface">
      <div class="section-head">
        <h3>选择仪器类别</h3>
      </div>
      <div class="category-list">
        <button
          v-for="cat in categories"
          :key="cat._id"
          class="category-card"
          type="button"
          @click="handleSelectCategory(cat)"
        >
          <div class="category-icon">{{ cat.category_icon || '📱' }}</div>
          <div class="category-name">{{ cat.category_name }}</div>
        </button>
      </div>
    </div>

    <template v-else>
      <div class="category-summary card-surface compact-card">
        <div class="section-head">
          <h3>已选类别</h3>
          <button class="ghost-btn" type="button" @click="handleBackToCategorySelection">返回选择</button>
        </div>
        <div class="category-selected-info">
          <span class="category-icon">{{ categories.find(c => c._id === selectedCategoryId)?.category_icon || '📱' }}</span>
          <span class="category-name">{{ selectedCategoryName }}</span>
        </div>
      </div>

      <div class="card-surface choose-card">
        <div class="section-head">
          <h3>选择仪器</h3>
        </div>
        <div v-if="instruments.length === 0" class="empty-text">
          暂无仪器
        </div>
        <div v-else class="instrument-list">
          <button
            v-for="item in instruments"
            :key="item._id"
            class="instrument-card"
            :class="{ active: selectedInstrumentId === item._id }"
            type="button"
            @click="selectedInstrumentId = item._id"
          >
            <div class="instrument-name">{{ item.instrument_name }}</div>
            <div class="instrument-state">
              <span class="status-dot" :class="availabilityMap[item._id]?.status || 'free'"></span>
              {{ availabilityMap[item._id]?.label || '可用' }}
            </div>
          </button>
        </div>
      </div>

      <div class="card-surface choose-card">
        <div class="section-head">
          <h3>选择日期</h3>
          <input v-model="selectedDate" class="date-inline" type="date" />
        </div>
        <div class="date-grid">
          <button
            v-for="item in quickDateOptions"
            :key="item.key"
            class="date-chip"
            :class="{ active: selectedDate === item.value }"
            type="button"
            @click="selectedDate = item.value"
          >
            <div class="chip-title">{{ item.title }}</div>
            <div class="chip-date">{{ item.monthDay }}</div>
            <div class="chip-week">{{ item.weekday }}</div>
          </button>
        </div>
      </div>

      <div class="card-surface choose-card">
        <div class="section-head">
          <h3>选择时间段</h3>
          <span class="mini-tip">{{ formatDateText(selectedDate) }}</span>
        </div>
        <div class="legend-row">
          <span><i class="legend-dot available"></i>可预约</span>
          <span><i class="legend-dot mine"></i>我的预约</span>
          <span><i class="legend-dot booked"></i>已占用</span>
          <span><i class="legend-dot locked"></i>不可预约</span>
        </div>

        <p v-if="loading" class="notice loading">正在加载时段数据...</p>
        <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
        <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

        <div v-if="customSlots.length === 0" class="empty-text">
          暂无时段配置
        </div>
        <div v-else class="slot-list">
          <button
            v-for="slot in slots"
            :key="slot.slot_start"
            class="slot-row"
            :class="[slot.status, { selected: isSelected(slot) }]"
            type="button"
            @click="handleSlotClick(slot)"
          >
            <span class="slot-time">{{ slot.slot_start }}--{{ slot.slot_end }}</span>
            <span class="slot-status">{{ slot.text }}</span>
            <span v-if="getSlotPersonName(slot)" class="slot-person">{{ getSlotPersonName(slot) }}</span>
          </button>
        </div>
      </div>

      <div class="card-surface confirm-card">
        <div class="section-head"><h3>备注（选填）</h3></div>
        <textarea
          v-model="remark"
          rows="2"
          maxlength="50"
          placeholder="如：实验项目名称、用途等"
          class="remark-input"
        ></textarea>

        <div class="confirm-info">
          <div>用户：{{ bookingSummary.user_name }}</div>
          <div>仪器：{{ bookingSummary.instrument_name }}</div>
          <div>日期：{{ bookingSummary.date }}</div>
          <div>时段：{{ bookingSummary.slots }}</div>
        </div>

        <div class="confirm-actions">
          <button class="secondary-btn" type="button" @click="handleClearSelectedSlots">清空选择</button>
          <button
            class="secondary-btn warning"
            type="button"
            @click="handleCancelSelectedSlots"
            :disabled="operating || selectedSlotsForOperation.length === 0"
          >
            {{ operating ? '处理中...' : '取消预约' }}
          </button>
          <button
            class="primary-btn"
            type="button"
            @click="handleReserveSelectedSlots"
            :disabled="operating"
          >
            {{ operating ? '处理中...' : '确认预约' }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.booking-page {
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

.mini-tip {
  font-size: 12px;
  color: #8a9ab5;
}

.ghost-btn {
  background: none;
  border: none;
  color: #4a90e2;
  font-size: 13px;
  cursor: pointer;
}

.category-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.category-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-card:hover {
  border-color: #4a90e2;
}

.category-icon {
  font-size: 28px;
}

.category-name {
  font-size: 13px;
  font-weight: 500;
  color: #1f2a44;
}

.category-selected-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.instrument-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.instrument-card {
  padding: 14px;
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.instrument-card.active {
  border-color: #4a90e2;
  background: #f0f6ff;
}

.instrument-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
  margin-bottom: 6px;
}

.instrument-state {
  font-size: 12px;
  color: #6b7a99;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.free, .legend-dot.available {
  background: #27ae60;
}

.status-dot.partial, .legend-dot.mine {
  background: #f39c12;
}

.status-dot.busy, .legend-dot.booked {
  background: #e74c3c;
}

.legend-dot.locked {
  background: #95a5a6;
}

.date-inline {
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
}

.date-grid {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.date-chip {
  flex-shrink: 0;
  padding: 10px 16px;
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.date-chip.active {
  border-color: #4a90e2;
  background: #f0f6ff;
}

.chip-title {
  font-size: 12px;
  color: #6b7a99;
  margin-bottom: 2px;
}

.chip-date {
  font-size: 15px;
  font-weight: 600;
  color: #1f2a44;
}

.chip-week {
  font-size: 12px;
  color: #8a9ab5;
  margin-top: 2px;
}

.legend-row {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: #6b7a99;
}

.legend-row span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.slot-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.slot-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px;
  background: #f0f9f4;
  border: 2px solid transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.slot-row.available { background: #f0f9f4; }
.slot-row.mine { background: #fff7e6; }
.slot-row.booked { background: #fef0f0; cursor: not-allowed; }
.slot-row.locked { background: #f5f5f5; cursor: not-allowed; }
.slot-row.expired { background: #f5f5f5; cursor: not-allowed; opacity: 0.6; }

.slot-row.selected {
  border-color: #4a90e2;
}

.slot-time {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.slot-status {
  font-size: 11px;
  color: #6b7a99;
}

.slot-person {
  font-size: 11px;
  color: #8a9ab5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.remark-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  resize: none;
  outline: none;
  margin-bottom: 14px;
}

.remark-input:focus {
  border-color: #4a90e2;
}

.confirm-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 14px;
  background: #f7f9fd;
  border-radius: 10px;
  font-size: 13px;
  color: #4a5568;
  margin-bottom: 14px;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.primary-btn {
  flex: 1;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  min-width: 100px;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: #f0f4f9;
  color: #1f2a44;
  border: none;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
}

.secondary-btn.warning {
  background: #fff7e6;
  color: #f39c12;
}

.empty-text {
  text-align: center;
  color: #9aa8c4;
  padding: 24px 0;
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
