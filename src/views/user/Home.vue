<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { CategoryAPI, InstrumentAPI, BookingAPI, TimeSlotAPI, UserAPI, RoleAPI } from '@/api'
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
const allCategories = ref([])
const filteredCategories = ref([])
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
    allCategories.value = await CategoryAPI.list()
    
    // 根据用户角色过滤可预约的类别
    const user = getUser()
    if (!user) {
      filteredCategories.value = allCategories.value
      return
    }

    try {
      const roleInfo = await RoleAPI.getUserAccessibleCategories(user.id)
      
      if (roleInfo && !roleInfo.can_booking_all && roleInfo.category_ids) {
        filteredCategories.value = allCategories.value.filter(
          cat => roleInfo.category_ids.includes(cat.id)
        )
      } else {
        filteredCategories.value = allCategories.value
      }
    } catch (e) {
      console.warn('获取用户角色信息失败，显示全部类别', e)
      filteredCategories.value = allCategories.value
    }
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
    try {
      localStorage.setItem('booking_selected_state', JSON.stringify({
        categoryId: selectedCategory.value.id,
        categoryName: selectedCategory.value.category_name,
        categoryIcon: selectedCategory.value.category_icon
      }))
    } catch (e) {
      console.warn('保存预约状态失败', e)
    }
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
    if (filteredCategories.value.length > 0) {
      await handleSelectCategory(filteredCategories.value[0])
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
            v-for="cat in filteredCategories"
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
  padding: var(--space-4) var(--space-4) 100px;
  background: linear-gradient(180deg, var(--primary-soft) 0%, var(--bg) 300px);
  min-height: 100vh;
}

.hero-card {
  padding: var(--space-5) var(--space-1) var(--space-4);
}

.hero-title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
}

.hero-subtitle {
  margin: 6px 0 0;
  font-size: 15px;
  color: var(--text-secondary);
}

.card-surface {
  background: var(--card);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
  margin-bottom: var(--space-4);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.section-head h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.section-tip {
  font-size: 13px;
  color: var(--primary);
}

.section-date {
  font-size: 13px;
  color: var(--primary);
  font-weight: 500;
}

.category-scroll {
  overflow-x: auto;
  margin: 0 calc(var(--space-5) * -1);
  padding: 0 var(--space-5);
  scrollbar-width: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-track {
  display: flex;
  gap: var(--space-3);
  padding-bottom: var(--space-1);
}

.category-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--disabled-soft);
  border: 2px solid transparent;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 100px;
}

.category-card.active {
  border-color: var(--primary);
  background: var(--primary-soft);
}

.category-icon-wrap {
  width: 64px;
  height: 64px;
  background: var(--card);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-sm);
}

.category-icon {
  font-size: 32px;
}

.category-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.overview-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.overview-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) 0;
  border-bottom: 1px solid var(--line);
  cursor: pointer;
  transition: background 0.2s;
}

.overview-row:last-child {
  border-bottom: none;
}

.overview-row:active {
  background: var(--hover);
  margin: 0 calc(var(--space-2) * -1.25);
  padding-left: calc(var(--space-2) * 1.25);
  padding-right: calc(var(--space-2) * 1.25);
  border-radius: var(--radius-md);
}

.overview-thumb {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #ffe8cc 0%, #ffd4a3 100%);
  border-radius: var(--radius-lg);
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
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.overview-sub {
  font-size: 13px;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-dot.free { background: var(--success); }
.status-dot.partial { background: var(--warning); }
.status-dot.busy { background: var(--text-muted); }

.overview-progress {
  width: 100px;
  flex-shrink: 0;
  margin: 0 var(--space-3);
}

.progress-bar {
  height: 8px;
  background: var(--disabled-soft);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: var(--radius-sm);
  transition: width 0.3s ease;
}

.progress-fill.free { background: var(--success); }
.progress-fill.partial { background: var(--warning); }
.progress-fill.busy { background: var(--disabled); }

.overview-count {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
  flex-shrink: 0;
  min-width: 50px;
  text-align: right;
}

.overview-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-1);
  flex-shrink: 0;
  min-width: 50px;
}

.overview-desc {
  font-size: 11px;
  color: var(--text-muted);
  text-align: right;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-text {
  text-align: center;
  color: var(--text-muted);
  padding: 30px 0;
  font-size: 14px;
}

.bottom-actions {
  position: fixed;
  bottom: 70px;
  left: var(--space-4);
  right: var(--space-4);
  z-index: 50;
}

.book-btn {
  width: 100%;
  padding: var(--space-4);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.35);
  transition: all 0.2s;
}

.book-btn:disabled {
  background: var(--disabled);
  box-shadow: none;
  cursor: not-allowed;
}

.book-btn:active:not(:disabled) {
  transform: scale(0.98);
}
</style>
