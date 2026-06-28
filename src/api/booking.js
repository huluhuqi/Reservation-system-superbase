import { safePost } from './safeRequest.js'
import { getUserId, getUserRole } from './context.js'
import { tryLock, unlock, buildLockKey } from '../lock/distributedLock.js'
import { recordBookingSuccess, recordBookingFailed } from './riskEngine.js'
import {
  logBooking,
  logAction,
  getAuditLogs
} from '../audit/index.js'

const TABLE = 'kg7500_bookings'
const APP_KEY = '4418E8F40E3E27D3EBFD592311539A89'

function normalizeRecord(record) {
  if (!record) return record
  const result = { ...record }
  if (result.id !== undefined && result._id === undefined) {
    result._id = String(result.id)
  }
  return result
}

function denormalizeData(data) {
  const cleaned = { ...data }
  delete cleaned._id
  delete cleaned.id
  delete cleaned.add_time
  delete cleaned.update_time
  delete cleaned.uuid
  delete cleaned.ext_data
  return cleaned
}

export const bookingApi = {
  async getBookings(params = {}) {
    const conditions = []
    if (params.booking_date || params.date) {
      conditions.push(['booking_date', '=', params.booking_date || params.date])
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
      model_name: TABLE,
      logic: 'and',
      where: JSON.stringify(whereClause),
      page: params.page || 1,
      perpage: params.perpage || 500
    }

    const res = await safePost('/', payload, { skipRisk: true })
    const list = res.list || []
    return list.map(normalizeRecord)
  },

  async createBooking(data) {
    const instrument_id = data.instrument_id
    const booking_date = data.booking_date || data.date
    const slot_start = data.slot_start
    const category_id = data.category_id

    if (!instrument_id || !booking_date || !slot_start) {
      logBooking('booking_create_attempt', data, 'fail', '缺少必要参数')
      throw new Error('预约数据不完整，缺少必要参数')
    }

    const lockKey = buildLockKey(instrument_id, booking_date, slot_start)

    logBooking('booking_lock_acquire', { lockKey }, 'success')

    if (!tryLock(lockKey)) {
      logBooking('booking_lock_failed', { lockKey }, 'fail', '锁获取失败')
      throw new Error('该时间段正在被其他请求处理中，请稍候')
    }

    logBooking('booking_lock_acquired', { lockKey }, 'success')

    try {
      const existing = await this.getBookingsByDate(booking_date, instrument_id, category_id)

      const conflict = existing.find(
        b => b.slot_start === slot_start
      )

      if (conflict) {
        recordBookingFailed('time_slot_conflict')
        logBooking('booking_check_conflict', { lockKey, conflictId: conflict.id }, 'fail', '时间段已被预约')
        throw new Error('该时间段已被预约，请选择其他时间')
      }

      logBooking('booking_check_passed', { lockKey }, 'success')

      const createData = denormalizeData(data)

      const payload = {
        s: 'App.Table.Create',
        app_key: APP_KEY,
        user_id: getUserId(),
        role: getUserRole(),
        model_name: TABLE,
        data: JSON.stringify(createData)
      }

      const res = await safePost('/', payload)
      const newId = res.id

      let result
      if (newId) {
        result = await this.getBookingById(newId)
      } else {
        result = normalizeRecord(data)
      }

      logBooking('booking_write_success', { lockKey, booking_id: result?.id }, 'success')

      const verified = await this.verifyBooking(result?.id)

      if (!verified) {
        logBooking('booking_verify_failed', { lockKey, booking_id: result?.id }, 'fail', '验证失败，数据可能未正确保存')
        throw new Error('预约创建后验证失败，请联系管理员')
      }

      logBooking('booking_verify_success', { lockKey, booking_id: result?.id }, 'success')

      recordBookingSuccess()
      return result

    } catch (e) {
      const errorMsg = e.message
      if (errorMsg !== '该时间段已被预约，请选择其他时间' &&
          errorMsg !== '该时间段正在被其他请求处理中，请稍候' &&
          errorMsg !== '预约创建后验证失败，请联系管理员') {
        recordBookingFailed(errorMsg)
        logBooking('booking_error', { lockKey }, 'fail', errorMsg)
      }
      throw e
    } finally {
      unlock(lockKey)
      logBooking('booking_lock_released', { lockKey }, 'success')
    }
  },

  async deleteBooking(id) {
    logAction('delete_booking', { booking_id: id }, 'booking')

    const payload = {
      s: 'App.Table.Delete',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      id
    }

    await safePost('/', payload)
    return { success: true }
  },

  async getBookingsByDate(date, instrument_id, category_id) {
    return this.getBookings({
      booking_date: date,
      instrument_id,
      category_id
    })
  },

  async checkAvailability(instrument_id, date, slot_start) {
    const bookings = await this.getBookingsByDate(date, instrument_id)
    return !bookings.some(b => b.slot_start === slot_start)
  },

  async getBookingById(booking_id) {
    if (!booking_id) return null

    const payload = {
      s: 'App.Table.Get',
      app_key: APP_KEY,
      user_id: getUserId(),
      role: getUserRole(),
      model_name: TABLE,
      id: booking_id
    }

    const res = await safePost('/', payload, { skipRisk: true })
    return res.data ? normalizeRecord(res.data) : null
  },

  async verifyBooking(booking_id) {
    if (!booking_id) return false

    try {
      const record = await this.getBookingById(booking_id)
      return record !== null && record !== undefined
    } catch (e) {
      return false
    }
  },

  async getBookingAuditLogs(limit = 50) {
    return getAuditLogs({ category: 'booking', limit })
  }
}

export default bookingApi
