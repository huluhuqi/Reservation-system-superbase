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
    instrument_name: item.instrument?.name || '',
    booking_remark: item.remark || '',
    user_name: item.users?.username || item.user_name || '',
    user_email: item.users?.email || '',
    employee_no: item.users?.employee_no || item.employee_no || ''
  }
}

export const BookingAPI = {
  list: async () => {
    const { data, error } = await supabase
      .from('booking')
      .select('*, instrument(name), users(username, email)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(normalizeBooking)
  },

  getByDate: async (date, instrumentId, categoryId) => {
    let query = supabase
      .from('booking')
      .select('*, instrument(name), users(username, email)')
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
      .select('*, instrument(name)')
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
      instrument_id: payload.instrument_id,
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
      .select('*, instrument(name), users(username, email)')
      .single()
    if (error) throw error
    return normalizeBooking(data)
  },

  createBatch: async (items) => {
    const user = getCurrentUser()
    const insertData = items.map(item => ({
      user_id: user?.id,
      instrument_id: item.instrument_id,
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
      .select('*, instrument(name), users(username, email)')
    if (error) throw error
    return (data || []).map(normalizeBooking)
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
      .select('*, instrument(name), users(username, email)')
      .single()
    if (error) throw error
    return normalizeBooking(data)
  },

  remove: async (id) => {
    const { error } = await supabase.from('booking').delete().eq('id', id)
    if (error) throw error
  }
}
