import { supabase } from '@/lib/supabase'

export const TimeSlotAPI = {
  list: async (categoryId) => {
    let query = supabase
      .from('time_slot')
      .select('*')
      .order('slot_index', { ascending: true })
    if (categoryId) query = query.eq('category_id', categoryId)
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  create: async (payload) => {
    const { data, error } = await supabase
      .from('time_slot')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  update: async (id, payload) => {
    const { data, error } = await supabase
      .from('time_slot')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  remove: async (id) => {
    const { error } = await supabase.from('time_slot').delete().eq('id', id)
    if (error) throw error
  },

  getLocks: async (params = {}) => {
    let query = supabase.from('lock').select('*')
    if (params.lock_date) {
      query = query.or(`lock_date.eq.${params.lock_date},scope_type.eq.long_term`)
    }
    if (params.category_id) query = query.eq('category_id', params.category_id)
    if (params.instrument_id) query = query.eq('instrument_id', params.instrument_id)
    const { data, error } = await query
    if (error) throw error
    return data || []
  },

  addLock: async (payload) => {
    const { data, error } = await supabase
      .from('lock')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  },

  removeLock: async (id) => {
    const { error } = await supabase.from('lock').delete().eq('id', id)
    if (error) throw error
  }
}