import { supabase } from '@/lib/supabase'

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function normalizeBooking(item) {
  return {
    ...item,
    instrument_name: item.instrument_name || '',
    booking_remark: item.remark || '',
    user_name: item.user_name || '',
    user_email: item.user_email || ''
  }
}

export const BookingAPI = {
  list: async () => {
    const { data, error } = await supabase
      .from('booking')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(normalizeBooking)
  },

  getByDate: async (date, instrumentId, categoryId) => {
    let query = supabase.from('booking').select('*')
    if (date) query = query.eq('booking_date', date)
    if (instrumentId) query = query.eq('instrument_id', instrumentId)
    if (categoryId) query = query.eq('category_id', categoryId)
    const { data, error } = await query
    if (error) throw error
    return (data || []).map(normalizeBooking)
  },

  myBookings: async () => {
    const user = getCurrentUser()
    if (!user?.id) return []
    const { data, error } = await supabase
      .from('booking')
      .select('*')
      .eq('user_id', user.id)
      .order('booking_date', { ascending: false })
      .order('slot_start', { ascending: true })
    if (error) throw error
    return (data || []).map(normalizeBooking)
  },

  create: async (payload) => {
    const user = getCurrentUser()
    const insertData = {
      user_id: user?.id,
      user_name: user?.user_name || '',
      user_email: user?.email || '',
      instrument_id: payload.instrument_id,
      instrument_name: payload.instrument_name || '',
      category_id: payload.category_id,
      booking_date: payload.booking_date,
      slot_start: payload.slot_start,
      slot_end: payload.slot_end,
      slot_index: payload.slot_index ?? 0,
      status: payload.status || 'pending',
      remark: payload.remark || payload.booking_remark || ''
    }
    const { data, error } = await supabase
      .from('booking')
      .insert(insertData)
      .select()
      .single()
    if (error) throw error
    return normalizeBooking(data)
  },

  createBatch: async (items) => {
    const user = getCurrentUser()
    const insertData = items.map(item => ({
      user_id: user?.id,
      user_name: user?.user_name || '',
      user_email: user?.email || '',
      instrument_id: item.instrument_id,
      instrument_name: item.instrument_name || '',
      category_id: item.category_id,
      booking_date: item.booking_date,
      slot_start: item.slot_start,
      slot_end: item.slot_end,
      slot_index: item.slot_index ?? 0,
      status: item.status || 'pending',
      remark: item.remark || item.booking_remark || ''
    }))
    const { data, error } = await supabase
      .from('booking')
      .insert(insertData)
      .select()
    if (error) throw error
    return (data || []).map(normalizeBooking)
  },

  createOne: async (item) => {
    const user = getCurrentUser()
    const insertData = {
      user_id: user?.id,
      user_name: user?.user_name || '',
      user_email: user?.email || '',
      instrument_id: item.instrument_id,
      instrument_name: item.instrument_name || '',
      category_id: item.category_id,
      booking_date: item.booking_date,
      slot_start: item.slot_start,
      slot_end: item.slot_end,
      slot_index: item.slot_index ?? 0,
      status: item.status || 'pending',
      remark: item.remark || item.booking_remark || ''
    }
    const { data, error } = await supabase
      .from('booking')
      .insert(insertData)
      .select()
      .single()
    if (error) {
      const errMsg = error.message || ''
      const isConflict = errMsg.includes('duplicate') || errMsg.includes('unique') || error.code === '23505'
      return { success: false, isConflict, error: errMsg }
    }
    return { success: true, data: normalizeBooking(data) }
  },

  update: async (id, payload) => {
    const updateData = {}
    if (payload.status !== undefined) updateData.status = payload.status
    if (payload.remark !== undefined) updateData.remark = payload.remark
    if (payload.booking_remark !== undefined) updateData.remark = payload.booking_remark

    const { data, error } = await supabase
      .from('booking')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return normalizeBooking(data)
  },

  remove: async (id) => {
    const { error } = await supabase.from('booking').delete().eq('id', id)
    if (error) throw error
  }
}