<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { CategoryAPI, InstrumentAPI, BookingAPI, TimeSlotAPI, UserAPI } from '@/api'
import { formatDate, getTodayDate, getDateLabel, formatDateText } from '../../utils/date.js'

function getUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const categories = ref([])
const selectedCategoryId = ref('')
const selectedCategoryName = ref('')
const selectedCategoryIcon = ref('')

const instruments = ref([])
const selectedInstrumentId = ref('')
const selectedDate = ref(getTodayDate())
const slots = ref([])
const selectedSlotIndexes = ref([])
const availabilityMap = ref({})

const systemSettings = ref(null)
const categoryCustomSlots = ref([])

const remark = ref('')

const BOOKING_STATE_KEY = 'booking_selected_state'

function saveBookingState() {
  try {
    localStorage.setItem(BOOKING_STATE_KEY, JSON.stringify({
      categoryId: selectedCategoryId.value,
      categoryName: selectedCategoryName.value,
      categoryIcon: selectedCategoryIcon.value,
      instrumentId: selectedInstrumentId.value,
      date: selectedDate.value
    }))
  } catch (e) {
    console.warn('保存预约状态失败', e)
  }
}

function loadBookingState() {
  try {
    const raw = localStorage.getItem(BOOKING_STATE_KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('读取预约状态失败', e)
  }
  return null
}

const userInfo = computed(() => getUser())

const quickDateOptions = computed(() => {
  const maxAdvanceDays = Number(systemSettings.value?.booking_advance_days || 7)
  const bookingOpenTime = systemSettings.value?.booking_open_time || '09:00'
  const now = new Date()
  const openHour = parseInt(bookingOpenTime.split(':')[0])
  const openMinute = parseInt(bookingOpenTime.split(':')[1])
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const openMinutes = openHour * 60 + openMinute
  const isOpen = currentMinutes >= openMinutes

  const dayCount = 1 + maxAdvanceDays

  return Array.from({ length: dayCount }, (_, dayDiff) => {
    const date = new Date()
    date.setDate(date.getDate() + dayDiff)
    const value = formatDate(date)
    const label = getDateLabel(value)
    let title = `${dayDiff}天后`
    if (dayDiff === 0) title = '今天'
    if (dayDiff === 1) title = '明天'
    if (dayDiff === 2) title = '后天'

    let disabled = false
    let disabledReason = ''
    if (dayDiff > 0 && !isOpen) {
      disabled = true
      disabledReason = `${bookingOpenTime} 开放预约`
    }

    return { key: `day-${dayDiff}`, value, title, disabled, disabledReason, ...label }
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
  instruments.value.find((item) => item.id === selectedInstrumentId.value) || null
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
    categories.value = await CategoryAPI.list()
  } catch (e) {
    console.error('加载类别失败', e)
  }
}

async function handleSelectCategory(category) {
  selectedCategoryId.value = category.id
  selectedCategoryName.value = category.category_name
  selectedCategoryIcon.value = category.category_icon
  saveBookingState()

  try {
    const catSettings = await CategoryAPI.getSettings(category.id)
    categoryCustomSlots.value = catSettings?.custom_slots || []
  } catch (e) {
    categoryCustomSlots.value = []
  }

  await loadInstruments()
  await loadAvailability()
}

function isImageUrl(url) {
  if (!url) return false
  return url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)
}

async function loadInstruments() {
  if (!selectedCategoryId.value) return
  try {
    const savedState = loadBookingState()
    instruments.value = await InstrumentAPI.list(selectedCategoryId.value)
    if (instruments.value.length > 0) {
      const savedInstrument = savedState?.instrumentId
        && instruments.value.find(i => i.id === savedState.instrumentId)
      if (savedInstrument) {
        selectedInstrumentId.value = savedInstrument.id
      } else {
        selectedInstrumentId.value = instruments.value[0].id
      }
      saveBookingState()
    }
  } catch (e) {
    console.error('加载仪器失败', e)
  }
}

async function loadAvailability() {
  if (!selectedCategoryId.value || instruments.value.length === 0) {
    availabilityMap.value = {}
    return
  }

  let slotsToUse = customSlots.value
  if (!slotsToUse || slotsToUse.length === 0) {
    const systemSlots = systemSettings.value?.custom_slots
    slotsToUse = systemSlots && systemSlots.length > 0 ? systemSlots : null
  }
  if (!slotsToUse || slotsToUse.length === 0) {
    slotsToUse = [
      { slot_start: '09:00', slot_end: '10:00' },
      { slot_start: '10:00', slot_end: '11:00' },
      { slot_start: '11:00', slot_end: '12:00' },
      { slot_start: '13:00', slot_end: '14:00' },
      { slot_start: '14:00', slot_end: '15:00' },
      { slot_start: '15:00', slot_end: '16:00' },
      { slot_start: '16:00', slot_end: '17:00' },
      { slot_start: '17:00', slot_end: '18:00' }
    ]
  }

  const totalCount = slotsToUse.length
  if (totalCount === 0) {
    availabilityMap.value = {}
    return
  }

  try {
    const checkDate = selectedDate.value || getTodayDate()
    const [bookings, locks] = await Promise.all([
      BookingAPI.getByDate(checkDate, null, selectedCategoryId.value),
      TimeSlotAPI.getLocks({ lock_date: checkDate, category_id: selectedCategoryId.value })
    ])

    const nextMap = {}
    for (const instrument of instruments.value) {
      const instBookings = bookings.filter(b => b.instrument_id === instrument.id)
      const instLocks = locks.filter(l => l.instrument_id === instrument.id)
      const bookingSet = new Set(instBookings.map(b => b.slot_start))
      const dayLock = instLocks.some(l => l.lock_type === 'day' && l.lock_date === checkDate)
      const slotLockSet = new Set(instLocks.filter(l => l.lock_type === 'slot').map(l => l.slot_index))

      let freeCount = 0
      for (let i = 0; i < totalCount; i++) {
        const slot = slotsToUse[i]
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

      nextMap[instrument.id] = { status, label, freeCount, totalCount }
    }

    availabilityMap.value = nextMap
  } catch (e) {
    console.error('加载可用状态失败', e)
    availabilityMap.value = {}
  }
}

async function loadSlots(skipReset = false) {
  if (!selectedInstrumentId.value || !selectedDate.value) {
    slots.value = []
    return
  }

  loading.value = true
  if (!skipReset) {
    resetMessages()
  }
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

  if (dayDiff < 0) {
    errorMessage.value = '不能预约历史日期'
    slots.value = []
    loading.value = false
    return
  }

  if (dayDiff > maxAdvanceDays) {
    errorMessage.value = `仅可预约未来 ${maxAdvanceDays} 天内的日期`
    slots.value = []
    loading.value = false
    return
  }

  const isToday = dayDiff === 0
  const isFutureDay = dayDiff > 0
  const isBeforeOpenTime = currentMinutes < openMinutes

  if (isFutureDay && isBeforeOpenTime) {
    errorMessage.value = `未来日期预约每天 ${bookingOpenTime} 开放，请稍后再试`
    slots.value = []
    loading.value = false
    return
  }

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
      BookingAPI.getByDate(selectedDate.value, selectedInstrumentId.value, selectedCategoryId.value),
      TimeSlotAPI.getLocks({ lock_date: selectedDate.value, instrument_id: selectedInstrumentId.value, category_id: selectedCategoryId.value })
    ])

    const dayLock = locks.some(l => l.lock_type === 'day' && (l.lock_date === selectedDate.value || l.scope_type === 'long_term'))
    const slotLockMap = {}
    locks
      .filter(l => l.lock_type === 'slot' && (l.lock_date === selectedDate.value || l.scope_type === 'long_term'))
      .forEach(l => { slotLockMap[l.slot_index] = l })

    slots.value = baseSlots.map((slot) => {
      if (dayLock) return { ...slot, status: 'locked', text: '整天锁定' }
      if (slotLockMap[slot.slot_index]) return { ...slot, status: 'locked', text: '时段锁定' }

      if (isToday) {
        const slotHour = parseInt(slot.slot_start.split(':')[0])
        const slotMinute = parseInt(slot.slot_start.split(':')[1])
        const slotMinutes = slotHour * 60 + slotMinute

        if (currentMinutes >= slotMinutes) {
          return { ...slot, status: 'expired', text: '已过期' }
        }
      }

      const matchedBooking = bookings.find((item) => item.slot_start === slot.slot_start)
      if (matchedBooking) {
        const isMine = matchedBooking.user_id === userInfo.value?.id
        return {
          ...slot,
          booking_id: matchedBooking.id,
          record_id: matchedBooking.id,
          user_name: matchedBooking.user_name || '',
          employee_no: matchedBooking.employee_no || '',
          remark: matchedBooking.booking_remark || '',
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

  if (dayDiff < 0) {
    errorMessage.value = '不能预约历史日期'
    return
  }

  if (dayDiff > maxAdvanceDays) {
    errorMessage.value = `仅可预约未来 ${maxAdvanceDays} 天内的日期`
    return
  }

  if (dayDiff > 0 && currentMinutes < openMinutes) {
    errorMessage.value = `未来日期预约每天 ${bookingOpenTime} 开放，请稍后再试`
    return
  }

  operating.value = true
  resetMessages()

  try {
    const expiredSlots = selectedSlotsForOperation.value.filter(slot => slot.status === 'expired')
    if (expiredSlots.length > 0) {
      errorMessage.value = '所选时段中包含已过期的时段，请重新选择'
      return
    }

    const existingBookings = await BookingAPI.getByDate(
      selectedDate.value, selectedInstrumentId.value, selectedCategoryId.value
    )

    const existingSlotStarts = new Set(existingBookings.map(b => b.slot_start))
    const slotsToCreate = selectedSlotsForOperation.value.filter(
      slot => !existingSlotStarts.has(slot.slot_start)
    )

    if (slotsToCreate.length === 0) {
      errorMessage.value = '所选时段已被预约，请重新选择'
      return
    }

    let successCount = 0
    let failCount = 0
    const failedSlots = []

    for (const slot of slotsToCreate) {
      const bookingData = {
        booking_date: selectedDate.value,
        instrument_id: selectedInstrumentId.value,
        instrument_name: selectedInstrumentName.value,
        slot_start: slot.slot_start,
        slot_end: slot.slot_end,
        slot_index: slot.slot_index,
        booking_remark: remark.value,
        category_id: selectedCategoryId.value
      }

      const result = await BookingAPI.createOne(bookingData)
      if (result.success) {
        successCount++
      } else {
        failCount++
        failedSlots.push(`${slot.slot_start}-${slot.slot_end}`)
      }
    }

    if (successCount > 0 && failCount === 0) {
      successMessage.value = `预约成功：已预约 ${successCount} 个时段。`
    } else if (successCount > 0 && failCount > 0) {
      successMessage.value = `部分预约成功：${successCount} 个时段预约成功，${failCount} 个时段预约失败（${failedSlots.join('、')}）。`
    } else if (successCount === 0 && failCount > 0) {
      errorMessage.value = `预约失败：${failCount} 个时段均已被预约，请重新选择。`
    }

    await loadSlots(true)
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
    const existingBookings = await BookingAPI.getByDate(
      selectedDate.value, selectedInstrumentId.value, selectedCategoryId.value
    )

    const currentUserId = userInfo.value?.id
    let cancelledCount = 0
    for (const slot of selectedSlotsForOperation.value) {
      const existed = existingBookings.find((item) => item.slot_start === slot.slot_start)
      if (!existed || existed.user_id !== currentUserId) continue

      if (existed.id) {
        await BookingAPI.remove(existed.id)
        cancelledCount += 1
      }
    }

    successMessage.value = `取消完成：已取消 ${cancelledCount} 个时段。`
    await loadSlots(true)
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
  saveBookingState()
  if (selectedInstrumentId.value) {
    await loadSlots()
  }
  if (instruments.value.length > 0) {
    await loadAvailability()
  }
})

onMounted(async () => {
  loading.value = true
  try {
    systemSettings.value = await UserAPI.getSettings()
    await loadCategories()

    const savedState = loadBookingState()
    const maxAdvanceDays = Number(systemSettings.value?.booking_advance_days || 7)
    const today = getTodayDate()

    let savedDateValid = false
    if (savedState?.date) {
      const savedDateObj = new Date(savedState.date)
      const todayObj = new Date(today)
      savedDateObj.setHours(0, 0, 0, 0)
      todayObj.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((savedDateObj - todayObj) / (1000 * 60 * 60 * 24))
      if (diffDays >= 0 && diffDays <= maxAdvanceDays) {
        selectedDate.value = savedState.date
        savedDateValid = true
      }
    }

    if (savedState?.categoryId) {
      const savedCategory = categories.value.find(c => c.id === savedState.categoryId)
      if (savedCategory) {
        await handleSelectCategory(savedCategory)
        loading.value = false
        return
      }
    }

    if (categories.value.length > 0) {
      await handleSelectCategory(categories.value[0])
    }
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
    <div class="category-section card-surface">
      <div class="section-head">
        <h3>选择类别</h3>
      </div>
      <div class="category-list">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="category-card"
          :class="{ active: selectedCategoryId === cat.id }"
          type="button"
          @click="handleSelectCategory(cat)"
        >
          <div class="category-icon">
            <img v-if="isImageUrl(cat.category_icon)" :src="cat.category_icon" class="category-icon-img" :alt="cat.category_name" />
            <span v-else>{{ cat.category_icon || '📱' }}</span>
          </div>
          <div class="category-name">{{ cat.category_name }}</div>
        </button>
      </div>
    </div>

    <div class="card-surface availability-card">
      <div class="section-head">
        <h3>实时可用预览</h3>
        <span class="mini-tip">按 {{ formatDateText(selectedDate) }} 统计</span>
      </div>
      <div v-if="instruments.length === 0" class="empty-text">
        暂无仪器数据
      </div>
      <div v-else class="availability-list">
        <div v-for="item in instruments" :key="item.id" class="availability-row">
          <div class="avail-main">
            <div class="avail-title">{{ item.instrument_name }}</div>
            <div class="avail-sub">
              <span class="status-dot" :class="availabilityMap[item.id]?.status || 'free'"></span>
              {{ availabilityMap[item.id]?.label || '可用' }}
            </div>
          </div>
          <div class="avail-right">
            <div class="avail-count">
              {{ availabilityMap[item.id]?.freeCount ?? 0 }}/{{ availabilityMap[item.id]?.totalCount ?? 0 }}
            </div>
            <div v-if="item.description" class="avail-desc">备注：{{ item.description }}</div>
          </div>
        </div>
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
          :key="item.id"
          class="instrument-card"
          :class="{ active: selectedInstrumentId === item.id }"
          type="button"
          @click="selectedInstrumentId = item.id"
        >
          <div class="instrument-name">{{ item.instrument_name }}</div>
          <div class="instrument-state">
            <span class="status-dot" :class="availabilityMap[item.id]?.status || 'free'"></span>
            {{ availabilityMap[item.id]?.label || '可用' }}
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
          :class="{ active: selectedDate === item.value, disabled: item.disabled }"
          type="button"
          :disabled="item.disabled"
          :title="item.disabledReason || ''"
          @click="!item.disabled && (selectedDate = item.value)"
        >
          <div class="chip-title">{{ item.title }}</div>
          <div class="chip-date">{{ item.monthDay }}</div>
          <div class="chip-week">{{ item.weekday }}</div>
          <div v-if="item.disabled" class="chip-lock">{{ item.disabledReason }}</div>
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
  </div>
</template>

<style scoped>
.booking-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
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

.mini-tip {
  font-size: 12px;
  color: var(--text-secondary);
}

.category-list {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.category-list::-webkit-scrollbar {
  height: 4px;
}

.category-list::-webkit-scrollbar-thumb {
  background: var(--disabled);
  border-radius: 2px;
}

.category-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-card:hover {
  border-color: var(--primary);
}

.category-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.category-icon {
  font-size: 28px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-sm);
}

.category-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.instrument-list {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
  -webkit-overflow-scrolling: touch;
}

.instrument-list::-webkit-scrollbar {
  height: 4px;
}

.instrument-list::-webkit-scrollbar-thumb {
  background: var(--disabled);
  border-radius: 2px;
}

.instrument-card {
  flex-shrink: 0;
  min-width: 140px;
  padding: 14px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.instrument-card:hover {
  border-color: var(--primary);
}

.instrument-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.instrument-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.instrument-state {
  font-size: 12px;
  color: var(--text-secondary);
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
  background: var(--success);
}

.status-dot.partial, .legend-dot.mine {
  background: var(--warning);
}

.status-dot.busy, .legend-dot.booked {
  background: var(--danger);
}

.legend-dot.locked {
  background: var(--disabled);
}

.date-inline {
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.date-grid {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.date-grid::-webkit-scrollbar {
  height: 4px;
}

.date-grid::-webkit-scrollbar-thumb {
  background: var(--disabled);
  border-radius: 2px;
}

.date-chip {
  flex-shrink: 0;
  padding: 10px 16px;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
}

.date-chip:hover {
  border-color: var(--primary);
}

.date-chip.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.date-chip.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--disabled-soft);
}

.date-chip.disabled:hover {
  border-color: var(--line);
  background: var(--disabled-soft);
}

.chip-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.chip-date {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.chip-week {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.chip-lock {
  font-size: 10px;
  color: var(--warning);
  margin-top: 4px;
  font-weight: 500;
}

.legend-row {
  display: flex;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--text-secondary);
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
  max-height: 280px;
  overflow-y: auto;
  padding-right: 4px;
  -webkit-overflow-scrolling: touch;
}

.slot-list::-webkit-scrollbar {
  width: 4px;
}

.slot-list::-webkit-scrollbar-thumb {
  background: var(--disabled);
  border-radius: 2px;
}

.slot-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px;
  background: var(--success-soft);
  border-left: 4px solid var(--success);
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: center;
  transition: all 0.2s ease;
  border-right: none;
  border-top: none;
  border-bottom: none;
}

.slot-row.available { background: var(--success-soft); border-left-color: var(--success); }
.slot-row.mine { background: var(--warning-soft); border-left-color: var(--warning); }
.slot-row.booked { background: var(--danger-soft); border-left-color: var(--danger); cursor: not-allowed; }
.slot-row.locked { background: var(--disabled-soft); border-left-color: var(--disabled); cursor: not-allowed; }
.slot-row.expired { background: var(--disabled-soft); border-left-color: var(--disabled); cursor: not-allowed; opacity: 0.6; }

.slot-row.selected {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.slot-time {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.slot-status {
  font-size: 11px;
  color: var(--text-secondary);
}

.slot-person {
  font-size: 11px;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  margin: 10px 0;
}

.notice.error { background: var(--danger-soft); color: var(--danger); }
.notice.success { background: var(--success-soft); color: var(--success); }
.notice.loading { background: var(--primary-soft); color: var(--primary); }

.remark-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  resize: none;
  outline: none;
  margin-bottom: 14px;
  font-family: inherit;
}

.remark-input:focus {
  border-color: var(--primary);
}

.confirm-info {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 14px;
  background: var(--bg);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 14px;
}

.confirm-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.primary-btn {
  flex: 1;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  min-width: 100px;
  transition: background 0.2s;
}

.primary-btn:hover {
  background: var(--primary-hover);
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secondary-btn {
  background: var(--hover);
  color: var(--text-primary);
  border: none;
  border-radius: var(--radius-md);
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary-btn:hover {
  background: var(--line);
}

.secondary-btn.warning {
  background: var(--warning-soft);
  color: var(--warning);
}

.secondary-btn.warning:hover {
  background: var(--hover);
}

.empty-text {
  text-align: center;
  color: var(--text-muted);
  padding: 24px 0;
  font-size: 14px;
}

.card-surface {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-5);
  transition: all 0.2s ease;
  margin-bottom: var(--space-4);
}

.card-surface:hover {
  box-shadow: var(--shadow-md);
}

.availability-card {
  background: var(--card);
}

.availability-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 4px;
  -webkit-overflow-scrolling: touch;
}

.availability-list::-webkit-scrollbar {
  width: 4px;
}

.availability-list::-webkit-scrollbar-thumb {
  background: var(--disabled);
  border-radius: 2px;
}

.availability-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--bg);
}

.avail-main {
  flex: 1;
}

.avail-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.avail-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.avail-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.avail-count {
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
}

.avail-desc {
  font-size: 11px;
  color: var(--text-muted);
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
