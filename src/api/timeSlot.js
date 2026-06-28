import { safePost } from './safeRequest.js'
import { getUserId, getUserRole } from './context.js'
import { userApi } from './user.js'

const BOOKINGS_TABLE = 'kg7500_bookings'
const LOCKS_TABLE = 'kg7500_locks'
const SETTINGS_TABLE = 'kg7500_settings'
const CATEGORY_SETTINGS_TABLE = 'kg7500_category_settings'
const APP_KEY = '4418E8F40E3E27D3EBFD592311539A89'

const DEFAULT_SLOTS = [
  { slot_start: '09:00', slot_end: '10:00' },
  { slot_start: '10:00', slot_end: '11:00' },
  { slot_start: '11:00', slot_end: '12:00' },
  { slot_start: '13:00', slot_end: '14:00' },
  { slot_start: '14:00', slot_end: '15:00' },
  { slot_start: '15:00', slot_end: '16:00' },
  { slot_start: '16:00', slot_end: '17:00' },
  { slot_start: '17:00', slot_end: '18:00' }
]

function normalizeRecord(record) {
  if (!record) return record
  const result = { ...record }
  if (result.id !== undefined && result._id === undefined) {
    result._id = String(result.id)
  }
  return result
}

export const timeSlotApi = {
  async getGlobalSlots() {
    const settings = await userApi.getSettings()
    return settings?.custom_slots || []
  },

  async saveGlobalSlots(slots) {
    const settings = await userApi.getSettings()
    if (settings) {
      const payload = {
        s: 'App.Table.Update',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: SETTINGS_TABLE,
        id: settings.id,
        data: JSON.stringify({ custom_slots: slots })
      }
      return safePost('/', { ...payload, __admin: true })
    }
    const payload = {
      s: 'App.Table.Create',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: SETTINGS_TABLE,
      data: JSON.stringify({ custom_slots: slots })
    }
    return safePost('/', { ...payload, __admin: true })
  },

  async getCategorySlots(category_id) {
    const conditions = [['category_id', '=', String(category_id)]]
    const payload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_SETTINGS_TABLE,
      logic: 'and',
      where: JSON.stringify(conditions),
      page: 1,
      perpage: 1
    }
    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list[0]?.custom_slots || []
  },

  async saveCategorySlots(category_id, slots) {
    const conditions = [['category_id', '=', String(category_id)]]
    const queryPayload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_SETTINGS_TABLE,
      logic: 'and',
      where: JSON.stringify(conditions),
      page: 1,
      perpage: 1
    }
    const queryRes = await safePost('/', queryPayload, { skipRisk: true })
    const existing = (queryRes.list || [])[0]

    if (existing) {
      const payload = {
        s: 'App.Table.Update',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: CATEGORY_SETTINGS_TABLE,
        id: existing.id,
        data: JSON.stringify({ custom_slots: slots })
      }
      return safePost('/', { ...payload, __admin: true })
    }
    const payload = {
      s: 'App.Table.Create',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: CATEGORY_SETTINGS_TABLE,
      data: JSON.stringify({ category_id, custom_slots: slots })
    }
    return safePost('/', { ...payload, __admin: true })
  },

  async getTimeSlots(instrument_id, date) {
    const settings = await userApi.getSettings()
    const customSlots = settings?.custom_slots || []
    const baseSlots = customSlots.length > 0 ? customSlots : DEFAULT_SLOTS

    const slots = [...baseSlots]
      .sort((a, b) => a.slot_start.localeCompare(b.slot_start))
      .map((item, index) => ({
        slot_index: index,
        slot_start: item.slot_start,
        slot_end: item.slot_end,
        booked: false,
        locked: false
      }))

    const bookingConditions = [
      ['booking_date', '=', date],
      ['instrument_id', '=', String(instrument_id)]
    ]
    const bookingPayload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: BOOKINGS_TABLE,
      logic: 'and',
      where: JSON.stringify(bookingConditions),
      page: 1,
      perpage: 500
    }
    const bookingRes = await safePost('/', bookingPayload, { skipRisk: true })
    const bookings = (bookingRes.list || []).map(normalizeRecord)

    const lockConditions = [
      ['lock_date', '=', date],
      ['instrument_id', '=', String(instrument_id)]
    ]
    const lockPayload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: LOCKS_TABLE,
      logic: 'and',
      where: JSON.stringify(lockConditions),
      page: 1,
      perpage: 500
    }
    const lockRes = await safePost('/', lockPayload, { skipRisk: true })
    const locks = (lockRes.list || []).map(normalizeRecord)

    const bookedSlotStarts = new Set(bookings.map(b => b.slot_start))
    const lockedSlotStarts = new Set(locks.map(l => l.slot_start))

    return slots.map(slot => ({
      ...slot,
      booked: bookedSlotStarts.has(slot.slot_start),
      locked: lockedSlotStarts.has(slot.slot_start)
    }))
  },

  async getLockedDates(date, instrument_id) {
    const conditions = [
      ['lock_date', '>=', date],
      ['instrument_id', '=', String(instrument_id)]
    ]
    const payload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: LOCKS_TABLE,
      logic: 'and',
      where: JSON.stringify(conditions),
      page: 1,
      perpage: 500
    }
    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list.map(normalizeRecord)
  },

  async addDayLock(data) {
    const payload = {
      s: 'App.Table.Create',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: LOCKS_TABLE,
      data: JSON.stringify(data)
    }
    const res = await safePost('/', { ...payload, __admin: true })
    return normalizeRecord(res.data || data)
  },

  async deleteLock(id) {
    const payload = {
      s: 'App.Table.Delete',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: LOCKS_TABLE,
      id
    }
    await safePost('/', { ...payload, __admin: true })
    return { success: true }
  },

  async getLocks(params = {}) {
    const conditions = []
    if (params.lock_date || params.date) {
      conditions.push(['lock_date', '=', params.lock_date || params.date])
    }
    if (params.instrument_id) {
      conditions.push(['instrument_id', '=', String(params.instrument_id)])
    }
    if (params.category_id) {
      conditions.push(['category_id', '=', String(params.category_id)])
    }

    const whereClause = conditions.length > 0 ? conditions : [['id', '>', '0']]

    const payload = {
      s: 'App.Table.FreeQuery',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: LOCKS_TABLE,
      logic: 'and',
      where: JSON.stringify(whereClause),
      page: params.page || 1,
      perpage: params.perpage || 500
    }

    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list.map(normalizeRecord)
  },

  async createLock(data) {
    return this.addDayLock(data)
  }
}

export default timeSlotApi
