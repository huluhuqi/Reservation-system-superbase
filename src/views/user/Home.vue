<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { CategoryAPI, InstrumentAPI, BookingAPI, TimeSlotAPI, UserAPI } from '@/api'
import { getTodayDate, formatDateText } from '../../utils/date.js'

function getUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const router = useRouter()
const loading = ref(false)
const categories = ref([])
const instruments = ref([])
const selectedCategory = ref(null)
const availabilityMap = ref({})
const systemSettings = ref(null)

const userInfo = computed(() => getUser())

const overviewList = computed(() => {
  return instruments.value.map((item) => {
    const status = availabilityMap.value[item.id] || {
      status: 'free',
      label: '可用',
      freeCount: 0,
      totalCount: 0
    }
    return {
      ...item,
      ...status
    }
  })
})

async function loadCategories() {
  try {
    categories.value = await CategoryAPI.list()
  } catch (e) {
    console.error('加载类别失败', e)
  }
}

async function handleSelectCategory(category) {
  selectedCategory.value = category
  await loadInstruments()
  await loadAvailability()
}

async function loadInstruments() {
  if (!selectedCategory.value) return
  try {
    instruments.value = await InstrumentAPI.list(selectedCategory.value.id)
  } catch (e) {
    console.error('加载仪器失败', e)
  }
}

async function loadAvailability() {
  if (instruments.value.length === 0) {
    availabilityMap.value = {}
    return
  }

  let slotsToUse = systemSettings.value?.custom_slots || []
  if (slotsToUse.length === 0) {
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
    const today = getTodayDate()
    const [bookings, locks] = await Promise.all([
      BookingAPI.getByDate(today, null, selectedCategory.value?.id),
      TimeSlotAPI.getLocks({ lock_date: today, category_id: selectedCategory.value?.id })
    ])

    const nextMap = {}

    for (const instrument of instruments.value) {
      const instBookings = bookings.filter(b => b.instrument_id === instrument.id)
      const instLocks = locks.filter(l => l.instrument_id === instrument.id)
      const bookingSet = new Set(instBookings.map(b => b.slot_start))
      const dayLock = instLocks.some(l => l.lock_type === 'day' && l.lock_date === today)
      const slotLockSet = new Set(
        instLocks.filter(l => l.lock_type === 'slot').map(l => l.slot_index)
      )

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

      if (dayLock) {
        status = 'busy'
        label = '锁定'
      } else if (freeCount === 0) {
        status = 'busy'
        label = '已满'
      } else if (freeCount < totalCount) {
        status = 'partial'
        label = '部分可用'
      }

      nextMap[instrument.id] = {
        status,
        label,
        freeCount,
        totalCount
      }
    }

    availabilityMap.value = nextMap
  } catch (e) {
    console.error('加载可用状态失败', e)
  }
}

function handleGoToBooking() {
  if (selectedCategory.value) {
    router.push('/home/booking')
  }
}

function isImageUrl(url) {
  if (!url) return false
  return url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(url)
}

onMounted(async () => {
  loading.value = true
  try {
    systemSettings.value = await UserAPI.getSettings()
    await loadCategories()
    if (categories.value.length > 0) {
      await handleSelectCategory(categories.value[0])
    }
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="home-page">
    <div class="hero-card">
      <h1 class="hero-title">科研仪器预约系统</h1>
      <p class="hero-subtitle" v-if="selectedCategory">{{ selectedCategory.category_name }} 设备预约</p>
    </div>

    <div class="category-section card-surface">
      <div class="section-head">
        <h3>选择仪器类别</h3>
        <span class="section-tip">左右滑动查看更多</span>
      </div>
      <div class="category-scroll">
        <div class="category-track">
          <button
            v-for="cat in categories"
            :key="cat.id"
            class="category-card"
            :class="{ active: selectedCategory?.id === cat.id }"
            type="button"
            @click="handleSelectCategory(cat)"
          >
            <div class="category-icon-wrap">
              <img v-if="isImageUrl(cat.category_icon)" :src="cat.category_icon" class="category-icon-img" :alt="cat.category_name" />
              <span v-else class="category-icon">{{ cat.category_icon || '📱' }}</span>
            </div>
            <div class="category-name">{{ cat.category_name }}</div>
          </button>
        </div>
      </div>
    </div>

    <div class="overview-section card-surface">
      <div class="section-head">
        <h3>实时可用概览</h3>
        <span class="section-date">按 {{ formatDateText(getTodayDate()) }} 统计</span>
      </div>

      <div v-if="overviewList.length === 0" class="empty-text">
        暂无仪器数据
      </div>

      <div v-else class="overview-list">
        <div
          v-for="item in overviewList"
          :key="item.id"
          class="overview-row"
          @click="handleGoToBooking"
        >
          <div class="overview-thumb">
            <img v-if="isImageUrl(selectedCategory?.category_icon)" :src="selectedCategory.category_icon" class="thumb-icon-img" :alt="selectedCategory.category_name" />
            <span v-else class="thumb-icon">{{ selectedCategory?.category_icon || '📱' }}</span>
          </div>
          <div class="overview-main">
            <div class="overview-title">{{ item.instrument_name }}</div>
            <div class="overview-sub">
              <span class="status-dot" :class="item.status"></span>
              {{ item.label }}
            </div>
          </div>
          <div class="overview-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :class="item.status"
                :style="{ width: (item.freeCount / item.totalCount * 100) + '%' }"
              ></div>
            </div>
          </div>
          <div class="overview-right">
            <div class="overview-count">{{ item.freeCount }}/{{ item.totalCount }}</div>
            <div v-if="item.description" class="overview-desc">备注：{{ item.description }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="book-btn" type="button" @click="handleGoToBooking" :disabled="!selectedCategory">
        立即预约
      </button>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  padding: 16px 16px 100px;
  background: linear-gradient(180deg, #e8f0ff 0%, #f5f7fa 300px);
  min-height: 100vh;
}

.hero-card {
  padding: 20px 4px 16px;
}

.hero-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #1a2a4a;
}

.hero-subtitle {
  margin: 6px 0 0;
  font-size: 15px;
  color: #6b7a99;
}

.card-surface {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 18px;
  box-shadow: 0 4px 20px rgba(31, 42, 68, 0.06);
  margin-bottom: 16px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.section-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a2a4a;
}

.section-tip {
  font-size: 13px;
  color: #4a90e2;
}

.section-date {
  font-size: 13px;
  color: #4a90e2;
  font-weight: 500;
}

.category-scroll {
  overflow-x: auto;
  margin: 0 -18px;
  padding: 0 18px;
  scrollbar-width: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-track {
  display: flex;
  gap: 14px;
  padding-bottom: 4px;
}

.category-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 100px;
}

.category-card.active {
  border-color: #4a90e2;
  background: #f0f6ff;
}

.category-icon-wrap {
  width: 64px;
  height: 64px;
  background: white;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.category-icon {
  font-size: 32px;
}

.category-name {
  font-size: 14px;
  font-weight: 600;
  color: #1f2a44;
}

.overview-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.overview-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid #f0f2f7;
  cursor: pointer;
  transition: background 0.2s;
}

.overview-row:last-child {
  border-bottom: none;
}

.overview-row:active {
  background: #f7f9fd;
  margin: 0 -10px;
  padding-left: 10px;
  padding-right: 10px;
  border-radius: 10px;
}

.overview-thumb {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #ffe8cc 0%, #ffd4a3 100%);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.thumb-icon {
  font-size: 24px;
}

.category-icon-img,
.thumb-icon-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.overview-main {
  flex: 1;
  min-width: 0;
}

.overview-title {
  font-size: 17px;
  font-weight: 600;
  color: #1a2a4a;
  margin-bottom: 4px;
}

.overview-sub {
  font-size: 13px;
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

.status-dot.free { background: #27ae60; }
.status-dot.partial { background: #f39c12; }
.status-dot.busy { background: #95a5a6; }

.overview-progress {
  width: 100px;
  flex-shrink: 0;
  margin: 0 12px;
}

.progress-bar {
  height: 8px;
  background: #eef2f7;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-fill.free { background: linear-gradient(90deg, #27ae60, #2ecc71); }
.progress-fill.partial { background: linear-gradient(90deg, #f39c12, #f1c40f); }
.progress-fill.busy { background: linear-gradient(90deg, #95a5a6, #bdc3c7); }

.overview-count {
  font-size: 16px;
  font-weight: 700;
  color: #4a90e2;
  flex-shrink: 0;
  min-width: 50px;
  text-align: right;
}

.overview-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
  min-width: 50px;
}

.overview-desc {
  font-size: 11px;
  color: #8a9ab5;
  text-align: right;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-text {
  text-align: center;
  color: #9aa8c4;
  padding: 30px 0;
  font-size: 14px;
}

.bottom-actions {
  position: fixed;
  bottom: 70px;
  left: 16px;
  right: 16px;
  z-index: 50;
}

.book-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
  border: none;
  border-radius: 14px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(74, 144, 226, 0.35);
  transition: all 0.2s;
}

.book-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.book-btn:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
