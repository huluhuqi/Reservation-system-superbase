<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { instrumentApi } from '../../api/instrument.js'
import { categoryApi } from '../../api/category.js'
import { bookingApi } from '../../api/booking.js'
import { timeSlotApi } from '../../api/timeSlot.js'
import { userApi } from '../../api/user.js'
import { getUser } from '../../api/context.js'
import { formatDate, getTodayDate, getDateLabel, formatDateText } from '../../utils/date.js'

const router = useRouter()
const loading = ref(false)
const categories = ref([])
const instruments = ref([])
const selectedCategory = ref(null)
const availabilityMap = ref({})
const systemSettings = ref(null)

const userInfo = computed(() => getUser())

const overviewList = computed(() => {
  return instruments.value.slice(0, 4).map((item) => {
    const status = availabilityMap.value[item._id] || {
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
    categories.value = await categoryApi.getCategories()
  } catch (e) {
    console.error('加载类别失败', e)
  }
}

async function handleSelectCategory(category) {
  selectedCategory.value = category
  await loadInstruments()
  await loadAvailability()
}

function handleBackToCategorySelection() {
  selectedCategory.value = null
  instruments.value = []
}

async function loadInstruments() {
  if (!selectedCategory.value) return
  try {
    instruments.value = await instrumentApi.getInstruments({
      category_id: selectedCategory.value._id
    })
  } catch (e) {
    console.error('加载仪器失败', e)
  }
}

async function loadAvailability() {
  if (instruments.value.length === 0) {
    availabilityMap.value = {}
    return
  }

  try {
    const today = getTodayDate()
    const [bookings, locks] = await Promise.all([
      bookingApi.getBookingsByDate(today, null, selectedCategory.value?._id),
      timeSlotApi.getLocks({ date: today, category_id: selectedCategory.value?._id })
    ])

    const slots = systemSettings.value?.custom_slots || []
    const totalCount = slots.length
    const nextMap = {}

    for (const instrument of instruments.value) {
      const instBookings = bookings.filter(b => b.instrument_id === instrument._id)
      const instLocks = locks.filter(l => l.instrument_id === instrument._id)
      const bookingSet = new Set(instBookings.map(b => b.slot_start))
      const dayLock = instLocks.some(l => l.lock_type === 'day' && l.lock_date === today)
      const slotLockSet = new Set(
        instLocks.filter(l => l.lock_type === 'slot').map(l => l.slot_index)
      )

      let freeCount = 0
      for (let i = 0; i < totalCount; i++) {
        const slot = slots[i]
        if (dayLock || slotLockSet.has(i) || bookingSet.has(slot?.slot_start)) {
          continue
        }
        freeCount += 1
      }

      let status = 'free'
      let label = '可用'
      let note = '当前空闲'

      if (dayLock) {
        status = 'busy'
        label = '锁定'
        note = '当天锁定'
      } else if (freeCount === 0) {
        status = 'busy'
        label = '已满'
        note = '暂无可约'
      } else if (freeCount < totalCount) {
        status = 'partial'
        label = '部分可用'
        note = `剩余 ${freeCount}/${totalCount}`
      }

      nextMap[instrument._id] = {
        status,
        label,
        note,
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
  router.push('/home/booking')
}

onMounted(async () => {
  loading.value = true
  try {
    systemSettings.value = await userApi.getSettings()
    await loadCategories()
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="home-page">
    <div class="hero-card card-surface">
      <div class="hero-greeting">
        <div class="greeting-text">
          <h2>你好，{{ userInfo?.user_name || '同学' }} 👋</h2>
          <p>欢迎使用科研仪器预约系统</p>
        </div>
      </div>

      <div class="quick-actions">
        <button class="action-btn primary" type="button" @click="handleGoToBooking">
          <span class="action-icon">📅</span>
          <span>立即预约</span>
        </button>
        <button class="action-btn" type="button" @click="$router.push('/home/records')">
          <span class="action-icon">📋</span>
          <span>我的记录</span>
        </button>
      </div>
    </div>

    <div class="category-section card-surface">
      <div class="section-head">
        <h3>选择仪器类别</h3>
        <span class="mini-tip">点击查看详情</span>
      </div>
      <div class="category-grid">
        <button
          v-for="cat in categories"
          :key="cat._id"
          class="category-card"
          :class="{ active: selectedCategory?._id === cat._id }"
          type="button"
          @click="handleSelectCategory(cat)"
        >
          <div class="category-icon">{{ cat.category_icon || '📱' }}</div>
          <div class="category-name">{{ cat.category_name }}</div>
        </button>
      </div>
    </div>

    <div v-if="selectedCategory" class="overview-card card-surface">
      <div class="section-head">
        <h3>{{ selectedCategory.category_name }} - 实时可用概览</h3>
        <span class="overview-time">按 {{ formatDateText(getTodayDate()) }} 统计</span>
      </div>

      <button class="back-btn" type="button" @click="handleBackToCategorySelection">
        ← 返回类别选择
      </button>

      <div v-if="overviewList.length === 0" class="empty-text">
        暂无仪器数据
      </div>

      <div v-for="item in overviewList" :key="item._id" class="overview-row">
        <div class="thumb" :class="item.status"></div>
        <div class="overview-main">
          <div class="overview-title">{{ item.instrument_name }}</div>
          <div class="overview-sub">
            <span class="status-dot" :class="item.status"></span>
            {{ item.label }}
          </div>
        </div>
        <div class="overview-count">{{ item.freeCount }}/{{ item.totalCount }}</div>
      </div>
    </div>

    <div v-else class="overview-card card-surface">
      <div class="section-head">
        <h3>系统提示</h3>
      </div>
      <p class="tip-text">请先选择仪器类别，查看实时可用情况</p>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  padding-bottom: 20px;
}

.hero-card {
  background: linear-gradient(135deg, #4a90e2 0%, #357abd 100%);
  color: white;
}

.hero-card h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.hero-card p {
  margin: 0;
  opacity: 0.9;
  font-size: 14px;
}

.quick-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 12px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.action-btn.primary {
  background: white;
  color: #4a90e2;
}

.action-icon {
  font-size: 24px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.category-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 8px;
  background: #f7f9fd;
  border: 2px solid transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.category-card:hover {
  background: #eef3fb;
}

.category-card.active {
  border-color: #4a90e2;
  background: #f0f6ff;
}

.category-icon {
  font-size: 28px;
}

.category-name {
  font-size: 13px;
  color: #1f2a44;
  font-weight: 500;
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

.overview-time {
  font-size: 12px;
  color: #8a9ab5;
}

.back-btn {
  background: none;
  border: none;
  color: #4a90e2;
  font-size: 13px;
  cursor: pointer;
  padding: 0 0 12px;
}

.overview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f0f2f7;
}

.overview-row:last-child {
  border-bottom: none;
}

.thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.thumb.free {
  background: #27ae60;
}

.thumb.partial {
  background: #f39c12;
}

.thumb.busy {
  background: #95a5a6;
}

.overview-main {
  flex: 1;
}

.overview-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2a44;
}

.overview-sub {
  font-size: 12px;
  color: #6b7a99;
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.free {
  background: #27ae60;
}

.status-dot.partial {
  background: #f39c12;
}

.status-dot.busy {
  background: #95a5a6;
}

.overview-count {
  font-size: 14px;
  font-weight: 600;
  color: #4a90e2;
}

.empty-text {
  text-align: center;
  color: #9aa8c4;
  padding: 30px 0;
  font-size: 14px;
}

.tip-text {
  color: #6b7a99;
  font-size: 14px;
  margin: 0;
}
</style>
