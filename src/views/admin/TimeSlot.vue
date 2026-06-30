<script setup>
import { ref, onMounted, watch } from 'vue'
import { TimeSlotAPI, UserAPI, CategoryAPI } from '@/api'

const loading = ref(false)
const operating = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const categories = ref([])
const scope = ref('global')
const selectedCategoryId = ref('')
const customSlots = ref([])

const newSlot = ref({
  slot_start: '',
  slot_end: ''
})

const bookingAdvanceDays = ref(1)
const bookingOpenTime = ref('09:00')

async function loadCategories() {
  try {
    categories.value = await CategoryAPI.list()
  } catch (e) {
    console.error(e)
  }
}

async function loadGlobalConfig() {
  loading.value = true
  try {
    const settings = await UserAPI.getSettings()
    customSlots.value = settings?.custom_slots || []
    bookingAdvanceDays.value = Number(settings?.booking_advance_days || 1)
    bookingOpenTime.value = settings?.booking_open_time || '09:00'
  } catch (e) {
    errorMessage.value = e.message || '加载配置失败'
  } finally {
    loading.value = false
  }
}

async function loadCategoryConfig() {
  if (!selectedCategoryId.value) return
  loading.value = true
  try {
    const catSettings = await CategoryAPI.getSettings(selectedCategoryId.value)
    customSlots.value = catSettings?.custom_slots || []
  } catch (e) {
    errorMessage.value = e.message || '加载类别配置失败'
  } finally {
    loading.value = false
  }
}

function addSlotRow() {
  if (!newSlot.value.slot_start || !newSlot.value.slot_end) {
    errorMessage.value = '请填写时段起止时间'
    return
  }
  customSlots.value.push({
    slot_start: newSlot.value.slot_start,
    slot_end: newSlot.value.slot_end
  })
  customSlots.value.sort((a, b) => a.slot_start.localeCompare(b.slot_start))
  newSlot.value.slot_start = ''
  newSlot.value.slot_end = ''
  errorMessage.value = ''
}

function removeSlotRow(index) {
  customSlots.value.splice(index, 1)
}

async function saveSlots() {
  operating.value = true
  errorMessage.value = ''
  try {
    if (scope.value === 'global') {
      await UserAPI.saveSettings({
        custom_slots: customSlots.value,
        booking_advance_days: String(bookingAdvanceDays.value),
        booking_open_time: bookingOpenTime.value
      })
    } else {
      if (!selectedCategoryId.value) {
        throw new Error('请选择类别')
      }
      await CategoryAPI.saveSettings(selectedCategoryId.value, {
        custom_slots: customSlots.value
      })
    }
    successMessage.value = '保存成功'
    setTimeout(() => { successMessage.value = '' }, 2000)
  } catch (e) {
    errorMessage.value = e.message || '保存失败'
  } finally {
    setTimeout(() => {
      operating.value = false
    }, 1200)
  }
}

function handleScopeChange() {
  customSlots.value = []
  if (scope.value === 'global') {
    loadGlobalConfig()
  } else if (scope.value === 'category' && selectedCategoryId.value) {
    loadCategoryConfig()
  }
}

watch([() => scope.value, selectedCategoryId], () => {
  handleScopeChange()
})

onMounted(async () => {
  await loadCategories()
  await loadGlobalConfig()
})
</script>

<template>
  <div class="admin-page">
    <div class="config-card">
      <div class="scope-tabs">
        <button
          class="scope-btn"
          :class="{ active: scope === 'global' }"
          type="button"
          @click="scope = 'global'"
        >
          全局时段配置
        </button>
        <button
          class="scope-btn"
          :class="{ active: scope === 'category' }"
          type="button"
          @click="scope = 'category'"
        >
          按类别自定义
        </button>
      </div>

      <div v-if="scope === 'category'" class="category-select">
        <label>选择类别</label>
        <select v-model="selectedCategoryId">
          <option value="">请选择类别</option>
          <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.category_name }}</option>
        </select>
      </div>
    </div>

    <div v-if="scope === 'global'" class="config-card">
      <h3>预约规则</h3>
      <div class="rule-row">
        <div class="field-block">
          <label>可预约未来天数</label>
          <select v-model.number="bookingAdvanceDays">
            <option :value="0">仅当天</option>
            <option :value="1">1天</option>
            <option :value="2">2天</option>
            <option :value="3">3天</option>
            <option :value="5">5天</option>
            <option :value="7">7天</option>
            <option :value="14">14天</option>
          </select>
          <p class="field-tip">当天始终可预约</p>
        </div>
        <div class="field-block">
          <label>开放预约时间</label>
          <input v-model="bookingOpenTime" type="time" />
          <p class="field-tip">每天此时间后开放未来天数预约</p>
        </div>
      </div>
    </div>

    <div class="slots-card">
      <div class="card-header">
        <h3>时段列表（{{ customSlots.length }} 个）</h3>
        <button class="secondary-btn" type="button" @click="addSlotRow">+ 添加时段</button>
      </div>

      <div class="add-slot-row">
        <div class="time-input">
          <input v-model="newSlot.slot_start" type="time" placeholder="开始时间" />
        </div>
        <span class="time-sep">至</span>
        <div class="time-input">
          <input v-model="newSlot.slot_end" type="time" placeholder="结束时间" />
        </div>
        <button class="primary-btn small" type="button" @click="addSlotRow">添加</button>
      </div>

      <div v-if="customSlots.length === 0" class="empty-text">
        暂无时段配置，默认使用 09:00 - 18:00 每小时一段
      </div>
      <div v-else class="slot-list">
        <div v-for="(slot, index) in customSlots" :key="index" class="slot-item">
          <span class="slot-time">{{ slot.slot_start }} - {{ slot.slot_end }}</span>
          <button class="text-btn danger" type="button" @click="removeSlotRow(index)">删除</button>
        </div>
      </div>

      <p v-if="errorMessage" class="notice error">{{ errorMessage }}</p>
      <p v-if="successMessage" class="notice success">{{ successMessage }}</p>

      <div class="save-row">
        <button
          class="primary-btn"
          type="button"
          @click="saveSlots"
          :disabled="operating || loading"
        >
          {{ operating ? '保存中...' : '保存配置' }}
        </button>
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

.config-card,
.slots-card {
  background: var(--card);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  box-shadow: var(--shadow-sm);
}

.scope-tabs {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.scope-btn {
  padding: 10px 20px;
  background: var(--hover);
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scope-btn.active {
  background: var(--primary);
  color: white;
}

.category-select {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.category-select label {
  font-size: 13px;
  color: var(--text-secondary);
}

.category-select select {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  min-width: 180px;
}

.rule-row {
  display: flex;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.field-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-block label {
  font-size: 13px;
  color: var(--text-secondary);
}

.field-block input,
.field-block select {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
  min-width: 140px;
}

.field-tip {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.card-header h3 {
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
  padding: 8px 16px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary-btn:hover {
  background: var(--line);
}

.primary-btn {
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: 10px 24px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.primary-btn.small {
  padding: 8px 16px;
  font-size: 13px;
}

.primary-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.primary-btn:disabled {
  background: var(--disabled);
  cursor: not-allowed;
}

.add-slot-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  background: var(--bg);
  border-radius: var(--radius-md);
}

.time-input {
  flex: 1;
}

.time-input input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  font-size: 14px;
  outline: none;
}

.time-sep {
  font-size: 13px;
  color: var(--text-secondary);
}

.slot-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.slot-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-3);
  background: var(--bg);
  border-radius: var(--radius-md);
}

.slot-time {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.text-btn {
  background: none;
  border: none;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.text-btn:hover:not(:disabled) {
  background: var(--hover);
}

.text-btn.danger {
  color: var(--danger);
}

.text-btn.danger:hover {
  background: var(--danger-soft);
}

.save-row {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--space-2);
  border-top: 1px solid var(--line);
}

.empty-text {
  text-align: center;
  padding: 30px;
  color: var(--text-muted);
  font-size: 13px;
}

.notice {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 14px;
  margin: var(--space-3) 0;
}

.notice.error { background: var(--danger-soft); color: var(--danger); }
.notice.success { background: var(--success-soft); color: var(--success); }
</style>
